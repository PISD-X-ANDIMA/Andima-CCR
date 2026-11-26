-- Migration: Migrate document upload customer resolution to a1_customers,
-- drop public.c1_customer (preserving all other tables), and decouple branch references.

-- 1. Drop existing foreign keys pointing to c1_customer
alter table if exists public.c1_company_sales_staging_rows
  drop constraint if exists c1_company_sales_staging_rows_c1_customer_id_fkey;

alter table if exists public.c1_outstanding_staging_rows
  drop constraint if exists c1_outstanding_staging_rows_c1_customer_id_fkey;

alter table if exists public.c1_overdue_alert
  drop constraint if exists c1_overdue_alert_c1_customer_id_fkey;

alter table if exists public.c1_payment_transactions
  drop constraint if exists c1_payment_transactions_customer_id_fkey;

-- 2. Remap existing staging rows and alerts to public.a1_customers before dropping c1_customer
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'c1_company_sales_staging_rows') and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'a1_customers') then
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'c1_customer') then
      update public.c1_company_sales_staging_rows s
      set c1_customer_id = coalesce(
        (select a.id from public.a1_customers a join public.c1_customer c on regexp_replace(upper(trim(a.company_name)), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(trim(c.customer_name)), '[^A-Z0-9]', '', 'g') where c.customer_id = s.c1_customer_id limit 1),
        (select a.id from public.a1_customers a join public.c1_customer c on upper(trim(a.company_name)) like '%' || upper(trim(c.customer_name)) || '%' or upper(trim(c.customer_name)) like '%' || upper(trim(a.company_name)) || '%' where c.customer_id = s.c1_customer_id limit 1)
      );
    end if;
    update public.c1_company_sales_staging_rows s
    set c1_customer_id = null
    where s.c1_customer_id is not null
      and not exists (select 1 from public.a1_customers a where a.id = s.c1_customer_id);
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'c1_outstanding_staging_rows') and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'a1_customers') then
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'c1_customer') then
      update public.c1_outstanding_staging_rows o
      set c1_customer_id = coalesce(
        (select a.id from public.a1_customers a join public.c1_customer c on regexp_replace(upper(trim(a.company_name)), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(trim(c.customer_name)), '[^A-Z0-9]', '', 'g') where c.customer_id = o.c1_customer_id limit 1),
        (select a.id from public.a1_customers a join public.c1_customer c on upper(trim(a.company_name)) like '%' || upper(trim(c.customer_name)) || '%' or upper(trim(c.customer_name)) like '%' || upper(trim(a.company_name)) || '%' where c.customer_id = o.c1_customer_id limit 1)
      );
    end if;
    update public.c1_outstanding_staging_rows o
    set c1_customer_id = null
    where o.c1_customer_id is not null
      and not exists (select 1 from public.a1_customers a where a.id = o.c1_customer_id);
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'c1_overdue_alert') and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'a1_customers') then
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'c1_customer') then
      update public.c1_overdue_alert oa
      set c1_customer_id = (
        select a.id
        from public.a1_customers a
        join public.c1_customer c on regexp_replace(upper(trim(a.company_name)), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(trim(c.customer_name)), '[^A-Z0-9]', '', 'g')
        where c.customer_id = oa.c1_customer_id
        limit 1
      )
      where oa.c1_customer_id is not null;
    end if;
    update public.c1_overdue_alert oa
    set c1_customer_id = null
    where oa.c1_customer_id is not null
      and not exists (select 1 from public.a1_customers a where a.id = oa.c1_customer_id);
  end if;
end $$;

-- 3. Drop c1_customer / c1_customers table (strictly only this table)
drop table if exists public.c1_customer cascade;
drop table if exists public.c1_customers cascade;

-- 4. Re-point foreign keys to public.a1_customers(id)
alter table if exists public.c1_company_sales_staging_rows
  add constraint c1_company_sales_staging_rows_c1_customer_id_fkey
  foreign key (c1_customer_id) references public.a1_customers(id) on delete set null;

alter table if exists public.c1_outstanding_staging_rows
  add constraint c1_outstanding_staging_rows_c1_customer_id_fkey
  foreign key (c1_customer_id) references public.a1_customers(id) on delete set null;

alter table if exists public.c1_overdue_alert
  add constraint c1_overdue_alert_c1_customer_id_fkey
  foreign key (c1_customer_id) references public.a1_customers(id) on delete set null;

