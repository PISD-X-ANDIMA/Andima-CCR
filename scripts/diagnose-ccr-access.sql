-- Read-only diagnostic for the CCR chart authorization repair.
-- Run this against the Supabase SQL editor or a service-role database session.

with expected(email, employee_id, position_code, expected_role) as (
  values
    ('stevanusimanuel@andima.co.id', 'CCR-003', 'DIR-FAT', 'MANAGEMENT'),
    ('jonathanindrawan@andima.co.id', 'CCR-004', 'FAT-ACC-MGR', 'MANAGEMENT'),
    ('diazbara@andima.co.id', 'CCR-005', 'COM-CS-MGR', 'MANAGEMENT'),
    ('jesichan@andima.co.id', 'CCR-006', 'FAT-BIL', 'STAFF'),
    ('aldosapan@andima.co.id', 'CCR-007', 'FAT-TRS-MGR', 'STAFF'),
    ('michaeljackson@andima.co.id', 'CCR-008', 'FAT-TAX-MGR', 'STAFF'),
    ('taylorswift@andima.co.id', 'CCR-009', 'FAT-TAX-ASC', 'STAFF'),
    ('keanureeves@andima.co.id', 'CCR-010', 'COM-SLS', 'STAFF'),
    ('emmawatson@andima.co.id', 'CCR-011', 'COM-SA', 'STAFF'),
    ('tomhanks@andima.co.id', 'CCR-012', 'FAT-TRS-ASC', 'STAFF')
), profiles as (
  select
    e.email as expected_email,
    e.employee_id as expected_employee_id,
    e.position_code,
    e.expected_role,
    b.id,
    b.auth_user_id,
    u.email as auth_email,
    u.id is not null as auth_user_exists,
    b.email,
    b.employee_id,
    b.position_id,
    b.resolved_role,
    b.registration_status,
    b.is_active,
    p.code as actual_position_code,
    p.title as actual_position_title,
    lower(coalesce(b.email, '')) = lower(e.email) as email_match,
    b.employee_id = e.employee_id as employee_id_match,
    b.auth_user_id is not null and u.id is not null as auth_user_linked,
    lower(coalesce(u.email, '')) = lower(e.email) as auth_email_match,
    b.resolved_role = e.expected_role
      and b.registration_status in ('APPROVED', 'PROVISIONED')
      and b.is_active = true as chart_access_ready
  from expected e
  left join public.b2_register b
    on lower(b.email) = lower(e.email)
    or b.employee_id = e.employee_id
  left join public.d3_positions p on p.id = b.position_id
  left join auth.users u on u.id = b.auth_user_id
)
select *
from profiles
order by expected_employee_id;
