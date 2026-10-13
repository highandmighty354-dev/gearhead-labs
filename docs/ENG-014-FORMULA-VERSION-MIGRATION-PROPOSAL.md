# GH-ENG-014 — Formula-version migration proposal

**Status: PROPOSAL FOR OWNER REVIEW. NOT APPLIED. No production change has been made.** This file is deliberately outside `supabase/migrations/`, so no migration tool can pick it up by accident. The register entry [GH-ENG-014](DEFERRED-WORK-REGISTER.md) stays **OPEN** until the owner decides.

## 1. What is wrong and what record is required

A *formula fingerprint* is `fv1-` plus an FNV-1a hash of a registry formula's expressions, units, options and the formula text the page displays for it. The production table `formula_versions` has one row per calculator per fingerprint (`0005_reference_seed.sql`, frozen, byte-identical to the provisioned database: 577 rows). A stored calculation points at its row with the foreign key `calc_formula_version_fk (canonical_id, formula_version)`.

Two registry formulas were corrected on this branch, so the engine now computes a fingerprint that production has no row for:

| Calculator | Production row (kept) | New fingerprint (needs a row) | Why it changed | Register |
|---|---|---|---|---|
| `dew_point` | `fv1-260e7f34`, first release F1.12.3 | `fv1-73ddeaf4` | Celsius rule of thumb applied to a Fahrenheit input; the spread is now scaled by 1.8 (default 75 °F / 60 %: 67 °F before, 60.6 °F after) | GH-DEF-005 |
| `distance_converter` | `fv1-36d27af2`, first release F1.12.3 | `fv1-4001b424` | yards → km constant 0.000914 corrected to the exact 0.0009144 (the old result was 0.044 % low) | GH-DEF-019 |

The register entry originally proposed one row (`dew_point`). The yard fix on this branch (`00c31c5`) added a second, so the proposal below has **two rows**. Every other formula still matches the seed (guard: `premium/tests/formula-fingerprints.test.js`, 577 seed formulas: 575 identical, 2 recorded as corrected, and the test fails on any third change that is not recorded).

Nothing stores calculations through the engine today (`premium/adapters/dev-local.js` writes the placeholder `development`; no front-end code calls `GH_ENGINE.calculate` to store a record), so there is **no live failure now**. The rows are a prerequisite for the day a calculation is stored with either corrected formula.

## 2. Proposed migration

Number and wording follow the repository's pattern (`04xx`, idempotent, one transaction, post-conditions that abort on any other state). `0408` is a placeholder; the number, header and `engine_version` / `first_release` values are owner decisions. The SQL below is the exact text that `premium/tests/eng014-throwaway-db.sh` extracts and runs.

<!-- PROPOSED-SQL-BEGIN -->
```sql
-- PROPOSAL ONLY (GH-ENG-014): formula_versions rows for the two formulas corrected after the 0005 seed was exported.
-- NOT applied. Number and wording are owner decisions; 0408 is a placeholder after 0407.
-- Idempotent (ON CONFLICT DO NOTHING), single transaction, post-conditions abort on any other state.
-- Existing rows are untouched: the old fingerprints stay, because formula versions are history.
BEGIN;

INSERT INTO public.formula_versions (calculator_id, formula_version, engine_version, formula_registry, first_release) VALUES
  ('dew_point',          'fv1-73ddeaf4', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4'),
  ('distance_converter', 'fv1-4001b424', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4')
ON CONFLICT (calculator_id, formula_version) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.formula_versions
   WHERE (calculator_id, formula_version) IN (('dew_point', 'fv1-73ddeaf4'), ('distance_converter', 'fv1-4001b424'))
     AND engine_version = '1.1.0' AND formula_registry = 'GH_LEGACY_FORMULAS' AND first_release = 'F1.12.4';
  IF n <> 2 THEN
    RAISE EXCEPTION 'PF_0408_POSTCONDITION: expected both corrected formula versions, found %', n;
  END IF;
  SELECT count(*) INTO n FROM public.formula_versions
   WHERE (calculator_id, formula_version) IN (('dew_point', 'fv1-260e7f34'), ('distance_converter', 'fv1-36d27af2'));
  IF n <> 2 THEN
    RAISE EXCEPTION 'PF_0408_POSTCONDITION: the original formula versions must remain, found %', n;
  END IF;
END $$;

COMMIT;
```
<!-- PROPOSED-SQL-END -->

