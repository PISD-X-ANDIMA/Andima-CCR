-- Migration: Exclude completed and settled invoices from overdue alerts
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
      )
      or exists (
        select 1 from public.c1_assignment asg
         where lower(trim(asg.invoice_id)) = lower(trim(a.invoice_id))
           and asg.follow_up_status = 'COMPLETED'
      )
      or exists (
        select 1 from public.c1_payment_transactions p
         where lower(trim(p.invoice_number)) = lower(trim(a.invoice_id))
         group by lower(trim(p.invoice_number))
         having sum(p.amount) >= coalesce((
           select l.outstanding_amount from latest l where lower(trim(l.invoice_number)) = lower(trim(a.invoice_id))
         ), 0)
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
    order by lower(trim(r.invoice_number)),
             case when r.c1_customer_id is not null or r.customer_id is not null then 0 else 1 end,
             r.created_at desc, r.id desc
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
      and not exists (
        select 1 from public.c1_assignment asg
         where lower(trim(asg.invoice_id)) = lower(trim(l.invoice_number))
           and asg.follow_up_status = 'COMPLETED'
      )
      and not exists (
        select 1 from public.c1_payment_transactions p
         where lower(trim(p.invoice_number)) = lower(trim(l.invoice_number))
         group by lower(trim(p.invoice_number))
         having sum(p.amount) >= l.outstanding_amount
      )
  )
  insert into public.c1_overdue_alert (
    invoice_id, customer_id, c1_customer_id, due_date, evaluation_date,
    days_overdue, overdue_alert, alert_status
  )
  select
    coalesce(existing.invoice_id, c.invoice_number),
    coalesce(c.customer_id, existing.customer_id),
    coalesce(c.c1_customer_id, existing.c1_customer_id),
    c.due_date,
    p_evaluation_date,
    c.days_overdue,
    c.days_overdue > 30,
    case
      when c.days_overdue > 60 then 'High Risk'
      when c.days_overdue > 30 then 'Medium Risk'
      else 'Watchlist'
    end
  from current_rows c
  left join public.c1_overdue_alert existing
    on lower(trim(existing.invoice_id)) = lower(trim(c.invoice_number))
  on conflict (invoice_id) do update set
    customer_id = coalesce(excluded.customer_id, public.c1_overdue_alert.customer_id),
    c1_customer_id = coalesce(excluded.c1_customer_id, public.c1_overdue_alert.c1_customer_id),
    due_date = excluded.due_date,
    evaluation_date = excluded.evaluation_date,
    days_overdue = excluded.days_overdue,
    overdue_alert = excluded.overdue_alert,
    alert_status = excluded.alert_status;

  get diagnostics evaluated_count = row_count;
  select count(*) into overdue_count from public.c1_overdue_alert where overdue_alert = true;

  return jsonb_build_object(
    'evaluated', evaluated_count,
    'overdue', overdue_count,
    'deleted', deleted_count,
    'evaluationDate', p_evaluation_date
  );
end;
$function$;

revoke all on function public.c1_refresh_overdue_alerts(date) from public, anon, authenticated;
grant execute on function public.c1_refresh_overdue_alerts(date) to service_role;

