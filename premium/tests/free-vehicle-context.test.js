#!/usr/bin/env node
/* Gearhead Labs — the calculators have no active vehicle, for every visitor (docs/DEFERRED-WORK-REGISTER.md, GH-IMP-022; owner decisions 2026-10-17 and
   2026-10-19, Stage 2, Task 3). The engine is one file for everyone: the switch is not tied to an account, and no production code connects My Garage
   vehicles to the calculators (Premium vehicle-to-calculator integration is not implemented; this test does not claim it).

   BEFORE. The engine's diesel block replaced the vehicle list with five seeded demo vehicles, made "2024 Ram 2500 6.7L Cummins — Diesel Demo" active and
   wrote that list to browser storage on every load (overwriting any vehicle a visitor had made). Every Free visitor therefore had a demo truck as "their"
   vehicle: 83 calculators offered "↓ use 850 / Use torque from 2024 Ram 2500 ... Diesel Demo" shortcuts, the six simulators and the two airflow calculators
   took their default inputs from it, and the dashboard named it.
   NOW. `const GH_VEHICLE_CONTEXT = false;` — getActiveProfile() returns null, no seeded or stored vehicle is used, nothing is written to storage, the
   vehicle-profile manager is not offered (header button hidden, dashboard buttons not drawn), the dashboard template shows a neutral empty state
   ("No vehicle profile selected" / "Calculators use their own default values." instead of "Create a vehicle profile ..."), and
   the eight affected calculators open on their own coded defaults. The profile machinery itself is unchanged (tested by profile-shortcut, performance-units
   and dashboard-summary on a copy with the switch on: lib/vehicle-context.js).

   WHAT THIS TEST CHECKS — the real shell (index.html, served locally, every outside request blocked), real Chromium, at 1280 x 900 and 375 x 812, for
     C  a clean browser profile, and
     S  a browser profile that already holds the old stored list (the Diesel Demo active) plus a vehicle the visitor made:
     1. the engine's switch is off and getActiveProfile() is null;
     2. EVERY calculator in the engine (CALCS, rendered one by one in the frame) shows zero ".profile-link" shortcuts — and the scan is not vacuous: it
        counts the boxes whose id the vehicle map would match (PROFILE_FIELD_MAP), which must be at least 100;
     3. browser storage: clean profile -> no vehicle list is written; stored profile -> the stored text is byte-identical after loading and browsing
        (nothing cleared, rewritten or deleted);
     4. the header's vehicle-profile button is in the page but not displayed; the dashboard template shows "No vehicle profile selected" and
        "Calculators use their own default values.", does not say "Create a vehicle profile", draws no "Manage Vehicle" / "Vehicle Profiles" button and
        names no vehicle;
     5. the eight calculators that took vehicle defaults open on their coded defaults (four simulators are Premium-locked for a Free visitor, so their
        boxes are not drawn; for those the simulators' default source simProfile() is checked) (simulators 3,200 lb and 300 HP; Engine Airflow Estimation 350 ci,
        6,500 RPM, 8 cylinders; Airflow -> Power 350 ci, 6,500 RPM), and Engine Airflow Estimation's flow equals displacement x RPM / 2 x VE / 1728
        computed here from its own boxes;
     6. search ("hp torque") lists HP from Torque and Torque from HP, and HP from Torque at 600 lb-ft x 4,000 RPM shows 457 HP (600 x 4000 / 5252 = 456.97);
     7. no page errors.
     P  A signed-in account granted Premium (the shell's local development sign-in and its development Premium grant, real engine file, 1280 x 900):
        the entitlement is Premium, the Premium-locked Dragstrip draws its boxes (no upsell) on the coded 3,200 lb default, and the same holds as for a
        visitor: no active vehicle, no shortcut on any calculator, the profile manager not offered. (The production Premium grant comes from the server;
        the engine and premium-calculator-gating.js take the same path for either source.)
   MUTANTS (each must make the test fail; MUTANTS=0 skips): the switch turned on; the null guard removed from getActiveProfile(); the demo vehicle made active
   and written to storage again; the stored list rewritten on load (benchmark vehicles merged in); the dashboard reading the vehicle list directly; the header button no longer hidden; the old "Create a vehicle profile" empty-state text.

   Run: node premium/tests/free-vehicle-context.test.js   (VERBOSE=1 prints passes; GH_REPO=dir tests another checkout)
   Exit code 0 = every check passed and every mutant was caught, 1 otherwise. */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), { execSync } = require('child_process');
