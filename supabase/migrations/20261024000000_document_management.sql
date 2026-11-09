create table if not exists public.c1_document_deletion_audit (
  audit_id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  file_name text not null,
  document_type text not null,
  validation_status text not null,
  uploader_user_id uuid,
  deleted_by uuid not null,
  deleted_at timestamptz not null default now(),
  storage_bucket text not null,
  storage_path text not null,
  storage_cleanup_status text not null default 'pending'
    check (storage_cleanup_status in ('pending', 'complete')),
  storage_cleanup_error text
);

create index if not exists c1_document_deletion_audit_pending_idx
  on public.c1_document_deletion_audit (deleted_at desc)
  where storage_cleanup_status = 'pending';

alter table public.c1_document_deletion_audit enable row level security;
revoke all on public.c1_document_deletion_audit from public, anon, authenticated;
grant select, insert, update on public.c1_document_deletion_audit to service_role;

create or replace function public.c1_list_managed_documents(
  p_search text default null,
  p_document_type text default null,
  p_file_type text default null,
  p_page integer default 1,
  p_page_size integer default 10
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
with documents as (
  select
    d.id,
    d.file_name,
    d.document_type,
    d.mime_type,
    d.file_size_bytes,
    d.storage_bucket,
    d.uploaded_at,
    d.processed_at,
    d.validation_status,
    d.row_count,
    d.valid_row_count,
    d.invalid_row_count,
    d.error_summary,
    d.uploader_user_id,
    lower(substring(d.file_name from '\.([^.]+)$')) as file_type,
    coalesce(nullif(trim(profile.full_name), ''), nullif(trim(profile.email), ''), d.uploader_user_id::text) as uploader_name,
    coalesce(profile.email, '') as uploader_email
  from public.c1_document_uploads d
  left join lateral (
    select b.full_name, b.email
    from public.b2_register b
    where b.auth_user_id = d.uploader_user_id or b.id = d.uploader_user_id
    order by (b.auth_user_id = d.uploader_user_id) desc nulls last
    limit 1
  ) profile on true
), type_scope as (
  select * from documents d
  where p_document_type is null or p_document_type = '' or p_document_type = 'all'
     or d.document_type = p_document_type
), filtered as (
  select * from type_scope d
  where (p_file_type is null or p_file_type = '' or p_file_type = 'all' or d.file_type = lower(p_file_type))
    and (p_search is null or p_search = ''
      or position(lower(p_search) in lower(d.file_name)) > 0
      or position(lower(p_search) in lower(d.uploader_name)) > 0
      or position(lower(p_search) in lower(d.uploader_email)) > 0)
), page_rows as (
  select * from filtered
  order by uploaded_at desc, id desc
  limit greatest(1, least(coalesce(p_page_size, 10), 50))
  offset (greatest(coalesce(p_page, 1), 1) - 1) * greatest(1, least(coalesce(p_page_size, 10), 50))
)
select jsonb_build_object(
  'data', coalesce((select jsonb_agg(to_jsonb(d) order by d.uploaded_at desc, d.id desc) from page_rows d), '[]'::jsonb),
  'pagination', jsonb_build_object(
    'page', greatest(coalesce(p_page, 1), 1),
    'page_size', greatest(1, least(coalesce(p_page_size, 10), 50)),
    'total_items', (select count(*) from filtered),
    'total_pages', greatest(1, ceil((select count(*)::numeric from filtered) / greatest(1, least(coalesce(p_page_size, 10), 50)))::integer)
  ),
  'summary', jsonb_build_object(
    'total', (select count(*) from type_scope),
    'validated', (select count(*) from type_scope where validation_status = 'validated'),
    'rejected', (select count(*) from type_scope where validation_status = 'rejected')
  )
);
$function$;

revoke all on function public.c1_list_managed_documents(text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.c1_list_managed_documents(text, text, text, integer, integer) to service_role;

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

  delete from public.c1_document_uploads where id = target.id;

  if target.document_type = 'OUTSTANDING_REPORT' then
    perform public.c1_refresh_overdue_alerts(current_date);
  end if;

  if to_regclass('public.c1_customer_monthly_metrics') is not null and to_regclass('public.c1_customer') is not null then
    delete from public.c1_customer c
    where c.customer_id = any(customer_ids)
      and not exists (select 1 from public.c1_company_sales_staging_rows r where r.c1_customer_id = c.customer_id)
      and not exists (select 1 from public.c1_outstanding_staging_rows r where r.c1_customer_id = c.customer_id)
      and not exists (select 1 from public.c1_overdue_alert a where a.c1_customer_id = c.customer_id)
      and not exists (select 1 from public.c1_payment_transactions p where p.customer_id = c.customer_id)
      and not exists (select 1 from public.c1_invoice_detail i where i.customer_id = c.customer_id)
      and not exists (select 1 from public.c1_customer_monthly_metrics m where m.customer_id = c.customer_id);
  else
    delete from public.c1_customer c
    where c.customer_id = any(customer_ids)
      and not exists (select 1 from public.c1_company_sales_staging_rows r where r.c1_customer_id = c.customer_id)
      and not exists (select 1 from public.c1_outstanding_staging_rows r where r.c1_customer_id = c.customer_id)
      and not exists (select 1 from public.c1_overdue_alert a where a.c1_customer_id = c.customer_id)
      and not exists (select 1 from public.c1_payment_transactions p where p.customer_id = c.customer_id)
      and not exists (select 1 from public.c1_invoice_detail i where i.customer_id = c.customer_id);
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
  perform public.refresh_c1_macro_metrics();

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

revoke all on function public.c1_delete_uploaded_document(uuid, uuid) from public, anon, authenticated;
grant execute on function public.c1_delete_uploaded_document(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
