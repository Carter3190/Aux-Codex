-- Auxilium paid-booking completion and verified customer reviews.
-- Reviews can only be created by the customer on a completed, successfully
-- paid booking. Public RPCs expose review copy without exposing customer IDs.

alter table public.booking_requests
  add column if not exists completed_at timestamptz;

alter table public.booking_requests
  drop constraint if exists booking_requests_status_check;

alter table public.booking_requests
  add constraint booking_requests_status_check check (
    status in ('pending', 'accepted', 'declined', 'cancelled', 'completed')
  );

create table if not exists public.booking_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.booking_requests (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(trim(body)) between 10 and 2000),
  created_at timestamptz not null default timezone('utc', now()),
  constraint booking_review_participants_differ check (customer_id <> provider_id)
);

comment on table public.booking_reviews is
  'Immutable verified reviews from customers with completed, paid Auxilium bookings.';

create index if not exists booking_reviews_provider_created_idx
  on public.booking_reviews (provider_id, created_at desc);

create index if not exists booking_reviews_customer_created_idx
  on public.booking_reviews (customer_id, created_at desc);

alter table public.booking_reviews enable row level security;

revoke all on table public.booking_reviews from anon, authenticated;
grant select on table public.booking_reviews to authenticated;
grant all on table public.booking_reviews to service_role;

drop policy if exists "Participants can view booking reviews" on public.booking_reviews;
create policy "Participants can view booking reviews"
  on public.booking_reviews
  for select
  to authenticated
  using (
    (select auth.uid()) = customer_id
    or (select auth.uid()) = provider_id
  );

drop policy if exists "Admins can view booking reviews" on public.booking_reviews;
create policy "Admins can view booking reviews"
  on public.booking_reviews
  for select
  to authenticated
  using ((select private.is_admin()));

create or replace function public.complete_booking(requested_booking_id uuid)
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
    raise exception 'Only provider accounts can mark a booking complete.';
  end if;

  select id, status, requested_date
  into selected_booking
  from public.booking_requests
  where id = requested_booking_id
    and provider_id = current_provider_id
  for update;

  if not found then
    raise exception 'Booking request not found.';
  end if;

  if selected_booking.status = 'completed' then
    return;
  end if;

  if selected_booking.status <> 'accepted' then
    raise exception 'Only accepted bookings can be marked complete.';
  end if;

  if selected_booking.requested_date > current_date then
    raise exception 'A future booking cannot be marked complete.';
  end if;

  if not exists (
    select 1
    from public.booking_payments as payment
    where payment.booking_id = requested_booking_id
      and payment.status in ('paid', 'partially_refunded')
  ) then
    raise exception 'A successfully paid booking is required before completion.';
  end if;

  update public.booking_requests
  set
    status = 'completed',
    completed_at = timezone('utc', now())
  where id = requested_booking_id
    and provider_id = current_provider_id;
end;
$$;

revoke all on function public.complete_booking(uuid) from public;
grant execute on function public.complete_booking(uuid) to authenticated;

