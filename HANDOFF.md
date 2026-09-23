# GEARHEAD LABS — HANDOFF (F1.12.0 · D-009 release candidate)

**Current file:** `F1_12_0_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html` · engine `gh-engine@1.1.0`

**Tags:**
- `F1.12.0-D009-CATEGORICAL`: current
- rollback: `F1.11.1-M1.2`, `F1.11.0-M1.1-CORE-ENGINE`, `F1.10.6-FINAL`

**Release gate:** `npm install && ./verify-all.sh <file.html>`. All 4 gates and the Node tests must pass.

**Read:** `D009-RESULTS.md` (outcome, proofs, controls, defects, decisions), `ENGINE.md` (categorical inputs), `DECISIONS.md` (D-009, D-010).

## Status

- Migrated **250**, pending **9**.
- **M1.3 not started** (awaiting owner go-ahead).

## Owner decisions open

1. `speed_converter` live fix (the fps branch)
2. `temp_converter` representation
3. Carried: `bolt_pattern`, `pinion_angle_change`, `optimal_shift`, `ev_motor_power`, the MODE_DEPENDENT three, the 4 known formula-display defects
4. Go-ahead for M1.3 (`understeer_gradient`, D-004)

## Rules added in D-009

- **Selectors are declared, never coded.** Option values = live select values; constants copied from the live tables; the declared set equals the live set exactly.
- **A harness change that makes coverage drop silently is a defect.** Watch pass counts, not just "0 failed" (static EVAL/DIFFERENTIAL dropped by 10 until fixed).
- **Prove non-regression by snapshot, not by argument.** `tools/d009/snapshot.js` + `compare.js` byte-compare fingerprints, results and formula HTML.

---

# PREVIOUS HANDOFF — F1.11.1 (M1.2)

**Current file:** `F1_11_1_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html`
**Rollback / reference:** tags `F1.11.0-M1.1-CORE-ENGINE` and `F1.10.6-FINAL`. Both unchanged, and both pass their own gates.
**Release gate:** `npm install && ./verify-all.sh <file.html>`. That is 4 gates plus the Node engine tests; all must pass.

**Read next:**
- `M1.2-RESULTS.md`: the 37-row table, the evidence summary, and what's still blocked
- `ENGINE.md`
- `DECISIONS.md`: D-007 to D-009 are new
- `engine-pending.json`

## M1 status

| Step | Version | Status |
|---|---|---|
| M1.1 | F1.11.0 | Done: `v()` Unknown≠Zero; GH_ENGINE; 215 proven |
| M1.2 | F1.11.1 | **25 of 37 closed**; 12 blocked on owner decisions |

Engine migrated: **240**. Pending: **19**.

## Next steps

1. **Owner decisions:**
   - **D-009 categorical inputs** (closes 11)
   - `bearing_life` display
   - the 4 pre-existing formula-display defects
   - `bolt_pattern` / `pinion_angle_change` / `optimal_shift` / `ev_motor_power`
2. **M1.3 — `understeer_gradient` per D-004.** Add vehicle weight; Kus = Wf/Cf − Wr/Cr in deg/g. This deliberately changes a displayed value, so it goes in its own version.
3. **M1.4 — retire duplicated math.** Migrated renderers take their numbers from `GH_ENGINE.calculate()`, one family at a time, with every gate green after each.
4. **M2:** canonical fields and value model (Supabase/Postgres per D-001 to D-003).

## Rules added in M1.2

- **Check what visitors read, not only what they compute.** A registry change passed parity yet published a misleading formula; FORMULA_DISPLAY now gates this.
- **A registry must never return 0 for an input the product rejects.** Use `NaN`, which the engine reports as `OUT_OF_RANGE`.
- **Fix harness defects before judging data.** Every harness change must make it stricter. Re-run the whole migrated set after any harness change.
- **Every duplicate registry id appears once in the file text.** At runtime, `Object.assign(GH_LEGACY_FORMULAS, GH_BACKFILL_FORMULAS)` shares the same object between the two registries, so copies cannot drift; edit the backfill entry.

---

# PREVIOUS HANDOFF — F1.11.0 (M1.1)

**Current file:** `F1_11_0_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html`
**Frozen reference / rollback:** `F1.10.6-FINAL` (git tag). Unchanged, and still passes its own gate.
**Release gate:** `npm install && ./verify-all.sh <file.html>`. That is 4 gates: syntax, 15 static suites, 3 live suites, 5 engine suites, plus the Node engine tests. Every one must pass.

