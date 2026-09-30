# DATA-FOUNDATION AMENDMENT — ARCHITECTURE DESIGN (READ-ONLY)

**Read-only.** No repository, migration, SQL, test, specification or CSV change. Not an implementation.
- **Repository:** HEAD `4a404bed5148ef0abea86152ebb962c184f140aa`, 12 tags, clean.
- **Approved Value Foundation V1 specification** SHA-256: `a28cfddb7a5bb43f0767a5dd04ed0ea9acf67616c4b9f264b1ebc0e737560555`.

**Labels:**
- **FROZEN:** frozen evidence, with file:line
- **DESIGN:** proposed design
- **OWNER:** needs an owner choice

---

## 1. CURRENT WRITE PATH (FROZEN; DATA-FOUNDATION-1.0.0)

```
authenticated client (JWT; auth.uid())
  │ GRANT SELECT, INSERT ON value_records TO authenticated                  (0004:78)
  │ RLS  df_values_insert  FOR INSERT WITH CHECK (owner_id = auth.uid())    (0004:82)
  ▼
BEFORE INSERT triggers
  df_stamp     → server-forced recorded_at                                  (0003:136)
  df_validate  → df_value_validate(): field exists (DF_VALUE); unit = canonical_unit (DF_UNIT);
                 value kind matches (DF_KIND); supersession same machine/component/field/context
                 (DF_SUPERSEDE)                                             (0003:72–95, 137)
  ▼
table constraints (0002 value_records)
  owner_id NOT NULL DEFAULT auth.uid() → accounts
  values_machine_same_owner_fk (machine_id, owner_id) → machines
  values_component_same_machine_fk (component_id, machine_id) → components
  values_calculation_same_owner_fk; values_supersedes_same_owner_fk
  values_unknown_has_no_value; values_known_has_exactly_one; values_numeric_finite;
  values_option_nonempty; values_calculated_needs_calculation
  UNIQUE values_superseded_once (supersedes_id) — linear history              (0002:192)
  INDEX values_machine_field_ctx_idx (machine_id, canonical_field, context)   (0002:193)
  ▼
append-only: df_append_only (UPDATE/DELETE), df_no_truncate                   (0003:138–139)
reads: df_values_select USING (owner_id = auth.uid())                         (0004:81)
```

**Gaps relevant to the trusted path (FROZEN):**
- **No soft-delete check:** `df_value_validate` doesn't check `machines.deleted_at` or `garages.deleted_at`. A value can be inserted for a soft-deleted machine.
- **The unit check compares strings only.**
- **No numeric-conversion check.**
- **Any provenance and context allowed:** the database permits every `provenance_enum` and `value_context_enum` value, subject to the calculation-link and unknown rules.

**SECURITY DEFINER functions in DATA-FOUNDATION (FROZEN):** `df_handle_new_auth_user` (sign-up) and the four Decision-B soft-delete functions. All have `SET search_path = ''`; EXECUTE is revoked and re-granted narrowly (`0004:155–157`). **None writes values.**

**Tests relying on direct authenticated INSERT (FROZEN):** 29 statements in `data-foundation/tests/df.test.js` (lines 156, 170, 198–200, 228–237, 240–250, 270, 273, 277, 280, 282), some expanding in loops. They prove, via client inserts:
- ownership (198–200)
- unknown vs zero (228–232)
- kind (233–236)
- finiteness (237)
- unit (240–241)
- calculated / derived links (244–246)
- provenance (247–250)
- server timestamps (270)
- supersession (273–282)

