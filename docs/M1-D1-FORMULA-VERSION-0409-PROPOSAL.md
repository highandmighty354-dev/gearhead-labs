# M1 / D1 — migration 0409: Fuel Pump Sizing formula version (applied to production 2026-10-22)

Review package of 2026-10-21, prepared as a separate draft PR on owner instruction (2026-10-21). That instruction also kept D1 and the `F1.12.4` label, subject to this migration review.

The PR is **stacked on draft PR #12**: its base is `feat/m1-engine-chain-single-path`, because the fingerprint it records exists only with D1 (`ae4212c`). (On 2026-10-22 this PR was merged into that branch, and PR #12 into `main`.)

**Status (2026-10-22): the migration is applied and the related application code is released.**
- **Database (applied).** 0409 was applied to production on 2026-10-22 by GitHub Actions run #12 (39775079345), from `ops/provision-0409` at `099039f`, package pinned to `c69ec51`, after dry run #11 (39751412576) listed exactly 0409. Both production gates were approved by the owner; no administrator bypass was used.
- **Post-apply checks passed** (2026-10-22, read-only, owner-authorized):
  - 19 migrations, the latest `0409`;
  - `formula_versions` 582 (581 before);
  - the new row exactly as in Section 1;
  - the original `fv1-c9780487` row unchanged.

  Details: `supabase/PROVISIONING.md`, "Applied: 0409".
