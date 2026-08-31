-- Auxilium customer marketplace and booking-request workflow.
-- Public RPCs expose only approved provider profile fields. Booking mutations
-- re-check identity, role, ownership, service state, and availability in the DB.

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  service_id uuid not null references public.provider_services (id) on delete restrict,
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  provider_name text not null check (char_length(provider_name) between 2 and 100),
  service_name text not null check (char_length(service_name) between 2 and 80),
  pricing_type text not null check (
    pricing_type in ('hourly', 'fixed', 'starting_at', 'quote')
  ),
  price_cents integer,
  requested_date date not null,
  requested_start_time time not null,
  service_location text not null check (
    char_length(service_location) between 5 and 300
  ),
  customer_notes text not null default '' check (char_length(customer_notes) <= 2000),
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'declined', 'cancelled')
  ),
  provider_response text not null default '' check (
    char_length(provider_response) <= 1000
  ),
  responded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint booking_customer_and_provider_differ check (customer_id <> provider_id),
  constraint booking_price_matches_type check (
    (pricing_type = 'quote' and price_cents is null)
    or
    (pricing_type <> 'quote' and price_cents between 100 and 100000000)
  )
);

comment on table public.booking_requests is
  'Private marketplace requests visible only to the participating customer, provider, and administrators.';

create index if not exists booking_requests_customer_status_date_idx
  on public.booking_requests (customer_id, status, requested_date desc);

create index if not exists booking_requests_provider_status_date_idx
  on public.booking_requests (provider_id, status, requested_date desc);

create unique index if not exists booking_customer_provider_slot_active_unique
  on public.booking_requests (
    customer_id,
    provider_id,
    requested_date,
    requested_start_time
  )
  where status in ('pending', 'accepted');

create unique index if not exists booking_provider_slot_accepted_unique
  on public.booking_requests (provider_id, requested_date, requested_start_time)
  where status = 'accepted';

drop trigger if exists set_booking_requests_updated_at on public.booking_requests;
create trigger set_booking_requests_updated_at
  before update on public.booking_requests
  for each row execute function private.set_updated_at();

alter table public.booking_requests enable row level security;

revoke all on table public.booking_requests from anon, authenticated;
grant select on table public.booking_requests to authenticated;
grant all on table public.booking_requests to service_role;

drop policy if exists "Participants can view their bookings" on public.booking_requests;
create policy "Participants can view their bookings"
  on public.booking_requests
  for select
  to authenticated
  using (
    (select auth.uid()) = customer_id
    or (select auth.uid()) = provider_id
  );

drop policy if exists "Admins can view all bookings" on public.booking_requests;
create policy "Admins can view all bookings"
  on public.booking_requests
  for select
  to authenticated
  using ((select private.is_admin()));

create or replace function public.search_approved_providers(
  search_term text default '',
  area_term text default ''
)
returns table (
  provider_id uuid,
  display_name text,
  headline text,
  bio_preview text,
  service_area text,
  years_experience integer,
  travel_radius_miles integer,
  primary_photo_path text,
  services jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with input as (
    select
      left(trim(coalesce(search_term, '')), 100) as search_value,
      left(trim(coalesce(area_term, '')), 100) as area_value
  )
  select
    profile.id as provider_id,
    coalesce(nullif(trim(details.business_name), ''), profile.full_name) as display_name,
    details.headline,
    left(details.bio, 260) as bio_preview,
    details.service_area,
    details.years_experience,
    details.travel_radius_miles,
    (
      select photo.storage_path
      from public.provider_photos as photo
      where photo.provider_id = profile.id
      order by photo.sort_order, photo.created_at
      limit 1
    ) as primary_photo_path,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', service.id,
            'name', service.name,
            'pricingType', service.pricing_type,
            'priceCents', service.price_cents
          )
          order by service.name
        )
        from public.provider_services as service
        where service.provider_id = profile.id
          and service.is_active
      ),
      '[]'::jsonb
    ) as services
  from public.profiles as profile
  join public.provider_details as details on details.provider_id = profile.id
  cross join input
  where profile.role = 'provider'
    and profile.provider_status = 'approved'
    and (
      input.search_value = ''
      or coalesce(nullif(trim(details.business_name), ''), profile.full_name)
        ilike '%' || input.search_value || '%'
      or details.headline ilike '%' || input.search_value || '%'
      or details.bio ilike '%' || input.search_value || '%'
      or exists (
        select 1
        from public.provider_services as matching_service
        where matching_service.provider_id = profile.id
          and matching_service.is_active
          and matching_service.name ilike '%' || input.search_value || '%'
      )
    )
    and (
      input.area_value = ''
      or details.service_area ilike '%' || input.area_value || '%'
    )
  order by display_name
  limit 50;
$$;

revoke all on function public.search_approved_providers(text, text) from public;
grant execute on function public.search_approved_providers(text, text)
  to anon, authenticated;

