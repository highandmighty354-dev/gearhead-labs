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

## 10. Final decision brief (closeout of 2026-10-13)

Written for the owner. Nothing here has been applied, nothing under `supabase/` or `.github/` has been touched, and nothing has been deployed. This brief is not an authorization.

**What is being decided.** Whether to add two rows to the production table that lists formula versions, so that a saved Dew Point or Distance Converter result can carry the corrected formula's name. The rows are bookkeeping: no calculation, no user data and no existing row changes. Production holds 0 saved results for either calculator (read-only count, Section 9), so nobody is affected today; the rows only matter from the day saving is wired to the engine.

**1. The SQL and the schema review.** Re-checked against the files in this commit: `supabase/`, `premium-foundation/`, `.github/` and `premium/tests/eng014-throwaway-db.sh` are byte-identical to the commit that produced the 17-of-17 run (`git diff 6f057cc..HEAD` on those paths is empty), and the SQL block in Section 2 is unchanged. The throwaway-database script was re-run on this text (a private PostgreSQL, never a Supabase project): 17 run, 17 passed, 0 failed, proposal exit codes 0/0.

| What the statement does | Review result |
|---|---|
| One transaction; one `INSERT` of exactly two rows (`dew_point` `fv1-73ddeaf4`, `distance_converter` `fv1-4001b424`, `1.1.0`, `GH_LEGACY_FORMULAS`, `F1.12.4`) | Fits every column and constraint of `formula_versions`: primary key (`calculator_id`, `formula_version`), format check `^fv1-[0-9a-f]{8}$`, foreign key to `calculators` (both exist), the three other columns `NOT NULL` and supplied |
| `ON CONFLICT … DO NOTHING` | Re-running changes nothing; a duplicate is impossible |
| Post-conditions inside the transaction | If either new row is missing or has other metadata, or either old row is gone, the whole transaction aborts (`PF_0408_POSTCONDITION`) and nothing is written |
| Immutability triggers (`df_never_changed`, `df_no_truncate`) | Block update, delete and truncate only; an insert is allowed. They also make the new rows permanent |
| `calculation_records` foreign key (`calc_formula_version_fk`, `ON DELETE RESTRICT`) | Resolves to the new rows; old records keep resolving to the old rows |
| Row-level security | Forced; no client role can insert, so only the migration role can add a version (intended) |
| What it cannot do | Touch any other table, change or delete any row, change a fingerprint |

**2. Migration and rollback behaviour.** Safe to repeat. Not reversible by SQL, by design: a formula-version row cannot be deleted, so applying the migration is a one-way door and a wrong value (`engine_version`, `first_release`) would also be permanent. That is why the values are on the checklist below. "Rolling back" means reverting the engine commit; the two rows then sit unused, which is harmless. One consequence for the test suite: the `0407`-alone rollback scenario of `pf.test.js` compares the full fingerprint (reference rows included) of a fully provisioned database after rolling `0407` back with a database built to `0406`; the two new rows cannot be rolled back, so that comparison has to be built to stop at `0407` (a test change, not a product change; `0408` gets no rollback file and the test says why). The schema-only comparison of the 0401–0407 rollback does not include rows and is unaffected.

**3. Latest-fingerprint catalogue tooling (recommended to ship with the migration).** `catalog/build-catalog.js` reads the latest `formula_versions` insert per calculator across `supabase/migrations` in file-name order instead of only `0005`; `catalog/check-catalog.js` then checks catalogue = latest migrated row = what the engine computes, and that every earlier row still exists. No database call is needed, the catalogue stays a pure function of repository files, and a formula corrected without a migration (or a migration without the engine change) fails the build. Detail and effects: Section 9.

**4. What remains to be committed and verified before a merge** (none of it started; each step is on the branch only):

