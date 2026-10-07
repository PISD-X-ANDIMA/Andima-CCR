create table if not exists public.c1_macro_metric (
  id uuid primary key default gen_random_uuid(),
  period_month date not null,
  revenue numeric(18, 2) not null default 0,
  cost numeric(18, 2) not null default 0,
  sales_profit numeric(18, 2) generated always as (revenue - cost) stored,
  total_outstanding numeric(18, 2) not null default 0,
  validation_status text not null default 'pending',
  source_document text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint c1_macro_metric_period_month_key unique (period_month),
  constraint c1_macro_metric_validation_status_check check (validation_status in ('pending', 'validated', 'rejected')),
  constraint c1_macro_metric_nonnegative_values_check check (revenue >= 0 and cost >= 0 and total_outstanding >= 0)
);

create index if not exists c1_macro_metric_period_month_idx on public.c1_macro_metric (period_month);
create index if not exists c1_macro_metric_validation_status_idx on public.c1_macro_metric (validation_status);

alter table public.c1_macro_metric enable row level security;

grant usage on schema public to authenticated;
grant select on table public.c1_macro_metric to authenticated;

drop policy if exists "Management can read validated macro metrics" on public.c1_macro_metric;
create policy "Management can read validated macro metrics"
on public.c1_macro_metric
for select
to authenticated
using (
  validation_status = 'validated'
  and exists (
    select 1
    from public.d3_user_access access
    where access.auth_user_id = auth.uid()
      and access.app_role::text in ('HR', 'MANAGER')
  )
);

notify pgrst, 'reload schema';
