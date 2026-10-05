# PREMIUM-FOUNDATION — architecture design (FOR REVIEW · NOT IMPLEMENTED)

Status: **design only.** No SQL in this document has been applied anywhere. Nothing here changes a frozen baseline.
Position in the approved sequence: CORE-ENGINE-BASELINE → DATA-FOUNDATION → MAPPING-FOUNDATION → GARAGE-FOUNDATION → **PREMIUM-FOUNDATION** → …

---

## 1. Current state, verified (2026-10-05)

### 1.1 GitHub → Actions → Pages → Supabase

| Link | Finding | Evidence |
|---|---|---|
| Source of production | GitHub Pages, **classic "deploy from branch"** (`pages-build-deployment`) on **`main`** | Actions workflow list; last successful Pages run #117 on `e70f3d7` |
| Supabase config pipeline | `.github/workflows/prepare-supabase.yml` runs on push to `main`, reads Actions secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, writes `supabase-config.js` and **commits it to `main`** as `github-actions[bot]` | runs #1, #2 succeeded; bot commit `e70f3d7` |
| Client | `supabase-boot.js` creates `window.GH_SUPABASE` from **unpinned** `cdn.jsdelivr.net/npm/@supabase/supabase-js@2`, on every page load; only checks the session | `main:index.html`, `main:supabase-boot.js` |
| Project | `https://jmztpjudwzjvrcdtjynd.supabase.co/` with an `sb_publishable_…` key (public client key — acceptable in a static site) | `main:supabase-config.js` |
| Database contents | **Unknown from here.** This environment's network policy blocks `*.supabase.co` and `github.io`. No migration workflow exists; DATA-FOUNDATION lists hosted provisioning as OPEN #6. Most likely **no schema is applied yet**. Verify with §9.1. | proxy 403s; repo search |
| Secrets in Git | None found on any branch inspected. The publishable key is public by design. | scans in Phase 3A and this review |

### 1.2 Branch divergence (must be resolved before any deployment)

| Branch | Contents | Relationship |
|---|---|---|
| `main` (production) | pre-Phase-1 app + Supabase bootstrap (5 commits after `406d6a1`) | **still serves marine content** (Sea Ray record, "Diesel Marine", catalog E-15) and the engineering layer that registers 0 analyzers |
| `claude/gearhead-marine-cleanup-3mpo8t` | Phases 1, 2A–2C, 3A (`2ea8020`…`802f38d`) | forks at `406d6a1`; not merged; **edits the frozen F1.12.3 file in place** |
| `value-foundation-1.0.0` (+ tag) | F1.10.5→F1.12.3 history, GH_ENGINE, DATA/MAPPING/GARAGE/CALCULATION/VALUE foundations, owner decisions D-001…D-013 | **no common history** with the other two branches; its F1.12.3 is byte-identical to `main`'s (the frozen baseline) |

### 1.3 The existing database design (authoritative; reused, not replaced)

