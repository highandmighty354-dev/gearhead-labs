# Stage 2 — calculator repairs (GH-DEF-045, 046, 047, 048, 050, 053, 054, 055, 057, and 062)

Branch `fix/stage-2-calculator-repairs`, from `main` `b58e1f0`. The live site serves deployment `d25afa2`, whose engine differs from `b58e1f0` only in three self-test rows. **Not merged, not deployed, nothing applied to Supabase.**

## Authorization and scope

- **2026-11-18, owner:** repair exactly GH-DEF-045, 046, 047, 048, 050, 053, 054, 055 and 057.
- **Excluded:** GH-DEF-049, 052 and 056; `qa-math-corrections.js`; Premium access; analytics; Supabase; Stripe; and PRs #27, #28 and #29.
- **Owner decisions taken during the work (2026-11-18):**
  - **046:** the diesel stoichiometric AFR is 14.5, fixed.
  - **054:** the simulator Air Density box is relabelled slug/ft³ and the second division by 32.174 is dropped. Like Dynamic Pressure, the label is the same in both unit systems.
  - **055:** the Intake Centerline typed on Exhaust Valve Events is the **installed** centerline. That page uses no hidden advance. The other cam pages are unchanged.
  - **Registry copies:** six of the calculators keep the same formula in the formula registry, which prints the FORMULA box and serves saved calculations. Both copies are corrected. The new `formula_versions` rows are written into migration `0410`, which is **prepared, not applied**.
  - **GH-DEF-062:** the Top Speed "Drag + Rolling" tile, exposed by the 054 fix, is repaired in this pass.

Every expected value below is computed **independently of the engine**. The sources are `premium/tests/known-answer-critical.test.js` (reference functions at the top of the file) and a separate Python check during the work. No case reads its expected value from the engine.

## Repairs

### GH-DEF-045 — Diesel Power from Fuel Flow (`23298d9`)

- **Reference:** P [hp] = ṁ_fuel [lb/hr] ÷ BSFC [lb/(hp·hr)]. The units cancel to hp.
- **Expected values:**
  - 25 lb/hr at 0.40 → **62.5 hp**.
  - 100 lb/hr at 0.38 → **263.16 hp**.
- **Root cause:** a ×60 factor, which belongs to a lb/min input. The input is labelled lb/hr.
- **Change:**
  - Renderer and the `GH_LEGACY_FORMULAS` row now compute `fuel/bsfc`.
  - The worked example is corrected.
  - The FAQ that explained away "3,750 HP" is corrected.
- **Metric:** the box shows kg/hr and is converted to lb/hr before the formula. The page shows 62.5 HP.

### GH-DEF-046 — Smoke-Limited Fuel (`1f043dd`)

- **Reference:** ṁ_fuel = ṁ_air ÷ (λ × AFR_stoich), with AFR_stoich = 14.5 for diesel (owner decision).
- **Expected values:**
  - 500 lb/min, λ 1.15 → **29.985 lb/min**.
  - 60 lb/min, λ 1.3 → **3.183 lb/min**.
- **Root cause:** the page divided by λ only, so the result was 14.5× too high.
- **Change:**
  - Renderer, its header formula text and the `GH_E1_FORMULAS` row are corrected.
  - The worked example is corrected.
- **Note:** the page shows one decimal, so 3.183 appears as 3.2. That precision is unchanged.

### GH-DEF-047 — Piston Position (`b7aa687`)

- **Reference:** slider-crank geometry, with the crank angle θ measured from TDC.
  - x = r(1 − cos θ) + L − √(L² − r² sin² θ), where r = stroke ÷ 2.
- **Expected values:**

| Stroke / rod (in) | Crank angle | Expected position below TDC |
|---|---|---|
| 3.75 / 6.76 | 0° | **0** |
| 3.75 / 6.76 | 90° | **2.1402 in** |
| 3.75 / 6.76 | 180° | **3.75 in** |
| 4.0 / 6.0 | 60° | **1.2554 in** |

- **Root cause:** the page computed r cos θ + √(…) − L, which equals r − x.
- **Change:**
  - Renderer and `GH_LEGACY_FORMULAS` row are corrected.
  - The worked example is corrected.
  - Self-test baseline row `renderer:piston_position 90deg` is removed. It now passes.

