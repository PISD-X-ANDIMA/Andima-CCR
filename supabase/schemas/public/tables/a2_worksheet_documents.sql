CREATE TABLE "public"."a2_worksheet_documents" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "worksheet_id"    bigint                   NOT NULL,
  "doc_name"        text                     NOT NULL,
  "doc_type"        character varying(10)    NOT NULL,
  "file_size_kb"    integer,
  "doc_url"         text                     NOT NULL,
  "doc_description" text,
  "is_verified"     boolean                  NOT NULL DEFAULT false,
  "uploaded_by"     uuid,
  "uploaded_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "a2_worksheet_documents_pkey" PRIMARY KEY (id),
  CONSTRAINT "a2_worksheet_documents_worksheet_id_fkey" FOREIGN KEY (worksheet_id) REFERENCES public.a2_worksheets(worksheet_id) ON DELETE CASCADE,
  CONSTRAINT "a2_worksheet_documents_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES public.d3_employee(id)
);

CREATE INDEX idx_a2_ws_docs_wsid ON public.a2_worksheet_documents USING btree (worksheet_id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_worksheet_documents" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_worksheet_documents" TO "service_role";

REVOKE ALL ON TABLE "public"."a2_worksheet_documents" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_worksheet_documents" TO "postgres";
