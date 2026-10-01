CREATE VIEW "public"."d3_view_employee_360" WITH (security_invoker=true) AS  SELECT e.id,
    e.employee_id,
    e.full_name,
    e.email,
    e.phone,
    e.identity_type,
    e.identity_number,
    e.join_date,
    e.employment_status,
    e.work_location,
    e.position_id,
    p.title AS position_title,
    e.department_id,
    d.name AS department_name,
    (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (e.join_date)::timestamp with time zone)))::integer AS tenure_years,
    (EXTRACT(month FROM age((CURRENT_DATE)::timestamp with time zone, (e.join_date)::timestamp with time zone)))::integer AS tenure_months
   FROM ((public.d3_employee e
     JOIN public.d3_positions p ON ((p.id = e.position_id)))
     JOIN public.d3_departments d ON ((d.id = e.department_id)));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_view_employee_360" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_view_employee_360" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_view_employee_360" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_view_employee_360" TO "postgres";

REVOKE ALL ON TABLE "public"."d3_view_employee_360" FROM "anon";
