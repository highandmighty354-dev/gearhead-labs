#!/usr/bin/env node
/* Shell navigation regression (app-shell.js) — real Chromium against the integrated index.html served from disk.
   Bug fixed: app-shell.js re-syncs the calculator frame about 300 ms and 1 s after it is ready, and on Back/Forward.
   Each sync used to call the frame's ghRoute(), which does not know the static pages (?page=about|methodology|privacy|
   terms|contact), so a visitor who opened one of them in that window was put back on the dashboard; after a deep link
   (?calc= / ?lab=) the late re-syncs also re-applied that link, undoing any page the visitor had moved on to.
   Every check opens a fresh browser context. A MutationObserver inside the frame records any moment a static page is
   replaced, so a bounce that is redrawn back a moment later is still caught. The analytics endpoint is a fake answered
   in the browser; nothing leaves the machine and no database is involved.
   Run: node premium/tests/shell-static-routes.test.js */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const EP = 'https://ingest.example.test/functions/v1/analytics-ingest';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const RESYNC_DONE_MS = 1600;            // the shell's last start-up re-sync is at 1000 ms; observe well past it

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

const results = [];
async function check(name, fn) {
  try { const note = await fn(); results.push({ name, pass: true, note: note || null }); console.log('PASS  ' + name + (note ? '\n      ' + note : '')); }
  catch (e) { results.push({ name, pass: false, error: e.message }); console.log('FAIL  ' + name + '\n      -> ' + e.message); }
}
const ok = (c, what) => { if (!c) throw new Error(what); };
const eq = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const srv = await serve(), BASE = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await playwright.chromium.launch();

  async function open(url = '', { analytics = false } = {}) {
    const ctx = await browser.newContext(), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://cdn.jsdelivr.net/**', r => r.abort());
    if (analytics) await page.route(u => u.pathname.startsWith('/analytics-config.js'), r => r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' },
      body: `window.GH_ANALYTICS_CONFIG = { enabled: true, endpoint: '${EP}', env: 'test' };` }));
    await page.route(EP, r => r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }));
    await page.goto(BASE + url);
    await page.waitForFunction(() => document.getElementById('app').__ghReady === true, null, { timeout: 30000 });
    const readyAt = Date.now();
    const frame = () => page.frame({ url: /F1_12_4/ });
    await frame().evaluate(() => { window.__ghTestFrameId = Math.random(); });          // detects a full frame reload
    return { ctx, page, frame, errors, readyAt, since: () => Date.now() - readyAt };
  }
  /* What the frame shows: its URL, whether a static page is open, the calculator id (dashboard included), a lab view. */
  const view = (f) => f.evaluate(() => ({
    search: location.search,
    page: new URLSearchParams(location.search).get('page'),
    isStatic: !!document.querySelector('#calc-container>.gh-e110-static'),
    calc: typeof currentCalc !== 'undefined' ? currentCalc : null,
    lab: !!document.querySelector('#calc-container .gh-directory'),
    title: document.title,
    sameFrame: typeof window.__ghTestFrameId === 'number'
  }));
  /* From now on, count every time the open static page is replaced or removed (redraws), and every time none is shown (lost). */
  const watchStatic = (f) => f.evaluate(() => {
    const c = document.getElementById('calc-container'); window.__ghLost = 0; window.__ghRedraws = 0;
    new MutationObserver(ms => { if (ms.some(m => [...m.removedNodes].some(n => n.classList && n.classList.contains('gh-e110-static')))) window.__ghRedraws++;
      if (!c.querySelector(':scope>.gh-e110-static')) window.__ghLost++; }).observe(c, { childList: true });
  });
  const watched = (f) => f.evaluate(() => ({ lost: window.__ghLost, redraws: window.__ghRedraws }));
  /* The visitor's click on the footer link (the site's own handler: pushState + render). */
  const clickFooter = (f, label) => f.locator('.gh-e110-footer a', { hasText: new RegExp('^' + label + '$') }).click();
  /* The site's own navigation link to a calculator (the sidebar entry; its handler routes in place). */
  const clickNav = (f, id) => f.locator(`#calc-nav a.gh-nav-item[href="?calc=${id}"]`).first().dispatchEvent('click');
  const settle = async (s) => { const left = RESYNC_DONE_MS - s.since(); if (left > 0) await sleep(left); };

  const TITLES = { privacy: /\bPrivacy\b/, about: /\bAbout\b/, terms: /\bTerms\b/, methodology: /\bMethodology\b/, contact: /\bContact\b/ };
  async function staticStays(label, key, atMs) {
    const s = await open(); const f = s.frame();
    if (atMs) await sleep(Math.max(0, atMs - s.since()));
    const clickedAt = s.since();
    await clickFooter(f, label); await watchStatic(f);
    const opened = await view(f);
    eq([opened.page, opened.isStatic], [key, true], `${label} opened`);
    await settle(s);
    const v = await view(f), w = await watched(f);
    eq([v.page, v.isStatic, v.sameFrame], [key, true, true], `${label} still open after the shell's re-syncs`);
    ok(TITLES[key].test(v.title), `${label} title, got "${v.title}"`);
    eq(w, { lost: 0, redraws: 0 }, `${label} never replaced`);
    eq(s.errors, [], 'page errors');
    await s.ctx.close();
    return `clicked ${clickedAt} ms after ready (re-syncs at ~300 and ~1000 ms); observed until ${RESYNC_DONE_MS} ms`;
  }

  // ---- 1. Static pages opened immediately, before, between and after the delayed shell checks
  await check('Privacy opened immediately after load stays open through both re-syncs', () => staticStays('Privacy', 'privacy', 0));
  await check('About opened immediately after load stays open through both re-syncs', () => staticStays('About', 'about', 0));
  await check('Terms opened immediately after load stays open through both re-syncs', () => staticStays('Terms', 'terms', 0));
  await check('Methodology opened immediately after load stays open', () => staticStays('Methodology', 'methodology', 0));
  await check('Contact opened immediately after load stays open', () => staticStays('Contact', 'contact', 0));
  await check('Privacy opened before the 300 ms re-sync stays open', () => staticStays('Privacy', 'privacy', 150));
  await check('Privacy opened between the 300 ms and 1 s re-syncs stays open', () => staticStays('Privacy', 'privacy', 600));
  await check('About opened between the re-syncs stays open', () => staticStays('About', 'about', 600));
  await check('Terms opened between the re-syncs stays open', () => staticStays('Terms', 'terms', 600));
  await check('Privacy opened after both re-syncs stays open', () => staticStays('Privacy', 'privacy', 1500));

  // ---- 2. The shell's own sync(): it runs on Back/Forward (popstate) and when the Engineering Lab loads (engineering-bridge.js).
  //      It must not draw the dashboard over an open static page. NOT covered here: the frame's own Back/Forward router
  //      (ghRoute() in the F1_12_4 page) still draws the dashboard on Back to a static page; that is in the engine page, not
  //      the shell, and is reported separately.
  await check('the shell sync (Back/Forward, Engineering Lab load) keeps an open Privacy page', async () => {
    const s = await open(); const f = s.frame(); await settle(s);
    await clickFooter(f, 'Privacy'); await watchStatic(f);
    await s.page.evaluate(() => window.GHShell.sync()); await sleep(200);
    const v = await view(f); eq([v.page, v.isStatic, v.sameFrame], ['privacy', true, true], 'Privacy still open');
    eq((await watched(f)).lost, 0, 'never without the page');
    eq(s.errors, [], 'page errors'); await s.ctx.close();
  });
  await check('the shell sync keeps an open Terms page immediately after load (inside the re-sync window)', async () => {
    const s = await open(); const f = s.frame();
    await clickFooter(f, 'Terms'); await watchStatic(f); const at = s.since();
    await s.page.evaluate(() => window.GHShell.sync()); await settle(s);
    const v = await view(f); eq([v.page, v.isStatic, v.sameFrame], ['terms', true, true], 'Terms still open');
    eq((await watched(f)).lost, 0, 'never without the page');
    eq(s.errors, [], 'page errors'); await s.ctx.close();
    return `opened ${at} ms after ready`;
  });
  // ---- 3. Deep links: the late re-syncs must not undo where the visitor went
  await check('after a ?calc= deep link, Privacy opened immediately stays open (not sent back to the calculator)', async () => {
    const s = await open('?calc=bmep'); const f = s.frame();
    eq((await view(f)).calc, 'bmep', 'deep link shown');
    const at = s.since(); await clickFooter(f, 'Privacy'); await watchStatic(f); await settle(s);
    const v = await view(f); eq([v.page, v.isStatic, v.sameFrame], ['privacy', true, true], 'Privacy still open');
    eq(await watched(f), { lost: 0, redraws: 0 }, 'never replaced');
    eq(s.errors, [], 'page errors'); await s.ctx.close();
    return `clicked ${at} ms after ready`;
  });
  await check('after a ?calc= deep link, another calculator opened immediately stays open', async () => {
    const s = await open('?calc=bmep'); const f = s.frame();
    const at = s.since(); await clickNav(f, 'afr_lambda'); await sleep(50);
    eq((await view(f)).calc, 'afr_lambda', 'second calculator opened');
    ok(at < 1000, `precondition: navigated before the 1 s re-sync (${at} ms)`);
    await settle(s);
    const v = await view(f); eq([v.calc, v.search, v.sameFrame], ['afr_lambda', '?calc=afr_lambda', true], 'still on the second calculator');
    eq(s.errors, [], 'page errors'); await s.ctx.close();
    return `navigated ${at} ms after ready`;
  });

  // ---- 4. Existing behaviour that must not change
  await check('dashboard: home loads the dashboard and it stays through the re-syncs', async () => {
    const s = await open(); const f = s.frame(); await settle(s);
    const v = await view(f); eq([v.calc, v.isStatic, v.page, v.sameFrame], ['dashboard', false, null, true], 'dashboard');
    eq(s.errors, [], 'page errors'); await s.ctx.close();
  });
  await check('dashboard navigation: open a calculator from home, Back returns to the dashboard, Forward to the calculator', async () => {
    const s = await open(); const f = s.frame();
    await clickNav(f, 'bmep'); await settle(s);
    eq((await view(f)).calc, 'bmep', 'calculator opened (and kept through the re-syncs)');
    await f.evaluate(() => history.back()); await sleep(500);
    let v = await view(f); eq([v.calc, v.isStatic], ['dashboard', false], 'Back: dashboard');
    await f.evaluate(() => history.forward()); await sleep(500);
    v = await view(f); eq([v.calc, v.sameFrame], ['bmep', true], 'Forward: calculator');
    eq(s.errors, [], 'page errors'); await s.ctx.close();
  });
  await check('deep links still work: ?calc= and ?lab= land and stay after the re-syncs', async () => {
    let s = await open('?calc=afr_lambda'); let f = s.frame(); await settle(s);
    let v = await view(f); eq([v.calc, v.search], ['afr_lambda', '?calc=afr_lambda'], '?calc= deep link'); eq(s.errors, [], 'page errors'); await s.ctx.close();
    s = await open('?lab=diesel'); f = s.frame(); await settle(s);
    v = await view(f); eq([v.search, v.lab], ['?lab=diesel', true], '?lab= deep link'); eq(s.errors, [], 'page errors'); await s.ctx.close();
  });
  await check('an unknown ?page= still falls back to the dashboard on the next sync', async () => {
    const s = await open(); const f = s.frame(); await settle(s);
    await f.evaluate(() => history.pushState(null, '', '?page=nonexistent'));
    await s.page.evaluate(() => window.GHShell.sync()); await sleep(100);
    const v = await view(f); eq([v.calc, v.isStatic], ['dashboard', false], 'dashboard');
    eq(s.errors, [], 'page errors'); await s.ctx.close();
  });

  // ---- 5. Analytics consent on a Privacy page opened immediately (the control lives on that page)
  await check('analytics: opt-out and turning back on work on a Privacy page opened immediately after load', async () => {
    const s = await open('', { analytics: true }); const f = s.frame();
    await clickFooter(f, 'Privacy');
    const b = f.locator('[data-gh-analytics-choice]'), btn = b.locator('button[data-gh-analytics-toggle]');
    await b.locator('[data-gh-analytics-status]').waitFor();
    eq(await b.getAttribute('data-state'), 'allowed', 'starts on');
    await btn.click(); const at = s.since();
    eq(await b.getAttribute('data-state'), 'opted-out', 'turned off');
    await settle(s);
    eq(await b.getAttribute('data-state'), 'opted-out', 'still off after the re-syncs (control not replaced)');
    eq(await f.evaluate(() => localStorage.getItem('gh_a_optout')), '1', 'choice stored');
    await btn.click();
    eq(await b.getAttribute('data-state'), 'allowed', 'turned back on');
    ok(/resumes from your next page load/.test(await b.locator('[data-gh-analytics-status]').textContent()), 'says when it takes effect');
    eq(await f.evaluate(() => localStorage.getItem('gh_a_optout')), null, 'choice cleared');
    eq((await view(f)).page, 'privacy', 'still on Privacy');
    eq(s.errors, [], 'page errors'); await s.ctx.close();
    return `opted out ${at} ms after ready`;
  });

  await browser.close(); srv.close();
  const failed = results.filter(r => !r.pass).length;
  console.log(`shell static routes: ${results.length} checks, ${results.length - failed} passed, ${failed} failed (synthetic browser sessions, fake endpoint)`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
