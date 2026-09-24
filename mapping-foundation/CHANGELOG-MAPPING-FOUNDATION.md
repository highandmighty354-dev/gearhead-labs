# MAPPING-FOUNDATION 1.0.0

**First release** of the Calculator Mapping Registry, as committed metadata. It is built on `DATA-FOUNDATION-1.0.0`, and F1.12.3 is unchanged.

## Added (all under `mapping-foundation/`)

- **The registry:**
  - `registry/canonical-fields.json`: 923 draft fields, for engineering review
  - `registry/calculator-mappings.json`: 252 engine-proven calculators (195 complete draft, 57 partial)
  - `registry/classifications.json`: 325 classified-only calculators, aliases, and review items
- **Tools:** `tools/generate-mappings.js` (read-only from the frozen tags, with a byte-exact `--check` mode), `tools/validate-mappings.js`, `tools/isolation-check.sh`.
- **Tests:** a runner with a throwaway PostgreSQL, and **83 deterministic checks**, including mapping parity (195/195 calculators, 2,887 output comparisons) and compatibility with the frozen DATA-FOUNDATION schema.
- **Documentation and evidence:** `MAPPING-FOUNDATION.md`, `evidence/`.

## Not changed

F1.12.3 (page, engine, registries, lists, gates) and `data-foundation/`.

## Deferred

The Calculation API and write path, dependency resolution, mapping database persistence, provisioning, localStorage migration, Premium, and UI.
