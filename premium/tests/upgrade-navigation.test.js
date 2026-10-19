#!/usr/bin/env node
/* Gearhead Labs — Premium "Upgrade to Premium" navigation (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-039).

   THE DEFECT. On a locked Premium calculator the upgrade card's "Upgrade to Premium →" link (renamed "See Premium →" on 2026-10-18) (premium-calculator-gating.js) was a plain
   href to ?view=profile inside the calculator frame. The browser loaded the WHOLE site into that frame: two navigation bars (two bottom tab
   bars on a phone), the top-level page still on "calculators", its address unchanged. Back only undid the nested frame load.

   THE FIX. A plain left click goes through the parent shell's router, GHP.shell.go('profile'): the top-level page shows its own Profile view
   and pushes ?view=profile on the top-level history; the frame and its calculator are not touched, so Back returns to the same calculator.
   Without the router, the link's target="_top" replaces the whole page, never just the frame.

   WHAT THIS TEST DOES (real Chromium; the repository served over http; the integrated index.html with the real shell, the real engine in its
   frame and the real gate; every request that is not to the local server is refused, so no network and no Supabase; anonymous visitor). The
   Upgrade link, menu items and calculator boxes are pressed / typed with real mouse clicks and the keyboard; Back is the browser's own.
   For a desktop viewport (1280 x 900) and a phone viewport (375 x 812):
     A. reached inside the app: search "fast charge", click DC Fast-Charge Time (locked):
        - the upgrade card shows the Upgrade link and no calculator boxes; the PREMIUM gate covers 158 calculators;
        - Upgrade: the TOP-LEVEL address is ?view=profile, the shell's view is "profile" and its Profile view is shown; the calculator frame
          still holds the engine page with the same calculator (no page nested in the frame); exactly one #ghp-nav in the page, none in the
          frame; the top-level history grew by exactly one entry;
        - Back: the shell is back on "calculators" (Profile view hidden), the address is what it was, the frame shows DC Fast-Charge Time with
          its upgrade card;
        - Upgrade then Back three more times: the same every time; the history length never grows past the first Upgrade; still one #ghp-nav;
        - the calculator page is still usable: search "hp torque", open HP from Torque, type 600 in Torque: the result is 457 HP
          (independent: 600 x 4000 / 5252 = 456.97, the calculator shows one decimal and drops a trailing zero);
     B. reached by a direct link /?calc=piston_acceleration: Upgrade, then Back, returns to the same address and Piston Acceleration;
     C. SIMULATED router failure (the test removes GHP.shell before the click; not a real-world fault): Upgrade replaces the whole page with
        /?view=profile (one #ghp-nav, nothing nested in the frame); Back returns to /?calc=piston_acceleration and Piston Acceleration;
     and no page errors.
   MUTANT (the test must FAIL on it; SKIP_MUTANTS=1 skips it): the gate file as released on main before this fix (origin/main or GH_BASE).

   Run: node premium/tests/upgrade-navigation.test.js   (VERBOSE=1 prints passes; GH_REPO=dir tests another checkout)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), { execSync, execFileSync } = require('child_process');
const REPO = process.env.GH_REPO ? path.resolve(process.env.GH_REPO) : path.resolve(__dirname, '..', '..');
const BASE = process.env.GH_BASE || '885f843';   // main before GH-DEF-039
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function serve(overrides = {}) {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
      const rel = p.replace(/^\//, ''), f = path.join(REPO, p);
      if (overrides[rel]) { rsp.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); return rsp.end(overrides[rel]); }
      if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

let checks = 0, failures = 0; const lines = [];
const check = (name, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${name}`); };

/* the state of the page: top-level address, shell view, Profile view visibility, navigation bars, what the frame holds */
async function state(page) {
  return page.evaluate(() => {
    const f = document.getElementById('app'); let fr = {};
    try {
      const d = f.contentDocument, w = f.contentWindow;
      fr = { path: w.location.pathname.split('/').pop(), search: w.location.search, nested: !!d.getElementById('app'), navInFrame: d.querySelectorAll('#ghp-nav').length,
        title: (d.querySelector('#calc-container .calc-title') || {}).textContent || null, gated: !!d.querySelector('.gh-premium-upsell'),
        cta: !!d.querySelector('a.gh-premium-cta'), inputs: d.querySelectorAll('#calc-container .calc-body input').length };
    } catch (e) { fr = { error: e.message }; }
    const v = document.getElementById('ghp-view');
    return { search: location.search, view: window.GHP && GHP.shell ? GHP.shell.state().view : null, history: history.length,
      profileShown: !!v && !v.hidden && /Profile/.test(v.textContent), navTop: document.querySelectorAll('#ghp-nav').length, frame: fr };
  });
}
const frameOf = page => page.frames().find(f => f.url().includes(F124));

