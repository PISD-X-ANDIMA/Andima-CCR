-- Migration: Overdue Follow-up Progress Schema Extension
-- Squad: C1 (CCR) ONLY
-- Modifies: public.c1_assignment (Adds progress tracking fields and attachments)

alter table public.c1_assignment
  add column if not exists follow_up_action text,
  add column if not exists promise_date date,
  add column if not exists attachment_url text,
  add column if not exists updated_by uuid references auth.users(id);

comment on column public.c1_assignment.follow_up_action is 'Action taken during collection follow-up: CALL, WHATSAPP, EMAIL, VISIT, NEGOTIATION';
comment on column public.c1_assignment.promise_date is 'Customer promised payment date if agreed';
comment on column public.c1_assignment.attachment_url is 'Storage URL or reference of uploaded progress evidence';
comment on column public.c1_assignment.updated_by is 'User who recorded this progress log entry';

