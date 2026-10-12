#!/usr/bin/env node
/* Gearhead Labs — temperature unit-layer regression tests for the F1.12.4 calculator engine.

   The problem this pins down: a temperature READING (200 °F) and a temperature DIFFERENCE (a 15 °F rise) convert differently.
   Reading:    °C = (°F - 32) x 5/9        (the 32 offset matters)
   Difference: Δ°C = Δ°F x 5/9            (no offset: 15 °F of rise is 8.33 °C of rise, never -9.44 °C)
   Until this test existed every difference field and result in the engine was declared with the reading unit '°F', so in Metric a 15 °F
   rise was shown as -9.4 °C and a 126 °F intercooler drop as 52.2 °C. The engine now has a separate 'Δ°F' unit (metric label 'Δ°C').

   What is checked, in a real Chromium page session (real clicks on the Metric / Imperial toggle, real typing into the real inputs):
     1. the unit functions themselves (known conversion points, zero stays zero, differences are consistent with readings);
     2. for each of the 25 calculators that have a temperature difference: the numbers shown in the inputs are read back from the DOM,
        converted to canonical values by definition (NOT through the engine's UNIT_DEFS), the calculator's documented physics is
        applied, and the result shown on the page must match in both unit systems, after the toggle, after re-entering each field,
        and after repeated toggles; a toggle must also leave every field's physical (canonical) value unchanged;
     3. a label guard: no field or result that is named like a difference (rise, drop, spread, margin, difference, LMTD, ...) may be
        declared with the reading unit '°F' anywhere in the catalogue;
     4. the Temperature Converter: its four rows (°F, °C, K, °R) are the converter's own answer and must read the same in Imperial and Metric.

   Independence rule: expected values come from the physical definitions written out below (NIST SP 811 / SI exact factors) and from
   each calculator's own documented formula, restated here in canonical units. The engine's unit tables are never consulted.

   Cases marked clean:false are only checked from Imperial defaults to Metric. There are none at present: five Free calculators (intercooler_temp_drop,
   thermal_expansion, heat_transfer, radiator_heat_capacity, temperature_rise) were exempt because they read a unit-bearing field through certValue() without its
   unit (the "Metric re-entry" class, GH-DEF-001), and were flipped to clean:true when that class was fixed in reliability pass item 1. Use clean:false again only
   for a calculator with a registered, still-open defect.

   Run: node premium/tests/temperature-units.test.js   (CASE=id,id limits cases; VERBOSE=1 prints passes; GH_ENGINE=path tests another copy;
          SKIP_GUARD=1 skips the whole-catalogue label guard, GUARD_ONLY=1 runs only the guard; ALL_CLEAN=1 also runs the clean:false cases through the full re-entry sequence)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* ---- physical definitions (exact SI / NIST SP 811 values; never read from the engine) ---- */
const D = {
  K0: 273.15,                         // 0 degC in kelvin
  lbf_N: 4.4482216152605,             // N per lbf (0.45359237 kg x 9.80665 m/s2)
  lb_kg: 0.45359237,
  mph_kmh: 1.609344, mph_ms: 0.44704,
  sqft_m2: 0.09290304, in_mm: 25.4, ft_m: 0.3048,
  ft3_L: 28.316846592,                // litres per cubic foot (CFM -> L/min)
  psi_bar: 0.0689475729317831,
  ftlbf_J: 1.3558179483314004,        // J per ft.lbf
  BTU_J: 1055.05585262,               // J per BTU (International Table)
  hp_W: 745.69987158227,
  F_per_K: 1.8
};
const C = c => c + D.K0;              // a Celsius reading as kelvin (edit values are written in kelvin)
const kToF = k => (k - D.K0) * 1.8 + 32;
/* unit kinds: display <-> canonical value, and the unit text the page must show */
const lin = (f, imp, met) => ({ toCanon: (s, x) => s === 'metric' ? x / f : x, fromCanon: (s, x) => s === 'metric' ? x * f : x, label: s => s === 'metric' ? met : imp });
const plain = unit => ({ toCanon: (s, x) => x, fromCanon: (s, x) => x, label: () => unit, plain: true });
const U = {
  plain: plain(null),
  tempAbs: { toCanon: (s, x) => s === 'metric' ? x + D.K0 : (x - 32) / 1.8 + D.K0, fromCanon: (s, k) => s === 'metric' ? k - D.K0 : (k - D.K0) * 1.8 + 32, label: s => s === 'metric' ? '°C' : '°F', temp: true },
  tempDelta: { toCanon: (s, x) => s === 'metric' ? x : x / 1.8, fromCanon: (s, k) => s === 'metric' ? k : k * 1.8, label: s => s === 'metric' ? 'Δ°C' : 'Δ°F', temp: true },
  weight_lb: lin(D.lbf_N, 'lb', 'N'),
  mass_lb: lin(D.lb_kg, 'lbs', 'kg'),        // a quantity of matter (rotor, tire, fuel mass): kg in Metric. Fixed in reliability pass 4b (GH-DEF-006); these boxes used to read newtons
  mph: lin(D.mph_kmh, 'mph', 'km/h'),
  sqft: lin(D.sqft_m2, 'sq ft', 'm²'),
  inch: lin(D.in_mm, 'in', 'mm'),
  lbhr: lin(D.lb_kg, 'lb/hr', 'kg/hr'),
  ftsec: lin(D.ft_m, 'ft/sec', 'm/s'),
  ftlb: lin(D.ftlbf_J, 'ft-lb', 'J'),
  psi: lin(D.psi_bar, 'psi', 'bar'),
  cfm: lin(D.ft3_L, 'CFM', 'L/min'),
  power: lin(D.hp_W / 1000, 'HP', 'kW')
};
const kind = k => k.startsWith('plain:') ? plain(k.slice(6)) : U[k];     // 'plain:BTU/hr' = unregistered unit, same number and text in both systems

