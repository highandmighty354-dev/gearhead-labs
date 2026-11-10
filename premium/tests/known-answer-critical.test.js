#!/usr/bin/env node
/* Gearhead Labs — independent known-answer regression tests for the Critical and High root causes (Stage 1, docs/STAGE-1-TEST-INTEGRITY.md).

   WHAT THIS IS. One check per known-answer case for every Critical / High root cause in docs/DEFERRED-WORK-REGISTER.md (GH-DEF-045 to GH-DEF-059). Every expected
   value is derived HERE, in this file, from first principles or a named published method (slider-crank kinematics, Stull 2011, Darcy-Weisbach with Swamee-Jain,
   torsion-bar roll stiffness, 1/2 rho Cd A v^2 with rho in slug/ft^3, diesel stoichiometric AFR, a power-limited vehicle integration). Nothing is computed by calling
   the engine's own formula or helper; the engine is only driven through its page (open a calculator, type into boxes, read the shown rows).

   HOW IT STAYS GREEN WHILE THE DEFECTS ARE OPEN (no formula may change in Stage 1). A case that fails because of a registered, still-open defect is listed in
   KNOWN_OPEN (premium/tests/data/known-answer-open.json) with that defect's register id. The run fails when
     - a case fails that is NOT in KNOWN_OPEN (a new defect or a regression), or
     - a case in KNOWN_OPEN PASSES (the defect was fixed or the test went soft: the ledger entry must be removed and the register entry updated), or
     - the page throws.
   So the ledger cannot go stale, and a fix cannot land without the ledger and register being updated with it. premium/tests/register-check.js refuses a ledger id
   that does not name an open register entry.

   PROVISIONAL CONVENTIONS (owner decisions D7 / D8 in the Phase 0 baseline are still open). Where the right answer depends on a convention not yet approved, the case
   says so in `conv` and uses the convention recommended in the Phase 0 baseline. Where a convention-free check is possible (a property every correct answer must
   satisfy), it is used instead or as well.

   Run: node premium/tests/known-answer-critical.test.js
        VERBOSE=1        prints every case
        GH_ENGINE=path   tests another copy of the engine
        KA_STRICT=1      ignores KNOWN_OPEN (every case must pass) — used by premium/tests/proof/red-green.js against a corrected copy
        KA_JSON=path     also writes the per-case results as JSON ({complete, caseIds, results, ...})
        KA_REPORT=1      report mode (used by premium/tests/proof/red-green.js): the exit code says whether the RUN is valid, not whether cases passed —
                         0 only if every case was evaluated, the JSON was written and no page error occurred; 2 otherwise. Case results are in the JSON.
        KA_LIST=1        prints {"ids":[...]} (every case id, in order) and exits 0 without opening a browser
   Exit code 0 = clean against the ledger, 1 = otherwise. */
'use strict';
const { parseShown, mismatch } = require('./lib/numeric-guard');
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* ---------- independent reference mathematics (no engine code) ---------- */
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const G = 32.174;                      // ft/s^2, standard gravity
const RHO_SL = 0.0023769;              // slug/ft^3, ISA sea-level density
const MPH = 5280 / 3600;               // ft/s per mph
/* slider-crank: piston distance below TDC, crank angle measured from TDC */
const pistonX = (stroke, rod, deg) => { const r = stroke / 2, a = deg * D2R; return r * (1 - Math.cos(a)) + rod - Math.sqrt(rod * rod - Math.pow(r * Math.sin(a), 2)); };
/* dynamic (effective) compression: the trapped stroke starts at IVC, which is IVC degrees ABDC = 180 + IVC degrees from TDC */
const dynCR = (cr, rod, stroke, ivc) => 1 + (pistonX(stroke, rod, 180 + ivc) / stroke) * (cr - 1);
/* Stull (2011), J. Appl. Meteor. Climatol. 50, 2267-2269: Tw in degC from T in degC and RH in % */
const stullC = (tc, rh) => tc * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) + Math.atan(tc + rh) - Math.atan(rh - 1.676331) + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) - 4.686035;
const wetBulbF = (tf, rh) => stullC((tf - 32) * 5 / 9, rh) * 9 / 5 + 32;
/* Darcy-Weisbach with Swamee-Jain (turbulent) or 64/Re (laminar); everything converted to SI from exact definitions */
function fuelLine(gph, ft, idIn, roughIn, sg, cP) {
  const Q = gph * 3.785411784e-3 / 3600, D = idIn * 0.0254, L = ft * 0.3048, rho = sg * 999.016, mu = cP / 1000;
  const v = Q / (Math.PI * D * D / 4), Re = rho * v * D / mu;
  const f = Re < 2300 ? 64 / Re : 0.25 / Math.pow(Math.log10((roughIn / idIn) / 3.7 + 5.74 / Math.pow(Re, 0.9)), 2);
  return { f, psi: f * (L / D) * rho * v * v / 2 / 6894.757293168 };
}
/* torsion bar at the arm end: k = G pi d^4 / (32 L arm^2); with the end links at the track width (motion ratio 1), roll stiffness K = k T^2 per radian */
const swayRollPerDeg = (Gs, d, Lb, arm, T) => (Gs * Math.PI * Math.pow(d, 4) / (32 * Lb * arm * arm)) * T * T * D2R;
/* power-limited straight-line integration: constant peak wheel power, correct drag, rolling resistance, no traction or shift limits. Any real run is slower, so this
   gives an UPPER bound on speed at a distance and a LOWER bound on time to a speed. */