create or replace function public.get_approved_provider(requested_provider_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'providerId', profile.id,
    'displayName', coalesce(nullif(trim(details.business_name), ''), profile.full_name),
    'headline', details.headline,
    'bio', details.bio,
    'serviceArea', details.service_area,
    'yearsExperience', details.years_experience,
    'travelRadiusMiles', details.travel_radius_miles,
    'services', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', service.id,
            'name', service.name,
            'description', service.description,
            'pricingType', service.pricing_type,
            'priceCents', service.price_cents
          )
          order by service.name
        )
        from public.provider_services as service
        where service.provider_id = profile.id
          and service.is_active
      ),
      '[]'::jsonb
    ),
    'availability', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'weekday', availability.weekday,
            'startTime', to_char(availability.start_time, 'HH24:MI'),
            'endTime', to_char(availability.end_time, 'HH24:MI')
          )
          order by availability.weekday
        )
        from public.provider_availability as availability
        where availability.provider_id = profile.id
          and availability.is_available
      ),
      '[]'::jsonb
    ),
    'photos', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', photo.id,
            'storagePath', photo.storage_path,
            'caption', photo.caption
          )
          order by photo.sort_order, photo.created_at
        )
        from public.provider_photos as photo
        where photo.provider_id = profile.id
      ),
      '[]'::jsonb
    ),
    'credentials', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', credential.id,
            'type', credential.credential_type,
            'title', credential.title,
            'issuer', credential.issuer,
            'expiresOn', credential.expires_on
          )
          order by credential.title
        )
        from public.provider_credentials as credential
        where credential.provider_id = profile.id
          and credential.review_status = 'approved'
      ),
      '[]'::jsonb
    )
  )
  from public.profiles as profile
  join public.provider_details as details on details.provider_id = profile.id
  where profile.id = requested_provider_id
    and profile.role = 'provider'
    and profile.provider_status = 'approved';
$$;

revoke all on function public.get_approved_provider(uuid) from public;
grant execute on function public.get_approved_provider(uuid) to anon, authenticated;

