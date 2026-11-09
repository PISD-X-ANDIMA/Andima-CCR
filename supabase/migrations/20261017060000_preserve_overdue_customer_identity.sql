-- Preserve uploaded C1 customer identity in Sales Overview alerts.

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
  select date_trunc('month', r.period_month)::date as period_month,
    sum(r.revenue)::numeric as revenue, sum(r.total_cost)::numeric as cost
  from public.c1_company_sales_staging_rows r
  join public.c1_document_uploads d on d.id = r.document_id
  where d.validation_status = 'validated'
    and r.period_month >= p_start_period and r.period_month < p_end_period_exclusive
  group by date_trunc('month', r.period_month)::date
), outstanding as (
  select date_trunc('month', r.due_date)::date as period_month,
    sum(r.outstanding_amount)::numeric as total_outstanding
  from public.c1_outstanding_staging_rows r
  join public.c1_document_uploads d on d.id = r.document_id
  where d.validation_status = 'validated'
    and r.due_date >= p_start_period and r.due_date < p_end_period_exclusive
  group by date_trunc('month', r.due_date)::date
), series as (
  select m.period_month, coalesce(s.revenue, 0)::numeric as revenue,
    coalesce(s.cost, 0)::numeric as cost,
    (coalesce(s.revenue, 0) - coalesce(s.cost, 0))::numeric as sales_profit,
    coalesce(o.total_outstanding, 0)::numeric as total_outstanding
  from months m left join sales s using (period_month) left join outstanding o using (period_month)
), alert_scope as (
  select a.* from public.c1_overdue_alert a
  where a.days_overdue > 30 and a.due_date >= p_start_period and a.due_date < p_end_period_exclusive
), latest_outstanding as (
  select distinct on (lower(trim(r.invoice_number)))
    r.invoice_number, r.customer_id, r.c1_customer_id, r.customer_name, r.outstanding_amount
  from public.c1_outstanding_staging_rows r
  join public.c1_document_uploads d on d.id = r.document_id
  join alert_scope a on lower(trim(r.invoice_number)) = lower(trim(a.invoice_id))
  where d.validation_status = 'validated' and r.outstanding_amount > 0
  order by lower(trim(r.invoice_number)), r.created_at desc, r.id desc
), latest_assignment as (
  select distinct on (a.invoice_id) a.invoice_id, a.assigned_to
  from public.c1_assignment a join alert_scope s on s.invoice_id = a.invoice_id
  order by a.invoice_id, a.assigned_at desc, a.assignment_id desc
), alert_rows as (
  select a.invoice_id, a.days_overdue, a.due_date, a.alert_status,
    coalesce(o.customer_id, a.customer_id) as customer_id,
    coalesce(o.c1_customer_id, a.c1_customer_id) as c1_customer_id,
    coalesce(o.customer_name, 'Pelanggan tidak tersedia') as customer_name,
    coalesce(o.outstanding_amount, 0)::numeric as amount_overdue, la.assigned_to
  from alert_scope a
  left join latest_outstanding o on lower(trim(o.invoice_number)) = lower(trim(a.invoice_id::text))
  left join latest_assignment la on la.invoice_id = a.invoice_id
), has_data as (
  select exists (select 1 from sales) or exists (select 1 from outstanding) as value
)
select jsonb_build_object(
  'summary', case when (select value from has_data) then (
    select jsonb_build_object('revenue', coalesce(sum(s.revenue), 0), 'cost', coalesce(sum(s.cost), 0),
      'sales_profit', coalesce(sum(s.sales_profit), 0), 'total_outstanding', coalesce(sum(s.total_outstanding), 0)) from series s
  ) else null end,
  'series', coalesce((select jsonb_agg(to_jsonb(s) order by s.period_month) from series s), '[]'::jsonb),
  'alerts', coalesce((select jsonb_agg(jsonb_build_object(
    'id', a.invoice_id, 'days', a.days_overdue, 'client', a.customer_name, 'due', a.due_date,
    'amount', a.amount_overdue, 'riskStatus', a.alert_status, 'branch', 'Tidak tersedia',
    'branchCode', '', 'picAssigned', a.assigned_to, 'customerId', coalesce(a.c1_customer_id, a.customer_id)
  ) order by a.due_date, a.invoice_id) from alert_rows a), '[]'::jsonb)
);
$function$;

revoke all on function public.c1_get_sales_overview_analytics(date, date) from public, anon, authenticated;
grant execute on function public.c1_get_sales_overview_analytics(date, date) to service_role;

notify pgrst, 'reload schema';
