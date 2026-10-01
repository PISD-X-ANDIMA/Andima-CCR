CREATE TABLE "public"."d3_ticket_followups" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "ticket_id"         uuid                     NOT NULL,
  "actor_employee_id" uuid                     NOT NULL,
  "note"              text                     NOT NULL,
  "follow_up_at"      timestamp with time zone,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "d3_ticket_followups_actor_employee_id_fkey" FOREIGN KEY (actor_employee_id) REFERENCES public.d3_employee(id) ON DELETE RESTRICT,
  CONSTRAINT "d3_ticket_followups_note_check" CHECK (((char_length(TRIM(BOTH FROM note)) >= 3) AND (char_length(TRIM(BOTH FROM note)) <= 2000))),
  CONSTRAINT "d3_ticket_followups_pkey" PRIMARY KEY (id),
  CONSTRAINT "d3_ticket_followups_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.d3_tickets(id) ON DELETE CASCADE
);

ALTER TABLE "public"."d3_ticket_followups"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX d3_ticket_followups_actor_idx ON public.d3_ticket_followups USING btree (actor_employee_id);

CREATE INDEX d3_ticket_followups_ticket_date_idx ON public.d3_ticket_followups USING btree (ticket_id, follow_up_at DESC);

CREATE TRIGGER d3_ticket_followups_audit
  AFTER INSERT ON public.d3_ticket_followups
  FOR EACH ROW
  EXECUTE FUNCTION private.d3_write_ticket_history();

CREATE POLICY "D3 users read allowed follow-ups" ON "public"."d3_ticket_followups"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.d3_tickets ticket
     JOIN public.d3_user_access access ON ((access.auth_user_id = ( SELECT auth.uid() AS uid))))
  WHERE
    ((ticket.id = d3_ticket_followups.ticket_id) AND ((ticket.employee_id = access.employee_id) OR (access.app_role = ANY (ARRAY['HR'::public.d3_app_role,
    'MANAGER'::public.d3_app_role])))))));

CREATE POLICY "HR and managers add their own follow-ups" ON "public"."d3_ticket_followups"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((actor_employee_id = ( SELECT d3_user_access.employee_id
   FROM public.d3_user_access
  WHERE (d3_user_access.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (EXISTS ( SELECT 1
   FROM public.d3_user_access access
  WHERE ((access.auth_user_id = ( SELECT auth.uid() AS uid)) AND (access.app_role = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])))))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_ticket_followups" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_ticket_followups" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_ticket_followups" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_ticket_followups" TO "postgres";
