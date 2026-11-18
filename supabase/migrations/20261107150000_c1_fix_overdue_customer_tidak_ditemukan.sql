-- Fix overdue customer identity:
-- 1. Backfill customer_name, customer_id, and c1_customer_id on staging rows where customer_name was previously defaulted to 'Tidak ditemukan'
-- 2. Enhance c1_get_sales_overview_analytics to prioritize non-'Tidak ditemukan' customer names and fallback to c1_customer
-- 3. Enhance c1_refresh_overdue_alerts to prioritize valid customer references

-- 1. Backfill staging rows with known customer names from other uploads or c1_customer
update public.c1_outstanding_staging_rows target
set
  customer_name = src.customer_name,
  customer_id = coalesce(target.customer_id, src.customer_id),
  c1_customer_id = coalesce(target.c1_customer_id, src.c1_customer_id)
from public.c1_outstanding_staging_rows src
where lower(trim(target.invoice_number)) = lower(trim(src.invoice_number))
  and target.customer_name = 'Tidak ditemukan'
  and src.customer_name <> 'Tidak ditemukan';

-- 2. Also link c1_customer_id if c1_customer has a matching record for customer_name
update public.c1_outstanding_staging_rows r
set c1_customer_id = c.customer_id
from public.c1_customer c
where r.c1_customer_id is null
  and lower(trim(r.customer_name)) = lower(trim(c.customer_name))
  and r.customer_name <> 'Tidak ditemukan';

-- 3. Update c1_get_sales_overview_analytics
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
  order by lower(trim(r.invoice_number)),
           case when r.customer_name is not null and lower(trim(r.customer_name)) <> 'tidak ditemukan' then 0 else 1 end,
           r.created_at desc, r.id desc
), latest_assignment as (
  select distinct on (a.invoice_id) a.invoice_id, a.assigned_to
  from public.c1_assignment a join alert_scope s on s.invoice_id = a.invoice_id
  order by a.invoice_id, a.assigned_at desc, a.assignment_id desc
), alert_rows as (
  select a.invoice_id, a.days_overdue, a.due_date, a.alert_status,
    coalesce(o.customer_id, a.customer_id) as customer_id,
    coalesce(o.c1_customer_id, a.c1_customer_id) as c1_customer_id,
    case
      when o.customer_name is not null and lower(trim(o.customer_name)) <> 'tidak ditemukan' then o.customer_name
      when cust.customer_name is not null then cust.customer_name
      else 'Pelanggan tidak tersedia'
    end as customer_name,
    coalesce(o.outstanding_amount, 0)::numeric as amount_overdue, la.assigned_to
  from alert_scope a
  left join latest_outstanding o on lower(trim(o.invoice_number)) = lower(trim(a.invoice_id::text))
  left join public.c1_customer cust on cust.customer_id = coalesce(o.c1_customer_id, a.c1_customer_id, o.customer_id, a.customer_id)
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

-- 4. Update c1_refresh_overdue_alerts
create or replace function public.c1_refresh_overdue_alerts(p_evaluation_date date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  evaluated_count integer;
  overdue_count integer;
  deleted_count integer;
begin
  perform pg_advisory_xact_lock(610060003);

  with latest as (
    select distinct on (lower(trim(r.invoice_number)))
      r.invoice_number,
      r.outstanding_amount
    from public.c1_outstanding_staging_rows r
    join public.c1_document_uploads d on d.id = r.document_id
    where d.validation_status = 'validated'
    order by lower(trim(r.invoice_number)), r.created_at desc, r.id desc
  )
  delete from public.c1_overdue_alert a
   where not exists (
     select 1 from latest l
      where lower(trim(l.invoice_number)) = lower(trim(a.invoice_id))
   )
      or exists (
        select 1 from latest l
         where lower(trim(l.invoice_number)) = lower(trim(a.invoice_id))
           and l.outstanding_amount <= 0
      );
  get diagnostics deleted_count = row_count;

  with latest as (
    select distinct on (lower(trim(r.invoice_number)))
      r.invoice_number,
      r.customer_id,
      r.c1_customer_id,
      r.due_date,
      r.outstanding_amount
    from public.c1_outstanding_staging_rows r
    join public.c1_document_uploads d on d.id = r.document_id
    where d.validation_status = 'validated'
    order by lower(trim(r.invoice_number)),
             case when r.c1_customer_id is not null or r.customer_id is not null then 0 else 1 end,
             r.created_at desc, r.id desc
  ), current_rows as (
    select
      l.invoice_number,
      l.customer_id,
      l.c1_customer_id,
      l.due_date,
      greatest(0, p_evaluation_date - l.due_date)::integer as days_overdue,
      l.outstanding_amount
    from latest l
    where l.outstanding_amount > 0
  )
  insert into public.c1_overdue_alert (
    invoice_id, customer_id, c1_customer_id, due_date, evaluation_date,
    days_overdue, overdue_alert, alert_status
  )
  select
    coalesce(existing.invoice_id, c.invoice_number),
    coalesce(c.customer_id, existing.customer_id),
    coalesce(c.c1_customer_id, existing.c1_customer_id),
    c.due_date,
    p_evaluation_date,
    c.days_overdue,
    c.days_overdue > 30,
    case
      when c.days_overdue > 60 then 'LEGAL ESCALATION'
      when c.days_overdue > 30 then 'HIGH RISK'
      else 'WATCHLIST'
    end
  from current_rows c
  left join public.c1_overdue_alert existing
    on lower(trim(existing.invoice_id)) = lower(trim(c.invoice_number))
  on conflict (invoice_id) do update set
    customer_id = coalesce(excluded.customer_id, public.c1_overdue_alert.customer_id),
    c1_customer_id = coalesce(excluded.c1_customer_id, public.c1_overdue_alert.c1_customer_id),
    due_date = excluded.due_date,
    evaluation_date = excluded.evaluation_date,
    days_overdue = excluded.days_overdue,
    overdue_alert = excluded.overdue_alert,
    alert_status = excluded.alert_status;

  get diagnostics evaluated_count = row_count;
  select count(*) into overdue_count from public.c1_overdue_alert where overdue_alert = true;

  return jsonb_build_object(
    'evaluated', evaluated_count,
    'overdue', overdue_count,
    'deleted', deleted_count,
    'evaluationDate', p_evaluation_date
  );
end;
$function$;

revoke all on function public.c1_refresh_overdue_alerts(date) from public, anon, authenticated;
grant execute on function public.c1_refresh_overdue_alerts(date) to service_role;

-- 5. Synchronize c1_overdue_alert now
select public.c1_refresh_overdue_alerts(current_date);

