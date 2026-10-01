CREATE TABLE "public"."handovers" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "job_id"              uuid                     NOT NULL,
  "agent_id"            uuid,
  "sender_name"         character varying(255)   NOT NULL,
  "receiver_name"       character varying(255)   NOT NULL,
  "actual_pieces"       integer                  NOT NULL,
  "actual_gross_weight" numeric(10,2)            NOT NULL,
  "latitude"            numeric(10,7),
  "longitude"           numeric(10,7),
  "notes"               text,
  "created_at"          timestamp with time zone DEFAULT now(),
  CONSTRAINT "handovers_pkey" PRIMARY KEY (id),
  CONSTRAINT "handovers_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE
);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."handovers" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."handovers" TO "service_role";

REVOKE ALL ON TABLE "public"."handovers" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."handovers" TO "postgres";
