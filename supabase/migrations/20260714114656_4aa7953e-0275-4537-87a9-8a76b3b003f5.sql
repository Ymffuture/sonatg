
-- chat-media path convention: <chat_id>/<user_id>/<filename>
create policy "chat media read for members" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and public.is_chat_member((split_part(name,'/',1))::uuid, auth.uid()));
create policy "chat media upload by member self" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media'
    and public.is_chat_member((split_part(name,'/',1))::uuid, auth.uid())
    and (split_part(name,'/',2))::uuid = auth.uid());
create policy "chat media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media' and (split_part(name,'/',2))::uuid = auth.uid());
