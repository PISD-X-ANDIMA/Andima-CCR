-- Enum values are isolated because PostgreSQL does not allow a newly added
-- enum value to be used earlier in the same transaction.
alter type public.d3_app_role add value if not exists 'STAFF';
alter type public.d3_app_role add value if not exists 'MANAGEMENT';
