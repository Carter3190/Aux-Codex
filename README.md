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
- Provider Stripe Connect Accounts v2 onboarding with hosted identity and bank verification
- Provider-confirmed final booking prices
- Stripe-hosted customer Checkout with a 5% Auxilium application fee
- Signed, idempotent webhook reconciliation for payment status
- Provider-confirmed service completion for successfully paid bookings
- One immutable verified customer review per completed booking
- Public provider rating summaries and review history
- Customer cancellation, refund, and service-issue requests for paid bookings
- Provider responses and an audited admin resolution queue
- Full or partial Stripe refunds that reverse the provider transfer and 5% fee proportionally
- Signed Stripe refund reconciliation and card-dispute alerts

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
5. `supabase/migrations/20260901020000_stripe_connect_payments.sql`
6. `supabase/migrations/20260910000000_booking_completion_reviews.sql`
7. `supabase/migrations/20260914000000_booking_resolution_center.sql`

If completed bookings and reviews are already installed, run only the seventh
migration.

The migrations create profile roles, automatic profile creation, the provider
onboarding tables, storage buckets, public provider-search functions, private
booking requests, private booking conversations, server-side mutation functions,
paid-booking completion, verified customer reviews, least-privilege grants, and
Row Level Security policies. Credential documents are private; provider photos
and privacy-limited verified reviews are public marketplace content.

### 4. Connect Stripe test mode

The payment integration uses Stripe Connect Accounts v2 recipient accounts and
destination charges. Stripe collects provider identity and bank information;
Auxilium stores only the connected account ID and non-sensitive status flags.

1. In **Supabase → Project Settings → API Keys**, create or copy a server-only
   secret key beginning with `sb_secret_`.
2. In the Stripe Dashboard, activate **Connect** for the platform, choose **You
   collect payments and pay recipients**, and use **test mode** while developing.
3. In **Stripe → Developers → API keys**, copy the test secret key beginning with
   `sk_test_`.
4. Add these server-only values to `.env.local`:

```bash
SUPABASE_SECRET_KEY=sb_secret_your_server_key
STRIPE_SECRET_KEY=sk_test_your_stripe_key
APP_URL=http://localhost:3000
```

Never prefix either secret with `NEXT_PUBLIC_`, commit it, paste it into an issue,
or expose it in browser code.

For local webhook testing, install the Stripe CLI, sign in, and run:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_...` value printed by the listener into `.env.local`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_your_local_listener_secret
```

Restart `npm run dev` after changing environment variables. For production,
create a Stripe webhook endpoint at
`https://app.theauxillium.com/api/stripe/webhook` and subscribe it to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `refund.created`
- `refund.updated`
- `refund.failed`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`
- `charge.dispute.funds_withdrawn`
- `charge.dispute.funds_reinstated`

Use that endpoint's own signing secret in Vercel. Local and production webhook
secrets are different.

### 5. Configure authentication URLs

In **Authentication → URL Configuration** set:

- Site URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/**`

Before production, add `https://app.theauxillium.com/**` and change the Site URL
to `https://app.theauxillium.com`.

### 6. Configure the confirmation email

In **Authentication → Email Templates → Confirm signup**, make the confirmation
button link to:

```html
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard
```

This allows the server to verify the email token and establish the user's secure
cookie session.

### 7. Run the application

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

## Testing Stripe payments

1. Sign in as an approved provider and select **Connect with Stripe** on the
   provider dashboard.
2. Complete Stripe's test onboarding and return to Auxilium. The provider
   dashboard must show **Stripe payouts are connected**.
3. Open an accepted booking, enter the full final price, and save it.
4. Sign in as that booking's customer and select **Pay securely with Stripe**.
5. Complete Checkout with Stripe's test card `4242 4242 4242 4242`, any future
   expiry, any three-digit CVC, and any postal code.
6. Confirm the customer and provider dashboards both show **Paid**. In Stripe,
   verify the destination charge transferred 95% to the connected account and
   created a 5% application fee for Auxilium.

Auxilium's 5% is the gross platform commission. With destination charges, Stripe
deducts its payment-processing fee from the platform balance, so net platform
revenue is lower than 5%.

## Testing completed bookings and reviews

1. Complete the Stripe payment test above with a service date that is today or
   earlier.
2. Sign in as the provider and select **Mark service complete** on the paid
   booking.
3. Sign in as that booking's customer and publish a 1–5 star review with at
   least 10 characters.
4. Confirm the review is labeled **Verified booking** on the provider's public
   profile and the aggregate rating appears in provider search.
5. Confirm a second review cannot be submitted for the same booking. Completed
   booking conversations remain open for 30 days for follow-up.

## Testing the resolution center

1. Use a successfully paid booking. As the customer, open a cancellation,
   refund, or service-issue request and choose the requested amount.
2. Sign in as the provider and add a factual response to the request.
3. Sign in as the admin and open `/dashboard/admin/cases`.
4. Review both statements. To test a refund, choose a full or partial amount,
   enter decision notes, check the final confirmation box, and issue the refund.
5. Confirm both participant dashboards show the refund amount and resolution.
6. In Stripe test mode, confirm the refund reverses the destination transfer and
   Auxilium’s application fee proportionally.

The final admin confirmation creates a real Stripe refund for the environment
whose secret key is configured. Keep test keys installed during development.
Stripe remains the source of truth for card-network disputes and evidence; signed
dispute webhooks identify the affected booking in the Auxilium admin queue.

## Verification commands

```bash
npm run lint
npx tsc --noEmit
npx next build --webpack
```

The webpack flag is only used for verification in restricted development
environments. Vercel can use the standard `npm run build` command.
