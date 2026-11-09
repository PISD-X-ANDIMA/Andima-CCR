CREATE VIEW "public"."view_employee_360" WITH (security_invoker=true) AS  SELECT e.id,
    e.employee_id,
    e.full_name,
    e.email,
    e.phone,
    e.join_date,
    e.employment_status,
    e.work_location,
    p.title AS position_title,
    d.name AS department_name,
    EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (e.join_date)::timestamp with time zone)) AS tenure_years,
    EXTRACT(month FROM age((CURRENT_DATE)::timestamp with time zone, (e.join_date)::timestamp with time zone)) AS tenure_months,
        CASE
            WHEN (e.join_date > (CURRENT_DATE - '1 year'::interval)) THEN true
            ELSE false
        END AS is_under_one_year_tenure
   FROM ((public.d3_employee e
     JOIN public.d3_positions p ON ((e.position_id = p.id)))
     JOIN public.d3_departments d ON ((e.department_id = d.id)));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."view_employee_360" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."view_employee_360" TO "service_role";

REVOKE ALL ON TABLE "public"."view_employee_360" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."view_employee_360" TO "postgres";

REVOKE ALL ON TABLE "public"."view_employee_360" FROM "anon";
