-- Invoice numbers from C1 source files are business identifiers (for example
-- "26 23038"), not UUIDs. Older remote deployments created the workflow
-- invoice_id columns as uuid, which makes overdue evaluation fail on upload.
-- Preserve existing values as text and keep the workflow foreign keys intact.
do $$
declare
  foreign_key record;
begin
  for foreign_key in
    select conrelid::regclass as table_name, conname
    from pg_constraint
    where contype = 'f'
      and confrelid = 'public.c1_overdue_alert'::regclass
      and conrelid in ('public.c1_assignment'::regclass, 'public.c1_mid_feed'::regclass)
  loop
    execute format('alter table %s drop constraint %I', foreign_key.table_name, foreign_key.conname);
  end loop;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'c1_overdue_alert'
      and column_name = 'invoice_id' and data_type = 'uuid'
  ) then
    alter table public.c1_overdue_alert
      alter column invoice_id type text using invoice_id::text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'c1_assignment'
      and column_name = 'invoice_id' and data_type = 'uuid'
  ) then
    alter table public.c1_assignment
      alter column invoice_id type text using invoice_id::text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'c1_mid_feed'
      and column_name = 'invoice_id' and data_type = 'uuid'
  ) then
    alter table public.c1_mid_feed
      alter column invoice_id type text using invoice_id::text;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'c1_assignment_invoice_id_fkey') then
    alter table public.c1_assignment
      add constraint c1_assignment_invoice_id_fkey
      foreign key (invoice_id) references public.c1_overdue_alert(invoice_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'c1_mid_feed_invoice_id_fkey') then
    alter table public.c1_mid_feed
      add constraint c1_mid_feed_invoice_id_fkey
      foreign key (invoice_id) references public.c1_overdue_alert(invoice_id) on delete cascade;
  end if;
end $$;
