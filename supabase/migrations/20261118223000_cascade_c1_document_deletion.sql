-- Migration: 20261118223000_cascade_c1_document_deletion.sql
-- 1. Add explicit sales cost columns to c1_company_sales_staging_rows
alter table if exists public.c1_company_sales_staging_rows
  add column if not exists sub_total numeric(18,2) default 0,
  add column if not exists vat numeric(18,2) default 0,
  add column if not exists pph_23 numeric(18,2) default 0,
  add column if not exists others numeric(18,2) default 0,
  add column if not exists dip_iata numeric(18,2) default 0;

-- Backfill explicit columns if any exist
update public.c1_company_sales_staging_rows
   set sub_total = coalesce(sub_total, trucking_cost, 0),
       vat = coalesce(vat, handling_cost, 0),
       pph_23 = coalesce(pph_23, storage_cost, 0),
       others = coalesce(others, other_operational_cost, 0)
 where sub_total is null or sub_total = 0;

-- 2. Update c1_delete_uploaded_document to cascade deletion to payment transactions, assignments, and unreferenced upload customers
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

  -- Pre-cleanup dependent B1 sales performance projection board rows if present
  if to_regclass('public.b1_salesperform_board') is not null then
    delete from public.b1_salesperform_board b
    where (b.sales_row_id in (select s.id from public.c1_company_sales_staging_rows s where s.document_id = target.id))
       or (b.outstanding_row_id in (select o.id from public.c1_outstanding_staging_rows o where o.document_id = target.id));
  end if;

  -- If OUTSTANDING_REPORT, pre-delete associated payment transactions & assignments
  if target.document_type = 'OUTSTANDING_REPORT' then
    -- Delete payment transactions for invoices belonging to this document that don't exist in other documents
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

    -- Delete assignments for invoices belonging to this document that don't exist in other documents
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

  -- Delete target document (cascades to staging rows)
  delete from public.c1_document_uploads where id = target.id;

  if target.document_type = 'OUTSTANDING_REPORT' then
    perform public.c1_refresh_overdue_alerts(current_date);
  end if;

  -- Clean up unreferenced upload customers
  delete from public.c1_customer c
  where c.source_type = 'UPLOAD'
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
    'document_type', target.document_type
  );
end;
$function$;

revoke all on function public.c1_delete_uploaded_document(uuid, uuid) from public, anon, authenticated;
grant execute on function public.c1_delete_uploaded_document(uuid, uuid) to service_role;

-- 3. Update public.c1_cleanup_unreferenced_upload_customers to allow cleanup without requiring a specific document id
create or replace function public.c1_cleanup_unreferenced_upload_customers(p_document_id uuid default null)
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
     and (p_document_id is null or c.source_document_id = p_document_id)
     and not exists (select 1 from public.c1_company_sales_staging_rows r where r.c1_customer_id = c.customer_id)
     and not exists (select 1 from public.c1_outstanding_staging_rows r where r.c1_customer_id = c.customer_id)
     and not exists (select 1 from public.c1_overdue_alert a where a.c1_customer_id = c.customer_id)
     and not exists (select 1 from public.c1_payment_transactions p where p.customer_id = c.customer_id);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

revoke all on function public.c1_cleanup_unreferenced_upload_customers(uuid) from public, anon, authenticated;
grant execute on function public.c1_cleanup_unreferenced_upload_customers(uuid) to service_role;

