-- Optional completion evidence. No charge, payout, price or completion-date
-- behavior changes. Files are private and immutable after a visit is complete.
begin;
set local lock_timeout = '5s';

create table if not exists public.booking_completion_photos (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_requests(id) on delete restrict,
  storage_object_id uuid not null unique references storage.objects(id) on delete restrict,
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  byte_size integer not null check (byte_size between 1 and 5242880),
  position smallint not null check (position between 0 and 4),
  created_at timestamptz not null default now(),
  unique (booking_id, position)
);
create index if not exists booking_completion_photos_booking_idx on public.booking_completion_photos(booking_id);
alter table public.booking_completion_photos enable row level security;
revoke all on public.booking_completion_photos from anon, authenticated;
grant select on public.booking_completion_photos to authenticated;
grant all on public.booking_completion_photos to service_role;

-- Only trusted server code may attest to the actual downloaded image bytes.
-- The object ID and update timestamp prevent delete/re-upload and replacement
-- races from reusing an earlier byte validation for a different object.
create table if not exists private.booking_completion_photo_verifications (
  storage_object_id uuid primary key references storage.objects(id) on delete cascade,
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  object_updated_at timestamptz,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  byte_size integer not null check (byte_size between 1 and 5242880),
  verified_at timestamptz not null default now()
);
alter table private.booking_completion_photo_verifications enable row level security;
revoke all on private.booking_completion_photo_verifications from public, anon, authenticated;
grant all on private.booking_completion_photo_verifications to service_role;

