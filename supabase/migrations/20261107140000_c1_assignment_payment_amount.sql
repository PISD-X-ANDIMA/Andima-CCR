-- Migration: Add payment_amount to c1_assignment for overdue follow-up tracking
-- Squad: C1 (CCR) ONLY

alter table public.c1_assignment
  add column if not exists payment_amount numeric(15, 2) default 0;

comment on column public.c1_assignment.payment_amount is 'Nominal pembayaran yang diterima atau disepakati selama proses follow-up';

