#!/usr/bin/env node
/* Gearhead Labs — GH-DEF-044: the IVC hand-off from the cam calculators to Dynamic Compression Ratio.

   WHAT WAS WRONG. Dynamic Compression's "↓ Pull IVC from Cam Card" button calls GHM_USE_CAM_IVC() (useIVC), which writes the cam's IVC into
   CALC_PERSISTENT_STATE.dynamic_compression.ica and re-renders Dynamic Compression. With that page already on screen, renderCalc first copies every box on
   screen into the same remembered state (the capture step kept by GH-DEF-021), overwriting the staged IVC with the box's old text; and the calculator reads
   its boxes on screen (vd), so the result was computed with the old IVC too. The box, the remembered value and the DCR stayed unchanged (35 -> 35,
   9.859 :1 -> 9.859 :1 for the default cam, IVC 38). The two cam-page buttons worked: there the screen holds a different page's boxes.

   INDEPENDENT REFERENCES (nothing taken from the engine):
     IVC (crank degrees ABDC) = intake duration @ .050 / 2 + (intake centreline - advance) - 180
       default cam 224 / 110 / 4 -> 38;  changed cam 236 / 108 / 0 -> 46
     DCR (slider-crank trapped volume): r = stroke / 2, theta = 180° + IVC, x = r(1 - cos theta) + rod - sqrt(rod² - (r sin theta)²),
       clearance = (pi bore² / 4) stroke / (SCR - 1), DCR = (area x + clearance) / clearance
       defaults bore 4.250, stroke 3.750, rod 6.760 in, SCR 10.5: IVC 35 -> 9.859, IVC 38 -> 9.745 (the values recorded in GH-DEF-044)
     Metric boxes are millimetres (x 25.4); IVC is degrees in both systems; DCR is a ratio in both.

   Sections (every case in a fresh browser profile; Imperial and Metric)
     A  all three buttons ("↓ Pull IVC from Cam Card" on Dynamic Compression, "↓ Use IVC in Dynamic Compression" on Intake Valve Closing — IVC,
        "↓ Send IVC to Dynamic Compression" on Complete Cam Card), default cam and a changed cam (236° / 108° / 0°): Dynamic Compression is on screen,
        the IVC box and the remembered value hold the cam's IVC to two decimals, and the DCR shown equals the reference with that IVC
     B  a typed IVC (42) is replaced by the pull; text typed afterwards (30) is used normally (box, remembered value, DCR)
     C  bore, stroke, rod and static CR (non-default values) are unchanged by the pull, character for character, and the DCR uses them
     D  the pulled IVC stays after leaving Dynamic Compression and returning (text "38.00"), and after a unit switch and back (IVC 38, DCR unchanged).
        A unit switch rewrites a box's text from its number, so "38.00" is shown as "38" afterwards; that is existing behaviour for any "38.00" in that box
        (typed by hand, or sent from the cam pages, which worked before the fix: checked on main ee4b993), so after a switch the IVC is compared by value.
     E  unchanged behaviour: opening Dynamic Compression without a pull shows its default IVC 35 and DCR 9.859
     M  mutant (temporary engine copy): useIVC restored to the version before the fix — the suite must fail

   Run: node premium/tests/ivc-handoff-def044.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed and the mutant was caught, 1 otherwise. */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
const ENGINE = process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124);
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