1. `supabase/migrations/0408_formula_versions_corrected_formulas.sql`, byte-equal to the Section 2 block (the throwaway-database script already extracts that block; a test must compare it with the file).
2. `premium-foundation/tests/pf.test.js`: add the file to `EXPECTED_MIGRATIONS`, `577` formula versions → `579`, an assertion that exactly the two new rows exist, the `0407`-alone rollback comparison built to stop at `0407` (paragraph 2 above), a note that 0408 has no rollback by design.
3. Catalogue tooling and its tests (Section 3); `formula-fingerprints.test.js` `VERSIONED` list pointed at the migration instead of the seed.
4. Re-run on the final text: `sh premium/tests/eng014-throwaway-db.sh` (17 of 17), `bash premium-foundation/tests/run-tests.sh`, `bash premium/tests/run-tests.sh`, `node catalog/check-catalog.js`. No engine change is expected, so no browser regression is needed unless the engine changes.
5. One commit with items 1–4 (call its hash **A**). After **A** no file of the package may change, because the workflow verifies each file's sha256.
6. A second commit that changes only the workflow and its documentation: `PINNED_SHA` = **A**, an 18th manifest line for `0408`, the stale "exact 16 file names" header comment corrected to 18, and `supabase/PROVISIONING.md`.
7. A production **dry run** through the existing workflow (it changes nothing and must report that the pending list is exactly `0408`).

**5. Your decisions, and the exact authorizations.**

Decisions (recommendation first): approve the two rows as written, migration number `0408`, `engine_version` `1.1.0`, `first_release` `F1.12.4` (recommended: yes); ship the catalogue tooling with the migration (recommended: yes); apply **before** the branch is merged, from the pinned branch commit (recommended; Section 9 explains why); no new correction-ledger table (recommended: none).

Two separate authorizations are needed, and neither exists today:

- **A. Prepare (repository only, no production effect).** *"I approve the two formula-version rows exactly as written in Section 2 of the ENG-014 proposal (migration 0408, engine_version 1.1.0, first_release F1.12.4). Prepare steps 1–6 on premium/full-calculator-expansion. Do not apply anything."*
- **B. Apply to production (given only after A is finished and I have reported commit A and the dry-run result).** *"I authorize applying migration 0408 to the production Supabase project from pinned commit <the full commit hash I was given>. I will run the Provision Supabase workflow myself: target production, dry-run first, then apply with the project ref confirmed and APPLY typed, and I will approve the production gate."* It is run from the GitHub Actions page in the browser; no command line, SQL or password is involved on your side.

## 11. Addendum of 2026-10-15: a third corrected formula (`bolt_torque_spec`, GH-DEF-034)

**Status: documentation only. NOT applied, and no migration file was created.** Sections 1–10 above are **unchanged**. In particular, the Section 2 SQL block between the `PROPOSED-SQL` markers, which `premium/tests/eng014-throwaway-db.sh` extracts, still has two rows and still passes **17 of 17** (re-run 2026-10-15 at `8f9b9b5`).

This section records the exact change that a third row would make, and why. Whether it is adopted is the owner's decision.

**Why a third row.** The GH-DEF-034 correction (`b927343`) changed the registry formula of `bolt_torque_spec`:
- **The thread:** the stress area is now taken from the thread entered, where it used a fixed 16 or 20 threads per inch.
- **The proof strength:** it now depends on grade and size.
- **The inputs:** the formula's inputs and options changed as well.

So the engine now computes a fingerprint that production has no row for (`formula-fingerprints.test.js` `VERSIONED`):

| Calculator | Production row (kept) | New fingerprint (needs a row) | Register |
|---|---|---|---|
| `bolt_torque_spec` | `fv1-f63ea4c8`, first release F1.12.3 (`0005_reference_seed.sql` line 626) | `fv1-25b1f973` | GH-DEF-034 |

