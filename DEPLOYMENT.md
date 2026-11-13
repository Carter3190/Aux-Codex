# Auxilium production launch

The public Squarespace website remains at `theauxillium.com`. The marketplace
application is deployed separately to Vercel at `app.theauxillium.com`.

Do the first deployment with Stripe test keys. Switch to live Stripe keys only
after the complete production-domain test passes and Auxilium is ready to accept
real payments.

## Before accepting real customers or payments

Deployment is not the same as public launch. Before switching Stripe to live
mode, Auxilium should have owner-approved versions of:

- Terms of service and a provider agreement
- Privacy policy and data-retention/deletion process
- Cancellation, refund, and dispute policies
- Provider eligibility, insurance, and credential-review standards
- A monitored customer-support email and incident-response process

These policies require business and legal decisions and should not be treated as
final merely because application code exists.

## 1. Import the GitHub repository into Vercel

1. Sign in to Vercel and choose **Add New → Project**.
2. Import `Carter3190/Aux-Codex` from GitHub.
3. Keep the detected framework as **Next.js** and the root directory as `.`.
4. Keep the install command as `npm install` and build command as `npm run build`.
5. Do not paste secret values into build-command fields or commit them to Git.

## 2. Add Vercel environment variables

Open **Vercel project → Settings → Environment Variables**. Add the following
to the Production environment. Use test Stripe values for the first protected
deployment, then replace only the Stripe values when going live.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_CONNECT_WEBHOOK_SECRET
STRIPE_LIVE_MODE_ENABLED=false
APP_URL=https://app.theauxillium.com
RESEND_API_KEY
EMAIL_FROM=Auxilium <notifications@auth.theauxillium.com>
EMAIL_REPLY_TO
SUPPORT_EMAIL
```

`EMAIL_REPLY_TO` is optional. `STRIPE_SECRET_KEY`, both Stripe webhook secrets,
`SUPABASE_SECRET_KEY`, and `RESEND_API_KEY` must never start with `NEXT_PUBLIC_`.

Environment-variable changes apply only to new deployments. Redeploy after any
change.

Keep `STRIPE_LIVE_MODE_ENABLED=false` while using test keys. A live Stripe key
is deliberately rejected unless this value is explicitly changed to `true`.
Set `SUPPORT_EMAIL` to the monitored inbox shown in the public Support Center.

## 3. Connect the marketplace subdomain

1. Open **Vercel project → Settings → Domains**.
2. Add `app.theauxillium.com`.
3. Vercel will display the exact CNAME target for this project.
4. In **Squarespace → Domains → theauxillium.com → DNS Settings**, add a CNAME:
   - Host/Name: `app`
   - Value/Data: the exact target Vercel displays
   - TTL: the Squarespace default
5. Do not change the apex or `www` records used by the Squarespace marketing
   site, and do not change the existing Resend records for
   `auth.theauxillium.com`.
6. Return to Vercel and wait for the domain and SSL certificate to show as
   valid.

## 4. Update Supabase authentication

Open **Supabase → Authentication → URL Configuration**:

- Site URL: `https://app.theauxillium.com`
- Production redirect URL: `https://app.theauxillium.com/auth/confirm`
- Keep `http://localhost:3000/**` as an additional local-development redirect.

Keep the **Confirm signup** email link as:

```html
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard
```

## 5. Configure transactional email

The verified Resend domain `auth.theauxillium.com` can send marketplace alerts.

1. Open **Resend → API Keys** and create a sending key for Auxilium production.
2. Save the key as `RESEND_API_KEY` in Vercel.
3. Set `EMAIL_FROM` to an address on the verified domain, such as
   `Auxilium <notifications@auth.theauxillium.com>`.
4. Optionally set `EMAIL_REPLY_TO` to the inbox that should receive support
   replies.
5. Redeploy, then confirm `notifications` is `enabled` at `/api/health`.

Notifications are best effort: a mail-provider outage does not undo a booking,
payment, provider decision, or refund. Resend idempotency keys protect each
notification from ordinary duplicate submissions.

## 6. Configure the Stripe webhooks

After `app.theauxillium.com` is live, open **Stripe Workbench → Webhooks**. Keep
the existing **Your account** destination for legacy payments and create a
second destination at the same URL with **Events from** set to **Connected
accounts**:

```text
https://app.theauxillium.com/api/stripe/webhook
```

Subscribe it to:

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

Copy the **Your account** destination secret into Vercel as
`STRIPE_WEBHOOK_SECRET`. Copy the **Connected accounts** destination secret as
`STRIPE_CONNECT_WEBHOOK_SECRET`, then redeploy. Local Stripe CLI secrets are not
production destination secrets.

## 7. Verify the protected deployment

Open:

```text
https://app.theauxillium.com/api/health
```

The response status should be `ready`, notifications should be `enabled`, and
payments should be `test`. A test deployment correctly reports launch as
`prelaunch`.
Then repeat the proven test-mode flow on the deployed application:

