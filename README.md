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

If the authentication foundation was already installed, run only the second
migration.

The migrations create profile roles, automatic profile creation, the provider
onboarding tables, storage buckets, server-side submission/review functions,
least-privilege grants, and Row Level Security policies. Credential documents are
private; provider photos are public marketplace assets.

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

## Verification commands

```bash
npm run lint
npx tsc --noEmit
npx next build --webpack
```

The webpack flag is only used for verification in restricted development
environments. Vercel can use the standard `npm run build` command.
