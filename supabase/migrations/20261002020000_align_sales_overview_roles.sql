update public.d3_user_access as access
set app_role = case
  when lower(trim(position.title)) in (
    'director of finance, accounting & digital transformation',
    'manager of accounting',
    'manager of customer success'
  ) then 'MANAGER'::public.d3_app_role
  when lower(trim(position.title)) in (
    'accounting associate (billing)',
    'cash manager',
    'cash manager associate',
    'tax manager',
    'tax associate',
    'sales executive',
    'sales administration associate'
  ) then 'HR'::public.d3_app_role
  else access.app_role
end
from public.d3_employee as employee
join public.d3_positions as position on position.id = employee.position_id
where employee.id = access.employee_id;