**Read next:**
- `ENGINE.md`: what the engine is, its API, the Unknown≠Zero contract, and the proof standard
- `DECISIONS.md`: the owner decisions D-001 to D-005
- `CHANGELOG-F1_11_0.md`: what changed
- `engine-pending.json`: the 44 calculators not yet migrated, each with a reason
- `CATEGORY-RECONCILIATION.md`

## M1 status

- **Step 1 — done (F1.11.0):**
  - `v()` Unknown≠Zero
  - `GH_ENGINE` 1.0.0 embedded and Node-usable
  - **215 calculators proven equal to the live page** (3,176 comparisons)
  - negative controls confirmed

**Next steps, in order (smallest safe first):**

1. **M1.2 — close the 37 fixable pending calculators.**
   - 24 DOMAIN_RULES_NEEDED: add each live renderer's guard to its registry expression, using the pattern already in the registry: `[..].every(n=>n>0) ? expr : NaN`.
   - 13 REGISTRY_INCOMPLETE: add the missing input to the registry entry.
   - Each is re-proven by LIVE_PARITY before it moves to `engine-migrated.json`.
   - Registry expressions change, but the displayed math does not; STATIC + LIVE gates must stay green.
2. **M1.3 — understeer_gradient per D-004.**
   - Add vehicle weight; compute Kus = Wf/Cf − Wr/Cr in deg/g.
   - Update the live renderer, registry, example text and exception entry together.
   - This is a deliberate change to a displayed value, so it goes in its own version.
3. **M1.4 — retire duplicated math.**
   - For migrated calculators, make the live renderer take its numbers from `GH_ENGINE.calculate()` instead of its own inline math.
   - Go one family at a time, with LIVE_PARITY + RENDER_STABLE + DEFAULT_EXAMPLE green after each.
4. **Owner decisions still open:**
   - `bolt_pattern` measurement convention (engineering defect, see changelog)
   - `pinion_angle_change` 0° display
   - `optimal_shift` registry stub
   - `ev_motor_power` kW vs HP
   - the 6 example-copy decisions from F1.10.6
5. **M2 — canonical fields and value model:** a Supabase/Postgres schema per D-001 to D-003.

## Rules added in M1

- **Parity is proven against the live page, never assumed from the registry.** 44 calculators passed the static DIFFERENTIAL check yet diverge from the live page away from their default inputs.
- **The engine never coerces.** `0` is known; `null`, `undefined`, `NaN`, `''` and strings are unknown. An unknown input gives `INCOMPLETE` with null outputs.
- **`gh-engine.js` is the only engine source.** Rebuild the page's `GH_ENGINE` block from it; the gate checks byte identity.
- **Do not put formulas in the engine.** Formula fixes go in the registry, then get re-proven.

---

# PREVIOUS HANDOFF — F1.10.6 (frozen baseline; still accurate for that version)

**Current file:** `F1_10_6_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html`
**Release gate:** `./verify-all.sh <file.html>` exits 0 only if ALL of these pass:
1. every inline `<script>` block parses (16 blocks)
2. `gh-verify.js`: 15 static suites
3. `gh-verify-live.js`: 3 live-page suites (needs `npm install`; jsdom pinned)

**Baseline:** `verification-baseline-F1_10_6.txt` (full gate output, PASS).
**Version history:** `gearhead-labs-repo.zip` is a git repo with tags `F1.10.5` and `F1.10.6-FINAL`.
**What changed and why:** `CHANGELOG-F1_10_6.md`.
**Next-phase plan:** `BUILD-READINESS-REPORT.md`.

Upload next session: this doc, the html, both harnesses, `default-example-exceptions.json`,
`verify-all.sh`, `package.json`, the baseline, the changelog, and `defaults-audit-findings.md`.

---

## CORRECTION TO THE ARCHITECTURE SECTION BELOW (read first)

The F1.10.5 handoff says GH_E1 ids are live through the generic renderer except for 5 known bespoke ones. **That is not accurate.**

- A late script block, `<script id="GH_CERTIFICATION_REMEDIATION">`, runs after all the other renderer definitions. It reassigns ~200 ids with `RENDERS.id = ...`, overriding both the generic renderer and earlier bespoke object methods.
- For those ids, the live code is the LAST assignment, not the first `id(){...}` text match that `gh-verify.js`'s `renderBody()` finds.
- Many late overrides carry their own defaults (`certValue('x',870)`), so a registry `defaults[]` edit may be inert. That is how `ev_usable_energy`, `ev_soc_energy` and `hydraulic_pump_flow` kept wrong defaults after last session's registry fix.

