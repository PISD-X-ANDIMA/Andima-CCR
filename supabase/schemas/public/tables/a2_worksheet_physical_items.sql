CREATE TABLE "public"."a2_worksheet_physical_items" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "worksheet_id" bigint                   NOT NULL,
  "item_label"   text                     NOT NULL,
  "item_value"   text                     NOT NULL,
  "item_unit"    text,
  "sort_order"   smallint                 NOT NULL DEFAULT 0,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "a2_worksheet_physical_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "a2_worksheet_physical_items_worksheet_id_fkey" FOREIGN KEY (worksheet_id) REFERENCES public.a2_worksheets(worksheet_id) ON DELETE CASCADE
);

CREATE INDEX idx_a2_ws_physical_wsid ON public.a2_worksheet_physical_items USING btree (worksheet_id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_worksheet_physical_items" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_worksheet_physical_items" TO "service_role";

REVOKE ALL ON TABLE "public"."a2_worksheet_physical_items" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_worksheet_physical_items" TO "postgres";
