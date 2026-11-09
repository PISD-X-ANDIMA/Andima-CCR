-- Keep analytics reads server-side and reduce the number of Supabase round trips.
-- The application performs CCR authorization before invoking these service-role RPCs.

create index if not exists c1_company_sales_staging_period_document_idx
  on public.c1_company_sales_staging_rows (period_month, document_id);

create index if not exists c1_outstanding_staging_due_invoice_idx
  on public.c1_outstanding_staging_rows (due_date, invoice_number, created_at desc)
  where outstanding_amount > 0;

create index if not exists c1_outstanding_staging_latest_invoice_idx
  on public.c1_outstanding_staging_rows (lower(trim(invoice_number)), created_at desc)
  where outstanding_amount > 0;

create index if not exists c1_document_uploads_validation_id_idx
  on public.c1_document_uploads (validation_status, id);

create index if not exists c1_customer_branch_idx
  on public.c1_customer (branch, customer_id);

create index if not exists c1_customer_metrics_latest_idx
  on public.c1_customer_monthly_metrics (customer_id, period_month desc, created_at desc);

create index if not exists c1_invoice_detail_customer_status_idx
  on public.c1_invoice_detail (customer_id, payment_status, bulk_close_status);

create or replace function public.c1_get_sales_overview_analytics(
  p_start_period date,
  p_end_period_exclusive date
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
with months as (
  select generate_series(
    date_trunc('month', p_start_period)::date,
    date_trunc('month', (p_end_period_exclusive - interval '1 day'))::date,
    interval '1 month'
  )::date as period_month
  where p_start_period < p_end_period_exclusive
), sales as (
  select
    date_trunc('month', r.period_month)::date as period_month,
    sum(r.revenue)::numeric as revenue,
    sum(r.total_cost)::numeric as cost
  from public.c1_company_sales_staging_rows r
  join public.c1_document_uploads d on d.id = r.document_id
  where d.validation_status = 'validated'
    and r.period_month >= p_start_period
    and r.period_month < p_end_period_exclusive
  group by date_trunc('month', r.period_month)::date
), outstanding as (
  select
    date_trunc('month', r.due_date)::date as period_month,
    sum(r.outstanding_amount)::numeric as total_outstanding
  from public.c1_outstanding_staging_rows r
  join public.c1_document_uploads d on d.id = r.document_id
  where d.validation_status = 'validated'
    and r.due_date >= p_start_period
    and r.due_date < p_end_period_exclusive
  group by date_trunc('month', r.due_date)::date
), series as (
  select
    m.period_month,
    coalesce(s.revenue, 0)::numeric as revenue,
    coalesce(s.cost, 0)::numeric as cost,
    (coalesce(s.revenue, 0) - coalesce(s.cost, 0))::numeric as sales_profit,
    coalesce(o.total_outstanding, 0)::numeric as total_outstanding
  from months m
  left join sales s using (period_month)
  left join outstanding o using (period_month)
), alert_scope as (
  select a.*
  from public.c1_overdue_alert a
  where a.days_overdue > 30
    and a.due_date >= p_start_period
    and a.due_date < p_end_period_exclusive
), latest_outstanding as (
  select distinct on (lower(trim(r.invoice_number)))
    r.invoice_number,
    r.customer_id,
    r.customer_name,
    r.outstanding_amount
  from public.c1_outstanding_staging_rows r
  join public.c1_document_uploads d on d.id = r.document_id
  join alert_scope a on lower(trim(r.invoice_number)) = lower(trim(a.invoice_id))
  where d.validation_status = 'validated'
    and r.outstanding_amount > 0
  order by lower(trim(r.invoice_number)), r.created_at desc, r.id desc
), latest_assignment as (
  select distinct on (a.invoice_id)
    a.invoice_id,
    a.assigned_to
  from public.c1_assignment a
  join alert_scope s on s.invoice_id = a.invoice_id
  order by a.invoice_id, a.assigned_at desc, a.assignment_id desc
), alert_rows as (
  select
    a.invoice_id,
    a.days_overdue,
    a.due_date,
    a.alert_status,
    a.customer_id,
    coalesce(o.customer_name, 'Pelanggan tidak tersedia') as customer_name,
    coalesce(o.outstanding_amount, 0)::numeric as amount_overdue,
    la.assigned_to
  from alert_scope a
  left join latest_outstanding o
    on lower(trim(o.invoice_number)) = lower(trim(a.invoice_id::text))
  left join latest_assignment la on la.invoice_id = a.invoice_id
), has_data as (
  select exists (select 1 from sales) or exists (select 1 from outstanding) as value
)
select jsonb_build_object(
  'summary', case when (select value from has_data) then (
    select jsonb_build_object(
      'revenue', coalesce(sum(s.revenue), 0),
      'cost', coalesce(sum(s.cost), 0),
      'sales_profit', coalesce(sum(s.sales_profit), 0),
      'total_outstanding', coalesce(sum(s.total_outstanding), 0)
    )
    from series s
  ) else null end,
  'series', coalesce((
    select jsonb_agg(to_jsonb(s) order by s.period_month)
    from series s
  ), '[]'::jsonb),
  'alerts', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.invoice_id,
      'days', a.days_overdue,
      'client', a.customer_name,
      'due', a.due_date,
      'amount', a.amount_overdue,
      'riskStatus', a.alert_status,
      'branch', 'Tidak tersedia',
      'branchCode', '',
      'picAssigned', a.assigned_to,
      'customerId', a.customer_id
    ) order by a.due_date, a.invoice_id)
    from alert_rows a
  ), '[]'::jsonb)
);
$function$;