**The authoritative way to see what a visitor gets is the live harness:**
- `gh-verify-live.js` opens every calculator in the real page.
- To read the live source of one calculator: run `node gh-verify-live.js <file.html> --source id`. It prints the renderer that actually runs.

The static harness is still valuable, since it runs registry math, identities, homogeneity and envelopes. It is no longer the only gate.

## THE 3 LIVE SUITES

| Suite | Asserts |
|---|---|
| LIVE_RENDER | all 606 entries + 6 aliases open via the real `renderCalc()` without throwing, and render content |
| RENDER_STABLE | re-rendering from the inputs *as displayed* gives the identical result (displayed inputs ⇒ displayed result) |
| DEFAULT_EXAMPLE | the result on open reproduces a number stated in that entry's own `CONTENT.example` |

For DEFAULT_EXAMPLE, every non-reproducing entry must be in `default-example-exceptions.json` with a reason and a justification. An exception that starts reproducing FAILS as stale.

The matcher:
- ignores numbers that merely restate an input, unless a result phrase introduces them ("gives 114°")
- requires rounding agreement AND ≤2% difference, so 0.5 cannot pass as "1"
- ignores the "1" in "N:1"
- understands fractions ("3/8", "1 and 3/8", "5 / 10")

**Negative control:** on F1.10.5 the live gate reports 50 failures (4 crashes, 30 unstable, 16 default mismatches). On F1.10.6 it reports 0.

**Current DEFAULT_EXAMPLE picture (606):**
- 492 exact, 6 within 0.5% (long NIST constants shown to 8 digits)
- 108 documented exceptions:
  - 48 NO_STATED_RESULT (example never states its answer: a content gap)
  - 40 QUALITATIVE
  - 12 INTERACTIVE (simulators)
  - 6 NON_DEFAULT_SCENARIO
  - 1 MODE_DEPENDENT (`nitrous_jet`)
  - 1 OPEN_DECISION (`understeer_gradient`)

## OPEN ITEMS (owner decisions — nothing here blocks the freeze)

1. **`understeer_gradient` is not Kus in deg/g.** The live renderer computes (front% / Cf − rear% / Cr) × 1000. The sign and understeer/oversteer verdict are correct; the magnitude is a dimensionless index. True Kus needs axle weights in lb, i.e. a vehicle-weight input. Decide: add the input, or relabel as "Balance Index".
2. **6 NON_DEFAULT_SCENARIO pages.**
   - `bmep_from_torque`, `port_velocity`, `ring_gap_bore` and `injector_duty_cycle` render a shared canonical calculator and show its defaults.
   - `kelvin_to_*` default to 293.15 K while the example uses 1 K.

   All the math is correct. Recommended: update the example copy to the shared scenario.
3. **48 examples never state a result.** A content pass would move them from exceptions to verified.
4. **`v(id)` returns 0 for a missing/empty field** (Unknown ≠ Zero). It is latent today because every live renderer that matters uses `vd()`. Fix before the engine is extracted, so the calculation API can return "Incomplete" instead of 0.
5. Carried over, unchanged: ET constant split (Huntington 6.290 vs Hale 5.825); `pid_proportional` unit; `hardness_convert` / `helicoil_size` linear approximations; `driveshaft_critical` constant source; 10 sub-0.1% rounding shifts.

## RULES LEARNED THIS SESSION

- **A green static suite is not a working calculator.** Four calculators crashed on open while all 15 static suites passed. Always run the full gate.
- **An input field is not a result display.** Its text is read back on every keystroke, so it must round-trip exactly.
- **When fixing a default, fix it where it is live.** Check `node gh-verify-live.js <file> --source id`. Check both the `vd()` fallback and the `field()` display value; they drifted apart in 4 calculators.
- **Never reassign a canonical id to point at an alias.** Aliases point to canonical, one direction only.

---

# HISTORY — F1.10.5 HANDOFF (retained verbatim; see correction above)

# GEARHEAD LABS — VERIFICATION HANDOFF

**Current file:** `F1_10_5_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html`
**Harness:** `gh-verify.js` — run `node gh-verify.js <file.html>`; exits 0 when clean, 1 on any failure.
**Baseline:** all 14 suites pass, exit 0. `verification-baseline.txt` is the saved run.

Upload all four files when starting the next session (this doc, the harness, the baseline, and
`defaults-audit-findings.md`).

---

## WHAT THE PROJECT IS

A single self-contained HTML automotive math encyclopedia, ~4.15 MB, 581 distinct
calculators, 606 content entries, 577 registry formulas.

**Operating standard: "be the best at what we do, or not do it."** That standard is
the reason for the verification work — it rules out shipping calculators nobody has
checked, and it has already led to a decision to stop adding new ones until the
existing catalogue is verified.

