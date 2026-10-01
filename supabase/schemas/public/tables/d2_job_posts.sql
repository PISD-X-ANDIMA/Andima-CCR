CREATE TABLE "public"."d2_job_posts" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "title"        character varying(255)   NOT NULL,
  "department"   character varying(100)   NOT NULL,
  "location"     character varying(100)   DEFAULT 'Jakarta, Indonesia'::character varying,
  "description"  text,
  "requirements" text[],
  "status"       character varying(50)    DEFAULT 'active'::character varying,
  "created_at"   timestamp with time zone DEFAULT now(),
  "updated_at"   timestamp with time zone DEFAULT now(),
  CONSTRAINT "d2_job_posts_pkey" PRIMARY KEY (id),
  CONSTRAINT "d2_job_posts_status_check" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'closed'::character varying])::text[])))
);

ALTER TABLE "public"."d2_job_posts"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_d2_job_posts_status ON public.d2_job_posts USING btree (status);

CREATE POLICY "Public read active jobs" ON "public"."d2_job_posts"
  FOR SELECT
  TO "anon", "authenticated"
  USING (((status)::text = 'active'::text));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d2_job_posts" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d2_job_posts" TO "service_role";

REVOKE ALL ON TABLE "public"."d2_job_posts" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d2_job_posts" TO "postgres";
