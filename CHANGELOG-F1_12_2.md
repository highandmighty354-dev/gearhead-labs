# F1.12.2 — speed_converter corrective release

**Release gate PASS.** Engine unchanged (`gh-engine@1.1.0`). Migrated 251 → 252; pending 9 → 8.

**Page (2 hunks):**
- live `speed_converter()`: added the missing ft/s source branch (inverse constants, existing precision)
- `GH_BACKFILL_FORMULAS.speed_converter`: D-009 declaration of the From selector with bound constants copied from the live branches

**Metadata:** `engine-migrated.json` (+speed_converter), `engine-pending.json` (−speed_converter).

**Tests:** `gh-verify-engine.js` new SPEED_F1122 suite; `engine.test.js` +24 tests.

**Evidence:** `SPEEDFIX-RESULTS.md`, `tools/f1122/`.
