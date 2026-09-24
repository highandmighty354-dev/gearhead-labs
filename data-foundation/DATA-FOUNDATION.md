# DATA-FOUNDATION 1.0.0

The canonical engineering data layer: Phase 1 of the approved sequence
CORE-ENGINE-BASELINE → **DATA-FOUNDATION** → MAPPING-FOUNDATION → GARAGE-FOUNDATION → PREMIUM-FOUNDATION → …

It covers a Postgres/Supabase schema, database-level integrity, row-level security, the formula-version catalog, and a deterministic local test suite.
- **It is independent of the F1 application.** Nothing under `data-foundation/` is loaded by the Free page, and no F1 file is modified.
- **Protected baseline:** `F1.12.3-UI-MOBILE-HEADER`, page SHA-256 `02b0ceee…ec102c27`.

**Out of scope, not implemented:** Premium UI and entitlement, Stripe, hosted Supabase deployment, My Garage UI, Test Setups, the mapping registry, the Calculation API, localStorage migration, and Free/Premium gating.

## Run it

```
cd data-foundation
npm install                 # jsdom 24.1.3, pg 8.13.1 (pinned in package-lock.json)
npm test                    # = ./tests/run-tests.sh
```

- **What the runner does:**
  - starts a **throwaway local PostgreSQL** cluster (PostgreSQL 14 or newer; set `PG_BIN` if the binaries aren't found)
  - runs the engine-catalog check against the tagged baseline
  - applies the Supabase test shim and migrations 0001–0005 to a fresh database
  - runs the suite, then deletes the cluster
- **Results:** `evidence/test-results.json`, one line per check.
- **Regenerate the catalog** after a future F1 release: `npm run catalog`. **Verify it only:** `npm run catalog:check`.

## Migrations (`supabase/migrations/`, idempotent, applied in order)

| File | Contents |
|---|---|
| `0001_enums.sql` | 8 enums, architecture vocabulary only: machine_type, marine_type, propulsion, power_source (§4); component_kind (Directive §10); provenance (§5 plus Directive `estimated`); value_context (§6/§9/§20); result_state (§8) |
| `0002_tables.sql` | 10 tables: accounts, garages, machines, components, component_connections, canonical_fields, calculators, formula_versions, calculation_records, value_records. Each has composite `(parent, owner_id)` foreign keys; the UNKNOWN ≠ ZERO checks; soft-delete columns; the specified indexes |
| `0003_constraints_triggers.sql` | Rules that hold for **every role**, including the superuser. See the rules list below. |
| `0004_rls.sql` | RLS **enabled and forced** on all 10 tables; privileges revoked and re-granted narrowly (column-level UPDATE grants); owner policies from `auth.uid()`; **Decision B** soft-delete functions |
| `0005_reference_seed.sql` | **Generated** from the tagged F1 engine: 583 calculators (577 registry + 6 aliases), 577 formula versions, 252 engine-proven. `canonical_fields` is **not** seeded (OPEN #16). |

**The rules in `0003`:**
- server-forced timestamps
- `owner_id` and identity columns immutable
- values and calculations **append-only** (no UPDATE, DELETE or TRUNCATE)
- formula versions never altered or deleted
- hard DELETE refused on garages, machines, components and connections
- a value's unit must equal the canonical engine-native unit, and its kind must match the field
- supersession stays on one machine / component / field / context
- a calculation's `canonical_id` must match the catalog, and its referenced values must be the owner's
- the server-side sign-up trigger creates the account

`tests/sql/000_supabase_shim.sql` is **test-only**: it recreates `auth.users`, `auth.uid()` and the `anon` / `authenticated` / `service_role` roles for local Postgres. It is never applied to a real Supabase project.

## Value model (UNKNOWN ≠ ZERO)

- **Unknown** = `numeric_value IS NULL AND option_value IS NULL AND provenance = 'unknown'`.
- **Known** = exactly one representation, matching the field's `value_kind`, with `provenance <> 'unknown'`.
- **Zero is a known value.**
- **Non-finite numbers** (NaN, ±Infinity) are never known values, consistent with the engine contract.
- **Units:** `unit` must equal `canonical_fields.canonical_unit`, the engine-native unit (D-002). No display conversions are stored.
- **Provenance** is one of: `calculated`, `measured`, `manufacturer_specified`, `user_entered`, `derived`, `empirical`, `estimated`, `unknown`.
  - `calculated` and `derived` require `calculation_id`: a derived value is stored only linked to the Calculation that produced it.
  - There is **no `imported` category.** An import keeps the value's original provenance and records the channel in `source`.
- **Context:** `specification` or `operating_state`.
- **History:** values are immutable. A correction is a new row with `supersedes_id`, and each value can be superseded at most once. The current value is the latest non-superseded row per (machine, component, field, context).

## Calculation history

- **Each record stores the §57 contract:**
  - calculator id and catalog canonical id
  - engine version, formula registry and **`fv1` fingerprint**, with a foreign key to `formula_versions`
  - the exact engine input object
  - `input_value_ids`
  - result state, outputs, missing inputs and warnings
  - optional machine context
  - `request_id`, unique per owner (idempotency)
  - server timestamp
- **Immutable for every role.** Recalculation creates a new record.
- **Clients cannot insert** until the future Calculation API exists (OPEN #12). The tests use the service role as the controlled path.

## Row-level security

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| accounts | own | server trigger only | none | none |
| garages | own, not deleted | own | own active row; `name`, `deleted_at` columns | none (soft delete, below) |
| machines | own, not deleted, garage not deleted | own + own garage | own active row; identity columns + `deleted_at` | none |
| components | own, not deleted, machine visible | own + own machine | own active row; descriptive columns + `deleted_at` | none |
| component_connections | own, not deleted, machine visible | own + own components | own active row; `deleted_at` only | none |
| value_records | own | own + own machine | none | none |
| calculation_records | own | **none** (server path only) | none | none |
| canonical_fields, calculators, formula_versions | authenticated (anon read OPEN #17) | none | none | none |

`anon` has no access to any table.

## Decision B: owner soft delete

**The problem:** the SELECT policies hide soft-deleted rows. Postgres checks an UPDATE's new row against the SELECT policy whenever the UPDATE reads the table (any `WHERE`). So an owner could not set `deleted_at` with a normal `UPDATE … WHERE id = …`. This was proven on a scratch database, and is now pinned by a test.

**The mechanism** (semantics unchanged): four **fixed-table** functions, `df_soft_delete_garage`, `df_soft_delete_machine`, `df_soft_delete_component` and `df_soft_delete_connection`, each taking `(p_id uuid)`.
- `SECURITY DEFINER` with `search_path = ''`. EXECUTE is granted to `authenticated` only, not to PUBLIC or `anon`.
- They require `auth.uid()` (otherwise `DF_AUTH`, 42501).
- They update only the row with `id = p_id AND owner_id = auth.uid() AND deleted_at IS NULL`, setting `deleted_at = now()` server-side.
- The existing triggers keep `owner_id` and `created_at` unchanged.
- They return nothing, so the row is never exposed.
- **Already-deleted, other users' and non-existent rows** all give the same `DF_NOT_FOUND` (P0002). Nothing changes, the original deletion time is never re-stamped, and the caller learns nothing about whether another user's row exists. This is the narrowest behaviour: the owner UPDATE policy already treats deleted rows as not modifiable.
- **No cascade is invented.** Children of a deleted parent are hidden by the existing SELECT policies, not re-stamped.
- **Deployment note:** a `SECURITY DEFINER` function must be owned by a role that bypasses RLS. Locally that's the superuser; on hosted Supabase it's the migration owner `postgres`. **Verify at provisioning (OPEN #6).**

**Recorded behaviour of the approved column grant:** an owner `UPDATE … SET deleted_at = …` **without** a `WHERE` clause skips the SELECT-policy check. It can soft-delete only the caller's own rows, never another user's (test-pinned). On that path the **client chooses the `deleted_at` value**. Whether to revoke the client column grant is OPEN #19; the grant is unchanged, as approved.

## Accepted deviations and implementation choices

1. **Component parent on the same machine** uses the composite FK `(parent_component_id, machine_id) → components(id, machine_id)` instead of a trigger. It's equivalent and stronger (accepted).
2. **`machines.garage_id` is not client-updatable:** a stricter ownership/integrity choice (accepted).
3. **Engine round-trip tests compare JSON by content, not bytes,** because `jsonb` doesn't preserve key order or whitespace (accepted).
4. **Test-only canonical fields** (`test_weight`, `test_bore`, `test_transmission`) exist only in the tests; the product seed stays empty (accepted).
5. **Decision B** soft-delete functions (above, approved).
6. **Two further constraints** are implied by the specification's own wording and recorded here:
   - a value can be superseded at most once, because "the latest non-superseded row" must be unique
   - known numeric values must be finite
7. **The idempotency test strips pg_dump's `\restrict` / `\unrestrict` lines.** pg_dump 16.10+ adds a random security token to each dump; nothing else is excluded.

## Engine integration

- **The engine is a read-only dependency.** `tools/export-engine-catalog.js` reads only the **tag** (`git show`) and verifies:
  - the page SHA-256 and the tag's `MANIFEST.sha256`
  - that the embedded engine is byte-identical to `gh-engine.js`
  - that page and Node engines agree for all 577 entries
  - 577 registry entries, 6 aliases, 252 migrated, 8 pending, engine 1.1.0
  - every fingerprint against the committed F1.12.2 snapshot
- **Values pass to the engine without conversion** (engine-native units).
- **NULL means unknown,** and the engine returns INCOMPLETE.
- **Categorical (D-009) values** are stored as the exact option value.
- **The field-to-input mapping is MAPPING-FOUNDATION.**

## localStorage (not migrated)

These are evidence only: `gearhead_d31_ghm_profiles`, `ghm_test_setups_v28`, `ghm_airflow_config_v28`, `ghm_r29_vehicle_intelligence_v1`. The D3.1 diesel key is UNKNOWN. No DOM-field-to-canonical mapping is defined; migration remains OPEN.

## Open decisions (unchanged; nothing resolved here)

1. Free My Garage allowance
2. Existing local vehicle-profile / D3.1 / R29 boundary
3. localStorage migration policy
4. Per-calculator Copy / Share / spec-sheet Export tier
5. AI analysis tier
6. Supabase / Stripe provisioning, including confirming that the SECURITY DEFINER owner bypasses RLS
7. Frontend hosting
8. `index.html` canonical deployment line
9. One vs several garages per user
10. Account deletion and user deletion of history
11. History retention
12. Calculation write path: server-only until the Calculation API
13. Recording calculators not proven by LIVE_PARITY
14. "Derived" vs "calculated"
15. An "imported" provenance category
16. `canonical_fields` seed scope and categorical vocabularies, including how to express a categorical field's unit (tests use `-`)
17. `anon` read of reference data
18. Measurement metadata
19. **New:** whether to revoke the client column grant on `deleted_at`, making the Decision B functions the only (server-timestamped) soft-delete path
