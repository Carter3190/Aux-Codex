# Test-data cleanup runbook

Do not treat test-data cleanup as a normal database reset. Auxilium’s test
records include payment, refund, review, provider-approval, and resolution audit
history with intentionally restrictive foreign keys.

## Safe sequence

1. Pause test activity and take a Supabase backup.
2. Run `supabase/maintenance/launch_test_data_inventory.sql`. It is read-only.
3. Build an explicit list of test user UUIDs and booking UUIDs. Identify each
   account by both email and activity; never delete based only on a name match.
4. In Stripe **test mode**, reconcile the connected accounts, successful charges,
   refunds, and disputes for those UUIDs. Test Stripe objects can remain in test
   mode; they never become live objects.
5. Download only the audit evidence the business is required to retain. Do not
   download identity documents unnecessarily.
6. Remove test storage objects from the `provider-photos` and
   `provider-credentials` buckets using their exact object paths.
7. Delete dependent database rows in a reviewed transaction. Resolution events,
   refunds, disputes, reviews, messages, and payments depend on bookings and must
   be handled before profiles. Never weaken foreign keys merely to make deletion easy.
8. Delete the identified test users from Supabase Authentication only after their
   dependent records have been handled. The profile trigger/cascade is not a
   substitute for the dependency review.
9. Keep the production admin account and verify its role before committing.
10. Re-run the inventory, open all three role dashboards, and run one fresh
    test-mode booking to confirm the remaining environment is healthy.

## Why no automatic delete script is included

A generic cleanup script cannot reliably distinguish a real early user from a
test user, and it cannot decide which payment and dispute records Auxilium must
retain. The repository intentionally provides a read-only inventory and a
reviewed runbook instead of a one-command destructive operation.
