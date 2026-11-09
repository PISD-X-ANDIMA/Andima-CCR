CREATE OR REPLACE FUNCTION public.d4_calculate_kpi_assessment()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  role_title text;
  indicator_count integer;
  total_weight integer;
  template_name text;
  template_weight integer;
  line jsonb;
  raw_score integer;
  weighted_total numeric := 0;
  all_scored boolean := true;
  item integer;
begin
  select min(role_name), count(*), sum(weight_percent)
    into role_title, indicator_count, total_weight
    from public.d4_kpi_role_catalog where role_order = new.role_order;
  if indicator_count <> 5 or total_weight <> 100 or new.role_name is distinct from role_title then
    raise exception 'Jabatan KPI dan total bobot harus sesuai katalog V3.1';
  end if;

  for item in 1..5 loop
    select kpi_name, weight_percent into template_name, template_weight
      from public.d4_kpi_role_catalog
      where role_order = new.role_order and indicator_order = item;
    line := new.lines -> (item - 1);
    if line->>'indicator_order' is distinct from item::text
       or line->>'kpi_name' is distinct from template_name
       or line->>'weight_percent' is distinct from template_weight::text then
      raise exception 'Indikator % harus sesuai katalog KPI V3.1', item;
    end if;
    if line->>'raw_score' is null or line->>'raw_score' = '' then
      all_scored := false;
    else
      raw_score := (line->>'raw_score')::integer;
      if raw_score < 1 or raw_score > 5 then
        raise exception 'Skor indikator % harus antara 1 dan 5', item;
      end if;
      weighted_total := weighted_total + template_weight * raw_score / 100.0;
    end if;
  end loop;

  if new.status = 'completed' and not all_scored then
    raise exception 'Seluruh lima indikator harus dinilai sebelum diselesaikan';
  end if;
  new.overall_score := case when all_scored then round(weighted_total, 2) else null end;
  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."d4_calculate_kpi_assessment"() TO PUBLIC;

REVOKE ALL ON FUNCTION "public"."d4_calculate_kpi_assessment"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."d4_calculate_kpi_assessment"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."d4_calculate_kpi_assessment"() FROM "anon", "authenticated", "service_role";
