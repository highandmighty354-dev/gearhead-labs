#!/usr/bin/env node
/* Gearhead Labs — GH-IMP-018: validation messages quote the limits in the unit the boxes show.

   WHAT WAS WRONG. The "Validation required" text of the Batch 9–14 calculators was a fixed Imperial string ("Weight must be 0–20,000 lb, coefficient
   0–0.05, and speed 0–250 mph."). In Metric the boxes read kg, mm, km/h, bar, °C, MPa ... and the message still quoted lb, in, mph, psi, °F, ksi. The
   limits themselves were and are checked on the box's canonical (Imperial) value, so only the wording was wrong. The same held for a power or torque
   box shown in another unit by the Power / Torque preference (a kW box shown in hp, a lb-ft box shown in N·m).

   THE FIX (engine): unitLimit(id, unit, imp, dir, frag) writes one limit in the unit its box shows. Imperial text is returned unchanged; a converted
   limit is rounded to 4 significant figures toward the inside of the range, so the number shown is accepted when typed. The validation conditions
   are not touched.

   INDEPENDENT REFERENCES (nothing taken from the engine): the conversion factors below (exact definitions: 1 lb = 0.45359237 kg, 1 lbf =
   4.4482216152605 N, 1 in = 25.4 mm, 1 psi = 6894.757293168 Pa, °C = (°F − 32) × 5/9, 1 hp = 0.745699872 kW ...), the Metric spelling of each unit,
   and the expected texts of section B, worked out by hand.

   Sections (every case in a fresh browser profile)
     A  SWEEP of every calculator that quotes a converted limit (list below, checked against the engine source), every option of each of its
        drop-downs, every numeric box set out of range (1e15 and -1e15), against the engine before the fix (main):
          A1 Imperial: the message is the same text as before, character for character, and appears for the same inputs
          A2 Metric: a message appears for exactly the same inputs as before (validation behaviour unchanged)
          A3 Metric: the message quotes no Imperial unit of a box that shows a Metric unit
          A4 Metric: every Metric unit the message quotes is a unit shown on that page (in Imperial, the three messages that already
             carried a Metric note in parentheses, e.g. "(90–22,700 kg)", keep it unchanged; A1 checks that)
        repeated in Imperial with Power = hp and Torque = N·m, and with Power = kW, for the power / torque boxes
     N  NUMBERS: every limit converted during A (each call of unitLimit, logged) is checked against the reference factors: the same count of numbers,
        each within one step of the 4th significant figure of the exact value and on the safe side (an upper limit not above it, a lower limit not
        below it), the expected Metric spelling, and the spelling equals the unit shown beside that box. Every call site in the engine source is reached.
     B  REPRESENTATIVE TEXTS AND BOUNDARIES, typed into the boxes: the exact Metric message of 18 calculators (one per unit family: mass, force, torque,
        length, area, speed, pressure, temperature with and without offset, temperature rise, density, stress and modulus, surface speed, volume,
        mass flow, a thread, a power / torque preference, the A/C table note, and the four limits that read back outside before the read-back correction:
        Tire Vertical Stiffness, Drill Point Depth, Ground Effect Estimate, Diffuser Angle, whose limit is taken from the message on screen); the shown Metric limit is accepted and a value just past the real limit is
        rejected; in Imperial the old limit is accepted and a value just past it rejected, as before.
     R  READ-BACK: every limit shown in another unit during A is typed back into its own box (in the drop-down state it was shown in) and read by the
        engine's own reader (certValue, what the validation compares): it must land inside the limit, and two 4th-figure steps further out must land
        outside. This is the check that catches a shown limit that is rejected when typed (152.4 mm reads back as 6.000000000000001 in).
     M  mutants (temporary engine copies): (1) unitLimit returns the Imperial text (the wording before the fix); (2) the read-back correction removed;
        (3) the read-back correction stepping outward. The suite must fail on each. (A mutant that only rounds to nearest is no longer a defect: the
        read-back step then still moves every limit inside, and R and N still hold, so it is not used.)

   Run: node premium/tests/validation-units-imp018.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine;
        GH_BASE_ENGINE=path sets the "before" engine, default: the engine at the merge base with origin/main)
   Exit code 0 = every check passed and all three mutants were caught, 1 otherwise. */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
const ENGINE = process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124);
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-imp018-'));

function baseEngine() {
  if (process.env.GH_BASE_ENGINE) return path.resolve(process.env.GH_BASE_ENGINE);
  const p = path.join(TMP, 'base-' + F124);
  let ref = 'origin/main';
  try { ref = execSync('git merge-base HEAD origin/main', { cwd: REPO, encoding: 'utf8' }).trim(); } catch (e) { }
  fs.writeFileSync(p, execSync(`git show ${ref}:${F124}`, { cwd: REPO, maxBuffer: 1 << 28 }));
  return p;
}

