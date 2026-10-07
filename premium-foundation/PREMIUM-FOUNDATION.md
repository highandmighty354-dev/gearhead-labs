# PREMIUM-FOUNDATION 1.1.0 (0401–0407 APPLIED TO PRODUCTION)

The Premium database layer: accounts' profiles, Free/Premium entitlements, Stripe-ready billing, saved calculations, the Engineering Lab store, and the automotive-only block. It comes after CORE-ENGINE-BASELINE → DATA-FOUNDATION → MAPPING-FOUNDATION → GARAGE-FOUNDATION in the approved sequence.

**Status:** production `jmztpjudwzjvrcdtjynd` is at migration **0407**, with 17 migrations applied (0001 through 0407).
- 0001–0406 were applied on 2026-10-06 by the gated GitHub Action (run 37403342820, commit `b2baaaa`).
- 0407 (final product model) was applied the same day by run #8 (run 37493952993, package `ca8e582`) with owner approval.
- Read-only verification passed, and no user data was changed. The full record is in `supabase/PROVISIONING.md`.

## Final product model (owner decision, 2026-10-06; 0407)

- **Free** = the public calculators (606 at the time 0407 was applied; 585 since the same-day, frontend-only Free → Premium migration of 21 calculators below), no account needed. No Garage, no vehicle profiles, no Test Setups, no saved work.
- **Free → Premium calculator migration (2026-10-06, frontend only, no schema change):** 21 of the public calculators moved to Premium, approved in the Premium Migration Audit. This did not touch `0401`–`0407` or `entitlement_grants` — a Premium account's existing `pf_has_feature`/`plans.features` grant is reused as-is to gate them client-side (`premium-calculator-gating.js`), the same mechanism already used for the Engineering Lab. See `docs/PREMIUM-CATALOG.md` for the 21 ids and their Free companions.
- **Gearhead Labs Premium** = the **single** paid product, **$5.99/month or $59.99/year**: My Garage (vehicle profiles, details, components, Test Setups/Builds), saved calculations and the Engineering Lab (E01–E14).
- The early $1.99 Garage / $3.99 additional-profile concept is retired; it never existed in this schema or the frontend.
- Stripe is not implemented. The prices are recorded as approved offers (`plan_offers`); a future Stripe price can only be added for an approved plan / interval / currency / amount.

## Owner decisions implemented (2026-10-05)

| # | Decision | Where |
|---|---|---|
| 1 | ~~Free: 1 machine~~ **superseded by 0407:** My Garage is Premium-only; Free has no saved work | `0407` restrictive `pf_garage_premium_*` policies (feature `garage`); `0405` feature-gated policies |
| 2 | Automotive-only; marine blocked without editing frozen `0001` | `0401` CHECK constraint + withdrawn column grants |
| 3 | No Projects; User → Garage → Machine → Test Setup | no project tables; links reference `machines` / `test_setups` |
| 4 | Build = Test Setup | `saved_calculations` / `engineering_analyses` link to `test_setups` |
| 5 | Engineering work released as F1.12.4, frozen F1.12.3 untouched | `CHANGELOG-F1_12_4.md` (frontend, not database) |

Also honoured: D-001 (managed only; trusted writes by service-role server code), D-002 (engine-native storage units; unit system is display-only), D-003, D-006 (E01–E14 results not engine-verified → labelled `client_reported`), and every DATA/GARAGE-FOUNDATION rule (frozen files byte-identical, composite owner FKs, server timestamps, forced RLS, narrow grants, append-only history).

## Migrations (`supabase/migrations/`, applied in version order)

