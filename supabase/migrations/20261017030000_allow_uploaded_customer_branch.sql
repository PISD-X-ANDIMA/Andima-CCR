-- Uploaded customers use an explicit branch fallback until master data is linked.

alter table public.c1_customer
  drop constraint if exists c1_customer_branch_check;

alter table public.c1_customer
  add constraint c1_customer_branch_check
  check ((branch)::text = any (array['Jakarta', 'Semarang', 'Surabaya', 'Balikpapan', 'Medan', 'Tidak tersedia']::text[]));

