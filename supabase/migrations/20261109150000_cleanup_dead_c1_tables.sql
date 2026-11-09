-- Migration: Cleaning up dead/unused C1 tables and decoupling dependent functions
-- Dead tables dropped:
-- 1. c1_mid_feed (legacy MID escalation feeds, 0 rows)
-- 2. c1_customer_monthly_metrics (legacy pre-aggregates superseded by dynamic analytics RPC, 0 rows)
-- 3. c1_invoice_detail (legacy invoice tracking superseded by staging and payment transactions, 0 rows)
-- 4. c1_export_file (legacy export tracking superseded by client-side streaming exports, 1 stale test row)
-- 5. c1_export_request (legacy export request queue superseded by client-side streaming exports, 1 stale test row)

-- 1. Update reset_c1_sales_overview_data() to decouple from c1_mid_feed
create or replace function public.reset_c1_sales_overview_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  deleted_documents integer;
  deleted_customers integer;
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
  delete from public.c1_customer where source_type = 'UPLOAD';
  get diagnostics deleted_customers = row_count;
  delete from public.c1_document_uploads;
  get diagnostics deleted_documents = row_count;

  return jsonb_build_object(
    'deleted_documents', deleted_documents,
    'deleted_uploaded_customers', deleted_customers,
    'deleted_board_rows', deleted_board_rows
  );
end;
$function$;

-- 2. Update c1_cleanup_unreferenced_upload_customers() to decouple from c1_customer_monthly_metrics
create or replace function public.c1_cleanup_unreferenced_upload_customers(p_document_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  deleted_count integer;
begin
  delete from public.c1_customer c
   where c.source_type = 'UPLOAD'
     and c.source_document_id = p_document_id
     and not exists (select 1 from public.c1_company_sales_staging_rows r where r.c1_customer_id = c.customer_id)
     and not exists (select 1 from public.c1_outstanding_staging_rows r where r.c1_customer_id = c.customer_id)
     and not exists (select 1 from public.c1_overdue_alert a where a.c1_customer_id = c.customer_id)
     and not exists (select 1 from public.c1_payment_transactions p where p.customer_id = c.customer_id);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

-- 3. Update c1_delete_uploaded_document() to decouple from c1_customer_monthly_metrics and c1_invoice_detail
create or replace function public.c1_delete_uploaded_document(
  p_document_id uuid,
  p_deleted_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  target public.c1_document_uploads%rowtype;
  audit_key uuid;
  customer_ids uuid[];
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

  select coalesce(array_agg(c.customer_id), '{}'::uuid[])
    into customer_ids
  from public.c1_customer c
  where c.source_type = 'UPLOAD'
    and c.source_document_id = target.id;

  insert into public.c1_document_deletion_audit (
    document_id, file_name, document_type, validation_status,
    uploader_user_id, deleted_by, storage_bucket, storage_path
  ) values (
    target.id, target.file_name, target.document_type, target.validation_status,
    target.uploader_user_id, p_deleted_by, target.storage_bucket, target.storage_path
  ) returning audit_id into audit_key;

  -- Pre-cleanup dependent B1 sales performance projection board rows if present
  if to_regclass('public.b1_salesperform_board') is not null then
    delete from public.b1_salesperform_board b
    where (b.sales_row_id in (select s.id from public.c1_company_sales_staging_rows s where s.document_id = target.id))
       or (b.outstanding_row_id in (select o.id from public.c1_outstanding_staging_rows o where o.document_id = target.id));
  end if;

  -- Delete target document (cascades to staging rows)
  delete from public.c1_document_uploads where id = target.id;

  if target.document_type = 'OUTSTANDING_REPORT' then
    perform public.c1_refresh_overdue_alerts(current_date);
  end if;

  -- Clean up unreferenced upload customers
  delete from public.c1_customer c
  where c.customer_id = any(customer_ids)
    and not exists (select 1 from public.c1_company_sales_staging_rows r where r.c1_customer_id = c.customer_id)
    and not exists (select 1 from public.c1_outstanding_staging_rows r where r.c1_customer_id = c.customer_id)
    and not exists (select 1 from public.c1_overdue_alert a where a.c1_customer_id = c.customer_id)
    and not exists (select 1 from public.c1_payment_transactions p where p.customer_id = c.customer_id);

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

-- 4. Drop the 5 dead tables safely with CASCADE
drop table if exists public.c1_mid_feed cascade;
drop table if exists public.c1_customer_monthly_metrics cascade;
drop table if exists public.c1_invoice_detail cascade;
drop table if exists public.c1_export_file cascade;
drop table if exists public.c1_export_request cascade;

-- 5. Reload schema cache for PostgREST
notify pgrst, 'reload schema';

