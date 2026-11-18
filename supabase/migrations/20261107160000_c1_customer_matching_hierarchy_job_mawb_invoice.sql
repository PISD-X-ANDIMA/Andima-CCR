-- Hierarchy Customer Matching Migration:
-- 1. Add job_number and mawb to c1_company_sales_staging_rows and add indexes.
-- 2. Backfill and resolve customer identity using the priority cascade:
--    Priority 1: job_number (patokan utama)
--    Priority 2: mawb (MAWB num)
--    Priority 3: invoice_number (Invoice num)
-- 3. Enhance c1_get_sales_overview_analytics to incorporate lateral matching via job_number and mawb.
-- 4. Re-sync c1_overdue_alert.

-- Step 1: Add job_number and mawb to c1_company_sales_staging_rows
alter table if exists public.c1_company_sales_staging_rows
  add column if not exists job_number text,
  add column if not exists mawb text;

create index if not exists c1_company_sales_job_number_idx 
  on public.c1_company_sales_staging_rows (lower(trim(job_number)));
create index if not exists c1_company_sales_mawb_idx 
  on public.c1_company_sales_staging_rows (lower(trim(mawb)));

create index if not exists c1_outstanding_job_number_idx 
  on public.c1_outstanding_staging_rows (lower(trim(job_number)));
create index if not exists c1_outstanding_mawb_idx 
  on public.c1_outstanding_staging_rows (lower(trim(mawb)));

-- Step 2: Hierarchical Matching Cascade

-- Priority 1: Match by Job Number (against Sales Staging Rows)
update public.c1_outstanding_staging_rows target
set
  customer_name = src.customer_name,
  customer_id = coalesce(target.customer_id, src.customer_id),
  c1_customer_id = coalesce(target.c1_customer_id, src.c1_customer_id)
from public.c1_company_sales_staging_rows src
where (target.customer_name is null or target.customer_name = 'Tidak ditemukan' or target.customer_name = 'Pelanggan tidak tersedia')
  and target.job_number is not null and target.job_number <> '' and target.job_number <> '-'
  and src.job_number is not null and src.job_number <> '' and src.job_number <> '-'
  and lower(trim(target.job_number)) = lower(trim(src.job_number))
  and src.customer_name is not null and src.customer_name <> 'Tidak ditemukan' and src.customer_name <> 'Pelanggan tidak tersedia';

-- Priority 1 (cont): Match by Job Number (against other Outstanding Staging Rows)
update public.c1_outstanding_staging_rows target
set
  customer_name = src.customer_name,
  customer_id = coalesce(target.customer_id, src.customer_id),
  c1_customer_id = coalesce(target.c1_customer_id, src.c1_customer_id)
from public.c1_outstanding_staging_rows src
where (target.customer_name is null or target.customer_name = 'Tidak ditemukan' or target.customer_name = 'Pelanggan tidak tersedia')
  and target.job_number is not null and target.job_number <> '' and target.job_number <> '-'
  and src.job_number is not null and src.job_number <> '' and src.job_number <> '-'
  and lower(trim(target.job_number)) = lower(trim(src.job_number))
  and src.customer_name is not null and src.customer_name <> 'Tidak ditemukan' and src.customer_name <> 'Pelanggan tidak tersedia';

-- Priority 2: Match by MAWB Number (against Sales Staging Rows)
update public.c1_outstanding_staging_rows target
set
  customer_name = src.customer_name,
  customer_id = coalesce(target.customer_id, src.customer_id),
  c1_customer_id = coalesce(target.c1_customer_id, src.c1_customer_id)
from public.c1_company_sales_staging_rows src
where (target.customer_name is null or target.customer_name = 'Tidak ditemukan' or target.customer_name = 'Pelanggan tidak tersedia')
  and target.mawb is not null and target.mawb <> '' and target.mawb <> '-'
  and src.mawb is not null and src.mawb <> '' and src.mawb <> '-'
  and lower(trim(target.mawb)) = lower(trim(src.mawb))
  and src.customer_name is not null and src.customer_name <> 'Tidak ditemukan' and src.customer_name <> 'Pelanggan tidak tersedia';

-- Priority 2 (cont): Match by MAWB Number (against other Outstanding Staging Rows)
update public.c1_outstanding_staging_rows target
set
  customer_name = src.customer_name,
  customer_id = coalesce(target.customer_id, src.customer_id),
  c1_customer_id = coalesce(target.c1_customer_id, src.c1_customer_id)