create or replace function public.create_booking_review(
  requested_booking_id uuid,
  review_rating integer,
  review_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer_id uuid := (select auth.uid());
  selected_booking record;
  created_review_id uuid;
begin
  if not exists (
    select 1
    from public.profiles
    where id = current_customer_id
      and role = 'customer'
  ) then
    raise exception 'Only customer accounts can review a booking.';
  end if;

  if review_rating is null or review_rating < 1 or review_rating > 5 then
    raise exception 'Choose a rating from 1 to 5 stars.';
  end if;

  if char_length(trim(coalesce(review_body, ''))) < 10
    or char_length(trim(coalesce(review_body, ''))) > 2000
  then
    raise exception 'Reviews must be between 10 and 2,000 characters.';
  end if;

  select id, customer_id, provider_id, status
  into selected_booking
  from public.booking_requests
  where id = requested_booking_id
    and customer_id = current_customer_id
  for update;

  if not found then
    raise exception 'Booking request not found.';
  end if;

  if selected_booking.status <> 'completed' then
    raise exception 'The provider must mark this booking complete before it can be reviewed.';
  end if;

  if not exists (
    select 1
    from public.booking_payments as payment
    where payment.booking_id = requested_booking_id
      and payment.status in ('paid', 'partially_refunded')
  ) then
    raise exception 'Only successfully paid bookings can be reviewed.';
  end if;

  insert into public.booking_reviews (
    booking_id,
    customer_id,
    provider_id,
    rating,
    body
  )
  values (
    selected_booking.id,
    selected_booking.customer_id,
    selected_booking.provider_id,
    review_rating,
    trim(review_body)
  )
  returning id into created_review_id;

  return created_review_id;
exception
  when unique_violation then
    raise exception 'You already reviewed this booking.';
end;
$$;

revoke all on function public.create_booking_review(uuid, integer, text) from public;
grant execute on function public.create_booking_review(uuid, integer, text)
  to authenticated;

create or replace function public.get_provider_review_summary(
  requested_provider_ids uuid[]
)
returns table (
  provider_id uuid,
  average_rating double precision,
  review_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id as provider_id,
    round(avg(review.rating)::numeric, 1)::double precision as average_rating,
    count(review.id)::bigint as review_count
  from public.profiles as profile
  left join public.booking_reviews as review on review.provider_id = profile.id
  where profile.id = any(coalesce(requested_provider_ids, '{}'::uuid[]))
    and profile.role = 'provider'
    and profile.provider_status = 'approved'
  group by profile.id
  limit 50;
$$;

revoke all on function public.get_provider_review_summary(uuid[]) from public;
grant execute on function public.get_provider_review_summary(uuid[])
  to anon, authenticated;

create or replace function public.get_provider_reviews(requested_provider_id uuid)
returns table (
  review_id uuid,
  rating smallint,
  review_body text,
  reviewer_name text,
  service_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    review.id as review_id,
    review.rating,
    review.body as review_body,
    case
      when position(' ' in trim(booking.customer_name)) > 0 then
        split_part(trim(booking.customer_name), ' ', 1)
        || ' '
        || left(split_part(trim(booking.customer_name), ' ', 2), 1)
        || '.'
      else trim(booking.customer_name)
    end as reviewer_name,
    booking.service_name,
    review.created_at
  from public.booking_reviews as review
  join public.booking_requests as booking on booking.id = review.booking_id
  join public.profiles as profile on profile.id = review.provider_id
  where review.provider_id = requested_provider_id
    and profile.role = 'provider'
    and profile.provider_status = 'approved'
  order by review.created_at desc
  limit 50;
$$;

revoke all on function public.get_provider_reviews(uuid) from public;
grant execute on function public.get_provider_reviews(uuid)
  to anon, authenticated;

-- Keep completed-booking conversations available for follow-up and issue
-- resolution for 30 days after the provider marks the work complete.
create or replace function public.send_booking_message(
  requested_booking_id uuid,
  message_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_sender_id uuid := (select auth.uid());
  selected_booking record;
  created_message_id uuid;
begin
  if not exists (
    select 1
    from public.profiles
    where id = current_sender_id
      and role in ('customer', 'provider')
  ) then
    raise exception 'Only customers and providers can send booking messages.';
  end if;

  select id, customer_id, provider_id, status, completed_at
  into selected_booking
  from public.booking_requests
  where id = requested_booking_id
    and current_sender_id in (customer_id, provider_id);

  if not found then
    raise exception 'Conversation not found.';
  end if;

  if selected_booking.status not in ('pending', 'accepted')
    and not (
      selected_booking.status = 'completed'
      and selected_booking.completed_at > timezone('utc', now()) - interval '30 days'
    )
  then
    raise exception 'This conversation is closed because the booking is no longer active.';
  end if;

  if char_length(trim(coalesce(message_body, ''))) < 1
    or char_length(trim(coalesce(message_body, ''))) > 2000
  then
    raise exception 'Messages must be between 1 and 2,000 characters.';
  end if;

  if (
    select count(*)
    from public.booking_messages
    where sender_id = current_sender_id
      and created_at > timezone('utc', now()) - interval '1 minute'
  ) >= 20 then
    raise exception 'Too many messages were sent. Wait a minute and try again.';
  end if;

  insert into public.booking_messages (booking_id, sender_id, body)
  values (requested_booking_id, current_sender_id, trim(message_body))
  returning id into created_message_id;

  return created_message_id;
end;
$$;

revoke all on function public.send_booking_message(uuid, text) from public;
grant execute on function public.send_booking_message(uuid, text)
  to authenticated;