/* ---------- reference units: Imperial spelling of a box -> exact conversion, Metric spelling, spellings a message may use for it ---------- */
const LB = 0.45359237, LBF = 4.4482216152605, IN = 0.0254, FT = 0.3048, PSI = 6894.757293168, HP = 0.745699872;
const REF = {
  'lbs': { f: v => v * LB, m: 'kg', say: ['lb', 'lbs'] },
  'lb': { f: v => v * LBF, m: 'N', say: ['lb', 'lbf'] },
  'lbf': { f: v => v * LBF, m: 'N', say: ['lbf', 'lb'] },
  'lb-ft': { f: v => v * LBF * FT, m: 'N·m', say: ['lb-ft', 'ft-lb'] },
  'ft-lb': { f: v => v * LBF * FT, m: 'J', say: ['ft-lb'] },
  'lb/in': { f: v => v * LBF / 25.4, m: 'N/mm', say: ['lb/in'] },
  'lb-ft/deg': { f: v => v * LBF * FT, m: 'N·m/deg', say: ['lb-ft/deg'] },
  'lb·ft²': { f: v => v * LB * FT * FT, m: 'kg·m²', say: ['lb·ft²'] },
  'in': { f: v => v * 25.4, m: 'mm', say: ['in'] },
  'sq in': { f: v => v * 645.16, m: 'mm²', say: ['sq in'] },
  'sq ft': { f: v => v * FT * FT, m: 'm²', say: ['sq ft'] },
  'ft': { f: v => v * FT, m: 'm', say: ['ft'] },
  'ft/sec': { f: v => v * FT, m: 'm/s', say: ['ft/sec'] },
  'in/min': { f: v => v * 25.4, m: 'mm/min', say: ['in/min'] },
  'SFM': { f: v => v * FT, m: 'm/min', say: ['SFM'] },
  'mph': { f: v => v * 1.609344, m: 'km/h', say: ['mph'] },
  'psi': { f: v => v * PSI / 1e5, m: 'bar', say: ['psi', 'psia', 'psig'] },
  'ksi': { f: v => v * PSI / 1e3, m: 'MPa', say: ['ksi'] },
  'Mpsi': { f: v => v * PSI / 1e3, m: 'GPa', say: ['Mpsi'] },
  '°F': { f: v => (v - 32) * 5 / 9, m: '°C', say: ['°F'] },
  'Δ°F': { f: v => v * 5 / 9, m: 'Δ°C', say: ['°F', 'Δ°F'] },
  'ci': { f: v => v * 16.387064, m: 'cc', say: ['ci'] },
  'CFM': { f: v => v * 28.316846592, m: 'L/min', say: ['CFM'] },
  'lb/ft³': { f: v => v * LB / (FT * FT * FT), m: 'kg/m³', say: ['lb/ft³'] },
  'lbs/min': { f: v => v * LB, m: 'kg/min', say: ['lb/min', 'lbs/min'] },
  'lb/hr': { f: v => v * LB, m: 'kg/hr', say: ['lb/hr'] },
  'lb/hp-hr': { f: v => v * LB / HP, m: 'kg/kW-hr', say: ['lb/hp-hr'] },
  'perf:kW>hp': { f: v => v / HP, m: 'HP', say: ['kW'] },
  'perf:lbft>Nm': { f: v => v * LBF * FT, m: 'N·m', say: ['lb-ft'] }
};
const METRIC_SAYS = [...new Set(Object.values(REF).map(r => r.m))];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* "5,000 lb", "300°F": a number followed by that unit. "in" followed by "magnitude" is the English word (Wing Center of Pressure: "CL between 0.05 and 5 in magnitude") */
const quotes = (msg, u) => new RegExp(`\\d\\s?${esc(u)}(?![\\w/²³·°-])${u === 'in' ? '(?! magnitude)' : ''}`).test(msg);

/* the calculators that quote a converted limit (sections A and N). Checked against the engine source below: every calculator that calls unitLimit,
   directly or through a shared message (GH11A_*Msg, GH11B_threadMsg), is listed. */
const CALCS = ['intake_throat_diameter_sizing', 'exhaust_throat_diameter_sizing', 'port_area_hp_estimator', 'corrected_compressor_flow_speed', 'cooling_boil_point',
  'radiation_heat_transfer', 'tire_contact_patch', 'brake_rotor_sizing', 'tire_deflection', 'tire_vertical_stiffness', 'tire_slip_ratio', 'tire_rolling_resistance',
  'tire_heat_generation', 'brake_fluid_boiling_margin', 'brake_duct_cfm', 'rotor_cooling_rate', 'yaw_inertia_estimate', 'combined_slip', 'brake_fade_prediction',
  'load_transfer_distribution', 'cda_from_coast_down', 'frontal_area_from_dimensions', 'lift_coefficient', 'drag_coefficient', 'wing_aspect_ratio',
  'wing_center_of_pressure', 'ground_effect_estimate', 'drag_downforce_tradeoff', 'diffuser_angle_expansion', 'chassis_torsional_stiffness', 'press_fit_interference',
  'recovery_strap_energy', 'key_keyway_torque_capacity', 'euler_column_buckling', 'johnson_column_buckling', 'combined_axial_bending_stress', 'von_mises_stress',
  'principal_stress', 'mohr_circle', 'thin_wall_hoop_stress', 'thin_wall_longitudinal_stress', 'stress_concentration', 'fatigue_goodman', 'fatigue_soderberg',
  'bolt_torque_spec', 'bolt_stretch', 'bolt_tensile_capacity', 'bolt_shear_capacity', 'thread_stripping_strength', 'thread_engagement_required', 'bolt_preload_from_torque',
  'joint_separation', 'weld_fillet_strength', 'weld_heat_input', 'drill_point_depth', 'blind_hole_depth', 'bend_k_factor', 'bend_deduction', 'minimum_bend_radius',
  'bearing_defect_frequency', 'torsional_resonance_speed', 'engine_mount_natural_frequency', 'tool_deflection', 'cutting_force', 'tool_life', 'thread_cutting_speed',
  'port_timing_from_geometry', 'crankcase_compression_ratio', 'tuned_pipe_length', 'scavenging_charging_efficiency', 'regen_braking_energy', 'battery_pack_heat_balance',
  'motor_thermal_limit', 'inverter_thermal_load', 'power_split_device_kinematics', 'dc_fast_charge_time', 'ac_pressure'];

