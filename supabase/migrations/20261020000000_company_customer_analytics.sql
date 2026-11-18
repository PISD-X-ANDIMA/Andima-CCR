-- Company-level Customer Analytics and auditable payment entries.
-- The upload tables remain the source of truth; only validated documents are read.

alter table if exists public.c1_company_sales_staging_rows
  add column if not exists c1_customer_id uuid references public.c1_customer(customer_id) on delete set null;

alter table if exists public.c1_outstanding_staging_rows
  add column if not exists c1_customer_id uuid references public.c1_customer(customer_id) on delete set null,
  add column if not exists bulk_close_status text not null default 'PENDING';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'c1_outstanding_staging_rows'
      and column_name = 'bulk_close_status'
  ) then
    alter table public.c1_outstanding_staging_rows
      drop constraint if exists c1_outstanding_bulk_close_status_check;
    alter table public.c1_outstanding_staging_rows
      add constraint c1_outstanding_bulk_close_status_check
      check (bulk_close_status in ('PENDING', 'CLOSED'));
  end if;
end $$;

-- Uploaded rows historically carried the legacy A1 customer id. Resolve that
-- identity to the canonical C1 company by stable name/code before analytics.
do $$
begin
  if to_regclass('public.c1_customer') is null then
    raise exception 'c1_customer is required for Customer Analytics';
  end if;

  update public.c1_company_sales_staging_rows r
  set c1_customer_id = (
    select c.customer_id
    from public.c1_customer c
    where lower(trim(c.customer_name)) = lower(trim(r.customer_name))
       or (c.customer_code is not null and c.customer_code = r.customer_id::text)
    order by case when c.source_type = 'MASTER' then 0 else 1 end nulls last, c.created_at nulls last, c.customer_id
    limit 1
  )
  where r.c1_customer_id is null
    and exists (select 1 from public.c1_customer c where lower(trim(c.customer_name)) = lower(trim(r.customer_name)) or (c.customer_code is not null and c.customer_code = r.customer_id::text));

  update public.c1_outstanding_staging_rows r
  set c1_customer_id = (
    select c.customer_id
    from public.c1_customer c
    where lower(trim(c.customer_name)) = lower(trim(r.customer_name))
       or (c.customer_code is not null and c.customer_code = r.customer_id::text)
    order by case when c.source_type = 'MASTER' then 0 else 1 end nulls last, c.created_at nulls last, c.customer_id
    limit 1
  )
  where r.c1_customer_id is null
    and exists (select 1 from public.c1_customer c where lower(trim(c.customer_name)) = lower(trim(r.customer_name)) or (c.customer_code is not null and c.customer_code = r.customer_id::text));
end $$;

create index if not exists c1_company_sales_analytics_customer_period_idx
  on public.c1_company_sales_staging_rows (c1_customer_id, period_month, document_id);
create index if not exists c1_outstanding_analytics_customer_invoice_idx
  on public.c1_outstanding_staging_rows (c1_customer_id, lower(trim(invoice_number)), created_at desc);