---

## ARCHITECTURE (learn this before editing anything)

The file was built in layers, and that shapes everything.

**Two code paths per calculator.**
1. **Registry formulas** — `GH_E1_FORMULAS`, `GH_E101_FORMULAS`, `GH_LEGACY_FORMULAS`,
   `GH_BACKFILL_FORMULAS`. These drive the on-screen FORMULA box.
2. **Render functions** — the executable code that computes what the user sees.

**Which one is live depends on the registry:**
- **`GH_E1_FORMULAS` ids** → the registry IS the calculator, UNLESS a bespoke render
  function for that id already exists, in which case the bespoke one wins (see next
  point). A generic renderer (`certFormulaRenderer`) builds the UI and computes from
  the registry expression for everything else.
- **`GH_LEGACY_FORMULAS` / `GH_BACKFILL_FORMULAS` ids** → the bespoke render function
  is live; the registry is display-only.
- **5 known GH_E1_FORMULAS ids have a live bespoke renderer instead of the generic
  one**: `understeer_gradient`, `ohms_law`, `deck_height`, `brake_clamp_force`,
  `thread_engagement`. Their registry `defaults[]` arrays are inert — never shown to
  a user — because the bespoke renderer supplies its own defaults independently.
  Confirmed by actually running each renderer this session; don't "fix" those 5
  registry defaults expecting it to change what a visitor sees.

Get this wrong and you will "fix" a bug in code that never runs. It happened twice
last session, which is exactly why the generic-assignment line is now conditional
(`if(!RENDERS[id]) RENDERS[id]=certFormulaRenderer(id)`) instead of unconditional.
**Do not revert that line to the unconditional form** — the updated SHADOWED suite
will now fail loudly if that regression happens (see "WHAT WAS FIXED" below).

**Renderer declaration syntaxes** (all three exist — a detector that misses one
silently drops calculators from every suite):
- `name(){ ... }`
- `name: function(){ ... }`
- `RENDERS['id'] = ...`

**Consolidation:** `GH_CALC_ALIASES` maps six retired duplicate ids to canonical
calculators. Nav rows keep their original display names but point at the canonical
id, so one implementation serves multiple sections. `renderCalc` and the `?calc=`
deep-link handler both resolve aliases.

---

## THE HARNESS — 14 SUITES

| Suite | What it asserts |
|---|---|
| EVAL | every formula evaluates to a finite number (577 of 577 — every formula in the catalogue, up from 559; the 18 that used to be skipped are now covered, see Step 3) |
| DEGENERATE | render functions guard divide-by-zero on plausible input (8) |
| STUB | no registry expression has an always-constant conditional |
| SHADOWED | no bespoke renderer is dead code behind a generic assignment — rewritten this session to check for a *regression* to the unconditional assignment form, plus any duplicate `RENDERS[id]` assignment after the conditional pass |
| ALIASES | retired ids resolve to one implementation, not a hidden copy (17) |
| DIFFERENTIAL | registry and render agree at displayed precision (259 as of this session, up from 238 — see harness blind-spot fixes below) |
| IDENTICAL | structurally identical formulas agree numerically (21) |
| INVERSE | auto-discovered `X_to_Y`/`Y_to_X` pairs round-trip (38) |
| IDENTITY | 5252 crossover, VE=100%, ratio-of-equals, VE=1.0 ⇒ CID·RPM/3456 (8) |
| HOMOGENEITY | doubling a linear input doubles the output (9) |
| ENVELOPE | 34 hand-written per-calculator plausibility ranges (up from 19 — 15 added this session, see Step 2) |
| UNIT_ENVELOPE | unit-keyed ranges across the catalogue (352 outputs) — psi range now allows negative for labels matching `pumping` in addition to the existing margin/drop/loss/etc. keyword list, needed for `pumping_mep`'s legitimately-negative answer |
| ROUNDING | measures whether rounded intermediates move displayed digits |
| ORPHAN | every content entry has a working calculator |
| LABELS | every registry label matches what the live renderer actually calls that field — new this session, catches scrambled-display bugs that DIFFERENTIAL can't (the math can be right while the label is wrong) |

**Add an invariant whenever a factual claim in the copy can be expressed as one.**
The FAQ claims torque and HP cross at 5252 — that is now a test.

**A new invariant worth adding**, surfaced by this session's defaults review: for any
calculator whose `defaults[]` drives the generic renderer, its default-input output
should reproduce the number stated in that calculator's own `CONTENT.example` text.
This session found 47 violations of exactly that (see `defaults-audit-findings.md`)
purely by manual cross-check — the harness doesn't verify it automatically yet.

