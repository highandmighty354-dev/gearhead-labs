# VALUE-FOUNDATION 1.0.0 — Value Foundation V1

**Status:** implemented under the separate VALUE-FOUNDATION-1.0.0 implementation authorization. Additive: no file outside `value-foundation-1.0.0/` changes.

**Governing artifacts** (verbatim copies here; SHA-256 re-verified at every load and by the suite):

| Artifact | SHA-256 |
|---|---|
| `design/VALUE-FOUNDATION-V1-FINAL-SPECIFICATION.md` (approved specification) | `a28cfddb7a5bb43f0767a5dd04ed0ea9acf67616c4b9f264b1ebc0e737560555` |
| `config/VALUE-FOUNDATION-V1-FINAL-ADMISSION-48.csv` | `f9b91aa8a653c76fa3cb56b94e5d62e0538ba7e929b09f77fab89e33aa205d9f` |
| `config/VALUE-FOUNDATION-V1-DEFERRED-REGISTER.csv` | `f2fa130db594e9cb15442041b6e706a11595adbc1b41fc74c022ddd48cc85f04` |

`.gitattributes` marks them `-text`, so their CRLF bytes survive any checkout.

## 1. What is implemented

| Part | Where | Contract |
|---|---|---|
| **Admission configuration** — 48 source fields → 47 canonical keys | `config/admission-config.json`, `src/admission.js` | §D, §E; OWN-A/B. Derived mechanically by `tools/generate.js`; `--check` proves byte-identity. Loader refuses to start if any artifact hash differs |
| **Database seed** — exactly 47 `canonical_fields` rows | `supabase/migrations/0301_value_foundation_v1_seed.sql` | §D/§E, §V6, owner seed clarification. One row per key; no source-field rows; no new table |
| **Rollback** | `supabase/rollback/0301_value_foundation_v1_seed.rollback.sql` | removes the 47 rows; **refuses once any value references them** (keys are permanent) |
| **Specification values** — write, current value, display | `src/values.js`, `src/units.js` | §G–§M, §P. Every write/read goes through the closed DATA-FOUNDATION-1.1.0 trusted service; VF issues no SQL |
| **Value → engine adapter** | `src/adapter.js` | §O 1–12, over the frozen CALCULATION-FOUNDATION service |

### 48 → 47
`canonical_fields` holds one row per **canonical key** (47). The 48 admitted **source fields** (calculator inputs) and their engine keys live in committed configuration. The one shared quantity is `vehicle_cg_height` ← `center_of_gravity_height__in` (`anti_squat.cg`) and `vehicle_cg_height__in` (`anti_dive.cgH`); the adapter feeds both engine keys from the one key. Approved renames: `supercharger_to_crank_speed_ratio`, `clutch_release_force` (old names absent and rejected).

### Seed (0301)
`INSERT … ON CONFLICT (key) DO NOTHING`, then **post-conditions**: every one of the 47 rows must equal the approved artifact exactly (family, `dimension` NULL per G-3, `canonical_unit` = engine-native storage unit, `numeric`, description = the approved definition), and no old renamed key, raw source-field id or deferred field id may exist as a key. A pre-existing differing row aborts the whole transaction. The only DDL is a transaction-scoped `TEMP` table (`ON COMMIT DROP`); the catalog fingerprint is unchanged.

### Units and display
- **§H is the conversion source of truth**, implemented once, in DATA-FOUNDATION-1.1.0 (`src/units.js` `TABLE`). Value Foundation defines **no** conversion constant: writes normalize there; display reads the same table in the opposite direction.
- **User-facing labels → trusted tokens:** the artifact's `valid_input_display_units` entries are mapped by an explicit table (`src/units.js` `LABELS`); an unmapped label fails generation. **`gal (US)` → token `gal`** (§H's storage gallon is the US gallon); the token itself is also accepted. Annotated identity entries (`TPI (…)`, `° (…)`, `(dimensionless — no conversion)`) map to their storage unit only.
- **Each field's admitted unit set equals the trusted path's §H set** for its storage unit (asserted at generation and in the suite).
- **§I display (G-1/G-2, display only):** 6 significant digits, half away from zero on the exact stored binary value, trailing zeros dropped; unknown shows as no value. Stored values are never rounded (binary64).

