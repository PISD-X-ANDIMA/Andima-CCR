CREATE TABLE "public"."d4_kpi_role_catalog" (
  "role_order"      integer NOT NULL,
  "role_name"       text    NOT NULL,
  "indicator_order" integer NOT NULL,
  "kpi_name"        text    NOT NULL,
  "target"          text,
  "weight_percent"  integer NOT NULL,
  "source_version"  text    NOT NULL DEFAULT 'V3.1'::text,
  CONSTRAINT "d4_kpi_role_catalog_indicator_order_check" CHECK (((indicator_order >= 1) AND (indicator_order <= 5))),
  CONSTRAINT "d4_kpi_role_catalog_pkey" PRIMARY KEY (role_order, indicator_order),
  CONSTRAINT "d4_kpi_role_catalog_role_name_kpi_name_key" UNIQUE (role_name, kpi_name),
  CONSTRAINT "d4_kpi_role_catalog_role_order_check" CHECK (((role_order >= 1) AND (role_order <= 10))),
  CONSTRAINT "d4_kpi_role_catalog_weight_percent_check" CHECK (((weight_percent >= 1) AND (weight_percent <= 100)))
);

ALTER TABLE "public"."d4_kpi_role_catalog"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read KPI role catalog" ON "public"."d4_kpi_role_catalog"
  FOR SELECT
  TO "authenticated"
  USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_kpi_role_catalog" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_kpi_role_catalog" TO "service_role";

REVOKE ALL ON TABLE "public"."d4_kpi_role_catalog" FROM "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_kpi_role_catalog" TO "anon";

REVOKE ALL ON TABLE "public"."d4_kpi_role_catalog" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_kpi_role_catalog" TO "postgres";