create or replace function private.valid_completion_photo_path(object_name text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$', false)
$$;

create or replace function private.can_upload_completion_photo(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.valid_completion_photo_path(object_name)
    and split_part(object_name, '/', 1) = (select auth.uid())::text
    and exists (
      select 1 from public.booking_requests b join public.profiles p on p.id = b.provider_id
      where b.id::text = split_part(object_name, '/', 2)
        and b.provider_id = (select auth.uid()) and p.role = 'provider' and b.status = 'accepted'
    )
$$;

create or replace function private.can_read_completion_booking(requested_booking_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.booking_requests b
    where b.id = requested_booking_id and b.status = 'completed'
      and (b.customer_id = (select auth.uid()) or b.provider_id = (select auth.uid()) or (select private.is_admin())))
$$;

create or replace function private.can_read_completion_photo(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_upload_completion_photo(object_name)
    or exists (select 1 from public.booking_completion_photos p
      where p.storage_path = object_name and private.can_read_completion_booking(p.booking_id))
$$;

create or replace function private.can_delete_completion_photo(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_upload_completion_photo(object_name)
    and not exists (select 1 from public.booking_completion_photos p where p.storage_path = object_name)
$$;

revoke all on function private.valid_completion_photo_path(text), private.can_upload_completion_photo(text),
  private.can_read_completion_booking(uuid), private.can_read_completion_photo(text), private.can_delete_completion_photo(text) from public;
grant usage on schema private to authenticated, service_role;
grant execute on function private.valid_completion_photo_path(text), private.can_upload_completion_photo(text),
  private.can_read_completion_booking(uuid), private.can_read_completion_photo(text), private.can_delete_completion_photo(text) to authenticated;

drop policy if exists "Booking participants read completion photos" on public.booking_completion_photos;
create policy "Booking participants read completion photos" on public.booking_completion_photos for select to authenticated
  using (private.can_read_completion_booking(booking_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('booking-completion-photos','booking-completion-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Providers upload completion drafts" on storage.objects;
create policy "Providers upload completion drafts" on storage.objects for insert to authenticated
  with check (bucket_id='booking-completion-photos' and private.can_upload_completion_photo(name));
drop policy if exists "Participants read private completion images" on storage.objects;
create policy "Participants read private completion images" on storage.objects for select to authenticated
  using (bucket_id='booking-completion-photos' and private.can_read_completion_photo(name));
drop policy if exists "Providers remove unattached completion drafts" on storage.objects;
create policy "Providers remove unattached completion drafts" on storage.objects for delete to authenticated
  using (bucket_id='booking-completion-photos' and private.can_delete_completion_photo(name));
-- Deliberately no UPDATE policy: neither upsert nor metadata replacement may
-- invalidate image verification or rewrite evidence after completion.

create or replace function public.record_booking_completion_photo_verification(
  requested_booking_id uuid, requested_provider_id uuid, requested_storage_path text,
  requested_object_id uuid, requested_object_updated_at timestamptz,
  verified_content_type text, verified_byte_size integer
)
returns void language plpgsql security definer set search_path = '' as $$
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
  select id,updated_at,metadata,name into selected_object from storage.objects
    where id=requested_object_id and bucket_id='booking-completion-photos' and name=requested_storage_path for share;
  if not found or selected_object.updated_at is distinct from requested_object_updated_at
    or verified_content_type not in ('image/jpeg','image/png','image/webp')
    or verified_byte_size is null or verified_byte_size not between 1 and 5242880
    or coalesce(selected_object.metadata->>'mimetype','') <> verified_content_type
    or not coalesce(selected_object.metadata->>'size','') ~ '^[0-9]+$' then
    raise exception 'The completion photo upload could not be verified. Upload it again.';
  end if;
  if (selected_object.metadata->>'size')::numeric <> verified_byte_size then
    raise exception 'The completion photo upload size changed. Upload it again.';
  end if;
  insert into private.booking_completion_photo_verifications(storage_object_id,booking_id,provider_id,storage_path,object_updated_at,content_type,byte_size,verified_at)
    values(requested_object_id,requested_booking_id,requested_provider_id,requested_storage_path,requested_object_updated_at,verified_content_type,verified_byte_size,now())
  on conflict(storage_object_id) do update set object_updated_at=excluded.object_updated_at,content_type=excluded.content_type,byte_size=excluded.byte_size,verified_at=now();
end;
$$;
revoke all on function public.record_booking_completion_photo_verification(uuid,uuid,text,uuid,timestamptz,text,integer) from public,anon,authenticated;
grant execute on function public.record_booking_completion_photo_verification(uuid,uuid,text,uuid,timestamptz,text,integer) to service_role;

create or replace function public.complete_booking_with_photos(
  requested_booking_id uuid, requested_photo_paths text[] default '{}'
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  current_provider_id uuid := (select auth.uid());
  selected_booking record;
  photo_path text;
  photo_position integer := 0;
  verified_photo record;
  existing_paths text[];
begin
  if not exists(select 1 from public.profiles where id=current_provider_id and role='provider') then
    raise exception 'Only provider accounts can mark a booking complete.';
  end if;
  select id,status into selected_booking from public.booking_requests
    where id=requested_booking_id and provider_id=current_provider_id for update;
  if not found then raise exception 'Booking request not found.'; end if;
  if requested_photo_paths is null or cardinality(requested_photo_paths)>5
    or cardinality(requested_photo_paths) <> (select count(distinct item) from unnest(requested_photo_paths) as item)
    or array_position(requested_photo_paths,null) is not null then
    raise exception 'Choose up to five different completion photos.';
  end if;
  if selected_booking.status='completed' then
    select coalesce(array_agg(storage_path order by position),'{}') into existing_paths
      from public.booking_completion_photos where booking_id=requested_booking_id;
    if cardinality(requested_photo_paths)>0 and requested_photo_paths is distinct from existing_paths then
      raise exception 'Completion photos cannot be changed after the visit is complete.';
    end if;
    return false;
  end if;
  if selected_booking.status <> 'accepted' then raise exception 'Only accepted bookings can be marked complete.'; end if;
  foreach photo_path in array requested_photo_paths loop
    if not private.valid_completion_photo_path(photo_path)
      or split_part(photo_path,'/',1) <> current_provider_id::text
      or split_part(photo_path,'/',2) <> requested_booking_id::text then
      raise exception 'The completion photo does not belong to this booking.';
    end if;
    select v.storage_object_id,v.content_type,v.byte_size into verified_photo
      from private.booking_completion_photo_verifications v join storage.objects o on o.id=v.storage_object_id
      where v.storage_path=photo_path and v.booking_id=requested_booking_id and v.provider_id=current_provider_id
        and v.verified_at > now()-interval '15 minutes'
        and o.bucket_id='booking-completion-photos' and o.name=photo_path
        and o.updated_at is not distinct from v.object_updated_at
        and coalesce(o.metadata->>'mimetype','')=v.content_type
        and coalesce(o.metadata->>'size','')=v.byte_size::text
      for share of o;
    if not found then raise exception 'The completion photo must be verified before completing the visit.'; end if;
    insert into public.booking_completion_photos(booking_id,storage_object_id,storage_path,content_type,byte_size,position)
      values(requested_booking_id,verified_photo.storage_object_id,photo_path,verified_photo.content_type,verified_photo.byte_size,photo_position);
    photo_position := photo_position+1;
  end loop;
  -- The existing RPC retains its owner/date/price/payment-state checks. If it
  -- fails, the metadata inserts above roll back in the same transaction.
  perform public.complete_booking(requested_booking_id);
  return true;
end;
$$;
revoke all on function public.complete_booking_with_photos(uuid,text[]) from public,anon;
grant execute on function public.complete_booking_with_photos(uuid,text[]) to authenticated;
commit;
