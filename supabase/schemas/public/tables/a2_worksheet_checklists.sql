CREATE TABLE "public"."a2_worksheet_checklists" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "worksheet_id" bigint                   NOT NULL,
  "check_label"  text                     NOT NULL,
  "is_verified"  boolean                  NOT NULL DEFAULT false,
  "verified_by"  uuid,
  "verified_at"  timestamp with time zone,
  "sort_order"   smallint                 NOT NULL DEFAULT 0,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "a2_worksheet_checklists_pkey" PRIMARY KEY (id),
  CONSTRAINT "a2_worksheet_checklists_worksheet_id_fkey" FOREIGN KEY (worksheet_id) REFERENCES public.a2_worksheets(worksheet_id) ON DELETE CASCADE,
  CONSTRAINT "a2_worksheet_checklists_verified_by_fkey" FOREIGN KEY (verified_by) REFERENCES public.d3_employee(id)
);

CREATE INDEX idx_a2_ws_checks_wsid ON public.a2_worksheet_checklists USING btree (worksheet_id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_worksheet_checklists" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_worksheet_checklists" TO "service_role";

REVOKE ALL ON TABLE "public"."a2_worksheet_checklists" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_worksheet_checklists" TO "postgres";