function powerBound({ hpWheel, W, cd, A, crr, rho = RHO_SL, toFt, toMph }) {
  const P = hpWheel * 550, m = W / G; let v = 0.1, x = 0, t = 0; const dt = 0.0005;
  for (let i = 0; i < 4e6; i++) {
    const D = 0.5 * rho * cd * A * v * v + crr * W; v += ((P / v - D) / m) * dt; x += v * dt; t += dt;
    if (toFt && x >= toFt) return { mph: v / MPH, t };
    if (toMph && v >= toMph * MPH) return { mph: v / MPH, t };
  }
  return { mph: v / MPH, t };
}
/* top speed with peak wheel power and correct drag: (1/2 rho Cd A v^2 + Crr W) v = P */
function powerLimitedTopMph({ hpWheel, W, cd, A, crr, rho = RHO_SL }) {
  let lo = 1, hi = 600; for (let i = 0; i < 200; i++) { const v = (lo + hi) / 2 * MPH; ((0.5 * rho * cd * A * v * v + crr * W) * v > hpWheel * 550) ? hi = (lo + hi) / 2 : lo = (lo + hi) / 2; }
  return lo;
}
/* simulator defaults (the shipped vehicle) and the peak of the shipped default engine curve: 319.88 HP at 6,000 RPM (curve data, read once from the page as input data,
   not a formula); drivetrain efficiency 85 % */
const SIM = { W: 3200, cd: 0.32, A: 22, crr: 0.012, hpWheel: 319.88 * 0.85 };

/* ---------- cases ---------- */
/* kind 'row': open `calc`, type `edit`, read the result row whose label contains `row`, compare with `want` within `tol` (absolute).
   kind 'sim': the same against a simulator stat tile.  kind 'prop': run `fn` (custom check).  `rc` = Phase 0 root cause, `reg` = register id. */
