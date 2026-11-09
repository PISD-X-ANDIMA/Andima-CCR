CREATE OR REPLACE FUNCTION private.d3_protect_ticket_update()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if new.ticket_code is distinct from old.ticket_code
     or new.employee_id is distinct from old.employee_id
     or new.title is distinct from old.title
     or new.category is distinct from old.category
     or new.description is distinct from old.description
     or new.occurred_at is distinct from old.occurred_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Only ticket status may be updated after creation';
  end if;

  if new.status is not distinct from old.status then
    raise exception 'Ticket status must change when updating a ticket';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "private"."d3_protect_ticket_update"() FROM PUBLIC;
