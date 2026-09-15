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
APP_URL=https://app.theauxillium.com
RESEND_API_KEY
EMAIL_FROM=Auxilium <notifications@auth.theauxillium.com>
EMAIL_REPLY_TO
```

`EMAIL_REPLY_TO` is optional. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`SUPABASE_SECRET_KEY`, and `RESEND_API_KEY` must never start with
`NEXT_PUBLIC_`.

Environment-variable changes apply only to new deployments. Redeploy after any
change.

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

## 6. Configure the Stripe webhook

After `app.theauxillium.com` is live, open **Stripe Workbench → Webhooks** and
create an endpoint at:

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

Copy that endpoint's signing secret into Vercel as `STRIPE_WEBHOOK_SECRET`, then
redeploy. The local Stripe CLI `whsec_...` value is not the production endpoint
secret.

## 7. Verify the protected deployment

Open:

```text
https://app.theauxillium.com/api/health
```

The response status should be `ready` and notifications should be `enabled`.
Then repeat the proven test-mode flow on the deployed application:

1. Create and confirm customer and provider accounts.
2. Submit and approve the provider.
3. Connect the provider's Stripe test account.
4. Request and accept a booking.
5. Send messages in both directions.
6. Set a price and complete test Checkout.
7. Complete the booking and publish a review.
8. Open a resolution request and issue a small test refund.
9. Confirm the expected transaction emails arrive.

## 8. Switch Stripe from test to live

When Auxilium is legally and operationally ready for real transactions:

1. Complete the platform's Stripe live-account activation.
2. Replace Vercel's test `STRIPE_SECRET_KEY` with the live `sk_live_...` key.
3. Create the same webhook endpoint in live mode and replace
   `STRIPE_WEBHOOK_SECRET` with its live signing secret.
4. Redeploy.
5. Providers must complete real live-mode onboarding. Stripe test connected
   accounts do not become live payout accounts.
6. Make one controlled real payment and refund before public launch.

## 9. Connect Squarespace buttons

Update the Squarespace calls to action to point to:

- Find a provider: `https://app.theauxillium.com/providers`
- Customer signup: `https://app.theauxillium.com/signup`
- Provider signup: `https://app.theauxillium.com/signup?role=provider`
- Sign in: `https://app.theauxillium.com/login`

After this final check, the marketing site and marketplace can launch together.