### GH-DEF-048 — Cranking Compression (`850331c`)

- **Reference:**
  - IVC is quoted in degrees ABDC, so at IVC the crank is at θ = 180° + IVC from TDC.
  - The trapped stroke is x(θ), from the slider-crank formula above.
  - CR_eff = 1 + (x ÷ S)(CR − 1).
  - P = P_atm × CR_eff^γ.
- **Expected values:**
  - 10.5 / 6.0 / 3.75 / 40°, γ 1.32 → **9.699 :1, 295.0 psi**.
  - 9.5 / 6.5 / 4.0 / 60° → **7.874 :1, 224.0 psi**.
- **Root cause:** the angle was IVC from TDC and the trapped stroke was S − x. The two errors partly cancelled.
- **Change:**
  - Renderer and both registry outputs are corrected.
  - The worked example is corrected.

### GH-DEF-050 — Wet Bulb (`7635946`)

- **Reference:** Stull, R. (2011), *J. Appl. Meteor. Climatol.* 50, 2267–2269. The formula is fitted in °C:
  - Tw = T·atan(0.151977·√(RH + 8.313659)) + atan(T + RH) − atan(RH − 1.676331) + 0.00391838·RH^1.5·atan(0.023101·RH) − 4.686035
- **Inputs are °F**, so they are converted to °C and the result is converted back.
- **Expected values:**
  - 85 °F / 50 % → **71.27 °F**.
  - 110 °F / 10 % → **68.78 °F**.
  - 60 °F / 30 % → **45.43 °F**.
- **Root cause:** °F was fed into the °C fit.
- **Change:**
  - Renderer and registry row are corrected.
  - The worked example and the stated dry/wet-bulb gap are corrected.
- **Limitation:** Stull's fit is stated for RH 5–99 % and −20 to 50 °C (about ±0.3 °C). It is not range-checked on the page; that is unchanged.

### GH-DEF-053 — Fuel Line Pressure Loss (`2022778`)

- **Reference:** Darcy–Weisbach, with the Darcy friction factor from Swamee–Jain:
  - f = 0.25 ÷ [log₁₀(ε/(3.7D) + 5.74/Re^0.9)]², or 64/Re when laminar.
  - Every quantity is converted to SI from exact definitions.
- **Expected values (0.74 SG, 0.6 cP, roughness 0.00006 in):**
  - 50 GPH / 10 ft / 0.375 in → Re 8,659, **f 0.0325, 0.304 psi**.
  - 300 GPH / 20 ft / 0.5 in → **3.575 psi**.
- **Cross-check:** Colebrook gives f within 0.6 % at both points.
- **Root cause:** the relative roughness was roughness in inches divided by the diameter in metres, 39.4× too large.
- **Change:** renderer only.
  - The registry row holds only velocity and Reynolds number, which this defect does not affect.
  - So the formula version is unchanged and no migration row is needed.

### GH-DEF-054 — Simulator air density (`b9ec416`)

- **Reference:** F = ½ρC·A·v², with ρ in slug/ft³. Sea level is 0.0023769 slug/ft³.
- **Expected values:**
  - Cornering downforce at 60 mph, Cl 1.2, A 22 ft² = **242.97 lbf**.
  - Convention-free bounds from an independent power-limited integration (85 % of the 319.88 HP curve peak; 3,200 lb; Cd 0.32; A 22 ft²; Crr 0.012):
    - top speed **≤ 174.3 mph**;
    - trap **≤ 115.7 mph**;
    - 0–130 mph **≥ 15.27 s**.
- **Root cause:**
  - The box was labelled lb/ft³ but held a slug/ft³ value.
  - Two code paths, `simAeroDrag` and `sim_cornering`, divided it by 32.174 again.
- **Change:**
  - The two paths are corrected and the box is relabelled slug/ft³.
- **Results at the defaults:**

| Result | Before | After |
|---|---|---|
| Top speed | 218.5 mph | 168.5 mph |
| Trap speed | 117.0 mph | 110.7 mph |
| Cornering downforce | 8 lbf | 243 lbf |