-- 4. Update c1_resolve_uploaded_customers to resolve against public.a1_customers
drop function if exists public.c1_resolve_uploaded_customers(uuid, jsonb);
create or replace function public.c1_resolve_uploaded_customers(
  p_document_id uuid,
  p_customers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  item record;
  resolved_id uuid;
  resolved_name text;
  resolved_code text;
  generated_code text;
  lock_name bigint;
  lock_code bigint;
  result jsonb := '[]'::jsonb;
begin
  if p_document_id is null then
    raise exception 'Document id is required';
  end if;

  for item in
    select distinct
      trim(value->>'customer_name') as customer_name,
      nullif(trim(value->>'customer_code'), '') as customer_code
    from jsonb_array_elements(coalesce(p_customers, '[]'::jsonb)) as values(value)
    where nullif(trim(value->>'customer_name'), '') is not null
      and lower(trim(value->>'customer_name')) <> lower('Tidak ditemukan')
  loop
    resolved_id := null;
    lock_name := hashtextextended('name:' || lower(item.customer_name), 0);
    lock_code := case when item.customer_code is null then lock_name else hashtextextended('code:' || lower(item.customer_code), 0) end;
    perform pg_advisory_xact_lock(least(lock_name, lock_code));
    if lock_name <> lock_code then
      perform pg_advisory_xact_lock(greatest(lock_name, lock_code));
    end if;

    -- Match 1: By company code
    if item.customer_code is not null then
      select a.id, a.company_name, a.company_code
        into resolved_id, resolved_name, resolved_code
        from public.a1_customers a
       where lower(trim(a.company_code)) = lower(item.customer_code)
         and a.deleted_at is null
       order by a.created_at nulls last, a.id
       limit 1;
    end if;

    -- Match 2: By exact or normalized company name
    if resolved_id is null then
      select a.id, a.company_name, a.company_code
        into resolved_id, resolved_name, resolved_code
        from public.a1_customers a
       where a.deleted_at is null
         and (
           lower(trim(a.company_name)) = lower(item.customer_name)
           or public.c1_normalize_company_name(a.company_name) = public.c1_normalize_company_name(item.customer_name)
         )
       order by a.created_at nulls last, a.id
       limit 1;
    end if;

    -- Fallback: If not found, insert into a1_customers
    if resolved_id is null then
      generated_code := left(coalesce(item.customer_code, 'UPLOAD-' || substr(md5(p_document_id::text || ':' || lower(item.customer_name)), 1, 10)), 50);
      insert into public.a1_customers (company_code, company_name)
      values (generated_code, item.customer_name)
      returning id, company_name, company_code into resolved_id, resolved_name, resolved_code;
    end if;

    result := result || jsonb_build_array(jsonb_build_object(
      'requested_customer_name', item.customer_name,
      'requested_customer_code', item.customer_code,
      'customer_name', resolved_name,
      'customer_code', resolved_code,
      'c1_customer_id', resolved_id
    ));
  end loop;

  return jsonb_build_object('items', result);
end;
$function$;

-- 5. Safe no-op cleanup function for unreferenced upload customers
drop function if exists public.c1_cleanup_unreferenced_upload_customers(uuid);
drop function if exists public.c1_cleanup_unreferenced_upload_customers();
create or replace function public.c1_cleanup_unreferenced_upload_customers(p_document_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- No-op: master customers are maintained in a1_customers without garbage collection
  return 0;
end;
$function$;

-- 6. Update c1_delete_uploaded_document to cascade deletion without referencing c1_customer
drop function if exists public.c1_delete_uploaded_document(uuid, uuid);
drop function if exists public.c1_delete_uploaded_document(uuid);
create or replace function public.c1_delete_uploaded_document(
  p_document_id uuid,
  p_deleted_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  target public.c1_document_uploads%rowtype;
  audit_key uuid;
begin
  select * into target
  from public.c1_document_uploads
  where id = p_document_id
  for update;

  if not found then
    raise exception using message = 'DOCUMENT_NOT_FOUND', errcode = 'P0002';
  end if;
  if target.validation_status = 'processing' then
    raise exception using message = 'DOCUMENT_PROCESSING', errcode = 'P0001';
  end if;
  if target.validation_status not in ('validated', 'rejected', 'uploaded') then
    raise exception using message = 'DOCUMENT_STATUS_NOT_DELETABLE', errcode = 'P0001';
  end if;

  insert into public.c1_document_deletion_audit (
    document_id, file_name, document_type, validation_status,
    uploader_user_id, deleted_by, storage_bucket, storage_path
  ) values (
    target.id, target.file_name, target.document_type, target.validation_status,
    target.uploader_user_id, p_deleted_by, target.storage_bucket, target.storage_path
  ) returning audit_id into audit_key;

  if to_regclass('public.b1_salesperform_board') is not null then
    delete from public.b1_salesperform_board b
    where (b.sales_row_id in (select s.id from public.c1_company_sales_staging_rows s where s.document_id = target.id))
       or (b.outstanding_row_id in (select o.id from public.c1_outstanding_staging_rows o where o.document_id = target.id));
  end if;

  if target.document_type = 'OUTSTANDING_REPORT' then
    delete from public.c1_payment_transactions p
    where p.invoice_number in (
      select o.invoice_number 
      from public.c1_outstanding_staging_rows o 
      where o.document_id = target.id
    )
    and not exists (
      select 1 
      from public.c1_outstanding_staging_rows other_o
      where other_o.invoice_number = p.invoice_number
        and other_o.document_id <> target.id
    );

    delete from public.c1_assignment a
    where a.invoice_number in (
      select o.invoice_number
      from public.c1_outstanding_staging_rows o
      where o.document_id = target.id
    )
    and not exists (
      select 1
      from public.c1_outstanding_staging_rows other_o
      where other_o.invoice_number = a.invoice_number
        and other_o.document_id <> target.id
    );
  end if;

  delete from public.c1_document_uploads where id = target.id;

  if target.document_type = 'OUTSTANDING_REPORT' then
    perform public.c1_refresh_overdue_alerts(current_date);
  end if;

  delete from public.c1_macro_metric m
  where not exists (
    select 1 from public.c1_company_sales_staging_rows r
    join public.c1_document_uploads d on d.id = r.document_id and d.validation_status = 'validated'
    where date_trunc('month', r.period_month)::date = m.period_month
  ) and not exists (
    select 1 from public.c1_outstanding_staging_rows r
    join public.c1_document_uploads d on d.id = r.document_id and d.validation_status = 'validated'
    where date_trunc('month', r.due_date)::date = m.period_month
  );

  insert into public.c1_macro_metric (period_month, revenue, cost, total_outstanding, validation_status)
  select coalesce(s.period_month, o.period_month)::date,
         coalesce(s.revenue, 0),
         coalesce(s.cost, 0),
         coalesce(o.outstanding, 0),
         'validated'
  from (
    select date_trunc('month', r.period_month)::date as period_month,
           sum(r.revenue)::numeric as revenue,
           sum(r.total_cost)::numeric as cost
    from public.c1_company_sales_staging_rows r
    join public.c1_document_uploads d on d.id = r.document_id and d.validation_status = 'validated'
    group by date_trunc('month', r.period_month)::date
  ) s
  full join (
    select date_trunc('month', r.due_date)::date as period_month,
           sum(r.outstanding_amount)::numeric as outstanding
    from public.c1_outstanding_staging_rows r
    join public.c1_document_uploads d on d.id = r.document_id and d.validation_status = 'validated'
    group by date_trunc('month', r.due_date)::date
  ) o using (period_month)
  on conflict (period_month) do update set
    revenue = excluded.revenue,
    cost = excluded.cost,
    total_outstanding = excluded.total_outstanding,
    validation_status = 'validated',
    updated_at = now();

  return jsonb_build_object(
    'audit_id', audit_key,
    'document_id', target.id,
    'file_name', target.file_name,
    'document_type', target.document_type
  );
end;
$function$;

-- 7. Update c1_get_customer_analytics to read from a1_customers and remove branch filters
drop function if exists public.c1_get_customer_analytics(text, text, text, text, text, integer, integer);
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
  select
    a.id as customer_id,
    a.company_code as customer_code,
    a.company_name as customer_name,
    null::text as npwp,
    null::text as branch,
    a.created_at,
    'MASTER'::text as source_type,
    coalesce(nullif(a.company_code, ''), public.c1_normalize_company_name(a.company_name)) as group_key
  from public.a1_customers a
  where a.deleted_at is null
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
  order by m.group_key, m.created_at nulls last, m.customer_id
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
  cross join lateral regexp_matches(upper(m.customer_name), '\m([0-9]{2,4}-[0-9]{6,12}|[0-9]{2,4}[- ]+[0-9]{3,6}[- ][0-9]{3,6}|[0-9]{5,14}|[A-Z]{1,6}[0-9]{5,}[A-Z0-9]*|[A-Z0-9]*[0-9]{5,}[A-Z0-9]*)\M', 'g') match
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
valid_sales_docs as (
  select id from public.c1_document_uploads
  where document_type = 'COMPANY_SALES_REPORT' and validation_status = 'validated'
),
valid_outstanding_docs as (
  select id from public.c1_document_uploads
  where document_type = 'OUTSTANDING_REPORT' and validation_status = 'validated'
),
sales_rows as (
  select coalesce(ci.canonical_customer_id, r.c1_customer_id) as customer_id,
         r.period_month, r.revenue, r.total_cost
  from public.c1_company_sales_staging_rows r
  join valid_sales_docs d on d.id = r.document_id
  left join customer_identity ci on ci.source_customer_id = r.c1_customer_id
),
outstanding_rows as (
  select coalesce(ci.canonical_customer_id, r.c1_customer_id) as customer_id,
         r.outstanding_amount, r.due_date
  from public.c1_outstanding_staging_rows r
  join valid_outstanding_docs d on d.id = r.document_id
  left join customer_identity ci on ci.source_customer_id = r.c1_customer_id
  where r.bulk_close_status is distinct from 'CLOSED'
),
latest_period as (
  select max(period_month) as period_month from sales_rows
),
sales_monthly as (
  select customer_id, period_month,
         sum(revenue) as revenue,
         sum(total_cost) as cost
  from sales_rows
  group by customer_id, period_month
),
outstanding_by_customer as (
  select customer_id,
         sum(outstanding_amount) as total_outstanding,
         count(*) as invoice_count,
         coalesce(round(avg(greatest(extract(day from now() - due_date), 0))), 0) as dso_days
  from outstanding_rows
  group by customer_id
),
payment_tx as (
  select coalesce(ci.canonical_customer_id, pt.customer_id) as customer_id,
         date_trunc('month', pt.payment_date)::date as period_month,
         pt.amount
  from public.c1_payment_transactions pt
  left join customer_identity ci on ci.source_customer_id = pt.customer_id
),
payment_monthly as (
  select customer_id, period_month, sum(amount) as amount
  from payment_tx
  group by customer_id, period_month
),
normalized as (
  select c.group_key, c.customer_id::text customer_uuid, c.customer_id::text display_id, c.customer_name,
    c.npwp, 'Head Office'::text branch, coalesce(sm.revenue, 0)::numeric revenue,
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
  where (p_search is null or trim(p_search) = '' or lower(n.customer_name) like '%' || lower(trim(p_search)) || '%'
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
all_kpi as (
  select count(*)::integer total_customers, coalesce(sum(revenue), 0)::numeric total_revenue,
    coalesce(sum(cost), 0)::numeric total_cost, coalesce(sum(sales_profit), 0)::numeric total_profit,
    coalesce(sum(total_outstanding), 0)::numeric total_outstanding, (select period_month from latest_period) latest_period
  from normalized
)
select jsonb_build_object(
  'customers', coalesce((select jsonb_agg(jsonb_build_object(
    'id', customer_uuid, 'company_group_id', customer_uuid, 'customer_id', customer_uuid,
    'customer_name', customer_name, 'customer_code', customer_codes[1], 'customer_codes', coalesce(customer_codes, '{}'::text[]),
    'customer_aliases', coalesce(customer_aliases, '[]'::jsonb), 'npwp', npwp, 'location_detail', '', 'branch', '',
    'branch_office_badge', '', 'revenue', revenue, 'sales_profit', sales_profit, 'sales_profit_trend', 'flat',
    'cost', cost, 'current_month_cost', cost, 'total_outstanding', total_outstanding, 'dso_days', dso_days,
    'credit_limit', 0, 'payment_accuracy', 0, 'active_invoices_count', invoice_count, 'payment_trend', '[]'::jsonb,
    'payment_changes', '[]'::jsonb
  ) order by display_rank) from page_rows), '[]'::jsonb),
  'kpi', (select jsonb_build_object('totalCustomers', total_customers, 'totalActiveCustomers', total_customers,
    'totalRevenue', total_revenue, 'totalCost', total_cost, 'currentMonthCost', total_cost,
    'currentMonthSalesProfit', total_profit, 'totalOutstanding', total_outstanding, 'period', latest_period,
    'branchBreakdown', jsonb_build_object('jkt', 0, 'sub', 0, 'smg', 0, 'bpn', 0, 'medan', 0),
    'highRiskOutstanding', 0, 'highRiskAccountCount', 0, 'topContributingCustomer', null) from all_kpi),
  'total_items', coalesce((select max(total_items) from page_rows), (select count(*) from filtered))
);
$function$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.c1_resolve_uploaded_customers(uuid, jsonb) from public, anon, authenticated;
    revoke all on function public.c1_cleanup_unreferenced_upload_customers(uuid) from public, anon, authenticated;
    grant execute on function public.c1_resolve_uploaded_customers(uuid, jsonb) to service_role;
    grant execute on function public.c1_cleanup_unreferenced_upload_customers(uuid) to service_role;
  end if;
end $$;
