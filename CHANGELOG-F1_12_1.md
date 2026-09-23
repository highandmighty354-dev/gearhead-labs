# F1.12.1 — M1.3 Understeer Gradient correction

**Release gate PASS.** Engine unchanged (`gh-engine@1.1.0`). Migrated 250 → 251; pending 9.

**Page (understeer_gradient only; 10 hunks):**
- live `RENDERS.understeer_gradient` and the dead object-method copy (identical bodies): Gillespie Kus in deg/g with axle loads; new Vehicle Weight `ug_vw` (3,420 lb, standard weight units); Front Weight % renamed `wt_f` → `ug_fpct`; validation guard; 3 decimals; verdict threshold carried over exactly
- `GH_E1_FORMULAS.understeer_gradient`: vars `cf_stiff, cr_stiff, ug_fpct, ug_vw`, guarded formula, unit `deg/g`, defaults `[180,210,48,3420]`
- CONTENT example now states 0.651 deg/g

**Metadata:** `default-example-exceptions.json` OPEN_DECISION entry removed (proven stale); `engine-migrated.json` adds understeer_gradient.

**Tests:** `gh-verify-engine.js` new UNDERSTEER_M13 suite (patterns, 3 save cases, display, invalid inputs, metric, verdict sweep); `engine.test.js` +26 understeer tests.

**Evidence:** `M13-RESULTS.md`, `tools/m13/`.