create table if not exists public.c1_payment_transactions (
  payment_id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  customer_id uuid not null references public.c1_customer(customer_id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  payment_date date not null,
  reference_no text not null check (length(trim(reference_no)) > 0),
  entered_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists c1_payment_transactions_customer_date_idx
  on public.c1_payment_transactions (customer_id, payment_date desc);
create index if not exists c1_payment_transactions_invoice_date_idx
  on public.c1_payment_transactions (lower(trim(invoice_number)), payment_date desc);

alter table public.c1_payment_transactions enable row level security;
revoke all on public.c1_payment_transactions from anon, authenticated;
grant select on public.c1_payment_transactions to service_role;
grant insert on public.c1_payment_transactions to service_role;

create or replace function public.c1_record_payment(
  p_customer_id uuid,
  p_invoice_number text,
  p_amount numeric,
  p_payment_date date,
  p_reference_no text,
  p_entered_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  invoice_outstanding numeric;
  paid_amount numeric;
  payment_row public.c1_payment_transactions;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT: Payment amount must be greater than zero';
  end if;
  if p_payment_date is null or nullif(trim(p_reference_no), '') is null then
    raise exception 'INVALID_PAYMENT: Payment date and reference are required';
  end if;

  perform pg_advisory_xact_lock(hashtext(lower(trim(p_customer_id::text || ':' || p_invoice_number))));

  select x.outstanding_amount
    into invoice_outstanding
  from (
    select distinct on (lower(trim(r.invoice_number))) r.outstanding_amount
    from public.c1_outstanding_staging_rows r
    join public.c1_document_uploads d on d.id = r.document_id
    where d.validation_status = 'validated'
      and d.document_type = 'OUTSTANDING_REPORT'
      and coalesce(r.c1_customer_id, r.customer_id) = p_customer_id
      and lower(trim(r.invoice_number)) = lower(trim(p_invoice_number))
    order by lower(trim(r.invoice_number)), r.created_at desc, r.id desc
  ) x;

  if invoice_outstanding is null then
    raise exception 'INVOICE_NOT_FOUND: Invoice is not present in validated C1 data';
  end if;

  select coalesce(sum(amount), 0)
    into paid_amount
  from public.c1_payment_transactions
  where customer_id = p_customer_id
    and lower(trim(invoice_number)) = lower(trim(p_invoice_number));

  if p_amount > greatest(invoice_outstanding - paid_amount, 0) then
    raise exception 'PAYMENT_EXCEEDS_OUTSTANDING: Payment exceeds invoice outstanding';
  end if;

  insert into public.c1_payment_transactions(invoice_number, customer_id, amount, payment_date, reference_no, entered_by)
  values (trim(p_invoice_number), p_customer_id, p_amount, p_payment_date, trim(p_reference_no), p_entered_by)
  returning * into payment_row;

  return jsonb_build_object(
    'payment_id', payment_row.payment_id,
    'invoice_number', payment_row.invoice_number,
    'amount', payment_row.amount,
    'payment_date', payment_row.payment_date,
    'reference_no', payment_row.reference_no
  );
end;
$function$;

revoke all on function public.c1_record_payment(uuid, text, numeric, date, text, uuid) from public, anon, authenticated;
grant execute on function public.c1_record_payment(uuid, text, numeric, date, text, uuid) to service_role;

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
with recursive
customer_base as (
  select distinct on (lower(trim(c.customer_name)))
    c.customer_id,
    c.customer_code,
    c.customer_name,
    c.npwp,
    c.branch,
    row_number() over (order by c.created_at nulls last, c.customer_id) as display_rank
  from public.c1_customer c
  where c.active_status is distinct from false
  order by lower(trim(c.customer_name)),
    case when c.source_type = 'MASTER' then 0 else 1 end,
    c.created_at nulls last,
    c.customer_id
),
customer_identity as (
  select
    c.customer_id as source_customer_id,
    b.customer_id as canonical_customer_id
  from public.c1_customer c
  join customer_base b
    on lower(trim(c.customer_name)) = lower(trim(b.customer_name))
),
latest_documents as (
  select id, document_type
  from public.c1_document_uploads
  where validation_status = 'validated'
),
sales_rows as (
  select
    coalesce(ci.canonical_customer_id, b.customer_id) as customer_id,
    date_trunc('month', r.period_month)::date as period_month,
    r.revenue::numeric as revenue,
    r.total_cost::numeric as cost
  from public.c1_company_sales_staging_rows r
  join latest_documents d on d.id = r.document_id and d.document_type = 'COMPANY_SALES_REPORT'
  left join customer_identity ci on ci.source_customer_id = r.c1_customer_id
  left join customer_base b
    on r.c1_customer_id is null
   and lower(trim(b.customer_name)) = lower(trim(r.customer_name))
),
sales_monthly as (
  select customer_id, period_month, sum(revenue)::numeric as revenue, sum(cost)::numeric as cost
  from sales_rows
  where customer_id is not null
  group by customer_id, period_month
),
latest_period as (
  select max(period_month) as period_month from sales_monthly
),
latest_outstanding as (
  select distinct on (coalesce(ci.canonical_customer_id, b.customer_id), lower(trim(r.invoice_number)))
    coalesce(ci.canonical_customer_id, b.customer_id) as customer_id,
    r.invoice_number,
    r.outstanding_amount::numeric as outstanding_amount,
    r.due_date,
    r.bulk_close_status
  from public.c1_outstanding_staging_rows r
  join latest_documents d on d.id = r.document_id and d.document_type = 'OUTSTANDING_REPORT'
  left join customer_identity ci on ci.source_customer_id = r.c1_customer_id
  left join customer_base b
    on r.c1_customer_id is null
   and lower(trim(b.customer_name)) = lower(trim(r.customer_name))
  order by coalesce(ci.canonical_customer_id, b.customer_id), lower(trim(r.invoice_number)), r.created_at desc, r.id desc
),
payment_by_invoice as (
  select coalesce(ci.canonical_customer_id, p.customer_id) as customer_id,
    lower(trim(p.invoice_number)) as invoice_key,
    sum(p.amount)::numeric as paid_amount
  from public.c1_payment_transactions p
  left join customer_identity ci on ci.source_customer_id = p.customer_id
  group by coalesce(ci.canonical_customer_id, p.customer_id), lower(trim(p.invoice_number))
),
outstanding_by_customer as (
  select
    o.customer_id,
    coalesce(sum(greatest(o.outstanding_amount - coalesce(p.paid_amount, 0), 0)) filter (where o.outstanding_amount - coalesce(p.paid_amount, 0) > 0), 0)::numeric as total_outstanding,
    count(*) filter (where o.bulk_close_status = 'PENDING')::integer as invoice_count,
    coalesce(avg(greatest(current_date - o.due_date, 0)) filter (where o.outstanding_amount - coalesce(p.paid_amount, 0) > 0), 0)::numeric as dso_days
  from latest_outstanding o
  left join payment_by_invoice p
    on p.customer_id = o.customer_id
   and p.invoice_key = lower(trim(o.invoice_number))
  where o.customer_id is not null
  group by o.customer_id
),
payment_monthly as (
  select coalesce(ci.canonical_customer_id, p.customer_id) as customer_id,
    date_trunc('month', p.payment_date)::date as period_month,
    sum(p.amount)::numeric as amount
  from public.c1_payment_transactions p
  left join customer_identity ci on ci.source_customer_id = p.customer_id
  group by coalesce(ci.canonical_customer_id, p.customer_id), date_trunc('month', p.payment_date)::date
),
payment_periods as (
  select p.period_month
  from latest_period l
  cross join lateral generate_series(l.period_month - interval '2 months', l.period_month, interval '1 month') p(period_month)
),
payment_series as (
  select c.customer_id, p.period_month::date, coalesce(m.amount, 0)::numeric as amount
  from customer_base c
  cross join payment_periods p
  left join payment_monthly m on m.customer_id = c.customer_id and m.period_month = p.period_month::date
),
payment_series_with_change as (
  select
    customer_id,
    period_month,
    amount,
    lag(amount) over (partition by customer_id order by period_month) as previous_amount
  from payment_series
),
normalized as (
  select
    c.customer_id::text as customer_uuid,
    c.customer_id::text as display_id,
    c.customer_id::text as customer_id,
    c.customer_name,
    c.customer_code,
    coalesce(c.npwp, '') as npwp,
    coalesce(c.branch, 'Tidak ditentukan') as branch,
    coalesce(sm.revenue, 0)::numeric as revenue,
    coalesce(sm.cost, 0)::numeric as cost,
    (coalesce(sm.revenue, 0) - coalesce(sm.cost, 0))::numeric as sales_profit,
    coalesce(ob.total_outstanding, 0)::numeric as total_outstanding,
    coalesce(ob.invoice_count, 0)::integer as invoice_count,
    coalesce(ob.dso_days, 0)::numeric as dso_days,
    c.display_rank
  from customer_base c
  left join latest_period lp on true
  left join sales_monthly sm on sm.customer_id = c.customer_id and sm.period_month = lp.period_month
  left join outstanding_by_customer ob on ob.customer_id = c.customer_id
),
filtered as (
  select n.*, count(*) over()::integer as total_items
  from normalized n
  where (
    p_branch is null or trim(p_branch) = '' or lower(trim(p_branch)) in ('semua cabang', 'all')
    or lower(n.branch) = lower(trim(p_branch))
  )
  and (
    p_search is null or trim(p_search) = ''
    or lower(n.customer_name) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(n.customer_code, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(n.customer_uuid) like '%' || lower(trim(p_search)) || '%'
  )
  and (
    p_payment_cycle is null or trim(p_payment_cycle) = '' or trim(p_payment_cycle) = 'Semua Siklus Pembayaran'
    or (trim(p_payment_cycle) = 'Lancar (< 30 Hari)' and n.dso_days <= 30)
    or (trim(p_payment_cycle) = 'Overdue (> 30 Hari)' and n.dso_days > 30)
  )
),
page_rows as (
  select f.*
  from filtered f
  order by
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'customer_name' and lower(coalesce(p_sort_order, 'desc')) = 'asc' then f.customer_name end asc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'customer_name' and lower(coalesce(p_sort_order, 'desc')) <> 'asc' then f.customer_name end desc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'cost' and lower(coalesce(p_sort_order, 'desc')) = 'asc' then f.cost end asc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'cost' and lower(coalesce(p_sort_order, 'desc')) <> 'asc' then f.cost end desc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'total_outstanding' and lower(coalesce(p_sort_order, 'desc')) = 'asc' then f.total_outstanding end asc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'total_outstanding' and lower(coalesce(p_sort_order, 'desc')) <> 'asc' then f.total_outstanding end desc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'sales_profit' and lower(coalesce(p_sort_order, 'desc')) = 'asc' then f.sales_profit end asc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'sales_profit' and lower(coalesce(p_sort_order, 'desc')) <> 'asc' then f.sales_profit end desc nulls last,
    f.display_rank
  offset greatest((coalesce(p_page, 1) - 1) * greatest(coalesce(p_limit, 5), 1), 0)
  limit greatest(coalesce(p_limit, 5), 1)
),
all_kpi as (
  select
    count(*)::integer as total_customers,
    coalesce(sum(revenue), 0)::numeric as total_revenue,
    coalesce(sum(cost), 0)::numeric as total_cost,
    coalesce(sum(sales_profit), 0)::numeric as total_profit,
    coalesce(sum(total_outstanding), 0)::numeric as total_outstanding,
    (select period_month from latest_period) as latest_period,
    count(*) filter (where branch = 'Jakarta')::integer as jkt,
    count(*) filter (where branch = 'Surabaya')::integer as sub,
    count(*) filter (where branch = 'Semarang')::integer as smg,
    count(*) filter (where branch = 'Balikpapan')::integer as bpn,
    count(*) filter (where branch = 'Medan')::integer as medan
  from normalized
),
customer_json as (
  select p.*, coalesce((select jsonb_agg(jsonb_build_object(
    'period_month', to_char(s.period_month, 'YYYY-MM-DD'),
    'amount', s.amount,
    'change', s.amount - coalesce(s.previous_amount, 0),
    'direction', case when s.previous_amount is null or s.amount = s.previous_amount then 'flat' when s.amount > s.previous_amount then 'up' else 'down' end
  ) order by s.period_month) from payment_series_with_change s where s.customer_id::text = p.customer_uuid), '[]'::jsonb) as payment_trend
  from page_rows p
)
select jsonb_build_object(
  'customers', coalesce((select jsonb_agg(jsonb_build_object(
    'id', customer_uuid,
    'customer_id', customer_uuid,
    'customer_name', customer_name,
    'customer_code', customer_code,
    'npwp', npwp,
    'location_detail', branch,
    'branch', branch,
    'branch_office_badge', branch,
    'revenue', revenue,
    'sales_profit', sales_profit,
    'sales_profit_trend', 'flat',
    'cost', cost,
    'current_month_cost', cost,
    'total_outstanding', total_outstanding,
    'dso_days', dso_days,
    'credit_limit', 0,
    'payment_accuracy', 0,
    'active_invoices_count', invoice_count,
    'payment_trend', payment_trend,
    'payment_changes', coalesce((select jsonb_agg(jsonb_build_object(
      'from_period', to_char(s.period_month - interval '1 month', 'YYYY-MM-DD'),
      'to_period', to_char(s.period_month, 'YYYY-MM-DD'),
      'amount', s.amount - coalesce(s.previous_amount, 0),
      'direction', case when s.previous_amount is null or s.amount = s.previous_amount then 'flat' when s.amount > s.previous_amount then 'up' else 'down' end
    ) order by s.period_month) from payment_series_with_change s where s.customer_id::text = customer_uuid and s.previous_amount is not null), '[]'::jsonb)
  ) order by display_rank) from customer_json), '[]'::jsonb),
  'kpi', (select jsonb_build_object(
    'totalCustomers', total_customers,
    'totalActiveCustomers', total_customers,
    'totalRevenue', total_revenue,
    'totalCost', total_cost,
    'currentMonthCost', total_cost,
    'currentMonthSalesProfit', total_profit,
    'totalOutstanding', total_outstanding,
    'period', latest_period,
    'branchBreakdown', jsonb_build_object('jkt', jkt, 'sub', sub, 'smg', smg, 'bpn', bpn, 'medan', medan),
    'highRiskOutstanding', 0,
    'highRiskAccountCount', 0,
    'topContributingCustomer', null
  ) from all_kpi),
  'total_items', coalesce((select max(total_items) from page_rows), (select count(*) from filtered))
);
$function$;

revoke all on function public.c1_get_customer_analytics(text, text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.c1_get_customer_analytics(text, text, text, text, text, integer, integer) to service_role;

notify pgrst, 'reload schema';
