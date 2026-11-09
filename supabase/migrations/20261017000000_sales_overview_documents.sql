-- C1 upload provenance and API-only document workflows.

alter table if exists public.c1_customer
  add column if not exists source_type text not null default 'MASTER',
  add column if not exists source_document_id uuid references public.c1_document_uploads(id) on delete set null;

alter table if exists public.c1_company_sales_staging_rows
  add column if not exists c1_customer_id uuid references public.c1_customer(customer_id) on delete set null;

alter table if exists public.c1_outstanding_staging_rows
  add column if not exists c1_customer_id uuid references public.c1_customer(customer_id) on delete set null;

create index if not exists c1_customer_source_name_idx
  on public.c1_customer (source_type, lower(trim(customer_name)));

create index if not exists c1_customer_source_code_idx
  on public.c1_customer (source_type, lower(trim(customer_code)));

create index if not exists c1_customer_source_document_idx
  on public.c1_customer (source_document_id);

create index if not exists c1_company_sales_staging_document_row_idx
  on public.c1_company_sales_staging_rows (document_id, row_number);

create index if not exists c1_outstanding_staging_document_row_idx
  on public.c1_outstanding_staging_rows (document_id, row_number);

create index if not exists c1_uploads_recent_idx
  on public.c1_document_uploads (validation_status, uploaded_at desc, id);

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
  existing_id uuid;
  generated_code text;
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
    select c.customer_id
      into existing_id
      from public.c1_customer c
     where lower(trim(c.customer_name)) = lower(item.customer_name)
        or (item.customer_code is not null and lower(trim(c.customer_code)) = lower(item.customer_code))
     order by case when c.source_type = 'MASTER' then 0 else 1 end, c.created_at
     limit 1;

    if existing_id is null then
      generated_code := left(coalesce(item.customer_code, 'UPLOAD-' || substr(md5(p_document_id::text || ':' || lower(item.customer_name)), 1, 10)), 50);
      insert into public.c1_customer (customer_code, customer_name, branch, active_status, source_type, source_document_id)
      values (generated_code, item.customer_name, 'Tidak tersedia', true, 'UPLOAD', p_document_id)
      returning customer_id into existing_id;
    end if;

    result := result || jsonb_build_array(jsonb_build_object(
      'customer_name', item.customer_name,
      'customer_code', item.customer_code,
      'c1_customer_id', existing_id
    ));
  end loop;

  return jsonb_build_object('items', result);
end;
$function$;

revoke all on function public.c1_resolve_uploaded_customers(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.c1_resolve_uploaded_customers(uuid, jsonb) to service_role;

create or replace function public.reset_c1_sales_overview_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  deleted_documents integer;
  deleted_customers integer;
begin
  delete from public.c1_document_validation_errors;
  delete from public.c1_company_sales_staging_rows;
  delete from public.c1_outstanding_staging_rows;
  delete from public.c1_assignment;
  delete from public.c1_mid_feed;
  delete from public.c1_overdue_alert;
  delete from public.c1_macro_metric;
  delete from public.c1_customer where source_type = 'UPLOAD';
  get diagnostics deleted_customers = row_count;
  delete from public.c1_document_uploads;
  get diagnostics deleted_documents = row_count;

  return jsonb_build_object(
    'deleted_documents', deleted_documents,
    'deleted_uploaded_customers', deleted_customers
  );
end;
$function$;

revoke all on function public.reset_c1_sales_overview_data() from public, anon, authenticated;
grant execute on function public.reset_c1_sales_overview_data() to service_role;

notify pgrst, 'reload schema';