const MM = 25.4;
const ivcRef = (dur, icl, adv) => dur / 2 + (icl - adv) - 180;
const dcrRef = (bore, stroke, rod, scr, ivc) => {
  const r = stroke / 2, t = Math.PI + ivc * Math.PI / 180;
  const x = r * (1 - Math.cos(t)) + rod - Math.sqrt(rod * rod - (r * Math.sin(t)) ** 2);
  const area = Math.PI * bore * bore / 4, clearance = area * stroke / (scr - 1);
  return (area * x + clearance) / clearance;
};
const DEF = { bore: 4.25, stroke: 3.75, rod: 6.76, scr: 10.5 };
const CAMS = { default: { set: null, ivc: ivcRef(224, 110, 4) }, changed: { set: { cam_d050_i: 236, cam_icl: 108, cam_adv: 0 }, ivc: ivcRef(236, 108, 0) } };
const BUTTONS = [
  { page: 'dynamic_compression', text: 'Pull IVC from Cam Card' },
  { page: 'camshaft_ivc', text: 'Use IVC in Dynamic Compression' },
  { page: 'cam_card', text: 'Send IVC to Dynamic Compression' }
];
/* the button's on-screen behaviour before GH-DEF-044 was fixed: the line the mutant puts back */
const OLD_USE_IVC = "function useIVC(){var x=cam(ast().cam);CALC_PERSISTENT_STATE.dynamic_compression=CALC_PERSISTENT_STATE.dynamic_compression||{};CALC_PERSISTENT_STATE.dynamic_compression.ica=String(x.IVC.toFixed(2));renderCalc('dynamic_compression');}";

