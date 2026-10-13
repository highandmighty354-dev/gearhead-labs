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
- **D2. Does production already hold `calculation_records` for `dew_point` or `distance_converter`?** *Answered 2026-10-13 (Section 9): 0 and 0.* *Recommendation:* authorise a read-only count of those two calculators (one `SELECT count(*)`, no change), because the answer decides whether anything is left to explain to users. If zero: no data question remains. If more than zero: those records keep their old results; decide whether the front end should label them "calculated with an earlier formula".
- **D3. Should `catalog/check-catalog.js` and the catalog builder read the latest fingerprint per calculator?** *Recommendation:* yes, in the same change as the migration, so the catalog describes the deployed state; until then they intentionally describe `0005`.
- **D4. (Optional) A written correction ledger.** *Recommendation:* no new table (existing rows cannot carry a note); keep this document, the register and the `VERSIONED` list in `formula-fingerprints.test.js` as the ledger.

Any later correction of a registry formula raises the same question; the guard test fails until it is recorded here.

## 9. Review of 2026-10-13 (Metric-convention phase)

Reviewed again against the actual files, the production workflow and, read-only, the production database. Nothing was applied and no file under `supabase/` or `.github/` was touched.

**What was checked, and the result**

| Question | Result |
|---|---|
| Old and new fingerprints are the right ones | **Yes.** The old values are the `0005_reference_seed.sql` rows (lines 720 and 764: `fv1-260e7f34`, `fv1-36d27af2`). The new values are what the engine computes at the final commit: `formula-fingerprints.test.js` passes (577 seed formulas, 575 identical, 2 recorded as corrected; `VERSIONED` lists `fv1-73ddeaf4` and `fv1-4001b424`). The Metric-convention commits changed no registry entry, so no third fingerprint moved. |
| Compatible with the schema | **Yes.** `formula_versions` (`0002_tables.sql`): primary key (`calculator_id`, `formula_version`); `formula_version` must match `^fv1-[0-9a-f]{8}$` (both new values do); `calculator_id` references `calculators`, where both calculators exist and are their own canonical id (seed lines 137 and 181); the other three columns are `NOT NULL` text. `calculation_records.calc_formula_version_fk (canonical_id, formula_version)` resolves to these rows. Grants and RLS: no client insert policy, which is intended. |
| Historical interpretability | **Unchanged by the proposal.** Rows are only added; the old rows and any records that point at them stay (Section 3). |
| Idempotency and duplicates | `ON CONFLICT (calculator_id, formula_version) DO NOTHING` plus the primary key give idempotency and make a duplicate impossible. A pre-existing row with different metadata is not silently accepted: the post-condition counts only rows with `engine_version = '1.1.0'`, `GH_LEGACY_FORMULAS`, `F1.12.4` and aborts the transaction otherwise. `engine_version` `1.1.0` still equals `ENGINE_VERSION` in the page. |
| Rollback | **Revert the engine, keep the rows** (Section 5). There is no `DELETE` rollback by design (`df_never_changed`, `df_no_truncate`, `ON DELETE RESTRICT`). |
| The 17 of 17 evidence | **Still applicable, not re-run.** `supabase/`, `premium-foundation/`, this document and `premium/tests/eng014-throwaway-db.sh` are byte-identical to the commit that produced it (`6f057cc`; `git diff 6f057cc..HEAD` on those paths is empty), and the later commits only changed unit declarations and tests. It must be re-run on the final text if the SQL, the number or the wording changes. |

**Production record count (D2): answered.** A single read-only aggregate query on the production project, 2026-10-13, through the project's Supabase connector (a `SELECT`, no change, no record contents, no personal data) returned **0** `calculation_records` for `dew_point` and **0** for `distance_converter`. The connection role bypasses row-level security (`rolbypassrls = true`), so zero is a real count and not a view filtered by RLS. This agrees with the production record of 2026-10-06 (every user table empty). Nothing exists to explain to users. The exact query, so it can be repeated or audited:

```sql
SELECT count(*) FILTER (WHERE canonical_id = 'dew_point')          AS dew_point_records,
       count(*) FILTER (WHERE canonical_id = 'distance_converter') AS distance_converter_records,
       (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS role_bypasses_rls
FROM public.calculation_records;
```

**How a migration reaches production here (new finding).** Production is not changed by running a file: `supabase/PROVISIONING.md` and `.github/workflows/provision-supabase.yml` apply a **pinned package**: the workflow carries an exact commit (`PINNED_SHA`), a sha256 manifest of exactly 17 files in a fixed order, and APPLY refuses unless the target's pending list is exactly the end of that approved order (0407 was applied that way, run #8, with the owner's typed APPLY and the production gate). So adding `0408` means, as separate steps that each need the owner: (1) commit the migration file under `supabase/migrations/` equal to the SQL block above and update `pf.test.js` (`EXPECTED_MIGRATIONS`, 577 → 579, replay and rollback tests); (2) a workflow change that pins the new commit and an 18-file manifest; (3) a production dry run, then APPLY with the owner's typed approval; (4) update `PROVISIONING.md`. None of this was done or prepared beyond this paragraph.

**Consequence of applying before the branch is merged or deployed.** Harmless to the running product: the two new rows are unreferenced until the corrected engine stores a record. 0407 was applied before PR #2 merged in the same way, so there is precedent. The cost is that production then has a migration that `main` does not have until the merge, so the pinned package must come from the branch commit that contains the file, and the file must not change afterwards (a second commit with different text would no longer match the manifest). Applying *after* the merge instead means the dew-point and distance-converter saves are refused by the foreign key (`23503`) from the moment the corrected engine is deployed until the rows exist; since nothing stores a calculation today that window is empty, but it is the failure mode to avoid. Recommendation: apply before the merge, from the pinned branch commit, and before any save is wired to the engine.

**Catalog tooling (D3).** `catalog/build-catalog.js` reads only `0005_reference_seed.sql` (`SEED`, line 31) and `catalog/check-catalog.js` compares every catalog fingerprint with the same file (lines 118–133), so today the catalog says `fv1-260e7f34` / `fv1-36d27af2`, which is what production holds and what the 575 other calculators still use. Recommended behaviour, in the same change that adds `0408`: the builder reads **every** `formula_versions` insert in `supabase/migrations` in file-name order and keeps the **latest row per calculator**; the checker verifies that (a) the catalog fingerprint equals the latest migrated row, (b) that row equals what the engine computes (already the job of `formula-fingerprints.test.js`, whose `VERSIONED` list would then point at the migration instead of the seed), and (c) the earlier rows still exist (history is never dropped). Effects: *reproducibility*: the catalog stays a pure function of files in the repository (migration order is the file-name order), no database call; *historical records*: unaffected, a record carries its own fingerprint and the old rows stay in the table; *build validation*: it gains one invariant (catalog = latest migrated row = engine) and loses a hidden one (catalog = seed), so a formula corrected without a migration, or a migration without the engine change, fails the build. It must ship with the migration, not before: a catalog that names `fv1-73ddeaf4` while production lacks the row would describe a save that the foreign key refuses. Not implemented: with no `0408` in `supabase/migrations/` the change would be a no-op.

**Status after this review.** ENG-014 stays OPEN and awaiting the owner. D1 (approve the two rows, number and wording): recommended approve as written. D2: answered, 0 and 0. D3: recommended, to ship with the migration. D4: no new table. Applying to production needs separate explicit authorization; this review is not it.
