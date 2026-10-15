-- Populate the overdue projection for validated uploads that existed before
-- the authoritative refresh RPC was installed.

-- Older deployments made the legacy master-customer reference mandatory.
-- Uploaded-only customers use c1_customer_id, so the legacy reference must
-- remain nullable for those rows.
alter table if exists public.c1_overdue_alert
  alter column customer_id drop not null;

select public.c1_refresh_overdue_alerts(current_date);
