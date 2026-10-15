# Provisioning the Gearhead Labs Premium database

**Status (2026-10-15): production is at migration 0407; `0408` is prepared and NOT applied.** All 17 migrations (0001 through 0407) are applied to the production project `jmztpjudwzjvrcdtjynd`, by the gated workflow *Provision Supabase (manual, gated)*:
- 0001–0406 were applied first, from commit b2baaaa.
- `0407_premium_product_model.sql` was applied by run #8 (see "Applied: 0407" below).
- `0408_formula_versions_corrected_formulas.sql` (GH-ENG-014) is prepared on `premium/full-calculator-expansion` at commit `0cc4fc8`, and the workflow on that branch is pinned to it with an 18-file manifest (see "Prepared, not applied: 0408" below). Applying it needs separate explicit owner authorization.

Every step that writes to the project needs explicit owner approval first.

**Credentials:** the database password, service-role key, JWT secret and any Stripe secret are never pasted into chat, source files, GitHub or prompts. The owner types the database password into the Supabase CLI on their own machine, or uses the Supabase dashboard while signed in.

## What gets applied (in this exact order)

| # | File | Origin |
|---|---|---|
| 1 | `0001_enums.sql` | DATA-FOUNDATION 1.0.0 (frozen) |
| 2 | `0002_tables.sql` | DATA-FOUNDATION 1.0.0 (frozen) |
| 3 | `0003_constraints_triggers.sql` | DATA-FOUNDATION 1.0.0 (frozen) |
| 4 | `0004_rls.sql` | DATA-FOUNDATION 1.0.0 (frozen) |
| 5 | `0005_reference_seed.sql` | DATA-FOUNDATION 1.0.0 (frozen) |
| 6 | `0101_test_setups.sql` | GARAGE-FOUNDATION 1.0.0 (frozen) |
| 7 | `0102_test_setups_triggers.sql` | GARAGE-FOUNDATION 1.0.0 (frozen) |
| 8 | `0103_test_setups_rls.sql` | GARAGE-FOUNDATION 1.0.0 (frozen) |
| 9 | `0201_value_write_boundary.sql` | DATA-FOUNDATION 1.1.0 (frozen) |
| 10 | `0301_value_foundation_v1_seed.sql` | VALUE-FOUNDATION 1.0.0 (frozen) |
| 11 | `0401_automotive_only.sql` | PREMIUM-FOUNDATION (new) |
| 12 | `0402_premium_entitlements.sql` | PREMIUM-FOUNDATION (new) |
| 13 | `0403_premium_profiles.sql` | PREMIUM-FOUNDATION (new) |
| 14 | `0404_premium_garage.sql` | PREMIUM-FOUNDATION (new) |
| 15 | `0405_premium_saved_calculations.sql` | PREMIUM-FOUNDATION (new) |
| 16 | `0406_premium_engineering_analyses.sql` | PREMIUM-FOUNDATION (new) |

## Applied: 0407 (final product model)

| # | File | Origin |
|---|---|---|
| 17 | `0407_premium_product_model.sql` | PREMIUM-FOUNDATION 1.1.0 (applied to production 2026-10-06) |

**Production record (2026-10-06):**
- Project ref: `jmztpjudwzjvrcdtjynd`.
- Migration level: **0407**. The history holds 17 versions, 0001 through 0407; version `0407` is named `premium_product_model`.
- How it was applied: the workflow *Provision Supabase (manual, gated)* from `main` at 12cac10, package pinned to `ca8e582`.
  - **Run #8** (Actions run 37493952993) used target `production` and mode `apply`, with the owner's typed APPLY and the owner's approval of the production gate.
  - The APPLY job's built-in fresh dry run found exactly one pending file, `0407_premium_product_model.sql`, and then applied it. The job succeeded.
- Earlier runs, none of which changed the database:
  - Run #4 and run #7: production dry runs, both passed.
  - Run #5: stopped by the project-ref safety check before connecting.
  - Run #6: targeted the unused `rehearsal` environment, which has no connection setting, and stopped before connecting.
- **Read-only verification after the apply: passed.**
  - Plans: `plans` premium features = `engineering_lab, saved_calculations, garage`; free has no features; only Premium is paid.
  - Prices: `plan_offers` = premium/month/usd/599 and premium/year/usd/5999, both active. Signed-in users can only read it, anonymous users can't, and RLS is enabled and forced. `plan_prices` is still empty: no Stripe.
  - Free allowance: `pf_machines_free_allowance` and `pf_machine_allowance_ok()` are removed.
  - Garage rules: restrictive `pf_garage_premium_insert` and `pf_garage_premium_update` policies, both requiring `pf_has_feature('garage')`, are on all six Garage tables: garages, machines, machine_details, components, component_connections and test_setups.
  - Totals: 23 tables, all with RLS enabled and forced; 15 SECURITY DEFINER functions.
  - Reference data unchanged: calculators 583, formula_versions 577, engine_proven 252, canonical_fields 47, engineering_analyzers 14.