const CASES = [
  // RC-01 / GH-DEF-045 diesel_power_from_fuel — HP = fuel [lb/hr] / BSFC [lb/hp-hr]
  { id: 'KA-01', reg: 'GH-DEF-045', calc: 'diesel_power_from_fuel', edit: { dpf_fuel: 25, dpf_bsfc: 0.40 }, row: 'Estimated Brake Power', want: 25 / 0.40, tol: 0.6, why: 'HP = 25 lb/hr / 0.40 lb/hp-hr = 62.5' },
  { id: 'KA-02', reg: 'GH-DEF-045', calc: 'diesel_power_from_fuel', edit: { dpf_fuel: 100, dpf_bsfc: 0.38 }, row: 'Estimated Brake Power', want: 100 / 0.38, tol: 0.6, why: 'HP = 100 / 0.38 = 263.2' },
  // RC-02 / GH-DEF-046 diesel_smoke_limit — fuel = air / (lambda x stoich AFR); diesel stoichiometric AFR 14.5 (14.4-14.7 accepted)
  { id: 'KA-03', reg: 'GH-DEF-046', calc: 'diesel_smoke_limit', edit: { dsl_a: 500, dsl_l: 1.15 }, row: 'Smoke-Limited Fuel', want: 500 / (1.15 * 14.55), tol: 0.35, why: '500 / (1.15 x 14.5) = 30.0 lb/min' },
  { id: 'KA-04', reg: 'GH-DEF-046', calc: 'diesel_smoke_limit', edit: { dsl_a: 60, dsl_l: 1.3 }, row: 'Smoke-Limited Fuel', want: 60 / (1.3 * 14.55), tol: 0.06, why: '60 / (1.3 x 14.5) = 3.18 lb/min' },
  // RC-03 / GH-DEF-047 piston_position — slider-crank
  { id: 'KA-05', reg: 'GH-DEF-047', calc: 'piston_position', edit: { str6: 3.75, rl2: 6.76, ang: 90 }, row: 'Piston Position', want: pistonX(3.75, 6.76, 90), tol: 0.001, why: 'x(90 deg) = 2.1402 in' },
  { id: 'KA-06', reg: 'GH-DEF-047', calc: 'piston_position', edit: { str6: 3.75, rl2: 6.76, ang: 0 }, row: 'Piston Position', want: 0, tol: 0.001, why: 'at TDC the piston is 0 in from TDC' },
  { id: 'KA-07', reg: 'GH-DEF-047', calc: 'piston_position', edit: { str6: 4.0, rl2: 6.0, ang: 60 }, row: 'Piston Position', want: pistonX(4, 6, 60), tol: 0.001, why: 'x(60 deg) = 1.2554 in' },
  { id: 'KA-08', reg: 'GH-DEF-047', calc: 'piston_position', edit: { str6: 3.75, rl2: 6.76, ang: 180 }, row: 'Piston Position', want: 3.75, tol: 0.001, why: 'at BDC the piston is one full stroke from TDC' },
  // RC-04 / GH-DEF-048 cranking_compression — IVC is degrees ABDC; P = atm x CRe^gamma with the page's gamma
  { id: 'KA-09', reg: 'GH-DEF-048', calc: 'cranking_compression', edit: { scr3: 10.5, cc_rod: 6.0, cc_stroke: 3.75, cc_ivc: 40, cc_atm: 14.7, cc_gamma: 1.32 }, row: 'Effective Compression Ratio', want: dynCR(10.5, 6, 3.75, 40), tol: 0.006, why: 'CRe = 9.699' },
  { id: 'KA-10', reg: 'GH-DEF-048', calc: 'cranking_compression', edit: { scr3: 10.5, cc_rod: 6.0, cc_stroke: 3.75, cc_ivc: 40, cc_atm: 14.7, cc_gamma: 1.32 }, row: 'Estimated Cranking Pressure', want: 14.7 * Math.pow(dynCR(10.5, 6, 3.75, 40), 1.32), tol: 1.0, why: 'P = 14.7 x 9.699^1.32 = 295 psi' },
  { id: 'KA-11', reg: 'GH-DEF-048', calc: 'cranking_compression', edit: { scr3: 9.5, cc_rod: 6.5, cc_stroke: 4.0, cc_ivc: 60, cc_atm: 14.7, cc_gamma: 1.32 }, row: 'Effective Compression Ratio', want: dynCR(9.5, 6.5, 4.0, 60), tol: 0.006, why: 'CRe = 7.874' },
  { id: 'KA-12', reg: 'GH-DEF-048', calc: 'cranking_compression', edit: { scr3: 9.5, cc_rod: 6.5, cc_stroke: 4.0, cc_ivc: 60, cc_atm: 14.7, cc_gamma: 1.32 }, row: 'Estimated Cranking Pressure', want: 14.7 * Math.pow(dynCR(9.5, 6.5, 4.0, 60), 1.32), tol: 1.0, why: 'P = 224 psi' },
  // RC-05 / GH-DEF-049 ct_sway_bar — roll stiffness per degree; Track Width must matter
  { id: 'KA-13', reg: 'GH-DEF-049', calc: 'ct_sway_bar', edit: { sb_arm: 6, sb_wire: 0.875, sb_len: 18, tw_sb: 60 }, row: 'Roll Stiffness Added', want: swayRollPerDeg(11.5e6, 0.875, 18, 6, 60), tol: 0.005 * 64170, conv: 'end links at the track width (motion ratio 1)', why: 'K = k_bar T^2 pi/180 = 64,170 lb-in/deg' },
  { id: 'KA-14', reg: 'GH-DEF-049', kind: 'prop', calc: 'ct_sway_bar', why: 'convention-free: roll stiffness must change when Track Width changes (40 in vs 80 in)', fn: async (h) => { const a = await h.rowAt('ct_sway_bar', { tw_sb: 40 }, 'Roll Stiffness Added'); const b = await h.rowAt('ct_sway_bar', { tw_sb: 80 }, 'Roll Stiffness Added'); return (Number.isFinite(a) && Number.isFinite(b) && Math.abs(b - a) > 1) ? null : `track 40 in gives ${a}, track 80 in gives ${b}: Track Width has no effect`; } },
  // RC-06 / GH-DEF-050 wet_bulb — Stull 2011 needs degC
  { id: 'KA-15', reg: 'GH-DEF-050', calc: 'wet_bulb', edit: { temp_wb: 85, rh_wb: 50 }, row: 'Wet Bulb', want: wetBulbF(85, 50), tol: 0.15, why: 'Tw = 71.3 F' },
  { id: 'KA-16', reg: 'GH-DEF-050', calc: 'wet_bulb', edit: { temp_wb: 110, rh_wb: 10 }, row: 'Wet Bulb', want: wetBulbF(110, 10), tol: 0.15, why: 'Tw = 68.8 F (the defect gives 58.9 F)' },
  { id: 'KA-17', reg: 'GH-DEF-050', calc: 'wet_bulb', edit: { temp_wb: 60, rh_wb: 30 }, row: 'Wet Bulb', want: wetBulbF(60, 30), tol: 0.15, why: 'Tw at 60 F / 30 %' },
  // RC-07 / GH-DEF-051 bolt_pattern — the page's own rule: even lug counts measured across opposite studs (PCD = measurement), odd counts adjacent
  { id: 'KA-18', reg: 'GH-DEF-051', calc: 'bolt_pattern', edit: { lugs: 4, meas: 4.5 }, row: 'Bolt Circle', want: 4.5, tol: 0.002, why: '4-lug opposite studs: PCD = 4.500 in' },
  { id: 'KA-19', reg: 'GH-DEF-051', calc: 'bolt_pattern', edit: { lugs: 8, meas: 6.5 }, row: 'Bolt Circle', want: 6.5, tol: 0.002, why: '8-lug opposite studs: PCD = 6.500 in' },
  { id: 'KA-20', reg: 'GH-DEF-051', calc: 'bolt_pattern', edit: { lugs: 10, meas: 3.0 }, row: 'Bolt Circle', want: 3.0, tol: 0.002, why: '10-lug (fallback branch) opposite studs: PCD = 3.000 in' },
  { id: 'KA-C1', reg: null, calc: 'bolt_pattern', edit: { lugs: 5, meas: 4.5 }, row: 'Bolt Circle', want: 4.5 / Math.sin(Math.PI / 5), tol: 0.002, why: 'control (correct today): 5-lug adjacent studs, PCD = 7.656 in' },
  { id: 'KA-C2', reg: null, calc: 'bolt_pattern', edit: { lugs: 6, meas: 5.5 }, row: 'Bolt Circle', want: 5.5, tol: 0.002, why: 'control (correct today): 6-lug opposite studs, PCD = 5.500 in' },
  // RC-08 / GH-DEF-052 ackermann_angle — needs a track-width input; R to the vehicle centreline (provisional, D7)
  { id: 'KA-21', reg: 'GH-DEF-052', calc: 'ackermann_angle', edit: { aa_l: 108, aa_r: 300, aa_t: 60 }, row: 'Inside Steering Angle', want: Math.atan(108 / (300 - 30)) * R2D, tol: 0.05, conv: 'R measured to the vehicle centreline; track width as an input (D7)', why: 'atan(108 / (300 - 60/2)) = 21.80 deg' },
  // RC-09 / GH-DEF-053 fuel_line_loss — relative roughness in consistent units
  { id: 'KA-22', reg: 'GH-DEF-053', calc: 'fuel_line_loss', edit: { flow_gph: 50, line_len: 10, line_id: 0.375, fuel_sg: 0.74, fuel_visc: 0.6, fuel_rough: 0.00006 }, row: 'Darcy Friction Factor', want: fuelLine(50, 10, 0.375, 0.00006, 0.74, 0.6).f, tol: 0.0006, why: 'f = 0.0325 (the defect gives 0.0408)' },
  { id: 'KA-23', reg: 'GH-DEF-053', calc: 'fuel_line_loss', edit: { flow_gph: 300, line_len: 20, line_id: 0.5, fuel_sg: 0.74, fuel_visc: 0.6, fuel_rough: 0.00006 }, row: 'Pressure Drop', want: fuelLine(300, 20, 0.5, 0.00006, 0.74, 0.6).psi, tol: 0.02 * 3.575, why: 'dP = 3.58 psi (the defect gives 5.2 psi)' },
  // RC-10 / GH-DEF-054 simulator air density — convention-free physical bounds and one direct value
  { id: 'KA-24', reg: 'GH-DEF-054', kind: 'sim', calc: 'sim_top_speed', edit: {}, row: 'Estimated Top Speed', max: powerLimitedTopMph(SIM), why: 'no gearing can exceed the speed where drag + rolling absorb the peak wheel power (~174.3 mph)' },
  { id: 'KA-25', reg: 'GH-DEF-054', kind: 'sim', calc: 'sim_dragstrip', edit: {}, row: 'Trap Speed', max: powerBound({ ...SIM, toFt: 1320 }).mph, why: 'power-limited upper bound on trap speed at 1,320 ft (~115.7 mph)' },
  { id: 'KA-26', reg: 'GH-DEF-054', kind: 'sim', calc: 'sim_acceleration', edit: { sim_target: 130 }, row: 'Target Time', min: powerBound({ ...SIM, toMph: 130 }).t, why: 'power-limited lower bound on 0-130 mph time (~15.27 s)' },
  { id: 'KA-27', reg: 'GH-DEF-054', kind: 'sim', calc: 'sim_cornering', edit: {}, row: 'Aero Downforce', want: 0.5 * RHO_SL * 1.2 * 22 * Math.pow(60 * MPH, 2), tol: 2, why: 'L = 1/2 rho Cl A v^2 = 243 lbf at 60 mph, Cl 1.2, A 22 ft^2' },
  // RC-14 / GH-DEF-055 hidden cam advance — what the page shows must be self-consistent: LSA = (ICL + ECL) / 2 with the ICL on the page
  { id: 'KA-28', reg: 'GH-DEF-055', calc: 'camshaft_exhaust_events', edit: { cam_d050_e: 230, cam_lsa: 110, cam_icl: 110 }, row: 'Exhaust Centerline', want: 2 * 110 - 110, tol: 0.5, why: 'ECL = 2 x LSA - ICL = 110 deg BTDC with the values shown on the page' },
  { id: 'KA-29', reg: 'GH-DEF-055', calc: 'camshaft_exhaust_events', edit: { cam_d050_e: 230, cam_lsa: 110, cam_icl: 110 }, row: 'EVC', want: 230 / 2 - 110, tol: 0.5, why: 'EVC = dur/2 - ECL = 5 deg ATDC' },
  // RC-17 / GH-DEF-056 e85_blend remove/replace — volume of fuel to drain and replace with ethanol-free gasoline (provisional: replacement fuel E0)
  { id: 'KA-30', reg: 'GH-DEF-056', calc: 'e85_blend', edit: { tank_gal: 16, cur_e: 60, target_e: 30, e85_pct: 75 }, row: 'Fuel to Remove', want: 16 * (60 - 30) / 60, tol: 0.02, conv: 'replacement fuel is E0 gasoline', why: 'drain 16 x (60 - 30)/60 = 8.00 gal, refill with E0' },
  // RC-19 / GH-DEF-057 rc_fuel_stint — 3.6 gal at 0.12 gal/lap is 30 laps
  { id: 'KA-31', reg: 'GH-DEF-057', calc: 'rc_fuel_stint', edit: { laps_rc2: 30, fuel_lap2: 0.12, safety: 0.5 }, row: 'Max Green Laps', want: 30, tol: 0, why: '3.60 gal / 0.12 gal per lap = 30 laps exactly' },
  // SYS-01 / GH-DEF-058 silent fallback — a required box left empty (or holding text) must not produce a number
  ...[['piston_position', 'str6'], ['diesel_power_from_fuel', 'dpf_fuel'], ['ct_sway_bar', 'sb_wire'], ['wet_bulb', 'temp_wb'], ['fuel_line_loss', 'flow_gph'], ['cranking_compression', 'cc_ivc'], ['bolt_pattern', 'meas'], ['hp_trap_speed', 'wt2']]
    .map(([calc, fld], i) => ({ id: 'KA-' + (32 + i), reg: 'GH-DEF-058', kind: 'blank', calc, field: fld, value: '', why: `${calc}: ${fld} left empty must give no number` })),
  { id: 'KA-40', reg: 'GH-DEF-058', kind: 'blank', calc: 'piston_position', field: 'rl2', value: 'abc', why: 'piston_position: rod length "abc" must give no number' },
  { id: 'KA-C3', reg: null, kind: 'blank', calc: 'driveshaft_torque_capacity', field: 'dtc_od', value: '', why: 'control (correct today): driveshaft_torque_capacity reads through certValue and shows "—"' },
  { id: 'KA-C4', reg: null, kind: 'blank', calc: 'diesel_smoke_limit', field: 'dsl_a', value: '', why: 'control (correct today): diesel_smoke_limit reads through certValue and shows "—"' },
  // SYS-02 / GH-DEF-059 plausibility — a shown result of 1e12 or more must carry a warning or be withheld
  ...[['ct_sway_bar', 'sb_wire'], ['coil_spring', 'd_s'], ['hp_trap_speed', 'trap2'], ['fuel_line_loss', 'flow_gph']]
    .map(([calc, fld], i) => ({ id: 'KA-' + (41 + i), reg: 'GH-DEF-059', kind: 'huge', calc, field: fld, value: '1000000000', why: `${calc}: ${fld} = 1e9 must not show an unwarned result of 1e12 or more` }))
];