**No client code exists** that depends on direct inserts: no hosted deployment (#6 open).

## 2. REQUIRED FUTURE WRITE PATH (DESIGN, per the approved specification §P)

```
authenticated user ──(value, unit, key, machine_id, provenance)──► TRUSTED VALUE-WRITE SERVICE (service role)
   1 owner  = verified auth context (never from the request)                      [CALCULATION-FOUNDATION D6 precedent]
   2 key    ∈ admitted V1 set (47); value_kind numeric                            [spec §D]
   3 machine: SELECT … WHERE m.id=$1 AND m.owner_id=$owner AND m.deleted_at IS NULL
              AND g.deleted_at IS NULL FOR SHARE OF m,g                           [reuses CALCULATION-FOUNDATION repository.js:10–14]
   4 component_id = NULL (machine-level V1)                                        [spec §L]
   5 context = 'specification'; provenance ∈ {user_entered, manufacturer_specified,
              estimated, measured(static), unknown}                                [spec §J, §M]
   6 unknown  → no numeric value, provenance unknown (frozen checks)
      known   → finite number required; unit ∈ the key's valid input units;
              exact conversion (spec §H) → finite result → storage unit           [spec §H]
   7 current value: lock (machine, key, context); set supersedes_id = current head (if any)
   8 INSERT (service role) → frozen triggers/constraints/FKs remain the backstop
   ▼
value_records (engine-native, append-only) ─► current-value read helper ─► value→engine adapter (no conversion) ─► frozen calculation service
```

**The client isn't authoritative.** It may convert only for immediate display.

**No new business rules:** every rule above comes from the approved specification or the frozen CALCULATION-FOUNDATION precedent.

## 3. EXACT DATA-FOUNDATION CHANGES

**The minimum is two statements against existing objects. No new tables, columns, functions, triggers or indexes.**

| # | Object | Current (FROZEN) | Future | Reason | Additive? | Migration | Rollback | Security | Tests |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Privilege `INSERT` on `public.value_records` for `authenticated` | granted (`0004:78`) | **revoked** (`SELECT` kept) | withdraw direct client inserts (spec §P) | privilege withdrawal (not additive; no data affected) | `REVOKE INSERT ON public.value_records FROM authenticated;` (idempotent) | `GRANT INSERT … TO authenticated;` | client INSERT fails with 42501 before RLS | the denial tests (§11) |
| 2 | Policy `df_values_insert` | exists (`0004:82`) | **dropped** | removes a now-inert permissive policy, as the approved specification requires | object removal | `DROP POLICY IF EXISTS df_values_insert ON public.value_records;` | re-create verbatim from `0004:82` | no permissive client-insert policy remains | catalog assertion |

**Unchanged:**
- `df_values_select`
- all triggers (`df_stamp`, `df_validate`, `df_append_only`, `df_no_truncate`)
- all constraints, foreign keys and indexes
- enums, `canonical_fields`, `calculation_records`, Decision-B functions and the sign-up trigger

**Alternative considered and not recommended:** an additive `CREATE POLICY … AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false)`. It touches no frozen object, but it leaves the INSERT privilege and `df_values_insert` in place. That **deviates from the approved specification §P** ("withdraw … and remove `df_values_insert`") and gives weaker defence (policy-level, not privilege-level). It's available only if the owner prefers a strictly additive migration.

## 4. FROZEN BASELINE PRESERVATION

**DATA-FOUNDATION-1.0.0 stays untouched,** including:
- the tag `DATA-FOUNDATION-1.0.0` → `fbcebc4`
- the `data-foundation/` directory (byte-identical)
- migrations 0001–0005
- `df.test.js`
- evidence (219 / 219, `evidence/test-results.json`)

**Its suite remains reproducible against the frozen baseline** (1.0.0 migrations only).

**The amendment receives its own version, directory, migration, tests, evidence and tag (§12).** It's applied on top of 1.0.0. **By design, the 1.0.0 suite isn't run against an amended database;** that would exercise the withdrawn privilege. The amendment suite re-proves the preserved guarantees (§11).

## 5. SECURITY MODEL

| Threat | Prevention |
|---|---|
| Direct client INSERT bypass | privilege revoked (§3-1); error 42501 |
| Client-supplied owner spoofing | the service derives the owner from verified auth context, never from the request (CALCULATION-FOUNDATION D6 precedent). The frozen composite FK `values_machine_same_owner_fk` binds owner and machine |
| Writing another user's machine | the active-machine check filters `m.owner_id = owner` (step 3), plus the composite FK |
| Writing another user's value | values are append-only; supersession goes through the same-owner FK and `DF_SUPERSEDE` |
| Soft-deleted machine or garage | step 3: `deleted_at IS NULL` on both, `FOR SHARE` against a concurrent Decision-B delete. **This closes the frozen gap in §1** |
| Invalid field | service allowlist (47 admitted keys) + frozen `DF_VALUE` |
| Wrong canonical unit | service conversion to the storage unit + frozen `DF_UNIT` backstop |
| Provenance / context bypass | service allowlist (V1: `specification`; 5 provenances; no `calculated` / `derived`) + frozen checks (unknown ⇔ no value; calculated / derived need a calculation) |
| SECURITY DEFINER escalation / `search_path` | **no new SECURITY DEFINER function** is required (§5a) |
| Unauthorized function execution | no new function; the Decision-B functions are unchanged |
| Service-role key exposure | the key is held server-side only, never shipped to a client (the existing CALCULATION-FOUNDATION assumption) |

**5a. Service-role application code vs a SECURITY DEFINER function** (DESIGN recommendation: **service-role application code**):
- **The CALCULATION-FOUNDATION precedent:** a service-role library plus a trusted owner.
- **Deterministic binary64 conversion** in one runtime.
- **No new SQL attack surface,** and no dependency on the hosted SECURITY DEFINER owner-bypass question (#6).
- **If a SECURITY DEFINER function were chosen instead,** it would need all of the following, and it would inherit #6:
  - `SET search_path = ''`
  - `REVOKE ALL … FROM PUBLIC`
  - EXECUTE granted to a single role
  - owner derived from `auth.uid()`
  - the same validation steps

**Hosted verification** (existing open item #6): confirm `service_role` table privileges and RLS bypass on hosted Supabase before deployment. That's a deployment gate, not a design blocker.

## 6. NORMALIZATION CONTRACT (reconciled with D-002)

**Where it lives:** the trusted service, not the database. **The DATA-FOUNDATION amendment contains no conversion logic.**

1. **Receive** the value and unit.
2. **Validate the unit** against the key's valid input units (spec §D / `VALUE-FOUNDATION-V1-FINAL-ADMISSION-48.csv` `valid_input_display_units`).
3. **Convert exactly** to the key's storage unit (spec §H): divide or multiply by the exact factor, never a rounded reciprocal.
4. **Precision contract:** **no rounding on write** (binary64 exact product).
   - **G-1** (6 significant digits) and **G-2** (half away from zero) are **display-only** and aren't applied by the write path.
5. **Reject** unsupported units, non-finite inputs, and non-finite or out-of-range results.
6. **Persist** only the normalized engine-native value.
7. **Explicit zero is preserved** (a known 0).
8. **No default is ever substituted;** unknown is written as no value with provenance `unknown`.

**Also in force:**
- **G-3:** `canonical_fields.dimension` is NULL (seed concern).
- **G-5:** the entered unit or value isn't stored; `source` keeps its frozen channel meaning.
- **The F1 page conversion layer isn't used** (defects D-1 / D-2).

**OPEN (engineering, minor):** negative zero (−0). The approved specification is silent. The recommendation is to normalize −0 to +0 before storage (numerically equal; avoids a signed-zero display artefact). **It needs confirmation.**

## 7. CURRENT-VALUE SEMANTICS

**At the database level (FROZEN):** "current" = the newest non-superseded row per (machine, component, field, context) (`DATA-FOUNDATION.md` line 62). This is backed by:
- `values_superseded_once`, which enforces linear history
- `DF_SUPERSEDE`, which enforces same machine / component / field / context
- `values_machine_field_ctx_idx`, which serves the lookup

**Required mechanisms:**
- **No schema change, index, constraint or view is required.**
- **A read helper** (service query) selects rows for (machine, key, `specification`) with no successor:

  ```
  NOT EXISTS (SELECT 1 FROM value_records s WHERE s.supersedes_id = v.id)
  ```
- **A write discipline** (service):
  - take a transaction-scoped advisory lock on (machine, key, context)
  - read the current head
  - insert with `supersedes_id = head`

  This keeps a single chain head, so no timestamp ties can arise. **A concurrent double-supersede is already rejected by the frozen unique index,** and the service retries.

**Not introduced:** provenance priority, active value, configuration versions, `input_value_ids`.

## 8. VALUE CONTEXT AND PROVENANCE

**The schema permits** (FROZEN):
- **context:** `specification` or `operating_state`
- **provenance:** all 8 values, with `calculated` / `derived` requiring a `calculation_id`, and `unknown` ⇔ no value

**V1 restriction** (`specification`; `user_entered`, `manufacturer_specified`, `estimated`, `measured` (static), `unknown`) is **enforced by the trusted service.**

**No schema change:** tightening the enums or adding checks would constrain future approved phases (e.g. `operating_state`), and it isn't required once clients can't insert directly.

## 9. MIGRATION SAFETY (concept only; not created)

**One migration file, a single transaction:**

```
BEGIN;
  REVOKE INSERT ON public.value_records FROM authenticated;          -- idempotent
  DROP POLICY IF EXISTS df_values_insert ON public.value_records;    -- idempotent
  -- post-conditions (abort the transaction if any fails):
  --   NOT has_table_privilege('authenticated','public.value_records','INSERT')
  --   has_table_privilege('authenticated','public.value_records','SELECT')
  --   policy df_values_select exists; df_values_insert absent
  --   triggers df_stamp, df_validate, df_append_only, df_no_truncate present
COMMIT;
```

| Property | How it's met |
|---|---|
| Additive where possible | yes, apart from the two approved withdrawals |
| Idempotent | a repeat run is a no-op; the post-conditions still hold |
| Deterministic | yes |
| Partial-execution safe | single transaction |
| Reversible | the rollback script restores the grant and re-creates `df_values_insert` verbatim from `0004:82` |
| Compatible with 1.0.0 | applies on top; no 1.0.0 file is edited |

**Existing data: none requires migration** (FROZEN). `canonical_fields` is empty in 1.0.0, and `value_records.canonical_field` references it, so **no 1.0.0 database can contain value rows.**

## 10. VALUE FOUNDATION SEED SUPPORT

**The amended schema supports the approved seed exactly,** with **no schema change** (FROZEN `canonical_fields` DDL, `0002`):

| Requirement | Where it's met |
|---|---|
| Canonical field identity | `key` matches `^[a-z][a-z0-9_]*$` (all 47 keys comply) |
| Storage unit | `canonical_unit` NOT NULL (`in`, `:1`, `lbf`, `cc`, `gal`, `sq in`, `sq ft`, `kWh`, `TPI`, `°`) |
| Value kind | `numeric` (Phase 1 has no categorical) |
| Family | `family` NOT NULL (each admitted field carries exactly one family) |
| Dimension | NULL (G-3) |
| Description | the quantity definition |
| Allowed input units | **not a database column.** Held by the trusted service's conversion configuration (spec §D / §H). Not a blocker: the approved specification places the conversion table there |
| Specification context, provenance, ownership, machine linkage, current value | existing `value_records` columns, foreign keys and rules |

**The seed itself belongs to the Value Foundation milestone** (reference data is written only by migrations, `0004`), not to this amendment.

**Blockers: none.**

## 11. TEST PLAN (design; not implemented)

**The amendment suite** (DATA-FOUNDATION-1.1.0) runs on a throwaway PostgreSQL 16 with migrations 1.0.0 + amendment:

- **SECURITY**
  - an authenticated owner's INSERT on `value_records` is rejected (42501)
  - user B and anon are rejected
  - authenticated SELECT of own rows still works; another owner's rows are hidden
  - catalog checks: the privilege matrix; `df_values_insert` absent; `df_values_select` present; the four triggers present
  - the service role can insert
- **CONSTRAINT PRESERVATION MATRIX:** each of the 29 frozen value checks (with loops expanded) is re-executed **as the service role**, expecting the same constraint outcome:
  - unknown ≠ zero
  - finiteness
  - kind
  - canonical unit
  - calculated / derived links
  - provenance acceptance and rejection
  - server `recorded_at`
  - supersession (chain, once-only, cross-field, cross-context)
  - append-only UPDATE / DELETE / TRUNCATE refusals

  Ownership checks 198–200 are restated as service-path tests: a spoofed owner or foreign machine is rejected by the composite FK.
- **MIGRATION:**
  - idempotent re-run
  - failed post-condition → rollback
  - the rollback script restores the 1.0.0 behaviour (a fresh 1.0.0 comparison)

**The Value Foundation service suite** (VALUE-FOUNDATION milestone; normalization lives there):
- **UNITS:**
  - every approved §H vector, bit-reproducible, with the exact storage result
  - a wrong or unsupported unit rejected
  - non-numeric, NaN and ±Infinity rejected
  - −0 per the §6 decision
  - explicit zero preserved
- **PRECISION:**
  - no write rounding
  - division by the exact factor (no rounded reciprocal)
  - display: 6 significant digits; half away from zero, including boundary and binary cases (1.005)
- **SEMANTICS:**
  - UNKNOWN ≠ ZERO
  - no silent default
  - newest non-superseded selection
  - append-only
  - superseded rows retained
  - the concurrent-writer lock
  - a soft-deleted machine or garage rejected
  - `component_id` non-NULL rejected
  - the non-V1 context / provenance allowlist
- **NEGATIVE CONTROLS** (mutants; each must be detected):
  - a migration without the `REVOKE`
  - a policy not dropped
  - the service accepting a client owner
  - skipping the soft-delete check
  - a rounded reciprocal
  - rounding on write
  - the allowlist bypassed

**Regression** (current exact counts at HEAD `4a404be`, **all equal to their frozen baselines**; nothing has been amended):

| Suite | Result |
|---|---|
| F1 | 28 / 28 |
| DATA-FOUNDATION-1.0.0 | 219 / 219 (on the 1.0.0 baseline only) |
| MAPPING | 83 / 83 + generation check |
| GARAGE | 81 / 81 + 28 / 28 mutants |
| CALCULATION | 106 / 106 + 21 / 21 mutants |

**Plus:**
- GARAGE and CALCULATION re-run on the combined database (1.0.0 + amendment + GARAGE migrations) with outcomes unchanged. Neither uses client value inserts; confirm at implementation.
- The isolation gate: all 12 tags, and every frozen directory byte-identical.
- 3-run determinism.
- Fresh-clone verification.

## 12. DELIVERY VEHICLE (proposal)

| Item | Proposal |
|---|---|
| Amendment name | **DATA-FOUNDATION value-write boundary amendment** |
| Version / tag | **`DATA-FOUNDATION-1.1.0`**. OWNER: strict semver treats withdrawing a client privilege as breaking, which would make it `2.0.0`. 1.1.0 is defensible because no deployed client depends on the privilege (§1) |
| Directory | **`data-foundation-1.1.0/`** (new; `data-foundation/` untouched) |
| Migration | **`data-foundation-1.1.0/supabase/migrations/0201_value_write_boundary.sql`** (range 02xx; existing: DATA-FOUNDATION 0001–0005, GARAGE 0101–0103) + `0201_value_write_boundary.rollback.sql` |
| Tests | `data-foundation-1.1.0/tests/` |
| Evidence | `data-foundation-1.1.0/evidence/` |
| Documents | a specification, design and changelog in that directory |
| Sequencing | the **standalone milestone before** the Value Foundation milestone (recommended), rather than bundled into it. Clean evidence and an independent gate |
| Future VF seed range | `03xx` (VALUE-FOUNDATION milestone) |

## 13. IMPLEMENTATION DEPENDENCIES

**A. Must exist before Value Foundation implementation:**
- the `DATA-FOUNDATION-1.1.0` amendment authorized, implemented, verified and tagged
- J-pipe engineering sign-off (spec §V)
- the conversion table and 48-field seed confirmed as implementation inputs
- the −0 decision

**B. Built as part of the Value Foundation milestone:**
- the trusted value-write service (§2 / §5a)
- the current-value read helper and write discipline (§7)
- the seed migration (03xx, 47 keys)
- the value → engine adapter
- the service test suite

**Deployment gate (not implementation):** hosted #6 confirmation.

**C. Deferred (not pulled in):**
- Test Setup
- Component Attribution
- measured test results
- correlation and active values
- configuration versions
- `input_value_ids`
- the currency / financial domain
- no-unit fields
- broad Phase-2 admission

## 14. FINAL GATE

**DATA-FOUNDATION AMENDMENT DESIGN: READY** (for owner review).

- **A. Exact changes:** `REVOKE INSERT ON public.value_records FROM authenticated;` and `DROP POLICY IF EXISTS df_values_insert ON public.value_records;`
- **B. Objects affected:** the `authenticated` INSERT privilege on `public.value_records`; policy `df_values_insert`. Nothing else.
- **C. Security changes:** client value inserts withdrawn. Writes go only through the service role (owner from verified context; the active-machine rule with soft-delete checks; field, unit, context and provenance allowlists). No new SECURITY DEFINER.
- **D. Normalization contract:** in the trusted service. Exact factors, no write rounding, rejection of invalid input, zero preserved, no defaults. G-1 / G-2 are display-only.
- **E. Migration concept:** a single-transaction, idempotent migration with post-conditions and a verbatim rollback; no data migration (§9).
- **F. Test plan:** the amendment suite (security + the constraint-preservation matrix + migration), the Value Foundation service suite, negative controls, frozen regressions (§11).
- **G. Release / version:** `DATA-FOUNDATION-1.1.0`, `data-foundation-1.1.0/`, migration `0201`, a standalone milestone before the Value Foundation.
- **H. Dependencies:** §13.
- **I. Unresolved (owner / engineering choices, not blockers):**
  1. Version `1.1.0` vs `2.0.0`.
  2. −0 normalization (recommended: normalize to +0).
  3. Confirm service-role application code over a SECURITY DEFINER function (recommended).
  4. Confirm standalone sequencing (recommended).
- **J. Implementation risks:**
  - hosted service-role privileges (#6)
  - custody of the service-role key
  - the 1.0.0 suite can't run against an amended database. That's expected; it's covered by the preservation matrix
  - future phases (e.g. `operating_state`) must also write through the trusted path
  - advisory-lock contention (low; single-owner writes)

**Authorization statement:** this design authorizes nothing. It defines the exact DATA-FOUNDATION amendment for separate owner approval. Implementation of the amendment and of the Value Foundation each require their own explicit authorization.

**DATA-FOUNDATION AMENDMENT SPECIFICATION READY FOR OWNER REVIEW**
