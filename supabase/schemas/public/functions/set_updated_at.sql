CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO PUBLIC;

REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM "anon", "authenticated", "service_role";