const REPO = process.env.GH_REPO ? path.resolve(process.env.GH_REPO) : path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const STORE_KEY = 'gearhead_d31_ghm_profiles';   // GHM_STORAGE prefixes every key with gearhead_d31_
/* the list the old engine wrote on every load (Diesel Demo active) plus a vehicle the visitor made */
const STORED = JSON.stringify([
  { id: 6101, name: '2024 Ram 2500 6.7L Cummins — Diesel Demo', vehicleType: 'Diesel', hp: 370, torque: 850, weight: 7500, bore: 4.21, stroke: 4.88, cylinders: 6, displacement: 408, peakRPM: 2800, benchmark: true, active: true },
  { id: 6102, name: '2024 Ford F-250 6.7L Power Stroke — Diesel Demo', vehicleType: 'Diesel', hp: 500, torque: 1200, weight: 7800, bore: 3.9, stroke: 4.25, cylinders: 8, displacement: 401, peakRPM: 2800, benchmark: true, active: false },
  { id: 777001, name: 'My own test truck', vehicleType: 'Diesel', hp: 410, torque: 900, weight: 7000, bore: 4.1, stroke: 4.5, cylinders: 6, displacement: 360, peakRPM: 3000, active: false }
]);
const DEFAULTS = {   // the calculators' own coded defaults (the fallbacks in simProfile() and the airflow extension), written out here
  sim_acceleration: { sim_weight: 3200, sim_hp: 300 }, sim_braking: { sim_weight: 3200, sim_hp: 300 }, sim_cornering: { sim_weight: 3200, sim_hp: 300 },
  sim_top_speed: { sim_weight: 3200, sim_hp: 300 }, sim_dragstrip: { sim_weight: 3200, sim_hp: 300 }, sim_weight_transfer: { sim_weight: 3200, sim_hp: 300 },
  engine_airflow_estimate: { air_d: 350, air_r: 6500, air_n: 8 }, airflow_power_estimate: { ap_d: 350, ap_r: 6500 }
};

