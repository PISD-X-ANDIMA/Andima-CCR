-- Prevent legacy B1 refresh triggers from rebuilding projections during reset.

create or replace function public.reset_c1_sales_overview_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  deleted_documents integer;
  deleted_customers integer;
  deleted_board_rows integer;
begin
  set local session_replication_role = replica;
  delete from public.b1_salesperform_board;
  get diagnostics deleted_board_rows = row_count;
  delete from public.c1_document_validation_errors;
  delete from public.c1_company_sales_staging_rows;
  delete from public.c1_outstanding_staging_rows;
  delete from public.c1_assignment;
  delete from public.c1_mid_feed;
  delete from public.c1_overdue_alert;
  delete from public.c1_macro_metric;
  delete from public.c1_customer where source_type = 'UPLOAD';
  get diagnostics deleted_customers = row_count;
  delete from public.c1_document_uploads;
  get diagnostics deleted_documents = row_count;

  return jsonb_build_object(
    'deleted_documents', deleted_documents,
    'deleted_uploaded_customers', deleted_customers,
    'deleted_board_rows', deleted_board_rows
  );
end;
$function$;

revoke all on function public.reset_c1_sales_overview_data() from public, anon, authenticated;
grant execute on function public.reset_c1_sales_overview_data() to service_role;

notify pgrst, 'reload schema';
