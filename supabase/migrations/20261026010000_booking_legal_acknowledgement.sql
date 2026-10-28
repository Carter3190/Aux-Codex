-- Require a transaction-specific customer acknowledgement before a booking is
-- created, then record the current Terms version against the new booking in
-- the append-only legal acceptance ledger. The booking insert and acceptance
-- record share one database transaction, so neither can be saved alone.

drop function if exists public.request_booking(uuid, uuid, date, time, text, text);

create or replace function public.request_booking(
  requested_provider_id uuid,
  requested_service_id uuid,
  requested_date date,
  requested_start_time time,
  requested_location text,
  requested_notes text default '',
  provider_responsibility_acknowledged boolean default false,
  accepted_terms_version text default null
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
  current_terms_version text;
begin
  select full_name
  into customer_display_name
  from public.profiles
  where id = current_customer_id
    and role = 'customer';

  if customer_display_name is null then
    raise exception 'Only customer accounts can request a booking.';
  end if;

  if provider_responsibility_acknowledged is distinct from true then
    raise exception 'Confirm that the provider performs the service and accept the current Terms of Service.';
  end if;

  if exists (
    with current_account_documents as (
      select distinct on (version.document_key)
        version.document_key,
        version.document_version
      from public.legal_document_versions as version
      where version.audience = 'all'
        and version.effective_at <= timezone('utc', now())
      order by version.document_key, version.effective_at desc, version.created_at desc
    )
    select 1
    from current_account_documents as document
    where not exists (
      select 1
      from public.legal_acceptances as acceptance
      where acceptance.user_id = current_customer_id
        and acceptance.document_key = document.document_key
        and acceptance.document_version = document.document_version
    )
  ) then
    raise exception 'Review and accept the current account agreements before requesting a booking.';
  end if;

  select version.document_version
  into current_terms_version
  from public.legal_document_versions as version
  where version.document_key = 'terms'
    and version.effective_at <= timezone('utc', now())
  order by version.effective_at desc, version.created_at desc
  limit 1;

  if current_terms_version is null
    or accepted_terms_version is distinct from current_terms_version
  then
    raise exception 'The Terms of Service changed. Refresh this page, review the current Terms, and try again.';
  end if;

  select coalesce(nullif(trim(details.business_name), ''), profile.full_name)
  into provider_display_name
  from public.profiles as profile
  join public.provider_details as details on details.provider_id = profile.id
  where profile.id = requested_provider_id
    and profile.role = 'provider'
    and profile.provider_status = 'approved'
    and (
      details.risk_controls_required_at is null
      or exists (
        select 1
        from public.provider_credentials as credential
        where credential.provider_id = requested_provider_id
          and credential.credential_type = 'insurance'
          and credential.review_status = 'approved'
          and char_length(trim(credential.issuer)) > 0
          and credential.expires_on is not null
          and credential.expires_on >= current_date
      )
    );

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

  perform public.record_current_legal_acceptances(
    array['terms']::text[],
    'booking_request',
    created_booking_id
  );

  return created_booking_id;
exception
  when unique_violation then
    raise exception 'You already have an active request for this provider at that time.';
end;
$$;

revoke all on function public.request_booking(uuid, uuid, date, time, text, text, boolean, text)
  from public;
grant execute on function public.request_booking(uuid, uuid, date, time, text, text, boolean, text)
  to authenticated;
