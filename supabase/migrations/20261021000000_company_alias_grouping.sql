-- Group C1 customer rows by normalized company identity while preserving every
-- source customer code/name as an alias.

create or replace function public.c1_clean_company_name(raw_name text)
returns text
language sql
immutable
as $function$
  select nullif(trim(regexp_replace(
    regexp_replace(coalesce(raw_name, ''),
      '\m([0-9]{2,4}-[0-9]{6,12}|[A-Z]{2,6}[0-9]{6,})\M', ' ', 'gi'),
    '\s+', ' ', 'g'
  )), '')
$function$;

create or replace function public.c1_normalize_company_name(raw_name text)
returns text
language sql
immutable
as $function$
  select nullif(trim(regexp_replace(
    regexp_replace(upper(public.c1_clean_company_name(raw_name)), '[^A-Z0-9]+', ' ', 'g'),
    '\s+', ' ', 'g'
  )), '')
$function$;

alter table if exists public.c1_customer
  add column if not exists company_name_key text;

update public.c1_customer
set company_name_key = public.c1_normalize_company_name(customer_name)
where company_name_key is distinct from public.c1_normalize_company_name(customer_name);

create index if not exists c1_customer_company_name_key_idx
  on public.c1_customer (company_name_key, active_status, created_at, customer_id);

create or replace function public.c1_sync_company_name_key()
returns trigger
language plpgsql
as $function$
begin
  new.company_name_key := public.c1_normalize_company_name(new.customer_name);
  return new;
end;
$function$;

