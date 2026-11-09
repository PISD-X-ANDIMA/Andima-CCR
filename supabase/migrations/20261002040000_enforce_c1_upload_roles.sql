-- Enforce the same HR-only write boundary at PostgreSQL/RLS level as the API.
drop policy if exists "Users create own document uploads" on public.c1_document_uploads;
drop policy if exists "Users update own document uploads" on public.c1_document_uploads;
drop policy if exists "Users create own document errors" on public.c1_document_validation_errors;
drop policy if exists "Users create own sales staging" on public.c1_company_sales_staging_rows;
drop policy if exists "Users create own outstanding staging" on public.c1_outstanding_staging_rows;

create policy "HR users create own document uploads"
on public.c1_document_uploads for insert to authenticated
with check (
  uploader_user_id = auth.uid()
  and exists (
    select 1 from public.d3_user_access
    where auth_user_id = auth.uid() and app_role::text = 'HR'
  )
);

create policy "HR users update own document uploads"
on public.c1_document_uploads for update to authenticated
using (
  uploader_user_id = auth.uid()
  and exists (
    select 1 from public.d3_user_access
    where auth_user_id = auth.uid() and app_role::text = 'HR'
  )
)
with check (uploader_user_id = auth.uid());

create policy "HR users create document errors"
on public.c1_document_validation_errors for insert to authenticated
with check (
  exists (
    select 1
    from public.c1_document_uploads d
    join public.d3_user_access a on a.auth_user_id = auth.uid()
    where d.id = document_id and d.uploader_user_id = auth.uid() and a.app_role::text = 'HR'
  )
);

create policy "HR users create sales staging"
on public.c1_company_sales_staging_rows for insert to authenticated
with check (
  exists (
    select 1
    from public.c1_document_uploads d
    join public.d3_user_access a on a.auth_user_id = auth.uid()
    where d.id = document_id and d.uploader_user_id = auth.uid() and a.app_role::text = 'HR'
  )
);

create policy "HR users create outstanding staging"
on public.c1_outstanding_staging_rows for insert to authenticated
with check (
  exists (
    select 1
    from public.c1_document_uploads d
    join public.d3_user_access a on a.auth_user_id = auth.uid()
    where d.id = document_id and d.uploader_user_id = auth.uid() and a.app_role::text = 'HR'
  )
);
