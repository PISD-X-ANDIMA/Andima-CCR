CREATE TABLE "public"."feedback_rewards" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "receiver_id" uuid                     NOT NULL,
  "sender_id"   uuid,
  "type"        character varying(20)    NOT NULL,
  "category"    character varying(50)    NOT NULL,
  "title"       character varying(200)   NOT NULL,
  "message"     text                     NOT NULL,
  "points"      integer                  DEFAULT 0,
  "created_at"  timestamp with time zone DEFAULT now(),
  CONSTRAINT "feedback_rewards_pkey" PRIMARY KEY (id),
  CONSTRAINT "feedback_rewards_receiver_id_fkey" FOREIGN KEY (receiver_id) REFERENCES public.d3_employee(id) ON DELETE RESTRICT,
  CONSTRAINT "feedback_rewards_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES public.d3_employee(id) ON DELETE SET NULL,
  CONSTRAINT "feedback_rewards_type_check" CHECK (((type)::text = ANY ((ARRAY['FEEDBACK'::character varying, 'REWARD'::character varying])::text[])))
);

ALTER TABLE "public"."feedback_rewards"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "D3 feedback rewards select v1" ON "public"."feedback_rewards"
  FOR SELECT
  TO "authenticated"
  USING
    (((public.d3_current_role() = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) OR (receiver_id = public.d3_current_employee_uuid()) OR (sender_id =
    public.d3_current_employee_uuid())));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."feedback_rewards" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."feedback_rewards" TO "service_role";

REVOKE ALL ON TABLE "public"."feedback_rewards" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."feedback_rewards" TO "postgres";

REVOKE ALL ON TABLE "public"."feedback_rewards" FROM "anon";
