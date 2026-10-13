create table if not exists public.c1_overdue_alert (
  alert_id uuid primary key default gen_random_uuid(),
  invoice_id text not null unique,
  customer_id uuid references public.a1_company_list(company_list_id),
  due_date date not null,
  evaluation_date date not null,
  days_overdue integer not null check (days_overdue >= 0),
  overdue_alert boolean not null,
  alert_status text not null default 'WATCHLIST',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists c1_overdue_alert_status_idx
  on public.c1_overdue_alert (overdue_alert, days_overdue desc);
create index if not exists c1_overdue_alert_due_date_idx
  on public.c1_overdue_alert (due_date);

create table if not exists public.c1_assignment (
  assignment_id uuid primary key default gen_random_uuid(),
  invoice_id text not null references public.c1_overdue_alert(invoice_id) on delete cascade,
  assigned_to text not null check (length(trim(assigned_to)) > 0),
  assigned_by uuid not null references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  follow_up_status text not null default 'ASSIGNED' check (follow_up_status in ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists c1_assignment_invoice_idx
  on public.c1_assignment (invoice_id, assigned_at desc);

create table if not exists public.c1_mid_feed (
  feed_id uuid primary key default gen_random_uuid(),
  feed_key text not null unique,
  invoice_id text not null references public.c1_overdue_alert(invoice_id) on delete cascade,
  customer_id uuid references public.a1_company_list(company_list_id),
  days_overdue integer not null check (days_overdue >= 0),
  alert_status text not null,
  assignment_summary jsonb not null default '{}'::jsonb,
  exported_at timestamptz not null default now()
);

create index if not exists c1_mid_feed_exported_idx
  on public.c1_mid_feed (exported_at desc);

alter table public.c1_overdue_alert enable row level security;
alter table public.c1_assignment enable row level security;
alter table public.c1_mid_feed enable row level security;

grant select on public.c1_overdue_alert, public.c1_assignment, public.c1_mid_feed to authenticated;

drop policy if exists "Users read overdue alerts" on public.c1_overdue_alert;
create policy "Users read overdue alerts" on public.c1_overdue_alert
  for select to authenticated using (exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('HR', 'MANAGER')));

drop policy if exists "Users read overdue assignments" on public.c1_assignment;
create policy "Users read overdue assignments" on public.c1_assignment
  for select to authenticated using (exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('HR', 'MANAGER')));

drop policy if exists "Users read overdue MID feed" on public.c1_mid_feed;
create policy "Users read overdue MID feed" on public.c1_mid_feed
  for select to authenticated using (exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('HR', 'MANAGER')));

create or replace function public.set_c1_overdue_alert_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists c1_overdue_alert_updated_at on public.c1_overdue_alert;
create trigger c1_overdue_alert_updated_at
before update on public.c1_overdue_alert
for each row execute function public.set_c1_overdue_alert_updated_at();
