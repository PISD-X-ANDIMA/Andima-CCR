CREATE TABLE "public"."c2_cost_transactions" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "job_number"            character varying(50)    NOT NULL,
  "customer_name"         character varying(255)   NOT NULL,
  "branch_code"           character varying(50)    DEFAULT 'Jakarta Pusat'::character varying,
  "cost_category"         character varying(50)    NOT NULL,
  "period_month"          character varying(20)    DEFAULT 'September 2026'::character varying,
  "planned_cost"          numeric(15,2)            DEFAULT 0.00,
  "actual_cost"           numeric(15,2)            DEFAULT 0.00,
  "has_evidence"          boolean                  DEFAULT false,
  "evidence_url"          text,
  "reconciliation_result" character varying(30)    DEFAULT 'MATCH'::character varying,
  "review_flag"           boolean                  DEFAULT false,
  "exception_tags"        text[]                   DEFAULT '{}'::text[],
  "voucher_no"            character varying(50),
  "description"           text,
  "created_at"            timestamp with time zone DEFAULT now(),
  "updated_at"            timestamp with time zone DEFAULT now(),
  CONSTRAINT "c2_cost_transactions_actual_cost_check" CHECK ((actual_cost >= (0)::numeric)),
  CONSTRAINT "c2_cost_transactions_cost_category_check"
    CHECK
    (((cost_category)::text = ANY ((ARRAY['TRUCKING'::character varying, 'HANDLING'::character varying, 'STORAGE'::character varying, 'OTHER_OPERATIONAL'::character
    varying])::text[]))),
  CONSTRAINT "c2_cost_transactions_pkey" PRIMARY KEY (id),
  CONSTRAINT "c2_cost_transactions_planned_cost_check" CHECK ((planned_cost >= (0)::numeric)),
  CONSTRAINT "c2_cost_transactions_reconciliation_result_check"
    CHECK
    (((reconciliation_result)::text = ANY ((ARRAY['MATCH'::character varying, 'OVER'::character varying, 'UNDER'::character varying, 'JOB_NOT_FOUND'::character varying])::text[])))
);

ALTER TABLE "public"."c2_cost_transactions"
  ADD COLUMN "variance" numeric(15,2) GENERATED ALWAYS AS ((actual_cost - planned_cost)) STORED;

CREATE INDEX idx_c2_cost_customer ON public.c2_cost_transactions USING btree (customer_name);

CREATE INDEX idx_c2_cost_job_number ON public.c2_cost_transactions USING btree (job_number);

CREATE INDEX idx_c2_cost_review_flag ON public.c2_cost_transactions USING btree (review_flag)
  WHERE (review_flag = true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."c2_cost_transactions" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."c2_cost_transactions" TO "service_role";

REVOKE ALL ON TABLE "public"."c2_cost_transactions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."c2_cost_transactions" TO "postgres";