/* ---- cases ----
   fields: [id, kind, edit value in canonical units]. compute(v, o): v = canonical input values read from the page; o(label, kind) = a displayed
   result converted to canonical (for identities such as "spread = temperature - dew point"). Returns {label: [kind, canonical value, extra tolerance in canonical units]}. */
const lmtd = (dt1, dt2) => Math.abs(dt1 - dt2) < 1e-9 ? dt1 : (dt1 - dt2) / Math.log(dt1 / dt2);    // counter-flow log-mean temperature difference
const sizing = (id, p, e) => ({
  id, clean: true,
  fields: [[p + '_thi', 'tempAbs', C(e.thi)], [p + '_tho', 'tempAbs', C(e.tho)], [p + '_tci', 'tempAbs', C(e.tci)], [p + '_tco', 'tempAbs', C(e.tco)], [p + '_q', 'plain', e.q], [p + '_u', 'plain', e.u]],
  compute: v => { const L = lmtd(v[p + '_thi'] - v[p + '_tco'], v[p + '_tho'] - v[p + '_tci']);
    return { 'Log-Mean Temperature Difference (LMTD)': ['tempDelta', L], 'Required Core Heat-Transfer Surface Area': ['sqft', v[p + '_q'] / (v[p + '_u'] * L * D.F_per_K)] }; }
});
const CASES = [
  /* --- declarative calculators (read every field through v()/vd(): complete in both systems) --- */
  ...['brake_rotor_temp', 'rotor_heat'].map(id => ({ id, clean: true,
    fields: [['wt_rt', 'weight_lb', 3000], ['spd_rt', 'mph', 70], ['rm', 'mass_lb', 14], ['cp_rotor', 'plain', 0.12], ['absorb_rotor', 'plain', 80]],
    compute: v => { const E = 0.5 * (v.wt_rt * D.lb_kg) * Math.pow(v.spd_rt * D.mph_ms, 2) * (v.absorb_rotor / 100) / D.BTU_J;     // kinetic energy of the vehicle, in BTU
      return { 'Energy to Rotor': ['plain:BTU', E], 'Temperature Rise': ['tempDelta', E / (v.rm * v.cp_rotor) / D.F_per_K, 0.03] }; } })),    // 0.03 K: the calculator rounds the rise to 0.1 °F
  { id: 'dew_point', clean: true, fields: [['temp_dp', 'tempAbs', C(30)], ['rh_dp', 'plain', 50]],
    compute: (v, o) => ({ 'Temp/Dew Spread': ['tempDelta', v.temp_dp - o('Dew Point', 'tempAbs'), 0.06] }) },      // identity only: spread = air temperature - dew point (both rounded to 0.1 °F by the calculator)
  { id: 'ct_tire_temp_balance', clean: true, fields: [['lf_t', 'tempAbs', C(90)], ['cf_t', 'tempAbs', C(95)], ['rf_t', 'tempAbs', C(105)], ['lr_t', 'tempAbs', C(85)], ['cr_t', 'tempAbs', C(92)], ['rr_t', 'tempAbs', C(100)]],
    compute: v => ({ 'F L/R Spread': ['tempDelta', v.rf_t - v.lf_t], 'R L/R Spread': ['tempDelta', v.rr_t - v.lr_t] }) },
  { id: 'diesel_turbo_pr', clean: true, fields: [['dt_boost', 'psi', 25], ['dt_amb', 'psi', 14], ['dt_in', 'tempAbs', C(30)], ['dt_charge', 'tempAbs', C(70)]],
    compute: v => ({ 'Pressure Ratio': ['plain:', (v.dt_boost + v.dt_amb) / v.dt_amb], 'Temperature Rise': ['tempDelta', v.dt_charge - v.dt_in] }) },
  /* --- Free calculators built on certValue() --- */
  { id: 'intercooler_temp_drop', clean: true, fields: [['itd_i', 'tempAbs', C(120)], ['itd_o', 'tempAbs', C(40)]],
    compute: v => ({ 'Temperature Drop': ['tempDelta', v.itd_i - v.itd_o] }) },
  { id: 'thermal_expansion', clean: true, fields: [['te_l', 'inch', 30], ['te_a', 'plain', 0.000012], ['te_d', 'tempDelta', 80]],
    compute: v => ({ 'Length Change': ['inch', v.te_l * v.te_a * v.te_d * D.F_per_K] }) },
  { id: 'heat_transfer', clean: true, fields: [['ht_h', 'plain', 6], ['ht_a', 'sqft', 18], ['ht_d', 'tempDelta', 70]],
    compute: v => ({ 'Heat Transfer Rate': ['plain:BTU/hr', v.ht_h * v.ht_a * v.ht_d * D.F_per_K] }) },
  { id: 'coolant_flow', clean: true, fields: [['cf_q', 'plain', 60000], ['cf_c', 'plain', 0.9], ['cf_d', 'tempDelta', 12]],
    compute: v => ({ 'Required Coolant Flow': ['lbhr', v.cf_q / (v.cf_c * v.cf_d * D.F_per_K)] }) },
  { id: 'radiator_heat_capacity', clean: true, fields: [['rhc_f', 'lbhr', 3500], ['rhc_c', 'plain', 0.9], ['rhc_d', 'tempDelta', 11]],
    compute: v => ({ 'Heat Rejection': ['plain:BTU/hr', v.rhc_f * v.rhc_c * v.rhc_d * D.F_per_K] }) },
  { id: 'hvac_cooling_load', clean: true, fields: [['hcl_v', 'plain', 120], ['hcl_ach', 'plain', 15], ['hcl_d', 'tempDelta', 25]],
    compute: v => ({ 'Approx. Cooling Load': ['plain:BTU/hr', v.hcl_v * v.hcl_ach * v.hcl_d * D.F_per_K * 0.018] }) },
  { id: 'temperature_rise', clean: true, fields: [['tr_q', 'plain', 600], ['tr_m', 'mass_lb', 14], ['tr_c', 'plain', 0.11]],
    compute: v => ({ 'Temperature Rise': ['tempDelta', v.tr_q / (v.tr_m * v.tr_c) / D.F_per_K] }) },
  /* --- Premium calculators (declare every unit-bearing field to certValue(): complete in both systems) --- */
  { id: 'fan_cfm_requirement', clean: true, fields: [['fcr_q', 'plain', 50000], ['fcr_dt', 'tempDelta', 9]],
    compute: v => ({ 'Required Fan Airflow': ['cfm', v.fcr_q / (1.08 * v.fcr_dt * D.F_per_K)] }) },
  sizing('intercooler_core_sizing', 'ics', { thi: 140, tho: 70, tci: 25, tco: 50, q: 50000, u: 20 }),
  sizing('oil_cooler_sizing', 'ocs', { thi: 125, tho: 95, tci: 25, tco: 45, q: 20000, u: 14 }),
  sizing('trans_cooler_sizing', 'tcs', { thi: 100, tho: 75, tci: 25, tco: 35, q: 14000, u: 13 }),
  sizing('radiator_core_sizing', 'rcs', { thi: 105, tho: 90, tci: 30, tco: 50, q: 70000, u: 27 }),
  { id: 'thermal_resistance_network', clean: true, fields: [['trn_k', 'plain', 30], ['trn_a', 'sqft', 1.5], ['trn_l', 'inch', 0.08], ['trn_h', 'plain', 6], ['trn_dt', 'tempDelta', 100]],
    compute: v => { const Rc = (v.trn_l / 12) / (v.trn_k * v.trn_a), Rv = 1 / (v.trn_h * v.trn_a), Rt = Rc + Rv;
      return { 'Conduction Resistance (R_cond)': ['plain:', Rc], 'Convection Resistance (R_conv)': ['plain:', Rv], 'Total Thermal Resistance (R_total)': ['plain:', Rt], 'Heat Transfer Rate': ['plain:BTU/hr', v.trn_dt * D.F_per_K / Rt] }; } },
  { id: 'conduction_heat_transfer', clean: true, fields: [['cht_k', 'plain', 0.2], ['cht_a', 'sqft', 1.0], ['cht_l', 'inch', 0.3], ['cht_dt', 'tempDelta', 60]],
    compute: v => ({ 'Heat Transfer Rate (Conduction)': ['plain:BTU/hr', v.cht_k * v.cht_a * v.cht_dt * D.F_per_K / (v.cht_l / 12)] }) },
  { id: 'convection_heat_transfer', clean: true, fields: [['cvh_v', 'ftsec', 6], ['cvh_d', 'inch', 0.8], ['cvh_nu', 'plain', 0.000012], ['cvh_k', 'plain', 0.35], ['cvh_pr', 'plain', 18], ['cvh_a', 'sqft', 1.4], ['cvh_dt', 'tempDelta', 15]],
    compute: v => { const Dft = v.cvh_d / 12, Re = v.cvh_v * Dft / v.cvh_nu, Nu = 0.023 * Math.pow(Re, 0.8) * Math.pow(v.cvh_pr, 0.4), h = Nu * v.cvh_k / Dft;    // Dittus-Boelter, as documented
      return { 'Reynolds Number': ['plain:', Re], 'Nusselt Number': ['plain:', Nu], 'Convective Coefficient (h)': ['plain:BTU/hr·ft²·°F', h], 'Heat Transfer Rate (Convection)': ['plain:BTU/hr', h * v.cvh_a * v.cvh_dt * D.F_per_K] }; } },
  { id: 'brake_fluid_boiling_margin', clean: true, fields: [['bfbm_bp', 'tempAbs', C(200)], ['bfbm_t', 'tempAbs', C(120)]],
    compute: v => ({ 'Boiling Margin': ['tempDelta', v.bfbm_bp - v.bfbm_t] }) },
  { id: 'brake_duct_cfm', clean: true, fields: [['bdc_q', 'plain', 30000], ['bdc_dt', 'tempDelta', 55]],
    compute: v => ({ 'Required Duct Airflow': ['cfm', v.bdc_q / (1.08 * v.bdc_dt * D.F_per_K)] }) },
  { id: 'rotor_cooling_rate', clean: true, fields: [['rcr_t0', 'tempAbs', C(260)], ['rcr_tamb', 'tempAbs', C(25)], ['rcr_m', 'mass_lb', 14], ['rcr_cp', 'plain', 0.12], ['rcr_h', 'plain', 18], ['rcr_a', 'sqft', 2.2], ['rcr_time', 'plain', 40]],
    compute: v => { const tau = v.rcr_m * v.rcr_cp * 3600 / (v.rcr_h * v.rcr_a), after = v.rcr_tamb + (v.rcr_t0 - v.rcr_tamb) * Math.exp(-v.rcr_time / tau);     // Newton cooling, lumped capacitance
      return { 'Cooling Time Constant (τ)': ['plain:sec', tau], 'Rotor Temp. After Interval': ['tempAbs', after], 'Temp. Drop': ['tempDelta', v.rcr_t0 - after] }; } },
  { id: 'brake_fade_prediction', clean: true, fields: [['bfp_e', 'ftlb', 220000], ['bfp_m', 'mass_lb', 14], ['bfp_cp', 'plain', 0.12], ['bfp_t0', 'tempAbs', C(40)], ['bfp_dt', 'plain', 25], ['bfp_tau', 'plain', 30], ['bfp_n', 'plain', 5], ['bfp_tamb', 'tempAbs', C(25)], ['bfp_thresh', 'tempAbs', C(260)]],
    compute: v => { const dT = (v.bfp_e * D.ftlbf_J / D.BTU_J) / (v.bfp_m * v.bfp_cp) / D.F_per_K;     // temperature gained per stop, in kelvin of difference
      let T = v.bfp_t0, peak = T; const n = Math.round(v.bfp_n);
      for (let i = 1; i <= n; i++) { T += dT; if (T > peak) peak = T; if (i < n) T = v.bfp_tamb + (T - v.bfp_tamb) * Math.exp(-v.bfp_dt / v.bfp_tau); }
      return { 'Peak Rotor Temperature': ['tempAbs', peak], 'Margin to Fade Threshold': ['tempDelta', v.bfp_thresh - peak] }; } },
  { id: 'tire_heat_generation', clean: true, fields: [['thg_w', 'weight_lb', 900], ['thg_c', 'plain', 0.013], ['thg_v', 'mph', 70], ['thg_m', 'mass_lb', 21], ['thg_cp', 'plain', 0.5], ['thg_t', 'plain', 25]],
    compute: v => { const P = (v.thg_w * D.lbf_N) * v.thg_c * (v.thg_v * D.mph_ms), E = P * v.thg_t * 60 / D.BTU_J;     // rolling-resistance power in watts, heat in BTU
      return { 'Heat Generation Rate': ['power', P / D.hp_W], 'Total Heat Energy': ['plain:BTU', E], 'Estimated Temp. Rise (adiabatic)': ['tempDelta', E / (v.thg_m * v.thg_cp) / D.F_per_K] }; } }
];
if (typeof module !== 'undefined') module.exports = { D, U, CASES };
if (require.main !== module) return;

