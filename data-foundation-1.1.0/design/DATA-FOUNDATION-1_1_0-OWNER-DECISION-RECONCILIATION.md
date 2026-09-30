# DATA-FOUNDATION-1.1.0 — FORMAL OWNER DECISION RECONCILIATION

**Read-only.** Repository: HEAD `4a404bed5148ef0abea86152ebb962c184f140aa`, 12 tags, clean; unchanged.
- **Basis:** `DATA-FOUNDATION-AMENDMENT-DESIGN.md` and the frozen repository.
- **Companion:** `DATA-FOUNDATION-1.1.0-TEST-RECONCILIATION.csv` (29 rows).

## Owner decisions recorded

| # | Decision | Reconciles? | Evidence |
|---|---|---|---|
| 1 | Version **DATA-FOUNDATION-1.1.0** | yes | the tag family `DATA-FOUNDATION-1.0.0`, `GARAGE-FOUNDATION-1.0.0`, `MAPPING-FOUNDATION-1.0.0`, `CALCULATION-FOUNDATION-1.0.0` makes `DATA-FOUNDATION-1.1.0` consistent. No deployed client depends on direct INSERT (no hosted deployment; #6 open) |
| 2 | **−0 → +0** at the trusted write boundary | yes | the approved specification was silent (no conflict). Frozen `values_numeric_finite` accepts both. Normalizing before insert preserves "explicit 0 stays 0" (P4) |
| 3 | **Service-role application code; no new SECURITY DEFINER** | yes | the CALCULATION-FOUNDATION D1 / D6 precedent (service role + trusted owner). The design needs no database function |
| 4 | **1.1.0 before VALUE-FOUNDATION-1.0.0** | yes | the design's recommended standalone sequencing; the approved specification §V gate 4 requires the amendment first |

**No architectural contradiction was found.**

## Checks performed and results

1. **Versioning** is consistent with the existing tag naming. The 12 tags are unchanged. **PASS**
2. **Negative zero** is normalized in the service before insert; no schema change. **PASS**
3. **Trusted writer:** all 15 functions in the repository's migrations were enumerated. No new function is required or created. **PASS**
4. **Sequence:** 1.1.0 is a prerequisite of Value Foundation implementation (specification §V). **PASS**
5. **The two statements are sufficient.** See the security review below. **PASS**
6. **No silent object change:**
   - The amendment touches exactly the INSERT privilege (`0004:79`) and policy `df_values_insert` (`0004:83`).
   - It's delivered as a new migration. No existing migration file is edited.
   - Triggers, constraints, foreign keys, the index `values_machine_field_ctx_idx`, `df_values_select` and the soft-delete functions are unchanged.
   - No new index is required (current-value lookup is served by the existing index; design §7). **PASS**
7. **DATA-FOUNDATION-1.0.0 is immutable:**
   - `data-foundation/` is byte-identical to its tag (`fbcebc4`; 0 changed files).
   - Its evidence records 219 / 219.
   - The amendment lives in a new directory with its own version, tests and evidence. **PASS**
8. **The 29 direct-insert tests have a valid 1.1.0 strategy:**
   - **1.0.0:** they stay historical evidence, reproduced only against the 1.0.0 baseline.
   - **1.1.0:** each invariant is re-proven at two levels:
     - **S:** service-role SQL confirms the frozen database constraint still holds.
     - **T:** trusted-path behaviour.
   - **Line 198** becomes the new security test: an authenticated INSERT is **rejected** (42501).
   - **Where V1 is stricter than the database, the T level rejects** (e.g. `empirical` provenance, `operating_state`, `calculated` / `derived`, categoricals), **while the S level proves the generic database rule is unchanged.**

   Full map: `DATA-FOUNDATION-1.1.0-TEST-RECONCILIATION.csv`. **PASS**
9. **Active-machine protection is preserved:** the trusted path uses the exact CALCULATION-FOUNDATION rule (`repository.js` lines 10–14): `m.owner_id = owner AND m.deleted_at IS NULL AND g.deleted_at IS NULL … FOR SHARE OF m, g`. This closes the frozen gap: `df_value_validate` doesn't check soft deletion. **PASS**
10. **Normalization:**
    - exact factors, multiply or divide, no rounded reciprocal
    - no write rounding
    - −0 → +0
    - explicit 0 kept
    - invalid or non-finite input and results rejected
    - storage in the engine-native unit
    - F1 page code not used
    - G-1 / G-2 are display-only; G-3 `dimension` NULL; G-5 no entered unit stored. **PASS**
11. **Layout / numbering:**
    - Migrations follow the existing `<foundation-dir>/supabase/migrations/NNNN_name.sql` pattern.
    - The ranges in use are `0001–0005` (DATA-FOUNDATION) and `0101–0103` (GARAGE-FOUNDATION), so **`0201` is free and consistent.**
    - **Note (not a contradiction):** every existing foundation directory is unversioned (`data-foundation/`, `garage-foundation/`, `mapping-foundation/`, `calculation-foundation/`). **`data-foundation-1.1.0/` introduces the first version-suffixed directory.** It's acceptable and unambiguous, but the name should be confirmed at implementation authorization. **PASS, with note**
12. **The Value Foundation seed stays separate:** no `03xx` migration exists. The seed belongs to VALUE-FOUNDATION-1.0.0 in its own directory and range. **PASS**

## Security review: are all direct client write paths closed?

| Path | Finding (FROZEN, all repository migrations) |
|---|---|
| Table privileges | the **only** client write grant on `value_records` is `0004:79` (`SELECT, INSERT` to `authenticated`). All tables first have `REVOKE ALL … FROM anon, authenticated` (`0004:14`). No UPDATE, DELETE or TRUNCATE grant |
| Column-level grants | none on `value_records` (the only column-level grant in the repository is GARAGE-FOUNDATION `test_setups`, `0103:12`) |
| Default privileges / PUBLIC | none in the migrations |
| RLS policies | `df_values_select` (read own) and `df_values_insert` (to be dropped) |
| Views | none |
| Functions / RPC | 15 functions. **None writes `value_records`.** The six RPC-callable (void) functions write only `garages`, `machines`, `components`, `component_connections` and `test_setups`. The sign-up SECURITY DEFINER trigger writes only `accounts`. Trigger functions can't be called directly |
| Triggers | only validate or stamp; none inserts values |
| Ownership | the composite FK `values_machine_same_owner_fk` binds owner to machine at every write, including the service role |

**Result:** revoking INSERT (with the policy drop) **closes every direct client write path.** After 1.1.0, only the service role (which bypasses RLS) can write values.

**Residual (existing, not new):** hosted Supabase `service_role` privileges and RLS bypass must be confirmed (#6) before deployment.

## Remaining implementation gates

**Before DATA-FOUNDATION-1.1.0 implementation:**
- **An explicit implementation authorization for 1.1.0,** confirming the directory name (`data-foundation-1.1.0/`) and migration `0201_value_write_boundary.sql` plus its rollback.
- **The amendment test suite built per the design:** security, the S-level constraint-preservation matrix, migration idempotency and rollback, negative controls.
- **The frozen regressions:**

  | Suite | Result |
  |---|---|
  | F1 | 28 / 28 |
  | DATA-FOUNDATION-1.0.0 | 219 / 219 (on its baseline) |
  | MAPPING | 83 / 83 + check |
  | GARAGE | 81 / 81 + 28 mutants |
  | CALCULATION | 106 / 106 + 21 mutants |

  Plus combined-database GARAGE / CALCULATION runs, the isolation gate, determinism and fresh-clone checks.

**Before VALUE-FOUNDATION-1.0.0 implementation:**
- DATA-FOUNDATION-1.1.0 tagged.
- J-pipe engineering sign-off.
- The conversion table and 48-field seed confirmed.
- A separate VALUE-FOUNDATION implementation authorization.

**Before deployment:** hosted #6 confirmation.

**Issues that must be resolved before implementation:** none architectural. Only the directory-name confirmation (§11 note) and the authorizations above remain.

---

DATA-FOUNDATION-1.1.0: OWNER-APPROVED DESIGN
VERSION: 1.1.0
NEGATIVE ZERO: -0 NORMALIZED TO +0
TRUSTED WRITE PATH: SERVICE-ROLE APPLICATION CODE
SECURITY DEFINER: NO NEW FUNCTION
SEQUENCE: DATA-FOUNDATION-1.1.0 BEFORE VALUE-FOUNDATION-1.0.0
DATA-FOUNDATION-1.0.0: FROZEN / IMMUTABLE
IMPLEMENTATION: NOT AUTHORIZED
