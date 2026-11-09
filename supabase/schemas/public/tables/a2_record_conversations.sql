CREATE TABLE "public"."a2_record_conversations" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "job_number"        character varying(50),
  "customer_id"       uuid                     NOT NULL,
  "customer_code"     character varying(50),
  "sales_pic_id"      uuid                     NOT NULL,
  "channel_type"      character varying(20)    NOT NULL,
  "conversation_date" date                     NOT NULL DEFAULT CURRENT_DATE,
  "summary"           text                     NOT NULL,
  "need_assistance"   boolean                  NOT NULL DEFAULT false,
  "urgency_level"     character varying(20),
  "synced_to_ctrack"  boolean                  NOT NULL DEFAULT true,
  "document_urls"     text[],
  "status"            character varying(20)    NOT NULL DEFAULT 'active'::character varying,
  "created_by"        uuid                     NOT NULL,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "a2_record_conversations_channel_type_check" CHECK (((channel_type)::text = ANY ((ARRAY['WhatsApp'::character varying, 'Meeting'::character varying])::text[]))),
  CONSTRAINT "a2_record_conversations_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.a1_company_list(company_list_id),
  CONSTRAINT "a2_record_conversations_pkey" PRIMARY KEY (id),
  CONSTRAINT "a2_record_conversations_status_check" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'archived'::character varying])::text[]))),
  CONSTRAINT "a2_record_conversations_urgency_level_check"
    CHECK
    (((urgency_level)::text = ANY ((ARRAY['high_priority'::character varying, 'average'::character varying, 'critical'::character varying, 'standard'::character
    varying])::text[]))),
  CONSTRAINT "a2_record_conversations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.d3_employee(id),
  CONSTRAINT "a2_record_conversations_sales_pic_id_fkey" FOREIGN KEY (sales_pic_id) REFERENCES public.d3_employee(id)
);

CREATE INDEX idx_a2_record_conv_assist ON public.a2_record_conversations USING btree (need_assistance);

CREATE INDEX idx_a2_record_conv_cust ON public.a2_record_conversations USING btree (customer_id, conversation_date DESC);

CREATE INDEX idx_a2_record_conv_pic ON public.a2_record_conversations USING btree (sales_pic_id);

CREATE TRIGGER trg_a2_record_conv_updated_at
  BEFORE UPDATE ON public.a2_record_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_record_conversations" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_record_conversations" TO "service_role";

REVOKE ALL ON TABLE "public"."a2_record_conversations" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."a2_record_conversations" TO "postgres";
