-- Finalize status and aggregation atomically: failed uploads never contribute to charts.
create or replace function public.finalize_c1_document_upload(p_document_id uuid, p_row_count integer)
returns void language plpgsql security definer set search_path = public as $$
begin
 if not exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role = 'HR') then
   raise exception 'Upload access denied';
 end if;
 perform pg_advisory_xact_lock(610060002);
 update public.c1_document_uploads
 set validation_status = 'validated', processed_at = now(), row_count = p_row_count,
     valid_row_count = p_row_count, invalid_row_count = 0
 where id = p_document_id and uploader_user_id = auth.uid() and validation_status = 'processing';
 if not found then raise exception 'Document cannot be finalized'; end if;
 perform public.refresh_c1_macro_metrics();
end; $$;
revoke all on function public.finalize_c1_document_upload(uuid,integer) from public, anon;
grant execute on function public.finalize_c1_document_upload(uuid,integer) to authenticated;
