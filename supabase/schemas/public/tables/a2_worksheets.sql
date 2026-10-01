CREATE TABLE "public"."a2_worksheets" (
  "worksheet_id"       bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "transaction_no"     character varying(20)    NOT NULL,
  "job_no"             character varying(30)    NOT NULL,
  "customer_id"        uuid                     NOT NULL,
  "created_by_user_id" bigint,
  "create_date"        date                     NOT NULL DEFAULT CURRENT_DATE,
  "status_kendala"     character varying(30)    DEFAULT 'normal'::character varying,
  "field_agent_id"     uuid,
  "sales_pic_id"       uuid,
  "shipper"            text,
  "consignee"          text,
  "mawb"               character varying(50),
  "hawb"               character varying(50),
  "handover_datetime"  timestamp with time zone,
  "handover_location"  text,
  "pihak_penyerah"     text,
  "pihak_penerima"     text,
  "is_dangerous_goods" boolean                  NOT NULL DEFAULT false,
  "special_handling"   text,
  "has_issue"          boolean                  NOT NULL DEFAULT false,
  "issue_note"         text,
  "is_exported_pdf"    boolean                  NOT NULL DEFAULT false,
  "updated_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "conversation_id"    uuid,
  CONSTRAINT "a2_worksheets_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.a2_record_conversations(id) ON DELETE SET NULL,
  CONSTRAINT "a2_worksheets_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.a1_company_list(company_list_id),
  CONSTRAINT "a2_worksheets_pkey" PRIMARY KEY (worksheet_id),
  CONSTRAINT "a2_worksheets_status_kendala_check" CHECK (((status_kendala)::text = ANY ((ARRAY['normal'::character varying, 'kendala_terdeteksi'::character varying])::text[]))),
  CONSTRAINT "a2_worksheets_field_agent_id_fkey" FOREIGN KEY (field_agent_id) REFERENCES public.d3_employee(id),
  CONSTRAINT "a2_worksheets_sales_pic_id_fkey" FOREIGN KEY (sales_pic_id) REFERENCES public.d3_employee(id)
);

CREATE INDEX idx_a2_worksheets_kendala ON public.a2_worksheets USING btree (status_kendala);

CREATE TRIGGER trg_a2_worksheets_updated_at
  BEFORE UPDATE ON public.a2_worksheets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_worksheets" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_worksheets" TO "service_role";

REVOKE ALL ON TABLE "public"."a2_worksheets" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_worksheets" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."a2_worksheets_worksheet_id_seq" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."a2_worksheets_worksheet_id_seq" FROM "authenticated";

REVOKE ALL ON SEQUENCE "public"."a2_worksheets_worksheet_id_seq" FROM "service_role";
