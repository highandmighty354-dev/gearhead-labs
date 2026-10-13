#!/usr/bin/env node
/* Gearhead Labs — the shell's UNITS menu (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-031).

   THE DEFECT. The app shell (app-shell.js, installCompactUnits) removes the engine's two unit buttons and puts one UNITS button with an IMPERIAL / METRIC menu in their
   place. Three faults stood between a person and a working unit switch:
     1. each menu item called w.setUnits(...) only if it existed - and nothing defines setUnits (the engine's function is setUnit), so pressing METRIC did nothing;
     2. the engine's setUnit() then read #btn-imperial / #btn-metric, which the shell had just deleted, so even the right function name threw before it re-drew anything;
     3. the legacy-unit hider in final-ui-fix.js hides "the smallest container that holds the words Imperial and Metric"; when it runs before the shell's replacement it
        picks the header's right-hand group (desktop) or the whole header (a phone), and the UNITS control, the profile button and the rest go with it.

   WHAT THIS TEST DOES (real Chromium; the repository served over http; the integrated index.html with the real shell scripts and the real engine in its frame; every
   request that is not to the local server is refused, so no network and no Supabase). Nothing is injected into the page and nothing is called programmatically that a
   person would do with the mouse: the UNITS button and the METRIC / IMPERIAL items are pressed with real mouse clicks.
   Three loads: a desktop viewport and a phone viewport in the natural script order, and a phone viewport in which the script the shell waits for (qa-math-corrections.js) is
   answered 1.8 s late, which gives the hider the chance to run first. (The natural order is a race: without the fix the control was hidden in some loads and not in others.)
   For each load:
     - the UNITS control is visible (it and every ancestor is displayed) and so is the header's profile button;
     - for each of two calculators with a speed box (Dynamic Pressure, Tow Stopping Distance):
         a real click on UNITS opens a menu with IMPERIAL and METRIC;
         a real click on METRIC sets UNIT.system to "metric" and remembers it, closes the menu, and re-draws the calculator: the speed box shows the same speed in km/h
         (independent constant 1 mile = 1609.344 m), its unit label changes, and box, label and result panel are exactly what the engine's own setUnit('metric') gives on the
         engine page opened directly (the shell path and the engine path agree); Tow Stopping Distance's result must also differ from its Imperial result (not vacuous);
         a real click on IMPERIAL puts everything back (UNIT.system "imperial", the box, the label and the result panel as they were);
     - no page errors.

   Run: node premium/tests/shell-units.test.js   (VERBOSE=1 prints passes; GH_REPO=dir tests another checkout of the repository, e.g. a worktree of an older commit)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), { execSync } = require('child_process');
const REPO = process.env.GH_REPO ? path.resolve(process.env.GH_REPO) : path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

const MPH_KMH = 1.609344;     // km/h per mph (exact: 1 mile = 1609.344 m)
/* two calculators with a speed box: Dynamic Pressure (its result keeps the same unit text in both systems) and Tow Stopping Distance (its result changes with the system) */
const CASES = [
  { id: 'dynamic_pressure', box: 'dp_v', mph: 40, resultChanges: false },
  { id: 'tow_stopping_distance', box: 'tsd_v', mph: 24.5, resultChanges: true }
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
      const f = path.join(REPO, p);
      if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

let checks = 0, failures = 0; const lines = [];
const check = (name, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${name}`); };

/* what is on screen for the calculator: the speed box, its unit label, the result panel */
const READ = box => `(() => {
  const el = document.getElementById('${box}'); const card = document.querySelector('#calc-container');
  const label = el && (el.closest('.input-wrap') || el.parentElement);
  const res = card.querySelector('.result-box');
  return { box: el ? el.value : null, label: label ? label.textContent.replace(/\\s+/g, ' ').trim() : null,
           result: res ? res.textContent.replace(/\\s+/g, ' ').trim() : null, system: UNIT.system, stored: GHM_STORAGE.get('ghm_unit', null) };
})()`;

/* the engine page opened directly: the reference for what setUnit('metric') puts on screen */
async function engineReference(browser, port) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); page.setDefaultTimeout(8000);
  await page.route('**/*', rt => rt.request().url().startsWith(`http://127.0.0.1:${port}/`) ? rt.continue() : rt.abort());
  await page.goto(`http://127.0.0.1:${port}/${F124}`, { waitUntil: 'load' }); await page.waitForTimeout(500);
  const ref = {};
  for (const c of CASES) {
    await page.evaluate(() => setUnit('imperial'));
    await page.evaluate(id => renderCalc(id, false), c.id); await page.fill('#' + c.box, String(c.mph)); await page.waitForTimeout(250);
    const imperial = await page.evaluate(READ(c.box));
    await page.click('#btn-metric'); await page.waitForTimeout(300);
    ref[c.id] = { imperial, metric: await page.evaluate(READ(c.box)) };
  }
  await page.close();
  return ref;
}

async function pressUnits(fr, page, item) {
  await fr.locator('.gh-compact-units > button').click();
  const items = await fr.locator('.gh-compact-menu button').allTextContents();
  await fr.locator('.gh-compact-menu button', { hasText: item }).click(); await page.waitForTimeout(400);
  return items;
}

async function oneLoad(browser, port, tag, viewport, lateScript, ref) {
  const ctx = await browser.newContext({ viewport }); const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e.message || e).slice(0, 160)));
  await page.route('**/*', async rt => {
    const u = rt.request().url();
    if (!u.startsWith(`http://127.0.0.1:${port}/`)) return rt.abort();
    if (lateScript && u.includes('/' + lateScript)) await new Promise(r => setTimeout(r, 1800));
    rt.continue();
  });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => document.getElementById('boot') && document.getElementById('boot').classList.contains('hide'), null, { timeout: 30000 });
  await page.waitForTimeout(3600);                       // past the last timer of the shell (1 s after it starts) and of the hider (2 s)
  const fr = page.frames().find(f => f !== page.mainFrame());

  /* 1. the control is there and visible, and so is the rest of the header */
  const vis = await fr.evaluate(() => {
    const b = document.querySelector('.gh-compact-units > button'); const p = document.querySelector('.gh-profile-btn');
    const shown = e => { if (!e) return false; const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false; for (let a = e; a; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
    return { control: !!b, controlShown: shown(b), profileShown: shown(p), legacyButtons: !!document.getElementById('btn-metric') };
  });
  check(`${tag}: the shell's UNITS control exists`, vis.control, JSON.stringify(vis));
  check(`${tag}: the UNITS control is visible (it and every ancestor is displayed)`, vis.controlShown, JSON.stringify(vis));
  check(`${tag}: the header's profile button is visible`, vis.profileShown, JSON.stringify(vis));
  if (!vis.controlShown) { check(`${tag}: no page errors`, pageErrors.length === 0, pageErrors.join(' | ')); await ctx.close(); return; }

  for (const c of CASES) {
    const t = `${tag}, ${c.id}`, r = ref[c.id];
    /* a calculator with a speed box, in Imperial */
    await fr.evaluate(id => renderCalc(id, false), c.id); await page.waitForTimeout(200);
    await fr.fill('#' + c.box, String(c.mph)); await page.waitForTimeout(250);
    const imp0 = await fr.evaluate(READ(c.box));
    check(`${t}: Imperial to start, the speed box holds ${c.mph}`, imp0.system === 'imperial' && Number(imp0.box) === c.mph, JSON.stringify(imp0));
    check(`${t}: the Imperial screen matches the engine page`, imp0.result === r.imperial.result && imp0.label === r.imperial.label, JSON.stringify({ shell: imp0, engine: r.imperial }));

    /* 2./3. UNITS, then METRIC, with real mouse clicks */
    const items = await pressUnits(fr, page, 'METRIC');
    check(`${t}: a real click on UNITS opens a menu with IMPERIAL and METRIC`, items.join('|') === 'IMPERIAL|METRIC', JSON.stringify(items));
    const met = await fr.evaluate(READ(c.box));
    check(`${t}: after a real click on METRIC, UNIT.system is "metric" and the choice is remembered (ghm_unit)`, met.system === 'metric' && met.stored === 'metric', JSON.stringify(met));
    check(`${t}: the menu has closed`, (await fr.locator('.gh-compact-menu').count()) === 0, 'menu still open');
    check(`${t}: the speed box shows ${c.mph} mph as ${(c.mph * MPH_KMH).toFixed(5)} km/h (independent constant)`, Math.abs(Number(met.box) - c.mph * MPH_KMH) < 0.01, JSON.stringify(met));
    check(`${t}: the box's unit label changed to km/h`, met.label !== imp0.label && /km\/h/i.test(met.label || ''), JSON.stringify({ imperial: imp0.label, metric: met.label }));
    check(`${t}: box, label and result panel are exactly what the engine's own setUnit('metric') gives`, met.box === r.metric.box && met.label === r.metric.label && met.result === r.metric.result, JSON.stringify({ shell: met, engine: r.metric }));
    if (c.resultChanges) check(`${t}: the result panel changed with the system (the comparison above is not vacuous)`, met.result !== imp0.result && !!met.result, JSON.stringify({ imperial: imp0.result, metric: met.result }));

    /* 4. back to IMPERIAL */
    await pressUnits(fr, page, 'IMPERIAL');
    const imp1 = await fr.evaluate(READ(c.box));
    check(`${t}: after a real click on IMPERIAL, UNIT.system is "imperial" and it is remembered`, imp1.system === 'imperial' && imp1.stored === 'imperial', JSON.stringify(imp1));
    check(`${t}: ... and the box, its label and the result panel are exactly as they were`, Math.abs(Number(imp1.box) - c.mph) < 1e-9 && imp1.label === imp0.label && imp1.result === imp0.result, JSON.stringify({ before: imp0, after: imp1 }));
  }
  check(`${tag}: no page errors`, pageErrors.length === 0, pageErrors.join(' | '));
  await ctx.close();
}

(async () => {
  const srv = await serve(); const port = srv.address().port;
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  try {
    const ref = await engineReference(browser, port);
    for (const c of CASES) {
      const r = ref[c.id];
      check(`reference ${c.id}: the engine page alone is Imperial, then Metric after its own button, and its speed box converts to km/h`, r.imperial.system === 'imperial' && r.metric.system === 'metric' && Math.abs(Number(r.metric.box) - c.mph * MPH_KMH) < 0.01, JSON.stringify(r));
    }
    await oneLoad(browser, port, 'desktop', { width: 1280, height: 800 }, null, ref);
    await oneLoad(browser, port, 'phone', { width: 390, height: 844 }, null, ref);
    await oneLoad(browser, port, 'phone, hider first', { width: 390, height: 844 }, 'qa-math-corrections.js', ref);
  } finally { await browser.close(); srv.close(); }
  console.log(lines.join('\n'));
  console.log(`shell-units: ${checks} checks, ${failures} failed`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
