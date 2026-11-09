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
    if item.customer_code is not null then
      select c.customer_id, c.customer_name, c.customer_code
        into resolved_id, resolved_name, resolved_code
        from public.c1_customer c
       where lower(trim(c.customer_code)) = lower(item.customer_code)
       order by case when c.source_type = 'MASTER' then 0 else 1 end, c.created_at nulls last, c.customer_id
       limit 1;
    end if;

    if resolved_id is null then
      select c.customer_id, c.customer_name, c.customer_code
        into resolved_id, resolved_name, resolved_code
        from public.c1_customer c
       where lower(trim(c.customer_name)) = lower(item.customer_name)
       order by case when c.source_type = 'MASTER' then 0 else 1 end, c.created_at nulls last, c.customer_id
       limit 1;
    end if;

    if resolved_id is null then
      generated_code := left(coalesce(item.customer_code, 'UPLOAD-' || substr(md5(p_document_id::text || ':' || lower(item.customer_name)), 1, 10)), 50);
      insert into public.c1_customer (customer_code, customer_name, branch, active_status, source_type, source_document_id)
      values (generated_code, item.customer_name, 'Tidak tersedia', true, 'UPLOAD', p_document_id)
      returning customer_id, customer_name, customer_code into resolved_id, resolved_name, resolved_code;
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
     and not exists (select 1 from public.c1_customer_monthly_metrics m where m.customer_id = c.customer_id);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

revoke all on function public.c1_resolve_uploaded_customers(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.c1_cleanup_unreferenced_upload_customers(uuid) from public, anon, authenticated;
grant execute on function public.c1_resolve_uploaded_customers(uuid, jsonb) to service_role;
grant execute on function public.c1_cleanup_unreferenced_upload_customers(uuid) to service_role;