function serve(overrides = {}) {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
      const rel = p.replace(/^\//, ''), f = path.join(REPO, p);
      if (overrides[rel] !== undefined) { rsp.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); return rsp.end(overrides[rel]); }
      if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

/* runs in the engine frame: every calculator, its shortcuts and the boxes the vehicle map would match */
const SCAN = () => {
  let chips = 0, mapped = 0; const withChips = [];
  const map = typeof PROFILE_FIELD_MAP !== 'undefined' ? PROFILE_FIELD_MAP : [];
  for (const c of CALCS) {
    renderCalc(c.id, false);
    const box = document.getElementById('calc-container');
    const n = box.querySelectorAll('.profile-link').length; chips += n; if (n) withChips.push(c.id);
    box.querySelectorAll('input.field-input[id]').forEach(i => { if (map.some(m => m.pattern.test(i.id))) mapped++; });
  }
  return { calcs: CALCS.length, chips, mapped, withChips: withChips.slice(0, 5) };
};
const STATE = key => {
  const d = document.createElement('div'); d.innerHTML = RENDERS.dashboard(); const t = d.textContent.replace(/\s+/g, ' ');
  const b = document.querySelector('.gh-profile-btn'); let shown = false;
  if (b) { const r = b.getBoundingClientRect(); shown = r.width > 0 && r.height > 0; for (let a = b; a && shown; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden') shown = false; } }
  return { context: typeof GH_VEHICLE_CONTEXT === 'undefined' ? 'undefined' : GH_VEHICLE_CONTEXT, active: getActiveProfile(), stored: localStorage.getItem(key),
    button: !!b, buttonShown: shown, dashEmpty: /No vehicle profile selected/.test(t) && /Calculators use their own default values\./.test(t) && !/Create a vehicle profile/.test(t), dashButtons: d.querySelectorAll('[onclick*="showProfiles"]').length,
    dashNamesVehicle: /Diesel Demo|Ram 2500|My own test truck/.test(t) };
};
const DEFAULTS_READ = defs => {
  const out = {};
  const sp = simProfile();   // the simulators' defaults: what a Premium-locked simulator would open on (its boxes are not drawn for a Free visitor)
  for (const id of Object.keys(defs)) {
    renderCalc(id, false); out[id] = {};
    const locked = !!document.querySelector('#calc-container .gh-premium-upsell');
    for (const box of Object.keys(defs[id])) {
      const el = document.getElementById(box);
      out[id][box] = el ? Number(el.value) : locked && box === 'sim_weight' ? sp.weight : locked && box === 'sim_hp' ? sp.hp : null;
    }
    if (locked) out[id].locked = true;
  }
  renderCalc('engine_airflow_estimate', false);
  const n = id => Number(document.getElementById(id).value), twoStroke = (document.getElementById('air_cycle') || {}).value === '2';
  const flow = n('air_d') * n('air_r') * (twoStroke ? 1 : 0.5) * n('air_ve') / 1728;
  const shown = [...document.querySelectorAll('#calc-container .result-value, #calc-container .mini-result .value')].map(e => e.textContent).join(' | ');
  out.flow = { expected: flow, shown };
  return out;
};

async function scenario(browser, port, label, viewport, stored, c) {
  const ctx = await browser.newContext({ viewport }); const page = await ctx.newPage(); page.setDefaultTimeout(15000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e.message || e).slice(0, 160)));
  await page.route('**/*', rt => rt.request().url().startsWith(`http://127.0.0.1:${port}/`) ? rt.continue() : rt.abort());
  if (stored) await ctx.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } } catch (e) {} }, [STORE_KEY, stored]);
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => document.getElementById('boot') && document.getElementById('boot').classList.contains('hide'), null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  const fr = page.frames().find(f => f.url().includes(F124));
  if (!fr) { c('the engine frame loaded', false, 'no frame'); await ctx.close(); return; }
  const s0 = await fr.evaluate(STATE, STORE_KEY);
  c('the vehicle switch is off and there is no active vehicle', s0.context === false && s0.active === null, JSON.stringify({ context: s0.context, active: s0.active && s0.active.name }));
  const scan = await fr.evaluate(SCAN);
  c(`no "use" vehicle shortcut on any of the ${scan.calcs} calculators (boxes the vehicle map matches: ${scan.mapped}, must be >= 100)`, scan.chips === 0 && scan.mapped >= 100 && scan.calcs >= 700, JSON.stringify(scan));
  const d = await fr.evaluate(DEFAULTS_READ, DEFAULTS);
  const wrong = Object.keys(DEFAULTS).filter(id => Object.keys(DEFAULTS[id]).some(b => d[id][b] !== DEFAULTS[id][b]));
  const locked = Object.keys(DEFAULTS).filter(id => d[id].locked);
  c(`the eight calculators that took vehicle defaults open on their own coded defaults (Premium-locked here, checked through simProfile(): ${locked.join(', ') || 'none'})`,
    wrong.length === 0 && locked.every(id => /^sim_/.test(id)), JSON.stringify(wrong.map(id => [id, d[id]])));
  const flowOk = /\d/.test(d.flow.shown) && d.flow.shown.split('|').some(s => Math.abs(parseFloat(s.replace(/,/g, '')) - d.flow.expected) <= 0.001);
  c(`Engine Airflow Estimation shows displacement x RPM / 2 x VE / 1728 = ${d.flow.expected.toFixed(4)} CFM from its own boxes`, flowOk, JSON.stringify(d.flow));
  /* search and a Free calculator still work (typed into the shell's own engine frame) */
  const calc = await fr.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const i = document.getElementById('search-input'); i.value = 'hp torque'; i.dispatchEvent(new Event('input', { bubbles: true })); await sleep(300);
    const hits = [...document.querySelectorAll('#calc-nav a.gh-nav-item')].map(a => a.getAttribute('href'));
    renderCalc('hp_from_torque', false); const t = document.getElementById('torq'); t.value = '600'; t.dispatchEvent(new Event('input', { bubbles: true })); await sleep(300);
    return { hits, rpm: document.getElementById('rpm_t') && document.getElementById('rpm_t').value, result: ((document.querySelector('#calc-container .result-value') || {}).textContent || '').trim(),
      chips: document.querySelectorAll('#calc-container .profile-link').length };
  });
  c('search ("hp torque") and HP from Torque (600 lb-ft x 4000 RPM -> 457 HP; 600 x 4000 / 5252 = 456.97), no shortcut', JSON.stringify(calc.hits) === JSON.stringify(['?calc=hp_from_torque', '?calc=torque_from_hp']) && calc.rpm === '4000' && /^457\s*HP$/.test(calc.result) && calc.chips === 0, JSON.stringify(calc));
  const s1 = await fr.evaluate(STATE, STORE_KEY);
  if (stored) c('the stored vehicle list is untouched after loading and browsing (byte-identical; nothing cleared or rewritten)', s1.stored === stored, String(s1.stored).slice(0, 160));
  else c('no vehicle list is written to browser storage', s1.stored === null, String(s1.stored).slice(0, 160));
  c('the header vehicle-profile button is in the page but not displayed', s1.button && !s1.buttonShown, JSON.stringify({ button: s1.button, shown: s1.buttonShown }));
  c('dashboard template: the neutral empty state (no "Create a vehicle profile"), no profile-manager button, no vehicle named', s1.dashEmpty && s1.dashButtons === 0 && !s1.dashNamesVehicle, JSON.stringify({ empty: s1.dashEmpty, buttons: s1.dashButtons, names: s1.dashNamesVehicle }));
  c('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
  await ctx.close();
}

