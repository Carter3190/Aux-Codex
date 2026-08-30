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
- Provider accounts begin in a pending state

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

Open the Supabase **SQL Editor**, copy the contents of
`supabase/migrations/20260826000000_create_profiles.sql`, and run it once.

The migration creates the profile roles, provider-approval status, automatic
profile creation, least-privilege grants, and policies that limit users to their
own profile.

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

## Verification commands

```bash
npm run lint
npx tsc --noEmit
npx next build --webpack
```

The webpack flag is only used for verification in restricted development
environments. Vercel can use the standard `npm run build` command.
