CREATE TABLE "public"."jobs" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "job_number"           character varying(50)    NOT NULL,
  "sales_id"             uuid,
  "customer_id"          uuid,
  "customer_name"        character varying(255)   NOT NULL,
  "shipper_name"         character varying(255),
  "consignee_name"       character varying(255),
  "mawb_hawb"            character varying(100),
  "planned_pieces"       integer                  DEFAULT 0,
  "planned_gross_weight" numeric(10,2)            DEFAULT 0.00,
  "delivery_location"    text,
  "planned_date_time"    timestamp with time zone,
  "has_issue"            boolean                  DEFAULT false,
  "created_at"           timestamp with time zone DEFAULT now(),
  "updated_at"           timestamp with time zone DEFAULT now(),
  CONSTRAINT "jobs_job_number_key" UNIQUE (job_number),
  CONSTRAINT "jobs_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."jobs"
  ADD COLUMN "status" public.job_status_enum DEFAULT 'Draft'::public.job_status_enum;

ALTER TABLE "public"."jobs"
  ADD COLUMN "job_type" public.job_type_enum DEFAULT 'Delivery'::public.job_type_enum;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."jobs" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."jobs" TO "service_role";

REVOKE ALL ON TABLE "public"."jobs" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."jobs" TO "postgres";
