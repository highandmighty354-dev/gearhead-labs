# CHANGELOG — DATA-FOUNDATION 1.1.0

## 1.1.0 — value-write boundary amendment

**Database (migration 0201):**
- Withdrawn: `INSERT` on `public.value_records` for `authenticated` (granted at `0004_rls.sql:79`).
- Dropped: policy `df_values_insert` (created at `0004_rls.sql:83`).
- Unchanged: `SELECT` for `authenticated` and `df_values_select`; all triggers, constraints, foreign keys, indexes, enums and functions. No object created; no data migrated (no 1.0.0 database can hold value rows: `canonical_fields` is unseeded).
- Rollback script restores the 1.0.0 catalog exactly.

**Trusted write path (new, `src/`):** service-role application code; owner from verified login only; V1 context / provenance / component rules; exact §H normalization with no write rounding; −0 → +0; CALCULATION-FOUNDATION active-machine rule with `FOR SHARE` (closes the 1.0.0 soft-delete gap); linear supersession under a series lock; current-value read helper.

**Not in this release:** the Value Foundation 47-key admission set, its seed or configuration; Test Setup linkage; Component Attribution; measured test results; correlation / active values; configuration versions; `input_value_ids`; financial fields; F1 defect fixes; any engine change.

**Frozen, unchanged:** `data-foundation/` (DATA-FOUNDATION-1.0.0, 219/219), MAPPING, GARAGE, CALCULATION, F1.12.3, all 12 tags.

**Release-compatibility note:** withdrawing a client privilege is breaking under strict semver; the owner chose `1.1.0` because no deployed client depends on direct INSERT (no hosted deployment; #6 open).
