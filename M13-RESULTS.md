# M1.3 — Understeer Gradient correction: verification report

**Version:** F1.12.1 · tag (pending approval) `F1.12.1-M1.3-UNDERSTEER` · engine `gh-engine@1.1.0` (unchanged).
**Built on:** `F1.12.0-D009-CATEGORICAL`. Scope: `understeer_gradient` only. **Not committed.**

## What changed for visitors

| | F1.12.0 | F1.12.1 |
|---|---|---|
| Formula | (front % / Cf − rear % / Cr) × 1000, unitless "index" | **Kus = Wf/Cf − Wr/Cr**, Wf = W·f/100, Wr = W·(100−f)/100 (axle loads with axle stiffness) |
| Inputs | Cf, Cr, Front Weight % (`wt_f`) | Cf, Cr, Front Weight % (`ug_fpct`), **Vehicle Weight (`ug_vw`, 3,420 lb)** |
| Defaults result | 19.05 (Understeer) | **0.651 deg/g** (Understeer) |
| Cr = 150 | −80 (Oversteer) | −2.736 deg/g (Oversteer) |
| Cr = 195 | 0 (Neutral) | 0.000 deg/g (Neutral) |
| stiffness 0 / f ≤ 0, ≥ 100 / W ≤ 0 | Infinity, −Infinity or a number, with a verdict | **Validation required** |
| Front Weight % field | "↓ use 7500" link + "⚠ Unusual weight" warning (id matched the vehicle-weight pattern) | neither (no pattern match) |
| Example | "…calculates a specific Kus value…" | 3,420 lb / 48 % / 180 / 210 → ≈ 0.651 deg/g, understeer |

- **Verdicts:** every valid input keeps its pre-M1.3 verdict. The threshold is the old ±0.5 index with the identical expression and rounding, which equals |Kus| ≤ 0.5·W/100,000 deg/g (≈ ±0.0171 at 3,420 lb). This was checked by a boundary-dense sweep of 891 valid inputs against the old verdict logic.
- **Metric:** Vehicle Weight displays in kg (3,420 lb → 1,551.29 kg); the math runs in lb and the result is unchanged.

## Save to Vehicle (ALT-A contract)

The Understeer Gradient Vehicle Weight field **never** writes `profile.weight`. `ug_vw` and `ug_fpct` match **none** of the 20 live `PROFILE_FIELD_MAP` patterns or the 8 `FIELD_RANGE_RULES` patterns.

Tested on the actual F1.12.1 file, using the real `ghmSaveCurrentToVehicle()`, with the Ram 2500 demo at 7,500 lb:

| Case | Profile weight | Calculator's own saved state |
|---|---|---|
| A: untouched, save | 7,500 → **7,500** | ug_vw 3420, ug_fpct 48 |
| B: only Front Weight % → 55, save | 7,500 → **7,500** | ug_fpct 55 |
| C: Vehicle Weight → 7,600, save | 7,500 → **7,500** | ug_vw 7600 (retained, not propagated) |

For comparison: in F1.12.0 the same case A wrote **48**, and case B wrote **55**.

## Verification

- **Release gate PASS:**
  - syntax 17/17
  - static 15/15 (EVAL 577, DIFFERENTIAL 259, …)
  - live: LIVE_RENDER 612, RENDER_STABLE 612, DEFAULT_EXAMPLE 606 (understeer now **EXACT**, 0.651)
  - engine: ENGINE_EMBED, V_UNKNOWN, ENGINE_UNKNOWN 577, OPTION_CONTRACT 10, ENGINE_NODE, FORMULA_DISPLAY **251**, LIVE_PARITY **251** (4,178 comparisons), **UNDERSTEER_M13 20** (new)
  - ENGINE_NODE_TESTS **76** (+26)
- **vs F1.12.0:** identical except FORMULA_DISPLAY and LIVE_PARITY 250→251, new UNDERSTEER_M13, Node tests 50→76.
- **vs F1.10.6-FINAL:** the 18 static and live suites are identical.
- **Isolation:**
  - registry: 576 other entries byte-identical (fingerprint, results, formula HTML, strip, units, validity)
  - content: 605 other calculator pages byte-identical (content JSON, rendered calculator HTML, formula block)
  - page diff: 10 hunks, all inside understeer_gradient (live renderer 4, dead copy 4, registry 1, content 1)
- **Exception:** OPEN_DECISION was removed only after the live harness reported it **stale** ("default output now reproduces the example 0.651").
- **Migration:** 250 → **251**. Pending stays **9**.

## Negative controls: 6/6 caught

| Control | Caught by |
|---|---|
| 1 restore old index formula | DEFAULT_EXAMPLE (19.048), UNDERSTEER_M13, Node tests |
| 2 swap Wf and Wr | DEFAULT_EXAMPLE (2.063), UNDERSTEER_M13, Node tests |
| 3 remove validation guard | UNDERSTEER_M13 (10 invalid cases), Node tests. LIVE_PARITY alone would not catch it. |
| 4 rename `ug_fpct` → `wt_f` | **profile-save tests** (7,500 → 48 in all three), pattern test, Node tests |
| 5 revert example | DEFAULT_EXAMPLE |
| 6 (extra) rename `ug_vw` → `wt_ug` | profile-save test (7,500 → 3,420), pattern test, Node tests |

## Test defects found and fixed during M1.3 (both made the tests stricter)

1. **Verdict detection matched the word "Understeer" in the result *label*,** so every verdict read as Understeer. The calculator was correct (−1.500 deg/g, "Oversteer (loose)"). The test now reads only the verdict line, and the display checks no longer pass trivially.
2. **The suite crashed instead of reporting** when a field was missing (control 4). It now records any unexpected error as a failure, so the save tests report their result.

## Incidental findings (not acted on; for later decisions)

- **Future architecture: shared Save-to-Vehicle change tracking.** Save captures every rendered field; no touched/dirty state exists. Recommended before Premium restores the button: write only fields the user changed. This would also fix the 4 last-wins calculators (`et_weight_change`, `sim_weight_transfer`, `weight_transfer_braking`, `weight_transfer_accel`), and would let understeer's weight field rejoin the vehicle-weight pattern.
- **Save to Vehicle is not reachable in the Free UI** (the button is commented out as a premium candidate). All save findings are latent until Premium.
- **At f = 48 % the neutral condition Cr = 195 computes −1.8 × 10⁻¹⁵** (IEEE), displayed 0.000 / Neutral. The exact-zero tests use f = 50 % and f = 40 %.