/* ---- harness (real clicks on the real toggle; a fresh browser context per run so the stored unit system never leaks between runs) ---- */
let failures = 0, checks = 0, invariance = 0;
const log = [];
function fail(label, msg) { failures++; log.push(`  FAIL ${label}: ${msg}`); }
function decimals(txt) { const m = String(txt).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; }
const sig = x => Number(x.toPrecision(4));
async function type(page, id, text) { await page.click('#' + id); await page.fill('#' + id, String(text)); await page.waitForTimeout(30); }
async function readInputs(page, fields) {
  return page.evaluate(ids => ids.map(id => { const e = document.getElementById(id); return e ? { v: e.value, u: (e.closest('.input-wrap') && e.closest('.input-wrap').querySelector('.field-unit') || {}).textContent || '' } : null; }), fields.map(f => f[0]));
}
async function readResults(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#calc-container .result-box').forEach(b => { const l = b.querySelector('.result-label'), v = b.querySelector('.result-value'), u = b.querySelector('.result-unit');
      if (l && v) out.push({ label: l.textContent.trim(), text: (v.textContent || '').replace(u ? u.textContent : '', '').replace('~', '').trim(), unit: u ? u.textContent.trim() : '' }); });
    document.querySelectorAll('#calc-container .mini-result').forEach(b => { const l = b.querySelector('.label'), v = b.querySelector('.value'), u = b.querySelector('.unit');
      if (l && v) out.push({ label: l.textContent.trim(), text: (v.textContent || '').replace(u ? u.textContent : '', '').trim(), unit: u ? u.textContent.trim() : '' }); });
    return out;
  });
}
async function canonicalFields(page, c, sys) {
  const shown = await readInputs(page, c.fields); const m = {};
  c.fields.forEach((f, i) => { m[f[0]] = shown[i] && Number.isFinite(Number(shown[i].v)) ? U[f[1]].toCanon(sys, Number(shown[i].v)) : NaN; });
  return { m, shown };
}
/* the page against the physics, using the numbers actually shown in the inputs */
async function verify(page, c, sys, step) {
  const label0 = `${c.id} [${sys}] ${step}`;
  const { m: v, shown } = await canonicalFields(page, c, sys);
  if (Object.values(v).some(x => !Number.isFinite(x))) { fail(label0, `inputs unreadable: ${JSON.stringify(shown)}`); return v; }
  /* the unit label printed next to each temperature input must match the system (reading vs difference) */
  c.fields.forEach((f, i) => { const k = U[f[1]]; if (k.temp && shown[i].u.trim() !== k.label(sys)) fail(label0, `${f[0]} shows unit "${shown[i].u.trim()}", expected "${k.label(sys)}"`); });
  const res = await readResults(page);
  const o = (label, k) => { const r = res.find(x => x.label === label); return r ? kind(k).toCanon(sys, Number(r.text.replace(/,/g, ''))) : NaN; };
  const exp = c.compute(v, o);
  for (const [label, spec] of Object.entries(exp)) {
    const [k, want, extra = 0] = spec, K = kind(k); checks++;
    const r = res.find(x => x.label === label);
    if (!r) { fail(label0, `no result "${label}" (page shows: ${res.map(x => x.label).join(', ') || 'validation error'})`); continue; }
    const got = Number(r.text.replace(/,/g, '')), wantDisp = K.fromCanon(sys, want);
    const scale = Math.abs(K.fromCanon(sys, 1) - K.fromCanon(sys, 0));
    const tol = 0.5 * Math.pow(10, -decimals(r.text)) + 1e-4 * Math.abs(wantDisp) + extra * scale;
    const wantUnit = K.plain ? K.label() : K.label(sys);
    if (!Number.isFinite(got) || Math.abs(got - wantDisp) > tol) fail(label0, `${label}: page ${r.text} ${r.unit}, expected ${wantDisp.toPrecision(7)} ${wantUnit} (inputs shown ${shown.map(s => s.v).join(' / ')})`);
    else if (r.unit !== wantUnit) fail(label0, `${label}: unit "${r.unit}" expected "${wantUnit}"`);
    else log.push(`  ok   ${label0} ${label} ${r.text} ${r.unit}`);
  }
  return v;
}
/* a toggle changes only the display: every field must keep the same physical value */
function sameCanon(a, b, label) {
  for (const id of Object.keys(a)) { invariance++;
    const x = a[id], y = b[id], tol = 2e-5 * Math.max(Math.abs(x), Math.abs(y)) + 1e-12;
    if (!Number.isFinite(y) || Math.abs(x - y) > tol) fail(label, `${id} changed physical value across the toggle: ${x} -> ${y}`); }
}