- **No user data was changed.** Every user table still holds 0 rows: auth users, accounts, profiles, grants, subscriptions, garages, machines, Test Setups, calculations, values, saved calculations and analyses.
- Supabase advisors after the apply reported nothing new from 0407 except one INFO: the foreign key from the empty `plan_prices` table to `plan_offers` has no covering index.
- PR #2 (the Premium frontend) **remains unmerged** at the time of this record.

What it does: Premium becomes the single paid product ($5.99/month, $59.99/year, recorded in the new reference table `plan_offers`); My Garage (garages, machines, details, components, connections, Test Setups) requires the Premium `garage` feature to create or edit; the 0404 Free one-vehicle allowance is removed; `plan_prices` (still empty, no Stripe) can only ever hold an approved offer.

Production data it alters: **only the `plans` row `premium`**, whose `features` array changes from `garage_unlimited` to `garage`. No account, grant, garage, machine or saved-work row is touched. Everything else is additive (one new table with 2 rows, one constraint, one foreign key, 12 restrictive policies) or removes the retired allowance policy and its function. Rollback: `supabase/rollback/0407_premium_product_model.rollback.sql` restores the exact 0406 catalog (tested).

Workflow change made for this apply (on `main`, 12cac10):
- the package is pinned to `ca8e582` with a 17-file manifest;
- APPLY accepts only a pending list that is exactly the end of the approved order (here, only 0407).

0407 had to be applied before PR #2 is merged, and it now is.

## Prepared, not applied: 0408 (corrected formula versions, GH-ENG-014)

| # | File | Origin |
|---|---|---|
| 18 | `0408_formula_versions_corrected_formulas.sql` | PREMIUM-FOUNDATION 1.1.0 (prepared 2026-10-15, commit `0cc4fc8`; **not applied**) |

What it does: inserts four `formula_versions` rows, one for each registry formula corrected after the 0005 seed was exported. It updates and deletes nothing. The original rows stay, and every `calculation_records` row that references them keeps its version.

| Calculator | New row (engine 1.1.0, first release F1.12.4) | Registry | Corrected by | Original row (kept, F1.12.3) |
|---|---|---|---|---|
| `dew_point` | `fv1-73ddeaf4` | `GH_LEGACY_FORMULAS` | GH-DEF-005 | `fv1-260e7f34` |
| `distance_converter` | `fv1-4001b424` | `GH_LEGACY_FORMULAS` | GH-DEF-019 | `fv1-36d27af2` |
| `bolt_torque_spec` | `fv1-25b1f973` | `GH_LEGACY_FORMULAS` | GH-DEF-034 | `fv1-f63ea4c8` |
| `bolt_stretch` | `fv1-8e827c77` | `GH_E1_FORMULAS` | GH-DEF-036 | `fv1-d48e7340` |

How the file behaves:
- It runs in a single transaction and is idempotent (`ON CONFLICT DO NOTHING`).
- Its post-condition checks each new row against its own registry and checks that the four original rows remain. Any other state raises `PF_0408_POSTCONDITION` and rolls the whole file back.
- No rollback file, by design. `formula_versions` rows cannot be updated or deleted (`df_never_changed`, `df_no_truncate`). If the engine were ever reverted, the new rows would simply be unreferenced, which is harmless.

**Workflow on `premium/full-calculator-expansion`** (not on `main`, which still pins `ca8e582` with 17 files):
- `PINNED_SHA` is `0cc4fc8d7cd2bb678a2a60a61c1a9f738ee5e4b6`.
- The manifest has 18 lines: the 17 earlier hashes, unchanged, plus `0408` = `df92a3e0…80c4c49`.
- Checked locally on 2026-10-15: the verify step, run against a checkout of `0cc4fc8`, printed "18 files, approved order, all checksums match" and all 12 frozen sources were OK.

**Catalogue (decision D3), in the same change:**
- `catalog/build-catalog.js` and `catalog/check-catalog.js` read each calculator's latest `formula_versions` row across all migrations, in file-name order (`catalog/formula-versions.js`). So the catalogue names the four `0408` fingerprints.
- `formula-fingerprints.test.js` checks that engine = latest migrated row, and that every original row is still defined.
- The catalogue therefore describes the database as it will be after `0408`. The branch must not be merged or deployed before `0408` is applied (see the order below).

**Read-only production evidence, 2026-10-15** (Supabase connector, `BEGIN TRANSACTION READ ONLY`; this is production, not a throwaway database):
- 17 applied versions, 0001 through 0407;
- `formula_versions` 577;
- none of the four new rows present;
- the four original rows unchanged;
- `calculation_records` 0.