`engine_version` `1.1.0` is the value the engine reports (`gh-engine@1.1.0`), and the `GH_LEGACY_FORMULAS` registry name is what the engine reports for both calculators (the fingerprint test compares it with the seed for all 577 rows). `first_release` `F1.12.4` is the engine page this branch ships in.

The migration runs under the same role that applied `0005` and `04xx` (`postgres`, `BYPASSRLS`). RLS is enabled and forced on `formula_versions` and no client role has an insert policy, which is intended: only a migration can add a version.

## 3. How historical saved calculations stay interpretable

1. **Old rows are permanent.** `formula_versions` rows cannot be updated, deleted or truncated (trigger `df_never_changed`, `df_no_truncate`, plus `ON DELETE RESTRICT` from `calculation_records`). The proposal only *adds* rows. A calculation stored before the correction still points at `fv1-260e7f34` / `fv1-36d27af2`, which still resolve.
2. **Results are stored, not recomputed.** A `calculation_records` row holds the inputs, outputs and the fingerprint it was computed with and is immutable (`df_append_only`). A Premium *saved calculation* (`0405`) references that record through a composite foreign key; it has no formula column of its own. So a saved dew point keeps the number the user saw, and the fingerprint tells which formula produced it.
3. **The fingerprint is a hash, not the formula.** The old formula text for `fv1-260e7f34` / `fv1-36d27af2` is recoverable from the tagged baseline named in the seed header (`F1.12.3-UI-MOBILE-HEADER` at `257b2cc6…`). The two corrections are listed above and in the register (GH-DEF-005, GH-DEF-019); the guard test keeps the list complete. No schema column records "superseded by", and one cannot be added to existing rows (they are never altered); this document and the register are the correction ledger.
4. **Old numbers are not rewritten.** A record made with the old dew-point formula keeps a value that was too high by up to several °F. That is history by design; whether to flag such records to users is a product decision (Section 7, D2) that only matters if such records exist.

## 4. How new calculations use the corrected fingerprint

The engine computes the fingerprint from the registry spec each time it describes or runs a calculator (`formulaVersion(spec)` → `GH_ENGINE.describe(id).formula_version`, stamped into the provenance of `GH_ENGINE.calculate`). Once the corrected engine is the one that stores records, new records carry `fv1-73ddeaf4` / `fv1-4001b424` automatically and need no further code change. Two ordering rules:

- **Migration first.** With the engine ahead of the database, saving a dew point or a distance conversion is refused by the foreign key (SQLSTATE `23503`; reproduced in Section 6).
- **One engine for the server path.** The trusted server path that writes `calculation_records` must run the same engine build whose fingerprints the migration lists. `formula-fingerprints.test.js` is the check.

`catalog/check-catalog.js` currently pins every fingerprint to the `0005` seed. It still passes, because the catalog describes production as provisioned. After the migration is applied it should read the latest row per calculator (migrations after `0005`), otherwise the catalog would keep describing the old fingerprints for these two calculators (D3).

## 5. Rollback

- **There is no `DELETE` rollback, by design.** A formula-version row cannot be deleted (Section 6, A5/A8), and the repository's own rollback pattern (`supabase/rollback/*.rollback.sql`) would have to disable a protection trigger to remove it. This proposal does not provide one and recommends against it.
- **What rollback means instead.** Reverting the *engine* to the commit before the corrections returns it to the old fingerprints, which still have rows. The two new rows then sit unreferenced, which is harmless: nothing reads a formula version that no record uses. If records were already stored with the new fingerprints, those records and their rows are permanent history, exactly like any other version.
- **Cost of a wrong row.** A row with a wrong `engine_version` or `first_release` is also permanent. The values are metadata, not behaviour, which is why the review of Section 2 matters before it is applied.
- **Re-running** the migration is safe (`ON CONFLICT DO NOTHING`; checked twice in the throwaway run).

