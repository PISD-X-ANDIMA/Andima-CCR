CREATE TABLE "public"."d4_figma_demo_trend" (
  "quarter"         text         NOT NULL,
  "sort_order"      integer      NOT NULL,
  "performance_avg" numeric(4,2) NOT NULL,
  "kpi_avg"         numeric(4,2) NOT NULL,
  CONSTRAINT "d4_figma_demo_trend_pkey" PRIMARY KEY (quarter),
  CONSTRAINT "d4_figma_demo_trend_quarter_check" CHECK ((quarter = ANY (ARRAY['Q1'::text, 'Q2'::text, 'Q3'::text, 'Q4'::text]))),
  CONSTRAINT "d4_figma_demo_trend_sort_order_key" UNIQUE (sort_order)
);

ALTER TABLE "public"."d4_figma_demo_trend"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read only Figma demo trend" ON "public"."d4_figma_demo_trend"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_figma_demo_trend" TO "service_role";

REVOKE ALL ON TABLE "public"."d4_figma_demo_trend" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_figma_demo_trend" TO "postgres";

REVOKE ALL ON TABLE "public"."d4_figma_demo_trend" FROM "anon", "authenticated";