from public.c1_outstanding_staging_rows src
where (target.customer_name is null or target.customer_name = 'Tidak ditemukan' or target.customer_name = 'Pelanggan tidak tersedia')
  and target.mawb is not null and target.mawb <> '' and target.mawb <> '-'
  and src.mawb is not null and src.mawb <> '' and src.mawb <> '-'
  and lower(trim(target.mawb)) = lower(trim(src.mawb))
  and src.customer_name is not null and src.customer_name <> 'Tidak ditemukan' and src.customer_name <> 'Pelanggan tidak tersedia';

-- Priority 3: Match by Invoice Number (against other Outstanding Staging Rows)
update public.c1_outstanding_staging_rows target
set
  customer_name = src.customer_name,
  customer_id = coalesce(target.customer_id, src.customer_id),
  c1_customer_id = coalesce(target.c1_customer_id, src.c1_customer_id)
from public.c1_outstanding_staging_rows src
where (target.customer_name is null or target.customer_name = 'Tidak ditemukan' or target.customer_name = 'Pelanggan tidak tersedia')
  and target.invoice_number is not null and target.invoice_number <> ''
  and src.invoice_number is not null and src.invoice_number <> ''
  and lower(trim(target.invoice_number)) = lower(trim(src.invoice_number))
  and src.customer_name is not null and src.customer_name <> 'Tidak ditemukan' and src.customer_name <> 'Pelanggan tidak tersedia';

-- Fallback: Link c1_customer_id from c1_customer
update public.c1_outstanding_staging_rows r
set c1_customer_id = c.customer_id
from public.c1_customer c
where r.c1_customer_id is null
  and lower(trim(r.customer_name)) = lower(trim(c.customer_name))
  and r.customer_name is not null
  and r.customer_name <> 'Tidak ditemukan'
  and r.customer_name <> 'Pelanggan tidak tersedia';

-- Step 3: Enhance c1_get_sales_overview_analytics
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
    r.invoice_number, r.customer_id, r.c1_customer_id, r.customer_name, r.outstanding_amount,
    r.job_number, r.mawb
  from public.c1_outstanding_staging_rows r
  join public.c1_document_uploads d on d.id = r.document_id
  join alert_scope a on lower(trim(r.invoice_number)) = lower(trim(a.invoice_id))
  where d.validation_status = 'validated' and r.outstanding_amount > 0
  order by lower(trim(r.invoice_number)),
           case when r.customer_name is not null and lower(trim(r.customer_name)) <> 'tidak ditemukan' and lower(trim(r.customer_name)) <> 'pelanggan tidak tersedia' then 0 else 1 end,
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
      when o.customer_name is not null and lower(trim(o.customer_name)) <> 'tidak ditemukan' and lower(trim(o.customer_name)) <> 'pelanggan tidak tersedia' then o.customer_name
      when sales_by_job.customer_name is not null then sales_by_job.customer_name
      when sales_by_mawb.customer_name is not null then sales_by_mawb.customer_name
      when cust.customer_name is not null then cust.customer_name
      else 'Pelanggan tidak tersedia'
    end as customer_name,
    coalesce(o.outstanding_amount, 0)::numeric as amount_overdue, la.assigned_to
  from alert_scope a
  left join latest_outstanding o on lower(trim(o.invoice_number)) = lower(trim(a.invoice_id::text))
  left join lateral (
    select s.customer_name from public.c1_company_sales_staging_rows s
    where o.job_number is not null and o.job_number <> '' and o.job_number <> '-'
      and lower(trim(s.job_number)) = lower(trim(o.job_number))
      and s.customer_name is not null and lower(trim(s.customer_name)) <> 'tidak ditemukan'
    order by s.created_at desc limit 1
  ) sales_by_job on true
  left join lateral (
    select s.customer_name from public.c1_company_sales_staging_rows s
    where o.mawb is not null and o.mawb <> '' and o.mawb <> '-'
      and lower(trim(s.mawb)) = lower(trim(o.mawb))
      and s.customer_name is not null and lower(trim(s.customer_name)) <> 'tidak ditemukan'
    order by s.created_at desc limit 1
  ) sales_by_mawb on true
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

-- Step 4: Refresh overdue alerts projection
select public.c1_refresh_overdue_alerts(current_date);