/* ---- 1. unit functions: known conversion points, written from the definitions ---- */
async function unitFunctionChecks(page) {
  const r = await page.evaluate(() => {
    const t = (v, u, sys) => canonicalToUnit(v, u, sys), f = (v, u, sys) => unitToCanonical(v, u, sys); const out = {};
    out.d15 = t(15, 'Δ°F', 'metric'); out.d0 = t(0, 'Δ°F', 'metric'); out.d90 = t(90, 'Δ°F', 'metric'); out.dneg = t(-9, 'Δ°F', 'metric');
    out.d15back = f(25 / 3, 'Δ°F', 'metric'); out.dimp = t(15, 'Δ°F', 'imperial');
    out.a32 = t(32, '°F', 'metric'); out.a212 = t(212, '°F', 'metric'); out.am40 = t(-40, '°F', 'metric'); out.a75 = t(75, '°F', 'metric'); out.a100back = f(100, '°F', 'metric');
    out.aliasC = canonicalUnit('Δ°C'); out.aliasF = canonicalUnit('Δ°F'); out.aliasAbs = canonicalUnit('°C');
    UNIT.system = 'metric'; out.labelD = metricUnit('Δ°F'); out.labelA = metricUnit('°F'); UNIT.system = 'imperial'; out.labelDi = metricUnit('Δ°F');
    out.consistency = [[212, 32], [300, 85], [75, 75], [-4, 20]].map(([a, b]) => [t(a, '°F', 'metric') - t(b, '°F', 'metric'), t(a - b, 'Δ°F', 'metric')]);
    return out;
  });
  const near = (name, got, want, tol = 1e-9) => { checks++; if (!Number.isFinite(got) || Math.abs(got - want) > tol) fail('unit functions', `${name}: got ${got}, expected ${want}`); else log.push(`  ok   unit functions ${name} = ${got}`); };
  near('15 Δ°F -> Δ°C (= 25/3)', r.d15, 25 / 3); near('0 Δ°F -> 0 Δ°C (no offset)', r.d0, 0); near('90 Δ°F -> 50 Δ°C', r.d90, 50); near('-9 Δ°F -> -5 Δ°C', r.dneg, -5);
  near('25/3 Δ°C -> 15 Δ°F', r.d15back, 15); near('Δ°F stays as typed in Imperial', r.dimp, 15);
  near('32 °F -> 0 °C (reading keeps its offset)', r.a32, 0); near('212 °F -> 100 °C', r.a212, 100); near('-40 °F -> -40 °C', r.am40, -40); near('75 °F -> 23.8889 °C', r.a75, 23.88888888888889, 1e-9); near('100 °C -> 212 °F', r.a100back, 212);
  r.consistency.forEach((p, i) => near(`difference of two converted readings == converted difference (pair ${i + 1})`, p[0], p[1]));
  [['canonicalUnit("Δ°C")', r.aliasC, 'Δ°F'], ['canonicalUnit("Δ°F")', r.aliasF, 'Δ°F'], ['canonicalUnit("°C") (reading alias unchanged)', r.aliasAbs, '°F'], ['metric label of Δ°F', r.labelD, 'Δ°C'], ['metric label of °F', r.labelA, '°C'], ['imperial label of Δ°F', r.labelDi, 'Δ°F']]
    .forEach(([n, g, w]) => { checks++; if (g !== w) fail('unit functions', `${n}: got "${g}", expected "${w}"`); else log.push(`  ok   unit functions ${n} = ${g}`); });
}