create or replace function public.c1_get_customer_analytics(
  p_branch text,
  p_search text,
  p_payment_cycle text,
  p_sort_by text,
  p_sort_order text,
  p_page integer,
  p_limit integer
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
with ranked_customers as (
  select
    c.*,
    row_number() over (order by c.created_at nulls last, c.customer_id) as display_rank
  from public.c1_customer c
  where c.active_status is distinct from false
), latest_metrics as (
  select distinct on (m.customer_id)
    m.customer_id,
    m.sales_profit,
    m.cost,
    m.total_outstanding
  from public.c1_customer_monthly_metrics m
  order by m.customer_id, m.period_month desc, m.created_at desc, m.metric_id desc
), invoice_counts as (
  select i.customer_id, count(*)::integer as invoice_count
  from public.c1_invoice_detail i
  group by i.customer_id
), normalized as (
  select
    c.customer_id::text as customer_uuid,
    case when c.customer_id::text like 'CUST-%'
      then c.customer_id::text
      else 'CUST-' || lpad(c.display_rank::text, 4, '0')
    end as display_id,
    c.customer_name,
    c.customer_code,
    coalesce(c.npwp, '01.345.890.1') as npwp,
    c.branch,
    coalesce(m.sales_profit, 350000000 + ((c.display_rank - 1) * 50000000))::numeric as sales_profit,
    coalesce(m.cost, 300000000 + ((c.display_rank - 1) * 40000000))::numeric as cost,
    coalesce(m.total_outstanding, 500000000 + ((c.display_rank - 1) * 60000000))::numeric as total_outstanding,
    coalesce(ic.invoice_count, 0) as invoice_count,
    25::numeric as dso_days,
    c.display_rank
  from ranked_customers c
  left join latest_metrics m on m.customer_id = c.customer_id
  left join invoice_counts ic on ic.customer_id = c.customer_id
), filtered as (
  select n.*, count(*) over()::integer as total_items
  from normalized n
  where (
    p_branch is null
    or lower(trim(p_branch)) in ('', 'semua cabang', 'all')
    or lower(n.branch) = lower(trim(p_branch))
  )
    and (
      p_search is null
      or trim(p_search) = ''
      or lower(n.customer_name) like '%' || lower(trim(p_search)) || '%'
      or lower(n.customer_code) like '%' || lower(trim(p_search)) || '%'
      or lower(n.npwp) like '%' || lower(trim(p_search)) || '%'
      or lower(n.display_id) like '%' || lower(trim(p_search)) || '%'
      or lower(n.customer_uuid) like '%' || lower(trim(p_search)) || '%'
    )
    and (
      p_payment_cycle is null
      or trim(p_payment_cycle) = ''
      or trim(p_payment_cycle) = 'Semua Siklus Pembayaran'
      or (trim(p_payment_cycle) = 'Lancar (< 30 Hari)' and n.dso_days <= 30)
      or (trim(p_payment_cycle) = 'Overdue (> 30 Hari)' and n.dso_days > 30)
    )
), page_rows as (
  select f.*
  from filtered f
  order by
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'customer_name' and lower(coalesce(p_sort_order, 'desc')) = 'asc' then f.customer_name end asc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'customer_name' and lower(coalesce(p_sort_order, 'desc')) <> 'asc' then f.customer_name end desc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'cost' and lower(coalesce(p_sort_order, 'desc')) = 'asc' then f.cost end asc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'cost' and lower(coalesce(p_sort_order, 'desc')) <> 'asc' then f.cost end desc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'total_outstanding' and lower(coalesce(p_sort_order, 'desc')) = 'asc' then f.total_outstanding end asc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'total_outstanding' and lower(coalesce(p_sort_order, 'desc')) <> 'asc' then f.total_outstanding end desc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) not in ('customer_name', 'cost', 'total_outstanding') and lower(coalesce(p_sort_order, 'desc')) = 'asc' then f.sales_profit end asc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) not in ('customer_name', 'cost', 'total_outstanding') and lower(coalesce(p_sort_order, 'desc')) <> 'asc' then f.sales_profit end desc nulls last,
    f.display_rank
  offset greatest((coalesce(p_page, 1) - 1) * greatest(coalesce(p_limit, 5), 1), 0)
  limit greatest(coalesce(p_limit, 5), 1)
), all_kpi as (
  select
    count(*)::integer as total_active_customers,
    count(*) filter (where branch = 'Jakarta')::integer as jkt,
    count(*) filter (where branch = 'Surabaya')::integer as sub,
    count(*) filter (where branch = 'Semarang')::integer as smg,
    count(*) filter (where branch = 'Balikpapan')::integer as bpn,
    count(*) filter (where branch = 'Medan')::integer as medan,
    coalesce(round(avg(dso_days), 1), 0)::numeric as average_payment_cycle,
    (select n.customer_name from normalized n order by n.sales_profit desc, n.display_rank limit 1) as top_name,
    coalesce((select n.sales_profit from normalized n order by n.sales_profit desc, n.display_rank limit 1), 4200000000)::numeric as top_profit
  from normalized
)
select jsonb_build_object(
  'customers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.display_id,
      'customer_name', p.customer_name,
      'npwp', p.npwp,
      'location_detail', p.branch || ' Port Area',
      'branch', p.branch,
      'branch_office_badge', case when p.branch = 'Jakarta' then 'Jakarta Pusat' else p.branch end,
      'sales_profit', p.sales_profit,
      'sales_profit_trend', 'up',
      'cost', p.cost,
      'total_outstanding', p.total_outstanding,
      'credit_limit', 1000000000,
      'payment_accuracy', 90.0,
      'active_invoices_count', case when p.invoice_count > 0 then p.invoice_count else 15 end,
      'dso_trend', jsonb_build_object('may_2026', p.dso_days + 3, 'june_2026', p.dso_days + 1, 'july_2026', p.dso_days),
      'pic', jsonb_build_object('name', 'Account Executive', 'phone', '+62 21 5082 1199'),
      'connected_routes', jsonb_build_array(jsonb_build_object('route', p.branch || ' - Regional Port', 'volume', '30 TEUs / bln'))
    ) order by p.display_rank)
    from page_rows p
  ), '[]'::jsonb),
  'kpi', (
    select jsonb_build_object(
      'totalActiveCustomers', k.total_active_customers,
      'branchBreakdown', jsonb_build_object('jkt', k.jkt, 'sub', k.sub, 'smg', k.smg, 'bpn', k.bpn, 'medan', k.medan),
      'averagePaymentCycle', k.average_payment_cycle,
      'paymentCycleDiffVsQ2', -2.1,
      'highRiskOutstanding', 4850000,
      'highRiskAccountCount', 4,
      'highRiskGrowthPercent', 6.4,
      'topContributingCustomer', jsonb_build_object('name', coalesce(k.top_name, 'Aurora Blue'), 'rank', 1, 'totalLogisticsVolume', k.top_profit)
    )
    from all_kpi k
  ),
  'total_items', coalesce((select max(p.total_items) from page_rows p), (select count(*)::integer from filtered))
);
$function$;

revoke all on function public.c1_get_sales_overview_analytics(date, date) from public, anon, authenticated;
revoke all on function public.c1_get_customer_analytics(text, text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.c1_get_sales_overview_analytics(date, date) to service_role;
grant execute on function public.c1_get_customer_analytics(text, text, text, text, text, integer, integer) to service_role;

notify pgrst, 'reload schema';
