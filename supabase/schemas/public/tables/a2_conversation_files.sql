CREATE TABLE "public"."a2_conversation_files" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" uuid                     NOT NULL,
  "file_name"       text                     NOT NULL,
  "file_type"       character varying(10)    NOT NULL,
  "file_url"        text                     NOT NULL,
  "file_size_kb"    integer,
  "uploaded_by"     uuid                     NOT NULL,
  "uploaded_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "a2_conversation_files_file_type_check"
    CHECK
    (((file_type)::text = ANY ((ARRAY['txt'::character varying, 'pdf'::character varying, 'docx'::character varying, 'xlsx'::character varying, 'jpg'::character varying,
    'png'::character varying])::text[]))),
  CONSTRAINT "a2_conversation_files_pkey" PRIMARY KEY (id),
  CONSTRAINT "a2_conversation_files_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.a2_record_conversations(id) ON DELETE CASCADE,
  CONSTRAINT "a2_conversation_files_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES public.d3_employee(id)
);

CREATE INDEX idx_a2_conv_files_parent ON public.a2_conversation_files USING btree (conversation_id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_conversation_files" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_conversation_files" TO "service_role";

REVOKE ALL ON TABLE "public"."a2_conversation_files" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_conversation_files" TO "postgres";