- **Application code (released 2026-10-22).** The engine change that produces `fv1-f5c74781` (PR #12), this PR's catalogue and fingerprint record (PR #14) and the provisioning workflow pin (PR #15) reached `main` in one merge: PR #12 merged into `main` on 2026-10-22 as `be20248` and published by GitHub Pages run 39809377833. The live engine, the live catalogue and the production row agree on `fv1-f5c74781`; the original `fv1-c9780487` row remains valid.

The rest of this document is the review package as written before the apply (2026-10-21/22).

## 1. The record change

**Why it is needed.** D1 moved the Fuel Pump validity rule into the formula registry, so the formula's fingerprint changed from `fv1-c9780487` to `fv1-f5c74781`. The database records which formula produced each saved calculation, as a link to a `formula_versions` row. A new fingerprint therefore needs its own row before any calculation made with it can be stored.

**Production today** (checked read-only on 2026-10-21; counts and reference rows only):
- 18 migrations are applied, 0001 to 0408;
- `formula_versions` has 581 rows;
- `fuel_pump_sizing` has one row: `fv1-c9780487`, engine 1.1.0, `GH_LEGACY_FORMULAS`, first release F1.12.3;
- `calculation_records` has 0 rows in total, so 0 for Fuel Pump.

**File:** `supabase/migrations/0409_formula_versions_fuel_pump_validity.sql`, sha256 `29cbdcd08bda08630126e65f89a99f1226766d8568c58330486f3262d61f5534`. Only the header comment differs from the review copy of 2026-10-21.

| calculator_id | formula_version | engine_version | formula_registry | first_release |
|---|---|---|---|---|
| `fuel_pump_sizing` | `fv1-f5c74781` | `1.1.0` | `GH_LEGACY_FORMULAS` | `F1.12.4` |

The file follows the 0408 pattern:
- it adds one row and changes or deletes nothing;
- it runs as a single transaction;
- running it twice is harmless (`ON CONFLICT DO NOTHING`);
- a post-check aborts the whole transaction unless the new row has exactly this metadata **and** the original row is still there.

**`first_release` label:** `F1.12.4`, the engine file name and the label 0408 used. Kept by owner decision (2026-10-21), subject to this review.

**Not included:** the two new airflow calculators have no rows in the database's `calculators` table, so they cannot be saved at all today. Adding them would mean new calculator records, which is outside M1.

## 2. Versioning implications

- **Old records stay valid.** The original `fv1-c9780487` row stays. Any calculation saved with it keeps pointing at it, and the database refuses any attempt to change or delete history (`df_never_changed`, `df_no_truncate`).
- **New saves use the new fingerprint.** After 0409, the engine names `fv1-f5c74781` for Fuel Pump calculations.
- **Results that change:** for every valid input (HP, BSFC and density above zero, margin at least 1.0), the numbers are identical under both fingerprints. Only invalid inputs differ. Before, the registry returned a number (for example, margin 0.5 gave 17.2 GPH) even though the page refused it. Now the registry returns OUT_OF_RANGE with no value.
- **Release order.** The engine (PR #12 with D1) and the database row should reach production together, migration first, as was done for 0408.
  - Today, nothing in the product writes saved calculations (no server writer exists; `calculation_records` is 0), so a gap would not break anything visible.
  - It would still leave the site's catalogue and the database disagreeing about the current Fuel Pump formula.

## 3. Rollback considerations

- **There is no rollback file, by design.** A `formula_versions` row cannot be deleted; the database's own guard refuses it.
- **To undo D1,** revert commit `ae4212c`. The engine then names `fv1-c9780487` again. The new row, if already applied, stays unused, which is harmless, exactly as described for 0408.
- **If 0409 fails while applying,** the post-check aborts the single transaction and nothing is written. This was shown on a throwaway database with a deliberately wrong copy.
- **If 0409 is never applied,** the cost is that D1 stays unversioned. The formula-fingerprints test keeps failing (2 failures), and a future saved-calculation writer would have Fuel Pump saves refused by the database.

## 4. Verification (throwaway database only; no Supabase project touched)

**0409 proof.** `sh premium/tests/fv0409-throwaway-db.sh` gives **24 checks, 24 passed**:
- the migrations before 0409 (0001–0408) reproduce production: 581 rows;
- before 0409, the new fingerprint is refused and the old one accepted;
- a wrong copy (wrong registry) aborts and writes nothing;
- 0409 applied twice: exit codes 0/0, and all 581 earlier rows are byte-identical (same md5);
- after 0409: 582 rows; the new fingerprint is accepted for Fuel Pump only; the old one is still accepted; an earlier record still points at its original version;
- deleting or updating the new or the original row is refused; history cannot be rewritten;
- signed-in users can read the row but cannot add rows.

**0408 proof updated.** `premium/tests/eng014-throwaway-db.sh` no longer assumes that 0408 is the last migration:
- it applies only the migrations that sort before 0408;
- its check P2 is now "0408 directly follows 0407".

It gives 40/40 with 0409 present, and 40/40 with 0409 removed.

**Repository checks on this branch:**
- `node premium/tests/formula-fingerprints.test.js`: 577 seed formulas, 572 identical, 5 recorded as corrected (new `VERSIONED` entry `fuel_pump_sizing`), **0 failures**. On PR #12 alone there are 2 failures.
- `node catalog/check-catalog.js`: fails before the rebuild (the catalogue follows the latest migrated row) and is OK after `node catalog/build-catalog.js`. The catalogue now records `formula_versions_0409` and the Fuel Pump fingerprint `fv1-f5c74781`.
- `python3 premium/tests/workflow-pending-gate.test.py`: 60 checks, 0 failures.
- `node premium/tests/register-check.js`: OK.
- `node premium/tests/frontend.test.js`: 55/55.

**Release order.** Because the catalogue on this branch names `fv1-f5c74781`, this branch must not be merged or deployed before 0409 is applied to production. This is the rule 0408 followed.

## 5. Steps (status 2026-10-22: steps 1–5 done; step 6 open)

1. Review and approve this file, including the `first_release` label `F1.12.4`.
2. Provisioning workflow (`.github/workflows/provision-supabase.yml`), which is **not changed here** because it is production configuration:
   - pin it to the commit that adds 0409;
   - make the manifest 19 files (0409 sha256 above);
   - set `PRODUCTION_EXPECTED_PENDING` to `0409_formula_versions_fuel_pump_validity.sql`;
   - update `supabase/PROVISIONING.md`.
3. **Production dry run:** the owner clicks *Run workflow* (dry-run mode) and approves the production gate. It must list exactly 0409.
4. **Apply:** a separate run in apply mode, with APPLY typed and the gate approved by the owner.
5. **Post-apply read-only checks:** 19 migrations; 582 `formula_versions` rows; the new Fuel Pump row with its metadata; the original row unchanged.
6. Then, each under its own authorization: merge PR #12, merge this PR, deploy. **Done 2026-10-22:** PRs #15 and #14 were merged into their stacked branches, and PR #12 merged into `main` on 2026-10-22 as `be20248` and published by GitHub Pages run 39809377833.

Done on 2026-10-22: step 1 (owner approval); step 2 (PR #15); step 3 (run #11); step 4 (run #12); step 5 (all four checks passed).
