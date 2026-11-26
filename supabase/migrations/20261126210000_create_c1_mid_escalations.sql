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

-- 3. RLS and Grants (conditionally applied if roles exist)
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

-- 4. Initial backfill from existing overdue alerts
select public.c1_sync_overdue_to_mid_escalations();
