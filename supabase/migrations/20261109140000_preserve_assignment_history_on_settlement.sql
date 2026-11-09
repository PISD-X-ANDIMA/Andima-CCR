-- Migration: Preserve follow-up assignment history when overdue alerts are settled
alter table public.c1_assignment
  drop constraint if exists c1_assignment_invoice_id_fkey;