drop trigger if exists c1_customer_company_name_key_trigger on public.c1_customer;
create trigger c1_customer_company_name_key_trigger
before insert or update of customer_name on public.c1_customer
for each row execute function public.c1_sync_company_name_key();

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
  company_key text;
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

  select c.company_name_key into company_key
  from public.c1_customer c
  where c.customer_id = p_customer_id;

  if company_key is null then
    raise exception 'INVOICE_NOT_FOUND: Company is not present in the C1 customer master';
  end if;

  perform pg_advisory_xact_lock(hashtext(lower(trim(company_key || ':' || p_invoice_number))));

  select x.outstanding_amount into invoice_outstanding
  from (
    select distinct on (lower(trim(r.invoice_number))) r.outstanding_amount
    from public.c1_outstanding_staging_rows r
    join public.c1_document_uploads d on d.id = r.document_id
    left join public.c1_customer member on member.customer_id = coalesce(r.c1_customer_id, r.customer_id)
    where d.validation_status = 'validated'
      and d.document_type = 'OUTSTANDING_REPORT'
      and coalesce(member.company_name_key, public.c1_normalize_company_name(r.customer_name)) = company_key
      and lower(trim(r.invoice_number)) = lower(trim(p_invoice_number))
    order by lower(trim(r.invoice_number)), r.created_at desc, r.id desc
  ) x;

  if invoice_outstanding is null then
    raise exception 'INVOICE_NOT_FOUND: Invoice is not present in validated C1 data';
  end if;

  select coalesce(sum(p.amount), 0) into paid_amount
  from public.c1_payment_transactions p
  join public.c1_customer member on member.customer_id = p.customer_id
  where member.company_name_key = company_key
    and lower(trim(p.invoice_number)) = lower(trim(p_invoice_number));

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
customer_members as (
  select c.*, coalesce(nullif(c.company_name_key, ''), public.c1_normalize_company_name(c.customer_name)) as group_key
  from public.c1_customer c
  where c.active_status is distinct from false
),
customer_candidates as (
  select distinct on (m.group_key)
    m.group_key,
    m.customer_id,
    public.c1_clean_company_name(m.customer_name) as customer_name,
    m.npwp,
    m.branch,
    m.created_at,
    m.source_type
  from customer_members m
  where m.group_key is not null
  order by m.group_key,
    case when m.source_type = 'MASTER' then 0 else 1 end,
    m.created_at nulls last,
    m.customer_id
),
customer_base as (
  select c.*, row_number() over (order by c.created_at nulls last, c.customer_id) as display_rank
  from customer_candidates c
),
customer_identity as (
  select m.customer_id as source_customer_id, b.customer_id as canonical_customer_id, b.group_key
  from customer_members m
  join customer_base b on b.group_key = m.group_key
),
company_code_values as (
  select m.group_key, nullif(trim(m.customer_code), '') as code
  from customer_members m
  union
  select m.group_key, match[1] as code
  from customer_members m
  cross join lateral regexp_matches(upper(m.customer_name), '\m([0-9]{2,4}-[0-9]{6,12}|[A-Z]{2,6}[0-9]{6,})\M', 'g') match
),
company_codes as (
  select x.group_key, array_agg(x.code order by x.code) as codes
  from (select distinct group_key, code from company_code_values where code is not null) x
  group by x.group_key
),
company_aliases as (
  select x.group_key, jsonb_agg(jsonb_build_object(
    'customer_id', x.customer_id,
    'customer_code', x.customer_code,
    'customer_name', x.customer_name
  ) order by x.customer_name, x.customer_code, x.customer_id) as aliases
  from (
    select distinct group_key, customer_id::text, customer_code, customer_name
    from customer_members
  ) x
  group by x.group_key
),
latest_documents as (
  select id, document_type
  from public.c1_document_uploads
  where validation_status = 'validated'
),
sales_rows as (
  select coalesce(ci.canonical_customer_id, b.customer_id) as customer_id,
    date_trunc('month', r.period_month)::date as period_month,
    r.revenue::numeric as revenue, r.total_cost::numeric as cost
  from public.c1_company_sales_staging_rows r
  join latest_documents d on d.id = r.document_id and d.document_type = 'COMPANY_SALES_REPORT'
  left join customer_identity ci on ci.source_customer_id = r.c1_customer_id
  left join customer_base b on b.group_key = public.c1_normalize_company_name(r.customer_name)
    and r.c1_customer_id is null
),
sales_monthly as (
  select customer_id, period_month, sum(revenue)::numeric revenue, sum(cost)::numeric cost
  from sales_rows where customer_id is not null group by customer_id, period_month
),
latest_period as (select max(period_month) period_month from sales_monthly),
latest_outstanding as (
  select distinct on (coalesce(ci.canonical_customer_id, b.customer_id), lower(trim(r.invoice_number)))
    coalesce(ci.canonical_customer_id, b.customer_id) customer_id,
    r.invoice_number, r.outstanding_amount::numeric outstanding_amount, r.due_date, r.bulk_close_status
  from public.c1_outstanding_staging_rows r
  join latest_documents d on d.id = r.document_id and d.document_type = 'OUTSTANDING_REPORT'
  left join customer_identity ci on ci.source_customer_id = r.c1_customer_id
  left join customer_base b on b.group_key = public.c1_normalize_company_name(r.customer_name)
    and r.c1_customer_id is null
  order by coalesce(ci.canonical_customer_id, b.customer_id), lower(trim(r.invoice_number)), r.created_at desc, r.id desc
),
payment_by_invoice as (
  select coalesce(ci.canonical_customer_id, p.customer_id) customer_id,
    lower(trim(p.invoice_number)) invoice_key, sum(p.amount)::numeric paid_amount
  from public.c1_payment_transactions p
  left join customer_identity ci on ci.source_customer_id = p.customer_id
  group by coalesce(ci.canonical_customer_id, p.customer_id), lower(trim(p.invoice_number))
),
outstanding_by_customer as (
  select o.customer_id,
    coalesce(sum(greatest(o.outstanding_amount - coalesce(p.paid_amount, 0), 0)) filter (where o.outstanding_amount - coalesce(p.paid_amount, 0) > 0), 0)::numeric total_outstanding,
    count(*) filter (where o.bulk_close_status = 'PENDING')::integer invoice_count,
    coalesce(avg(greatest(current_date - o.due_date, 0)) filter (where o.outstanding_amount - coalesce(p.paid_amount, 0) > 0), 0)::numeric dso_days
  from latest_outstanding o
  left join payment_by_invoice p on p.customer_id = o.customer_id and p.invoice_key = lower(trim(o.invoice_number))
  where o.customer_id is not null
  group by o.customer_id
),
payment_monthly as (
  select coalesce(ci.canonical_customer_id, p.customer_id) customer_id,
    date_trunc('month', p.payment_date)::date period_month, sum(p.amount)::numeric amount
  from public.c1_payment_transactions p
  left join customer_identity ci on ci.source_customer_id = p.customer_id
  group by coalesce(ci.canonical_customer_id, p.customer_id), date_trunc('month', p.payment_date)::date
),
payment_periods as (
  select p.period_month::date
  from latest_period l cross join lateral generate_series(l.period_month - interval '2 months', l.period_month, interval '1 month') p(period_month)
),
payment_series as (
  select c.customer_id, p.period_month, coalesce(m.amount, 0)::numeric amount
  from customer_base c cross join payment_periods p
  left join payment_monthly m on m.customer_id = c.customer_id and m.period_month = p.period_month
),
payment_series_with_change as (
  select customer_id, period_month, amount, lag(amount) over (partition by customer_id order by period_month) previous_amount
  from payment_series
),
normalized as (
  select c.group_key, c.customer_id::text customer_uuid, c.customer_id::text display_id, c.customer_name,
    c.npwp, coalesce(c.branch, 'Tidak ditentukan') branch, coalesce(sm.revenue, 0)::numeric revenue,
    coalesce(sm.cost, 0)::numeric cost, (coalesce(sm.revenue, 0) - coalesce(sm.cost, 0))::numeric sales_profit,
    coalesce(ob.total_outstanding, 0)::numeric total_outstanding, coalesce(ob.invoice_count, 0)::integer invoice_count,
    coalesce(ob.dso_days, 0)::numeric dso_days, c.display_rank, cc.codes customer_codes, ca.aliases customer_aliases
  from customer_base c
  left join latest_period lp on true
  left join sales_monthly sm on sm.customer_id = c.customer_id and sm.period_month = lp.period_month
  left join outstanding_by_customer ob on ob.customer_id = c.customer_id
  left join company_codes cc on cc.group_key = c.group_key
  left join company_aliases ca on ca.group_key = c.group_key
),
filtered as (
  select n.*, count(*) over()::integer total_items
  from normalized n
  where (p_branch is null or trim(p_branch) = '' or lower(trim(p_branch)) in ('semua cabang', 'all') or lower(n.branch) = lower(trim(p_branch)))
    and (p_search is null or trim(p_search) = '' or lower(n.customer_name) like '%' || lower(trim(p_search)) || '%'
      or lower(coalesce(array_to_string(n.customer_codes, ' '), '')) like '%' || lower(trim(p_search)) || '%'
      or lower(n.customer_uuid) like '%' || lower(trim(p_search)) || '%')
    and (p_payment_cycle is null or trim(p_payment_cycle) = '' or trim(p_payment_cycle) = 'Semua Siklus Pembayaran'
      or (trim(p_payment_cycle) = 'Lancar (< 30 Hari)' and n.dso_days <= 30)
      or (trim(p_payment_cycle) = 'Overdue (> 30 Hari)' and n.dso_days > 30))
),
page_rows as (
  select f.* from filtered f
  order by
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'customer_name' and lower(coalesce(p_sort_order, 'desc')) = 'asc' then f.customer_name end asc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'customer_name' and lower(coalesce(p_sort_order, 'desc')) <> 'asc' then f.customer_name end desc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'total_outstanding' and lower(coalesce(p_sort_order, 'desc')) = 'asc' then f.total_outstanding end asc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) = 'total_outstanding' and lower(coalesce(p_sort_order, 'desc')) <> 'asc' then f.total_outstanding end desc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) <> 'customer_name' and lower(coalesce(p_sort_order, 'desc')) = 'asc' then f.sales_profit end asc nulls last,
    case when lower(coalesce(p_sort_by, 'sales_profit')) <> 'customer_name' and lower(coalesce(p_sort_order, 'desc')) <> 'asc' then f.sales_profit end desc nulls last,
    f.display_rank
  offset greatest((coalesce(p_page, 1) - 1) * greatest(coalesce(p_limit, 5), 1), 0)
  limit greatest(coalesce(p_limit, 5), 1)
),
customer_json as (
  select p.*, coalesce((select jsonb_agg(jsonb_build_object(
    'period_month', to_char(s.period_month, 'YYYY-MM-DD'), 'amount', s.amount,
    'change', s.amount - coalesce(s.previous_amount, 0),
    'direction', case when s.previous_amount is null or s.amount = s.previous_amount then 'flat' when s.amount > s.previous_amount then 'up' else 'down' end
  ) order by s.period_month) from payment_series_with_change s where s.customer_id::text = p.customer_uuid), '[]'::jsonb) payment_trend
  from page_rows p
),
all_kpi as (
  select count(*)::integer total_customers, coalesce(sum(revenue), 0)::numeric total_revenue,
    coalesce(sum(cost), 0)::numeric total_cost, coalesce(sum(sales_profit), 0)::numeric total_profit,
    coalesce(sum(total_outstanding), 0)::numeric total_outstanding, (select period_month from latest_period) latest_period,
    count(*) filter (where branch = 'Jakarta')::integer jkt, count(*) filter (where branch = 'Surabaya')::integer sub,
    count(*) filter (where branch = 'Semarang')::integer smg, count(*) filter (where branch = 'Balikpapan')::integer bpn,
    count(*) filter (where branch = 'Medan')::integer medan
  from normalized
)
select jsonb_build_object(
  'customers', coalesce((select jsonb_agg(jsonb_build_object(
    'id', customer_uuid, 'company_group_id', customer_uuid, 'customer_id', customer_uuid,
    'customer_name', customer_name, 'customer_code', customer_codes[1], 'customer_codes', coalesce(customer_codes, '{}'::text[]),
    'customer_aliases', coalesce(customer_aliases, '[]'::jsonb), 'npwp', npwp, 'location_detail', branch, 'branch', branch,
    'branch_office_badge', branch, 'revenue', revenue, 'sales_profit', sales_profit, 'sales_profit_trend', 'flat',
    'cost', cost, 'current_month_cost', cost, 'total_outstanding', total_outstanding, 'dso_days', dso_days,
    'credit_limit', 0, 'payment_accuracy', 0, 'active_invoices_count', invoice_count, 'payment_trend', payment_trend,
    'payment_changes', coalesce((select jsonb_agg(jsonb_build_object(
      'from_period', to_char(s.period_month - interval '1 month', 'YYYY-MM-DD'), 'to_period', to_char(s.period_month, 'YYYY-MM-DD'),
      'amount', s.amount - coalesce(s.previous_amount, 0),
      'direction', case when s.previous_amount is null or s.amount = s.previous_amount then 'flat' when s.amount > s.previous_amount then 'up' else 'down' end
    ) order by s.period_month) from payment_series_with_change s where s.customer_id::text = customer_uuid and s.previous_amount is not null), '[]'::jsonb)
  ) order by display_rank) from customer_json), '[]'::jsonb),
  'kpi', (select jsonb_build_object('totalCustomers', total_customers, 'totalActiveCustomers', total_customers,
    'totalRevenue', total_revenue, 'totalCost', total_cost, 'currentMonthCost', total_cost,
    'currentMonthSalesProfit', total_profit, 'totalOutstanding', total_outstanding, 'period', latest_period,
    'branchBreakdown', jsonb_build_object('jkt', jkt, 'sub', sub, 'smg', smg, 'bpn', bpn, 'medan', medan),
    'highRiskOutstanding', 0, 'highRiskAccountCount', 0, 'topContributingCustomer', null) from all_kpi),
  'total_items', coalesce((select max(total_items) from page_rows), (select count(*) from filtered))
);
$function$;

revoke all on function public.c1_get_customer_analytics(text, text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.c1_get_customer_analytics(text, text, text, text, text, integer, integer) to service_role;

notify pgrst, 'reload schema';
