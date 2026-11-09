-- Keep the overdue read path selective as staging and alert history grow.
create index if not exists c1_outstanding_staging_positive_due_idx
  on public.c1_outstanding_staging_rows (due_date, created_at desc)
  where outstanding_amount > 0;

create index if not exists c1_document_uploads_validation_id_idx
  on public.c1_document_uploads (validation_status, id);

create index if not exists c1_overdue_alert_days_due_idx
  on public.c1_overdue_alert (days_overdue, due_date);