async function premium(browser, port, c) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); page.setDefaultTimeout(15000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e.message || e).slice(0, 160)));
  await page.route('**/*', rt => rt.request().url().startsWith(`http://127.0.0.1:${port}/`) ? rt.continue() : rt.abort());
  await page.goto(`http://127.0.0.1:${port}/index.html?view=profile`);
  await page.waitForFunction(() => document.body.classList.contains('ghp-ready'), null, { timeout: 30000 });
  c('the shell runs its local development sign-in here (the Premium grant below is the development stand-in)', await page.evaluate(() => GHP.services.mode) === 'development', await page.evaluate(() => GHP.services.mode));
  await page.fill('form[data-form="signin"] input[name="email"]', 'premium-vehicle@example.test');
  await page.click('form[data-form="signin"] button[type="submit"]');
  await page.waitForSelector('[data-action="dev-plan"][data-plan="premium"]');
  await page.click('[data-action="dev-plan"][data-plan="premium"]');
  await page.waitForFunction(() => GHP.services.entitlements && GHP.services.entitlements.isPremium());
  await page.evaluate(() => GHP.shell.go('calculators')); await page.waitForTimeout(1500);
  const fr = page.frames().find(f => f.url().includes(F124));
  const d = await fr.evaluate(() => { renderCalc('sim_dragstrip', false); const w = document.getElementById('sim_weight');
    return { upsell: !!document.querySelector('#calc-container .gh-premium-upsell'), weight: w ? Number(w.value) : null }; });
  c('Premium: the Dragstrip simulator is unlocked and opens on the coded 3,200 lb default', !d.upsell && d.weight === 3200, JSON.stringify(d));
  const s = await fr.evaluate(STATE, STORE_KEY), scan = await fr.evaluate(SCAN);
  c('Premium: no active vehicle and no "use" shortcut on any calculator (no My Garage vehicle reaches the calculators)', s.context === false && s.active === null && scan.chips === 0 && scan.mapped >= 100, JSON.stringify({ active: s.active, chips: scan.chips, mapped: scan.mapped }));
  c('Premium: the profile manager is not offered either (header button hidden, no dashboard button)', s.button && !s.buttonShown && s.dashButtons === 0, JSON.stringify({ shown: s.buttonShown, dash: s.dashButtons }));
  c('Premium: no page errors', pageErrors.length === 0, pageErrors.join(' | '));
  await ctx.close();
}

