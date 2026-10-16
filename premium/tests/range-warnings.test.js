#!/usr/bin/env node
/* Gearhead Labs — the soft "Unusual ..." range warnings under a box (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-028).

   THE RECORDED DEFECT. A box shows an amber "Unusual bore — typical range is 1.5–6.5" when its number is outside a sanity range. The range was picked by a regular expression on the first letters of the
   box id, so any id that begins with "bore" was checked as an engine bore ("Balancer Diameter" in Timing Mark, id bore5), any id that begins with "wt" as a vehicle weight (the weight-transfer
   geometry boxes wt_wb, wt_track ...), "hp_" as an engine power (hp_to_kw_x, the torque at peak power hp_tq) and so on: 21 boxes of 161 that matched. And the limits are written in the Imperial
   unit (in, lb) while, once a box had been re-drawn from what is on screen (after pressing Metric, or after typing), the number compared was the one shown (mm, kg), so 100 mm (a normal bore) was
   compared with 6.5 and 6,000 kg (13,228 lb, too heavy) with 12,000.

   WHAT IS CHECKED (real Chromium; every expectation is written out here from the limits above and exact unit definitions, nothing is read from the engine):
     A. THE 140 BOXES THAT ARE THE QUANTITY (premium/tests/data/range-boxes.json, the record of what matched before the fix, classified by what the box holds): a number typed into the box warns
        exactly when the physical value is outside its range, with the text for ITS quantity, in Imperial, in Metric, and with the Power preference on kW; so no valid warning is removed or redirected;
     B. THE 21 BOXES THE ID MATCH REACHED BY ACCIDENT: an out-of-range number typed into them (for the rule they used to match) never warns, in either system;
     C. pressing Metric / Imperial moves no warning: boxes typed with a mix of in-range and out-of-range numbers keep the same state through Imperial -> Metric -> Imperial;
     D. all 696 calculators at their defaults, through a live Imperial -> Metric -> Imperial switch: a warning appears only on a box of the list in A, and the set of warnings is the same in both systems;
     E. the lookup itself (checkFieldRange(id, value, calc)): the same id in a calculator where it is not the quantity does not warn; an unlisted calculator or id does not warn; and the register's
        verification case: Timing Mark "Balancer Diameter" shows no warning in Imperial, none after pressing Metric, and still none for a typed 9 in.

   Run: node premium/tests/range-warnings.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine; FAST=1 types 2 values per box instead of 5; MAXLINES=n prints n failures, default 60)
   Exit code 0 = every check passed, 1 otherwise. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'range-boxes.json'), 'utf8'));

/* the sanity ranges, in the Imperial canonical unit (in, rpm, ratio, lb, hp, :1) — the established limits, unchanged */
const RANGE = {
  bore: { min: 1.5, max: 6.5 }, stroke: { min: 1.5, max: 6.0 }, RPM: { min: 300, max: 12000 }, VE: { min: 0.3, max: 1.4 },
  weight: { min: 200, max: 12000 }, HP: { min: 20, max: 5000 }, 'compression ratio': { min: 6, max: 20 }, AFR: { min: 8, max: 20 }
};
const warnText = q => `Unusual ${q} — typical range is ${RANGE[q].min}–${RANGE[q].max}`;
const outside = (q, canon) => canon < RANGE[q].min || canon > RANGE[q].max;
/* exact unit definitions: what one displayed unit is in the canonical unit */
const LB = 0.45359237, KW_PER_HP = 550 * 0.3048 * LB * 9.80665 / 1000;
const TO_CANON = { lbs: 1, kg: 1 / LB, in: 1, mm: 1 / 25.4, HP: 1, hp: 1, kW: 1 / KW_PER_HP, RPM: 1, rpm: 1, ':1': 1, '': 1 };
/* canonical test values per quantity: well below, just above the lower limit, the middle, just below the upper limit, well above.  For weight and bore the middle values are on the OTHER side of the
   limit when read as kg / mm (220 lb = 99.8 kg < 200; 3.5 in = 88.9 mm > 6.5) and 18,000 lb = 8,165 kg < 12,000, which is what the old comparison got wrong */
