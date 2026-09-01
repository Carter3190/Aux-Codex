# Auxilium

Auxilium is a local-services marketplace that connects customers with trusted
independent providers. This repository contains the marketplace application that
will run separately from the public Squarespace website at
`app.theauxillium.com`.

## Current milestone

- Customer and provider registration
- Email/password login
- Email confirmation callback
- Cookie-based Supabase sessions for Next.js
- Role-protected customer, provider, and admin dashboards
- Private profiles table with Row Level Security
- Provider profiles with services, pricing, photos, credentials, and availability
- Provider application submission and progress tracking
- Admin provider-review queue with approval, rejection notes, and audit history
- Private credential files and public provider-profile photos
- Public search and approved-provider profile pages
- Private customer booking requests with customer cancellation
- Provider accept/decline controls and booking status tracking
- Private booking-linked customer/provider conversations

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Create a project in the [Supabase dashboard](https://database.new). In the
project's **Connect** panel, copy the **Project URL** and **Publishable key**.

Copy `.env.example` to `.env.local` and add those two values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Do not use a secret key or service-role key in either public variable.

### 3. Create the database foundation

Open the Supabase **SQL Editor** and run these migrations in order:

1. `supabase/migrations/20260826000000_create_profiles.sql`
2. `supabase/migrations/20260831000000_provider_onboarding.sql`
3. `supabase/migrations/20260901000000_customer_marketplace.sql`
4. `supabase/migrations/20260901010000_booking_messages.sql`

If the customer marketplace is already installed, run only the fourth migration.

The migrations create profile roles, automatic profile creation, the provider
onboarding tables, storage buckets, public provider-search functions, private
booking requests, private booking conversations, server-side mutation functions,
least-privilege grants, and Row Level Security policies. Credential documents
are private; provider photos are public marketplace assets.

### 4. Configure authentication URLs

In **Authentication → URL Configuration** set:

- Site URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/**`

Before production, add `https://app.theauxillium.com/**` and change the Site URL
to `https://app.theauxillium.com`.

### 5. Configure the confirmation email

In **Authentication → Email Templates → Confirm signup**, make the confirmation
button link to:

```html
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard
```

This allows the server to verify the email token and establish the user's secure
cookie session.

### 6. Run the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing provider onboarding

1. Sign in with a provider account.
2. Open **Profile setup** and complete the introduction, one service, one photo,
   one credential, and at least one available day.
3. Submit the application for review.
4. Sign in with a separate admin test account and open `/dashboard/admin`.
5. Review the private credential document, then approve the provider or return
   the application with notes.

Admin access is never available through public registration. To promote a
trusted test customer in the Supabase SQL Editor, replace the email below and
run:

```sql
update public.profiles
set role = 'admin', provider_status = 'not_applicable'
where lower(email) = lower('your-admin-email@example.com');
```

Use a separate test account for administration. Do not promote the provider
account being reviewed.

## Testing the customer marketplace

1. Keep one approved provider account with at least one service and an available
   day.
2. Open `/providers` and confirm that only the approved provider appears.
3. Sign in with a separate customer account, open the provider profile, and send
   a request for a time inside the provider's listed availability.
4. Confirm the request appears in `/dashboard/customer`.
5. Sign in as the provider, open `/dashboard/provider`, and accept or decline the
   request.
6. Return to the customer dashboard and confirm the updated status appears.

## Testing booking messages

1. Open an existing booking from the customer dashboard and choose **Message
   provider**.
2. Send a short test message and confirm it appears on the right side of the
   conversation.
3. Sign in as the provider, open **Messages**, and open the same booking.
4. Confirm the customer's message appears, then send a response.
5. Return to the customer conversation and confirm the response appears. Threads
   automatically check for new messages while the page is open.
6. Cancel or decline a test booking and confirm its conversation becomes
   read-only while preserving the history.

## Verification commands

```bash
npm run lint
npx tsc --noEmit
npx next build --webpack
```

The webpack flag is only used for verification in restricted development
environments. Vercel can use the standard `npm run build` command.
