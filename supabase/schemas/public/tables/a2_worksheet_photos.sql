CREATE TABLE "public"."a2_worksheet_photos" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "worksheet_id" bigint                   NOT NULL,
  "photo_label"  text                     NOT NULL,
  "photo_status" text                     NOT NULL,
  "photo_url"    text,
  "file_name"    text,
  "taken_at"     timestamp with time zone,
  "is_verified"  boolean                  NOT NULL DEFAULT false,
  "sort_order"   smallint                 NOT NULL DEFAULT 0,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "a2_worksheet_photos_pkey" PRIMARY KEY (id),
  CONSTRAINT "a2_worksheet_photos_worksheet_id_fkey" FOREIGN KEY (worksheet_id) REFERENCES public.a2_worksheets(worksheet_id) ON DELETE CASCADE
);

CREATE INDEX idx_a2_ws_photos_wsid ON public.a2_worksheet_photos USING btree (worksheet_id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_worksheet_photos" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_worksheet_photos" TO "service_role";

REVOKE ALL ON TABLE "public"."a2_worksheet_photos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_worksheet_photos" TO "postgres";
