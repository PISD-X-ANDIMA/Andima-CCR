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

revoke all on function public.c1_delete_uploaded_document(uuid, uuid) from public, anon, authenticated;
grant execute on function public.c1_delete_uploaded_document(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