create or replace function public.request_booking(
  requested_provider_id uuid,
  requested_service_id uuid,
  requested_date date,
  requested_start_time time,
  requested_location text,
  requested_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer_id uuid := (select auth.uid());
  customer_display_name text;
  provider_display_name text;
  selected_service record;
  created_booking_id uuid;
begin
  select full_name
  into customer_display_name
  from public.profiles
  where id = current_customer_id
    and role = 'customer';

  if customer_display_name is null then
    raise exception 'Only customer accounts can request a booking.';
  end if;

  select coalesce(nullif(trim(details.business_name), ''), profile.full_name)
  into provider_display_name
  from public.profiles as profile
  join public.provider_details as details on details.provider_id = profile.id
  where profile.id = requested_provider_id
    and profile.role = 'provider'
    and profile.provider_status = 'approved';

  if provider_display_name is null then
    raise exception 'This provider is not currently available for booking.';
  end if;

  select service.id, service.name, service.pricing_type, service.price_cents
  into selected_service
  from public.provider_services as service
  where service.id = requested_service_id
    and service.provider_id = requested_provider_id
    and service.is_active;

  if not found then
    raise exception 'Choose an active service from this provider.';
  end if;

  if requested_date is null
    or requested_date <= current_date
    or requested_date > current_date + 365
  then
    raise exception 'Choose a date between tomorrow and one year from today.';
  end if;

  if requested_start_time is null or not exists (
    select 1
    from public.provider_availability as availability
    where availability.provider_id = requested_provider_id
      and availability.weekday = extract(dow from requested_date)::smallint
      and availability.is_available
      and availability.start_time <= requested_start_time
      and availability.end_time > requested_start_time
  ) then
    raise exception 'Choose a time within this provider''s listed availability.';
  end if;

  if char_length(trim(coalesce(requested_location, ''))) < 5
    or char_length(trim(coalesce(requested_location, ''))) > 300
  then
    raise exception 'Enter a service location between 5 and 300 characters.';
  end if;

  if char_length(trim(coalesce(requested_notes, ''))) > 2000 then
    raise exception 'Use 2,000 characters or fewer for request notes.';
  end if;

  if (
    select count(*)
    from public.booking_requests
    where customer_id = current_customer_id
      and status = 'pending'
  ) >= 20 then
    raise exception 'You already have 20 pending requests. Wait for a response or cancel one.';
  end if;

  insert into public.booking_requests (
    customer_id,
    provider_id,
    service_id,
    customer_name,
    provider_name,
    service_name,
    pricing_type,
    price_cents,
    requested_date,
    requested_start_time,
    service_location,
    customer_notes
  )
  values (
    current_customer_id,
    requested_provider_id,
    selected_service.id,
    customer_display_name,
    provider_display_name,
    selected_service.name,
    selected_service.pricing_type,
    selected_service.price_cents,
    requested_date,
    requested_start_time,
    trim(requested_location),
    trim(coalesce(requested_notes, ''))
  )
  returning id into created_booking_id;

  return created_booking_id;
exception
  when unique_violation then
    raise exception 'You already have an active request for this provider at that time.';
end;
$$;

revoke all on function public.request_booking(uuid, uuid, date, time, text, text)
  from public;
grant execute on function public.request_booking(uuid, uuid, date, time, text, text)
  to authenticated;

create or replace function public.respond_to_booking(
  requested_booking_id uuid,
  response_decision text,
  response_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_provider_id uuid := (select auth.uid());
  selected_booking record;
begin
  if not exists (
    select 1
    from public.profiles
    where id = current_provider_id
      and role = 'provider'
  ) then
    raise exception 'Only provider accounts can respond to booking requests.';
  end if;

  if response_decision not in ('accepted', 'declined') then
    raise exception 'Choose accepted or declined.';
  end if;

  if char_length(trim(coalesce(response_notes, ''))) > 1000 then
    raise exception 'Use 1,000 characters or fewer for your response.';
  end if;

  select id, requested_date, requested_start_time, status
  into selected_booking
  from public.booking_requests
  where id = requested_booking_id
    and provider_id = current_provider_id
  for update;

  if not found then
    raise exception 'Booking request not found.';
  end if;

  if selected_booking.status <> 'pending' then
    raise exception 'Only pending requests can be accepted or declined.';
  end if;

  if response_decision = 'accepted' and exists (
    select 1
    from public.booking_requests
    where provider_id = current_provider_id
      and requested_date = selected_booking.requested_date
      and requested_start_time = selected_booking.requested_start_time
      and status = 'accepted'
      and id <> requested_booking_id
  ) then
    raise exception 'You already accepted another booking at this time.';
  end if;

  update public.booking_requests
  set
    status = response_decision,
    provider_response = trim(coalesce(response_notes, '')),
    responded_at = timezone('utc', now())
  where id = requested_booking_id
    and provider_id = current_provider_id;
exception
  when unique_violation then
    raise exception 'You already accepted another booking at this time.';
end;
$$;

revoke all on function public.respond_to_booking(uuid, text, text) from public;
grant execute on function public.respond_to_booking(uuid, text, text)
  to authenticated;

create or replace function public.cancel_booking(requested_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer_id uuid := (select auth.uid());
begin
  if not exists (
    select 1
    from public.profiles
    where id = current_customer_id
      and role = 'customer'
  ) then
    raise exception 'Only customer accounts can cancel booking requests.';
  end if;

  update public.booking_requests
  set status = 'cancelled'
  where id = requested_booking_id
    and customer_id = current_customer_id
    and status in ('pending', 'accepted');

  if not found then
    raise exception 'This booking cannot be cancelled.';
  end if;
end;
$$;

revoke all on function public.cancel_booking(uuid) from public;
grant execute on function public.cancel_booking(uuid) to authenticated;

-- An approved application means the submitted credentials passed review. This
-- also corrects previously approved test providers and keeps future reviews in sync.
update public.provider_credentials as credential
set review_status = 'approved', review_notes = ''
where credential.review_status = 'pending'
  and exists (
    select 1
    from public.profiles as profile
    where profile.id = credential.provider_id
      and profile.provider_status = 'approved'
  );

create or replace function public.review_provider_application(
  reviewed_provider_id uuid,
  review_decision text,
  review_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_reviewer_id uuid := (select auth.uid());
begin
  if not exists (
    select 1 from public.profiles
    where id = current_reviewer_id and role = 'admin'
  ) then
    raise exception 'Only administrators can review provider applications.';
  end if;

  if review_decision not in ('approved', 'rejected') then
    raise exception 'Choose an approved or rejected decision.';
  end if;

  if review_decision = 'rejected' and char_length(trim(review_notes)) < 10 then
    raise exception 'Add clear review notes when rejecting an application.';
  end if;

  if not exists (
    select 1 from public.provider_details
    where provider_id = reviewed_provider_id
      and submitted_at is not null
  ) then
    raise exception 'This provider has not submitted a complete application.';
  end if;

  if review_decision = 'approved' and (
    not exists (
      select 1 from public.provider_services
      where provider_id = reviewed_provider_id and is_active
    )
    or not exists (
      select 1 from public.provider_photos
      where provider_id = reviewed_provider_id
    )
    or not exists (
      select 1 from public.provider_credentials
      where provider_id = reviewed_provider_id
    )
    or not exists (
      select 1 from public.provider_availability
      where provider_id = reviewed_provider_id and is_available
    )
  ) then
    raise exception 'The provider application is no longer complete.';
  end if;

  update public.profiles
  set provider_status = review_decision::public.provider_status
  where id = reviewed_provider_id
    and role = 'provider';

  if not found then
    raise exception 'Provider account not found.';
  end if;

  update public.provider_details
  set
    reviewed_at = timezone('utc', now()),
    reviewed_by = current_reviewer_id
  where provider_id = reviewed_provider_id;

  if review_decision = 'approved' then
    update public.provider_credentials
    set review_status = 'approved', review_notes = ''
    where provider_id = reviewed_provider_id
      and review_status = 'pending';
  end if;

  insert into public.provider_review_events (
    provider_id,
    reviewer_id,
    decision,
    notes
  )
  values (
    reviewed_provider_id,
    current_reviewer_id,
    review_decision::public.provider_status,
    trim(review_notes)
  );
end;
$$;

revoke all on function public.review_provider_application(uuid, text, text)
  from public;
grant execute on function public.review_provider_application(uuid, text, text)
  to authenticated;
