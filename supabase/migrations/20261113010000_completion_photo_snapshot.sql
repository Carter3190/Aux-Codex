begin;

-- Storage's JavaScript response represents timestamps in milliseconds. Read
-- the database value as text before downloading so verification retains every
-- microsecond and can still reject an object changed during the byte check.
create or replace function public.get_booking_completion_photo_snapshot(
  requested_booking_id uuid, requested_provider_id uuid,
  requested_storage_path text, requested_object_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  selected_object record;
begin
  if not private.valid_completion_photo_path(requested_storage_path)
    or split_part(requested_storage_path,'/',1) <> requested_provider_id::text
    or split_part(requested_storage_path,'/',2) <> requested_booking_id::text
    or not exists (select 1 from public.booking_requests b join public.profiles p on p.id=b.provider_id
      where b.id=requested_booking_id and b.provider_id=requested_provider_id and b.status='accepted' and p.role='provider') then
    raise exception 'The completion photo does not belong to this accepted booking.';
  end if;
  select id,updated_at,metadata into selected_object from storage.objects
    where id=requested_object_id and bucket_id='booking-completion-photos' and name=requested_storage_path;
  if not found then
    raise exception 'The completion photo upload could not be verified. Upload it again.';
  end if;
  return jsonb_build_object(
    'id',selected_object.id,
    'updated_at',selected_object.updated_at::text,
    'content_type',selected_object.metadata->>'mimetype',
    'byte_size',selected_object.metadata->'size'
  );
end;
$$;
revoke all on function public.get_booking_completion_photo_snapshot(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.get_booking_completion_photo_snapshot(uuid,uuid,text,uuid) to service_role;

notify pgrst, 'reload schema';
commit;
