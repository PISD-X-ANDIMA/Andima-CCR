CREATE VIEW "public"."view_employee_certifications" WITH (security_invoker=true) AS  SELECT id,
    employee_id,
    title,
    issuing_organization,
    issue_date,
    expiry_date,
    credential_id,
    created_at,
        CASE
            WHEN (expiry_date IS NULL) THEN 'VALID'::text
            WHEN (expiry_date < CURRENT_DATE) THEN 'EXPIRED'::text
            WHEN (expiry_date <= (CURRENT_DATE + '60 days'::interval)) THEN 'EXPIRING'::text
            ELSE 'VALID'::text
        END AS status
   FROM public.d3_employee_certifications ec;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."view_employee_certifications" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."view_employee_certifications" TO "service_role";

REVOKE ALL ON TABLE "public"."view_employee_certifications" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."view_employee_certifications" TO "postgres";

REVOKE ALL ON TABLE "public"."view_employee_certifications" FROM "anon";