### J-pipe
`jpipe_resonator_diameter` = **inside diameter** (recorded engineering sign-off from the frozen chamber-volume formula). The user-facing label is **"Pipe Inside Diameter"**; the frozen label "Pipe Diameter" is kept verbatim alongside it. This is the only display-label override; every other label is the frozen calculator input label. The seeded description is the approved artifact's definition, verbatim.

### Write path (owner ratification A)
`createSpecificationValues` wraps the closed DATA-FOUNDATION-1.1.0 `createValueWriteService`, configured with the 47 keys as field contracts. Value Foundation adds only: admission by canonical key (`VF_FIELD_NOT_ADMITTED`), the label → token mapping (`VF_UNSUPPORTED_UNIT`), and display. Everything else is the trusted path's: owner from the verified context (a request `owner_id` is rejected), active machine and garage (`FOR SHARE`), `specification` context, V1 provenances, machine-level only, finite numbers, exact conversion, −0 → +0, linear supersession, frozen FK / RLS / triggers.

### Adapter (§O)
For a calculator the frozen authority would execute (proven, or a permitted alias) and a machine: for each **admitted** engine variable **not present** in the request's explicit inputs, read the current value (§L) through the trusted path; supply it **bit-for-bit** if known; supply nothing if unknown or absent. Then call the frozen calculation service, which validates, executes (GH_ENGINE) and persists. A rejected read (another owner, soft-deleted machine/garage) stops the calculation. Goals, conditions and rule parameters are never admitted fields, so they are only ever explicit inputs. `input_value_ids` is not populated; calculated results are never written back.

## 2. Not implemented (deferred by the specification)
Test Setup linkage, Component Attribution, configuration versions, measured test results, correlation / active value, `input_value_ids`, the financial domain, no-unit fields, every deferred-register field (19 multi-instance, `king_pin_arm`, 13 engineering review, 15 unresolved identity, 4 invalid), the bearing categorical architecture, calculated-value write-back, F1 defect remediation, any new DATA-FOUNDATION table. No frozen file is modified.

## 3. Verification
```
cd value-foundation-1.0.0 && npm ci && node tools/generate.js --check && ./tests/run-tests.sh
./value-foundation-1.0.0/tools/isolation-check.sh     # every foundation + this one (npm ci in each package)
```
The suite builds the stack from the frozen tags (DATA 1.0.0 0001–0005, GARAGE 0101–0103, DATA 1.1.0 0201), applies 0301, loads the CALCULATION service from its tag, and covers §U1–§U16 by name (`[Un]` in each check), plus migration idempotency / post-conditions / rollback, owner isolation, soft delete, spoofed owner, the `gal (US)` mapping and the J-pipe configuration; 28 negative controls. §U17/§U18 (frozen regressions, isolation, determinism, fresh clone) are the isolation gate. The frozen per-foundation isolation scripts, including DATA-FOUNDATION-1.1.0's, now fail by design (they forbid later directories and tags); this gate validates their baselines instead.

**§U18 wording:** "all 12 tags" is read as the 12 tags frozen when the specification was approved plus `DATA-FOUNDATION-1.1.0` (13), all byte-identical.

## 4. Observations recorded (no scope change)
- The approved key `clutch_release_force` coincides with the frozen calculator id `clutch_release_force` (dual role recorded in the specification). Its source field is fed into a **different** calculator (`clutch_pedal_effort.release`); no key is named after its own source calculator.
- The seeded J-pipe description is the approved artifact's text, which predates the recorded sign-off ("requires engineering sign-off at formal approval"). It is kept verbatim (artifacts are never rewritten); the sign-off is recorded in this milestone's authorization.
- Deployment gate #6 (hosted `service_role` privileges and RLS bypass) still applies before any hosted deployment.
