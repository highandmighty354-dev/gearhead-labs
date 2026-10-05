# Provisioning the Gearhead Labs Premium database (APPROVAL REQUIRED · NOT DONE)

Nothing in this directory has been applied to the Supabase project `jmztpjudwzjvrcdtjynd`. The project was verified empty by read-only inspection on 2026-10-05. Every step below that writes to the project needs explicit owner approval first.

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

The obsolete Phase 3A `0001_premium_schema.sql` is **not** applied. It was retired to `docs/retired/phase-3a/` (see `RETIRED.md`).

## Before applying (all read-only)

1. On the commit to be applied, run `cd premium-foundation && npm install && npm test`, and confirm 49/49 checks pass, idempotency, order and rollback are OK, and 21/21 mutants are killed. If possible, run it once with PostgreSQL 17 binaries as well (`PG_BIN=/usr/lib/postgresql/17/bin npm test`). The live project runs 17.11, and local testing so far used 16.14 only.
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

1. Repeat the inspection and check the expected state:
   - 22 tables in `public`, all with RLS enabled and forced;
   - calculators 583, formula_versions 577, engine_proven 252, canonical_fields 47, plans 2, engineering_analyzers 14;
   - 16 SECURITY DEFINER functions owned by `postgres`, all with `search_path=''`. The only one `anon` can execute is the frozen trigger function `df_handle_new_auth_user`, which PostgreSQL refuses to run outside a trigger;
   - trigger `pf_on_auth_user_created` on `auth.users`.
2. Run the Security and Performance advisors (`get_advisors`) and review every finding.
3. Sign up one test account and confirm a `profiles` row appears. Confirm it can create one machine but not a second, and cannot save a calculation.

## Rollback

`supabase/rollback/04xx_*.rollback.sql` reverses the new migrations in reverse order (0406 → 0401). The suite tests this round-trip: afterwards the catalog equals the frozen foundation's exactly, and re-applying 0401–0406 restores the full catalog. One residue is expected on hosted Supabase. Dropping a trigger needs ownership of `auth.users`, which `postgres` lacks, so the 0403 rollback leaves `pf_on_auth_user_created` in place with its function replaced by a no-op, and says so in a warning. Removing that inert trigger needs the auth table owner. The 0402–0406 rollbacks delete billing, entitlement and saved-work data, so run them only on an empty or disposable project. `0201` and `0301` have frozen rollbacks. DATA- and GARAGE-FOUNDATION 1.0.0 have no rollback; on a project that was empty before, the full undo is to restore the pre-apply state (Supabase backup / PITR) or reset the project. Rolling back also needs owner approval.

## Not part of provisioning

- Stripe products, prices, keys, webhook endpoint and Edge Function.
- The frontend: the Phase 3A `premium/` adapter still targets the retired tables, and needs a separate, reviewed change before it can talk to this schema.
- Deploying F1.12.4 (see `CHANGELOG-F1_12_4.md`).
