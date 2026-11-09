CREATE TABLE "public"."a1_company_list" (
  "company_list_id" uuid                  NOT NULL DEFAULT gen_random_uuid(),
  "job_number"      text,
  "name"            text                  NOT NULL,
  "company_name"    text                  NOT NULL,
  "created_by"      text                  NOT NULL,
  "customer_code"   character varying(50),
  "address"         text,
  CONSTRAINT "a1_company_list_pkey" PRIMARY KEY (company_list_id)
);

CREATE POLICY "a1_company_list_auth_policy" ON "public"."a1_company_list"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "a1_company_list_select_policy" ON "public"."a1_company_list"
  FOR SELECT
  TO PUBLIC
  USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a1_company_list" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a1_company_list" TO "service_role";

REVOKE ALL ON TABLE "public"."a1_company_list" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a1_company_list" TO "postgres";