---

## NEXT STEPS, IN ORDER

### 1. Review the 273 generated defaults — DONE
Of the 273 E1/E101 entries with a `defaults[]` array, 266 are actually live (generic
renderer) and 7 are inert (bespoke renderer owns its own defaults — see above; started
at 5, found 2 more mid-session once sandbox fixes revealed their renderers were
misclassified).

**All default-value bugs across the whole catalogue are now fixed — 162 total**
(45 in the first pass, 117 in a full catalogue-wide sweep later the same session),
all verified by reproducing each calculator's own documented example through the
actual formula before applying. Full old→new list in `defaults-audit-findings.md`
Findings 1 and 8.

Two items that looked like defaults bugs turned out to be something else, both fixed:
- **`sensor_scaling`** — the formula itself (`r*s/o`) couldn't reproduce its own
  example under any inputs. Fixed to `r*o/s` (the standard sensor-scaling relationship).
- **`diesel_injector_flow`** — a real formula bug (bad unit conversion, off by ~25x),
  not a defaults problem. Rebuilt from the calculator's own worked example. See
  Finding 8 for the full account.

Also found while sweeping bespoke renderers directly against their own examples (a
broader check than the registry-defaults sweep): `port_velocity`, `hp_from_specs`,
and `brake_clamp_force` had drifted defaults; `static_compression`'s example prose
cited bore/stroke figures that didn't match its own displayed (correct) result. All
fixed — see Finding 8.

### 2. Validation pass on chained-physics calculators — named high-risk families DONE
Validated with citations (`defaults-audit-findings.md` Findings 4, 7 & 9):
- The 5 originally-named ones: `bmep`/`diesel_bmep`/`bmep_from_torque`,
  `dynamic_compression`, `injector_size`/`injector_sizing`, `fuel_system_hp`,
  `mach_index`.
- The ~35-calculator cam/port/valvetrain family: curtain area, port/valve/throat
  area ratios, coil/valve spring rate, cam timing arithmetic, port velocity/CSA,
  rocker ratio, valve lash, dual/series spring rates, `hp_from_airflow`'s 0.257
  constant.
- Drag-racing performance math (`hp_trap_speed`, `hp_quarter_mile`,
  `et_mph_prediction`, `ev_quarter_mile`, the ET-change family): confirmed the
  site's mixed 6.290/5.825 ET constants are two genuinely different published
  formulas (Huntington vs. Hale), not a bug — same conclusion the site's own
  "ET constant unreconciled" note already suspected, now confirmed externally.
- `bearing_life`: confirmed exact match to the ISO 281 / Lundberg-Palmgren L10
  standard.
- `nitro_blend`: confirmed nitromethane's ~1.7:1 stoichiometric AFR against
  independent racing-fuel sources.

All formulas confirmed correct. diesel BMEP guidance text is a bit conservative
vs. current sources (250-300psi stated, modern sources say 260-360psi is normal)
— not changed, your call whether to update the copy.

15 ENVELOPE entries added across the cam/port/valvetrain and named-5 passes.

**Not independently verified** (flagged, lower priority — niche/isolated, not a
concentrated family): `velocity_stack`'s 88200/RPM constant (sits within the
range of several competing published conventions — a "several defensible
answers" situation, not a bug), `crank_journal_overlap` (confirmed via a
Speed-Talk forum citation, see Finding 8), `driveshaft_critical`'s exact
constant (formula shape is right, self-consistent, just didn't track the
specific published source).

**What's left of the original "60-80" estimate**: every family the handoff
explicitly named as high-risk is now done. What remains is a long tail of
smaller, more isolated calculators rather than another concentrated family —
worth continuing opportunistically (whenever one comes up) rather than as one
more dedicated pass.

Every green suite proves the catalogue is **internally consistent**. None of it
proves the catalogue is **right**. The VE ranges were self-consistent across four
entries and wrong in all four; only an external source caught it. Same for carb
sizing, squish velocity and the understeer gradient.

For any calculator you want to add next: find a citable source, confirm both the
formula and any guidance ranges in the copy, record the citation, then add a
tight per-calculator ENVELOPE entry so it can never silently drift.

### 3. Close the harness blind spots — DONE, 577/577 formulas now verifiable
**All 18 originally not-machine-verifiable formulas are resolved. Zero skipped.**
Full account in `defaults-audit-findings.md` Finding 10. Breakdown:
- **11 were false positives in the harness's own checker**, not real product
  limitations — `unverifiable()` was misreading `Math.exp`, the `null` keyword,
  arrow-function parameters (`x=>...`), object-property access (`.dia`), and
  Array methods (`.filter`) as unresolved external variables. Rewrote the
  checker to strip string literals, property access, arrow params, and object
  keys before scanning, and expanded the builtin allowlist. Confirmed each of
  the 11 already evaluated correctly before touching anything — this was pure
  harness-quality work, no calculator logic changed.
