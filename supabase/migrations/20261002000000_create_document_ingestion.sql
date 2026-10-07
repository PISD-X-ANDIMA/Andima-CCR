create table if not exists public.c1_document_uploads (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  document_type text not null check (document_type in ('COMPANY_SALES_REPORT', 'OUTSTANDING_REPORT')),
  storage_bucket text not null default 'c1-document-uploads',
  storage_path text not null unique,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes between 1 and 5242880),
  checksum text,
  uploader_user_id uuid not null references auth.users(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  processing_started_at timestamptz,
  processed_at timestamptz,
  validation_status text not null default 'uploaded' check (validation_status in ('uploaded', 'processing', 'validated', 'rejected')),
  row_count integer not null default 0,
  valid_row_count integer not null default 0,
  invalid_row_count integer not null default 0,
  error_summary text
);

create table if not exists public.c1_document_validation_errors (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.c1_document_uploads(id) on delete cascade,
  row_number integer,
  field_name text not null,
  error_code text not null,
  error_message text not null,
  raw_value text,
  created_at timestamptz not null default now()
);

create table if not exists public.c1_company_sales_staging_rows (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.c1_document_uploads(id) on delete cascade,
  row_number integer not null,
  period_month date not null,
  customer_name text not null,
  customer_id uuid references public.a1_company_list(company_list_id),
  revenue numeric(18,2) not null check (revenue >= 0),
  trucking_cost numeric(18,2) not null default 0 check (trucking_cost >= 0),
  handling_cost numeric(18,2) not null default 0 check (handling_cost >= 0),
  storage_cost numeric(18,2) not null default 0 check (storage_cost >= 0),
  other_operational_cost numeric(18,2) not null default 0 check (other_operational_cost >= 0),
  total_cost numeric(18,2) generated always as (trucking_cost + handling_cost + storage_cost + other_operational_cost) stored,
  created_at timestamptz not null default now(),
  unique (document_id, row_number)
);

create table if not exists public.c1_outstanding_staging_rows (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.c1_document_uploads(id) on delete cascade,
  row_number integer not null,
  create_date date,
  invoice_number text not null,
  customer_name text not null,
  customer_id uuid references public.a1_company_list(company_list_id),
  job_number text,
  mawb text,
  outstanding_amount numeric(18,2) not null check (outstanding_amount >= 0),
  due_date date not null,
  created_at timestamptz not null default now(),
  unique (document_id, row_number)
);

alter table public.c1_document_uploads enable row level security;
alter table public.c1_document_validation_errors enable row level security;
alter table public.c1_company_sales_staging_rows enable row level security;
alter table public.c1_outstanding_staging_rows enable row level security;

grant select on public.c1_document_uploads, public.c1_document_validation_errors, public.c1_company_sales_staging_rows, public.c1_outstanding_staging_rows to authenticated;

create policy "Users read own document uploads" on public.c1_document_uploads for select to authenticated using (uploader_user_id = auth.uid() or exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('HR', 'MANAGER')));
create policy "Users create own document uploads" on public.c1_document_uploads for insert to authenticated with check (uploader_user_id = auth.uid());
create policy "Users update own document uploads" on public.c1_document_uploads for update to authenticated using (uploader_user_id = auth.uid()) with check (uploader_user_id = auth.uid());
create policy "Users read own document errors" on public.c1_document_validation_errors for select to authenticated using (exists (select 1 from public.c1_document_uploads d where d.id = document_id and (d.uploader_user_id = auth.uid() or exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('HR', 'MANAGER')))));
create policy "Users create own document errors" on public.c1_document_validation_errors for insert to authenticated with check (exists (select 1 from public.c1_document_uploads d where d.id = document_id and d.uploader_user_id = auth.uid()));
create policy "Users read permitted sales staging" on public.c1_company_sales_staging_rows for select to authenticated using (exists (select 1 from public.c1_document_uploads d where d.id = document_id and (d.uploader_user_id = auth.uid() or exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('HR', 'MANAGER')))));
create policy "Users create own sales staging" on public.c1_company_sales_staging_rows for insert to authenticated with check (exists (select 1 from public.c1_document_uploads d where d.id = document_id and d.uploader_user_id = auth.uid()));
create policy "Users read permitted outstanding staging" on public.c1_outstanding_staging_rows for select to authenticated using (exists (select 1 from public.c1_document_uploads d where d.id = document_id and (d.uploader_user_id = auth.uid() or exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('HR', 'MANAGER')))));
create policy "Users create own outstanding staging" on public.c1_outstanding_staging_rows for insert to authenticated with check (exists (select 1 from public.c1_document_uploads d where d.id = document_id and d.uploader_user_id = auth.uid()));

insert into storage.buckets (id, name, public) values ('c1-document-uploads', 'c1-document-uploads', false) on conflict (id) do nothing;
create policy "Users read own c1 documents" on storage.objects for select to authenticated using (bucket_id = 'c1-document-uploads' and ((storage.foldername(name))[1] = auth.uid()::text or exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('HR', 'MANAGER'))));
create policy "Users upload own c1 documents" on storage.objects for insert to authenticated with check (bucket_id = 'c1-document-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.refresh_c1_macro_metrics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.c1_macro_metric (period_month, revenue, cost, total_outstanding, validation_status)
  select coalesce(s.period_month, o.period_month)::date,
         coalesce(s.revenue, 0),
         coalesce(s.cost, 0),
         coalesce(o.outstanding, 0),
         'validated'
  from (
    select period_month, sum(revenue)::numeric as revenue, sum(total_cost)::numeric as cost
    from public.c1_company_sales_staging_rows r
    join public.c1_document_uploads d on d.id = r.document_id and d.validation_status = 'validated'
    group by period_month
  ) s
  full join (
    select date_trunc('month', due_date)::date as period_month, sum(outstanding_amount)::numeric as outstanding
    from public.c1_outstanding_staging_rows r
    join public.c1_document_uploads d on d.id = r.document_id and d.validation_status = 'validated'
    group by date_trunc('month', due_date)::date
  ) o using (period_month)
  on conflict (period_month) do update set revenue = excluded.revenue, cost = excluded.cost, total_outstanding = excluded.total_outstanding, validation_status = 'validated', updated_at = now();
end;
$$;

grant execute on function public.refresh_c1_macro_metrics() to authenticated;