## 6. Evidence (throwaway database, run on this branch)

`sh premium/tests/eng014-throwaway-db.sh` starts a private PostgreSQL on a unix socket in a temporary directory, builds the schema with the repository's hosted-Supabase shim (`postgres` is `NOSUPERUSER` + `BYPASSRLS`, as on the project), applies **every** file in `supabase/migrations` (`0001`–`0407`), runs the proposal's SQL block as extracted from this document twice, and deletes the server. It never touches a Supabase project. The 17 checks:

| # | Check | Expected |
|---|---|---|
| B0 | migrations reproduce production's 577 formula versions | pass |
| B1/B4 | before: a record with the **old** `dew_point` / `distance_converter` fingerprint is accepted | accepted |
| B2/B3 | before: a record with the **new** fingerprint is refused by `calc_formula_version_fk` | `23503` |
| A0 | the proposal applies cleanly twice (idempotent), 579 rows | pass |
| A1 | the four original rows are still there | pass |
| A2/A3 | after: records with the **new** fingerprints are accepted | accepted |
| A4 | old and new records each resolve to their own `formula_versions` row | pass |
| A5/A6/A7/A8 | deleting or updating a proposed or an old row, or truncating the table, is refused | refused |
| A9 | history cannot be rewritten to the new fingerprint (`calculation_records` immutable) | refused |
| A10/A11 | a signed-in client can read the new rows but cannot add formula versions | read ok / `42501` |

Result recorded in the register history of GH-ENG-014 (the exact count and date are there, taken from the final run).

Not exercised: the real production role and grants (the shim reproduces them from a read-only catalog check of 2026-10-05; this work had no access to production); whether production holds any `dew_point` / `distance_converter` records; the migration runner's own transaction handling.

## 7. Tests that must pass before deployment

1. `node premium/tests/formula-fingerprints.test.js` — 577 seed formulas, exactly the two recorded corrections, nothing else changed.
2. `sh premium/tests/eng014-throwaway-db.sh` — the 17 checks above, **on the final text of the migration** (and the block in this document must equal the file that is committed under `supabase/migrations/`).
3. `bash premium-foundation/tests/run-tests.sh` (`pf.test.js`) — **must be updated in the same change**: it pins the migration list (`EXPECTED_MIGRATIONS`), the reference counts (`577` formula versions becomes `579`), the idempotence replay and the per-migration rollbacks, so adding `0408` without editing it fails by design.
4. `bash premium/tests/run-tests.sh` — catalog check, register check, front-end tests and the schema-contract test (which applies `0001`–`0406`) on a throwaway cluster.
5. `node catalog/check-catalog.js` after the catalog tooling decision D3.
6. A read-only count on production before applying (D2), and the post-condition in the migration itself (it aborts the transaction if either new row is missing or an old row is gone).

## 8. Decisions for the owner (ENG-014 stays OPEN until these are made)

- **D1. Approve the two rows, number and wording.** *Recommendation:* approve as written, as one migration, applied **before** this branch is merged or deployed and before any save is wired to the engine. *Consequence of waiting:* none today; once saving is wired, dew-point and distance-converter saves fail until it is applied.
- **D2. Does production already hold `calculation_records` for `dew_point` or `distance_converter`?** *Recommendation:* authorise a read-only count of those two calculators (one `SELECT count(*)`, no change), because the answer decides whether anything is left to explain to users. If zero: no data question remains. If more than zero: those records keep their old results; decide whether the front end should label them "calculated with an earlier formula".
- **D3. Should `catalog/check-catalog.js` and the catalog builder read the latest fingerprint per calculator?** *Recommendation:* yes, in the same change as the migration, so the catalog describes the deployed state; until then they intentionally describe `0005`.
- **D4. (Optional) A written correction ledger.** *Recommendation:* no new table (existing rows cannot carry a note); keep this document, the register and the `VERSIONED` list in `formula-fingerprints.test.js` as the ledger.

Any later correction of a registry formula raises the same question; the guard test fails until it is recorded here.