async function suite(browser, enginePath, quiet) {
  let checks = 0, failures = 0; const lines = [];
  const check = (label, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${label}: ${detail}`); } else if (process.env.VERBOSE && !quiet) lines.push(`  ok   ${label}`); };
  const fresh = async sys => {
    const ctx = await browser.newContext(); const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto('file://' + enginePath, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(300);
    await page.evaluate(s => { if (UNIT.system !== s) setUnit(s); renderCalc('dashboard', false); }, sys); await page.waitForTimeout(60);
    return { ctx, page, errors };
  };
  const open = async (page, id) => { await page.evaluate(i => renderCalc(i, false), id); await page.waitForTimeout(80); };
  const type = async (page, id, v) => { await page.fill('#' + id, String(v)); await page.waitForTimeout(40); };
  const click = async (page, text) => { await page.click(`#calc-container button:has-text("${text}")`); await page.waitForTimeout(120); };
  const read = page => page.evaluate(() => {
    const D = document, val = id => { const e = D.getElementById(id); return e ? e.value : null; };
    const box = [...D.querySelectorAll('#calc-container .result-box, #calc-container .mini-result')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).find(t => /^Dynamic Compression Ratio/.test(t)) || '';
    const m = box.replace(/^Dynamic Compression Ratio/, '').match(/[-+]?\d+(?:\.\d+)?/);
    return { page: (D.querySelector('#calc-container h2, #calc-container .calc-title') || {}).textContent || '', current: CONTAINER_CALC,
      ica: val('ica'), bore: val('dcr_bore'), stroke: val('str3'), rod: val('dcr_rod'), scr: val('scr'),
      remembered: (CALC_PERSISTENT_STATE.dynamic_compression || {}).ica, dcr: m ? Number(m[0]) : NaN, dcrText: box };
  });
  const toIn = (sys, s) => sys === 'metric' ? Number(s) / MM : Number(s);
  const dcrOf = (sys, r, ivc) => dcrRef(toIn(sys, r.bore), toIn(sys, r.stroke), toIn(sys, r.rod), Number(r.scr), ivc);
  const near = (a, b) => Number.isFinite(a) && Math.abs(a - b) <= 0.0006;   // DCR is shown to 3 decimals
  const is38 = s => /^38(\.0+)?$/.test(String(s));                          // after a unit switch "38.00" is shown as "38" (see D)

  /* references against the values recorded in GH-DEF-044 */
  check('0 reference: default cam IVC = 38', CAMS.default.ivc === 38, CAMS.default.ivc);
  check('0 reference: changed cam IVC = 46', CAMS.changed.ivc === 46, CAMS.changed.ivc);
  check('0 reference: DCR with IVC 35 = 9.859', dcrRef(DEF.bore, DEF.stroke, DEF.rod, DEF.scr, 35).toFixed(3) === '9.859', dcrRef(DEF.bore, DEF.stroke, DEF.rod, DEF.scr, 35));
  check('0 reference: DCR with IVC 38 = 9.745', dcrRef(DEF.bore, DEF.stroke, DEF.rod, DEF.scr, 38).toFixed(3) === '9.745', dcrRef(DEF.bore, DEF.stroke, DEF.rod, DEF.scr, 38));

  for (const sys of ['imperial', 'metric']) {
    /* ---- A ---- */
    for (const [camName, camCase] of Object.entries(CAMS)) for (const btn of BUTTONS) {
      const tag = `A ${sys} ${camName} cam, "${btn.text}" on ${btn.page}`;
      const { ctx, page, errors } = await fresh(sys);
      if (camCase.set) { await open(page, 'camshaft_ivc'); for (const [k, v] of Object.entries(camCase.set)) await type(page, k, v); }
      let before = null;
      if (btn.page === 'dynamic_compression') { await open(page, 'dynamic_compression'); before = await read(page); }
      else await open(page, btn.page);
      await click(page, btn.text);
      const r = await read(page), want = camCase.ivc.toFixed(2);
      check(`${tag}: Dynamic Compression on screen`, r.current === 'dynamic_compression' && /Dynamic Compression/.test(r.page), `${r.current} "${r.page}"`);
      check(`${tag}: IVC box shows ${want}`, r.ica === want, `box ${before ? before.ica + ' -> ' : ''}${r.ica}`);
      check(`${tag}: remembered IVC is ${want}`, r.remembered === want, `remembered ${r.remembered}`);
      const ref = dcrOf(sys, r, camCase.ivc);
      check(`${tag}: DCR shown = reference ${ref.toFixed(3)} with IVC ${want}`, near(r.dcr, ref), `shown "${r.dcrText}"${before ? ' (before: ' + before.dcrText + ')' : ''}`);
      if (before) check(`${tag}: bore / stroke / rod / SCR boxes unchanged`, ['bore', 'stroke', 'rod', 'scr'].every(k => r[k] === before[k]), JSON.stringify([before, r].map(x => [x.bore, x.stroke, x.rod, x.scr])));
      check(`${tag}: no page error`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ---- B ---- */
    {
      const tag = `B ${sys}`; const { ctx, page, errors } = await fresh(sys);
      await open(page, 'dynamic_compression'); await type(page, 'ica', 42);
      const t1 = await read(page);
      check(`${tag}: typing 42 updates the DCR (control)`, t1.ica === '42' && near(t1.dcr, dcrOf(sys, t1, 42)), JSON.stringify(t1));
      await click(page, 'Pull IVC from Cam Card');
      const p = await read(page);
      check(`${tag}: the pull replaces the typed 42 with 38.00 (box, remembered, DCR)`, p.ica === '38.00' && p.remembered === '38.00' && near(p.dcr, dcrOf(sys, p, 38)), JSON.stringify(p));
      await type(page, 'ica', 30);
      const t2 = await read(page);
      check(`${tag}: typing 30 after the pull is used (box, remembered, DCR)`, t2.ica === '30' && t2.remembered === '30' && near(t2.dcr, dcrOf(sys, t2, 30)), JSON.stringify(t2));
      check(`${tag}: no page error`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ---- C ---- */
    {
      const tag = `C ${sys}`; const { ctx, page, errors } = await fresh(sys);
      const vals = sys === 'metric' ? { dcr_bore: 102.4, str3: 88.4, dcr_rod: 155.5, scr: 9.8 } : { dcr_bore: 4.03, str3: 3.48, dcr_rod: 6.123, scr: 9.8 };
      await open(page, 'dynamic_compression'); for (const [k, v] of Object.entries(vals)) await type(page, k, v);
      const b = await read(page);
      await click(page, 'Pull IVC from Cam Card');
      const a = await read(page);
      check(`${tag}: typed bore / stroke / rod / SCR unchanged by the pull (${Object.values(vals).join(' / ')})`,
        a.bore === String(vals.dcr_bore) && a.stroke === String(vals.str3) && a.rod === String(vals.dcr_rod) && a.scr === String(vals.scr) && ['bore', 'stroke', 'rod', 'scr'].every(k => a[k] === b[k]), JSON.stringify([b, a].map(x => [x.bore, x.stroke, x.rod, x.scr])));
      check(`${tag}: IVC 38.00 and DCR = reference with those values`, a.ica === '38.00' && near(a.dcr, dcrOf(sys, a, 38)), `${a.ica} "${a.dcrText}" ref ${dcrOf(sys, a, 38).toFixed(3)}`);
      check(`${tag}: no page error`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ---- D ---- */
    {
      const tag = `D ${sys}`; const { ctx, page, errors } = await fresh(sys);
      await open(page, 'dynamic_compression'); await click(page, 'Pull IVC from Cam Card');
      const p = await read(page);
      await open(page, 'mean_piston_speed'); await open(page, 'dynamic_compression');
      const back = await read(page);
      check(`${tag}: after leaving and returning, IVC 38.00 and the same DCR`, back.ica === '38.00' && near(back.dcr, p.dcr), `${p.ica} ${p.dcr} -> ${back.ica} ${back.dcr}`);
      const other = sys === 'metric' ? 'imperial' : 'metric';
      await page.evaluate(s => setUnit(s), other); await page.waitForTimeout(150);
      const sw = await read(page);
      check(`${tag}: after switching to ${other}, IVC 38 and the same DCR (bore now ${sw.bore})`, is38(sw.ica) && is38(sw.remembered) && near(sw.dcr, p.dcr) && near(sw.dcr, dcrOf(other, sw, 38)), JSON.stringify(sw));
      await page.evaluate(s => setUnit(s), sys); await page.waitForTimeout(150);
      const sb = await read(page);
      check(`${tag}: after switching back to ${sys}, IVC 38, the same DCR and the same bore text`, is38(sb.ica) && is38(sb.remembered) && near(sb.dcr, p.dcr) && sb.bore === p.bore, `${JSON.stringify(p)} -> ${JSON.stringify(sb)}`);
      check(`${tag}: no page error`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ---- E ---- */
    {
      const tag = `E ${sys}`; const { ctx, page, errors } = await fresh(sys);
      await open(page, 'mean_piston_speed'); await open(page, 'dynamic_compression');
      const r = await read(page);
      check(`${tag}: opened without a pull: IVC 35, DCR 9.859`, r.ica === '35' && near(r.dcr, dcrRef(DEF.bore, DEF.stroke, DEF.rod, DEF.scr, 35)), JSON.stringify(r));
      check(`${tag}: no page error`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  }
  return { checks, failures, lines };
}

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const main = await suite(browser, ENGINE, false);
  main.lines.forEach(l => console.log(l));
  /* M: put the pre-fix useIVC back; the suite must fail */
  const src = fs.readFileSync(ENGINE, 'utf8'); let mutantNote;
  const m = src.match(/function useIVC\(\)\{[^\n]*?renderCalc\('dynamic_compression'\);\}/);
  if (!m) mutantNote = 'FAIL mutant: useIVC not found';
  else if (m[0] === OLD_USE_IVC) mutantNote = 'mutant skipped: this engine already has the pre-fix useIVC';
  else {
    const f = path.join(os.tmpdir(), `gh-def044-mutant-${process.pid}.html`); fs.writeFileSync(f, src.replace(m[0], OLD_USE_IVC));
    const r = await suite(browser, f, true); fs.unlinkSync(f);
    mutantNote = r.failures ? `mutant "useIVC before the fix": caught (${r.failures} checks failed)` : 'mutant "useIVC before the fix": NOT CAUGHT';
  }
  await browser.close();
  console.log('  ' + mutantNote);
  const mutantOk = /caught \(/.test(mutantNote);
  console.log(`\nivc-handoff GH-DEF-044 tests: ${main.checks} checks, ${main.failures} failure(s); ${mutantOk ? 'mutant caught' : 'mutant not caught'}`);
  process.exit(main.failures || !mutantOk ? 1 : 0);
})();
