CREATE TABLE "public"."d4_training_versions" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "training_id"        uuid                     NOT NULL,
  "revision"           integer                  NOT NULL,
  "status"             character varying(16)    NOT NULL,
  "result"             text                     NOT NULL DEFAULT ''::text,
  "notes"              text                     NOT NULL DEFAULT ''::text,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "d4_training_versions_check" CHECK ((((status)::text <> 'Completed'::text) OR (length(btrim(result)) > 0))),
  CONSTRAINT "d4_training_versions_pkey" PRIMARY KEY (id),
  CONSTRAINT "d4_training_versions_revision_check" CHECK ((revision >= 1)),
  CONSTRAINT "d4_training_versions_status_check"
    CHECK
    (((status)::text = ANY ((ARRAY['Planned'::character varying, 'In Progress'::character varying, 'Completed'::character varying, 'Cancelled'::character varying])::text[]))),
  CONSTRAINT "d4_training_versions_training_id_fkey" FOREIGN KEY (training_id) REFERENCES public.d4_training_records(id),
  CONSTRAINT "d4_training_versions_training_id_revision_key" UNIQUE (training_id, revision),
  "actor_auth_user_id" uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "d4_training_versions_actor_auth_user_id_fkey" FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id)
);

ALTER TABLE "public"."d4_training_versions"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX d4_training_versions_training_idx ON public.d4_training_versions USING btree (training_id, revision DESC);

CREATE POLICY "D4 training history read permitted employee" ON "public"."d4_training_versions"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.d4_training_records t
  WHERE (t.id = d4_training_versions.training_id))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_training_versions" TO "service_role";

ALTER TABLE "public"."d4_training_versions"
  ADD COLUMN "actor_employee_id" uuid NOT NULL DEFAULT public.d3_current_employee_uuid();

ALTER TABLE "public"."d4_training_versions"
  ADD CONSTRAINT "d4_training_versions_actor_employee_id_fkey" FOREIGN KEY (actor_employee_id) REFERENCES public.d3_employee(id);

CREATE POLICY "D4 training history insert HR manager" ON "public"."d4_training_versions"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((( SELECT public.d3_current_role() AS d3_current_role) = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) AND (actor_auth_user_id = ( SELECT auth.uid()
    AS uid)) AND (actor_employee_id = ( SELECT public.d3_current_employee_uuid() AS d3_current_employee_uuid)) AND (EXISTS ( SELECT 1
   FROM public.d4_training_records t
  WHERE (t.id = d4_training_versions.training_id)))));

REVOKE ALL ON TABLE "public"."d4_training_versions" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."d4_training_versions" TO "authenticated";

REVOKE ALL ON TABLE "public"."d4_training_versions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_training_versions" TO "postgres";

REVOKE ALL ON TABLE "public"."d4_training_versions" FROM "anon";