| File | Origin | Contents |
|---|---|---|
| `0001`–`0005` | DATA-FOUNDATION 1.0.0 (frozen) | enums, 10 tables, triggers, RLS, engine catalog seed |
| `0101`–`0103` | GARAGE-FOUNDATION 1.0.0 (frozen) | `test_setups` |
| `0201` | DATA-FOUNDATION 1.1.0 (frozen) | client INSERT on `value_records` withdrawn |
| `0301` | VALUE-FOUNDATION 1.0.0 (frozen) | 47 canonical fields |
| `0401` | **new** | automotive-only block |
| `0402` | **new** | `plans`, `plan_prices`, `billing_customers`, `subscriptions`, `entitlement_grants`, `stripe_events`; `pf_has_feature`, `pf_my_entitlement`; service-role functions |
| `0403` | **new** | `profiles` + sign-up trigger |
| `0404` | **new** | `machine_details`; Free machine allowance |
| `0405` | **new** | `saved_calculations` |
| `0406` | **new** | `engineering_analyzers` (E01–E14 @ `E1-AUTO`), `engineering_analyses` |
| `0407` | **new (1.1.0)** | final product model: feature `garage_unlimited` → `garage`; Premium the only paid plan; `plan_offers` (5.99/month, 59.99/year) with `plan_prices` tied to them; Premium-only Garage (restrictive insert/update policies on garages, machines, machine_details, components, component_connections, test_setups); the 0404 Free allowance removed |

Frozen files are copied byte-for-byte from tag `VALUE-FOUNDATION-1.0.0`; `supabase/FROZEN-SOURCES.sha256` records each hash and the suite re-verifies them against the tag. Each new migration is one transaction, idempotent, ends in post-conditions that abort on any deviation, and has a rollback in `supabase/rollback/`.

## Security model (new objects)

| Object | Client SELECT | Client INSERT | Client UPDATE | DELETE |
|---|---|---|---|---|
| profiles | own | — (sign-up trigger) | own display columns | refused (trigger) |
| machine_details | own, machine visible | own machine | descriptive columns (marking one primary moves the flag) | refused |
| machines (frozen) | unchanged | **+ restrictive: Free ≤ 1 active** | unchanged (marine columns withdrawn) | soft delete |
| saved_calculations | own, active | own + `saved_calculations` feature | title/notes/pinned/links + feature | soft-delete function |
| engineering_analyses | own, active | own + `engineering_lab` feature | inputs/title/notes/links + feature | soft-delete function |
| engineering_analyzers, plans, plan_prices | authenticated | — | — | refused |
| subscriptions | own | — | — | refused |
| entitlement_grants | own, every column except the operator `note` | — | — | refused |
| billing_customers, stripe_events | — | — | — | refused |

- **Entitlements cannot be self-granted:** no client privilege or policy on any billing/entitlement table, revoked even from Supabase's default grants; `pf_grant_manual`, `pf_revoke_grant`, `pf_record_stripe_event`, `pf_mark_stripe_event_processed`, `pf_upsert_billing_customer`, `pf_sync_stripe_subscription` are executable by `service_role` only.
- **Grants are an audit trail:** only `ends_at` (before revocation) and `revoked_at` (once) can change, for every role including the owner; no DELETE/TRUNCATE.
- **One access check:** `pf_has_feature(feature)` reads only `auth.uid()`'s active, unrevoked, in-window grants on active plans.
- **My Garage is Premium (0407):** creating or editing garages, machines, details, components, connections and Test Setups requires `pf_has_feature('garage')` (restrictive policies, ANDed with the frozen owner policies). A lapsed or former Premium account keeps read access and can soft-delete (owner-checked definers), but cannot create or edit. Foundation soft deletion is permanent, so deleted rows cannot be revived. (The 0404 counting allowance and its advisory lock are removed: there is nothing left to count.)
- **Primary machine:** marking a machine primary clears the flag on the owner's other details rows, including rows of deleted machines the owner can no longer see, so deleting the primary machine never blocks choosing a new one.
- **SECURITY DEFINER** functions (16 in total, 9 of them new) all pin `search_path = ''`, are owned by `postgres` (on hosted Supabase: non-superuser **with BYPASSRLS**, verified read-only on the live project), and are not executable by `anon`. The only ones taking a caller-supplied id are the owner soft deletes, which are scoped to `auth.uid()`; the trigger-only definers act on `NEW.owner_id`, which clients cannot choose.