/* ---- 4. Temperature Converter: known conversion points from the definitions (rows are rounded to 0.01 by the calculator) ---- */
const CONVERTER_POINTS = [      // [from, input, {°F, °C, K, °R}]
  ['F', 70, { F: 70, C: 21.1111, K: 294.2611, R: 529.67 }],
  ['F', 212, { F: 212, C: 100, K: 373.15, R: 671.67 }],
  ['F', -40, { F: -40, C: -40, K: 233.15, R: 419.67 }],
  ['C', 0, { F: 32, C: 0, K: 273.15, R: 491.67 }],
  ['C', 100, { F: 212, C: 100, K: 373.15, R: 671.67 }],
  ['C', -17.7778, { F: 0, C: -17.7778, K: 255.3722, R: 459.67 }],
  ['K', 300, { F: 80.33, C: 26.85, K: 300, R: 540 }],
  ['K', 273.15, { F: 32, C: 0, K: 273.15, R: 491.67 }]
];
async function converterChecks(browser, url, newPage) {
  for (const sys of ['imperial', 'metric']) {
    const { ctx, page } = await newPage();
    try {
      await page.evaluate(() => { setUnit('imperial'); renderCalc('temp_converter', false); });
      if (sys === 'metric') await page.click('#btn-metric');
      for (const [from, input, want] of CONVERTER_POINTS) {
        await page.selectOption('#t_from', from); await type(page, 't_in', input);
        const res = await readResults(page); const label0 = `temp_converter [${sys}] ${input} from ${from}`;
        for (const [sym, row] of [['F', '°F'], ['C', '°C'], ['K', 'K'], ['R', '°R']]) {
          checks++; const r = res.find(x => x.label === row);
          if (!r) { fail(label0, `no row "${row}"`); continue; }
          const got = Number(r.text.replace(/,/g, ''));
          if (!Number.isFinite(got) || Math.abs(got - want[sym]) > 0.011 + 1e-5 * Math.abs(want[sym])) fail(label0, `${row}: page ${r.text} ${r.unit}, expected ${want[sym]} ${row}`);
          else if (r.unit !== row) fail(label0, `${row}: unit "${r.unit}" expected "${row}"`);
          else log.push(`  ok   ${label0} ${row} ${r.text} ${r.unit}`);
        }
      }
    } catch (e) { fail(`temp_converter [${sys}]`, 'test error: ' + String(e.message || e).split('\n')[0]); }
    finally { await ctx.close(); }
  }
}