**Values for the row.** Each value was checked against the actual schema and engine, not assumed.
- **`calculator_id` = `bolt_torque_spec`:** it exists in `calculators` and is its own canonical id (seed line 42).
- **`formula_version` = `fv1-25b1f973`:** it matches `^fv1-[0-9a-f]{8}$`, and it is what `GH_ENGINE.describe('bolt_torque_spec')` reports at `8f9b9b5`.
- **`engine_version` = `1.1.0`:** the engine still reports `gh-engine@1.1.0`; the correction did not change `ENGINE_VERSION`.
- **`formula_registry` = `GH_LEGACY_FORMULAS`:** the registry name the engine reports for this calculator. The spec is defined in `GH_BACKFILL_FORMULAS` and reported under that name, as for the seed row.
- **`first_release` = `F1.12.4`:** the same engine page as the two existing rows.

**The exact change, if adopted.** One more `VALUES` line, and both post-conditions counting three instead of two:

```sql
INSERT INTO public.formula_versions (calculator_id, formula_version, engine_version, formula_registry, first_release) VALUES
  ('dew_point',          'fv1-73ddeaf4', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4'),
  ('distance_converter', 'fv1-4001b424', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4'),
  ('bolt_torque_spec',   'fv1-25b1f973', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4')
ON CONFLICT (calculator_id, formula_version) DO NOTHING;
-- post-condition 1: the three new rows, with this metadata          -> n <> 3 aborts
-- post-condition 2: the three original rows ('dew_point', 'fv1-260e7f34'), ('distance_converter', 'fv1-36d27af2'),
--                   ('bolt_torque_spec', 'fv1-f63ea4c8') still exist -> n <> 3 aborts
```

**Evidence (throwaway database, never a Supabase project).** The three-row variant was run with a scratch copy of `eng014-throwaway-db.sh`. Neither the repository script nor this document's block was changed. The copy adds five checks:
- **Before the migration:**
  - B5: a record with the **old** `bolt_torque_spec` fingerprint is accepted;
  - B6: a record with the **new** one is refused by `calc_formula_version_fk` (`23503`).
- **After the migration:**
  - A12: the new fingerprint is accepted;
  - A13: the old row remains, and its record still resolves to it;
  - A14: deleting the new row is refused.

It also expects 580 formula versions instead of 579. Result: **22 run, 22 passed, 0 failed**, and the migration applied cleanly twice (exit codes 0/0).

**Compatibility.**
- **Old records stay reproducible as history.** A record made with `fv1-f63ea4c8` keeps its stored inputs and outputs: `calculation_records` is append-only and `formula_versions` is never altered. Its inputs use the old keys (`dia_bt`, `K`, `proof_str`). New records use the new keys (`btq_d`, `btq_std`, `btq_tpi`, `grade_bt`, `lube_bt`, where `btq_std`, `grade_bt` and `lube_bt` are categorical). The schema puts no constraint on input keys (`inputs jsonb`, object). The front end only displays stored inputs (`premium/models.js`); it never recomputes them.
- **The old formula stays recoverable.** Its text is in the seed's tagged baseline, and in this branch's history before `b927343`.
- **Old numbers are not rewritten** (Section 3 applies unchanged).
- **`calculators.engine_proven` is `false`** for `bolt_torque_spec` (seed line 42). It is a per-calculator flag in a table that has no immutability trigger, and the repository does not define what it means: the exporter that set it, `data-foundation/tools/export-engine-catalog.js`, is not in this repository. The new row does not depend on it, and it is not proposed to change.

**What the three-row variant changes in the Section 10 checklist.**
1. **The migration file:** the SQL above, as one migration, still a single file (placeholder `0408`). The manifest becomes 18 files either way.
2. **`pf.test.js`:** `577` formula versions → **`580`** (not 579), and an assertion that exactly the three new rows exist.
3. **`eng014-throwaway-db.sh`:** add the five checks above, 579 → 580, 17 → 22 checks; the Section 2 block becomes the three-row text.
4. **Unchanged:** catalogue tooling (D3), the order of steps, and the two authorizations, except that authorization A names three rows.

