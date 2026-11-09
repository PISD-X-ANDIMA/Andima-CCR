create index if not exists c1_company_sales_staging_customer_idx
  on public.c1_company_sales_staging_rows (c1_customer_id);

create index if not exists c1_outstanding_staging_customer_idx
  on public.c1_outstanding_staging_rows (c1_customer_id);