- **Test baselines premised on the defective drag were updated:**
  - **`acceleration-target`:** the goldens for the 7,500 lb vehicle were re-recorded.
  - **`curve-persistence`:** the typed curve also weakens the 6,000 rpm point. With correct drag, Top Speed is drag-limited near 6,000 rpm instead of at the redline. The test passes on both the old and the new engine.

### GH-DEF-062 — Top Speed "Drag + Rolling" tile (`14625f1`)

- **Reference:** D = ½ρCdAv² + Crr·W at the **reported** top speed.
  - At the defaults: 168.5 mph → **549.4 lbf**.
  - For the 7,500 lb vehicle: 165.5 mph → **582.96 lbf**.
- **Root cause:** the tile showed the loop variable after the search, which is the drag at the last speed tested. That is 898 lbf at about 218 mph.
- **Change:** one variable, `bestDrag`.

### GH-DEF-055 — Exhaust Valve Events (`ceeb32c`)

- **Reference:**
  - ECL = 2·LSA − ICL.
  - EVO = ECL + dur/2 − 180, in degrees BBDC.
  - EVC = dur/2 − ECL, in degrees ATDC.
  - ICL is the installed centerline (owner decision).
- **Expected values:**
  - 230° / LSA 110 / ICL 110 → **ECL 110, EVO 45, EVC 5**.
  - 236° / 112 / 106 → **EVO 56**.
- **Root cause:** `cam()` subtracted the shared 4° advance, which this page does not show.
- **Change:**
  - This page only. The help text now says the ICL is installed.
  - The worked example is corrected.

**Superseded 2026-11-18: cam centerline convention (owner instruction).** The "installed ICL on this page only" convention above was replaced by one convention for every cam page.
- **Convention:**
  - The cam card's **recommended** intake centerline is kept as entered and is never overwritten.
  - The user's **advance (+) / retard (−)** is a visible box on Cam Card, IVC and Exhaust Valve Events.
  - **Actual installed ICL = recommended ICL − advance.** It is computed only in `cam()` and used by every cam page and by the Dynamic Compression IVC pull.
  - Default advance is 0, meaning installed as recommended (owner decision). No hidden correction anywhere.
- **Reference:** standard .050-inch event relations on the installed ICL:
  - ECL = 2·LSA − ICL;
  - IVO = dur_i/2 − ICL;
  - IVC = dur_i/2 + ICL − 180;
  - EVO = ECL + dur_e/2 − 180;
  - EVC = dur_e/2 − ECL;
  - DCR by slider-crank at the pulled IVC.
- **Expected values (224 / 230 / LSA 110 / recommended ICL 110):**

| Setting | Installed ICL | IVO | IVC | ECL | EVO | EVC |
|---|---|---|---|---|---|---|
| Advance 0 | 110 | 2 | 42 | 110 | 45 | 5 |
| 4° advance | 106 | 6 | 38 | 114 | 49 | 1 |
| 4° retard | 114 | −2 | 46 | 106 | 41 | 9 |

- **Cross-page check:** 236 / 242 / LSA 112 / recommended 108 with 3° retard gives installed 111, IVC 49 and ECL 113 on all three pages. Dynamic Compression's pull gives IVC 49 and DCR 9.246 (10.5:1, 6.76 / 3.75 in). The same values hold in Metric.
- **Also fixed in that change (owner approved):**
  - **GH-DEF-068:** the Intake Centerline page's Apply button. It now sets the advance and keeps the recommended ICL.
  - **GH-DEF-069:** a cam page reached via another page showed stale remembered boxes and wrote them back over the shared cam.

### GH-DEF-057 — Road-course fuel stint (`375a0fb`)

- **Reference:** max green laps = ⌊usable fuel ÷ fuel per lap⌋. With exact arithmetic, 3.60 ÷ 0.12 = **30**.
- **Root cause:** in floating point the quotient is 29.999999999999996, which floored to 29.
- **Change:**
  - The quotient is rounded to 9 decimals before the floor, in the renderer and in the registry output.
  - The worked example is corrected.

## Tests and evidence

