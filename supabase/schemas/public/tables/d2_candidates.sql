CREATE TABLE "public"."d2_candidates" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "job_id"            uuid                     NOT NULL,
  "full_name"         character varying(255)   NOT NULL,
  "nik"               character varying(16),
  "email"             character varying(255)   NOT NULL,
  "phone_number"      character varying(50),
  "registration_way"  character varying(50)    NOT NULL,
  "cv_file_path"      text                     NOT NULL,
  "stage"             character varying(50)    DEFAULT 'screening'::character varying,
  "status"            character varying(50)    DEFAULT 'applied'::character varying,
  "rejection_reason"  text,
  "application_count" integer                  DEFAULT 1,
  "created_at"        timestamp with time zone DEFAULT now(),
  "updated_at"        timestamp with time zone DEFAULT now(),
  CONSTRAINT "d2_candidates_pkey" PRIMARY KEY (id),
  CONSTRAINT "d2_candidates_registration_way_check"
    CHECK (((registration_way)::text = ANY ((ARRAY['scouting/interview-based'::character varying, 'recommendation-based'::character varying])::text[]))),
  CONSTRAINT "d2_candidates_status_check"
    CHECK
    (((status)::text = ANY ((ARRAY['applied'::character varying, 'assessment'::character varying, 'interview'::character varying, 'offered'::character varying,
    'rejected'::character varying])::text[]))),
  CONSTRAINT "d2_candidates_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.d2_job_posts(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."d2_candidates"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_d2_candidates_job_status ON public.d2_candidates USING btree (job_id, status);

CREATE INDEX idx_d2_candidates_lookup ON public.d2_candidates USING btree (email, nik);

CREATE POLICY "HR access candidates" ON "public"."d2_candidates"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Public insert candidates" ON "public"."d2_candidates"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d2_candidates" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d2_candidates" TO "service_role";

REVOKE ALL ON TABLE "public"."d2_candidates" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d2_candidates" TO "postgres";
