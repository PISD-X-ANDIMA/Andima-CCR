-- Demo records follow the same extraction/staging path as uploaded documents.
-- They are isolated behind a stable file name so this seed is idempotent.
do $$
declare
  demo_user uuid;
  sales_document uuid := '00000000-0000-0000-0000-000000000301';
  outstanding_document uuid := '00000000-0000-0000-0000-000000000302';
begin
  select id into demo_user from auth.users order by created_at limit 1;
  if demo_user is null then
    return;
  end if;

  insert into public.c1_document_uploads (
    id, file_name, document_type, storage_path, mime_type, file_size_bytes,
    checksum, uploader_user_id, validation_status, processed_at,
    row_count, valid_row_count, invalid_row_count, error_summary
  ) values
    (sales_document, 'demo_company_sales_report.xlsx', 'COMPANY_SALES_REPORT',
      'demo/00000000-0000-0000-0000-000000000301/demo_company_sales_report.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 1,
      'demo-sales-overview-seed', demo_user, 'validated', now(), 4, 4, 0, null),
    (outstanding_document, 'demo_outstanding_report.xlsx', 'OUTSTANDING_REPORT',
      'demo/00000000-0000-0000-0000-000000000302/demo_outstanding_report.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 1,
      'demo-outstanding-overview-seed', demo_user, 'validated', now(), 4, 4, 0, null)
  on conflict (id) do nothing;

  insert into public.c1_company_sales_staging_rows
    (document_id, row_number, period_month, customer_name, revenue, trucking_cost, handling_cost, storage_cost, other_operational_cost)
  values
    (sales_document, 2, '2026-07-01', 'Demo Customer A', 185000000, 72000000, 8500000, 4100000, 2100000),
    (sales_document, 3, '2026-08-01', 'Demo Customer B', 212000000, 84000000, 9200000, 5300000, 2600000),
    (sales_document, 4, '2026-09-01', 'Demo Customer C', 238000000, 91000000, 10400000, 6100000, 3100000),
    (sales_document, 5, '2026-10-01', 'Demo Customer D', 264000000, 102000000, 11800000, 7200000, 3500000)
  on conflict (document_id, row_number) do nothing;

  insert into public.c1_outstanding_staging_rows
    (document_id, row_number, invoice_number, customer_name, outstanding_amount, due_date, create_date, job_number, mawb)
  values
    (outstanding_document, 2, 'DEMO-INV-2607', 'Demo Customer A', 28500000, '2026-07-15', '2026-07-01', 'DEMO-JOB-2607', null),
    (outstanding_document, 3, 'DEMO-INV-2608', 'Demo Customer B', 34200000, '2026-08-15', '2026-08-01', 'DEMO-JOB-2608', null),
    (outstanding_document, 4, 'DEMO-INV-2609', 'Demo Customer C', 39800000, '2026-09-15', '2026-09-01', 'DEMO-JOB-2609', null),
    (outstanding_document, 5, 'DEMO-INV-2610', 'Demo Customer D', 42100000, '2026-10-15', '2026-10-01', 'DEMO-JOB-2610', null)
  on conflict (document_id, row_number) do nothing;

  perform public.refresh_c1_macro_metrics();
end $$;