**Known-answer suite.** Its architecture is unchanged.
- **New case kind:** `api` checks the formula-registry path through `GH_ENGINE.calculate`.
- **New cases, 11 in total:**
  - registry path: KA-45 to KA-50, KA-52 and KA-53;
  - page: KA-51 (pressure drop) and KA-55 (EVO, second cam);
  - KA-54: the GH-DEF-062 tile.
- **Cam centerline convention (`572e8c6`), nine more cases, KA-56 to KA-64:**
  - KA-56 and KA-57: Exhaust Valve Events at 4° advance and 4° retard;
  - KA-58: the IVC page at advance 0, +4 and −4;
  - KA-59: the Cam Card tiles at 4° advance;
  - KA-60 and KA-61: one cam across Cam Card, IVC, Exhaust Valve Events and the Dynamic Compression pull, in Imperial and in Metric;
  - KA-62: a fresh visitor sees advance 0 and installed = recommended on every cam page;
  - KA-63: GH-DEF-068, the Intake Centerline Apply button;
  - KA-64: GH-DEF-069, stale remembered cam boxes.
  - KA-28, KA-29 and KA-55 now set the advance (0) explicitly.
- **Totals at the branch head:** 68 cases; 48 pass and 20 fail. The 20 failures are exactly the known-open ledger.
- **Ledger:** KA-01 to KA-12, KA-15 to KA-17, KA-22 to KA-29 and KA-31 are removed from the known-open ledger, 24 ids in all.
- **Still open, 20 ids:** GH-DEF-049, 051, 052, 056, 058 and 059.

**Engine self-test.** Rows `formula:diesel_smoke_limit` and `renderer:piston_position 90deg` are removed from `KNOWN_BASELINE_IDS`. The result is 735/736; the one remaining failure is GH-DEF-052.

**Red/green.**
- **Red:** `KA_STRICT=1 GH_ENGINE=<b58e1f0 engine>`. Every case listed above fails.
- **Green:** every case listed above passes on the branch head.
- **Isolation:** for each commit, the known-answer suite was run in strict mode against that commit and against its parent. The only cases that change state are those of the commit's own defect, and every change is fail → pass.
- **Counts (the ten repair commits, suite of 59 cases):** 4 of 59 cases pass on `b58e1f0` (the 4 controls). 39 pass at `ceeb32c`; the other 20 belong to defects left open.
- **Evidence file:** `docs/evidence/stage2-red-green-isolation.json` holds every transition and each original failure message. It covers the ten repair commits, up to `ceeb32c`.
- **Cam centerline convention (`572e8c6`):** KA-56 to KA-62 fail on `2913c14` and pass on `572e8c6`. KA-63 and KA-64 fail with their fix removed and pass with it. These results are recorded in the register entries for GH-DEF-055, 068 and 069, not in the evidence file.

**Formula fingerprints.** Six calculators now have new formula versions, recorded in `formula-fingerprints.test.js` (`VERSIONED`):

| Calculator | Old version | New version |
|---|---|---|
| diesel_power_from_fuel | fv1-0ab8e5a1 | fv1-b16d2d94 |
| piston_position | fv1-908de781 | fv1-09188b84 |
| cranking_compression | fv1-95fbced0 | fv1-ef403b86 |
| wet_bulb | fv1-a2a279c6 | fv1-782fda42 |
| rc_fuel_stint | fv1-072e823c | fv1-523c3d67 |
| diesel_smoke_limit | fv1-e12aa323 | fv1-64771dd0 |

**Migration 0410 (PREPARED, NOT APPLIED).**
- It adds those six rows and nothing else.
- It is proved on a private throwaway PostgreSQL server by `premium/tests/fv0410-throwaway-db.sh`. All 50 checks passed:
  - each old version accepted and each new version refused before 0410;
  - a wrong copy aborts and writes nothing;
  - the migration is idempotent;
  - every earlier row is byte-identical afterwards;
  - each new version is accepted after 0410, for its own calculator only;
  - immutability holds;
  - a client can read the rows but cannot insert.
- The provisioning workflow is pinned to `c69ec51` (19 files), so it cannot apply 0410 until it is re-pinned under a separate authorization.

