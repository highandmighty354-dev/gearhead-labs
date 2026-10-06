# Provisioning the Gearhead Labs Premium database

**Status (2026-10-06):** the 16 files in the table below (0001–0406) were applied to the production project `jmztpjudwzjvrcdtjynd` by the gated workflow *Provision Supabase (manual, gated)*, pinned to commit b2baaaa. **`0407_premium_product_model.sql` is prepared and tested but NOT applied** (see "Pending: 0407" below). Every step that writes to the project needs explicit owner approval first.

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

## Pending: 0407 (final product model, owner approval required)

| # | File | Origin |
|---|---|---|
| 17 | `0407_premium_product_model.sql` | PREMIUM-FOUNDATION 1.1.0 (new, not applied) |

What it does: Premium becomes the single paid product ($5.99/month, $59.99/year, recorded in the new reference table `plan_offers`); My Garage (garages, machines, details, components, connections, Test Setups) requires the Premium `garage` feature to create or edit; the 0404 Free one-vehicle allowance is removed; `plan_prices` (still empty, no Stripe) can only ever hold an approved offer.

Production data it alters: **only the `plans` row `premium`**, whose `features` array changes from `garage_unlimited` to `garage`. No account, grant, garage, machine or saved-work row is touched. Everything else is additive (one new table with 2 rows, one constraint, one foreign key, 12 restrictive policies) or removes the retired allowance policy and its function. Rollback: `supabase/rollback/0407_premium_product_model.rollback.sql` restores the exact 0406 catalog (tested).

To apply it, the workflow on `main` must be updated in a reviewed change: re-pin it to the commit that contains 0407 and extend its manifest from 16 to 17 files. Then run DRY-RUN, review, and APPLY with owner approval. **Apply 0407 before PR #2 is merged:** the PR's frontend expects the `garage` feature, and until 0407 is applied the live database still allows a Free account to add one vehicle through the API.

The obsolete Phase 3A `0001_premium_schema.sql` is **not** applied. It was retired to `docs/retired/phase-3a/` (see `RETIRED.md`).

## Before applying (all read-only)

1. On the commit to be applied, run `cd premium-foundation && npm install && npm test`, and confirm 47/47 checks pass, idempotency, order and rollback are OK, and 24/24 mutants are killed (counts as of 0407). If possible, run it once with PostgreSQL 17 binaries as well (`PG_BIN=/usr/lib/postgresql/17/bin npm test`). The live project runs 17.11, and local testing so far used 16.14 only.
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
supabase db push --dry-run                       # must list exactly the 16 files above, in order
supabase db push                                 # applies them
```

**Open check before using the CLI:** each migration file has its own `BEGIN; … COMMIT;`. The frozen files do too, and they cannot be edited. The Supabase documentation does not say how `db push` treats an explicit transaction inside a file. Do the dry run first. If the CLI wraps files in its own transaction and rejects or warns about nested `BEGIN`, stop and use Option B. Do not edit the frozen files.

**Option B: one file at a time**, in the order above, through the dashboard SQL Editor or the Supabase connector's `apply_migration` (one call per file, named after the file). Stop at the first error. Every file is idempotent and ends with post-condition checks that abort and roll back its transaction on any deviation.

## After applying (read-only)

1. Repeat the inspection and check the expected state (after 0406; after 0407 in brackets):
   - 22 [23, with `plan_offers`] tables in `public`, all with RLS enabled and forced;
   - calculators 583, formula_versions 577, engine_proven 252, canonical_fields 47, plans 2, engineering_analyzers 14 [plan_offers 2];
   - 16 [15: `pf_machine_allowance_ok` is removed] SECURITY DEFINER functions owned by `postgres`, all with `search_path=''`. The only one `anon` can execute is the frozen trigger function `df_handle_new_auth_user`, which PostgreSQL refuses to run outside a trigger;
   - trigger `pf_on_auth_user_created` on `auth.users`.
2. Run the Security and Performance advisors (`get_advisors`) and review every finding.
3. Sign up one test account and confirm a `profiles` row appears. After 0407: confirm the Free account cannot create a garage, vehicle or Test Setup, cannot save a calculation and cannot run the Engineering Lab.

## Rollback

`supabase/rollback/04xx_*.rollback.sql` reverses the new migrations in reverse order (0407 → 0401). The suite tests this round-trip: afterwards the catalog equals the frozen foundation's exactly, and re-applying 0401–0407 restores the full catalog. One residue is expected on hosted Supabase. Dropping a trigger needs ownership of `auth.users`, which `postgres` lacks, so the 0403 rollback leaves `pf_on_auth_user_created` in place with its function replaced by a no-op, and says so in a warning. Removing that inert trigger needs the auth table owner. The 0402–0406 rollbacks delete billing, entitlement and saved-work data, so run them only on an empty or disposable project. `0201` and `0301` have frozen rollbacks. DATA- and GARAGE-FOUNDATION 1.0.0 have no rollback; on a project that was empty before, the full undo is to restore the pre-apply state (Supabase backup / PITR) or reset the project. Rolling back also needs owner approval.

## Not part of provisioning

- Stripe products, prices, keys, webhook endpoint and Edge Function.
- The frontend (`premium/`), which ships with the site through GitHub Pages when PR #2 is merged.
- Deploying F1.12.4 (see `CHANGELOG-F1_12_4.md`).
