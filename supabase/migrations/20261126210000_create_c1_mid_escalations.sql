-- Migration: Create dedicated c1_mid_escalations table for MID escalation tracking
-- Provides exact 7 columns required by MID: pic, judul_issue, deskripsi_issue, date, priority, status, due_date

-- 1. Create table
create table if not exists public.c1_mid_escalations (
  id uuid primary key default gen_random_uuid(),
  invoice_id text not null unique,
  pic text not null default 'Unassigned',
  judul_issue text not null,
  deskripsi_issue text,
  date timestamptz not null default now(),
  priority text not null default 'Medium',
  status text not null default 'pending',
  due_date date,
  customer_name text,
  c1_customer_id uuid,
  outstanding_amount numeric(18,2) default 0,
  days_overdue integer default 0,
  follow_up_action text,
  promise_date date,
  last_notes text,
  assignment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint c1_mid_escalations_status_check check (status in ('pending', 'in_progress', 'in_review', 'done')),
  constraint c1_mid_escalations_priority_check check (priority in ('High', 'Medium', 'Low'))
);

create index if not exists c1_mid_escalations_status_idx on public.c1_mid_escalations (status);
create index if not exists c1_mid_escalations_priority_idx on public.c1_mid_escalations (priority);
create index if not exists c1_mid_escalations_date_idx on public.c1_mid_escalations (date desc);
create index if not exists c1_mid_escalations_customer_idx on public.c1_mid_escalations (c1_customer_id);

-- 2. Synchronization function for Overdue Invoices -> MID Escalation
create or replace function public.c1_sync_overdue_to_mid_escalations()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  synced_count integer := 0;
begin
  -- Upsert overdue items that are > 30 days overdue or flagged as overdue alerts
  with overdue_source as (
    select distinct on (lower(trim(a.invoice_id)))
      a.invoice_id,
      a.customer_id,
      a.c1_customer_id,
      a.due_date,
      a.days_overdue,
      a.alert_status,
      coalesce(c.company_name, r.customer_name, 'Pelanggan Tidak Diketahui') as customer_name,
      coalesce(r.outstanding_amount, 0) as outstanding_amount
    from public.c1_overdue_alert a
    left join (
      select distinct on (lower(trim(invoice_number)))
        invoice_number, customer_name, outstanding_amount
      from public.c1_outstanding_staging_rows
      order by lower(trim(invoice_number)), created_at desc, id desc
    ) r on lower(trim(r.invoice_number)) = lower(trim(a.invoice_id))
    left join public.a1_customers c on c.id = a.c1_customer_id
    where a.days_overdue > 0
    order by lower(trim(a.invoice_id)), a.updated_at desc
  )
  insert into public.c1_mid_escalations (
    invoice_id,
    pic,
    judul_issue,
    deskripsi_issue,
    date,
    priority,
    status,
    due_date,
    customer_name,
    c1_customer_id,
    outstanding_amount,
    days_overdue,
    updated_at
  )
  select
    s.invoice_id,
    'Unassigned',
    'Overdue Invoice ' || s.invoice_id || ' - ' || s.customer_name,
    'Invoice ' || s.invoice_id || ' telah jatuh tempo ' || s.days_overdue || ' hari lalu (Jatuh tempo: ' || to_char(s.due_date, 'YYYY-MM-DD') || '). Belum ada tindak lanjut follow up.',
    now(),
    case
      when s.days_overdue > 60 then 'High'
      when s.days_overdue > 30 then 'Medium'
      else 'Low'
    end,
    'pending',
    s.due_date,
    s.customer_name,
    s.c1_customer_id,
    s.outstanding_amount,
    s.days_overdue,
    now()
  from overdue_source s
  on conflict (invoice_id) do update set
    customer_name = excluded.customer_name,
    c1_customer_id = coalesce(excluded.c1_customer_id, c1_mid_escalations.c1_customer_id),
    outstanding_amount = excluded.outstanding_amount,
    days_overdue = excluded.days_overdue,
    priority = case
      when c1_mid_escalations.status = 'done' then c1_mid_escalations.priority
      else excluded.priority
    end,
    updated_at = now();

  get diagnostics synced_count = row_count;
  return synced_count;
end;
$function$;

-- 3. Synchronization function for Staff Follow-Up Logs (c1_assignment) -> MID Escalation
create or replace function public.c1_sync_assignment_to_mid_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_invoice_id text;
  cust_name text;
  target_cust_id uuid;
  target_amount numeric(18,2) := 0;
  target_days integer := 0;
  target_due_date date;
  calc_status text;
  calc_priority text;
  formatted_desc text;
  staff_pic text;
  active_asg record;
