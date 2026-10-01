CREATE TABLE "public"."d3_ticket_history" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "ticket_id"         uuid                     NOT NULL,
  "actor_employee_id" uuid                     NOT NULL,
  "event_type"        text                     NOT NULL,
  "note"              text,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "d3_ticket_history_actor_employee_id_fkey" FOREIGN KEY (actor_employee_id) REFERENCES public.d3_employee(id) ON DELETE RESTRICT,
  CONSTRAINT "d3_ticket_history_event_type_check" CHECK ((event_type = ANY (ARRAY['CREATED'::text, 'STATUS_CHANGED'::text, 'FOLLOW_UP_ADDED'::text]))),
  CONSTRAINT "d3_ticket_history_pkey" PRIMARY KEY (id),
  CONSTRAINT "d3_ticket_history_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.d3_tickets(id) ON DELETE CASCADE
);

ALTER TABLE "public"."d3_ticket_history"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."d3_ticket_history"
  ADD COLUMN "from_status" public.d3_ticket_status;

ALTER TABLE "public"."d3_ticket_history"
  ADD COLUMN "to_status" public.d3_ticket_status;

CREATE INDEX d3_ticket_history_actor_idx ON public.d3_ticket_history USING btree (actor_employee_id);

CREATE INDEX d3_ticket_history_ticket_created_idx ON public.d3_ticket_history USING btree (ticket_id, created_at DESC);

CREATE POLICY "D3 users read allowed ticket history" ON "public"."d3_ticket_history"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.d3_tickets ticket
     JOIN public.d3_user_access access ON ((access.auth_user_id = ( SELECT auth.uid() AS uid))))
  WHERE
    ((ticket.id = d3_ticket_history.ticket_id) AND ((ticket.employee_id = access.employee_id) OR (access.app_role = ANY (ARRAY['HR'::public.d3_app_role,
    'MANAGER'::public.d3_app_role])))))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_ticket_history" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_ticket_history" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_ticket_history" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_ticket_history" TO "postgres";