- **DATA-FOUNDATION 1.0.0** `0001–0005`: `accounts` (server-trigger created), `garages`, `machines`, `components`, `component_connections`, `canonical_fields`, `calculators`, `formula_versions`, `calculation_records`, `value_records`. Composite `(parent_id, owner_id)` FKs; RLS **enabled and forced**; privileges revoked then granted narrowly (column-level UPDATE); soft delete via fixed-table `SECURITY DEFINER` functions; values and calculations **append-only**; UNKNOWN ≠ ZERO; engine-native units (D-002).
- **DATA-FOUNDATION 1.1.0** `0201`: client INSERT on `value_records` withdrawn — **values are written only by trusted server code (service role).**
- **GARAGE-FOUNDATION 1.0.0** `0101–0103`: `test_setups` (Machine → Test Setup), same patterns.
- **CALCULATION-FOUNDATION 1.0.0**: the verified calculation service; **writes `calculation_records` only through the service-role path**; owner taken from trusted server context, never from the request. HTTP surface/hosting not built (OPEN #6).
- **VALUE-FOUNDATION 1.0.0** `0301`: seeds the 47 canonical quantity keys.

### 1.4 Conflicts this design must resolve

1. **Phase 3A schema is superseded.** `supabase/migrations/0001_premium_schema.sql` (my branch) collides with `0001_enums.sql` by number and diverges by design (`vehicles`/`builds`/`projects`, client-writable entitlement table). **It must not be applied.** This design replaces it.
2. **D-003** (no mandatory Project level; hierarchy User → Garage → Machine → Components → Labs → Test Setups → Calculations → Results) vs the Phase 3 brief (Vehicles, Builds, Projects).
3. **Automotive-only product** vs `machine_type_enum` (`marine`), `marine_type_enum` and marine `propulsion_enum` values in DATA-FOUNDATION 0001.
4. **E01–E14 are not in the engine catalog** (`calculators`/`formula_versions` hold the 577 F1 registry entries), so they cannot be stored as `calculation_records`.
5. **No trusted server exists** for the paths the foundations already require (value writes, calculation writes) — and Stripe needs one too. D-001 forbids self-managed servers.
6. **Two Supabase client configs**: `main` uses `window.GH_SUPABASE_CONFIG` / `window.GH_SUPABASE`; my branch's Premium layer reads `GHP_CONFIG.backend` and would create a second client.

---

## 2. Principles carried forward (non-negotiable)

1. **Owner decisions D-001…D-013 stand.** Supabase/Postgres, managed hosting only, Stripe later, engine-native storage units, no mandatory Project.
2. **Additive only.** Frozen migrations are never edited; changes to existing objects are separate, owner-approved amendment migrations with post-conditions and a rollback file (the `0201` pattern).
3. **Ownership from `auth.uid()` only; composite FKs** for every child so cross-user attachment is impossible even without RLS.
4. **RLS enabled and forced; revoke-all-then-grant-narrowly; no client DELETE** on durable user data (soft delete functions).
5. **Clients can never grant themselves access.** Anything that confers Premium, money or engineering truth is written by trusted server code or migrations only.
6. **Secrets live only in Supabase (Edge Function secrets) or GitHub Actions secrets** — never in the frontend or Git.

---

## 3. Trust boundaries

```
Browser (publishable key + user JWT)          — RLS-limited; reads own rows; writes only user-authored metadata
   │  supabase-js (single client: window.GH_SUPABASE)
   ▼
PostgREST / RPC  ── RLS + column grants + triggers (DB enforces every rule for every role)
   ▲
Supabase Edge Functions (service role, managed — satisfies D-001)
   ├─ calculation-api      wraps CALCULATION-FOUNDATION service: verifies JWT → owner → engine → calculation_records
   ├─ value-api            wraps DATA-FOUNDATION 1.1.0 value service → value_records
   ├─ billing-checkout     JWT → Stripe customer (create/reuse) → Checkout Session URL          (future)
   ├─ billing-portal       JWT → Stripe Customer Portal URL                                     (future)
   └─ stripe-webhook       Stripe signature → stripe_events (idempotent) → subscriptions → entitlement_grants  (future)
Migrations (CLI / SQL editor)                 — reference data: plans, calculators, formula_versions, canonical_fields
```

Secrets and where they belong:

| Secret | Location | Never |
|---|---|---|
| Service role key | auto-provided to Edge Functions by Supabase | frontend, Git, chat |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `supabase secrets set` (Edge Function secrets) | frontend, Git, chat |
| `SUPABASE_ACCESS_TOKEN`, DB password (only if CI applies migrations) | GitHub Actions **environment** secrets with required reviewer | repo files, chat |
| Publishable key, project URL | public (`supabase-config.js`) | — |

---

## 4. Domain mapping (Phase 3 product terms → foundation model)

| Product term (Phase 3 brief) | Foundation object | Notes |
|---|---|---|
| User | `auth.users` → `accounts` (existing) | |
| Profile | **new** `profiles` (1:1 `accounts`) | display data only |
| My Garage | `garages` (existing; one active per account, OPEN #9) | |
| Vehicle | `machines` (existing) with `machine_type` automotive family | descriptive identity (year/make/model/trim) needs a home → **new** `machine_details` (§5.2) — decision P-4 |
| Build | `test_setups` (existing) **or** new `builds` | decision P-5: a Test Setup is a pinned configuration of a Machine — closest existing concept |
| Components | `components` (existing) | |
| Engineering values (displacement, bore…) | `value_records` (existing, server-written) | not free-text vehicle fields |
| Saved calculation (606 Free calculators) | `calculation_records` (existing, immutable, server-written) + **new** `saved_calculations` (user metadata) | |
| Saved engineering analysis (E01–E14) | **new** `engineering_analyses` (inputs-first) | decision P-6 |
| Project | **deferred** (D-003). If approved: optional `projects` + link table | decision P-3 |
| Premium access | **new** billing + entitlement tables (§6) | |

---

## 5. PREMIUM-FOUNDATION schema (proposed migrations `0401`–`0406`)

Conventions for every new table: `owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES accounts(id) ON DELETE RESTRICT`; `UNIQUE (id, owner_id)`; composite FKs to parents; `created_at/updated_at` server-stamped (`df_stamp_insert` / `df_guard_update` reused); `deleted_at` + fixed-table soft-delete function where user-deletable; RLS enabled + forced; revoke all, grant narrowly.

### 5.1 `profiles` (0401)

| Column | Type | Client-writable |
|---|---|---|
| `account_id` | uuid PK → `accounts(id)` | no |
| `display_name` | text ≤ 80 | yes |
| `avatar_url` | text, `^https://`, ≤ 500 (later: Supabase Storage path) | yes |
| `location` | text ≤ 80, optional | yes |
| `experience_level` | enum `beginner|enthusiast|experienced|professional` | yes |
| `preferred_unit_system` | enum `imperial|metric` — **display preference only (D-002)** | yes |
| `favorite_machine_id` | uuid, composite FK `(favorite_machine_id, account_id)` → `machines(id, owner_id)` | yes |
| `created_at`, `updated_at` | server | no |

- Created by a **new** trigger `pf_on_auth_user_created` on `auth.users` (fires after `df_on_auth_user_created` — trigger order is alphabetical, `df_` < `pf_`), plus a one-time backfill for existing accounts. Email is **not** copied (it lives in `auth.users`; avoids drift).
- RLS: SELECT own; UPDATE own (column grants above); no INSERT/DELETE for clients.

### 5.2 `machine_details` (0402, decision P-4)

Descriptive identity of a Machine that is not an engineering value: `year` (1886–2100), `make`, `model`, `trim`, `nickname`, `notes`, `is_primary` (partial unique per owner). PK `(machine_id)`, composite FK `(machine_id, owner_id)` → `machines`. Client SELECT/INSERT/UPDATE own. Engine/displacement/power stay in `value_records`.

### 5.3 `saved_calculations` (0403)

User-authored organisation of immutable history — the record itself never changes.

| Column | Notes |
|---|---|
| `id`, `owner_id` | standard |
| `calculation_id` | composite FK `(calculation_id, owner_id)` → `calculation_records(id, owner_id)` |
| `machine_id`, `test_setup_id` | optional, composite FKs (same owner) |
| `title` (≤ 120), `notes` (≤ 2000), `pinned` | client-writable |
| `created_at`, `updated_at`, `deleted_at` | server / soft delete function |

RLS: SELECT own non-deleted; INSERT own **and** `pf_has_feature('saved_calculations')`; UPDATE own (column grants). The underlying `calculation_records` row is created only by `calculation-api`.

### 5.4 `engineering_analyses` (0404, decision P-6)

E01–E14 are not engine-registered, so their results are **not** engine-verified. Inputs-first design:

| Column | Notes |
|---|---|
| `analyzer_id` | CHECK in the 14 ids (or FK to a small `engineering_analyzers` reference table seeded by migration, with `analyzer_version`) |
| `analyzer_version` | e.g. `E1-AUTO` — results are reproducible only per version |
| `inputs` | jsonb object — **authoritative** (re-run on load; the bridge already does this) |
| `inputs_unit_system` | `imperial|metric` + canonical values per field (as captured today) |
| `result_snapshot` | jsonb, optional, labelled **client-reported, not engine-verified** |
| `machine_id`, `test_setup_id`, `title`, `notes` | composite FKs / client text |

RLS: SELECT own; INSERT/UPDATE own **and** `pf_has_feature('engineering_lab')`; soft delete function. Future: when E01–E14 are migrated into GH_ENGINE under D-006, new runs go through `calculation-api` and this table becomes legacy.

### 5.5 Projects (decision P-3, not in 0401–0406 unless approved)

If approved despite D-003's default: optional `projects` (`title`, `status`, optional `machine_id`) and `project_items` (polymorphic links to saved_calculations / engineering_analyses / test_setups via typed nullable FKs + CHECK exactly-one). Never a required parent.

---

## 6. Premium access and Stripe (0405–0406)

### 6.1 Model

```
plans (reference) ──< plan_prices (reference, Stripe price ids)
accounts ──1:1── billing_customers (stripe_customer_id)           server-only
accounts ──1:N── subscriptions (mirror of Stripe)                 server-written, owner-readable
accounts ──1:N── entitlement_grants  ◄── THE source of access     server-written, owner-readable
stripe_events (webhook idempotency log)                           server-only, no client access
pf_has_feature(feature) / pf_my_entitlement()                     the only access checks
```

| Table | Key columns | Client access |
|---|---|---|
| `plans` | `plan_key` PK (`free`, `premium`), `features text[]`, `active` | SELECT (authenticated; anon optional) |
| `plan_prices` | `stripe_price_id` PK, `plan_key` FK, `interval`, `active` | SELECT |
| `billing_customers` | `account_id` PK, `stripe_customer_id` UNIQUE, `created_at` | **none** |
| `subscriptions` | `stripe_subscription_id` PK, `account_id`, `status` (Stripe enum: `incomplete, incomplete_expired, trialing, active, past_due, canceled, unpaid, paused`), `stripe_price_id`, `current_period_start/end`, `cancel_at_period_end`, `trial_end`, `canceled_at`, `updated_at` | SELECT own (billing page) |
| `entitlement_grants` | `id`, `account_id`, `plan_key`, `source` (`stripe|manual|trial|promo`), `source_ref` (subscription id / ticket), `starts_at`, `ends_at` (NULL = open), `revoked_at`, `created_at`, `note` | SELECT own |
| `stripe_events` | `event_id` PK, `type`, `received_at`, `processed_at`, `payload jsonb` | **none** |

- **No client INSERT/UPDATE/DELETE on any billing or entitlement table**, enforced by revoked privileges *and* absent policies *and* `FORCE ROW LEVEL SECURITY`. TRUNCATE revoked explicitly.
- `entitlement_grants` is append-only except `revoked_at` (server). History is the audit trail.
- **Why grants instead of one mutable "plan" row:** Stripe, manual test grants, trials and promos coexist without overwriting each other; revocation is auditable; the webhook stays idempotent.

### 6.2 Access functions

```sql
-- design sketch, not applied
create function public.pf_has_feature(p_feature text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.entitlement_grants g
    join public.plans p on p.plan_key = g.plan_key and p.active
    where g.account_id = auth.uid()
      and g.revoked_at is null
      and g.starts_at <= now()
      and (g.ends_at is null or g.ends_at > now())
      and p_feature = any (p.features));
$$;
-- EXECUTE: revoke from PUBLIC, anon; grant to authenticated.
-- pf_my_entitlement(): returns (plan_key, features, ends_at, source) for the caller — what the frontend reads.
```

Premium features (initial): `engineering_lab`, `saved_calculations`, `garage_unlimited`, `test_setups`. The Free plan's garage allowance is decision P-1.

### 6.3 Stripe flow (future phase — no Stripe code now)

1. **Checkout:** frontend → `billing-checkout` (JWT) → reuse/create Stripe customer → `billing_customers` → Checkout Session (`client_reference_id = account_id`, `metadata.account_id`) → redirect.
2. **Webhook:** Stripe → `stripe-webhook` → verify signature (`STRIPE_WEBHOOK_SECRET`) → insert `stripe_events` (PK conflict ⇒ already processed, return 200) → upsert `subscriptions` → recompute that account's `stripe` grant: `active|trialing` ⇒ open/extend grant to `current_period_end` (+ grace for `past_due`, decision P-7); `canceled|unpaid|incomplete_expired` ⇒ set `ends_at`/`revoked_at` → mark processed.
3. **Portal:** `billing-portal` → Stripe Customer Portal for cancel/upgrade/payment method.
4. **Manual/test grants** (the Phase 3B Step 9 need): SQL editor or an admin Edge Function inserts `entitlement_grants (source='manual')`; revoke by setting `revoked_at`. No fake purchase flow.

---

## 7. RLS / privilege matrix (new objects)

| Object | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | own | trigger only | own (5 display cols + favorite) | none |
| machine_details | own | own + own machine | own (descriptive cols) | none |
| saved_calculations | own, not deleted | own + own calc + feature | own (title, notes, pinned) | soft-delete fn |
| engineering_analyses | own, not deleted | own + feature | own (title, notes, links, inputs) + feature | soft-delete fn |
| plans, plan_prices | authenticated | migration | migration | none |
| billing_customers | none | server | server | none |
| subscriptions | own | server | server | none |
| entitlement_grants | own | server | server (`revoked_at`) | none |
| stripe_events | none | server | server | none |

Existing objects: unchanged unless an amendment is approved (P-1, P-2).

---

## 8. Frontend integration (when implemented)

- **One client:** the Premium Supabase adapter uses `window.GH_SUPABASE` from `supabase-boot.js` (no second client, no duplicate URL/key in `premium/config.js`).
- Entitlement read = `rpc('pf_my_entitlement')`; gating = `features` from that RPC only.
- Repositories map to the foundation tables in §4 (machines, test_setups, saved_calculations, engineering_analyses, profiles); soft delete via the `*_soft_delete_*` RPCs.
- `allowQueryFlag: false` in production; development adapter only on localhost.
- Pin `supabase-js` to an exact version with Subresource Integrity; consider loading it only when an account feature is opened (Free visitors don't need it).

---

## 9. Verification plan

### 9.1 Read-only check of the live project (owner runs in SQL Editor)

```sql
select table_name from information_schema.tables where table_schema = 'public' order by 1;
select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
select schemaname, tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 2, 3;
select count(*) from auth.users;
```

### 9.2 Before release (local throwaway PostgreSQL + the foundation's test shim, like `garage-foundation/tests`)

- Every new table: RLS forced; anon sees nothing; User A ⟂ User B for SELECT/INSERT/UPDATE; cross-user attachment refused by composite FKs for every role, including the service role.
- **Entitlement non-escalation:** authenticated cannot INSERT/UPDATE/DELETE/TRUNCATE `entitlement_grants`, `subscriptions`, `billing_customers`, `stripe_events`; cannot EXECUTE anything that writes them.
- Feature gating: insert into `engineering_analyses` / `saved_calculations` fails without a grant, succeeds with a `manual` grant, fails again after `revoked_at`.
- Webhook idempotency: replaying an event changes nothing.
- Hosted check (OPEN #6): `SECURITY DEFINER` owner bypasses RLS on the real project.

---

## 10. Decisions required before implementation

| # | Decision | Recommendation |
|---|---|---|
| P-1 | Free garage allowance (OPEN #1): what can a Free account store? | Free: 1 machine, no saved calculations; Premium: unlimited. Enforce by amendment policy using `pf_has_feature('garage_unlimited')`. |
| P-2 | Automotive-only vs marine enums in DATA-FOUNDATION 0001 | If the schema is not yet provisioned: owner-approved amendment adding `CHECK (machine_type <> 'marine' AND marine_type IS NULL)` and restricting marine `propulsion` values. (Postgres cannot drop enum values safely.) |
| P-3 | Projects (D-003 says "add later if a real need appears") | Defer; Test Setups + saved items cover the Phase 3 use cases. |
| P-4 | Vehicle identity fields (year/make/model/trim) | Approve `machine_details` (descriptive, client-editable) — keep engineering values in `value_records`. |
| P-5 | "Build" = `test_setups`? | Yes: reuse Test Setups; no new `builds` table. |
| P-6 | E01–E14 persistence | `engineering_analyses`, inputs authoritative, snapshot labelled client-reported; plan engine migration under D-006. |
| P-7 | `past_due` grace period | 7 days, then grant ends. |
| P-8 | Trusted server host | Supabase Edge Functions (managed, satisfies D-001) for calculation-api, value-api and billing. |
| P-9 | Branch reconciliation | Rebuild the Phase 1–3A work on top of the frozen baseline as **F1.12.4** (new file + changelog + tag) instead of editing F1.12.3 in place; then merge to `main` through a reviewed PR. Retire `supabase/migrations/0001_premium_schema.sql`. |
| P-10 | Migration delivery | Manual (SQL editor) per migration with post-conditions, or a GitHub Actions workflow with environment-protected secrets and required approval. |
