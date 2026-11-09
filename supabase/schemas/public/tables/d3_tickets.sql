CREATE TABLE "public"."d3_tickets" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "ticket_code"            text                     NOT NULL DEFAULT ('TKT-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10))),
  "employee_id"            uuid                     NOT NULL,
  "title"                  text                     NOT NULL,
  "category"               text                     NOT NULL,
  "description"            text                     NOT NULL,
  "occurred_at"            timestamp with time zone,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "reporter_name"          text,
  "reporter_employee_code" text,
  "reporter_department"    text,
  CONSTRAINT "d3_tickets_category_check" CHECK (((char_length(TRIM(BOTH FROM category)) >= 2) AND (char_length(TRIM(BOTH FROM category)) <= 80))),
  CONSTRAINT "d3_tickets_description_check" CHECK (((char_length(TRIM(BOTH FROM description)) >= 10) AND (char_length(TRIM(BOTH FROM description)) <= 4000))),
  CONSTRAINT "d3_tickets_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.d3_employee(id) ON DELETE RESTRICT,
  CONSTRAINT "d3_tickets_pkey" PRIMARY KEY (id),
  CONSTRAINT "d3_tickets_ticket_code_key" UNIQUE (ticket_code),
  CONSTRAINT "d3_tickets_title_check" CHECK (((char_length(TRIM(BOTH FROM title)) >= 3) AND (char_length(TRIM(BOTH FROM title)) <= 160)))
);

ALTER TABLE "public"."d3_tickets"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."d3_tickets"
  ADD COLUMN "status" public.d3_ticket_status NOT NULL DEFAULT 'SUBMITTED'::public.d3_ticket_status;

CREATE INDEX d3_tickets_employee_created_idx ON public.d3_tickets USING btree (employee_id, created_at DESC);

CREATE INDEX d3_tickets_status_created_idx ON public.d3_tickets USING btree (status, created_at DESC);

CREATE TRIGGER d3_tickets_audit
  AFTER INSERT OR UPDATE OF status ON public.d3_tickets
  FOR EACH ROW
  EXECUTE FUNCTION private.d3_write_ticket_history();

CREATE TRIGGER d3_tickets_protect_update
  BEFORE UPDATE ON public.d3_tickets
  FOR EACH ROW
  EXECUTE FUNCTION private.d3_protect_ticket_update();

CREATE TRIGGER d3_tickets_reporter_snapshot
  BEFORE INSERT ON public.d3_tickets
  FOR EACH ROW
  EXECUTE FUNCTION private.d3_populate_ticket_reporter_snapshot();

CREATE POLICY "D3 users read allowed tickets" ON "public"."d3_tickets"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.d3_user_access access
  WHERE
    ((access.auth_user_id = ( SELECT auth.uid() AS uid)) AND ((access.employee_id = d3_tickets.employee_id) OR (access.app_role = ANY (ARRAY['HR'::public.d3_app_role,
    'MANAGER'::public.d3_app_role])))))));

CREATE POLICY "Employees create their own tickets" ON "public"."d3_tickets"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.d3_user_access access
  WHERE ((access.auth_user_id = ( SELECT auth.uid() AS uid)) AND (access.employee_id = d3_tickets.employee_id) AND (access.app_role = 'EMPLOYEE'::public.d3_app_role)))));

CREATE POLICY "HR and managers update ticket status" ON "public"."d3_tickets"
  FOR UPDATE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.d3_user_access access
  WHERE ((access.auth_user_id = ( SELECT auth.uid() AS uid)) AND (access.app_role = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.d3_user_access access
  WHERE ((access.auth_user_id = ( SELECT auth.uid() AS uid)) AND (access.app_role = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role]))))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_tickets" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_tickets" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_tickets" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_tickets" TO "postgres";
