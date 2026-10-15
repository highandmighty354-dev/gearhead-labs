#!/usr/bin/env node
/* Gearhead Labs — the "↓ use <vehicle value>" shortcut on calculator boxes (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-027).

   THE DEFECT. A numeric box shows a "use vehicle value" shortcut when its id matches a pattern in PROFILE_FIELD_MAP (/^hp/ -> the vehicle's horsepower, /^wt|weight/ -> weight, ...).
   The match was made on the first letters of the box id, and the value was offered as it stood, with no check that the box holds the same QUANTITY as the vehicle property.
   On the Hybrid Power Split the system-power box (hps_p, kilowatts) and the engine-fraction box (hps_f, a 0 to 1 share) both begin "hp", so one click put 370 (the vehicle's hp)
   into a kW box and into the fraction box; the page then reported an engine share of 44,400 kW and a motor share of -44,280 kW. The same prefix match put the vehicle's
   horsepower into a torque box (optimal_shift), a % box, an RPM box and a displacement box (hydraulic_pump_flow), and the vehicle's weight into g, % and inch boxes
   (the three weight-transfer calculators).

   THE EXPECTED BEHAVIOUR (every number below is written out here from exact definitions, nothing is read from the engine):
     - a box is offered a vehicle value only when it holds that quantity (hp -> a power box, torque -> a torque box, weight -> a mass box, ...), and the number offered is the vehicle value
       converted to the unit the box SHOWS (370 hp -> 275.909 kW in a kW box; 7,500 lbs -> 3,401.94 kg in a kg box);
     - the Hybrid Power Split offers no shortcut on its fraction and offers the vehicle's hp as kilowatts on its system power (370 hp = 275.909 kW);
     - clicking it gives system 275.909 kW, engine 275.909 x 0.65 = 179.341 kW and motor 275.909 x 0.35 = 96.568 kW in both measurement systems, the fraction stays 0.65 and the vehicle
       keeps its 370 hp;
     - "Save to vehicle" never writes the fraction into the vehicle and writes the system power back as horsepower (275.909 kW -> 370 hp), never as 275.909 or 0.65 or 120.

   Run: node premium/tests/profile-shortcut.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine; MUTANTS=0 skips the mutation checks)
   Exit code 0 = every check passed (and every mutant was caught), 1 otherwise. */