**Decisions this adds.**
- **D5.** Add `bolt_torque_spec` as a third row in the same migration (recommended: one migration, not a `0408` + `0409` pair).
- **D6.** A read-only production count of `calculation_records` for `bolt_torque_spec`, as was done for D2. It was not run here: this task does not authorize SQL against Supabase. The 2026-10-13 count covered only the two other calculators.
- **D7.** Settle the Bolt Stretch question (GH-DEF-036) before the migration is prepared. If that fix changes the `bolt_stretch` registry formula (seed `fv1-d48e7340`), it needs a fourth row, and folding it into the same migration avoids a second production change.

## 12. Addendum of 2026-10-15 (later): the fourth corrected formula (`bolt_stretch`, GH-DEF-036) and the final row set

**Status: documentation only. NOT applied, and no migration file was created.**
- Sections 1–11 are unchanged. Section 11 is kept as written, for the record of the three-row draft.
- The Section 2 SQL block between the `PROPOSED-SQL` markers still has the original two rows, so `eng014-throwaway-db.sh` still passes 17 of 17.
- **Owner decisions recorded (2026-10-15):** add `bolt_torque_spec` to the proposal (D5); wait for the Bolt Stretch correction before the final migration (D7). This section is that final row set.

**Why a fourth row.**
- The GH-DEF-036 correction replaced the `bolt_stretch` registry formula (`GH_E1_FORMULAS`).
- **Old formula** (seed `fv1-d48e7340`): `f*l/(a*e)`, the stretch of one uniform bar from a load, with inputs `f`, `l`, `a`, `e` and output "Bolt Stretch" (in).
- **New formula** (**`fv1-8e827c77`**): the page's model. The clamp load is calculated from a stretch through the loaded shank and loaded thread in series:
  - inputs `bolt_len`, `target_stretch_pct`, `bst_d`, `bst_std` (categorical), `bst_tpi`, `bst_ls`, `bst_ds`, `bst_lt`;
  - output "Estimated Clamp Load" (lbf).

**The final row set:**

| Calculator | Production row (kept) | New fingerprint | `engine_version` | `formula_registry` | `first_release` | Register |
|---|---|---|---|---|---|---|
| `dew_point` | `fv1-260e7f34` | `fv1-73ddeaf4` | `1.1.0` | `GH_LEGACY_FORMULAS` | `F1.12.4` | GH-DEF-005 |
| `distance_converter` | `fv1-36d27af2` | `fv1-4001b424` | `1.1.0` | `GH_LEGACY_FORMULAS` | `F1.12.4` | GH-DEF-019 |
| `bolt_torque_spec` | `fv1-f63ea4c8` | `fv1-25b1f973` | `1.1.0` | `GH_LEGACY_FORMULAS` | `F1.12.4` | GH-DEF-034 |
| `bolt_stretch` | `fv1-d48e7340` (seed line 625) | `fv1-8e827c77` | `1.1.0` | **`GH_E1_FORMULAS`** | `F1.12.4` | GH-DEF-036 |

Every value was checked against the engine at the commit that adds this section: `GH_ENGINE.describe()` and `formula-fingerprints.test.js` (577 seed formulas, 573 identical, 4 recorded corrections). Both calculators exist in `calculators` and are their own canonical id.

**A change to the post-condition, not only to the rows.** The Section 2 post-condition checks every new row against one registry name, `GH_LEGACY_FORMULAS`. `bolt_stretch` is in `GH_E1_FORMULAS`, so that check would abort a correct four-row migration. The final draft therefore compares each row with its own metadata (a `VALUES` join).
- **Negative control:** with `bolt_stretch` deliberately given the wrong registry, the migration aborted (exit code 3), wrote nothing, and the new fingerprint stayed refused.

```sql
INSERT INTO public.formula_versions (calculator_id, formula_version, engine_version, formula_registry, first_release) VALUES
  ('dew_point',          'fv1-73ddeaf4', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4'),
  ('distance_converter', 'fv1-4001b424', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4'),
  ('bolt_torque_spec',   'fv1-25b1f973', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4'),
  ('bolt_stretch',       'fv1-8e827c77', '1.1.0', 'GH_E1_FORMULAS',     'F1.12.4')
ON CONFLICT (calculator_id, formula_version) DO NOTHING;
-- post-condition 1: the four new rows, each with ITS OWN registry, engine 1.1.0, first release F1.12.4 (a VALUES join) -> n <> 4 aborts
-- post-condition 2: the four original rows (dew_point fv1-260e7f34, distance_converter fv1-36d27af2, bolt_torque_spec fv1-f63ea4c8,
--                   bolt_stretch fv1-d48e7340) still exist                                                             -> n <> 4 aborts
```

