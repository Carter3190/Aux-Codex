# Auxilium launch checklist

Updated September 21, 2026. This is the operational gate for accepting real
customers and real Stripe payments. Never paste secret values into this file.

## Completed foundation

- [x] Marketplace deployed at `https://app.theauxillium.com`
- [x] Production custom domain and SSL validated in Vercel
- [x] Supabase production URL and local redirect configured
- [x] Resend transactional email configured and tested
- [x] Stripe test-mode Accounts v2 onboarding completed
- [x] Signed test webhook receiving the required payment, refund, and dispute events
- [x] Full deployed-domain test completed: booking, messaging, checkout, paid webhook,
  completion, email, review, resolution request, and refund
- [x] Public Terms, Privacy, Provider Agreement, Provider Standards, cancellation/refund,
  and Support routes implemented
- [x] New-account agreement acceptance is required and versioned in Supabase auth metadata
- [x] Test/live payment mode is visible at `/api/health`
- [x] Live Stripe keys are protected by an explicit `STRIPE_LIVE_MODE_ENABLED=true` gate

## Owner and legal approval

- [ ] Have an authorized owner and qualified attorney review the text at `/terms`,
  `/privacy`, `/provider-agreement`, `/provider-standards`, and
  `/cancellation-refunds`. Application code cannot make these business decisions final.
- [ ] Confirm Auxilium’s legal entity name, governing-law choice, liability cap,
  refund standards, provider insurance requirements, and data-retention schedule.
- [ ] Create and monitor a support inbox. Add it to Vercel as `SUPPORT_EMAIL` and
  preferably also as `EMAIL_REPLY_TO`, then redeploy.
- [ ] Document who handles urgent safety reports, refunds, Stripe disputes, privacy
  requests, and provider credential expirations.

## Squarespace handoff

Update the public marketing-site buttons to these exact destinations:

- Find a provider: `https://app.theauxillium.com/providers`
- Customer signup: `https://app.theauxillium.com/signup`
- Provider signup: `https://app.theauxillium.com/signup?role=provider`
- Sign in: `https://app.theauxillium.com/login`
- Support: `https://app.theauxillium.com/support`
- Terms: `https://app.theauxillium.com/terms`
- Privacy: `https://app.theauxillium.com/privacy`

- [ ] Open every link from a signed-out browser and verify the destination.
- [ ] Check the Squarespace and app navigation on phone and desktop widths.

## Test-data separation

- [ ] Run `supabase/maintenance/launch_test_data_inventory.sql` in Supabase. It is
  read-only and identifies likely test accounts and bookings for manual review.
- [ ] Reconcile every paid test booking, refund, connected account, and dispute in
  Stripe before changing database records.
- [ ] Export or screenshot audit records that must be retained.
- [ ] Keep the first admin account. Do not delete storage files until their owning
  test account has been positively identified.
- [ ] Follow `TEST_DATA_CLEANUP.md`; take a Supabase backup before any deletion.

## Stripe live activation

- [ ] Complete Stripe platform activation and business verification.
- [ ] In Stripe live mode, create the same webhook destination and subscribe the
  exact event list in `DEPLOYMENT.md`.
- [ ] Replace Vercel `STRIPE_SECRET_KEY` with the `sk_live_...` key.
- [ ] Replace Vercel `STRIPE_WEBHOOK_SECRET` with the live destination’s `whsec_...`.
- [ ] Set `STRIPE_LIVE_MODE_ENABLED=true` only after the prior items are complete.
- [ ] Redeploy and verify `/api/health` reports `payments: "live"`,
  `launch: "live_ready"`, and `status: "ready"`.
- [ ] Each real provider completes live Stripe onboarding; test accounts do not transfer.
- [ ] Make one controlled low-value real booking, payment, completion, refund, and
  payout verification with consenting participants.

## Final release audit

- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm audit --omit=dev`
- [ ] `npm run build`
- [ ] Sign up as a new customer and provider and verify agreement acceptance.
- [ ] Confirm private credential URLs are inaccessible to unauthorized accounts.
- [ ] Confirm admin-only review and resolution pages reject customer/provider access.
- [ ] Test failed/expired Checkout and a webhook retry, not only the happy path.
- [ ] Test cancellation before payment and a denied resolution request.
- [ ] Verify email sender, reply-to, links, and mobile rendering.
- [ ] Confirm the Squarespace homepage links to the app and the app links to support/legal pages.
- [ ] Announce public availability only after all live-mode items above pass.