'use strict';
const { parseShown, mismatch, within } = require('./lib/numeric-guard');   // GH-DEF-037: every numeric check fails on a blank, NaN or infinite value
const path = require('path'), fs = require('fs'), os = require('os'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* exact definitions */
const LB = 0.45359237, FT = 0.3048, IN = 0.0254, G0 = 9.80665;
const KW_PER_HP = 550 * FT * LB * G0 / 1000;          // 0.74569987158...
const NM_PER_LBFT = FT * LB * G0;                      // 1.3558179483...
const CC_PER_CI = IN ** 3 * 1e6;                       // 16.387064
const MM_PER_IN = 25.4;
/* what one unit of the vehicle property is worth in each unit a box may show it in */
const FAMILY = {
  hp:           { HP: 1, hp: 1, kW: KW_PER_HP },
  torque:       { 'lb-ft': 1, 'N·m': NM_PER_LBFT },
  weight:       { lbs: 1, kg: LB },
  bore:         { in: 1, mm: MM_PER_IN },
  stroke:       { in: 1, mm: MM_PER_IN },
  displacement: { ci: 1, cc: CC_PER_CI },
  peakRPM:      { RPM: 1 },
  cylinders:    { '': 1 },
  intakeValve:  { in: 1, mm: MM_PER_IN },
  exhaustValve: { in: 1, mm: MM_PER_IN },
};
/* the title of a shortcut names the vehicle property: "Use <label> from <vehicle>" */
const LABEL_TO_PROP = { HP: 'hp', torque: 'torque', weight: 'weight', bore: 'bore', stroke: 'stroke', displacement: 'displacement', 'peak RPM': 'peakRPM', 'cylinder count': 'cylinders',
  'intake valve diameter': 'intakeValve', 'exhaust valve diameter': 'exhaustValve' };
/* boxes that carry no unit text and are nevertheless right: a cylinder count, and the three converters whose input is the unit they are named for */
const UNITLESS_OK = { hp_to_kw_x: 'hp', hp_to_ps_x: 'hp', rpm_to_radsec_x: 'peakRPM' };
/* the 18 boxes the prefix match got wrong: none may offer a shortcut */
const NEVER_OFFERED = {
  hybrid_power_split: ['hps_f'],
  optimal_shift: ['hp_tq'],
  hydraulic_pump_flow: ['hpf_eff', 'hpf_rpm', 'hpf_disp'],
  sim_weight_transfer: ['wt_front', 'wt_accel', 'wt_lat', 'wt_wb', 'wt_track', 'wt_cg'],
  weight_transfer_braking: ['wtb_g', 'wtb_h', 'wtb_l'],
  weight_transfer_accel: ['wta_g', 'wta_h', 'wta_l'],
};
const approx = (got, want, rel = 1e-5, abs = 0) => within(got, want, abs + rel * Math.abs(want)); // GH-DEF-037: guarded
/* the number at the start of a displayed text ("1,152.45 N·m", "~ 78 kW", "↓ use 275.909 kW") */
const num = s => { const m = /[-+]?\d[\d,]*\.?\d*(?:e[-+]?\d+)?/i.exec(String(s).replace(/[−–]/g, '-').replace('~', '')); if (!m) return NaN; const n = Number(m[0].replace(/,/g, '')); return Number.isFinite(n) ? n : NaN; };

/* ------------------------------------------------------------------------------------------------------------------------------------------------------------------ */
async function runSuite(enginePath, label, quick) {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + enginePath, { waitUntil: 'load', timeout: 60000 });
  let checks = 0, failures = 0; const lines = [];
  const check = (name, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${name}`); };

  const setSystem = s => page.evaluate(s => { if (UNIT.system !== s) setUnit(s); }, s);
  const profile = props => page.evaluate(p => { const a = getActiveProfile(); Object.assign(a, p); return { hp: a.hp, torque: a.torque, weight: a.weight, peakRPM: a.peakRPM, name: a.name }; }, props);
  /* a fresh page: leave the calculator for another one (the page on screen is captured as remembered text when the next one renders; the dashboard cannot be used, it swaps in the home page a tick later), forget the text, open it */
  const open = (id) => page.evaluate(i => { renderCalc('hp_quarter_mile', false); try { delete CALC_PERSISTENT_STATE[i]; delete CALC_STATE_META[i]; } catch (e) {} renderCalc(i, false); }, id);
  const results = () => page.evaluate(() => {
    const out = {}; document.querySelectorAll('#calc-container .mini-result, #calc-container .result-box').forEach(e => {
      const l = (e.querySelector('.label,.result-label') || {}).textContent, v = (e.querySelector('.value,.result-value') || {}).textContent;
      if (l) out[l.trim()] = (v || '').replace(/\s+/g, ' ').trim();
    }); return out; });
  const chipOf = id => page.evaluate(i => { const el = document.getElementById(i); const c = el && el.closest('.field').querySelector('.profile-link'); return c ? { text: c.textContent.trim(), title: c.title } : null; }, id);
  const boxOf = id => page.evaluate(i => { const el = document.getElementById(i); return el ? { value: el.value, unit: (el.closest('.input-wrap').querySelector('.field-unit') || {}).textContent || '' } : null; }, id);

  /* ---- 1. the hybrid power split, in both systems -------------------------------------------------------------------------------------------------------------- */
  for (const sys of ['imperial', 'metric']) {
    await setSystem(sys);
    await profile({ hp: 370, torque: 850, weight: 7500 });
    await open('hybrid_power_split');
    const tag = `hybrid ${sys}`;
    const start = await results();
    /* GH-IMP-019 (2026-10-13): the engine share is combustion-engine power, hp in both systems under the default Power preference; the motor share and the system power stay kW.
       78 kW of engine power is 78 / 0.745699872 = 104.60 hp. */
    check(`${tag}: opens at system 120 kW, engine 78 kW (104.60 hp), motor 42 kW`, /HP$/.test(start['Engine Power']) && approx(num(start['Engine Power']), 78 / KW_PER_HP, 1e-3) && num(start['Electric Motor Power']) === 42 && /kW$/.test(start['Electric Motor Power']), JSON.stringify(start));
    const fChip = await chipOf('hps_f');
    check(`${tag}: the engine-fraction box offers no vehicle shortcut`, fChip === null, JSON.stringify(fChip));
    const pChip = await chipOf('hps_p');
    check(`${tag}: the system-power box offers the vehicle's 370 hp as 275.909 kW`, pChip && approx(num(pChip.text), 370 * KW_PER_HP, 1e-5), JSON.stringify(pChip));
    check(`${tag}: the system-power shortcut names its unit`, pChip && /kW/.test(pChip.text), JSON.stringify(pChip));
    const pBox = await boxOf('hps_p');
    check(`${tag}: the system-power box is in kW in both systems`, pBox && pBox.unit === 'kW', JSON.stringify(pBox));
    if (pChip) {
      await page.evaluate(() => document.getElementById('hps_p').closest('.field').querySelector('.profile-link').click());
      const after = await boxOf('hps_p'), fAfter = await boxOf('hps_f'), r = await results(), prof = await profile({});
      const sysKW = 370 * KW_PER_HP;
      check(`${tag}: clicking puts 275.909 kW in the system-power box`, after && approx(num(after.value), sysKW, 1e-5), JSON.stringify(after));
      check(`${tag}: the fraction is still 0.65`, fAfter && num(fAfter.value) === 0.65, JSON.stringify(fAfter));
      check(`${tag}: engine share is 275.909 x 0.65 = 179.341 kW = 240.5 hp, shown in hp`, /HP$/.test(r['Engine Power']) && approx(num(r['Engine Power']), sysKW * 0.65 / KW_PER_HP, 1e-3), JSON.stringify(r));
      check(`${tag}: motor share is 275.909 x 0.35 = 96.568 kW, shown in kW`, /kW$/.test(r['Electric Motor Power']) && approx(num(r['Electric Motor Power']), sysKW * 0.35, 1e-3), JSON.stringify(r));
      check(`${tag}: engine (hp, converted) + motor (kW) = system power`, approx(num(r['Engine Power']) * KW_PER_HP + num(r['Electric Motor Power']), sysKW, 1e-3), JSON.stringify(r));
      /* the old kW shortcut gave an engine of 240.5 kW and a motor of 129.5 kW: the engine figure is now correctly 240.5 hp, so the motor share (96.6, not 129.5) and the unit tell them apart */
      check(`${tag}: neither the 129.5 kW motor share of the old kW shortcut nor the 44,400 of the fraction shortcut appears, and 240.5 is hp`, !/129\.5|44,400|-44,280/.test(JSON.stringify(r)) && /^240\.5 HP$/.test(r['Engine Power']), JSON.stringify(r));
      check(`${tag}: the vehicle still has 370 hp`, prof.hp === 370, JSON.stringify(prof));
      /* the box does not move when the measurement system changes: it is kW in both */
      await setSystem(sys === 'imperial' ? 'metric' : 'imperial');
      const other = await boxOf('hps_p'), r2 = await results();
      check(`${tag}: switching Metric / Imperial leaves the kW box and the split unchanged`, other && approx(num(other.value), sysKW, 1e-5) && approx(num(r2['Engine Power']), sysKW * 0.65 / KW_PER_HP, 1e-3) && /HP$/.test(r2['Engine Power']), JSON.stringify([other, r2]));
      await setSystem(sys);
    }
    /* another vehicle: 425 hp = 316.922 kW */
    await profile({ hp: 425 }); await open('hybrid_power_split');
    const c425 = await chipOf('hps_p');
    check(`${tag}: 425 hp is offered as 316.922 kW`, c425 && approx(num(c425.text), 425 * KW_PER_HP, 1e-5), JSON.stringify(c425));
    check(`${tag}: still no shortcut on the fraction with 425 hp`, (await chipOf('hps_f')) === null, 'chip on hps_f');
    /* a vehicle whose hp happens to equal the fraction still gets no fraction shortcut (the old code hid the chip only when the numbers matched) */
    await profile({ hp: 0.65 }); await open('hybrid_power_split');
    check(`${tag}: no fraction shortcut when the vehicle value differs from the fraction by any amount`, (await chipOf('hps_f')) === null, 'chip on hps_f');
    await profile({ hp: 370 });
  }

  /* ---- 2. Save to vehicle ------------------------------------------------------------------------------------------------------------------------------------ */
  for (const sys of ['imperial', 'metric']) {
    /* the vehicle starts at 400 hp so that "unchanged" and "written 370" cannot be mistaken for each other */
    await setSystem(sys); await profile({ hp: 400, torque: 850, weight: 7500 }); await open('hybrid_power_split');
    await page.evaluate(() => { document.getElementById('hps_p').value = '275.909'; document.getElementById('hps_f').value = '0.5'; renderCalc('hybrid_power_split', false); });
    await page.evaluate(() => ghmSaveCurrentToVehicle());
    const prof = await profile({});
    check(`save-to-vehicle ${sys}: system 275.909 kW is written back as 370 hp (not 275.909, 0.5, 120 or the old 400)`, approx(prof.hp, 370.0, 1e-5), JSON.stringify(prof));
    check(`save-to-vehicle ${sys}: torque and weight are untouched`, prof.torque === 850 && prof.weight === 7500, JSON.stringify(prof));
    /* defaults: 120 kW = 160.922 hp, and the 0.65 fraction is never written */
    await profile({ hp: 400 }); await open('hybrid_power_split');
    await page.evaluate(() => ghmSaveCurrentToVehicle());
    const p2 = await profile({});
    check(`save-to-vehicle ${sys}: the default 120 kW is written as 160.92 hp, never as 120 or 0.65`, approx(p2.hp, 120 / KW_PER_HP, 1e-5), JSON.stringify(p2));
    /* boxes whose ids begin like a vehicle property but hold something else are never written into the vehicle. Two kinds of calculator: those with no box that is the property
       (the vehicle must be left exactly as it was), and the three weight-transfer calculators, which have one real weight box in pounds beside the g, % and inch boxes named wt_*
       (the vehicle's weight becomes that box and nothing else: its own 123 lbs for the one that is filled from the vehicle, 3,500 lbs for the other two, never 0.9 g, 55 %, 108 in or 20 in) */
    for (const [calc, prop, was, why] of [['optimal_shift', 'hp', 400, 'a torque box named hp_tq'], ['hydraulic_pump_flow', 'hp', 400, 'efficiency, RPM and displacement boxes named hpf_*']]) {
      await profile({ hp: 400, torque: 850, weight: 7500 }); await open(calc);
      await page.evaluate(() => ghmSaveCurrentToVehicle());
      const q = await profile({});
      check(`save-to-vehicle ${sys}: ${calc} (${why}) leaves the vehicle's ${prop} at ${was}`, q[prop] === was, JSON.stringify(q));
    }
    for (const [calc, want, why] of [['sim_weight_transfer', 123, 'g, % and inch boxes named wt_*; its pound box is filled from the vehicle'], ['weight_transfer_braking', 3500, 'g and inch boxes named wtb_*'], ['weight_transfer_accel', 3500, 'g and inch boxes named wta_*']]) {
      await profile({ hp: 400, torque: 850, weight: 123 }); await open(calc);
      await page.evaluate(() => ghmSaveCurrentToVehicle());
      const q = await profile({});
      check(`save-to-vehicle ${sys}: ${calc} (${why}) writes only its pound box, ${want} lbs`, approx(q.weight, want, 1e-5), JSON.stringify(q));
    }
    /* the boxes that ARE the property still save, in the unit the vehicle stores: hp_from_torque saves torque and rpm; the torque box typed in N·m (Metric) is stored in lb-ft */
    /* GH-IMP-019 (2026-10-13): engine torque shows lb-ft in Metric too (Torque = Auto), so the N·m case is made explicit: Torque = N·m, whichever system is on screen */
    await profile({ hp: 400, torque: 850, weight: 7500 });
    if (sys === 'metric') { await page.evaluate(() => setPerf('torque', 'N·m')); await page.waitForTimeout(40); }
    await open('hp_from_torque');
    await page.evaluate(() => { const t = document.getElementById('torq'); t.value = UNIT.system === 'metric' ? '678.0' : '500'; renderCalc('hp_from_torque', false); });
    await page.evaluate(() => ghmSaveCurrentToVehicle());
    const q2 = await profile({});
    check(`save-to-vehicle ${sys}: a torque box typed as ${sys === 'metric' ? '678.0 N·m (Torque = N·m)' : '500 lb-ft'} is saved as lb-ft`, approx(q2.torque, sys === 'metric' ? 678.0 / NM_PER_LBFT : 500, 1e-5), JSON.stringify(q2));
    if (sys === 'metric') { await page.evaluate(() => setPerf('torque', 'auto')); await page.waitForTimeout(40); }
    /* and under the default (Auto) a Metric torque box is lb-ft: 678.0 typed there is saved as 678.0 lb-ft */
    if (sys === 'metric') {
      await profile({ hp: 400, torque: 850, weight: 7500 }); await open('hp_from_torque');
      await page.evaluate(() => { const t = document.getElementById('torq'); t.value = '678.0'; renderCalc('hp_from_torque', false); });
      await page.evaluate(() => ghmSaveCurrentToVehicle());
      const q3 = await profile({});
      check('save-to-vehicle metric (Torque = Auto): a torque box typed as 678.0 lb-ft is saved as 678.0 lb-ft, not converted', approx(q3.torque, 678.0, 1e-9), JSON.stringify(q3));
    }
    await profile({ hp: 370, torque: 850, weight: 7500 });
  }

  /* ---- 3. every shortcut on every calculator, both systems ------------------------------------------------------------------------------------------------------ */
  /* the full run scans every calculator; a mutant run scans the calculators that matter to the shortcut (the recorded wrong boxes and the correct ones) to keep it short */
  const allIds = await page.evaluate(() => CALCS.map(c => c.id));
  const QUICK_IDS = [...Object.keys(NEVER_OFFERED), 'hp_from_torque', 'et_mph_prediction', 'engine_displacement', 'bmep', 'hp_to_kw', 'hp_to_ps', 'rpm_to_radsec', 'static_compression', 'reverse_displacement', 'hp_quarter_mile'];
  const ids = quick ? allIds.filter(i => QUICK_IDS.includes(i)) : allIds;
  for (const sys of ['imperial', 'metric']) {
    await setSystem(sys);
    await profile({ hp: 370, torque: 850, weight: 7500, peakRPM: 2800 });
    const scan = await page.evaluate((ids) => {
      const out = [];
      for (const id of ids) {
        try { delete CALC_PERSISTENT_STATE[id]; renderCalc(id, false); } catch (e) { continue; }
        document.querySelectorAll('#calc-container .field').forEach(f => {
          const inp = f.querySelector('input.field-input'), chip = f.querySelector('.profile-link');
          if (!inp || !chip) return;
          out.push({ calc: id, box: inp.id, shown: (f.querySelector('.field-unit') || {}).textContent || '', text: chip.textContent.trim(), title: chip.title });
        });
      }
      return out; }, ids);
    const prof = await profile({});
    const VALUE = { hp: prof.hp, torque: prof.torque, weight: prof.weight };
    let badFamily = 0, badNumber = 0, wrongOffered = 0;
    for (const c of scan) {
      const m = /^Use (.+?) from /.exec(c.title || ''); const prop = m && LABEL_TO_PROP[m[1]];
      const where = `${c.calc}:${c.box}`;
      if (!prop) { check(`${sys} shortcut ${where} names a known vehicle property`, false, c.title); continue; }
      const unitlessOk = c.shown === '' && UNITLESS_OK[c.box] === prop;
      const factor = unitlessOk ? 1 : (FAMILY[prop] || {})[c.shown];
      if (factor === undefined) { badFamily++; check(`${sys} shortcut ${where}: a "${prop}" value offered in a box that shows "${c.shown}"`, false, c.text); continue; }
      if (NEVER_OFFERED[c.calc] && NEVER_OFFERED[c.calc].includes(c.box)) { wrongOffered++; check(`${sys} shortcut ${where} must not be offered`, false, c.text); continue; }
      if (VALUE[prop] !== undefined) {
        const want = VALUE[prop] * factor, got = num(c.text);
        if (!approx(got, want, 1e-5)) { badNumber++; check(`${sys} shortcut ${where}: ${VALUE[prop]} ${prop} shown in "${c.shown}" should read ${want}`, false, c.text); }
      }
    }
    check(`${sys}: every shortcut on ${quick ? 'the ' + ids.length + ' calculators that matter' : 'all ' + ids.length + ' calculators'} is in a box of the same quantity (${scan.length} shortcuts)`, badFamily === 0, `${badFamily} in a box of another quantity`);
    check(`${sys}: every offered number is the vehicle value converted to the unit the box shows`, badNumber === 0, `${badNumber} wrong numbers`);
    check(`${sys}: none of the 18 recorded wrong boxes is offered a shortcut`, wrongOffered === 0, `${wrongOffered} offered`);
    /* the correct ones keep theirs: the shortcut still exists where it belongs */
    const have = new Set(scan.map(c => `${c.calc}:${c.box}`));
    for (const keep of ['hp_from_torque:torq', 'hp_from_torque:rpm_t', 'et_mph_prediction:hp_p', 'et_mph_prediction:wt_p', 'engine_displacement:bore_d', 'engine_displacement:str_d', 'engine_displacement:cyl_d', 'bmep:disp_b', 'hp_to_kw:hp_to_kw_x', 'hybrid_power_split:hps_p'])
      check(`${sys}: the correct shortcut ${keep} is still offered`, have.has(keep), 'missing');
    check(`${sys}: the correct shortcuts remain (at least 100 of the 128 offered before the fix)`, quick || scan.length >= 100, `${scan.length}`);
  }

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  return { checks, failures, lines };
}