1. Create and confirm customer and provider accounts.
2. Submit and approve the provider.
3. Connect the provider's Stripe test account.
4. Request and accept a booking.
5. Send messages in both directions.
6. Agree a price, confirm Checkout is blocked before completion, then mark the
   finished work complete on or after its service date.
7. Complete test Checkout, confirm the signed payment event, and publish a review.
8. Open a resolution request and issue a small test refund.
9. Confirm the expected transaction emails arrive.

## 8. Switch Stripe from test to live

When Auxilium is legally and operationally ready for real transactions:

1. Complete the platform's Stripe live-account activation.
2. Replace Vercel's test `STRIPE_SECRET_KEY` with the live `sk_live_...` key.
3. Create both webhook destinations in live mode and replace
   `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET` with their live
   signing secrets.
4. Set `STRIPE_LIVE_MODE_ENABLED=true` only after the live key and both webhooks
   are ready.
5. Redeploy and confirm `/api/health` reports `payments: "live"` and
   `launch: "live_ready"`.
6. Providers must complete real live-mode onboarding. Stripe test connected
   accounts do not become live payout accounts.
7. Make one controlled real payment and refund before public launch.

## 9. Connect Squarespace buttons

Update the Squarespace calls to action to point to:

- Find a provider: `https://app.theauxillium.com/providers`
- Customer signup: `https://app.theauxillium.com/signup`
- Provider signup: `https://app.theauxillium.com/signup?role=provider`
- Sign in: `https://app.theauxillium.com/login`

After this final check, the marketing site and marketplace can launch together.

## Payment-after-service rollout (November 11, 2026)

This release changes the order to finished work, payment due, explicit customer
Checkout, then Stripe payout of available funds. It does not store a card, charge
off-session, initiate a bank payout, alter an existing payout schedule, or change
the 5% application fee. Existing successful payments and refunds remain valid.

1. Build and test the candidate, including the isolated PostgreSQL financial
   transition tests. No live transaction is part of automated verification.
2. Run `supabase/maintenance/post_service_payment_preflight.sql` read-only in the
   correct production project. Preserve the payment totals for comparison.
3. Reconcile every pending Checkout attempt with Stripe, including ones with
   elapsed expiry times. A session might have completed before expiry while its
   signed event is delayed. Never clear a session ID or change a payment to
   expired merely to pass this check. The migration aborts on any pending attempt.
   A signed expiration event or authoritative Stripe response must establish
   that a previous session cannot still be paid before it can be replaced. If
   the check reports a processing payment, retain it and let its signed event
   resolve it normally.
4. Apply `20261111000000_payment_after_service.sql`. Its transaction and table
   locks repeat the session check at the actual cutover. The database blocks
   premature payment even if an old application request arrives during rollout.
5. Apply `20261111010000_post_service_policy_versions.sql` and deploy the exact
   tested page source promptly. The changed Terms and Provider Agreement require
   a fresh review; earlier acceptance records stay intact. During a version
   mismatch the app refuses new agreement acceptance instead of accepting the
   wrong document. Do not roll back to old page source against new policy versions.
6. Verify production is on the expected commit, compare payment totals, inspect
   the installed RPC guards and legal source hashes, and check `/api/health`.
   Test unpaid/paid UI states with local fixtures. A controlled live customer
   payment requires separate participant authorization and is not implied by
   deploying this release.

The Stripe review badge comes from the retrieved account requirements, not the
return URL. The 3–5 business-day message is guidance for submitted document review,
not a guaranteed approval deadline. A failed refresh is labelled unavailable
rather than freshly approved.
# Completion photos and completion-email release (2026-11-13)

Apply `supabase/migrations/20261113000000_booking_completion_photos.sql` before deploying this release. It creates a private `booking-completion-photos` bucket and authenticated booking-photo metadata. Both the public metadata table and the internal verification table have Row Level Security enabled. Existing completion, checkout, price, payment, fee, and payout functions remain unchanged.

Providers can optionally select up to five JPG, PNG, or WebP images, each no larger than 5 MB, before marking accepted work complete. Browser uploads go directly to authenticated Supabase Storage, so this does not increase Next.js action-body limits or route files through Vercel's request-body limit. The server checks actual image bytes before the new atomic RPC associates the photos with the completed booking. Attached photos cannot be replaced or deleted by booking participants. Customers, the provider, and authorized administrators can view them; public profiles cannot.

The existing Resend configuration sends the completion email. The new completion RPC returns whether this request performed the transition; an already-completed retry does not generate another email. The email links to the booking's Overview tab, where any photos are shown. Signed-out customers return to that destination after signing in and satisfying any existing agreement review. Emails contain no image attachments or signed image URLs. Delivery failures do not undo completed work and are reported in provider action feedback.

Marking complete still does not charge the customer, create a bank payout, or add a one-hour time lock. The existing scheduled-date and agreed-price checks remain. Customer payment stays an explicit action after completion; the 5% fee and Stripe payout schedule are unchanged.

Verify the bucket is private, the two new tables have RLS, authenticated users cannot attest image verification, and existing payment totals/function hashes match the preflight. Run the full test suite, lint, type check, and production build before publishing. No new environment variables or paid-plan upgrade are required for this release.