**Release dependency: migration 0410 must be applied before migration 0501.**
- **0410** adds the six `formula_versions` rows that the Stage 2 registry changes require (the table above).
- **0501** is the analytics migration that belongs to PR #29.
- **Order:** Supabase migrations must be applied in numerical order, so 0410 comes first. 0501 does not read or change `formula_versions`; the dependency is the apply order alone.
- **Provisioning:** the workflow is pinned to the existing 19-file package ending at 0409 (`c69ec51`), so it cannot apply 0410 today. Re-pinning it requires separate owner authorization.
- **Applying either migration** requires separate owner authorization.
- **Status:** neither 0410 nor 0501 has been applied. Production's migration list ends at 0409 (read-only check, 2026-11-19).

**Whole-engine diff.**
- Method: all 749 calculators, opened at their defaults in Imperial and in Metric, before and after.
- The only pages that changed:
  - the eight repaired non-simulator calculators;
  - the four simulators that use air density (Top Speed, Dragstrip, Acceleration, Cornering);
  - `sim_braking` and `sim_weight_transfer`, where only the shared Air Density label changed;
  - after the cam centerline convention (`572e8c6`), three cam pages: `cam_card`, `camshaft_ivc` and `camshaft_exhaust_events` (the last is also one of the eight repaired calculators).
- In the final audit (2026-11-19, `main` `b58e1f0` against branch `be6ff52`), exactly these 16 distinct calculators changed, with no page errors.
- The registry's formula versions changed for exactly the six calculators above.

**Final audited results (2026-11-19, fresh clone of `be6ff52`, run locally).**
- **Fast gate, the nine CI steps:** 9/9 pass.
- **Engine self-test:** 735/736; the one failure is GH-DEF-052.
- **Known-answer suite, strict mode:** 68 cases, 48 pass. The 20 failures are exactly the known-open ledger (GH-DEF-049, 051, 052, 056, 058, 059).
- **Full browser regression:** 51/51. On the first pass `structural-14` hit click timeouts while other checks ran in parallel; run on its own it passed (1,075 checks, 0 failures).
- **Migration 0410 throwaway-database proof:** 50/50.
- **Independent reference checks:** the repaired formulas, the cam convention in Imperial and Metric, and the Apply button and stale-box fixes all agree with references written outside the test suite.
- **GitHub Actions:** never run on this branch (0 check runs). No pull request exists.

## Limitations and open points (not changed here)

1. **Cam pages disagree (055): resolved 2026-11-18** by the cam centerline convention (see GH-DEF-055 above). Every cam page now uses installed = recommended − advance, with the advance visible.
2. **Metric density label (054).** In Metric the simulator density box now reads slug/ft³ instead of kg/m³, as Dynamic Pressure does. A value remembered in a browser from before the change keeps its number, so a typed lb/ft³ figure (for example 0.0765) would now be read as slug/ft³.
3. **Gauge or absolute pressure (048).** The cranking pressure is P_atm × CR^γ, an absolute pressure (295 psi). A compression gauge reads gauge pressure, which is about 14.7 psi lower. The formula and its test are unchanged; this is a separate question.
4. **Rounding feeds the lap count (057).** Max Green Laps is computed from fuel already rounded to 2 decimals. For example, 7 laps × 0.333 gal gives 6 laps. This is a separate rounding issue and is not fixed here.
5. **Release order.** Production must have the 0410 rows before a corrected calculation is stored. This is the same order used for 0409: migration first, then code. Saving a calculation through the client is not possible today (frontend test 22), so the site works without 0410.
6. **The Stage 1 proof harness is now a historical artifact.** `premium/tests/proof/red-green.js` patches the old engine text, so it cannot run on the repaired engine. Its recorded output (`out/red-green.json`) is that historical evidence and is unchanged. Commit `2913c14` made three edits to `red-green.js`: it marked the header as historical, added the `RG_ENGINE_SOURCE` override, which lets the harness test point it at a supplied engine, and rewrote the comment above the expected self-test list; its probes, expected lists and logic are unchanged. `red-green-harness.test.js` now checks the recorded output and runs both proof phases.
