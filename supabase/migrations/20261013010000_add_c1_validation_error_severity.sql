alter table public.c1_document_validation_errors
  add column if not exists severity text not null default 'ERROR';

alter table public.c1_document_validation_errors
  drop constraint if exists c1_document_validation_errors_severity_check;

alter table public.c1_document_validation_errors
  add constraint c1_document_validation_errors_severity_check
  check (severity in ('ERROR', 'WARNING'));
