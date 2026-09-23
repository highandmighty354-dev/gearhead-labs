# F1.12.2 — speed_converter corrective release (SPEED-CONVERTER-FIX)

**Version:** F1.12.2 · proposed tag `F1.12.2-SPEED-CONVERTER-FIX` (not created) · engine `gh-engine@1.1.0` (unchanged).
**Baseline:** `F1.12.1-M1.3-UNDERSTEER`. **Scope:** `speed_converter` only. **Not published.**

## Defect, root cause, correction

- **Defect:** with From = ft/s the live calculator displayed the input unchanged in every unit: 60 ft/s showed 60 mph, 60 km/h and 60 m/s.
- **Root cause:** a **missing branch** in the live renderer. It pre-fills all four outputs with the input, then overwrites the other units inside a branch per source unit. It had branches for mph, km/h and m/s only. It was not a constant error or a unit-binding error. The shared engine was not involved: its registry entry was a fixed "from mph" snapshot with no From input.
- **Correction** (approved text; the inverses of the calculator's own constants; no new constants; existing display precision):
  ```js
  else if(s_from==='fps'){ mph=+(s_in/1.46667).toFixed(2); kph=+(s_in/0.91134).toFixed(2); mps=+(s_in/3.28084).toFixed(3); }
  ```
- **D-009 re-proof:** the registry entry now declares the From selector with the approved option mechanism, with no engine change. The bound constants are copied from the corrected live branches. Each output is a multiply/divide pair, so every live operation, multiply or divide, is kept exactly.

## Registry change (`GH_BACKFILL_FORMULAS.speed_converter`)

**Before:** inputs `s_in`; outputs `s_in`, `+(s_in*1.60934).toFixed(2)`, `+(s_in*0.44704).toFixed(3)`, `+(s_in*1.46667).toFixed(2)` (mph source only).

**After:**
- inputs `s_in` ("Speed") and **`s_from`** ("From Unit", categorical)
- outputs:
  - MPH = `s_in*mph_mul/mph_div` (mph)
  - KM/H = `s_in*kph_mul/kph_div` (km/h)
  - M/S = `s_in*mps_mul/mps_div` (m/s)
  - FT/S = `s_in*fps_mul/fps_div` (ft/s)

**Option declaration** (values and labels exactly as the live select; constants shown as mul / div):

| From | MPH | KM/H | M/S | FT/S |
|---|---|---|---|---|
| `mph` (mph) | 1 / 1 | 1.60934 / 1 | 0.44704 / 1 | 1.46667 / 1 |
| `kph` (km/h) | 1 / 1.60934 | 1 / 1 | 1 / 3.6 | 0.91134 / 1 |
| `mps` (m/s) | 2.23694 / 1 | 3.6 / 1 | 1 / 1 | 3.28084 / 1 |
| `fps` (ft/s) | 1 / 1.46667 | 1 / 0.91134 | 1 / 3.28084 | 1 / 1 |

The engine returns unrounded values; the live page rounds for display (MPH / KM/H / FT/S to 2 dp, M/S to 3 dp). LIVE_PARITY compares at the displayed precision, as with `injector_flow`.

## Before / after (live page)

| Input | Before | After |
|---|---|---|
| **60 ft/s** | 60 mph · 60 km/h · 60 m/s | **40.91 mph · 65.84 km/h · 18.288 m/s** · 60 ft/s |
| 1 ft/s | 1 · 1 · 1 | 0.68 · 1.1 · 0.305 |
| 10 ft/s | 10 · 10 · 10 | 6.82 · 10.97 · 3.048 |
| 100 ft/s | 100 · 100 · 100 | 68.18 · 109.73 · 30.48 |
| 0 from any unit | 0 | 0 |
| mph, km/h and m/s sources | correct | **unchanged**: identical to the pre-fix code for 27 inputs × 4 outputs |
| Reverse: 40.91 mph / 65.84 km/h / 18.29 m/s | → 60 / 60 / 60.01 ft/s | unchanged |

**Published formula:** was the mph-only snapshot; now `s_in · mph_mul/mph_div …` with a legend defining every constant per unit. No JavaScript appears in the typeset math.

## Verification

- **Release gate PASS:**
  - syntax 17/17
  - static 15/15 (EVAL 577, DIFFERENTIAL 259)
  - live: LIVE_RENDER 612, RENDER_STABLE 612, DEFAULT_EXAMPLE 606 (the example "60 mph → 96.56 km/h" still reproduces)
  - engine: ENGINE_EMBED 2, V_UNKNOWN 8, ENGINE_UNKNOWN 577, **OPTION_CONTRACT 11**, ENGINE_NODE 1 (browser = Node under every option), **FORMULA_DISPLAY 252**, **LIVE_PARITY 252 (4,242 comparisons)**, UNDERSTEER_M13 20, **SPEED_F1122 22 (new)**
  - **Node tests 100** (+24)
- **LIVE_PARITY, speed_converter:** 16 vectors (4 options × defaults, all scaled, speed scaled, speed = 0), **64 comparisons, 0 problems**; OPTION_SET exact.
- **Suite by suite:**
  - vs F1.12.1: only OPTION_CONTRACT 10→11, FORMULA_DISPLAY and LIVE_PARITY 251→252, new SPEED_F1122, Node 76→100
  - vs F1.12.0 and F1.10.6-FINAL: the 18 static and live suites are identical
- **Isolation:**
  - registry: 576 other entries byte-identical
  - pages: 605 other calculator pages byte-identical (content, rendered HTML, formula block)
  - the 13 scope-locked calculators are identical
  - page diff: 2 hunks (the ft/s line and the registry entry)
- **Migration:** 251 → **252**. Pending 9 → **8**.

## Negative controls: 5/5 caught

| Control | Caught by |
|---|---|
| remove the ft/s branch | LIVE_PARITY (engine 40.909 vs live 60 mph), SPEED_F1122 |
| 1% change to one bound constant | LIVE_PARITY, SPEED_F1122, Node tests |
| multiply swapped for divide (km/h source) | LIVE_PARITY (96.56 vs 37.28), Node tests |
| drop ft/s from the declaration | OPTION_SET, SPEED_F1122, Node tests |
| ft/s branch writes the wrong outputs | LIVE_PARITY, SPEED_F1122 |

The live-only defects (1, 5) are invisible to the engine-only Node tests by design, and are caught by the live-page suites.

## Not changed

`gh-engine.js`, temp_converter, the other 7 pending cases, understeer_gradient, the 4 formula-display exceptions, every other calculator, and the shared save and profile code.
