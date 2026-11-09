CREATE POLICY "Allow public read a2-record-documents" ON "storage"."objects"
  FOR SELECT
  TO "anon", "authenticated"
  USING ((bucket_id = 'a2-record-documents'::text));

CREATE POLICY "Allow read and upload for a3-cargo-files 1brdjnv_0" ON "storage"."objects"
  FOR SELECT
  TO "anon", "authenticated"
  USING ((bucket_id = 'a3-cargo-files'::text));

CREATE POLICY "Allow read and upload for a3-cargo-files 1brdjnv_1" ON "storage"."objects"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK ((bucket_id = 'a3-cargo-files'::text));

CREATE POLICY "Allow upload to a2-record-documents" ON "storage"."objects"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK ((bucket_id = 'a2-record-documents'::text));

CREATE POLICY "D3 users read allowed stored ticket attachments" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'd3-ticket-attachments'::text) AND (EXISTS ( SELECT 1
   FROM ((public.d3_ticket_attachments attachment
     JOIN public.d3_tickets ticket ON ((ticket.id = attachment.ticket_id)))
     JOIN public.d3_user_access access ON ((access.auth_user_id = auth.uid())))
  WHERE
    ((attachment.storage_path = objects.name) AND ((ticket.employee_id = access.employee_id) OR (access.app_role = ANY (ARRAY['HR'::public.d3_app_role,
    'MANAGER'::public.d3_app_role]))))))));

CREATE POLICY "D3 users upload into their own attachment folder" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'd3-ticket-attachments'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));
