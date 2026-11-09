-- Keep Customer Analysis KPI values aligned with the C1 data used by the table.
-- The KPI aggregate is intentionally independent from page filters and pagination.

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
    m.period_month,
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
    coalesce(m.sales_profit, 0)::numeric as sales_profit,
    coalesce(m.cost, 0)::numeric as cost,
    coalesce(m.total_outstanding, 0)::numeric as total_outstanding,
    coalesce(ic.invoice_count, 0) as invoice_count,
    25::numeric as dso_days,
    c.display_rank
  from ranked_customers c
  left join latest_metrics m on m.customer_id = c.customer_id
  left join invoice_counts ic on ic.customer_id = c.customer_id
), latest_outstanding as (
  select distinct on (lower(trim(r.invoice_number)))
    r.invoice_number,
    r.outstanding_amount
  from public.c1_outstanding_staging_rows r
  join public.c1_document_uploads d on d.id = r.document_id
  where d.validation_status = 'validated'
  order by lower(trim(r.invoice_number)), r.created_at desc, r.id desc
), overdue_totals as (
  select coalesce(sum(o.outstanding_amount), 0)::numeric as overdue_outstanding
  from latest_outstanding o
  join public.c1_overdue_alert a
    on lower(trim(a.invoice_id)) = lower(trim(o.invoice_number))
  where a.days_overdue > 30
    and o.outstanding_amount > 0
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
    count(*)::integer as total_customers,
    count(*) filter (where branch = 'Jakarta')::integer as jkt,
    count(*) filter (where branch = 'Surabaya')::integer as sub,
    count(*) filter (where branch = 'Semarang')::integer as smg,
    count(*) filter (where branch = 'Balikpapan')::integer as bpn,
    count(*) filter (where branch = 'Medan')::integer as medan,
    coalesce(round(avg(dso_days), 1), 0)::numeric as average_payment_cycle,
    coalesce(sum(sales_profit + cost), 0)::numeric as total_revenue,
    coalesce(sum(cost), 0)::numeric as total_cost,
    coalesce(sum(total_outstanding), 0)::numeric as total_outstanding,
    (select max(m.period_month) from latest_metrics m) as latest_period,
    (select n.customer_name from normalized n order by n.sales_profit desc, n.display_rank limit 1) as top_name,
    coalesce((select n.sales_profit from normalized n order by n.sales_profit desc, n.display_rank limit 1), 0)::numeric as top_profit
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
      'totalCustomers', k.total_customers,
      'totalRevenue', k.total_revenue,
      'totalCost', k.total_cost,
      'totalOutstanding', k.total_outstanding,
      'overdueOutstanding', (select overdue_outstanding from overdue_totals),
      'period', k.latest_period,
      'totalActiveCustomers', k.total_active_customers,
      'branchBreakdown', jsonb_build_object('jkt', k.jkt, 'sub', k.sub, 'smg', k.smg, 'bpn', k.bpn, 'medan', k.medan),
      'averagePaymentCycle', k.average_payment_cycle,
      'paymentCycleDiffVsQ2', -2.1,
      'highRiskOutstanding', (select overdue_outstanding from overdue_totals),
      'highRiskAccountCount', (select count(*)::integer from c1_overdue_alert where days_overdue > 30),
      'highRiskGrowthPercent', 0,
      'topContributingCustomer', jsonb_build_object('name', coalesce(k.top_name, 'Belum ada data'), 'rank', 1, 'totalLogisticsVolume', k.top_profit)
    )
    from all_kpi k
  ),
  'total_items', coalesce((select max(p.total_items) from page_rows p), (select count(*)::integer from filtered))
);
$function$;

revoke all on function public.c1_get_customer_analytics(text, text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.c1_get_customer_analytics(text, text, text, text, text, integer, integer) to service_role;

notify pgrst, 'reload schema';