A dry run would therefore list exactly `0408`.

### Is the workflow's dry run free of writes? (checked, not assumed)

**The workflow.**
- Mode `dry-run` runs only the `dry-run` job.
- The `apply` job runs only when mode is `apply`, and `verify-package` stops the run unless APPLY is typed.
- The dry-run job calls only `supabase db push --dry-run`.

**The Supabase CLI it installs (2.119.0).** Read in the CLI source at tag `v2.119.0`, `apps/cli/src/command-internal/db-push-core.ts` and `migration-history.ts`:
- With `--dry-run`, the CLI connects and lists the applied versions with one `SELECT version FROM supabase_migrations.schema_migrations`.
- It prints "Would push these migrations".
- It does not apply any migration, create the history table, or update Vault secrets. Those happen only in the non-dry-run branch.

So the dry run can be run without writing to the database. It still needs the owner: the owner clicks *Run workflow* and approves the production environment, because that approval is what releases the database password. Claude does not dispatch it.

### Execution order for 0408 (each production step needs the owner's explicit authorization)

Everything below uses the GitHub and Supabase web pages; nothing needs a terminal.

1. **Preconditions.**
   - Owner authorization to apply `0408`.
   - `premium/full-calculator-expansion` still contains `0cc4fc8`, and its workflow pins it.
   - The branch is not merged.
   - The local gates on the branch pass: proof script 40/40, foundation suite 48/48, fingerprints, catalogue, and the browser regression.
2. **Read-only pre-check** (Claude, through the Supabase connector, in a read-only transaction). The result must match the evidence above: 17 versions, 577 rows, no new rows, originals present.
3. **Dry run** (owner). Go to GitHub → Actions → *Provision Supabase (manual, gated)* → *Run workflow*, and fill in:
   - **Use workflow from:** `premium/full-calculator-expansion`. The copy on `main` pins `ca8e582` and would report nothing pending.
   - target `production`, mode `dry-run`, the project ref `jmztpjudwzjvrcdtjynd`, and a blank APPLY box.

   Then approve the production gate. Expected:
   - verify-package prints "commit 0cc4fc8…, 18 files";
   - the summary lists exactly one pending migration, `0408_formula_versions_corrected_formulas.sql`, and says it is "eligible for APPLY" and "No database changes were made".

   **Open precondition:** it could not be verified whether the `production` environment only allows deployments from `main` (the environments API was not reachable from this session). If GitHub refuses the job at the gate, nothing runs. The owner then decides between allowing this branch in the environment settings and moving the pinned workflow to `main`.
4. **Apply** (owner, separately authorized). Run the same workflow from the same branch, with mode `apply` and APPLY typed, and approve the gate. The job:
   - repeats the dry run and refuses unless the pending list is exactly `0408`;
   - runs `supabase db push --yes`;
   - repeats the dry run and fails if anything is still pending.
5. **Post-migration read-only checks** (Claude, connector, read-only transaction):
   - 18 versions; the latest is `0408`, named `formula_versions_corrected_formulas`;
   - `formula_versions` 581;
   - the four new rows exactly as in the table above;
   - the four original rows byte-for-byte unchanged (version, engine, registry, first release);
   - `calculators` 583, engine-proven 252;
   - `calculation_records` unchanged, and every record still references the version it was saved with;
   - `df_never_changed` and `df_no_truncate` still on `formula_versions`;
   - Security and Performance advisors: nothing new.
6. **Release** (separately authorized). Only after step 5 passes may the branch be merged and deployed. The engine and the catalogue then name the `0408` fingerprints, and production holds them.

### Failure handling