async function oneViewport(browser, port, label, viewport, quiet) {
  const failed = [];
  const c = (name, ok, detail) => { if (quiet) { if (!ok) failed.push(name); return; } check(`${label} / ${name}`, ok, detail); if (!ok) failed.push(name); };
  const ctx = await browser.newContext({ viewport }), page = await ctx.newPage(); page.setDefaultTimeout(15000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
  await page.route('**/*', rt => rt.request().url().startsWith(`http://127.0.0.1:${port}/`) ? rt.continue() : rt.abort());
  const settle = async () => { await page.waitForTimeout(700); };
  const openMenu = async fr => {
    const input = fr.locator('#search-input');
    for (let i = 0; i < 3 && !(await input.isVisible()); i++) {
      const b = fr.locator('[aria-label="Open navigation"]');
      if (await b.count() && await b.first().isVisible()) await b.first().click();
      try { await input.waitFor({ state: 'visible', timeout: 2000 }); } catch (e) { /* retry */ }
    }
  };
  const search = async (fr, q) => { await openMenu(fr); const input = fr.locator('#search-input'); await input.click(); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace'); await page.keyboard.type(q); await page.waitForTimeout(200); };
  /* the browser's own Back (page.goBack); a same-document history step never fires "load", so wait for the commit and let the page settle */
  const back = async () => { await page.goBack({ waitUntil: 'commit', timeout: 5000 }).catch(() => null); await settle(); };
  const clickUpgrade = async () => { let err = ''; try { await frameOf(page).locator('a.gh-premium-cta').click({ timeout: 5000 }); } catch (e) { err = e.message.split('\n')[0]; } await settle(); return err; };

  /* ---------- A. reached inside the app ---------- */
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' }); await page.waitForTimeout(2500);
  let fr = frameOf(page);
  const premiumCount = await page.evaluate(() => GHP.models.PREMIUM_CALC_IDS.size);
  await search(fr, 'fast charge');
  await fr.locator('#calc-nav a.gh-nav-item[href="?calc=dc_fast_charge_time"]').click(); await settle();
  const before = await state(page);
  const ctaText = (await fr.locator('a.gh-premium-cta').textContent().catch(() => '')).trim();
  c('A locked calculator shows the upgrade card with the Upgrade link and no calculator boxes', before.frame.title === 'DC Fast-Charge Time' && before.frame.gated && before.frame.cta && before.frame.inputs === 0 && /See Premium/.test(ctaText),
    JSON.stringify({ frame: before.frame, ctaText }));
  c('the PREMIUM gate covers 158 calculators', premiumCount === 158, `${premiumCount}`);

  const checkUpgraded = (tag, s, base, expectFrame) => {
    c(`${tag}: top-level page on Profile (?view=profile, shell view "profile", Profile view shown)`, s.search === '?view=profile' && s.view === 'profile' && s.profileShown,
      JSON.stringify({ search: s.search, view: s.view, profileShown: s.profileShown }));
    c(`${tag}: nothing nested in the frame; one navigation bar`, !s.frame.nested && s.frame.path === F124 && s.navTop === 1 && s.frame.navInFrame === 0,
      JSON.stringify({ frame: s.frame.path, nested: s.frame.nested, navTop: s.navTop, navInFrame: s.frame.navInFrame }));
    if (expectFrame) c(`${tag}: the frame still holds the calculator`, s.frame.search === expectFrame.search && s.frame.title === expectFrame.title, JSON.stringify(s.frame));
    c(`${tag}: top-level history grew by exactly one`, s.history === base + 1, `${base} -> ${s.history}`);
  };
  const checkBack = (tag, s, wantSearch, wantTitle) => {
    c(`${tag}: Back returns to the calculator`, s.view === 'calculators' && !s.profileShown && s.search === wantSearch && s.frame.title === wantTitle && s.frame.gated && s.frame.cta && !s.frame.nested && s.navTop === 1,
      JSON.stringify({ search: s.search, view: s.view, profileShown: s.profileShown, frame: s.frame, navTop: s.navTop }));
  };

  const err1 = await clickUpgrade();
  c('A: Upgrade link clickable', !err1, err1);
  const up1 = await state(page);
  checkUpgraded('A first Upgrade', up1, before.history, { search: before.frame.search, title: 'DC Fast-Charge Time' });
  await back();
  checkBack('A first Back', await state(page), before.search, 'DC Fast-Charge Time');
  for (let i = 2; i <= 4; i++) {
    await clickUpgrade();
    const u = await state(page);
    checkUpgraded(`A Upgrade #${i}`, u, before.history, null);
    await back();
    const b = await state(page);
    checkBack(`A Back #${i}`, b, before.search, 'DC Fast-Charge Time');
    c(`A round trip #${i}: history length stable`, b.history === before.history + 1, `${before.history} -> ${b.history}`);
  }
  /* still usable: a Free calculator works after the round trips */
  fr = frameOf(page);
  await search(fr, 'hp torque');
  const firstResult = await fr.locator('#calc-nav a.gh-nav-item').first().getAttribute('href').catch(() => null);
  await fr.locator('#calc-nav a.gh-nav-item[href="?calc=hp_from_torque"]').click(); await settle();
  await fr.locator('#torq').click({ clickCount: 3 }); await page.keyboard.type('600'); await page.waitForTimeout(400);
  const result = await fr.evaluate(() => (document.querySelector('#calc-container .result-value') || {}).textContent || '');
  const expected = Math.round(600 * 4000 / 5252 * 10) / 10;   // 457.0 -> shown "457"
  c('after the round trips: search and a Free calculator still work (600 lb-ft x 4000 rpm -> 457 HP)', firstResult === '?calc=hp_from_torque' && result.replace(/\s/g, '').startsWith(String(expected).replace(/\.0$/, '')),
    `first result ${firstResult}, result "${result}", expected ${expected}`);

  /* ---------- B. reached by a direct link ---------- */
  await page.goto(`http://127.0.0.1:${port}/?calc=piston_acceleration`, { waitUntil: 'load' }); await page.waitForTimeout(2500);
  const bBefore = await state(page);
  c('B direct link: Piston Acceleration is locked', bBefore.frame.title === 'Piston Acceleration' && bBefore.frame.gated && bBefore.frame.inputs === 0, JSON.stringify(bBefore.frame));
  await clickUpgrade();
  checkUpgraded('B Upgrade', await state(page), bBefore.history, { search: bBefore.frame.search, title: 'Piston Acceleration' });
  await back();
  checkBack('B Back', await state(page), '?calc=piston_acceleration', 'Piston Acceleration');

  /* ---------- C. SIMULATED router failure: the link's own target="_top" ---------- */
  await page.goto(`http://127.0.0.1:${port}/?calc=piston_acceleration`, { waitUntil: 'load' }); await page.waitForTimeout(2500);
  await page.evaluate(() => { window.GHP.shell = undefined; });
  const nav = page.waitForNavigation({ waitUntil: 'load', timeout: 8000 }).catch(() => null);
  await clickUpgrade(); await nav; await page.waitForTimeout(2500);
  const cUp = await state(page);
  c('C (simulated: router removed) Upgrade replaces the whole page with /?view=profile, nothing nested', cUp.search === '?view=profile' && cUp.view === 'profile' && !cUp.frame.nested && cUp.navTop === 1,
    JSON.stringify({ search: cUp.search, view: cUp.view, nested: cUp.frame.nested, navTop: cUp.navTop }));
  await page.goBack({ waitUntil: 'commit', timeout: 8000 }).catch(() => null); await page.waitForLoadState('load').catch(() => null); await page.waitForTimeout(2500);
  const cBack = await state(page);
  c('C (simulated) Back returns to /?calc=piston_acceleration and Piston Acceleration', cBack.search === '?calc=piston_acceleration' && cBack.frame.title === 'Piston Acceleration' && !cBack.frame.nested,
    JSON.stringify({ search: cBack.search, frame: cBack.frame }));

  c('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
  await ctx.close();
  return failed;
}

(async () => {
  const browser = await playwright.chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const VIEWPORTS = [['desktop 1280 x 900', { width: 1280, height: 900 }], ['phone 375 x 812', { width: 375, height: 812 }]];
  const srv = await serve();
  for (const [label, vp] of VIEWPORTS) await oneViewport(browser, srv.address().port, label, vp, false);
  srv.close();
  if (!process.env.SKIP_MUTANTS) {
    const old = execFileSync('git', ['-C', REPO, 'show', `${BASE}:premium-calculator-gating.js`], { maxBuffer: 16 * 1024 * 1024 });
    for (const [label, vp] of VIEWPORTS) {
      const m = await serve({ 'premium-calculator-gating.js': old });
      const failed = await oneViewport(browser, m.address().port, `mutant ${label}`, vp, true);
      m.close();
      check(`mutant detected (${BASE} gate file, ${label})`, failed.length > 0, 'the test passed against the defective file');
      if (process.env.VERBOSE && failed.length) lines.push(`       (${failed.length} checks failed, e.g. ${failed.slice(0, 3).join('; ')})`);
    }
  }
  await browser.close();
  lines.forEach(l => console.log(l));
  console.log(`upgrade navigation (GH-DEF-039): ${checks - failures}/${checks} passed${failures ? `, ${failures} FAILED` : ''}`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