async function all(browser, overrides, report) {
  const srv = await serve(overrides), port = srv.address().port;
  for (const [vp, viewport] of [['desktop 1280 x 900', { width: 1280, height: 900 }], ['phone 375 x 812', { width: 375, height: 812 }]]) {
    for (const [sc, stored] of [['clean profile', null], ['stored Diesel Demo + own vehicle', STORED]]) {
      try { await scenario(browser, port, `${vp}, ${sc}`, viewport, stored, (n, ok, d) => report(`${vp}, ${sc} / ${n}`, ok, d)); }
      catch (e) { report(`${vp}, ${sc} / scenario ran`, false, e.message.split('\n')[0]); }
    }
  }
  try { await premium(browser, port, (n, ok, d) => report(`development Premium account / ${n}`, ok, d)); }
  catch (e) { report('development Premium account / scenario ran', false, e.message.split('\n')[0]); }
  srv.close();
}

const MUTANTS = [
  ['the vehicle switch turned on', 'const GH_VEHICLE_CONTEXT = false;', 'const GH_VEHICLE_CONTEXT = true;'],
  ['null guard removed from getActiveProfile()', "  if(!GH_VEHICLE_CONTEXT) return null;   // GH-IMP-022: no active vehicle for any visitor\n", ''],
  ['demo vehicle made active and written to storage again', "if(GH_VEHICLE_CONTEXT){\n  PROFILES[0].active=true;", "if(true){\n  PROFILES[0].active=true;"],
  ['dashboard reads the vehicle list directly', '  dashboard(){\n    const p = getActiveProfile();', '  dashboard(){\n    const p = PROFILES.find(x=>x.active)||PROFILES[0];'],
  ['the stored list rewritten on load again (benchmark vehicles merged in)', "      if(GH_VEHICLE_CONTEXT && merged.length !== saved.length) GHM_STORAGE.set(", "      if(merged.length !== saved.length) GHM_STORAGE.set("],
  ['the old "Create a vehicle profile" empty-state text', "(GH_VEHICLE_CONTEXT ? 'Create a vehicle profile to unlock saved engineering context.' : 'Calculators use their own default values.')", "'Create a vehicle profile to unlock saved engineering context.'"],
  ['header button no longer hidden', "if(!GH_VEHICLE_CONTEXT) document.querySelectorAll('[data-gh-vehicle-context]')", "if(false) document.querySelectorAll('[data-gh-vehicle-context]')"]
];

(async () => {
  const browser = await playwright.chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  let checks = 0, failures = 0; const lines = [];
  await all(browser, {}, (name, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${name}`); });
  let bad = failures;
  if (process.env.MUTANTS !== '0') {
    const src = fs.readFileSync(path.join(REPO, F124), 'utf8');
    for (const [name, find, repl] of MUTANTS) {
      const n = src.split(find).length - 1;
      if (n !== 1) { lines.push(`  MUTANT "${name}": cannot be applied (found ${n} times)`); bad++; continue; }
      let failed = 0; const first = [];
      await all(browser, { [F124]: src.replace(find, () => repl) }, (nm, ok) => { if (!ok) { failed++; if (first.length < 2) first.push(nm); } });
      lines.push(`  mutant "${name}": ${failed ? `caught (${failed} checks failed, e.g. ${first.join('; ')})` : 'NOT CAUGHT'}`);
      if (!failed) bad++;
    }
  }
  await browser.close();
  lines.forEach(l => console.log(l));
  console.log(`free-vehicle-context: ${checks - failures}/${checks} passed${failures ? `, ${failures} FAILED` : ''}`);
  process.exit(bad ? 1 : 0);
})();
