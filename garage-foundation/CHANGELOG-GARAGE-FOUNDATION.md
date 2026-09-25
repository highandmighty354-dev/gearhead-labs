# CHANGELOG — GARAGE-FOUNDATION

## 1.0.0 — structural Test Setup persistence (implemented; awaiting review, not committed, not tagged)

**Approved decisions applied:**
- **#25:** built before the Calculation API; structural only.
- **#26:** additive only, in `garage-foundation/`; migrations applied after DATA-FOUNDATION 0001–0005.
- **#27:** Labs deferred; the structure is Machine → Test Setup.
- **#28:** the minimum pinned Test Setup.

### Added
- **`supabase/migrations/0101_test_setups.sql`:** the `test_setups` table, with:
  - `UNIQUE (id, owner_id)`
  - a composite same-owner FK to `machines`
  - an owner FK to `accounts`
  - a non-blank name check
  - owner and machine indexes
- **`supabase/migrations/0102_test_setups_triggers.sql`:** Garage's own trigger functions:
  - server-forced timestamps and baseline pin on insert
  - no row created already deleted
  - immutable id, owner and machine
  - `created_at` restored on update
  - the pin moves only to the transaction's server time and never on a deleted row
  - hard DELETE refused for every role
- **`supabase/migrations/0103_test_setups_rls.sql`:**
  - RLS enabled and forced
  - narrow grants: column-level INSERT (`machine_id`, `name`, `description`, `notes`) and UPDATE (`name`, `description`, `notes`)
  - owner policies, with visibility tied to the frozen machine policy
  - `gf_soft_delete_test_setup(uuid)` and `gf_repin_test_setup_baseline(uuid)` (Decision B style)
- **`tests/run-tests.sh`, `tests/gf.test.js`:**
  - 81 deterministic checks
  - 28 negative controls (mutations that must be detected)
  - frozen migrations read from the `DATA-FOUNDATION-1.0.0` tag
- **`tools/isolation-check.sh`:** a 12-check isolation gate.
- **`evidence/`:**
  - `test-results.json`
  - `schema-dump.sql`
  - `verification-baseline-GARAGE-FOUNDATION.txt`
  - `isolation-evidence.txt`
- **`package.json`, `package-lock.json`:** `pg` 8.13.1, 13 packages, versions identical to the DATA-FOUNDATION lock.

### Recorded (not resolved)
- **Internal RI triggers.** A foreign key to a frozen table makes PostgreSQL add internal RI triggers (`tgisinternal`) to the referenced table (`machines`, `accounts`). This is inherent to "new objects may reference frozen objects" (#26); no frozen DDL changes. The frozen-catalog fingerprint test covers every user-defined object.
- **Frozen isolation scripts.** Those in DATA-FOUNDATION and MAPPING-FOUNDATION assert that nothing outside their own directory differs, so they fail by design once `garage-foundation/` exists. The Garage gate performs their checks explicitly.
- **Insert onto the owner's deleted machine.** As with frozen `components`, the INSERT policy does not reject an insert onto the owner's *own* soft-deleted machine. The row is immediately hidden.
- **Pin reconstruction limit.** Machine and component attribute edits are not versioned (#31 open). A pin time reconstructs values and component membership only.
