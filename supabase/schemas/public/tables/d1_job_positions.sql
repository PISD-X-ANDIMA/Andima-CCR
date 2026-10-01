CREATE TABLE "public"."d1_job_positions" (
  "id"               uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "nama_posisi"      character varying(100)      NOT NULL,
  "departemen"       character varying(255)      NOT NULL,
  "deskripsi_posisi" character varying(500),
  "status_posisi"    character varying(20)       DEFAULT 'Active'::character varying,
  "created_at"       timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "d1_job_positions_departemen_check"
    CHECK
    (((departemen)::text = ANY ((ARRAY['Department of Finance and Accounting'::character varying, 'Department of Human Capital and Culture'::character varying,
    'Department of Commercial and Strategic Client Partnership'::character varying])::text[]))),
  CONSTRAINT "d1_job_positions_nama_posisi_check" CHECK ((char_length((nama_posisi)::text) >= 3)),
  CONSTRAINT "d1_job_positions_pkey" PRIMARY KEY (id),
  CONSTRAINT "d1_job_positions_status_posisi_check" CHECK (((status_posisi)::text = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::text[]))),
  CONSTRAINT "unique_posisi_per_departemen" UNIQUE (nama_posisi, departemen)
);

CREATE POLICY "Enable delete for users based on user_id" ON "public"."d1_job_positions"
  FOR DELETE
  TO PUBLIC
  USING ((auth.uid() IS NOT NULL));

CREATE POLICY "Enable insert for authenticated users only" ON "public"."d1_job_positions"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON "public"."d1_job_positions"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Policy with table joins" ON "public"."d1_job_positions"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() IS NOT NULL));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d1_job_positions" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d1_job_positions" TO "service_role";

REVOKE ALL ON TABLE "public"."d1_job_positions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d1_job_positions" TO "postgres";