- **4 multi-statement expressions inlined** (`grains_water`, `jetting`,
  `dynamic_compression`, `bolt_torque_spec`) — mechanical algebraic
  substitution, each verified against the original step-by-step calculation
  across 5 test cases before applying. `bolt_torque_spec` now takes K and
  proof-strength directly (the continuous values its Grade/Condition dropdowns
  already resolve to) instead of hiding them in comments.
- **3 UI-state dependencies made explicit inputs**, same pattern:
  `depreciation_schedule` (year index), `drivetrain_loss` (loss fraction),
  `rc_lap_delta` (sensitivity). Each verified against its own documented
  example exactly.

None of this touched any live bespoke renderer — every fix is either a harness
checker correction or a registry FORMULA-box edit (display-only for
LEGACY/BACKFILL ids). EVAL 559→577, DIFFERENTIAL 238→259.

Separately, found and fixed **30 bespoke renderers silently failing to execute in the
harness's sandbox** across two passes (missing stubs for `metricUnit`, `fhelp`,
`getActiveProfile`, `sound`, `density`, `vol`, `CALC_PERSISTENT_STATE`, `RENDERS`),
which meant DIFFERENTIAL, ENVELOPE, and ROUNDING were treating all 30 as "not
judged" instead of actually checking them. Fixed. Full details in
`defaults-audit-findings.md` Findings 5 & 7.

**Two renderers still not fully sandboxable**: `valve_lift_rocker` (needs a
stateful profile-sync helper, `ast()`, that reads/writes saved vehicle profiles —
more than a stub can faithfully cover) and `rocker_valve_lift` (delegates to
`RENDERS.valve_lift_rocker()`, so it inherits the same gap). Low priority — the
underlying math (`lift = lobe_lift × rocker_ratio`) is trivial and already
exercised via the identical registry-side formula in other suites.

Also found and fixed a genuinely dormant bug while investigating the above: the
shared `density(t)` helper used the wrong temperature-scaling exponent (a stray
square root — correct for speed of sound, not density). Inert in the live product
(both call sites use the one temperature where it doesn't matter), but would have
misvalued air density by 5-15% the moment anyone called it elsewhere. Fixed.

Still worth doing: add the "default output matches documented example" invariant as
an actual harness suite (see above) so the class of bug found in Step 1 gates
the build automatically instead of needing another manual pass.

### 4. Tiering — resolved this session
Ran an independent-recomputation pass across all 529 "internally consistent but
not externally cited" calculators (see `defaults-audit-findings.md` Finding 11)
to answer the question directly: does undisputed textbook physics (Ohm's law,
F=ma, unit conversions) need a citation, or does "no errors found" count as
verified? Answer: the law doesn't need a citation, but "no errors found" isn't
verification on its own — several of this session's real bugs (`density(t)`,
`diesel_injector_flow`, `sensor_scaling`, `dynamic_pressure`) were in exactly
that "too basic to check" category. The pass did real independent recomputation
instead, and found 2 more bugs (both display-layer, not math — see below).

**Result: 577 of 606 calculators (95%) are now verified** — the 48 with an
external citation (Findings 4, 7, 9) plus the 529 that passed independent
recomputation (Finding 11). The remaining 29 are the no-formula
simulators/converters, out of scope for this kind of check. Recommend treating
"Verified" as one tier covering all 577, rather than splitting cited vs.
recomputed — both are positive verification, just against a different kind of
source (external literature vs. the relationship's own definition).

Once you decide on presentation (badge vs. hold-back, per the earlier
discussion), the actual gating logic is straightforward: everything with a
formula is verified, the 29 without one are not, yet.

### Smaller items
- **ET constant unreconciled:** `et_mph_prediction` uses 6.290 (Huntington),
  `ev_quarter_mile` uses 5.825 (Hale). Both confirmed as genuine, independently-
  published historical formulas (Finding 9) — not a bug, a style choice. Still
  your call whether to standardize on one or label each by name.
- **29 no-formula calculators — now fully reviewed (Finding 12), not just
  structurally out of scope.** Read every one's actual code directly since
  there's no registry formula to check against. Found and fixed 3 more real
  bugs this way: `lsa_calc`'s stale default (114→118, now matches its own
  example), `ac_pressure`'s R-134a table (was showing roughly half the
  correct pressures — rebuilt from CoolProp/ASHRAE-verified values), and
  `universal_automotive_converter`'s cubic-inches factor (was off by exactly
  1000x). Everything else in this bucket — `density_altitude`'s full NWS
  atmospheric model, the `sim_*` family, the connected Cam Card system,
  `resistor_color`/`sheet_gauge`/`drill_decimal` — checked out correct.
  **All 606 content entries have now been through some form of verification.**
