-- Keep the overdue projection synchronized with the latest validated upload.

alter table if exists public.c1_overdue_alert
  add column if not exists c1_customer_id uuid references public.c1_customer(customer_id) on delete set null;

create index if not exists c1_overdue_alert_c1_customer_idx
  on public.c1_overdue_alert (c1_customer_id);

create or replace function public.c1_refresh_overdue_alerts(p_evaluation_date date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  evaluated_count integer;
  overdue_count integer;
  deleted_count integer;
begin
  perform pg_advisory_xact_lock(610060003);

  with latest as (
    select distinct on (lower(trim(r.invoice_number)))
      r.invoice_number,
      r.outstanding_amount
    from public.c1_outstanding_staging_rows r
    join public.c1_document_uploads d on d.id = r.document_id
    where d.validation_status = 'validated'
    order by lower(trim(r.invoice_number)), r.created_at desc, r.id desc
  )
  delete from public.c1_overdue_alert a
   where not exists (
     select 1 from latest l
      where lower(trim(l.invoice_number)) = lower(trim(a.invoice_id))
   )
      or exists (
        select 1 from latest l
         where lower(trim(l.invoice_number)) = lower(trim(a.invoice_id))
           and l.outstanding_amount <= 0
      );
  get diagnostics deleted_count = row_count;

  with latest as (
    select distinct on (lower(trim(r.invoice_number)))
      r.invoice_number,
      r.customer_id,
      r.c1_customer_id,
      r.due_date,
      r.outstanding_amount
    from public.c1_outstanding_staging_rows r
    join public.c1_document_uploads d on d.id = r.document_id
    where d.validation_status = 'validated'
    order by lower(trim(r.invoice_number)), r.created_at desc, r.id desc
  ), current_rows as (
    select
      l.invoice_number,
      l.customer_id,
      l.c1_customer_id,
      l.due_date,
      greatest(0, p_evaluation_date - l.due_date)::integer as days_overdue,
      l.outstanding_amount
    from latest l
    where l.outstanding_amount > 0
  )
  insert into public.c1_overdue_alert (
    invoice_id, customer_id, c1_customer_id, due_date, evaluation_date,
    days_overdue, overdue_alert, alert_status
  )
  select
    coalesce(existing.invoice_id, c.invoice_number),
    c.customer_id,
    c.c1_customer_id,
    c.due_date,
    p_evaluation_date,
    c.days_overdue,
    c.days_overdue > 30,
    case
      when c.days_overdue > 60 then 'LEGAL ESCALATION'
      when c.days_overdue > 30 then 'HIGH RISK'
      else 'WATCHLIST'
    end
  from current_rows c
  left join public.c1_overdue_alert existing
    on lower(trim(existing.invoice_id)) = lower(trim(c.invoice_number))
  on conflict (invoice_id) do update set
    customer_id = excluded.customer_id,
    c1_customer_id = excluded.c1_customer_id,
    due_date = excluded.due_date,
    evaluation_date = excluded.evaluation_date,
    days_overdue = excluded.days_overdue,
    overdue_alert = excluded.overdue_alert,
    alert_status = excluded.alert_status,
    updated_at = now();

  select count(*)::integer, count(*) filter (where days_overdue > 30)::integer
    into evaluated_count, overdue_count
    from (
      select distinct on (lower(trim(r.invoice_number)))
        greatest(0, p_evaluation_date - r.due_date)::integer as days_overdue
      from public.c1_outstanding_staging_rows r
      join public.c1_document_uploads d on d.id = r.document_id
      where d.validation_status = 'validated' and r.outstanding_amount > 0
      order by lower(trim(r.invoice_number)), r.created_at desc, r.id desc
    ) current_rows;

  return jsonb_build_object(
    'evaluated', coalesce(evaluated_count, 0),
    'overdue', coalesce(overdue_count, 0),
    'deleted', coalesce(deleted_count, 0),
    'evaluationDate', p_evaluation_date
  );
end;
$function$;

revoke all on function public.c1_refresh_overdue_alerts(date) from public, anon, authenticated;
grant execute on function public.c1_refresh_overdue_alerts(date) to service_role;

notify pgrst, 'reload schema';