const VALUES = q => {
  const { min, max } = RANGE[q];
  const v = [0.5 * min, 1.1 * min, (min + max) / 2, 0.95 * max, 1.5 * max];
  return process.env.FAST ? [v[1], v[4]] : v;
};
const typed = x => String(+x.toPrecision(6));

const BOXES = DATA.boxes, NOT_BOXES = DATA.not_boxes;
const OLD_RULE_VALUE = { bore: 9, stroke: 9, RPM: 90000, VE: 5, weight: 90000, HP: 90000, 'compression ratio': 50, AFR: 50 };   // out of range in every unit a box could show
const byCalc = list => { const m = new Map(); list.forEach(b => { if (!m.has(b.calc)) m.set(b.calc, []); m.get(b.calc).push(b); }); return m; };

async function run(enginePath) {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(30000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + enginePath, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(400);
  let checks = 0, failures = 0; const lines = []; const failuresBySection = {};
  let section = '?';
  const check = (name, ok, detail) => { checks++; if (!ok) { failures++; failuresBySection[section] = (failuresBySection[section] || 0) + 1; if (lines.length < (+process.env.MAXLINES || 60)) lines.push(`  FAIL [${section}] ${name}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${name}`); };

  const setSystem = s => page.evaluate(x => setUnit(x), s);
  const setPref = async (kind, value) => { if ((await page.inputValue('#sel-' + kind)) !== value) await page.selectOption('#sel-' + kind, value); };
  const fresh = calc => page.evaluate(c => { try { delete CALC_PERSISTENT_STATE[c]; delete CALC_STATE_META[c]; } catch (e) {} renderCalc(c, false); }, calc);
  const typeInto = (id, text) => page.evaluate(({ id, text }) => { const el = document.getElementById(id); if (!el) return false; el.value = text; el.dispatchEvent(new Event('input', { bubbles: true })); return true; }, { id, text });
  /* the box as the person sees it: its unit label, its number, and the warning text under it */
  const look = id => page.evaluate(i => {
    const el = document.getElementById(i); if (!el) return null;
    const f = el.closest('.field'), u = (el.closest('.input-wrap') || f).querySelector('.field-unit'), w = f.querySelector('.field-warning-text');
    return { unit: u ? u.textContent.trim() : '', value: el.value, warn: w ? w.textContent.replace(/^⚠\s*/, '').trim() : null, flagged: el.classList.contains('field-warning') };
  }, id);
  const allWarned = () => page.evaluate(() => Array.from(document.querySelectorAll('#calc-container .field-input')).filter(el => el.closest('.field').querySelector('.field-warning-text')).map(el => el.id));
  const legit = new Set(BOXES.map(b => b.calc + '.' + b.id));

  /* ================= A. the 140 boxes keep their warnings ================= */
  section = 'A';
  const unitErrors = [];
  async function passA(sys, pw, tq, calcs) {
    await setPref('power', pw); await setPref('torque', tq); await setSystem(sys);
    for (const [calc, boxes] of calcs) {
      await fresh(calc);
      for (const b of boxes) {
        const q = b.quantity;
        for (const canon of VALUES(q)) {
          const first = await look(b.id);
          if (!first) { check(`${calc}.${b.id} present`, false, 'box not on the page'); break; }
          const unit = first.unit;
          if (!(unit in TO_CANON)) { unitErrors.push(`${calc}.${b.id}: unit label "${unit}"`); break; }
          const text = typed(canon / TO_CANON[unit]);
          await typeInto(b.id, text);
          const got = await look(b.id);
          const wantWarn = outside(q, canon / 1);   // the physical value the person meant (typed rounding is 6 digits, far from every limit used)
          const tag = `${sys} ${pw}/${tq} ${calc}.${b.id} ${q}: ${text} ${unit} (= ${typed(canon)} canonical)`;
          if (wantWarn) check(tag, got.warn === warnText(q) && got.flagged, `wanted "${warnText(q)}", box shows ${JSON.stringify(got.warn)}`);
          else check(tag, got.warn === null && !got.flagged, `wanted no warning, box shows ${JSON.stringify(got.warn)}`);
        }
      }
    }
  }
  const allCalcs = byCalc(BOXES);
  const hpCalcs = byCalc(BOXES.filter(b => b.quantity === 'HP'));
  const hpCalcsFull = new Map(Array.from(hpCalcs.keys()).map(c => [c, allCalcs.get(c)]));
  for (const sys of ['imperial', 'metric']) await passA(sys, 'hp', 'lb-ft', allCalcs);
  for (const sys of ['imperial', 'metric']) await passA(sys, 'kW', 'N·m', hpCalcsFull);     // the power boxes read in kW: the same hp limits apply
  await setPref('power', 'Auto'); await setPref('torque', 'Auto');
  if (unitErrors.length) check('every box shows a unit this test knows', false, unitErrors.slice(0, 5).join('; '));

  /* ================= B. the 21 accidental matches never warn ================= */
  section = 'B';
  async function passB(sys) {
    await setSystem(sys);
    for (const [calc, boxes] of byCalc(NOT_BOXES)) {
      await fresh(calc);
      for (const b of boxes) {
        const q = b.matched_as, text = String(OLD_RULE_VALUE[q]);
        const there = await typeInto(b.id, text);
        const got = await look(b.id);
        check(`${sys} ${calc}.${b.id} (was matched as ${q}): ${text}`, there && got && got.warn === null && !got.flagged, `box shows ${JSON.stringify(got && got.warn)}`);
      }
    }
  }
  for (const sys of ['imperial', 'metric']) await passB(sys);
  await setSystem('imperial');

  /* ================= C. pressing Metric / Imperial moves no warning ================= */
  section = 'C';
  for (const pw of ['hp', 'kW']) {
    await setPref('power', pw); await setPref('torque', pw === 'kW' ? 'N·m' : 'lb-ft');
    for (const [calc, boxes] of (pw === 'kW' ? hpCalcsFull : allCalcs)) {
      await setSystem('imperial'); await fresh(calc);
      const want = {};
      let k = 0;
      for (const b of boxes) {                       // a mix: boxes typed with different values, so some warn and some do not
        const vals = VALUES(b.quantity), canon = vals[(k++) % vals.length];
        const unit = (await look(b.id)).unit;
        await typeInto(b.id, typed(canon / TO_CANON[unit]));
        want[b.id] = outside(b.quantity, canon) ? warnText(b.quantity) : null;
      }
      for (const sys of ['metric', 'imperial', 'metric', 'imperial']) {
        await setSystem(sys);
        for (const b of boxes) {
          const got = await look(b.id);
          check(`${pw} ${calc}.${b.id} after ${sys}`, got && got.warn === want[b.id], `wanted ${JSON.stringify(want[b.id])}, box shows ${JSON.stringify(got && got.warn)} (${got && got.value} ${got && got.unit})`);
        }
      }
    }
  }
  await setPref('power', 'Auto'); await setPref('torque', 'Auto'); await setSystem('imperial');

  /* ================= D. every calculator at its defaults, through a live switch ================= */
  section = 'D';
  const ids = await page.evaluate(() => CALCS.filter(c => c.id !== 'dashboard').map(c => c.id));
  let swept = 0, warnedTotal = 0;
  const bad = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const rows = await page.evaluate(list => {
      const out = [];
      const warned = () => Array.from(document.querySelectorAll('#calc-container .field-input')).filter(el => el.closest('.field').querySelector('.field-warning-text')).map(el => el.id).sort();
      for (const id of list) {
        try {
          setUnit('imperial'); renderCalc('hp_quarter_mile', false); delete CALC_PERSISTENT_STATE[id]; delete CALC_STATE_META[id]; renderCalc(id, false);
          const a = warned(); setUnit('metric'); const b = warned(); setUnit('imperial'); const c = warned();
          out.push({ id, a, b, c });
        } catch (e) { out.push({ id, error: String(e) }); }
      }
      setUnit('imperial');
      return out;
    }, chunk);
    for (const r of rows) {
      swept++;
      if (r.error) { bad.push(`${r.id}: ${r.error}`); continue; }
      const all = new Set([...r.a, ...r.b, ...r.c]); warnedTotal += all.size;
      for (const w of all) if (!legit.has(r.id + '.' + w)) bad.push(`${r.id}.${w} warns but is not a listed box`);
      if (JSON.stringify(r.a) !== JSON.stringify(r.b) || JSON.stringify(r.a) !== JSON.stringify(r.c)) bad.push(`${r.id}: warnings differ between systems: imperial ${JSON.stringify(r.a)}, metric ${JSON.stringify(r.b)}, back ${JSON.stringify(r.c)}`);
    }
  }
  check(`all ${ids.length} calculators: a warning only on a listed box, the same set in both systems`, bad.length === 0, `${bad.length} problem(s): ${bad.slice(0, 6).join(' | ')}`);
  check('the sweep reached every calculator', swept === ids.length && swept >= 690, `swept ${swept} of ${ids.length}`);

  /* ================= E. the lookup, and the register's verification case ================= */
  section = 'E';
  const lookup = (id, v, calc) => page.evaluate(({ id, v, calc }) => checkFieldRange(id, v, calc), { id, v, calc });
  check('bore5 in Timing Mark (a balancer diameter) is not a bore', (await lookup('bore5', 9, 'timing_mark')) === null, 'warns');
  check('bore2 in Static Compression is a bore', (await lookup('bore2', 9, 'static_compression')) === warnText('bore'), 'no warning');
  check('the same id in a calculator where it is not the quantity does not warn', (await lookup('bore2', 9, 'timing_mark')) === null, 'warns');
  check('wt in Quarter Mile is a weight', (await lookup('wt', 20000, 'hp_quarter_mile')) === warnText('weight'), 'no warning');
  check('wt_wb (a wheelbase) in Weight Transfer is not a weight', (await lookup('wt_wb', 20, 'sim_weight_transfer')) === null, 'warns');
  check('an unlisted calculator does not warn', (await lookup('wt', 20000, 'no_such_calculator')) === null, 'warns');
  check('no calculator given does not warn', (await lookup('wt', 20000, undefined)) === null, 'warns');
  check('an unlisted id does not warn', (await lookup('zzz_unlisted', 99999999, 'hp_quarter_mile')) === null, 'warns');
  check('a value inside the range does not warn', (await lookup('wt', 3000, 'hp_quarter_mile')) === null, 'warns');
  check('zero and not-a-number do not warn', (await lookup('wt', 0, 'hp_quarter_mile')) === null && (await lookup('wt', NaN, 'hp_quarter_mile')) === null, 'warns');

  await setSystem('imperial'); await fresh('timing_mark');
  let l = await look('bore5');
  check('Balancer Diameter, Imperial default (4.25 in): no warning', l && l.warn === null && /^4\.25$/.test(l.value), JSON.stringify(l));
  await setSystem('metric'); l = await look('bore5');
  check('Balancer Diameter after pressing Metric (107.95 mm): no warning', l && l.warn === null && /^107\.95$/.test(l.value) && l.unit === 'mm', JSON.stringify(l));
  await page.fill('#bore5', '9'); await page.waitForTimeout(40); l = await look('bore5');
  check('Balancer Diameter typed 9 (mm): no warning', l && l.warn === null, JSON.stringify(l));
  await setSystem('imperial'); l = await look('bore5');
  check('Balancer Diameter back in Imperial: no warning', l && l.warn === null, JSON.stringify(l));
  await fresh('static_compression'); await setSystem('metric');
  await page.fill('#bore2', '100'); await page.waitForTimeout(40); l = await look('bore2');
  check('Static Compression bore typed 100 mm (3.94 in): no warning (was a false one)', l && l.warn === null && l.unit === 'mm', JSON.stringify(l));
  await page.fill('#bore2', '200'); await page.waitForTimeout(40); l = await look('bore2');
  check('Static Compression bore typed 200 mm (7.87 in): the bore warning', l && l.warn === warnText('bore'), JSON.stringify(l));
  await setSystem('imperial');

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  return { checks, failures, lines, failuresBySection };
}

(async () => {
  const enginePath = process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124);
  const t0 = Date.now();
  const r = await run(enginePath);
  console.log(`range-warnings: ${r.checks} checks, ${r.failures} failed (${Math.round((Date.now() - t0) / 1000)} s)  engine ${path.basename(enginePath)}`);
  if (r.failures) console.log('  failures by section: ' + JSON.stringify(r.failuresBySection));
  r.lines.forEach(x => console.log(x));
  process.exit(r.failures ? 1 : 0);
})().catch(e => { console.error('TEST ERROR', e && e.stack || e); process.exit(2); });