/* ---- mutants: the engine with one fault put back; the suite must fail on each ---------------------------------------------------------------------------------------- */
/* each mutant is [name, text to find, replacement]; the text is looked up in the engine and the run is refused if it is not there exactly once */
const MUTANTS = require('./profile-shortcut.mutants.js');

(async () => {
  const engine = process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124);
  const main = await runSuite(engine, 'engine');
  console.log(main.lines.join('\n'));
  console.log(`profile-shortcut: ${main.checks} checks, ${main.failures} failed`);
  let bad = main.failures;
  if (process.env.MUTANTS !== '0' && main.failures === 0) {
    const src = fs.readFileSync(engine, 'utf8');
    for (const [name, find, repl] of MUTANTS) {
      const n = src.split(find).length - 1;
      if (n !== 1) { console.log(`  MUTANT ${name}: cannot be applied (found ${n} times)`); bad++; continue; }
      const file = path.join(os.tmpdir(), `gh-mutant-${process.pid}-${name.replace(/\W+/g, '_')}.html`);
      fs.writeFileSync(file, src.replace(find, () => repl));
      const r = await runSuite(file, name, true); fs.unlinkSync(file);
      const caught = r.failures > 0;
      console.log(`  mutant "${name}": ${caught ? `caught (${r.failures} checks failed)` : 'NOT CAUGHT'}`);
      if (!caught) bad++;
    }
  }
  process.exit(bad ? 1 : 0);
})();