/* ---- 3. label guard: a name that says "difference" must never carry the reading unit '°F' ---- */
const DIFFERENCE_WORDS = /\b(rise|drop|spread|margin|differen\w*|delta|lmtd|swing|gain|change)\b|Δ/i;
const ABSOLUTE_OK = new Set([]);                       // "calcId:label" of an audited reading whose name merely looks like a difference
async function labelGuard(page) {
  const rows = await page.evaluate(() => {
    UNIT.system = 'imperial'; const out = [];
    for (const c of CALCS.filter(c => c.id !== 'dashboard')) {
      try { try { delete CALC_PERSISTENT_STATE[c.id]; } catch (e) {} renderCalc(c.id, false); } catch (e) { continue; }
      document.querySelectorAll('#calc-container .field-input[data-ghm-unit="°F"]').forEach(e => out.push({ c: c.id, kind: 'field', label: ((e.closest('.field') || {}).querySelector && e.closest('.field').querySelector('.field-label') ? e.closest('.field').querySelector('.field-label').textContent : '').trim() }));
      document.querySelectorAll('#calc-container .result-box').forEach(b => { const u = b.querySelector('.result-unit'); if (u && u.textContent.trim() === '°F') out.push({ c: c.id, kind: 'result', label: (b.querySelector('.result-label') || {}).textContent.trim() }); });
      document.querySelectorAll('#calc-container .mini-result').forEach(b => { const u = b.querySelector('.unit'); if (u && u.textContent.trim() === '°F') out.push({ c: c.id, kind: 'result', label: (b.querySelector('.label') || {}).textContent.trim() }); });
    }
    return out;
  });
  checks++;
  const bad = rows.filter(r => DIFFERENCE_WORDS.test(r.label) && !ABSOLUTE_OK.has(r.c + ':' + r.label));
  if (bad.length) bad.forEach(b => fail('label guard', `${b.c} ${b.kind} "${b.label}" is named like a temperature difference but uses the reading unit '°F' (use 'Δ°F', or add "${b.c}:${b.label}" to ABSOLUTE_OK if it really is a reading)`));
  else log.push(`  ok   label guard: ${rows.length} °F fields/results across the catalogue, none named like a difference`);
}

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const pageErrors = [];
  const only = process.env.CASE ? process.env.CASE.split(',') : null;
  const url = 'file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124));
  const other = s => s === 'metric' ? 'imperial' : 'metric';
  const fresh = async () => { const ctx = await browser.newContext(); const page = await ctx.newPage(); page.setDefaultTimeout(8000); page.on('pageerror', e => pageErrors.push(String(e))); await page.goto(url, { waitUntil: 'load', timeout: 60000 }); return { ctx, page }; };

  const guardOnly = !!process.env.GUARD_ONLY;
  if (!only && !guardOnly) { const { ctx, page } = await fresh(); try { await unitFunctionChecks(page); } catch (e) { fail('unit functions', 'test error: ' + String(e.message || e).split('\n')[0]); } await ctx.close(); }
  for (const c of CASES) {
    if (guardOnly || (only && !only.includes(c.id))) continue;
    const full = c.clean || !!process.env.ALL_CLEAN;
    for (const start of full ? ['imperial', 'metric'] : ['imperial']) {
      let ctx;
      try {
        const f = await fresh(); ctx = f.ctx; const page = f.page;
        await page.evaluate(id => { setUnit('imperial'); renderCalc(id, false); }, c.id);
        let sys = 'imperial';
        let prev = await verify(page, c, sys, 'defaults');
        const flip = async step => { const before = (await canonicalFields(page, c, sys)).m; sys = other(sys); await page.click('#btn-' + sys); const after = await verify(page, c, sys, step); sameCanon(before, (await canonicalFields(page, c, sys)).m, `${c.id} [${sys}] ${step}`); return after; };
        if (start === 'metric' || !full) await flip('after toggle to Metric');
        if (full) {
          /* re-entry: type a new value into each field in turn (display units of the current system), verify after each */
          for (const fl of c.fields) { await type(page, fl[0], sig(U[fl[1]].fromCanon(sys, fl[2]))); await verify(page, c, sys, `edit ${fl[0]}`); }
          /* toggle to the other system and back, with an edit in between; repeat toggles must not drift */
          await flip(`toggle to ${other(sys)}`);
          const last = c.fields[c.fields.length - 1], wig = last[1] === 'tempAbs' ? last[2] - 2 : last[2] * 0.9;
          await type(page, last[0], sig(U[last[1]].fromCanon(sys, wig))); await verify(page, c, sys, `edit ${last[0]} after toggle`);
          for (let i = 0; i < 3; i++) await flip(`repeat toggle ${i + 1} to ${other(sys)}`);
        }
      } catch (e) { fail(`${c.id} [start ${start}]`, 'test error: ' + String(e.message || e).split('\n')[0]); }
      finally { if (ctx) await ctx.close(); }
    }
  }
  if (!guardOnly && (!only || only.includes('temp_converter'))) await converterChecks(browser, url, fresh);
  if ((!only || guardOnly) && !process.env.SKIP_GUARD) { const { ctx, page } = await fresh(); try { await labelGuard(page); } catch (e) { fail('label guard', 'test error: ' + String(e.message || e).split('\n')[0]); } await ctx.close(); }
  await browser.close();
  console.log(log.filter(l => /FAIL/.test(l) || process.env.VERBOSE).join('\n'));
  if (pageErrors.length) { failures++; console.log('PAGE ERRORS:\n' + pageErrors.join('\n')); }
  const deferred = process.env.ALL_CLEAN ? [] : CASES.filter(c => !c.clean).map(c => c.id);
  console.log(`\ntemperature-units tests: ${checks} result/unit checks, ${invariance} toggle-invariance checks, ${failures} failure(s); ${deferred.length ? `${deferred.length} case(s) checked Imperial->Metric only (clean:false, registered open defect): ${deferred.join(', ')}` : 'every case ran the full re-entry / toggle sequence in both starting systems'}`);
  process.exit(failures ? 1 : 0);
})();
