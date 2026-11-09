CREATE TABLE "public"."d2_audit_logs" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "candidate_id"  uuid                     NOT NULL,
  "actor_id"      uuid,
  "actor_name"    character varying(100)   DEFAULT 'Budi Santoso'::character varying,
  "old_status"    character varying(50)    NOT NULL,
  "new_status"    character varying(50)    NOT NULL,
  "change_reason" character varying(255),
  "created_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "d2_audit_logs_pkey" PRIMARY KEY (id),
  CONSTRAINT "d2_audit_logs_candidate_id_fkey" FOREIGN KEY (candidate_id) REFERENCES public.d2_candidates(id) ON DELETE CASCADE
);

ALTER TABLE "public"."d2_audit_logs"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_d2_audit_logs_candidate ON public.d2_audit_logs USING btree (candidate_id);

CREATE INDEX idx_d2_audit_logs_created_at ON public.d2_audit_logs USING btree (created_at DESC);

CREATE POLICY "Allow insert audit logs" ON "public"."d2_audit_logs"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

CREATE POLICY "Allow read audit logs" ON "public"."d2_audit_logs"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "Deny delete on audit logs" ON "public"."d2_audit_logs"
  FOR DELETE
  TO PUBLIC
  USING (false);

CREATE POLICY "Deny update on audit logs" ON "public"."d2_audit_logs"
  FOR UPDATE
  TO PUBLIC
  USING (false);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d2_audit_logs" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d2_audit_logs" TO "service_role";

REVOKE ALL ON TABLE "public"."d2_audit_logs" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d2_audit_logs" TO "postgres";