begin
  if tg_op = 'DELETE' then
    target_invoice_id := old.invoice_id;
  else
    target_invoice_id := new.invoice_id;
  end if;

  if target_invoice_id is null or trim(target_invoice_id) = '' then
    return null;
  end if;

  -- Find the latest active assignment for this invoice
  select *
    into active_asg
    from public.c1_assignment
   where lower(trim(invoice_id)) = lower(trim(target_invoice_id))
   order by assigned_at desc, created_at desc
   limit 1;

  -- Resolve invoice metadata
  select
    coalesce(c.company_name, r.customer_name, 'Pelanggan Tidak Diketahui'),
    coalesce(r.c1_customer_id, a.c1_customer_id),
    coalesce(r.outstanding_amount, 0),
    coalesce(a.days_overdue, greatest(0, current_date - r.due_date), 0),
    coalesce(r.due_date, a.due_date)
  into cust_name, target_cust_id, target_amount, target_days, target_due_date
  from (select target_invoice_id as inv) x
  left join (
    select distinct on (lower(trim(invoice_number)))
      invoice_number, customer_name, c1_customer_id, outstanding_amount, due_date
    from public.c1_outstanding_staging_rows
    order by lower(trim(invoice_number)), created_at desc, id desc
  ) r on lower(trim(r.invoice_number)) = lower(trim(x.inv))
  left join public.c1_overdue_alert a on lower(trim(a.invoice_id)) = lower(trim(x.inv))
  left join public.a1_customers c on c.id = coalesce(r.c1_customer_id, a.c1_customer_id);

  if active_asg.assignment_id is not null then
    -- Determine MID status from CCR follow up status
    if active_asg.follow_up_status = 'COMPLETED' then
      calc_status := 'done';
      calc_priority := 'Low';
    elsif active_asg.follow_up_status in ('IN_REVIEW', 'REVIEW', 'WAITING_APPROVAL') then
      calc_status := 'in_review';
      calc_priority := case when target_days > 60 then 'High' when target_days > 30 then 'Medium' else 'Low' end;
    else
      calc_status := 'in_progress';
      calc_priority := case when target_days > 60 then 'High' when target_days > 30 then 'Medium' else 'Low' end;
    end if;

    formatted_desc := coalesce('[' || active_asg.follow_up_action || '] ', '') || coalesce(active_asg.notes, 'Follow up tercatat.');

    -- Resolve the staff author who added the log
    staff_pic := active_asg.assigned_to;
    if to_regclass('public.b2_register') is not null and active_asg.assigned_by is not null then
      execute 'select full_name from public.b2_register where auth_user_id = $1 limit 1'
        into staff_pic using active_asg.assigned_by;
      staff_pic := coalesce(staff_pic, active_asg.assigned_to);
    end if;
    staff_pic := coalesce(staff_pic, 'Unassigned');

    insert into public.c1_mid_escalations (
      invoice_id,
      pic,
      judul_issue,
      deskripsi_issue,
      date,
      priority,
      status,
      due_date,
      customer_name,
      c1_customer_id,
      outstanding_amount,
      days_overdue,
      follow_up_action,
      promise_date,
      last_notes,
      assignment_id,
      updated_at
    ) values (
      target_invoice_id,
      staff_pic,
      'Follow-Up: Overdue Invoice ' || target_invoice_id || coalesce(' - ' || cust_name, ''),
      formatted_desc,
      coalesce(active_asg.assigned_at, now()),
      calc_priority,
      calc_status,
      coalesce(active_asg.promise_date, target_due_date),
      cust_name,
      target_cust_id,
      target_amount,
      target_days,
      active_asg.follow_up_action,
      active_asg.promise_date,
      active_asg.notes,
      active_asg.assignment_id,
      now()
    )
    on conflict (invoice_id) do update set
      pic = excluded.pic,
      judul_issue = excluded.judul_issue,
      deskripsi_issue = excluded.deskripsi_issue,
      date = excluded.date,
      priority = excluded.priority,
      status = excluded.status,
      due_date = coalesce(excluded.due_date, c1_mid_escalations.due_date),
      customer_name = coalesce(excluded.customer_name, c1_mid_escalations.customer_name),
      c1_customer_id = coalesce(excluded.c1_customer_id, c1_mid_escalations.c1_customer_id),
      outstanding_amount = coalesce(excluded.outstanding_amount, c1_mid_escalations.outstanding_amount),
      days_overdue = coalesce(excluded.days_overdue, c1_mid_escalations.days_overdue),
      follow_up_action = excluded.follow_up_action,
      promise_date = excluded.promise_date,
      last_notes = excluded.last_notes,
      assignment_id = excluded.assignment_id,
      updated_at = now();
  else
    -- No assignments remain: reset to pending
    update public.c1_mid_escalations
       set pic = 'Unassigned',
           status = 'pending',
           deskripsi_issue = 'Belum ada log tindak lanjut follow up.',
           follow_up_action = null,
           promise_date = null,
           last_notes = null,
           assignment_id = null,
           due_date = target_due_date,
           updated_at = now()
     where lower(trim(invoice_id)) = lower(trim(target_invoice_id));
  end if;

  return null;
end;
$function$;

-- 4. Create trigger on c1_assignment
drop trigger if exists trg_c1_assignment_sync_mid_escalation on public.c1_assignment;
create trigger trg_c1_assignment_sync_mid_escalation
after insert or update or delete on public.c1_assignment
for each row execute function public.c1_sync_assignment_to_mid_escalation();

-- 5. RLS and Grants (conditionally applied if roles exist)
alter table public.c1_mid_escalations enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on public.c1_mid_escalations to authenticated';
    execute 'drop policy if exists "CCR users read MID escalations" on public.c1_mid_escalations';
    execute 'create policy "CCR users read MID escalations" on public.c1_mid_escalations for select to authenticated using (true)';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant all on public.c1_mid_escalations to service_role';
  end if;
end;
$$;

-- 6. Initial backfill from existing overdue alerts and assignments
select public.c1_sync_overdue_to_mid_escalations();
