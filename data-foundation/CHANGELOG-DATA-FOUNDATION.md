# DATA-FOUNDATION 1.0.0

**First release** of the canonical engineering data layer (Phase 1), built on protected baseline `F1.12.3-UI-MOBILE-HEADER`. The F1 application is unchanged.

## Added (all under `data-foundation/`)

- **Migrations `0001`–`0005`:**
  - enums and 10 tables
  - composite same-owner foreign keys
  - UNKNOWN ≠ ZERO value checks
  - append-only values and calculation history, and immutable formula versions
  - server-forced timestamps; soft delete only
  - RLS enabled and forced everywhere, with narrow grants
  - **Decision B** fixed-table soft-delete functions
  - a generated reference seed of 583 calculators and 577 formula versions
- **`tools/export-engine-catalog.js`:** a read-only catalog export from the tagged F1.12.3 engine, with a byte-exact `--check` mode.
- **`tests/`:**
  - a self-contained runner with a throwaway PostgreSQL cluster
  - the Supabase test shim
  - **219 deterministic checks**: the 186 specified checks plus 33 Decision B soft-delete security checks
- **Documentation and evidence:** `DATA-FOUNDATION.md`, `evidence/`, `verification-baseline-DATA-FOUNDATION.txt`, `isolation-evidence.txt`.

## Not changed

The F1.12.3 page, `gh-engine.js`, the registries, `engine-migrated.json`, `engine-pending.json`, F1 tests and gates, the F1 `package.json` and `MANIFEST.sha256`, and all calculator counts and fingerprints.