- **verify-package fails:** no credential was released and nothing was touched. Do not change the pin or the manifest without a new review.
- **The dry run lists anything other than exactly `0408`,** or the project-ref check fails: stop and do not apply. Investigate read-only.
- **Apply fails inside `0408`:** the file's own transaction rolls back (for example on `PF_0408_POSTCONDITION`), and the CLI stops at the first error. Nothing is written, and the history does not record `0408`. Investigate read-only before any retry.
- **The rows were written but the history entry was not** (a connection loss between the file and the CLI's history insert): the next dry run lists `0408` again. Re-applying is safe: the file is idempotent, and the throwaway proof (H1–H3) shows that a second apply leaves every earlier row unchanged.
- **The verification dry run still shows something pending:** the job fails. Check read-only before doing anything else.
- **Never** delete or update `formula_versions` rows to "undo" `0408`; the immutability triggers refuse it. If the release must be stopped, leave the rows in place and do not merge. A backup or PITR restore is a last resort and needs owner approval.
- **The branch is merged without `0408` applied:** a save that names a new fingerprint would be refused by the `calc_formula_version_fk` foreign key. Apply `0408` (steps 2–5) before releasing.

The obsolete Phase 3A `0001_premium_schema.sql` is **not** applied. It was retired to `docs/retired/phase-3a/` (see `RETIRED.md`).

## Before applying (all read-only)

1. On the commit to be applied, run `cd premium-foundation && npm install && npm test`. Confirm the following (counts as of 0408; 0407 had 47):
   - 48/48 checks pass;
   - the idempotency, order, rollback and upgrade checks are OK;
   - 24/24 mutants are killed. If possible, run it once with PostgreSQL 17 binaries as well (`PG_BIN=/usr/lib/postgresql/17/bin npm test`). The live project runs 17.11, and local testing so far used 16.14 only.
2. Run `awk '!/^#/ && NF{print $1"  "$2}' supabase/FROZEN-SOURCES.sha256 | sha256sum -c -` and confirm all 12 frozen files report OK.
3. Re-run the read-only inspection of the live project and confirm it is still empty: no `public` tables, no `supabase_migrations` schema, no `auth.users` rows and no `auth.users` triggers.

Last read-only check (2026-10-05, pre-approval review): still empty in all four respects. It also showed:
- PostgreSQL 17.11, `default_toast_compression` = pglz, `default_transaction_isolation` = read committed;
- `auth.users` is owned by `supabase_auth_admin`;
- `postgres` holds TRIGGER and REFERENCES on `auth.users` (enough for frozen 0003 and for 0403 to create their sign-up triggers), but is neither its owner nor a member of the owner role.

## Apply (owner approval required)

**Option A: Supabase CLI** (recommended; it records each version in `supabase_migrations.schema_migrations`)

```
supabase login                                   # browser sign-in
supabase link --project-ref jmztpjudwzjvrcdtjynd # prompts for the DB password locally
supabase db push --dry-run                       # must list exactly the pending files, in order (for 0408: only 0408)
supabase db push                                 # applies them
```

**Open check before using the CLI:** each migration file has its own `BEGIN; … COMMIT;`. The frozen files do too, and they cannot be edited. The Supabase documentation does not say how `db push` treats an explicit transaction inside a file. Do the dry run first. If the CLI wraps files in its own transaction and rejects or warns about nested `BEGIN`, stop and use Option B. Do not edit the frozen files.

**Option B: one file at a time**, in the order above, through the dashboard SQL Editor or the Supabase connector's `apply_migration` (one call per file, named after the file). Stop at the first error. Every file is idempotent and ends with post-condition checks that abort and roll back its transaction on any deviation.

## After applying (read-only)

1. Repeat the inspection and check the expected state (after 0406; after 0407 in brackets; after 0408, only `formula_versions` changes: 577 → 581):
   - 22 [23, with `plan_offers`] tables in `public`, all with RLS enabled and forced;
   - calculators 583, formula_versions 577, engine_proven 252, canonical_fields 47, plans 2, engineering_analyzers 14 [plan_offers 2];
   - 16 [15: `pf_machine_allowance_ok` is removed] SECURITY DEFINER functions owned by `postgres`, all with `search_path=''`. The only one `anon` can execute is the frozen trigger function `df_handle_new_auth_user`, which PostgreSQL refuses to run outside a trigger;
   - trigger `pf_on_auth_user_created` on `auth.users`.
2. Run the Security and Performance advisors (`get_advisors`) and review every finding.
3. Sign up one test account and confirm a `profiles` row appears. After 0407: confirm the Free account cannot create a garage, vehicle or Test Setup, cannot save a calculation and cannot run the Engineering Lab.

## Rollback

`0408` has no rollback (formula versions are immutable history; see "Prepared, not applied: 0408"). `supabase/rollback/04xx_*.rollback.sql` reverses the earlier new migrations in reverse order (0407 → 0401). The suite tests this round-trip: afterwards the catalog equals the frozen foundation's exactly, and re-applying 0401–0407 restores the full catalog. One residue is expected on hosted Supabase. Dropping a trigger needs ownership of `auth.users`, which `postgres` lacks, so the 0403 rollback leaves `pf_on_auth_user_created` in place with its function replaced by a no-op, and says so in a warning. Removing that inert trigger needs the auth table owner. The 0402–0406 rollbacks delete billing, entitlement and saved-work data, so run them only on an empty or disposable project. `0201` and `0301` have frozen rollbacks. DATA- and GARAGE-FOUNDATION 1.0.0 have no rollback; on a project that was empty before, the full undo is to restore the pre-apply state (Supabase backup / PITR) or reset the project. Rolling back also needs owner approval.

## Not part of provisioning

- Stripe products, prices, keys, webhook endpoint and Edge Function.
- The frontend (`premium/`), which ships with the site through GitHub Pages when PR #2 is merged.
- Deploying F1.12.4 (see `CHANGELOG-F1_12_4.md`).