- **10 outputs shift <0.1%** from rounded intermediates (worst: `ct_sway_bar`,
  0.0297%). Cosmetic, but the Methodology page promises rounding happens only at
  display, so each is a place that claim isn't literally true.
- **`pid_proportional`** content text calls its output "a 14.4% duty cycle" but the
  registry's declared unit is plain "units", not "%" — copy/unit mismatch, low
  priority, noticed while fixing its default this session.
- **`hardness_convert` and `helicoil_size`** use linear approximations for
  relationships (hardness scale conversion, thread-insert drill sizing) that are
  actually non-linear lookup tables in real reference charts. Not confirmed
  wrong, just a known simplification worth a citation check if you want these
  in the "cited" sub-tier specifically.

---

## WHAT WAS FIXED (so it isn't re-litigated)

**This session (part 7 — public-facing verification disclaimer):**
- Added a "Verification" section to the live Methodology page (`/methodology/`)
  stating the accurate three-tier picture: 48 externally cited, 529 verified by
  independent recomputation, 29 with no formula to check. Explicitly says
  recomputation isn't a zero-error guarantee (and says why — this session found
  real bugs in "too simple to check" categories) and names the specific open
  items (two approximation-based calculators, two unsourced constants, the
  ET-constant split) rather than omitting them. No suite is affected by this —
  it's copy only — reran the harness to confirm (still 15/15, exit 0).

**This session (part 6 — Step 4 / tiering, independent-verification pass):**
- Ran independent recomputation across all 529 "Consistent" calculators (86
  converters, 266 arithmetic, 94 named-formula, 83 complex). Converters and
  arithmetic came back 100% clean. Found 2 real bugs, both display-layer, not
  math: `ct_track_bar_adj`'s registry FORMULA box was completely scrambled
  (wrong labels, missing a variable, dimensionally nonsensical as written) —
  the live calculator itself was always correct, only the box showing the
  formula to users was wrong; `trade_in_payoff` had two labels swapped. Both
  fixed. Finding 11.
- Added a new permanent **LABELS** suite (#15) that checks every registry
  label against what the live renderer actually calls that field — this is
  the check that caught both bugs above, and DIFFERENTIAL alone never would
  have (the math was right in both cases, only the label was wrong).
- Resolved the tiering question: 577 of 606 calculators (95%) now count as
  verified — 48 by external citation, 529 by independent recomputation.

**This session (part 5 — Step 3 completion):**
- Closed all 18 remaining harness blind spots — 577/577 formulas now
  machine-verifiable, 0 skipped. Finding 10. 11 were false positives in the
  harness's own identifier checker (fixed the checker: `Math.exp`, the `null`
  keyword, arrow-function params, object-property access, and Array methods
  were all being misread as unresolved external variables); 4 multi-statement
  registry expressions were inlined into single expressions (`grains_water`,
  `jetting`, `dynamic_compression`, `bolt_torque_spec`); 3 genuine UI-state
  dependencies were made explicit registry inputs (`depreciation_schedule`,
  `drivetrain_loss`, `rc_lap_delta`). No live bespoke renderer was touched —
  every fix is a harness-checker correction or a display-only registry edit.

**This session (part 4 — Step 1 completion):**
- 117 more default-value bugs fixed catalogue-wide (162 total with the original 45).
  Finding 8.
- Fixed the `sensor_scaling` formula bug (was left as an open decision — fixed it).
- Found and fixed a real formula bug in `diesel_injector_flow` (~25x off, bad unit
  conversion), plus 2 more misclassified bespoke-live ids (`port_velocity`,
  `bolt_stretch` — the sandbox-fix side effect from part 2, see below), plus
  drifted defaults in `hp_from_specs` and `brake_clamp_force`, plus a documentation
  fix to `static_compression`. Finding 8 has the full account.
- Confirmed `crank_journal_overlap`'s formula against an external source; confirmed
  `velocity_stack`'s constant is a defensible convention among several that exist
  in that space (like the ET-constant situation).

**This session (part 3 — Step 2 continued):**
- Validated the ~35-calculator cam/port/valvetrain family against external
  sources; added 9 more ENVELOPE entries. Finding 7.
