create policy "Users remove own c1 documents"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'c1-document-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);