/* every call site of unitLimit in the engine, as the box id each one names (shared messages expanded by the prefix they are called with) */
function callSites(src) {
  const ids = new Set();
  for (const m of src.matchAll(/unitLimit\('([a-z0-9_]+)'/g)) ids.add(m[1]);
  for (const m of src.matchAll(/unitLimit\(p\+'(_[a-z0-9]+)'/g)) {
    const at = src.lastIndexOf('\nconst ', m.index), name = src.slice(at + 7, src.indexOf('=', at));
    for (const c of src.matchAll(new RegExp(`${esc(name)}\\('([a-z0-9]+)'\\)`, 'g'))) ids.add(c[1] + m[1]);
  }
  if (/unitLimit\(null,'in'/.test(src)) ids.add('(thread diameter)');
  return ids;
}
/* the calculator each unitLimit call belongs to, read from the source (RENDERS.x = ..., object methods x(){...}, shared messages through their callers) */
function callCalcs(src) {
  const out = new Set(), lines = src.split('\n'); let last = null;
  const shared = {};
  lines.forEach(l => { const m = l.match(/^const (GH11[AB]_\w+Msg)=/); if (m && /unitLimit\(/.test(l)) shared[m[1]] = true; });
  lines.forEach(l => {
    const r = [...l.matchAll(/RENDERS\.([a-z0-9_]+)\s*=/g)].map(m => m[1]); if (r.length) last = r[r.length - 1];
    const o = l.match(/^ {2}([a-z0-9_]+)\(\)\{/); if (o) last = o[1];
    if (/unitLimit\(/.test(l) && !/^const GH11|^function unitLimit/.test(l) && last) out.add(last);
    for (const k of Object.keys(shared)) if (l.includes(k + '(') && !l.startsWith('const ' + k) && last) out.add(last);
  });
  return out;
}

async function suite(browser, enginePath, basePath, quiet) {
  let checks = 0, failures = 0; const lines = []; const failSeen = {};
  const check = (label, ok, detail) => {
    checks++;
    if (!ok) { failures++; const key = label.replace(/ \[.*$/, ''); failSeen[key] = (failSeen[key] || 0) + 1; if (failSeen[key] <= 6) lines.push(`  FAIL ${label}: ${detail}`); }
    else if (process.env.VERBOSE && !quiet) lines.push(`  ok   ${label}`);
  };
  const src = fs.readFileSync(enginePath, 'utf8');

  /* ---- 0: the list above is complete ---- */
  const used = callCalcs(src);
  for (const c of used) check(`0 calculator that calls unitLimit is in the sweep list [${c}]`, CALCS.includes(c), c);
  const sites = callSites(src);
  check('0 call sites found in the engine', sites.size >= 140, sites.size);

  const fresh = async (eng, sys, perf) => {
    const ctx = await browser.newContext(); const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto('file://' + eng, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(300);
    await page.evaluate(([s, p]) => {
      if (UNIT.system !== s) setUnit(s);
      if (p) { setPerf('power', p.power); setPerf('torque', p.torque); }
      renderCalc('dashboard', false);
      window.__lim = [];
      if (typeof unitLimit === 'function') { const f = unitLimit; window.unitLimit = function (id, unit, imp, dir, frag) { const out = f.apply(this, arguments); window.__lim.push({ calc: currentCalc, id, unit, imp, dir, frag, out, sys: UNIT.system, sel: Object.fromEntries([...document.querySelectorAll('#calc-container select[id]')].map(s => [s.id, s.value])), decl: id ? declaredFieldUnit(id) : unit, shown: id && document.getElementById(id) ? ((document.getElementById(id).closest('.input-wrap') || {}).querySelector ? (document.getElementById(id).closest('.input-wrap').querySelector('.field-unit') || {}).textContent : null) : null }); return out; }; }
    }, [sys, perf || null]);
    await page.waitForTimeout(40);
    return { ctx, page, errors };
  };

  /* the sweep of one calculator on one page: every option of each drop-down (one at a time), every numeric box at 1e15 and -1e15 */
  const sweep = (page, c) => page.evaluate(c => {
    const D = document, C = D.getElementById('calc-container');
    const reset = () => { C.innerHTML = ''; delete CALC_PERSISTENT_STATE[c]; delete CALC_STATE_META[c]; };
    const msg = () => { const b = [...C.querySelectorAll('.result-box')].find(x => /Validation required/.test(x.textContent)); return b ? (b.querySelector('.help-note') || {}).textContent || '' : null; };
    const units = () => [...C.querySelectorAll('.input-wrap')].map(w => { const i = w.querySelector('input.field-input'), u = w.querySelector('.field-unit'); return i && u ? { id: i.id, u: u.textContent } : null; }).filter(Boolean);
    const note = () => { const n = [...C.querySelectorAll('.calc-note')].find(x => /Published table range/.test(x.textContent)); return n ? n.textContent : null; };
    reset(); renderCalc(c, false);
    const sels = [...C.querySelectorAll('select[id]')].map(s => ({ id: s.id, opts: [...s.options].map(o => o.value) }));
    const variants = [{}]; sels.forEach(s => s.opts.forEach(o => variants.push({ [s.id]: o })));
    const out = [];
    for (const v of variants) {
      reset(); renderCalc(c, false);
      for (const [k, o] of Object.entries(v)) { const e = D.getElementById(k); if (e) { e.value = o; renderCalc(c, false); } }
      const boxes = [...C.querySelectorAll('input.field-input')].map(e => e.id);
      out.push({ v, box: '(defaults)', val: '', msg: msg(), units: units(), note: note() });
      for (const b of boxes) for (const val of ['1e15', '-1e15']) {
        reset(); renderCalc(c, false);
        for (const [k, o] of Object.entries(v)) { const e = D.getElementById(k); if (e) { e.value = o; renderCalc(c, false); } }
        const e = D.getElementById(b); if (!e) continue;
        e.value = val; renderCalc(c, false);
        out.push({ v, box: b, val, msg: msg(), units: units(), note: note() });
      }
    }
    reset(); renderCalc('dashboard', false);
    return out;
  }, c);

  const logs = [], IMPU = {}, rbCounts = []; let a3 = 0;   /* the unit beside each box in Imperial with Auto preferences (the first run): what a converted box showed before */
  const runA = async (sys, perf, tag) => {
    const a = await fresh(enginePath, sys, perf), b = await fresh(basePath, sys, perf);
    for (const c of CALCS) {
      const ra = await sweep(a.page, c), rb = await sweep(b.page, c);
      check(`A ${tag} same cases as before [${c}]`, ra.length === rb.length, `${ra.length} vs ${rb.length}`);
      if (sys === 'imperial' && !perf) { const u = IMPU[c] = IMPU[c] || {}; ra.forEach(x => x.units.forEach(z => { u[z.id] = z.u; })); }
      check(`A ${tag} Imperial labels known [${c}]`, !!IMPU[c] && Object.keys(IMPU[c]).length > 0, 'run Imperial first');
      ra.forEach((x, i) => {
        const y = rb[i] || {}, at = `${c} ${JSON.stringify(x.v)} ${x.box}=${x.val}`;
        check(`A2 ${tag} a message for the same inputs as before [${at}]`, (x.msg === null) === (y.msg === null), `now ${JSON.stringify(x.msg)}, before ${JSON.stringify(y.msg)}`);
        if (sys === 'imperial' && !perf) check(`A1 ${tag} message text unchanged [${at}]`, x.msg === y.msg && x.note === y.note, `now ${JSON.stringify(x.msg)}\n        before ${JSON.stringify(y.msg)}`);
        for (const text of [x.msg, x.note]) {
          if (text === null) continue;
          const shownUnits = new Set(x.units.map(u => u.u));
          /* A3: no Imperial unit of a box that now shows another unit than in Imperial with Auto preferences */
          x.units.forEach(u => {
            const old = (IMPU[c] || {})[u.id]; if (!old || old === u.u) return;
            const sayIt = (Object.entries(REF).find(([k, r]) => k === old || (k.startsWith('perf:') && r.say.includes(old) && r.m === u.u)) || [null, { say: [old] }])[1].say;
            for (const s of sayIt) if (!x.units.some(z => z.u === s)) a3++, check(`A3 ${tag} no Imperial unit of a converted box [${at} ${u.id} ${old}->${u.u} "${s}"]`, !quotes(text, s), text);
          });
          /* A4: a Metric unit quoted is a unit on the page */
          if (sys === 'metric') for (const m of METRIC_SAYS) if (quotes(text, m)) check(`A4 ${tag} quoted unit is on the page [${at} ${m}]`, shownUnits.has(m), `${text} | page: ${[...shownUnits].join(', ')}`);
        }
      });
    }
    const mine = (await a.page.evaluate(() => window.__lim)).map(l => ({ ...l, tag }));
    logs.push(...mine);
    /* R: every limit shown in another unit, typed back into its own box and read by the engine's own reader (certValue, the reader the validation uses):
       it must land inside the limit (so typing the number shown is accepted), and two 4th-figure steps further out must land outside (the number is tight) */
    const seen = new Set(), todo = [];
    for (const l of mine) {
      if (l.out === l.imp || l.dir === 'near') continue;
      const k = [l.calc, l.id, l.imp, l.frag, JSON.stringify(l.sel)].join('|'); if (seen.has(k)) continue; seen.add(k); todo.push(l);
    }
    const rb = await a.page.evaluate(todo => {
      const C = document.getElementById('calc-container'), num = /([±−-]?)(\d[\d,]*(?:\.\d+)?)/g, out = [];
      const read = (l, text) => {
        C.innerHTML = ''; delete CALC_PERSISTENT_STATE[l.calc]; delete CALC_STATE_META[l.calc]; renderCalc(l.calc, false);
        for (const [k, v] of Object.entries(l.sel || {})) { const e = document.getElementById(k); if (e && e.value !== v) { e.value = v; renderCalc(l.calc, false); } }
        const id = l.id || ([...C.querySelectorAll('input.field-input')].map(e => e.id).find(i => /_d$/.test(i) && (FIELD_UNIT_REGISTRY[l.calc] || {})[i] === 'in'));
        const e = id && document.getElementById(id); if (!e) return { missing: true, id };
        e.value = text; renderCalc(l.calc, false);
        return { v: window.GH_CERT_VALUE(id), id };
      };
      for (const l of todo) {
        const a = [...(l.frag || l.imp).matchAll(num)], b = [...l.out.matchAll(num)];
        a.forEach((m, i) => {
          const pm = m[1] === '±', lim = Number(m[2].replace(/,/g, '')) * (m[1] && !pm ? -1 : 1), sm = b[i]; if (!sm) return;
          const y = Number(sm[2].replace(/,/g, '')) * (sm[1] && sm[1] !== '±' ? -1 : 1);
          const role = a.length >= 2 ? (i === 0 ? 'min' : 'max') : (pm ? 'max' : (l.dir || 'max'));
          const step = Math.pow(10, Math.floor(Math.log10(Math.abs(y) || 1)) - 3);
          const sides = pm ? [[y, lim, 'max'], [-y, -lim, 'min']] : [[y, lim, role]];
          for (const [yy, ll, rr] of sides) {
            const at = read(l, String(yy)), far = read(l, String(+(rr === 'max' ? yy + 2 * step : yy - 2 * step).toPrecision(8)));
            out.push({ calc: l.calc, id: at.id, out: l.out, sel: l.sel, role: rr, shown: yy, lim: ll, back: at.v, farBack: far.v, missing: !!at.missing });
          }
        });
      }
      C.innerHTML = ''; renderCalc('dashboard', false);
      return out;
    }, todo);
    let rbn = 0, rbm = 0;
    for (const x of rb) {
      const at = `${tag} ${x.calc} ${x.id} ${JSON.stringify(x.sel)} "${x.out}" ${x.role} ${x.shown}`;
      if (x.missing) { rbm++; continue; }
      rbn++;
      check(`R ${tag} the limit shown, typed, reads back inside the limit [${at}]`, Number.isFinite(x.back) && (x.role === 'max' ? x.back <= x.lim : x.back >= x.lim), `reads back as ${x.back}, limit ${x.lim}`);
      check(`R ${tag} two steps further out reads back outside (the limit shown is tight) [${at}]`, Number.isFinite(x.farBack) && (x.role === 'max' ? x.farBack > x.lim : x.farBack < x.lim), `reads back as ${x.farBack}, limit ${x.lim}`);
    }
    if (sys === 'metric' || perf) check(`R ${tag} limits read back`, rbn >= (sys === 'metric' ? 300 : 10),   // Imperial with hp / N·m converts only the power and torque limits
       `${rbn} read back, ${rbm} whose box is not on screen in that drop-down state`);
    rbCounts.push(`${tag}: ${rbn} read back (${rbm} skipped: box not on screen)`);
    check(`A ${tag} no page errors`, a.errors.length === 0, a.errors.slice(0, 3).join(' | '));
    await a.ctx.close(); await b.ctx.close();
  };
  await runA('imperial', null, 'Imperial');
  await runA('metric', null, 'Metric');
  await runA('imperial', { power: 'hp', torque: 'N·m' }, 'Imperial hp/N·m');
  await runA('metric', { power: 'hp', torque: 'N·m' }, 'Metric hp/N·m');
  check('A3 made (Imperial units looked for in messages of converted pages)', a3 > 2000, a3);

  /* ---- N: every converted limit against the reference ---- */
  const reached = new Set(); let converted = 0;
  const numbers = s => [...s.matchAll(/([±−-]?)(\d[\d,]*(?:\.\d+)?)/g)].map(m => ({ pm: m[1] === '±', v: Number(m[2].replace(/,/g, '')) * (m[1] && m[1] !== '±' ? -1 : 1) }));
  for (const l of logs) {
    const at = `${l.tag} ${l.calc} ${l.id} "${l.imp}"`;
    if (l.out === l.imp) {
      /* unchanged text is right only when the box shows the unit as written */
      const decl = String(l.decl || '');
      const perfShift = /^perf\|/.test(decl) && decl.split('|')[1] !== { HP: 'hp', 'lb-ft': 'lbft', 'kW': 'kW', 'N·m': 'Nm' }[decl.split('|')[2]];
      const metricShift = l.sys === 'metric' && !/^perf\|/.test(decl) && REF[decl];
      check(`N unchanged text only for a box shown as written [${at}]`, !perfShift && !metricShift, `declared ${decl}, shown ${l.shown}`);
      continue;
    }
    converted++; reached.add(l.id === null ? '(thread diameter)' : l.id);
    const decl = String(l.decl || '');
    let key = decl;
    if (/^perf\|/.test(decl)) { const p = decl.split('|'); key = p[1] === 'kW' ? 'perf:kW>hp' : p[1] === 'lbft' ? 'perf:lbft>Nm' : decl; }
    const r = REF[key];
    if (!check(`N reference unit known [${at}]`, !!r, key) && !r) continue;
    const src = l.frag || l.imp, a = numbers(src), b = numbers(l.out);
    check(`N same count of numbers [${at}]`, a.length === b.length, `${l.out}`);
    a.forEach((n, i) => {
      const exact = n.pm ? r.f(Math.abs(n.v)) - r.f(0) : r.f(n.v), y = b[i] ? b[i].v : NaN;
      const role = l.dir === 'near' ? 'near' : a.length >= 2 ? (i === 0 ? 'min' : 'max') : (n.pm ? 'max' : (l.dir || 'max'));
      const step = Math.pow(10, Math.floor(Math.log10(Math.abs(exact) || 1)) - (role === 'near' ? 2 : 3));
      const ok = !Number.isFinite(y) ? false : exact === 0 ? y === 0 : role === 'max' ? (y <= exact * (1 + 1e-12) + 1e-12 && exact - y < step * (1 + 1e-9)) : role === 'min' ? (y >= exact - 1e-12 && y - exact < step * (1 + 1e-9)) : Math.abs(y - exact) <= step / 2 * (1 + 1e-9);
      check(`N number ${i + 1} (${role}) within one 4-figure step, on the safe side [${at}]`, ok, `exact ${exact}, shown ${y} (${l.out})`);
    });
    check(`N Metric spelling [${at}]`, l.out.endsWith(r.m), `${l.out} (expected ${r.m})`);
    if (l.shown !== null) check(`N spelling equals the unit beside the box [${at}]`, l.out.endsWith(l.shown), `${l.out} vs box ${l.shown}`);
  }
  check('N converted limits checked', converted > 500, converted);
  for (const id of sites) check(`N call site reached with a converted limit [${id}]`, reached.has(id), 'never converted in the sweep');

  /* ---- B: exact texts and boundaries, typed ---- */
  const typed = async (eng, sys, perf, calc, setup, box, value) => {
    const { ctx, page } = await fresh(eng, sys, perf);
    await page.evaluate(c => renderCalc(c, false), calc); await page.waitForTimeout(60);
    for (const [k, v] of Object.entries(setup || {})) { await page.selectOption('#' + k, v).catch(async () => { await page.fill('#' + k, String(v)); }); await page.waitForTimeout(40); }
    if (box) { await page.fill('#' + box, String(value)); await page.waitForTimeout(60); }
    const r = await page.evaluate(() => {
      const C = document.getElementById('calc-container');
      const b = [...C.querySelectorAll('.result-box')].find(x => /Validation required/.test(x.textContent));
      const n = [...C.querySelectorAll('.calc-note')].find(x => /Published table range/.test(x.textContent));
      return { msg: b ? (b.querySelector('.help-note') || {}).textContent : null, note: n ? n.textContent : null };
    });
    await ctx.close(); return r;
  };
  const MPH = 1.609344;
  const B = [
    { calc: 'tire_contact_patch', box: 'tcp_w', bad: 1e9, text: 'Load must be 0–2,267 kg, pressure 0–13.78 bar, and section width 0–508 mm.', mOk: 2267, mBad: 5000.001 * LB, iOk: 5000, iBad: 5000.001 },
    { calc: 'tire_rolling_resistance', box: 'tirerr_v', bad: 1e9, text: 'Weight must be 0–9,071 kg, coefficient 0–0.05, and speed 0–402.3 km/h.', mOk: 402.3, mBad: 250.001 * MPH, iOk: 250, iBad: 250.001 },
    { calc: 'brake_rotor_sizing', box: 'brs_f', bad: 1e9, text: 'Torque must be 0–4,067 N·m, clamp force 0–88,960 N, friction coefficient 0–1, and pad height 0–101.6 mm.', mOk: 88960, mBad: 20000.01 * LBF, iOk: 20000, iBad: 20000.01 },
    { calc: 'brake_fluid_boiling_margin', box: 'bfbm_bp', bad: 1e9, text: 'Boiling point must be 148.9–371.1°C and fluid temperature −17.77–371.1°C.', mOk: 148.9, mBad: (299.99 - 32) * 5 / 9, iOk: 300, iBad: 299.99 },
    { calc: 'brake_duct_cfm', box: 'bdc_dt', bad: 1e9, text: 'Heat rejection must be 0–200,000 BTU/hr and temperature rise 0–222.2 Δ°C.', mOk: 222.2, mBad: 400.01 * 5 / 9, iOk: 400, iBad: 400.01 },
    { calc: 'lift_coefficient', box: 'lcf_f', bad: -1e9, text: 'Force must be within ±88,960 N, speed 8.047–482.8 km/h, area 0.04646–18.58 m², and air density 0.4806–1.601 kg/m³.', mOk: -88960, mBad: -20000.01 * LBF, iOk: -20000, iBad: -20000.01 },
    { calc: 'cda_from_coast_down', box: 'cdc_v2', bad: 1, text: 'Weight must be 226.8–9,071 kg, start speed above end speed (end speed at least 8.047 km/h, start at most 402.3 km/h), time 1–600 sec, Crr 0.002–0.05, air density 0.4806–1.601 kg/m³, and frontal area 0.04646–18.58 m².', mOk: 8.047, mBad: 4.999 * MPH, iOk: 5, iBad: 4.999 },
    { calc: 'euler_column_buckling', box: 'eb_e', bad: 1e9, text: 'Modulus must be 3.448–689.4 GPa (steel is about 200–207 GPa), yield strength above 0 and up to 2,757 MPa, outside diameter 1.27–1,016 mm, inside diameter 0 (solid) up to (but less than) the outside diameter, length 2.54–127,000 mm, and the effective-length factor K 0.3–2.5.', mOk: 689.4, mBad: 100.001 * PSI / 1e3, iOk: 100, iBad: 100.001 },
    { calc: 'cutting_force', box: 'cf_v', bad: 1e9, text: 'The specific cutting force must be above 0 (up to 13,780 MPa), the depth of cut above 0 (up to 127 mm), the feed above 0 (up to 25.4 mm per revolution), the cutting speed above 0 (up to 6,096 m/min), and the efficiency above 0 and up to 1.', mOk: 6096, mBad: 20000.01 * FT, iOk: 20000, iBad: 20000.01 },
    { calc: 'crankcase_compression_ratio', box: 'ccr_v', bad: 1e9, text: 'The bore must be 12.7–203.2 mm, the stroke 5.08–254 mm, and the crankcase volume at BDC above 0 (up to 32,770 cc).', mOk: 32770, mBad: 2000.001 * 16.387064, iOk: 2000, iBad: 2000.001 },
    { calc: 'corrected_compressor_flow_speed', box: 'ccfs_w', bad: 1e9, text: 'Actual mass flow (≤226.7 kg/min) and shaft speed (≤300,000 RPM) must be positive, both pressures must be positive and at or below 4.136 bar, and both temperatures must fall between -40°C and 148.8°C (standard reference temperature between -40°C and 65.55°C).', mOk: 226.7, mBad: 500.001 * LB, iOk: 500, iBad: 500.001 },
    { calc: 'bolt_tensile_capacity', box: 'btc_d', bad: 1e9, text: 'Enter the major diameter 1.524–101.6 mm and 4–80 threads per inch, with the pitch no more than half the diameter; a proof strength above 0, an ultimate strength at least the proof strength and up to 2,757 MPa; and a safety factor of 1–10.', mOk: 1.524, mBad: 0.0599 * 25.4, iOk: 0.06, iBad: 0.0599, setup: { btc_tpi: 80 } },
    { calc: 'power_split_device_kinematics', perf: { power: 'auto', torque: 'N·m' }, box: 'psd_te', bad: 1e9, contains: 'an engine torque from 0 to 2,711 N·m', mOk: 2711, mBad: 2000.01 * LBF * FT, iOk: null },
    { calc: 'recovery_strap_energy', box: 'rse_m', bad: 1e9, text: 'Vehicle mass must be 90.72–22,670 kg, the speed 0.161–96.56 km/h, the strap length 0.9144–60.96 m, the breaking strength 453.6–226,700 kg and the stretch at breaking strength 1–60%. A stretch of zero would be a rigid strap, which gives an infinite force.', mOk: 22670, mBad: 50000.01 * LB, iOk: 50000, iBad: 50000.01 },
    /* the four limits that read back outside before the read-back correction (152.4 mm = 6.000000000000001 in, 609.6 mm = 24.000000000000004 in): the number
       typed is the one taken from the message on screen */
    { calc: 'tire_vertical_stiffness', box: 'tvs_d', bad: 1e9, text: 'Load must be 0–2,267 kg and deflection 0–152.3 mm.', shown: /deflection 0–([\d.,]+) mm/, mOk: 152.3, mBad: 6.0001 * 25.4, iOk: 6, iBad: 6.0001 },
    { calc: 'drill_point_depth', box: 'dpd_d', bad: 1e9, text: 'The drill diameter must be 0.254–152.3 mm, the point angle 60–180°, and the full-diameter depth 0–2,540 mm.', shown: /diameter must be [\d.,]+–([\d.,]+) mm/, mOk: 152.3, mBad: 6.0001 * 25.4, iOk: 6, iBad: 6.0001 },
    { calc: 'ground_effect_estimate', box: 'gee_h1', bad: 1e9, contains: 'inlet gap 12.7–609.5 mm', shown: /inlet gap [\d.,]+–([\d.,]+) mm/, mOk: 609.5, mBad: 24.0001 * 25.4, iOk: 24, iBad: 24.0001 },
    { calc: 'diffuser_angle_expansion', box: 'dae_h1', bad: 1e9, contains: 'Throat height must be 6.35–609.5 mm', shown: /Throat height must be [\d.,]+–([\d.,]+) mm/, setupM: { dae_h2: 1200 }, setupI: { dae_h2: 47 }, mOk: 609.5, mBad: 24.0001 * 25.4, iOk: 24, iBad: 24.0001 },
    { calc: 'ac_pressure', note: '⚠ Published table range used here: 26.67–48.88°C. Do not use saturation pressure alone to diagnose an operating vehicle A/C system.' }
  ];
  for (const t of B) {
    const sysM = t.perf ? 'imperial' : 'metric', tag = t.perf ? 'Imperial with Torque N·m' : 'Metric';
    if (t.note) {
      const r = await typed(enginePath, 'metric', null, t.calc, null, null, null);
      check(`B ${t.calc} Metric note text`, r.note === t.note, JSON.stringify(r.note));
      const ri = await typed(enginePath, 'imperial', null, t.calc, null, null, null), rb = await typed(basePath, 'imperial', null, t.calc, null, null, null);
      check(`B ${t.calc} Imperial note unchanged`, ri.note === rb.note && /80–120°F/.test(ri.note || ''), JSON.stringify(ri.note));
      continue;
    }
    const setM = t.setupM || t.setup, setI = t.setupI || t.setup;
    const r = await typed(enginePath, sysM, t.perf, t.calc, setM, t.box, t.bad);
    if (t.text) check(`B ${t.calc} ${tag} message text`, r.msg === t.text, `\n        got      ${JSON.stringify(r.msg)}\n        expected ${JSON.stringify(t.text)}`);
    if (t.contains) check(`B ${t.calc} ${tag} message quotes the box unit`, (r.msg || '').includes(t.contains), JSON.stringify(r.msg));
    let mOk = t.mOk;
    if (t.shown) { const m = (r.msg || '').match(t.shown); check(`B ${t.calc} ${tag}: the limit is read from the message on screen`, !!m && Number(m[1].replace(/,/g, '')) === t.mOk, JSON.stringify(r.msg)); if (m) mOk = m[1].replace(/,/g, ''); }
    const ok = await typed(enginePath, sysM, t.perf, t.calc, setM, t.box, mOk);
    check(`B ${t.calc} ${tag}: the limit shown (${mOk}) is accepted`, ok.msg === null, JSON.stringify(ok.msg));
    const bad = await typed(enginePath, sysM, t.perf, t.calc, setM, t.box, +t.mBad.toPrecision(10));
    check(`B ${t.calc} ${tag}: just past the real limit (${+t.mBad.toPrecision(10)}) is rejected`, bad.msg !== null, 'accepted');
    if (t.iOk !== null && t.iOk !== undefined) for (const eng of [enginePath, basePath]) {
      const w = eng === basePath ? 'before the fix' : 'now';
      const io = await typed(eng, 'imperial', null, t.calc, setI, t.box, t.iOk), ib = await typed(eng, 'imperial', null, t.calc, setI, t.box, t.iBad);
      check(`B ${t.calc} Imperial (${w}): the limit ${t.iOk} is accepted and ${t.iBad} rejected`, io.msg === null && ib.msg !== null, `${JSON.stringify(io.msg)} / ${JSON.stringify(ib.msg)}`);
    }
  }
  lines.push(...rbCounts.map(x => '  R ' + x));
  return { checks, failures, lines };
}

(async () => {
  const browser = await playwright.chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  let base;
  try { base = baseEngine(); } catch (e) { console.log('FAIL could not read the engine before the fix: ' + e.message); process.exit(1); }
  const res = await suite(browser, ENGINE, base, false);
  res.lines.forEach(l => console.log(l));
  console.log(`GH-IMP-018 validation units: ${res.checks} checks, ${res.failures} failures`);

  /* mutants */
  const html = fs.readFileSync(ENGINE, 'utf8');
  const MUT = [
    ['the wording before the fix (unitLimit returns the Imperial text)', 'function unitLimit(id,unit,imp,dir,frag){', 'function unitLimit(id,unit,imp,dir,frag){ return imp;'],
    ['the read-back correction removed (152.4 mm shown for a 6 in limit)', "    if(d!=='near') y=pm?", "    if(false) y=pm?"],
    ['the read-back correction steps outward instead of inward', "y=+(dir==='max'?y-k:y+k).toPrecision(6);", "y=+(dir==='max'?y+k:y-k).toPrecision(6);"]
  ];
  let caught = 0;
  for (const [name, a, b] of MUT) {
    if (!html.includes(a)) { console.log(`  FAIL mutant "${name}": anchor not found in the engine`); continue; }
    const p = path.join(TMP, 'mut-' + caught + '-' + F124); fs.writeFileSync(p, html.replace(a, b));
    const m = await suite(browser, p, base, true);
    console.log(`  mutant "${name}": ${m.failures} checks failed${m.failures ? ' (caught)' : ' (NOT caught)'}`);
    if (m.failures) caught++;
  }
  await browser.close();
  const ok = res.failures === 0 && caught === MUT.length;
  console.log(ok ? 'PASS' : 'FAIL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
