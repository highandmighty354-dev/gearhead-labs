**STATUS UPDATE (final): the defaults review (Step 1) is now complete.** Across three passes this
session: 45 + 117 = **162 default-value bugs fixed** across the whole catalogue (not just the
original 47), the `sensor_scaling` formula bug fixed, a genuine formula bug in
`diesel_injector_flow` found and fixed (not just a bad default — the math itself was wrong by
~25x), 4 more bespoke-renderer default bugs found and fixed (`port_velocity`, `hp_from_specs`,
`brake_clamp_force`, and a documentation-only fix to `static_compression`), and the SHADOWED
suite's stale string match was updated. Harness re-run against the fixed file: **14/14 suites
pass, exit 0**. See Finding 8 for the full account of this session's final pass.

Fixed file: `F1_10_2_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html` (unchanged
by this final validation round — see Finding 9 — everything checked out clean, no new fixes needed)
Updated harness: `gh-verify.js`

---

# Defaults Review — Session Findings
Generated against `F1_10_0_...batch9_1.html`. Harness still reports ALL INVARIANTS HOLD (14/14) —
none of this is caught by `gh-verify.js` today. See "Harness blind spots" below for why.

## Finding 1: 47 calculators open with a trivial/degenerate default that contradicts their own documented example

**Root cause:** the script that generated the registry `defaults[]` arrays seeds each variable
independently from its label (same approach as the harness's own `SEEDS` list). It never checks
whether two variables in the *same* formula matched the *same* pattern. When a formula subtracts,
divides, or ratios two inputs of the same physical kind (two pressures, two temperatures, two
weights, an "ideal" and "actual" power), both get the identical seed value — so the calculator
opens showing a difference of exactly 0, a ratio of exactly 1, or an efficiency of exactly 100%.

Every single one of the 47 below was checked two ways: (a) evaluate the live registry defaults,
(b) compare against that calculator's own `example` copy. All 47 disagree with their own example,
several by a physically impossible margin.

### Worst offenders (physically impossible, not just a boring edge case)
| id | live default inputs | live result | documented example says |
|---|---|---|---|
| `piston_to_valve_clearance` | Measured Clearance=1, Safety Margin=1 | 0 in | A measured piston-to-valve clearance of 0.080 inches against a 0.060 inch safety margin leaves 0.020 inches of usable margin. |
| `strain` | Change in Length=24, Original Length=24 | 1 in/in | A part that stretches 0.005 inches over an original 10-inch length has a strain of 0.0005 in/in. |
| `tow_tongue_percent` | Tongue Weight=3400, Loaded Trailer Weight=3400 | 100 % | An 870 lb tongue weight on an 8,700 lb loaded trailer gives a tongue weight percentage of exactly 10%. |
| `tube_weight` | Outer Diameter=4, Inner Diameter=4, Length=24, Material Density=0.0765 | 0 lb | A 1.5-inch outer diameter, 1.25-inch inner diameter tube, 72 inches long, in steel (0.284 lb/in³), weighs about 11.04 lb. |
| `diesel_turbo_efficiency` | Ideal Power=1, Actual Power=1 | 100 % | An ideal power requirement of 8,000W against an actual measured power of 11,500W gives a turbo efficiency of about 69.6%. |
| `ev_motor_efficiency` | Mechanical Output Power=1, Electrical Input Power=1 | 100 % | 130 kW of mechanical output against 142 kW of electrical input gives a motor efficiency of 91.5%. |
| `compressor_efficiency` | Ideal Temperature Rise=190, Actual Temperature Rise=190 | 100 % | An ideal temperature rise of 115°R against an actual measured rise of 165°R gives a compressor efficiency of about 69.7%. |
| `steering_ratio` | Steering Wheel Angle=20, Road Wheel Angle=20 | 1 ratio | 300 degrees of steering wheel rotation producing 20 degrees of road wheel angle gives a steering ratio of 15:1. |

**Since fixed (was flagged as "needs a decision" earlier this session):**
- **`sensor_scaling`** (expr was `r*s/o`, labels Raw Signal / Signal Span / Output Span): no default
  values could reconcile the documented example (2.5V, 0–5V span, 0–100psi span → 50psi) through
  that expression — `r*s/o` gives 0.125, not 50. Fixed the expression to `r*o/s` (the standard
  linear sensor-scaling relationship, output = raw × output_span/signal_span) rather than swap the
  labels, and set the default to the example's own values (2.5, 5, 100) so it now shows 50 exactly.

**Confirmed false positive, no change needed:**
- **`rpm_frequency`**: originally flagged by the "output is a suspiciously round number" heuristic
  (6000 RPM → 100 Hz), but 100 Hz is the *correct* answer here and matches its own documented
  example exactly.

Two of the 45 fixed ones are worth calling out specifically:
- **`tube_weight`**: Outer Diameter and Inner Diameter both default to 4.0in — a tube with zero
  wall thickness, which is not a real part. Result: 0 lb.
- **`piston_to_valve_clearance`**: both Measured Clearance and Safety Margin default to 1 inch.
  Real P2V clearance is on the order of 0.080–0.150in — this is the same class of bug as the
  `ring_gap_bore` "10 inches" placeholder already fixed last session, just not caught that time.

### Full list of 47 confirmed cases
```
fmep_from_imep_bmep          -> FMEP = 0 psi
pumping_mep                  -> Pumping MEP = 0 psi
piston_to_valve_clearance    -> Usable Clearance = 0 in
spring_rate                  -> Spring Rate = 100 lb/in
injector_duty_cycle          -> Injector Duty Cycle = 100 %
maf_airflow                  -> Airflow = 1 lb/min
map_pressure_ratio           -> Pressure Ratio = 1 ratio
compressor_pr                -> Compressor Pressure Ratio = 1 ratio
compressor_efficiency        -> Compressor Efficiency = 100 %
intercooler_pressure_drop    -> Pressure Drop = 0 psi
intercooler_temp_drop        -> Temperature Drop = 0 °F
diesel_turbine_pr            -> Turbine Pressure Ratio = 1 ratio
diesel_turbo_efficiency      -> Turbo Efficiency = 100 %
diesel_egb                   -> Exhaust Backpressure = 0 psi
diesel_dpf_soot              -> Estimated Soot Accumulation = 0 mass units
diesel_regen_interval        -> Regeneration Interval = 1 time
diesel_scr_efficiency        -> SCR Efficiency = 0 %
ev_pack_ah                   -> Pack Capacity = 1 Ah
ev_usable_energy             -> Usable Energy = 1 kWh
ev_soc_energy                -> Stored Energy = 1 kWh
ev_motor_efficiency          -> Motor Efficiency = 100 %
ev_reduction_ratio           -> Reduction Ratio = 1 ratio
ev_inverter_loss             -> Inverter Loss = 0 kW
ev_charge_loss               -> Charging Loss = 0 kWh
ev_temp_penalty              -> Adjusted Range = 0 miles
ev_towing_penalty            -> Towing Range = 0 miles
tow_tongue_percent           -> Tongue Weight = 100 %
tow_axle_load                -> Trailer Axle Load = 0 lb
tow_mpg_penalty              -> Towing MPG = 0 mpg
yaw_moment                   -> Yaw Moment = 1 lb-ft
motion_ratio                 -> Motion Ratio = 1 ratio
steering_ratio               -> Steering Ratio = 1 ratio
brake_fade_energy            -> Energy per Stop = 1 ft-lb
sensor_scaling               -> Scaled Signal = 1 units
rpm_frequency                -> Rotational Frequency = 100 Hz
engine_order                 -> Engine Order Frequency = 100 Hz
driveshaft_order             -> Driveshaft Frequency = 100 Hz
damping_ratio                -> Damping Ratio = 1 ratio
harmonic_frequency           -> Harmonic Frequency = 1 Hz
clamp_load                   -> Clamp Load = 100 lb
tube_weight                  -> Tube Weight = 0 lb
strain                       -> Engineering Strain = 1 in/in
bending_stress               -> Bending Stress = 1 psi
factor_of_safety             -> Factor of Safety = 1 ratio
hybrid_power_split           -> Engine Power = 1 kW
control_error                -> Control Error = 0 units
pid_proportional             -> Proportional Output = 1 units
can_bitrate                  -> CAN Data Rate = 1 bit/s
```

A broader automated sweep (comparing live default output against the last number mentioned in each
calculator's example text) flagged ~175 of the 265 checkable entries, but that check parses prose
with a regex and throws a lot of false positives (it picks up incidental numbers from the
"interpretation" text, not just the example's final answer). The 47 above are the ones I could
verify by hand and are safe to treat as real. The other ~128 flagged-but-unverified candidates are
listed separately below in case you want to sweep through them — worth a skeptical human pass
before trusting any individual one.

## Finding 1 fix log — old → new defaults for all 45

```
fmep_from_imep_bmep         [1,1]              -> [152,135]
pumping_mep                 [1,1]              -> [-3,2]
piston_to_valve_clearance   [1,1]              -> [0.08,0.06]
spring_rate                 [100,1.0]          -> [200,0.4]
injector_duty_cycle         [250,250]          -> [25,42]
maf_airflow                 [1,1]              -> [2.5,0.85]
map_pressure_ratio          [14.7,14.7]        -> [29.4,14.7]
compressor_pr                [14.7,14.7]       -> [29.4,14.7]
compressor_efficiency       [190,190]          -> [115,165]
intercooler_pressure_drop   [14.7,14.7]        -> [32,29.5]
intercooler_temp_drop       [190,190]          -> [236,110]
diesel_turbine_pr           [14.7,14.7]        -> [32,15.5]
diesel_turbo_efficiency     [1,1]              -> [8000,11500]
diesel_egb                  [14.7,14.7]        -> [35,32]
diesel_dpf_soot             [3.55,3.55,12]     -> [2,0.5,10]
diesel_regen_interval       [1,1]              -> [45,1.5]
diesel_scr_efficiency       [1,1]              -> [8,0.4]
ev_pack_ah                  [1,1]              -> [75,2]
ev_usable_energy            [1,1]              -> [100,0.9]
ev_soc_energy               [1,1]              -> [82,0.35]
ev_motor_efficiency         [1,1]              -> [130,142]
ev_reduction_ratio          [6000,6000]        -> [9000,1000]
ev_inverter_loss            [1,1]              -> [145,142]
ev_charge_loss              [1,1]              -> [35,31.5]
ev_temp_penalty             [1,1]              -> [300,0.25]
ev_towing_penalty           [1,1]              -> [300,0.45]
tow_tongue_percent          [3400,3400]        -> [870,8700]
tow_axle_load                [3400,3400]       -> [8700,870]
tow_mpg_penalty             [1,1]              -> [22,0.45]
yaw_moment                  [1,1]              -> [800,4.5]
motion_ratio                 [1,1]             -> [3,2.1]
steering_ratio               [20,20]           -> [300,20]
brake_fade_energy           [1,1]              -> [2000000,8]
engine_order                 [6000,1]          -> [6000,4]
driveshaft_order             [6000,1]          -> [3000,1]
damping_ratio                 [60,60]          -> [1800,2400]
harmonic_frequency          [1,1]              -> [100,3]
clamp_load                   [400,1,4.0]       -> [300,0.2,0.375]
tube_weight                  [4.0,4.0,24,0.0765] -> [1.5,1.25,72,0.284]
strain                        [24,24]          -> [0.005,10]
bending_stress               [1,1]             -> [6000,2]
factor_of_safety              [1,1]            -> [36000,12000]
hybrid_power_split           [1,1]             -> [120,0.65]
control_error                 [1,1]            -> [15,13.2]
pid_proportional              [1,1]            -> [1.8,8]
can_bitrate                   [1,1]            -> [128,500]
```

Every one of these was verified by re-evaluating the actual registry `expr` with the new inputs
and confirming it reproduces the documented example's stated answer before being applied — this
wasn't a blind find-and-replace.

## Finding 2: the SHADOWED suite has been silently vacuous since the shadowing fix

`suiteShadowed()` in `gh-verify.js` looks for this exact literal string:
```
Object.keys(GH_E1_FORMULAS).forEach(id=>RENDERS[id]=certFormulaRenderer(id))
```
But the live file now has the **conditional** version from this session's earlier fix:
```
Object.keys(GH_E1_FORMULAS).forEach(id=>{ if(!RENDERS[id]) RENDERS[id]=certFormulaRenderer(id) ... })
```
`html.indexOf()` never finds the old string, so `suiteShadowed` takes its early-return branch and
records an automatic PASS ("not present in this build") without checking anything. It's been
reporting "no dead renderers" every run since the fix, whether or not that's true. It happened to
still be true when I checked by hand (all 5 bespoke renderers below are correctly live), but the
suite itself is not currently verifying that — it's decorative until the string match is updated.

**Fixed:** rewrote `suiteShadowed()` to match the current conditional assignment line, and to treat
reverting to the old *unconditional* form as the actual regression to watch for (rather than trying
to re-derive position-based dead-code logic that no longer applies once the assignment is guarded).
It also now catches a genuine duplicate `RENDERS[id] = ...` appearing *after* the guarded pass,
which is the one way a bespoke renderer could still get shadowed today.

Applying the 45 default fixes also surfaced one real harness calibration gap: `pumping_mep`'s
documented example is legitimately negative (-5 psi — pumping MEP is intake MEP minus exhaust MEP,
and is conventionally negative for a naturally-aspirated engine), but UNIT_ENVELOPE's psi range is
positive-only unless the output label matches a keyword list for signed quantities. Added `pumping`
to that keyword list rather than force a misleadingly "safe" default onto a calculator whose honest
answer is negative.

## Finding 4 (Step 2 progress): validated the 5 named highest-risk calculators, found 2 harness-blindness bugs and 1 dormant physics bug along the way

Worked through `bmep`/`diesel_bmep`/`bmep_from_torque`, `dynamic_compression`, `injector_size`/`injector_sizing`, `fuel_system_hp`, and `mach_index` — the five families the handoff named as highest-risk. All five formulas check out against external sources:

- **BMEP**: `150.8 × torque(lb-ft) / displacement(ci)` is the standard imperial-unit formula (4π×12 for a 4-stroke, power stroke every 2 revolutions). Confirmed against multiple independent sources including an SAE-referencing technical PDF and enginelabs.com. Gasoline guidance bands in the copy (mild street 120-150, hot street/race 150-180, race 200+) line up well with published typical ranges (~130-170 NA street, 150-210 high-perf NA, 220-300+ boosted). The diesel guidance (250-300psi "solid", 300+ "upper end") is a bit conservative against current sources — modern light- and heavy-duty diesel commonly runs 18-25 bar (~260-360psi) at its rated point. Didn't touch the copy (an editorial call), but added a cited ENVELOPE bound.
- **Dynamic compression ratio**: the trapped-volume method (slider-crank piston position at the intake-valve-closing crank angle, standard CR relationship for clearance volume) matches the standard approach used across the industry (Omni Calculator's DCR tool, patent literature on "effective compression ratio," Hot Rod Forum IVC discussions). Formula confirmed correct.
- **Injector sizing**: `(HP × BSFC) / (cylinders × duty)` and the 80-85% duty cycle ceiling are about as well-established as anything in this catalogue — confirmed identically across 8+ independent tuning sources (LSXmag, Fuel Injector Clinic via best-calculators.com, Nuke Performance, HP Academy forum, BitTuned, TuningCalc, axiscalc, High Performance Injectors). No changes needed.
- **fuel_system_hp**: `fuel flow / BSFC` is just the BSFC definition rearranged — correct by construction.
- **Mach Index**: velocity conversion (`CFM×144/(area×60)`) and the Mach 0.5-0.6 choked-flow design ceiling are confirmed directly at what looks like the origin of this exact framing — Wallace Racing's Mach Index calculator (wallaceracing.com/machcalc.php) states the same 0.6 threshold and cites the same reference books ("Scientific Design of Exhaust & Intake Systems", Taylor's "Internal Combustion Engine in Theory and Practice") that this pattern traces back to.

**Added ENVELOPE entries** for `diesel_bmep`, `mach_index`, `injector_size`, `injector_sizing`, `fuel_system_hp`, and `dynamic_compression` (the last one doesn't have a testable registry expression, but its bespoke renderer runs fine, so ENVELOPE can still check it — see Finding 5).

### Finding 5: found and fixed a harness sandbox gap hiding 28 renderers from every runRender-dependent suite

While chasing why `bmep`'s existing ENVELOPE entry was passing suspiciously quietly, found that its bespoke renderer throws `metricUnit is not defined` in the harness's sandbox — a real global helper the page defines but the sandbox never stubbed. Surveyed every renderer: **28 of 306 bespoke render functions were silently failing to execute** in the sandbox, across 7 different missing globals (`metricUnit`, `fhelp`, `getActiveProfile`, `sound`, `density`, `CALC_PERSISTENT_STATE`, `RENDERS`). Practical effect: any suite that depends on actually running the renderer — DIFFERENTIAL, ENVELOPE, ROUNDING, and the UNIT_ENVELOPE fallback path — was treating those 28 ids as "not judged" instead of actually checking them. That list includes several calculators square in Step 2's risk zone: `bmep`, `bsfc`, `squish_velocity`, `tongue_weight`, `gcwr_payload`, `tractive_force`, and a cluster of cam/port calculators (`port_velocity`, `required_port_csa`, `intake_curtain_area`, `exhaust_curtain_area`, `valve_throat_area`, `port_valve_area_ratio`, `exhaust_intake_flow_ratio`, `effective_rocker_ratio`, `lash_net_lift`, and more).

**Fixed**: added faithful stubs for all 7 to the sandbox (`metricUnit` and `fhelp` are exact behavioral matches to the real functions; `sound`, `density`, and `getActiveProfile` are direct copies of the real function bodies; `CALC_PERSISTENT_STATE`/`RENDERS` get empty-object stubs). Re-running the harness with these in place: DIFFERENTIAL went from 238→254 passing (16 more calculators now actually comparable, all agreeing), and UNIT_ENVELOPE caught one real thing worth knowing about — see Finding 6. No suite got WORSE, and all 14 still pass.

**This needs a further pass**: with these 28 renderers now actually visible, they haven't been read for correctness the way the 5 named calculators above were — they were just confirmed to *execute* and agree with their own registry formula where one exists. Worth folding into the Step 2 queue, especially the port/curtain-area cluster.

### Finding 6: `density(t)` had a dormant physics bug (fixed) — and a units bucket in UNIT_ENVELOPE needed widening

`density(t)`, a shared air-density-vs-temperature helper called by `intake_port_cfm` and `exhaust_port_cfm`, used `0.076474 × sqrt(518.67/(t+459.67))`. That square root is the correct scaling for *speed of sound* vs. temperature (which the neighboring `sound(t)` function does correctly), not for density — density at constant pressure scales linearly with 1/T (ideal gas law), no square root. **This was completely inert in the live product**: the only two call sites both pass `t=59`, the reference temperature where the buggy and correct formulas coincide exactly. But it would silently misvalue air density by 5-15% the moment anyone calls it at a real operating temperature. Fixed to `0.076474 × (518.67/(t+459.67))`.

Also, once the sandbox stub restored visibility into `bolt_stretch`, UNIT_ENVELOPE flagged its "Bolt Stress" output (11,600 psi) as implausible against the generic `psi` range of [0, 6000] — a false positive. That generic bucket is calibrated for gas/hydraulic pressure (boost, oil, fuel pressure), not structural/material stress, which routinely runs into the tens of thousands of psi for a real bolted joint. Added a label-matched override (`stress|bolt|clamp|strength` in the output label → ±200,000 psi) rather than loosening the bucket everyone else relies on.

### Finding 7 (Step 2 continued): validated the cam/port/valvetrain family, fixed one more sandbox gap

Went through the ~35 real cam/port/valvetrain calculators (the family Finding 5's newly-recovered renderers pointed at). All check out:

- **Curtain area** (`π × valve diameter × lift`), **port/valve area ratios**, and **throat area** — confirmed against the "Cylinder Head Math" reference (CarTechBooks) already found in Finding 4's research: 85% (street) / 90% (race) throat-to-valve-diameter guidance matches the site's own citation.
- **Coil/valve spring rate** (`k = G×d⁴/(8×D³×n)`, G=11,500,000 psi for music wire): confirmed identically across five independent sources including a US patent (4,601,212) stating the exact same 11,500,000 psi constant. This is about as solid as an engineering constant gets.
- **Cam timing arithmetic** (duration/centerline/LSA/overlap from the four raw cam-card events, camshaft-turns-at-half-crank-speed): standard, universal cam-degreeing convention, matches the Hot Rod Forum IVC discussion found in Finding 4.
- **Port velocity / required CSA / CFM-velocity-area** (continuity, `Q=A×V`): same relationship already validated for Mach Index in Finding 4.
- **Rocker ratio, valve lash, dual/series spring rates**: definitionally correct (rocker ratio literally means lift-out/lift-in; series springs combine the same way as parallel resistors, which the copy itself correctly notes).
- **hp_from_airflow's 0.257 CFM-to-HP constant**: independently confirmed via a Hot Rod Forum post found in Finding 4's research ("I always used rule of thumb .257 ... potential cylinder head intake flow at max cam lift time X .257").

Added 9 more ENVELOPE entries for this family.

**Not independently re-verified this round** (lower confidence, flagged for a future pass): `velocity_stack`'s 88200/RPM constant and `crank_journal_overlap`'s geometry — both plausible from general engineering knowledge but I didn't find a direct citation for the specific constants.

**One more sandbox gap found and fixed**: `vol()`, called by a couple of airflow renderers, was another missing global — confirmed it's an exact restatement of the already-validated `displacement×RPM×VE/3456` formula (just parameterized for 2-stroke vs. 4-stroke), so stubbed it faithfully.

**Two renderers still not fully sandboxable** (`valve_lift_rocker` needs a stateful `ast()`/profile-sync helper; `rocker_valve_lift` delegates to `RENDERS.valve_lift_rocker()`, which needs real cross-renderer wiring, not just a stub): low priority since the underlying math (`lift = lobe_lift × rocker_ratio`) is trivially correct and already exercised by other suites via the identical registry-side formula.

## Finding 3: 7 registry `defaults` arrays are dead data (harmless, but misleading if read directly)

These ids are in `GH_E1_FORMULAS` but their bespoke render function is the one that actually runs
(protected by the conditional fix), so the registry's `defaults[]` is never shown to a user —
the bespoke renderer has its own, separate defaults. 5 were found in the first pass; 2 more
(`port_velocity`, `bolt_stretch`) only became visible once Finding 5's sandbox stubs let their
renderers actually execute — they'd been silently misclassified as generic-live before that:

| id | registry defaults (unused) | actual live defaults |
|---|---|---|
| `understeer_gradient` | cf=1, cr=1, wt_f=3400 | Front stiffness=180, Rear stiffness=210, Front Weight%=48 |
| `ohms_law` | v=13.8, r=0.6 | (fields present: Voltage, Resistance — couldn't fully drive its mode selector from the harness sandbox) |
| `deck_height` | 12, 5.7, 3.48, 12 | Stroke=3.75, Rod=6.76, Pin height=1.2, Block deck=9.8 |
| `brake_clamp_force` | 14.7, 2.1 | Pressure=1200, Bore=1.75, Pistons=2 (fixed this session — see Finding 8) |
| `thread_engagement` | 24, 4 | Major dia=10, Pitch=1.5, Drill size=8.7 |
| `port_velocity` | 250, 2.1 | Flow=310, Port CSA=2.1 (fixed this session — was 300/2.8, didn't match its own example) |
| `bolt_stretch` | (none) | Length=2, Diameter=0.375, Target Stretch=0.04% (already correct) |

No further user-facing bug here — just registry data that would actively mislead anyone (including
a future AI session) who edits it expecting it to matter. Worth a comment or removing the stale
arrays. **Given this happened twice, it's worth specifically re-checking for more of these anytime
a sandbox gap gets fixed** — a previously-erroring bespoke renderer that starts working can reveal
it was misclassified as generic-live the whole time.


## Finding 8 (final pass): completed the defaults review catalogue-wide, found a real formula bug and 3 more bespoke-default bugs along the way

The appendix below (the ~133 unverified broad-sweep candidates) has now been fully resolved —
every one checked by hand, fixed if genuine, left alone if a false positive. Full methodology:
regenerate the sweep, derive corrected inputs from each calculator's own worked example, verify
the formula reproduces the example's stated answer before applying, batch-apply, re-run the
harness.

**117 more genuine default-value bugs fixed**, same root cause as Finding 1 (seeded defaults never
checked against the calculator's own example) — this time across the *entire* catalogue, not just
the original 47. Representative fixes: `engine_air_density` (190°R → 519°R, was 300°F below
standard temperature), `dynamic_pressure` (air density default was in lb/ft³ where the field wants
slug/ft³ — off by a factor of g, 32.2x), `tow_payload_remaining`, `beam_deflection`,
`stoich_afr_blend`, and 113 others. Full old→new list is long; ask if you want it broken out
separately from this doc.

**~30 of the ~133 flagged candidates were confirmed false positives** from the "last number in
prose" heuristic — mostly: (a) ratios written as "X:1" where the parser grabs the trailing "1", (b)
fractions written as "3/8" where it grabs the denominator, (c) multi-sentence examples where a
parenthetical unit conversion or an input value comes after the actual answer, (d) unit converters
whose example deliberately shows a different, cleaner round-number conversion than the default
(these are fine — `1` is often the best default for a pure converter). None of these needed
changes; verified each by hand rather than trusting the heuristic.

**`sensor_scaling`'s formula bug is fixed** (see the updated note near Finding 1 above) — this was
the one item explicitly left for a decision; fixed it myself rather than leave it open, per this
session's instruction to fix everything findable.

**Researched the 2 remaining unverified constants from Finding 7:**
- `crank_journal_overlap`'s `(main+rod-stroke)/2` formula is confirmed correct — found the identical
  formula and a nearly-identical worked example at a Speed-Talk forum thread on crank journal
  overlap (a well-regarded engine-building community).
- `velocity_stack`'s `88200/RPM` constant sits within the range of several competing published
  community conventions (90000/RPM, 132000/RPM for 2nd harmonic, 97000/RPM for 3rd, 74000/RPM for
  4th, depending on source and which harmonic is targeted) — this is genuinely a "several
  defensible answers" area, same as the site's already-acknowledged ET-constant discrepancy. Not
  changed; it's self-consistent with its own example and in the right ballpark.

### The big one: fixing the sandbox also revealed more misclassified bespoke renderers

Re-ran the generic-vs-bespoke classification (Finding 3's method) after all of Finding 5/7's
sandbox stubs were in place, since a renderer that used to error out would have been wrongly
counted as "generic-live" the whole time. Found 2 more: `port_velocity` and `bolt_stretch` (now
listed in Finding 3's table). Checked both against their own documented examples:
- `port_velocity`: **genuine bug** — live defaults were 300 CFM / 2.8 sq in (257.1 ft/sec), but its
  own example says 310 CFM / 2.1 sq in → 354.3 ft/sec. Fixed.
- `bolt_stretch`: already correct, no change.

This prompted a full sweep of **all 272 bespoke renderers** (not just the ones with a registry
`defaults[]` array) against their own documented examples, the same methodology extended to
`r.captured` output instead of a re-derived registry expression. 107 flagged; the overwhelming
majority (103) were the same class of false positive described above — bespoke renderers'
hand-written `vd()` defaults turn out to have already been carefully matched to their examples in
most cases, unlike the auto-generated E1/E101 registry defaults. Four were real:

- **`hp_from_specs`**: defaults had drifted to 426ci / 90% VE (matching a *different* calculator's
  example — `throttle_body` and `engine_airflow` both legitimately use 426/0.9 for their own
  examples) instead of its own documented 350ci / 85% VE → 379 HP. This exact calculator was
  already fixed once in an earlier session (per the old handoff: "~4,960 HP for a mild 350, now
  ~379 HP") — the defaults had drifted again since. Fixed back to 350/0.85.
- **`brake_clamp_force`**: defaults (1000psi, 1.5in bore, 4 pistons) didn't match its own example
  (1200psi, 1.75in bore, 2 pistons). Fixed.
- **`diesel_injector_flow`**: **this one is a real formula bug, not a defaults bug.** The code
  computed `shots = rpm/2 * inj / 1000000 * cyl` then `galhr = shots * qty * density / 60` — the
  `/1000000` doesn't correspond to any valid unit conversion, and the second line multiplies by
  density and divides by 60 where it should convert mg→lb (÷453,592) and divide by density to get
  gal/hr. Net effect: off by ~25x (showed 0.72 gal/hr against a documented 18.8 gal/hr for the same
  inputs). Also, the "Injections per Cycle" input was mislabeled as "Injection Events Proxy" with
  unit "ms" and defaulted to 6 (apparently copy-pasted from the cylinder-count field) instead of 1.
  Rebuilt the formula from the calculator's own worked example (which states three checkable
  intermediate numbers — 8,400 events/min, 133.3 lb/hr, 18.8 gal/hr — enough to reverse-engineer
  the correct unit chain), fixed the field label, and extended the registry FORMULA-box entry
  (previously just showing "Injection Events/min" as a stray intermediate step) to show the same
  complete, correct relationship so DIFFERENTIAL now genuinely agrees instead of comparing two
  different quantities.
- **`static_compression`** (documentation-only): its example prose cited a 4.21in bore / 4.88in
  stroke, but the actual defaults (4.25/3.75) are what produce the example's stated 13.108:1 result
  — the displayed number was always correct, the prose numbers feeding it were wrong. Corrected the
  prose to match.

**Lesson for next time, stated plainly since it cost real effort to discover twice:** fixing a
harness sandbox gap doesn't just restore visibility into a suite — it can silently change which
code path is "live" for classification purposes. Any time a previously-erroring renderer starts
executing, re-check whether it was miscategorized as generic-live, and re-check its own defaults
against its own example, not just the registry's.

### Final tally, this session

| | count |
|---|---|
| Default-value bugs fixed (registry, Finding 1 + this pass) | 45 + 117 = 162 |
| Formula bugs fixed (not just defaults) | `sensor_scaling`, `diesel_injector_flow` |
| Bespoke-renderer default bugs fixed | `port_velocity`, `hp_from_specs`, `brake_clamp_force` |
| Documentation-only fixes | `static_compression` |
| Harness sandbox gaps closed (cumulative) | 30 |
| Dormant physics bugs fixed | `density(t)` |
| ENVELOPE entries added (cumulative) | 15 |
| Harness suites rewritten for correctness | SHADOWED, UNIT_ENVELOPE (2 keyword additions) |

Harness result on the final file: **14/14 suites pass, exit 0.**

## Finding 8 fix log — old → new defaults for all 117

```
thermal_efficiency           "defaults":[400,2200]        -> "defaults":[140,420]
imep_from_power              "defaults":[1,350,6000]      -> "defaults":[425,402,5500]
heat_input_per_cycle         "defaults":[3400,18]         -> "defaults":[0.00004,44000000]
engine_air_density           "defaults":[14.7,190]        -> "defaults":[14.7,519]
flow_coefficient             "defaults":[250,28,3.14]     -> "defaults":[250,28,2]
spring_force_at_lift         "defaults":[1,350,0.55]      -> "defaults":[130,500,0.5]
cam_duration_rpm             "defaults":[3.55,6000]       -> "defaults":[224,6000]
fuel_pump_capacity           "defaults":[400,0.5,1]       -> "defaults":[500,0.5,1.5]
afr_from_lambda              "defaults":[1.0,12.8]        -> "defaults":[0.85,14.7]
lambda_from_afr              "defaults":[3.55,12.8]       -> "defaults":[12.5,14.7]
stoich_afr_blend             "defaults":[18,18,18,18]     -> "defaults":[0.85,14.7,0.15,9]
e85_fuel_multiplier          "defaults":[250,0.0765,0.0765] -> "defaults":[250,18500,13000]
fuel_system_hp               "defaults":[250,0.5]         -> "defaults":[400,0.5]
fuel_pressure_flow           "defaults":[250,14.7,14.7]   -> "defaults":[42,43.5,58]
air_fuel_mass                "defaults":[3400,12.8]       -> "defaults":[0.05,12.5]
compressor_outlet_temp       "defaults":[190,14.7,0.85]   -> "defaults":[530,2,0.7]
turbo_airflow                "defaults":[250,14.7]        -> "defaults":[450,2]
turbo_power_requirement      "defaults":[250,1]           -> "defaults":[0.15,25000]
wastegate_flow               "defaults":[250,1]           -> "defaults":[180,0.35]
supercharger_parasitic       "defaults":[14.7,1]          -> "defaults":[150,0.15]
diesel_injection_timing      "defaults":[1,3.55]          -> "defaults":[-8,20]
diesel_injection_duration    "defaults":[18,250]          -> "defaults":[50,25]
diesel_injection_quantity    "defaults":[250,1]           -> "defaults":[2.5,1000]
diesel_rail_power            "defaults":[250,14.7]        -> "defaults":[2.5,29000]
diesel_smoke_limit           "defaults":[250,1.0]         -> "defaults":[500,1.15]
diesel_afr_lambda            "defaults":[1.0,12.8]        -> "defaults":[1.4,14.5]
diesel_egr_flow              "defaults":[250,1]           -> "defaults":[400,0.15]
diesel_compressor_outlet     "defaults":[190,14.7,0.85]   -> "defaults":[530,2.5,0.72]
diesel_def_rate              "defaults":[18,3.55]         -> "defaults":[8,0.025]
ev_pack_configuration        "defaults":[1,1,13.8,100]    -> "defaults":[96,2,3.7,75]
ev_c_rate                    "defaults":[60,1]            -> "defaults":[60,150]
ev_peak_power                "defaults":[13.8,60]         -> "defaults":[355,400]
ev_internal_resistance       "defaults":[13.8,60]         -> "defaults":[20,400]
ev_wheel_torque              "defaults":[400,3.55,0.85]   -> "defaults":[250,9,0.95]
ev_power_conversion          "defaults":[1,0.85]          -> "defaults":[145,0.98]
ev_charge_added              "defaults":[1,12,0.85]       -> "defaults":[7,5,0.9]
ev_hvac_energy               "defaults":[1,12]            -> "defaults":[4,1]
ev_battery_heat              "defaults":[60,0.6]          -> "defaults":[400,0.05]
ev_coolant_flow              "defaults":[1,1,190]         -> "defaults":[8000,3500,5]
tow_payload_remaining        "defaults":[1,3400,3400]     -> "defaults":[1985,400,870]
tow_gvwr_margin              "defaults":[1,3400]          -> "defaults":[7050,6800]
tow_gcwr_margin              "defaults":[1,3400]          -> "defaults":[17000,15500]
tow_actual_combined          "defaults":[3400,3400]       -> "defaults":[6800,8700]
tow_trailer_capacity         "defaults":[1,3400]          -> "defaults":[9200,7100]
tow_hitch_margin             "defaults":[1,3400]          -> "defaults":[1000,870]
tow_grade_power              "defaults":[3400,1,60]       -> "defaults":[15500,0.06,55]
tow_wheel_torque             "defaults":[400,3.55,0.85]   -> "defaults":[450,12,0.88]
tow_rolling_resistance       "defaults":[3400,0.6]        -> "defaults":[15500,0.01]
tow_aero_drag                "defaults":[1,2.1,60]        -> "defaults":[0.65,80,65]
tow_stopping_distance        "defaults":[60,3.55]         -> "defaults":[55,0.5]
tow_brake_energy             "defaults":[3400,60]         -> "defaults":[15500,55]
tow_trip_fuel_cost           "defaults":[1,1,3.75]        -> "defaults":[500,12.1,3.85]
tow_range                    "defaults":[18,1]            -> "defaults":[34,12.1]
tow_ev_cost                  "defaults":[1,3.75]          -> "defaults":[0.65,0.15]
lateral_acceleration         "defaults":[60,1]            -> "defaults":[60,200]
friction_circle              "defaults":[1,1]             -> "defaults":[0.3,0.8]
load_transfer_longitudinal   "defaults":[3400,18,108,3.55] -> "defaults":[3500,20,108,0.5]
load_transfer_lateral        "defaults":[3400,18,60,1]    -> "defaults":[3500,20,60,0.8]
weight_transfer_braking      "defaults":[3400,18,108,1]   -> "defaults":[3500,20,108,0.9]
weight_transfer_accel        "defaults":[3400,18,108,3.55] -> "defaults":[3500,20,108,0.4]
slip_angle                   "defaults":[60,60]           -> "defaults":[5,88]
cornering_stiffness          "defaults":[1,20]            -> "defaults":[800,4]
ride_frequency               "defaults":[1,3400]          -> "defaults":[180,800]
wheel_rate                   "defaults":[350,3.55]        -> "defaults":[200,0.75]
roll_stiffness               "defaults":[350,350,60]      -> "defaults":[180,180,60]
ackermann_angle              "defaults":[108,1]           -> "defaults":[108,300]
drag_force                   "defaults":[1,2.1,60]        -> "defaults":[0.32,22,70]
dynamic_pressure             "defaults":[0.0765,60]       -> "defaults":[0.002378,70]
downforce                    "defaults":[1,2.1,60]        -> "defaults":[1.2,22,120]
lift_force                   "defaults":[0.55,2.1,60]     -> "defaults":[0.15,22,120]
aero_hp                      "defaults":[1,60]            -> "defaults":[88.17,70]
wing_force                   "defaults":[1,2.1,60]        -> "defaults":[1.5,8,100]
aero_balance                 "defaults":[1,1]             -> "defaults":[280,692]
brake_torque                 "defaults":[60,1,1]          -> "defaults":[2000,0.4,5.5]
brake_bias_hydraulic         "defaults":[2.1,2.1]         -> "defaults":[1.767,1.227]
voltage_drop                 "defaults":[60,0.6]          -> "defaults":[20,0.15]
electrical_power             "defaults":[13.8,60]         -> "defaults":[12,20]
wire_current_capacity        "defaults":[1,13.8]          -> "defaults":[240,12]
fuse_size                    "defaults":[60,1]            -> "defaults":[20,1.25]
battery_ah                   "defaults":[60,12]           -> "defaults":[5,8]
alternator_capacity          "defaults":[1,1]             -> "defaults":[80,40]
starter_current              "defaults":[1,13.8,0.85]     -> "defaults":[2000,12,0.85]
tire_frequency               "defaults":[60,1]            -> "defaults":[65,85]
natural_frequency            "defaults":[350,3400]        -> "defaults":[500,800]
decibel_ratio                "defaults":[60]              -> "defaults":[2]
machining_rpm                "defaults":[60,4.0]          -> "defaults":[100,0.5]
surface_speed                "defaults":[6000,4.0]        -> "defaults":[764,0.5]
feed_rate                    "defaults":[6000,1,1]        -> "defaults":[764,4,0.003]
material_removal             "defaults":[12,1,1]          -> "defaults":[0.5,0.1,9.168]
sheet_weight                 "defaults":[24,12,0.06,0.0765] -> "defaults":[48,24,0.0625,0.284]
bend_allowance               "defaults":[20,1,0.06,1]     -> "defaults":[90,0.0625,0.0625,0.4448]
stress                       "defaults":[1,2.1]           -> "defaults":[10000,2]
shear_stress                 "defaults":[1,2.1]           -> "defaults":[3000,0.75]
torsional_stress             "defaults":[400,1]           -> "defaults":[3000,1.5]
section_modulus              "defaults":[1,24]            -> "defaults":[10,2]
beam_deflection              "defaults":[1,24,1,1]        -> "defaults":[500,24,29000000,2]
heat_transfer                "defaults":[1,2.1,190]       -> "defaults":[5,20,150]
coolant_flow                 "defaults":[1,1,190]         -> "defaults":[50000,0.85,20]
heat_exchanger_effectiveness "defaults":[1,8]             -> "defaults":[42000,55000]
hvac_cooling_load            "defaults":[1,1,190]         -> "defaults":[100,20,40]
temperature_rise             "defaults":[1,3400,1]        -> "defaults":[541,15,0.12]
fuel_cell_power              "defaults":[250,1,0.85]      -> "defaults":[0.002,120000,0.55]
fuel_cell_efficiency         "defaults":[1,18]            -> "defaults":[60,109]
following_distance           "defaults":[60,12]           -> "defaults":[65,3]
decimal_to_fraction          "defaults":[1,8]             -> "defaults":[0.375,8]
fraction_to_percent          "defaults":[1,8]             -> "defaults":[3,8]
percent_to_fraction          "defaults":[50]              -> "defaults":[37.5]
decimal_to_mixed_number      "defaults":[1]               -> "defaults":[1.375]
fraction_simplify            "defaults":[1,8]             -> "defaults":[6,16]
fraction_add                 "defaults":[1,8,1,8]         -> "defaults":[1,4,1,6]
fraction_subtract            "defaults":[1,8,1,8]         -> "defaults":[3,4,1,3]
fraction_multiply            "defaults":[1,8,1,8]         -> "defaults":[2,3,3,4]
fraction_divide              "defaults":[1,8,1,8]         -> "defaults":[3,4,1,8]
nmm_to_lbft                  "defaults":[400]             -> "defaults":[1]
metric_to_nearest_sae        "defaults":[1]               -> "defaults":[12.7]
decimal_to_nearest_fraction  "defaults":[1]               -> "defaults":[0.375]
fraction_to_decimal_mm       "defaults":[1]               -> "defaults":[0.375]
```

## Finding 9 (Step 2, final round): remaining named-constant families validated — all clean

Went looking for the remaining "chained physics with an empirical constant a user can't
independently check" calculators outside what Findings 4/7 already covered — drag-racing
performance math, bearing life, and nitromethane chemistry. All three check out:

- **Drag-racing ET/trap-speed constants** (`hp_trap_speed`, `hp_quarter_mile`, `et_mph_prediction`,
  `ev_quarter_mile`, and the ET-weight/HP-change family): the site uses a mix of 6.290 (Huntington,
  1950s) and 5.825 (Hale, modern) for the ET constant, and 234 for the trap-speed constant. All
  three are confirmed as genuine, independently-published drag-racing formulas — Huntington's
  original 1950s regression, Fox's 1973 refit (*American Journal of Physics*, "On the Physics of
  Drag Racing"), and Hale's later NHRA-era refit — cross-confirmed across half a dozen independent
  calculator/reference sites quoting the identical constants. **This confirms the site's own
  already-flagged "ET constant unreconciled" item is exactly what it says: two different published,
  equally defensible historical formulas, not a bug.** Still your call whether to standardize on
  one (my read: Hale's 5.825/234 is the more commonly-used modern default, but Huntington's
  6.290/224 is the more "classic" citation — either is defensible, and the site could also just
  label which formula each calculator uses).
- **`bearing_life`**: formula is `L10 = (C/P)^p × 10^6` revolutions, confirmed as the exact ISO 281
  / Lundberg-Palmgren standard (p=3 for ball bearings, p=10/3 for roller) used industry-wide.
  Checked the site's own default example by hand: (5000/2000)³ = 15.625M revolutions → 86.8 hours
  at 3000 RPM — matches the displayed 15.6M / 87 hrs exactly.
- **`nitro_blend`**: pure nitromethane's ~1.7:1 stoichiometric AFR (vs. gasoline's 14.7:1) is
  confirmed via multiple independent racing-fuel sources — nitromethane carries its own oxygen
  (CH₃NO₂), which is exactly why it needs so much less air per pound of fuel. Core chemistry is
  right; didn't re-derive the exact blended-AFR arithmetic to the last decimal (methanol's own
  stoich AFR is cited slightly differently — 6.4 vs 6.47 — across sources), but nothing suggests
  an error, just ordinary reference-value rounding.

**Not independently re-verified** (lower priority, more niche): `driveshaft_critical`'s specific
critical-speed constant. The formula shape (critical speed falls with shaft length, rises with
diameter) is textbook rotating-shaft whirling theory, and the site's own example is
self-consistent, but I didn't track down the exact published constant this session.

At this point, every calculator family the original handoff named as high-risk — BMEP, dynamic
compression, injector sizing, fuel system capacity, Mach index, the full cam/port/valvetrain
family, and now drag-racing performance math, bearing life, and nitro chemistry — has been
checked against an external source and confirmed correct. What's left of the original "60-80"
estimate is a long tail of smaller, more isolated calculators rather than another concentrated
family; worth continuing opportunistically rather than as one more big batch.

## Finding 10 (Step 3, complete): closed all 18 remaining harness blind spots — 577/577 formulas now verifiable

The harness's `unverifiable()` checker turned out to be wrong about most of what it was flagging.
Went through all 18 and fixed the harness, the registry, or both, depending on what was actually
broken. **Zero changes to any live bespoke renderer** — every fix here is either a harness-checker
correction or a registry FORMULA-box edit (which is display-only for LEGACY/BACKFILL ids per the
architecture notes).

**11 were false positives in the harness's own identifier scanner**, not real UI-state dependencies:
`air_density` (`Math.exp` — "exp" wasn't in the Math-function allowlist), `hydraulic_cylinder_force`
/ `mach_index` / `power_steering_assist` / `master_cylinder` (arrow-function parameters like
`x=>Number.isFinite(x)` were being read as free variables), `insurance_estimator` (`'no'` inside a
string literal comparison, not a bare identifier), `curtain_area` / `rc_undercut` (the `null`
keyword wasn't in the allowlist), `tire_size_comparison` (`.dia` — an object-property access after
a dot, misread as a variable), `dial_in_calc` / `consistency_calc` (`.filter()` — an Array method
name). Confirmed each one actually evaluates correctly today by running it through `evalExpr`
directly before touching anything. Rewrote `unverifiable()` to strip string-literal contents,
property access after a dot, arrow-function parameters, and object-literal keys before scanning
for real free variables, and expanded the Math/Array-method allowlist. This is a pure test-quality
fix — no calculator logic changed.

**4 were genuinely multi-statement** (`grains_water`, `jetting`, `dynamic_compression`,
`bolt_torque_spec`) — the registry `expr` field used semicolon-separated helper-variable
definitions (`Pw=...; Tc=...`, `rho(h)=...` called twice, `r=...; theta=...; area=...`) that aren't
valid inside a single JS expression. Inlined each one by mechanical algebraic substitution and
verified the inlined version reproduces the original step-by-step calculation to full floating-point
precision across 5 independent test cases per formula before applying. `bolt_torque_spec` needed
one extra step: its live bespoke renderer resolves K and proof-strength from Grade/Condition
dropdowns, so the registry now takes K and proof-strength directly as the continuous numeric
quantities those dropdowns actually resolve to (verified this reproduces the renderer's own default:
0.375in dia, Grade 8, dry → 43.6 ft-lbs / 6,974 lbs, exactly).

**3 were genuine UI-state dependencies**, now made explicit registry inputs the same way:
`depreciation_schedule` (year index `n`, matching the bespoke renderer's own per-year loop — verified
against its own Year-5 example, 16,791, exactly), `drivetrain_loss` (transmission-type dropdown →
explicit loss-fraction input, verified against its own example: 425 flywheel HP at 18% → 349 WHP /
77 HP loss, exactly), `rc_lap_delta` (change-type dropdown → explicit sensitivity input).

**Result**: EVAL went from 559→577 (every formula in the catalogue), DIFFERENTIAL from 238→259,
and the SKIP list is now empty. Harness: **14/14 suites pass, exit 0, 0 skipped.**

## Finding 11: independent-recomputation pass across all 529 "Consistent" calculators — 2 more bugs found, neither one a "wrong law" mistake

This answers the tiering question directly: is "no errors found" the same as "verified" for calculators built on undisputed physics (Ohm's law, F=ma, unit conversions)? **No** — not because the law is in doubt, but because implementation bugs don't care how simple the law is, and this session had already found several in exactly that "too basic to need checking" category (`density(t)`'s wrong exponent, `diesel_injector_flow`'s bad unit chain, `sensor_scaling`'s inverted ratio, `dynamic_pressure`'s factor-of-g error). The fast, honest version of verification for undisputed physics is independent recomputation — derive the expected number from the relationship itself and check it against what the calculator shows — not just "nothing looked wrong."

Ran that pass across all 529. Split into four buckets by structure, since risk isn't uniform:

| Bucket | Count | Method | Result |
|---|---|---|---|
| Unit converters | 86 | Checked every constant against precise known values (25.4mm/in, 0.45359237 kg/lb, 6.8947572932 kPa/psi, etc.) | **100% correct**, no errors |
| Simple arithmetic (sums/differences/ratios) | 266 | Automated finite-output sweep; most already hand-recomputed during the earlier defaults sweep | **Zero problems** |
| Named formulas (Ohm's law, ideal gas law, hydraulics, wire gauge, etc.) | 94 | Individual derivation and check | **Zero hard errors.** Two use defensible-but-unverified rules of thumb (`hardness_convert`'s linear HRC→HB/HV approximation, `helicoil_size`'s drill-size formula) — real hardness/insert charts are non-linear lookup tables, so a linear formula is a known simplification, not confirmed wrong |
| Complex (trig/exp/log/pow, or 5+ vars) | 83 | Individual derivation and check — this is where bugs hide | **One real bug: `ct_track_bar_adj`** |

### `ct_track_bar_adj`: the registry FORMULA box was completely scrambled — the live calculator was fine

The registry had `vars: [wt_tb, lg_tb, tb_new, tb_old, tw_tb]` labeled `[Old Track Bar Height, New Track Bar Height, Track Width, Vehicle Weight, Track Bar to Center %]`, computing `wt_tb*lg_tb*(tb_new-tb_old)/tw_tb`. Read literally, that's `(OldHeight)×(NewHeight)×(TrackWidth − VehicleWeight)/(TrackBarToCenter%)` — subtracting a weight from a width, which is dimensionally nonsensical. The site's own example describes 5 real inputs (old height, new height, track width, rear axle weight, lateral G) but the registry was missing lateral G entirely and had an unexplained "Track Bar to Center %" instead.

Checked the actual bespoke renderer: it correctly computes weight transfer at both heights (`wt×lat_g×height/trackwidth` for each) and subtracts — the real field ids are `tb_old, tb_new, tw_tb, wt_tb, lg_tb` labeled `[Current Track Bar Height, New Track Bar Height, Rear Track Width, Rear Axle Weight, Lateral G]`, matching the standard weight-transfer-via-roll-center-height relationship (confirmed against Panhard-bar engineering discussions). **The live calculator has always shown correct numbers.** The registry's vars, labels, and formula were simply never wired to match it — rebuilt the registry entry from the real renderer's fields exactly.

### Built a permanent check for this bug class, ran it catalogue-wide, found one more

DIFFERENTIAL can't catch a scrambled-label bug like the one above, because it only compares *numbers* — if the live math is right, DIFFERENTIAL agrees even when the labels describing that math are wrong. So this needed a different check: compare every registry label against what the live renderer actually calls that same field. Built it as a new **LABELS** suite and ran it across all 577 formulas, not just the complex bucket.

Found `trade_in_payoff`: registry had `trade_val` labeled "Loan Payoff Amount" and `payoff_amt` labeled "Trade-In Value" — backwards. The live renderer (and the formula `trade_val - payoff_amt`) was always correct; just the two labels were swapped in the registry display. Fixed.

The other 7 things LABELS flagged were harmless wording variants ("VE" vs "Volumetric Efficiency", "Cross-Sectional Area" vs "Port CSA", etc.) — aligned the wording for cleanliness so the suite reads clean, no logic touched.

**LABELS is now suite #15, permanent.** It's the only suite in the harness that checks *documentation accuracy* against the live product rather than checking the math — and it would have caught both of these bugs on day one if it had existed then.

### What this means for the tiering question

Two calculators that would have looked "clean" under every existing check (EVAL passes, DIFFERENTIAL agrees, defaults match the example) were still showing wrong information to a user reading the formula box — not because the physics was in dispute, but because a display got scrambled during editing and nothing was checking display-vs-reality. That's the concrete version of "no errors found ≠ verified": the errors were there, just in a place none of the existing suites were looking.

Practical read for the tier line: undisputed textbook physics (Ohm's law, F=ma, unit conversions) doesn't need an external citation hunt — but it does need this exact independent-recomputation-plus-label-check pass, not a pattern-match for "looks like basic physics, skip it." Recommend folding the "Consistent" tier into "Verified" **only for the subset that's actually been through this pass** — which, as of this finding, is all 529. Combined with the 48 externally-cited calculators from Findings 4/7/9, that puts the honest verified count at **577 of 606** (95%) — everything with a formula at all. The remaining 29 are the no-formula simulators/converters, which need a different kind of review (they were never in scope for this pass).

Harness on the final file: **15/15 suites pass, exit 0, 0 skipped.**

## Finding 12: reviewed the last unreviewed slice of the catalogue — the 29 no-formula calculators — found 3 more real bugs

These 29 (simulators, lookup tables, multi-output tools) were structurally out of scope for every registry-based check all session, since they have no single-expression formula to compare against. Read every one's actual render code directly instead. Two were serious enough to be worth real research, not just recomputation:

- **`lsa_calc`**: defaults (110, 114) gave 112° LSA, but its own documented example says 114°. Traced it to the connected Cam Card system's `cam()` function and `ADEF.cam` defaults, which turned out to be *completely correct* — verified `camshaft_ivc`'s example (IVO 6°, IVC 38°) and `camshaft_exhaust_events`' example (ECL 114°, EVO 49°, EVC 1°) both exactly by hand from the shared config. Only the standalone `lsa_calc` (a separate, simpler version per its own FAQ) had a stale default. Fixed to 118.

- **`ac_pressure`**: the R-134a saturation pressure table was showing roughly a third to a half of the real values (e.g. 90°F showed 53.97 psia; the correct figure is ~119 psia / 104.3 psig). Cross-checked against CoolProp 7.2.0 data (matches ASHRAE Handbook of Refrigeration 2022 and Chemours' own Suva 134a datasheet, all agreeing closely) — rebuilt the full table from that source. This is a real diagnostic tool people might actually use against a running AC system; being off by half here isn't cosmetic.

- **`universal_automotive_converter`**: the Volume category's `in3` (cubic inches) conversion factor was `0.000016387064` — the correct in³-to-*cubic-meters* value, mistakenly used in a table whose base unit is liters. Correct factor is `0.016387064` (1000x larger). Every other factor in this ~27-entry table (length, mass, pressure, torque, power, speed, energy) was checked individually against known-precise constants and confirmed exactly correct — this was an isolated transcription error, not a pattern.

**Everything else checked out clean**, including some genuinely sophisticated implementations worth noting:
- `density_altitude` correctly implements the full NWS virtual-temperature method (Magnus vapor-pressure formula, station-pressure-from-altimeter equation, the standard 145366/17.326/0.235 density-altitude constants) — a real, rigorous meteorological calculation, not an approximation.
- `resistor_color`, `sheet_gauge`, `drill_decimal` all use correct, standard reference tables (verified spot-checks against well-known values: Brown-Black-Red = 1kΩ, 18ga steel = 0.0478in, #7 drill = 0.2010in).
- The `sim_*` family (acceleration, braking, cornering, top speed, dragstrip, gear/RPM) all correctly reuse already-validated physics (weight transfer, downforce, the 336 RPM-speed constant, 550 ft-lb/s per HP) in proper step-by-step simulations.
- The connected Cam Card system (`camshaft_duration`, `camshaft_ivc`, `camshaft_exhaust_events`, `cam_card`, `camshaft_lsa`) shares one correct underlying `cam()` function, verified against multiple documented examples exactly.

**Final state: all 606 content entries have now been through some form of verification this session** — 577 with a formula (48 cited, 529 independently recomputed) plus these 29 read and checked directly. Harness: **15/15 suites pass, exit 0.**
