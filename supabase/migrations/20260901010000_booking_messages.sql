-- Auxilium booking-linked messaging.
-- Conversations are private to the booking participants and administrators.
-- New messages can only be sent while a request is pending or accepted.

create table if not exists public.booking_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_requests (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.booking_messages is
  'Private messages attached to one booking and visible only to its participants and administrators.';

create index if not exists booking_messages_booking_created_idx
  on public.booking_messages (booking_id, created_at, id);

create index if not exists booking_messages_sender_created_idx
  on public.booking_messages (sender_id, created_at desc);

alter table public.booking_messages enable row level security;

revoke all on table public.booking_messages from anon, authenticated;
grant select on table public.booking_messages to authenticated;
grant all on table public.booking_messages to service_role;

drop policy if exists "Participants can view booking messages" on public.booking_messages;
create policy "Participants can view booking messages"
  on public.booking_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.booking_requests as booking
      where booking.id = booking_id
        and (
          booking.customer_id = (select auth.uid())
          or booking.provider_id = (select auth.uid())
        )
    )
  );

drop policy if exists "Admins can view booking messages" on public.booking_messages;
create policy "Admins can view booking messages"
  on public.booking_messages
  for select
  to authenticated
  using ((select private.is_admin()));

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

  select id, customer_id, provider_id, status
  into selected_booking
  from public.booking_requests
  where id = requested_booking_id
    and current_sender_id in (customer_id, provider_id);

  if not found then
    raise exception 'Conversation not found.';
  end if;

  if selected_booking.status not in ('pending', 'accepted') then
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
