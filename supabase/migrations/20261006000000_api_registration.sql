-- Server-only registration. All profile writes commit together under a global ID allocation lock.
begin;
-- The API owns provisioning; retire only legacy auth triggers using this profile function.
do $$ declare item record; begin
 for item in select t.tgname from pg_trigger t
 join pg_proc p on p.oid = t.tgfoid
 join pg_namespace n on n.oid = p.pronamespace
 where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
   and n.nspname = 'public' and p.proname = 'handle_new_user_to_b2_register'
 loop execute format('drop trigger %I on auth.users', item.tgname); end loop;
end $$;
drop policy if exists "Allow anon insert" on public.b2_register;
drop policy if exists "Allow anon select" on public.b2_register;
revoke all on public.b2_register from anon, authenticated;

create or replace function public.provision_app_registration(
 p_user_id uuid, p_full_name text, p_email text, p_phone text,
 p_status text, p_position_id uuid, p_department_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
 v_prefix text; v_code text; v_number integer; v_width integer := 3; v_employee uuid; v_role public.d3_app_role;
begin
 perform pg_advisory_xact_lock(610060001);
 if not exists (select 1 from auth.users where id = p_user_id and lower(email) = lower(p_email)) then
   raise exception 'Auth user mismatch';
 end if;
 if exists (select 1 from public.d3_employee where lower(email) = lower(p_email))
    or exists (select 1 from public.b2_register where lower(email) = lower(p_email)) then
   raise exception 'Email already registered';
 end if;
 if not exists (select 1 from public.d3_positions where id = p_position_id)
    or not exists (select 1 from public.d3_departments where id = p_department_id) then
   raise exception 'Invalid registration reference';
 end if;
 v_prefix := case p_department_id::text
 when '72cd470d-216c-48b6-abd9-0cd05a4d8974' then 'HCC-HR-MGR'
 when 'd38c1ed7-abd4-4a57-ab9d-0ba1d396fbfc' then 'FAT-BIL'
 when '8113ab6f-d5cc-4c94-bbf6-e08047931fab' then 'IT-DEV'
 when '1653db5f-2b64-418f-b28b-68cb7b9dae8e' then 'DIR-FAT'
 when '97ac5d35-5da2-4f5d-9d36-78500f403cc7' then 'COM-CS-MGR'
 else 'AND' end;
 if p_position_id = '0ec333af-8737-413f-adab-841a3067e485'::uuid then
   select code into v_code from unnest(array['DIR-FAT-001','DIR-COM-001','DIR-HCC-001']) with ordinality as codes(code, ordering)
   where not exists (select 1 from public.b2_register where employee_id = code)
     and not exists (select 1 from public.d3_employee where employee_id = code)
   order by ordering limit 1;
   if v_code is null then v_prefix := 'AND'; v_width := 4; end if;
 end if;
 if v_code is null then
   select coalesce(max(substring(employee_id from length(v_prefix) + 2)::integer), 0) + 1 into v_number
   from (select employee_id from public.b2_register union all select employee_id from public.d3_employee) ids
   where employee_id ~ ('^' || v_prefix || '-[0-9]+$');
   v_code := v_prefix || '-' || lpad(v_number::text, greatest(v_width, length(v_number::text)), '0');
 end if;
 v_role := case
 when p_position_id::text in ('0ec333af-8737-413f-adab-841a3067e485','48e90a83-86bd-4bd9-8b34-0fe7da11cc18','8b14d133-0c6c-4867-a807-373cf462e5fe') then 'MANAGER'::public.d3_app_role
 when p_position_id::text in ('10da1bac-a6a8-472e-a171-e4984ab768d9','58706b7f-950b-4e71-b066-792fbd91424d','a8be934a-5d25-46cc-94c7-3be79e3ba035','ba43f1eb-7e99-4a85-8471-9d3e54e526b9','d7d206cc-6763-459f-9a70-771f65b89937','4b7c8e36-f133-4e2b-9b98-c1a1554d1545','67a8e1ba-daa7-4230-9c82-8dfef7e8fd15') then 'HR'::public.d3_app_role
 else 'EMPLOYEE'::public.d3_app_role end;
 insert into public.b2_register(id, employee_id, full_name, email, phone, employment_status, position_id, departement_id)
 values(p_user_id, v_code, p_full_name, lower(p_email), p_phone, lower(p_status), p_position_id, p_department_id);
 insert into public.d3_employee(employee_id, full_name, email, phone, join_date, employment_status, position_id, department_id, work_location)
 values(v_code, p_full_name, lower(p_email), p_phone, current_date, upper(p_status), p_position_id, p_department_id, 'HQ') returning id into v_employee;
 insert into public.d3_user_access(auth_user_id, employee_id, app_role) values(p_user_id, v_employee, v_role);
 return jsonb_build_object('employee_id', v_code, 'app_role', v_role);
end; $$;
revoke all on function public.provision_app_registration(uuid,text,text,text,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.provision_app_registration(uuid,text,text,text,text,uuid,uuid) to service_role;

create or replace function public.rollback_app_registration(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_employee uuid;
begin
 perform pg_advisory_xact_lock(610060001);
 select a.employee_id into v_employee from public.d3_user_access a join public.b2_register r on r.id = a.auth_user_id
 where a.auth_user_id = p_user_id;
 delete from public.d3_user_access where auth_user_id = p_user_id;
 delete from public.b2_register where id = p_user_id;
 delete from public.d3_employee where id = v_employee;
end; $$;
revoke all on function public.rollback_app_registration(uuid) from public, anon, authenticated;
grant execute on function public.rollback_app_registration(uuid) to service_role;
commit;
