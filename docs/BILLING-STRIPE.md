# Gearhead Labs Premium — Stripe billing (TEST MODE)

Status (2026-11-05): **implemented and tested without a Stripe account; not deployed; test mode only.** The site ships with `billing.enabled: false` and behaves exactly as before ("Online checkout is not open yet"). Nothing here touches production.

## What it does

| Piece | File | What it does |
| --- | --- | --- |
| Checkout | `supabase/functions/billing-checkout/` | A signed-in user asks for `month` or `year`. The function: refuses a user who already has access or a live subscription; creates (once) a Stripe customer and links it to the account server-side through `pf_upsert_billing_customer`; opens a Stripe Checkout session (subscription mode, the server-side price, card always collected, a **14-day trial** for an account that never had a subscription); returns the Checkout URL. |
| Customer Portal | `supabase/functions/billing-portal/` | A signed-in user with a billing record gets a Stripe Customer Portal session for their own customer: card, plan switch, cancellation, invoices. |
| Webhook | `supabase/functions/stripe-webhook/` | Verifies the `Stripe-Signature` against the raw body (HMAC-SHA256, 5-minute tolerance). Records the event (`pf_record_stripe_event`, so replays are ignored), re-fetches the subscription from Stripe, maps its customer to the account through `billing_customers`, mirrors it with `pf_sync_stripe_subscription` (which grants, extends or revokes Premium), then marks the event processed. |
| Shared code | `supabase/functions/_shared/` | `stripe.js` (REST client with a test-key-only guard, form encoding, signature verification); `billing.js` (the logic above); `handlers.js` (HTTP, CORS, errors); `db-supabase.js` (service-role adapter); `wiring.ts` (reads Supabase function secrets). |
| Frontend | `premium/config.js`, `premium/services.js`, `premium/adapters/*.js`, `premium/shell.js`, `premium-calculator-gating.js` | With `billing.enabled: true` and a backend: the Profile offer offers "Start free trial · $5.99/month after" and the yearly equivalent (or "Sign in to start your free trial"); Profile gets "Manage billing" for an account with a subscription; Checkout return notices (success / cancelled); locked calculators say "Start free trial →". With it off, or with no backend: unchanged. |

**Reused unchanged:** migrations 0402 and 0407. These cover the plans, the approved offers ($5.99/month, $59.99/year), `plan_prices`, `billing_customers`, `subscriptions`, `entitlement_grants` and `stripe_events`, the service-role functions, `pf_has_feature` and `pf_my_entitlement`, and every RLS policy and privilege. **No migration was added and no security rule was changed.**

## Security rules (enforced in code and tested)
- **Test mode only.**
  - The Stripe client refuses any key that is not `sk_test_…` / `rk_test_…`.
  - Live-mode events and live-mode objects are refused.
  - Going live is a reviewed code change, not a setting.
- **Account binding.**
  - The account is the authenticated user who started Checkout.
  - Webhooks find the account only through `billing_customers`, which the checkout function writes.
  - Event metadata and `client_reference_id` never choose an account; a mismatch is ignored.
  - A subscription on a customer Gearhead Labs did not create grants nothing.
- **Price.** It comes only from `plan_prices`, which a foreign key ties to the approved `plan_offers`. The browser cannot choose it.
- **Redirects.** They come only from `BILLING_RETURN_URL` (https), never from the browser. CORS is answered only for `BILLING_ALLOWED_ORIGINS`.
- **Ordering and retries.**
  - Every event re-fetches the subscription.
  - The database ignores older states, so a late or replayed event cannot re-open access.
  - A failure leaves the event unprocessed with a 5xx, so Stripe retries it.
  - Processed events are acknowledged as duplicates.
- **No new client powers.** Clients still cannot call any billing function or read the server-only tables (re-checked in the tests). Secrets exist only as Supabase function secrets.

## Tests (no Stripe account, no network)
- `premium-foundation/tests/billing.test.mjs`, run by `premium-foundation/tests/run-tests.sh`: **70 checks, 0 failures**.
  - It runs the real billing code against all migrations on a throwaway local PostgreSQL 16, with an in-memory Stripe simulator and real signed webhook requests.
  - **Signatures and guards:** good, wrong-secret, tampered, expired and missing signatures; secret rotation; live, publishable and restricted keys; REST request shape; live objects; error text.
  - **Checkout:**
    - no price configured;
    - signed out, forged JWT, bad interval;
    - customer creation and reuse;
    - session parameters, return URLs, CORS;
    - a hostile body cannot choose the price, redirect or account;
    - non-https configuration refused;
    - already Premium;
    - re-subscription without a second trial.
  - **Lifecycle:** trial start with access to the trial end; trial end paid; renewal; cancel at period end; cancellation revokes and keeps audit history.
  - **Payment failure:** past_due keeps access until the period end; unpaid revokes.
  - **Retries and ordering:**
    - Stripe outage, then retry;
    - duplicate deliveries;
    - stale state ignored;
    - a late "active" event cannot re-open access.
  - **Webhook security:**
    - forged, missing, tampered and replayed signatures;
    - live events;
    - an unknown customer with hostile metadata;
    - a `client_reference_id` mismatch;
    - an unregistered price;
    - unrelated events;
    - both subscription shapes (pre-2025 and 2025-03-31.basil);
    - a two-item subscription refused.
  - **Portal:** own customer, no record, signed out.
  - **Database security:** the boundary is unchanged.
