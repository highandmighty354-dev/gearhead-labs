# PREMIUM-FOUNDATION 1.0.0 (PREPARED AND TESTED LOCALLY · NOT APPLIED)

The Premium database layer: accounts' profiles, Free/Premium entitlements, Stripe-ready billing, saved calculations, the Engineering Lab store, and the automotive-only block. It comes after CORE-ENGINE-BASELINE → DATA-FOUNDATION → MAPPING-FOUNDATION → GARAGE-FOUNDATION in the approved sequence.

**Status:** built and tested against throwaway local PostgreSQL only. **Nothing has been applied to the Supabase project** `jmztpjudwzjvrcdtjynd`, which was verified empty (read-only inspection, 2026-10-05). Applying requires explicit owner approval (see `supabase/PROVISIONING.md`).

## Owner decisions implemented (2026-10-05)

| # | Decision | Where |
|---|---|---|
| 1 | Free: 1 machine, no saved calculations | `0404` restrictive allowance policy; `0405` feature-gated policies; plans seed in `0402` |
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

Frozen files are copied byte-for-byte from tag `VALUE-FOUNDATION-1.0.0`; `supabase/FROZEN-SOURCES.sha256` records each hash and the suite re-verifies them against the tag. Each new migration is one transaction, idempotent, ends in post-conditions that abort on any deviation, and has a rollback in `supabase/rollback/`.

## Security model (new objects)

| Object | Client SELECT | Client INSERT | Client UPDATE | DELETE |
|---|---|---|---|---|
| profiles | own | — (sign-up trigger) | own display columns | refused (trigger) |
| machine_details | own, machine visible | own machine | descriptive columns | refused |
| machines (frozen) | unchanged | **+ restrictive: Free ≤ 1 active** | unchanged (marine columns withdrawn) | soft delete |
| saved_calculations | own, active | own + `saved_calculations` feature | title/notes/pinned/links + feature | soft-delete function |
| engineering_analyses | own, active | own + `engineering_lab` feature | inputs/title/notes/links + feature | soft-delete function |
| engineering_analyzers, plans, plan_prices | authenticated | — | — | refused |
| subscriptions, entitlement_grants | own | — | — | refused |
| billing_customers, stripe_events | — | — | — | refused |

- **Entitlements cannot be self-granted:** no client privilege or policy on any billing/entitlement table, revoked even from Supabase's default grants; `pf_grant_manual`, `pf_revoke_grant`, `pf_record_stripe_event`, `pf_mark_stripe_event_processed`, `pf_upsert_billing_customer`, `pf_sync_stripe_subscription` are executable by `service_role` only.
- **Grants are an audit trail:** only `ends_at` (before revocation) and `revoked_at` (once) can change, for every role including the owner; no DELETE/TRUNCATE.
- **One access check:** `pf_has_feature(feature)` reads only `auth.uid()`'s active, unrevoked, in-window grants on active plans.
- **Free allowance** is serialised by a per-account advisory lock (concurrency-tested) and counts only active machines in active garages; foundation soft deletion is permanent, so it cannot be evaded by reviving rows.
- **SECURITY DEFINER** functions all pin `search_path = ''`, are owned by `postgres` (on hosted Supabase: non-superuser **with BYPASSRLS**, verified read-only on the live project), and are not executable by `anon`.

## Stripe readiness (no Stripe code or keys)

A future Edge Function (service role; Stripe secrets in Supabase function secrets) calls: `pf_record_stripe_event` (idempotent: `false` on replay) → `pf_upsert_billing_customer` → `pf_sync_stripe_subscription` (mirrors the subscription; `active|trialing|past_due` with a future period end → one open grant to period end; anything else → revoked; plan change → revoke + replace) → `pf_mark_stripe_event_processed`. Prices are added to `plan_prices` by migration when products exist.

## Run the tests

```
cd premium-foundation
npm install          # pg 8.13.1
npm test             # = ./tests/run-tests.sh  (throwaway local PostgreSQL >= 14; never a real project)
```

The runner starts a cluster owned by `supabase_admin`, applies the test-only shim `tests/sql/000_hosted_supabase_shim.sql` (hosted role model + Supabase default privileges), applies every migration as the non-superuser `postgres`, runs all checks in rolled-back transactions, a real two-connection concurrency test, an idempotency test, a migration-order test, and 16 negative controls. Results: `evidence/test-results.json`.

## Open items (not decided here)

- Free users may still create Test Setups (Builds) on their one machine; gating Test Setups would amend frozen GARAGE-FOUNDATION policies and needs a decision.
- `past_due` keeps access until the period end; no extra grace period (decision P-7 open).
- `plans` / `plan_prices` are readable by signed-in users only, not `anon` (a public pricing page would need a decision, like OPEN #17).
- Account deletion (OPEN #10) is unchanged: profiles, grants and billing rows are retained.
