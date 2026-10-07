CREATE TABLE "public"."d3_feedback_reward_audit_log" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "entity_type"        text                     NOT NULL,
  "entity_id"          bigint                   NOT NULL,
  "target_employee_id" uuid                     NOT NULL,
  "action"             text                     NOT NULL,
  "actor_auth_user_id" uuid,
  "actor_employee_id"  uuid,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "d3_feedback_reward_audit_log_action_check" CHECK ((action = 'CREATE'::text)),
  CONSTRAINT "d3_feedback_reward_audit_log_actor_employee_id_fkey" FOREIGN KEY (actor_employee_id) REFERENCES public.d3_employee(id) ON DELETE SET NULL,
  CONSTRAINT "d3_feedback_reward_audit_log_entity_type_check" CHECK ((entity_type = ANY (ARRAY['FEEDBACK'::text, 'REWARD'::text]))),
  CONSTRAINT "d3_feedback_reward_audit_log_pkey" PRIMARY KEY (id),
  CONSTRAINT "d3_feedback_reward_audit_log_target_employee_id_fkey" FOREIGN KEY (target_employee_id) REFERENCES public.d3_employee(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."d3_feedback_reward_audit_log"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "D3 HR reads all feedback reward audit" ON "public"."d3_feedback_reward_audit_log"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT public.d3_current_role() AS d3_current_role) = 'HR'::public.d3_app_role));

CREATE POLICY "D3 manager reads subordinate feedback reward audit" ON "public"."d3_feedback_reward_audit_log"
  FOR SELECT
  TO "authenticated"
  USING (((( SELECT public.d3_current_role() AS d3_current_role) = 'MANAGER'::public.d3_app_role) AND public.d3_is_my_subordinate(target_employee_id)));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_feedback_reward_audit_log" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_feedback_reward_audit_log" FROM "authenticated";

GRANT SELECT ON TABLE "public"."d3_feedback_reward_audit_log" TO "authenticated";

REVOKE ALL ON TABLE "public"."d3_feedback_reward_audit_log" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_feedback_reward_audit_log" TO "postgres";

REVOKE ALL ON TABLE "public"."d3_feedback_reward_audit_log" FROM "anon";
