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

    if exists (
      select 1 from information_schema.columns 
      where table_schema = 'public' and table_name = 'c1_assignment' and column_name = 'invoice_id'
    ) then
      execute '
        delete from public.c1_assignment a
        where a.invoice_id in (
          select o.invoice_number 
          from public.c1_outstanding_staging_rows o 
          where o.document_id = $1
        )
        and not exists (
          select 1 
          from public.c1_outstanding_staging_rows other_o
          where other_o.invoice_number = a.invoice_id
            and other_o.document_id <> $1
        )' using target.id;
    elsif exists (
      select 1 from information_schema.columns 
      where table_schema = 'public' and table_name = 'c1_assignment' and column_name = 'invoice_number'
    ) then
      execute '
        delete from public.c1_assignment a
        where a.invoice_number in (
          select o.invoice_number 
          from public.c1_outstanding_staging_rows o 
          where o.document_id = $1
        )
        and not exists (
          select 1 
          from public.c1_outstanding_staging_rows other_o
          where other_o.invoice_number = a.invoice_number
            and other_o.document_id <> $1
        )' using target.id;
    end if;
  end if;

  delete from public.c1_company_sales_staging_rows where document_id = target.id;
  delete from public.c1_outstanding_staging_rows where document_id = target.id;
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
    'document_type', target.document_type,
    'storage_bucket', target.storage_bucket,
    'storage_path', target.storage_path
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
  select f.*, row_number() over (
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
  ) as sort_rank
  from filtered f
  order by sort_rank
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
  ) order by sort_rank) from page_rows), '[]'::jsonb),
  'kpi', (select jsonb_build_object('totalCustomers', total_customers, 'totalActiveCustomers', total_customers,
    'totalRevenue', total_revenue, 'totalCost', total_cost, 'currentMonthCost', total_cost,
    'currentMonthSalesProfit', total_profit, 'totalOutstanding', total_outstanding, 'period', latest_period,
    'branchBreakdown', jsonb_build_object('jkt', 0, 'sub', 0, 'smg', 0, 'bpn', 0, 'medan', 0),
    'highRiskOutstanding', 0, 'highRiskAccountCount', 0, 'topContributingCustomer', null) from all_kpi),
  'total_items', coalesce((select max(total_items) from page_rows), (select count(*) from filtered))
);
$function$;

-- 8. Decouple c1_get_sales_overview_analytics from c1_customer, join a1_customers, and grant permissions
drop function if exists public.c1_get_sales_overview_analytics(date, date);
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
    r.invoice_number, r.c1_customer_id, r.customer_name, r.outstanding_amount,
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
    coalesce(o.c1_customer_id, a.c1_customer_id) as c1_customer_id,
    case
      when o.customer_name is not null and lower(trim(o.customer_name)) <> 'tidak ditemukan' and lower(trim(o.customer_name)) <> 'pelanggan tidak tersedia' then o.customer_name
      when sales_by_job.customer_name is not null then sales_by_job.customer_name
      when sales_by_mawb.customer_name is not null then sales_by_mawb.customer_name
      when cust.company_name is not null then cust.company_name
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
  left join public.a1_customers cust on cust.id = coalesce(o.c1_customer_id, a.c1_customer_id)
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
    'branchCode', '', 'picAssigned', a.assigned_to, 'customerId', a.c1_customer_id
  ) order by a.due_date, a.invoice_id) from alert_rows a), '[]'::jsonb)
);
$function$;

-- 9. Decouple c1_record_payment from c1_customer, query a1_customers, and grant permissions
drop function if exists public.c1_record_payment(uuid, text, numeric, date, text, uuid);
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

  select coalesce(nullif(c.company_code, ''), public.c1_normalize_company_name(c.company_name)) into company_key
  from public.a1_customers c
  where c.id = p_customer_id;

  if company_key is null then
    raise exception 'INVOICE_NOT_FOUND: Company is not present in customer master';
  end if;

  perform pg_advisory_xact_lock(hashtext(lower(trim(company_key || ':' || p_invoice_number))));

  select x.outstanding_amount into invoice_outstanding
  from (
    select distinct on (lower(trim(r.invoice_number))) r.outstanding_amount
    from public.c1_outstanding_staging_rows r
    join public.c1_document_uploads d on d.id = r.document_id
    left join public.a1_customers member on member.id = r.c1_customer_id
    where d.validation_status = 'validated'
      and d.document_type = 'OUTSTANDING_REPORT'
      and coalesce(nullif(member.company_code, ''), public.c1_normalize_company_name(member.company_name), public.c1_normalize_company_name(r.customer_name)) = company_key
      and lower(trim(r.invoice_number)) = lower(trim(p_invoice_number))
    order by lower(trim(r.invoice_number)), r.created_at desc, r.id desc
  ) x;

  if invoice_outstanding is null then
    raise exception 'INVOICE_NOT_FOUND: Invoice is not present in validated C1 data';
  end if;

  select coalesce(sum(p.amount), 0) into paid_amount
  from public.c1_payment_transactions p
  join public.a1_customers member on member.id = p.customer_id
  where coalesce(nullif(member.company_code, ''), public.c1_normalize_company_name(member.company_name)) = company_key
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

-- 10. Decouple reset_c1_sales_overview_data from c1_customer
create or replace function public.reset_c1_sales_overview_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  deleted_documents integer;
  deleted_customers integer := 0;
  deleted_board_rows integer;
begin
  set local session_replication_role = replica;
  if to_regclass('public.b1_salesperform_board') is not null then
    delete from public.b1_salesperform_board;
    get diagnostics deleted_board_rows = row_count;
  else
    deleted_board_rows := 0;
  end if;
  delete from public.c1_document_validation_errors;
  delete from public.c1_company_sales_staging_rows;
  delete from public.c1_outstanding_staging_rows;
  delete from public.c1_assignment;
  if to_regclass('public.c1_mid_feed') is not null then
    execute 'delete from public.c1_mid_feed';
  end if;
  delete from public.c1_overdue_alert;
  delete from public.c1_macro_metric;
  if to_regclass('public.c1_customer') is not null then
    execute 'delete from public.c1_customer where source_type = ''UPLOAD''';
    get diagnostics deleted_customers = row_count;
  end if;
  delete from public.c1_document_uploads;
  get diagnostics deleted_documents = row_count;

  return jsonb_build_object(
    'deleted_documents', deleted_documents,
    'deleted_uploaded_customers', deleted_customers,
    'deleted_board_rows', deleted_board_rows
  );
end;
$function$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.c1_resolve_uploaded_customers(uuid, jsonb) from public, anon, authenticated;
    revoke all on function public.c1_cleanup_unreferenced_upload_customers(uuid) from public, anon, authenticated;
    grant execute on function public.c1_resolve_uploaded_customers(uuid, jsonb) to service_role;
    grant execute on function public.c1_cleanup_unreferenced_upload_customers(uuid) to service_role;

    grant execute on function public.c1_get_sales_overview_analytics(date, date) to service_role, authenticated, anon;
    grant execute on function public.c1_record_payment(uuid, text, numeric, date, text, uuid) to service_role, authenticated;
    grant execute on function public.reset_c1_sales_overview_data() to service_role;
    grant execute on function public.c1_delete_uploaded_document(uuid, uuid) to service_role, authenticated;
  end if;
end $$;
