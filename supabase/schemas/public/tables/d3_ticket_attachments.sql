CREATE TABLE "public"."d3_ticket_attachments" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "ticket_id"    uuid                     NOT NULL,
  "storage_path" text                     NOT NULL,
  "file_name"    text                     NOT NULL,
  "mime_type"    text,
  "byte_size"    bigint,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "d3_ticket_attachments_byte_size_check" CHECK (((byte_size IS NULL) OR (byte_size >= 0))),
  CONSTRAINT "d3_ticket_attachments_file_name_check" CHECK (((char_length(TRIM(BOTH FROM file_name)) >= 1) AND (char_length(TRIM(BOTH FROM file_name)) <= 255))),
  CONSTRAINT "d3_ticket_attachments_pkey" PRIMARY KEY (id),
  CONSTRAINT "d3_ticket_attachments_storage_path_key" UNIQUE (storage_path),
  CONSTRAINT "d3_ticket_attachments_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.d3_tickets(id) ON DELETE CASCADE
);

ALTER TABLE "public"."d3_ticket_attachments"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX d3_ticket_attachments_ticket_idx ON public.d3_ticket_attachments USING btree (ticket_id);

CREATE POLICY "Allowed users attach files to tickets" ON "public"."d3_ticket_attachments"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.d3_tickets ticket
     JOIN public.d3_user_access access ON ((access.auth_user_id = ( SELECT auth.uid() AS uid))))
  WHERE
    ((ticket.id = d3_ticket_attachments.ticket_id) AND ((ticket.employee_id = access.employee_id) OR (access.app_role = ANY (ARRAY['HR'::public.d3_app_role,
    'MANAGER'::public.d3_app_role])))))));

CREATE POLICY "D3 users read allowed ticket attachments" ON "public"."d3_ticket_attachments"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.d3_tickets ticket
     JOIN public.d3_user_access access ON ((access.auth_user_id = ( SELECT auth.uid() AS uid))))
  WHERE
    ((ticket.id = d3_ticket_attachments.ticket_id) AND ((ticket.employee_id = access.employee_id) OR (access.app_role = ANY (ARRAY['HR'::public.d3_app_role,
    'MANAGER'::public.d3_app_role])))))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_ticket_attachments" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_ticket_attachments" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_ticket_attachments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_ticket_attachments" TO "postgres";
