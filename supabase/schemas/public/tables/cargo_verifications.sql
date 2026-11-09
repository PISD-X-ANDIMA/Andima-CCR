CREATE TABLE "public"."cargo_verifications" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "job_id"             uuid                     NOT NULL,
  "is_dangerous_goods" boolean                  DEFAULT false,
  "dg_class"           character varying(50),
  "special_handling"   character varying(255),
  "verified_by"        uuid,
  "verified_at"        timestamp with time zone DEFAULT now(),
  CONSTRAINT "cargo_verifications_pkey" PRIMARY KEY (id),
  CONSTRAINT "cargo_verifications_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE
);

ALTER TABLE "public"."cargo_verifications"
  ADD COLUMN "airline_standard_status" public.airline_standard_status_enum NOT NULL DEFAULT 'Sesuai'::public.airline_standard_status_enum;

ALTER TABLE "public"."cargo_verifications"
  ADD COLUMN "doc_match_status" public.doc_match_status_enum NOT NULL DEFAULT 'Sesuai'::public.doc_match_status_enum;

ALTER TABLE "public"."cargo_verifications"
  ADD COLUMN "packaging_condition" public.packaging_condition_enum NOT NULL DEFAULT 'Baik'::public.packaging_condition_enum;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."cargo_verifications" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."cargo_verifications" TO "service_role";

REVOKE ALL ON TABLE "public"."cargo_verifications" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."cargo_verifications" TO "postgres";