**Evidence (a throwaway local PostgreSQL, never a Supabase project; the repository script and Section 2 block not changed).** A scratch copy of `eng014-throwaway-db.sh` read the four-row draft and added:
- B5–B8: old fingerprints accepted, new ones refused (`23503`), before the migration;
- A12–A18: new fingerprints accepted, old rows and their records still resolving, the new `bolt_stretch` row carrying `GH_E1_FORMULAS`, and deletes refused, after the migration.

It also expects 581 formula versions. Result: **28 run, 28 passed, 0 failed**, applied twice with exit codes 0/0.

**Compatibility of the `bolt_stretch` change.**
- **Old records are not reinterpreted.** A record made with `fv1-d48e7340` keeps its stored inputs (`f`, `l`, `a`, `e`) and its stored output, a stretch in inches. That row stays, because `formula_versions` and `calculation_records` are append-only.
- **New records use new keys and a new output.** They carry the new input keys and the clamp load in lbf. The schema puts no constraint on input keys, and the front end only displays stored values.
- **The direction of the saved formula changed** (load → stretch before; stretch → clamp load now), so the saved formula now records what the page shows. That is why the version changed rather than staying compatible.
- **Two page-only details:** the page's blank boxes (shank diameter = nominal; loaded thread length = bolt length − shank length) are resolved by the page before anything is stored. The saved formula takes explicit values and refuses the same impossible inputs as the page.

**What changes in the Section 10 checklist** (supersedes the Section 11 version):
1. **The migration:** one file (placeholder `0408`) with the four-row SQL above and the per-row post-condition. The manifest is still 18 files.
2. **`pf.test.js`:** `577` formula versions → **`581`**, plus an assertion that exactly the four new rows exist.
3. **`eng014-throwaway-db.sh`:** the B5–B8 and A12–A18 checks, 579 → 581, 17 → **28** checks. The Section 2 block becomes the four-row text, with the per-row post-condition.
4. **`formula-fingerprints.test.js` `VERSIONED`:** already lists all four. After the migration it should point at the migration rather than the seed (D3).
5. **Unchanged:** the order of steps, the catalogue tooling (D3), and the two authorizations, except that authorization A names four rows.

**D6 answered (2026-10-15).** The owner authorized one read-only count. It ran on the production project (`jmztpjudwzjvrcdtjynd`) through the project's Supabase connector:
- **Result:** **0** `calculation_records` for `bolt_torque_spec`.
- **Read-only:** inside `BEGIN TRANSACTION READ ONLY`, which the result confirms (`transaction_read_only = on`).
- **Complete:** the connector's role bypasses row-level security (`rolbypassrls = true`), so the count covers every user.
- **Nothing else read:** no record contents, inputs, outputs or personal data.
- **Scope:** `bolt_stretch` was not counted; that count was not authorized.

The connector is a full-privilege connection, not a least-privileged role. The read-only transaction and the aggregate-only query were the safeguards. The exact query:

```sql
BEGIN TRANSACTION READ ONLY;
SELECT count(*) FILTER (WHERE canonical_id = 'bolt_torque_spec') AS bolt_torque_spec_records,
       current_setting('transaction_read_only') AS transaction_read_only,
       (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS role_bypasses_rls
FROM public.calculation_records;
COMMIT;
```

**Decisions that remain:**
- **D1:** approve the four rows and the per-row post-condition.
- **D8 (new):** authorize a read-only count of `bolt_stretch` records, the same way.
- **Then** the two separate authorizations of Section 10: A (prepare on the branch) and B (apply to production).
