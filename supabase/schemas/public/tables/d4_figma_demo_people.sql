CREATE TABLE "public"."d4_figma_demo_people" (
  "employee_code"      text                     NOT NULL,
  "full_name"          text                     NOT NULL,
  "position_title"     text                     NOT NULL,
  "department_name"    text                     NOT NULL,
  "sort_order"         integer                  NOT NULL,
  "performance_score"  numeric(4,2),
  "kpi_score"          integer,
  "review_status"      text,
  "evaluation_comment" text                     NOT NULL DEFAULT ''::text,
  "aspects"            jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "scorecard"          jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "competency"         jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "training"           jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "d4_figma_demo_people_aspects_array" CHECK ((jsonb_typeof(aspects) = 'array'::text)),
  CONSTRAINT "d4_figma_demo_people_pkey" PRIMARY KEY (employee_code),
  CONSTRAINT "d4_figma_demo_people_scorecard_array" CHECK ((jsonb_typeof(scorecard) = 'array'::text)),
  CONSTRAINT "d4_figma_demo_people_sort_order_key" UNIQUE (sort_order),
  CONSTRAINT "d4_figma_demo_people_status_check" CHECK (((review_status IS NULL) OR (review_status = ANY (ARRAY['Needs Review'::text, 'On Track'::text, 'Needs Attention'::text]))))
);

ALTER TABLE "public"."d4_figma_demo_people"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read only Figma demo" ON "public"."d4_figma_demo_people"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_figma_demo_people" TO "service_role";

REVOKE ALL ON TABLE "public"."d4_figma_demo_people" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_figma_demo_people" TO "postgres";

REVOKE ALL ON TABLE "public"."d4_figma_demo_people" FROM "anon", "authenticated";
