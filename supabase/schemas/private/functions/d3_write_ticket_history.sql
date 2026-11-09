CREATE OR REPLACE FUNCTION private.d3_write_ticket_history()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  current_actor uuid;
begin
  if tg_table_name = 'd3_tickets' and tg_op = 'INSERT' then
    insert into public.d3_ticket_history (
      ticket_id, actor_employee_id, event_type, to_status
    ) values (
      new.id, new.employee_id, 'CREATED', new.status
    );
    return new;
  end if;

  if tg_table_name = 'd3_tickets' and tg_op = 'UPDATE' then
    select employee_id into current_actor
    from public.d3_user_access
    where auth_user_id = auth.uid();

    if current_actor is null then
      raise exception 'Authenticated D3 user mapping is required for an audit entry';
    end if;

    insert into public.d3_ticket_history (
      ticket_id, actor_employee_id, event_type, from_status, to_status
    ) values (
      new.id, current_actor, 'STATUS_CHANGED', old.status, new.status
    );
    return new;
  end if;

  if tg_table_name = 'd3_ticket_followups' and tg_op = 'INSERT' then
    insert into public.d3_ticket_history (
      ticket_id, actor_employee_id, event_type, note
    ) values (
      new.ticket_id, new.actor_employee_id, 'FOLLOW_UP_ADDED', new.note
    );
    return new;
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "private"."d3_write_ticket_history"() FROM PUBLIC;