- Found and fixed one more sandbox gap (`vol()`) — DIFFERENTIAL coverage 254→255.

**This session (part 2 — Step 2 start):**
- Validated the 5 named highest-risk chained-physics calculators against external
  sources; added 6 ENVELOPE entries; details and citations in
  `defaults-audit-findings.md` Finding 4.
- Found and fixed 28 bespoke renderers silently failing in the harness sandbox
  (missing global stubs) — DIFFERENTIAL coverage 238→254. Finding 5.
- Found and fixed a dormant (currently inert) physics bug in the shared
  `density(t)` helper — wrong temperature-scaling exponent. Finding 6.
- Widened UNIT_ENVELOPE's psi bucket for structural/bolt stress outputs, which
  share the "psi" unit with gas pressure but run to much higher plausible values.

**This session (part 1 — Step 1):**
- 45 of 47 confirmed default-value bugs corrected — see `defaults-audit-findings.md`
  for the full before/after list and the verification method (each new default was
  checked to reproduce that calculator's own documented example through the actual
  registry expression before being applied).
- `suiteShadowed()` rewritten: it had gone silently vacuous after the shadowing fix
  below (it string-matched the old unconditional assignment line, which no longer
  exists, so it auto-passed without checking anything). It now detects a regression
  back to the unconditional form, and any duplicate `RENDERS[id]` assignment after
  the conditional pass.
- `UNIT_ENVELOPE`'s psi range now allows negative values for labels matching
  `pumping`, needed for `pumping_mep`'s correct (negative) answer.

**Prior session — content corrections, all source-checked:**
- VE ranges were wrong catalogue-wide. Corrected to stock street 75–85%, modified NA
  85–95%, NA race 95–105%, and noted that VE peaks at peak-*torque* RPM.
- Carb sizing steered users toward undersizing. 4V carbs are rated at 1.5 inHg and
  2V at 3.0 inHg, so the calculated figure is engine *demand*, a floor to select
  above. Added an FAQ on why 2-barrel ratings aren't directly comparable (~1.414).
- `hp_from_specs` divided CFM by AFR with no air-density term — ~4,960 HP for a mild
  350. Now ~379 HP.

**Prior session — structural:**
- 23,747-byte dead `CALCS` array removed (it was discarded by a runtime splice).
- Six duplicate ids consolidated behind `GH_CALC_ALIASES`, with cross-listing.
- Generic E1 renderer assignment made conditional — it had been overwriting eight
  bespoke renderers, which cost `understeer_gradient` its correct two-axle Gillespie
  formula and `ohms_law` its solve-for-V/I/R mode selector.
- `understeer_gradient` registry corrected to Kus = Wf/Cf − Wr/Cr.
- `diesel_bsfc` formula box had a spurious ×60 (fuel flow is lb/hr, not lb/min).
- Six unguarded divide-by-zeros now return a dash instead of `NaN`.

---

## HOW TO WORK ON THIS

**Verify which code path is live before calling anything a bug.** Check whether the
id is in `GH_E1_FORMULAS` (registry live, unless it's one of the 5 bespoke-live
exceptions listed above) or LEGACY/BACKFILL (render live).

**Run the harness after every change.** It is fast and it gates the build.

**Check syntax across all 16 script blocks after editing** — extract each `<script>`
body and `node --check` it.

**Distrust your own false positives — including the harness's.** A green suite can
mean "actually fine" or "the check has gone stale," as SHADOWED did this session
after the conditional-assignment fix changed the exact string it was matching. When
you change code that a suite's logic depends on textually (not just semantically),
re-check that suite's implementation, not just its pass/fail output. Beyond that,
the usual false-positive traps: a seeder set `sweep_deg` to 268 because "deg" matched
a temperature rule; 42 unit-envelope failures were mostly legitimate values (a
centrifugal supercharger really does exceed 20,000 RPM; "Remaining Payload: −5,134
lb" is the correct answer for an overloaded truck). Fix the test before reporting
the product either way.

**Dead code vs untested code are different.** Dead code never executes and is safe to
delete. Untested code runs fine and merely lacks a second implementation to compare
against — 277 single-path calculators fall in that group. Deleting those would gut
the product.

**Assume any AI-generated content in this file may carry errors.** Several were
introduced by copying a neighbouring entry's example and its wrong claim along with
it. Where a citation exists, trust the citation over any summary of it. This
session's defaults bug is the same lesson from a different angle: the *example
prose* was right and vetted, the *default input values* silently weren't — when
they disagree, don't assume the code is the trustworthy one.
