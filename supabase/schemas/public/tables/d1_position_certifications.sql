CREATE TABLE "public"."d1_position_certifications" (
  "id"                   uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "position_id"          uuid                        NOT NULL,
  "certification_name"   character varying(150)      NOT NULL,
  "issuing_authority"    character varying(100)      NOT NULL,
  "regulation_reference" character varying(100),
  "is_required"          boolean                     NOT NULL DEFAULT true,
  "notes"                character varying(500),
  "created_at"           timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "created_by"           uuid,
  CONSTRAINT "d1_position_certifications_certification_name_check"
    CHECK (((char_length((certification_name)::text) >= 3) AND ((certification_name)::text ~ '^[a-zA-Z0-9\s\-\/]+$'::text))),
  CONSTRAINT "d1_position_certifications_issuing_authority_check"
    CHECK (((char_length((issuing_authority)::text) >= 3) AND ((issuing_authority)::text ~ '^[a-zA-Z0-9\s\-]+$'::text))),
  CONSTRAINT "d1_position_certifications_pkey" PRIMARY KEY (id),
  CONSTRAINT "d1_position_certifications_regulation_reference_check" CHECK (((regulation_reference IS NULL) OR ((regulation_reference)::text ~ '^[a-zA-Z0-9\s\-\/\.]+$'::text))),
  CONSTRAINT "fk_position_cert" FOREIGN KEY (position_id) REFERENCES public.d1_job_positions(id) ON DELETE CASCADE,
  CONSTRAINT "unique_cert_per_position" UNIQUE (position_id, certification_name)
);

CREATE POLICY "Enable read access for all users" ON "public"."d1_position_certifications"
  FOR SELECT
  TO PUBLIC
  USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d1_position_certifications" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d1_position_certifications" TO "service_role";

REVOKE ALL ON TABLE "public"."d1_position_certifications" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d1_position_certifications" TO "postgres";