/* the ledger (premium/tests/data/known-answer-open.json): cases failing today because of a registered, still-open defect */
const KNOWN_OPEN = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'known-answer-open.json'), 'utf8')).open;

if (process.env.KA_LIST) { process.stdout.write(JSON.stringify({ ids: CASES.map(c => c.id) }) + '\n'); process.exit(0); }

(async () => {
  const strict = !!process.env.KA_STRICT;
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  const ENGINE = 'file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124));

  /* every case starts from a freshly loaded page, so no remembered value or shared simulator state leaks between cases */
  const fresh = async (calc) => {
    await page.goto(ENGINE, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(i => { if (typeof UNIT !== 'undefined' && UNIT.system !== 'imperial') setUnit('imperial'); renderCalc(i, false); }, calc);
    await page.waitForTimeout(120);
  };
  const missingFields = async (ids) => page.evaluate(list => list.filter(i => !document.getElementById(i)), ids);
  const type = async (id, v) => { await page.fill('#' + id, String(v)); await page.dispatchEvent('#' + id, 'input'); await page.waitForTimeout(20); };
  const rows = () => page.evaluate(() => {
    const out = [], t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    const own = v => [...v.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    document.querySelectorAll('#calc-container .result-box').forEach(b => { const v = b.querySelector('.result-value'); if (v) out.push({ label: t(b.querySelector('.result-label')), val: own(v) || t(v) }); });
    document.querySelectorAll('#calc-container .mini-result').forEach(b => { const v = b.querySelector('.value'); if (v) out.push({ label: t(b.querySelector('.label')), val: own(v) || t(v) }); });
    document.querySelectorAll('#calc-container .sim-stat').forEach(s => { if (s.children[0] && s.children[1]) out.push({ label: t(s.children[0]), val: t(s.children[1]) }); });
    return out;
  });
  const warnings = () => page.evaluate(() => document.querySelectorAll('#calc-container .field-warning-text, #calc-container .gh-invalid-result').length);
  const pick = (rs, label) => rs.find(r => r.label.toLowerCase().includes(label.toLowerCase()));
  const valueOf = s => parseShown(String(s).replace(/[^0-9eE+\-.,~−–]/g, ' ').trim().split(/\s+/)[0]);
  const h = {
    rowAt: async (calc, edit, label) => { await fresh(calc); for (const [k, v] of Object.entries(edit)) await type(k, v); const r = pick(await rows(), label); return r ? valueOf(r.val) : NaN; }
  };

  const results = [];
  for (const c of CASES) {
    let fail = null;
    try {
      if (c.kind === 'prop') fail = await c.fn(h);
      else {
        await fresh(c.calc);
        const needed = c.kind === 'blank' || c.kind === 'huge' ? [c.field] : Object.keys(c.edit || {});
        const miss = await missingFields(needed);
        if (miss.length) fail = `field id(s) not on the page: ${miss.join(', ')} (the calculator cannot take this input)`;
        else if (c.kind === 'blank' || c.kind === 'huge') {
          const w0 = await warnings();
          await type(c.field, c.value);
          const rs = await rows(), nums = rs.map(r => valueOf(r.val)).filter(Number.isFinite), w1 = await warnings();
          if (c.kind === 'blank') fail = nums.length ? `shows ${nums.length} numeric result(s) (${rs.filter(r => Number.isFinite(valueOf(r.val))).slice(0, 2).map(r => r.label + ' ' + r.val).join('; ')}) from a ${c.value === '' ? 'blank' : 'non-numeric'} required input` : null;
          else { const big = rs.filter(r => Math.abs(valueOf(r.val)) >= 1e12); fail = big.length && w1 <= w0 ? `shows ${big[0].label} = ${big[0].val} with no warning` : null; }
        } else {
          for (const [k, v] of Object.entries(c.edit || {})) await type(k, v);
          const rs = await rows(), r = pick(rs, c.row);
          if (!r) fail = `no row labelled "${c.row}" (rows: ${rs.map(x => x.label).join(' / ')})`;
          else {
            const got = valueOf(r.val);
            if (c.max !== undefined) fail = Number.isFinite(got) && got <= c.max ? null : `shows ${r.val}; physics allows at most ${c.max.toFixed(2)}`;
            else if (c.min !== undefined) fail = Number.isFinite(got) && got >= c.min ? null : `shows ${r.val}; physics needs at least ${c.min.toFixed(3)}`;
            else { const m = mismatch(got, c.want, c.tol); fail = m ? `shows ${r.val}, independent value ${+c.want.toFixed(5)} (${m})` : null; }
          }
        }
      }
    } catch (e) { fail = 'threw: ' + String(e && e.message || e).slice(0, 200); }
    results.push({ id: c.id, reg: c.reg, calc: c.calc, why: c.why, conv: c.conv || null, pass: !fail, detail: fail });
  }
  await browser.close();

  const failing = results.filter(r => !r.pass).map(r => r.id);
  const unexpected = failing.filter(id => strict || !KNOWN_OPEN[id]);
  const stale = strict ? [] : Object.keys(KNOWN_OPEN).filter(id => !failing.includes(id));
  for (const r of results) {
    const tag = r.pass ? (KNOWN_OPEN[r.id] && !strict ? 'STALE' : 'ok  ') : (KNOWN_OPEN[r.id] && !strict ? 'open' : 'FAIL');
    if (process.env.VERBOSE || tag === 'FAIL' || tag === 'STALE') console.log(`  ${tag} ${r.id} ${r.reg || 'control'} ${r.calc}: ${r.why}${r.conv ? ' [provisional convention: ' + r.conv + ']' : ''}${r.detail ? ' — ' + r.detail : ''}`);
  }
  stale.forEach(id => console.error(`  FAIL ${id} is in KNOWN_OPEN (${KNOWN_OPEN[id]}) but now passes: remove it from the ledger and update the register entry`));
  if (pageErrors.length) console.error('  page errors: ' + pageErrors.join(' | '));
  const complete = results.length === CASES.length && results.every((r, i) => r.id === CASES[i].id);
  if (process.env.KA_JSON) fs.writeFileSync(process.env.KA_JSON, JSON.stringify({ engine: ENGINE, strict, complete, caseIds: CASES.map(c => c.id), pageErrors, results }, null, 1));
  const known = failing.length - unexpected.length;
  console.log(`known-answer (Critical/High): ${results.length} cases, ${results.filter(r => r.pass).length} passed, ${failing.length} failed — ${known} of the ${Object.keys(KNOWN_OPEN).length} known-open failures present${strict ? ' (STRICT: ledger ignored)' : ''}, ${unexpected.length} unexpected failure(s), ${stale.length} stale ledger entr${stale.length === 1 ? 'y' : 'ies'}`);
  if (process.env.KA_REPORT) process.exit(complete && !pageErrors.length && process.env.KA_JSON ? 0 : 2);
  process.exit(unexpected.length || stale.length || pageErrors.length ? 1 : 0);
})().catch(e => { console.error('known-answer suite crashed: ' + (e && e.stack || e)); process.exit(3); });