## Stripe readiness (no Stripe code or keys)

A future Edge Function (service role; Stripe secrets in Supabase function secrets) calls: `pf_record_stripe_event` (idempotent: `false` on replay) → `pf_upsert_billing_customer` → `pf_sync_stripe_subscription` (mirrors the subscription; `active|trialing|past_due` with a future period end → one open grant to period end; anything else → revoked; plan change → revoke + replace) → `pf_mark_stripe_event_processed`. Prices are added to `plan_prices` by migration when products exist.

Contract for that function:
- **Ordering:** pass `p_state_at` = the Stripe event's `created` time, or the moment the subscription was retrieved from the Stripe API. A state older than the one already mirrored is ignored (`false`), so a late or retried webhook can never re-open access after a cancellation. Stripe timestamps have one-second resolution, so re-fetching the subscription from the API before syncing remains the recommended pattern.
- **Account:** `p_account` must come from the authenticated user who started Checkout (stored as Stripe customer metadata), never from the webhook body alone. The composite FK still forces a subscription's account to match its customer.

## Run the tests

```
cd premium-foundation
npm install          # pg 8.13.1
npm test             # = ./tests/run-tests.sh  (throwaway local PostgreSQL >= 14; never a real project)
```

The runner starts a cluster owned by `supabase_admin` and applies the test-only shim `tests/sql/000_hosted_supabase_shim.sql` (hosted role model + Supabase default privileges). It then applies every migration as the non-superuser `postgres` and runs:
- 49 checks in rolled-back transactions, plus a real two-connection concurrency test;
- an idempotency test and a migration-order test;
- a rollback round-trip: 0406→0401, compare with the frozen-only catalog, then re-apply;
- 21 negative controls.

Results: `evidence/test-results.json`.

Tested on PostgreSQL 16 only. The live project runs 17.11; run `PG_BIN=<pg17>/bin npm test` where PostgreSQL 17 is available.

### Composition with the frozen suites (pre-approval review, scratch copy only)

The frozen DATA- and GARAGE-FOUNDATION suites were run unchanged, with 0101–0406 appended after their own migrations, in a scratch copy of the tagged repository. Two fixture edits were made in that copy:
- the one marine fixture machine became automotive, since 0401 refuses it;
- the fixture accounts were given Premium, so the Free allowance would not mask other checks.

Every remaining failure is an intended restriction:

| Suite | Result | Failures |
|---|---|---|
| DATA-FOUNDATION | 182/219 | 34 client `value_records` inserts (withdrawn by frozen 0201, DATA-FOUNDATION 1.1.0); 1 marine machine (0401); 2 inventory checks (extra tables, 0301 seed) |
| GARAGE-FOUNDATION | 75/81, negative controls 28/28 | 1 owner update of `propulsion` (0401); 5 inventory/provenance checks (extra tables, extra enums, catalog fingerprint, 0301 seed, the appended file) |

## Open items (not decided here)

- SUPERSEDED (owner, 2026-10-06): the 2026-10-05 Free allowance (1 machine, unlimited Test Setups on it) is replaced by the final product model in 0407: Garage and Test Setups are Premium-only and unlimited there.
- `past_due` keeps access until the period end; no extra grace period (decision P-7 open).
- `plans` / `plan_prices` are readable by signed-in users only, not `anon` (a public pricing page would need a decision, like OPEN #17).
- Account deletion (OPEN #10) is unchanged: profiles, grants and billing rows are retained. Because `accounts → auth.users` is `ON DELETE RESTRICT` (frozen), deleting a user from Supabase Auth fails once that user has signed up.
- Links from saved calculations and analyses to a machine or test setup are owner-checked but not activity-checked: a client can link to its own soft-deleted (hidden) machine or setup. This is only a data-hygiene issue.