- **Mutation checks** (manual, 2026-11-05): disabling signature verification (7 failures), trusting metadata for the account (1) and giving every checkout a trial (1) were all caught.
- `premium/tests/billing-ui.test.js` (in `run-browser-tests.sh`): **18/18**, real Chromium, no network.
  - With billing off, behaviour is unchanged.
  - With billing on: the trial offer, the sign-in path, the trial buttons, the trial starting, the return notices, the locked-calculator text, and no checkout without a backend.
- **Existing suites, unchanged results:** `premium-profile.test.js` 56/56, `upgrade-navigation.test.js` 66/66, `profile-shortcut.test.js` passed.
- **Pre-existing on `main`, not caused by this work:** `pf.test.js` reports 47/48. `[integrity]` still expects 18 migrations; 0409 made it 19 on 2026-10-22. Its `[stripe]` lifecycle check also compares a timestamp as text, so run it with `TZ=UTC`.

## Remaining: what needs a Stripe account (next week)
1. **Stripe account, in test mode** (Trent).
   - Create the product "Gearhead Labs Premium" with exactly two recurring prices, USD 5.99/month and USD 59.99/year.
   - Turn on the Customer Portal: allow card updates, invoices, cancellation (recommended: at period end) and switching between those two prices only.
2. **Webhook endpoint** (test mode).
   - URL: `https://<TEST project ref>.supabase.co/functions/v1/stripe-webhook`.
   - API version `2025-03-31.basil`, the same as `STRIPE_API_VERSION` in `stripe.js`.
   - Events:
     - `checkout.session.completed`;
     - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.trial_will_end`;
     - `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`.
3. **A TEST Supabase project**, never Premium production (the disposable rehearsal project can serve).
   - Migrations 0001–0409 applied through the Option B rehearsal.
   - The two Stripe test price ids registered in its `plan_prices`. They must match the approved offers, or the foreign key refuses them.
4. **Function secrets on the TEST project.** Entered in the Supabase dashboard, never in chat or source control:
   - `STRIPE_SECRET_KEY` (`sk_test_…`, or a restricted `rk_test_…` with Customers, Checkout Sessions, Billing Portal and Subscriptions read access);
   - `STRIPE_WEBHOOK_SECRET` (`whsec_…`);
   - `BILLING_RETURN_URL` (the https address of the test site's Premium page);
   - `BILLING_ALLOWED_ORIGINS` (that site's origin).
5. **Deploy** `billing-checkout`, `billing-portal` and `stripe-webhook` to the TEST project only. `stripe-webhook` is deployed with JWT verification off: its signature is its authentication.
6. **Turn on billing on a test copy of the site** (`billing.enabled: true`, with the test project's URL and anon key). Run Stripe's test cards end to end:
   - success: `4242 4242 4242 4242`;
   - decline at trial end: `4000 0000 0000 0341`;
   - 3-D Secure.

   Use Stripe's test clocks for the trial end and renewal. These are the **still unverified** parts: real payload shapes, real timing, the portal configuration and the 3-D Secure flow.

## Decisions for Trent
1. **How test (and later live) price ids reach `plan_prices`.** `plan_prices` is reference data that only a migration can write, and test and live ids differ.
   - Proposal: a test-only SQL seed applied only to the TEST project.
   - Later, one reviewed migration with the live ids, through the Option B package process.
2. **One free trial per account.** Implemented: an account that ever had a subscription gets no second trial. Confirm.
3. **Failed payment at trial end.** The existing rule (0402) keeps access while `past_due`, until the period end. After a declined first charge, that can mean up to a month of access while Stripe retries.
   - Option A: Stripe "cancel subscription after all retries fail", with a short retry window (for example 7 days).
   - Option B: a migration that ends access sooner when `past_due`.
   - Option A needs no code change.
4. **Cancellation in the portal:** at period end (recommended) or immediately.
5. **Promotion codes:** off (`allow_promotion_codes: false`). Confirm.
6. **Sales tax:** Stripe Tax is not enabled. Decide with an accountant before live charges. This document is not tax or legal advice.
7. **Before live:** the terms of service, refund policy and privacy policy need to mention billing; then a separate, reviewed "go live" change.
