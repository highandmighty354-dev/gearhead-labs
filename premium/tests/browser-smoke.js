#!/usr/bin/env node
/* Gearhead Labs Premium — Chromium tests of the INTEGRATED index.html on disk (nothing injected into the page).
   The real supabase-js library, supabase-config.js and supabase-boot.js run in the real order.

   This sandbox's egress policy blocks cdn.jsdelivr.net and *.supabase.co, so two things are provided at the network
   layer (never by editing the page):
     - the pinned library URL is answered with the exact bytes of @supabase/supabase-js@<pinned> from the npm registry
       (tarball verified against the registry's sha512); Chromium still enforces the page's SRI hash on them;
     - requests to the Supabase project are either left to the real network (blocked: the "offline" case) or answered
       with what an empty / provisioned PostgREST returns. Only GET is permitted; anything else is aborted and fails
       the test, so no write can ever leave the browser.
   Modes: A anonymous / no-backend, B development, C Premium development, D real bootstrap order (actual client),
          E foundation fallback on an unprovisioned database, F the F1.12.4 calculator frame, G SRI tamper check,
          H development mode is local-only (a public host cannot enable it). Every boot must be clean (no init error).
   Run: node premium/tests/browser-smoke.js   (Playwright from the global npm root; npm registry reachable) */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os'), crypto = require('crypto'), { execSync, execFileSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const OUT = process.env.SMOKE_OUT || null;   // optional screenshot directory
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';

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

/* The pinned library as index.html declares it, fetched from the npm registry and verified. */
function pinnedLibrary() {
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const tag = html.match(/<script src="(https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@(\d+\.\d+\.\d+)\/(dist\/umd\/supabase\.js))" integrity="(sha384-[^"]+)" crossorigin="anonymous"><\/script>/);
  if (!tag) throw new Error('index.html: pinned supabase-js tag not found');
  const [, url, version, file, sri] = tag;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghp-sbjs-'));
  execFileSync('npm', ['pack', `@supabase/supabase-js@${version}`, '--pack-destination', dir, '--silent'], { stdio: 'pipe' });
  const tgz = fs.readdirSync(dir).find(f => f.endsWith('.tgz'));
  const published = execFileSync('npm', ['view', `@supabase/supabase-js@${version}`, 'dist.integrity'], { encoding: 'utf8' }).trim();
  const actual = 'sha512-' + crypto.createHash('sha512').update(fs.readFileSync(path.join(dir, tgz))).digest('base64');
  if (actual !== published) throw new Error(`tarball integrity mismatch: ${actual} vs ${published}`);
  execFileSync('tar', ['xzf', path.join(dir, tgz), '-C', dir]);
  const bytes = fs.readFileSync(path.join(dir, 'package', file));
  const computed = 'sha384-' + crypto.createHash('sha384').update(bytes).digest('base64');
  fs.rmSync(dir, { recursive: true, force: true });
  return { url, version, sri, computed, bytes };
}

/* Runs before any page script: records script execution order, every createClient call, when GH_SUPABASE appears,
   and every fetch to the Supabase project. Observation only; nothing is replaced. */
const INSTRUMENT = `(() => {
  const log = window.__gh = { order: [], createClient: 0, events: [], fetches: [] };
  const rel = s => s.indexOf(location.origin + '/') === 0 ? s.slice(location.origin.length + 1).replace(/\\?.*$/, '') : s;
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
    if (n.tagName === 'SCRIPT' && n.src) n.addEventListener('load', () => log.order.push(rel(n.src)));
  }))).observe(document, { childList: true, subtree: true });
  let gh; Object.defineProperty(window, 'GH_SUPABASE', { configurable: true, get() { return gh; }, set(v) { gh = v; log.events.push(['GH_SUPABASE', performance.now()]); } });
  const f = window.fetch;
  window.fetch = function (input) { const u = String(input && input.url || input); if (/\\.supabase\\.co\\//.test(u)) log.fetches.push([u, performance.now()]); return f.apply(this, arguments); };
  document.addEventListener('DOMContentLoaded', () => {
    log.events.push(['DOMContentLoaded', performance.now()]);
    const lib = window.supabase;   // the boot script's own DOMContentLoaded listener runs after this one
    if (lib && typeof lib.createClient === 'function') {
      const orig = lib.createClient;
      try { Object.defineProperty(lib, 'createClient', { configurable: true, writable: true, value: function () { log.createClient++; return orig.apply(this, arguments); } }); }
      catch (e) { log.wrapFailed = String(e); }
    }
  });
})();`;

const results = [];
async function step(name, fn) { try { await fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: String(e && e.message || e).split('\n')[0].slice(0, 300) }); } }
const assert = (c, m) => { if (!c) throw new Error(m); };
const same = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,HEAD,OPTIONS' };
const PGRST = (status, code, message) => ({ status, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: JSON.stringify({ code, details: null, hint: null, message }) });
const EXPECTED_ORDER = lib => [lib.url, 'supabase-config.js', 'supabase-boot.js', 'premium/models.js', 'premium/adapters/foundation.js', 'premium/config.js',
  'premium/adapters/dev-local.js', 'premium/services.js', 'premium/engineering-bridge.js', 'premium/shell.js', 'app-shell.js', 'final-ui-fix.js'];
/* Known, environment-only console noise: the calculator page's Google Fonts stylesheet cannot pass this sandbox's
   TLS-intercepting proxy. It affects only typefaces, never Gearhead Labs logic. */
const ENV_NOISE = /ERR_CERT_AUTHORITY_INVALID|fonts\.googleapis\.com/;
/* supabase-boot.js must initialise cleanly: no "initialization failed" error, and its auth.getSession() check logs
   "Supabase connected." (the getSession defect fixed in the pre-provisioning fixes must never come back). */
const BOOT_FAILED = /Supabase initialization failed|Supabase connection check failed|getSession is not a function/;

(async () => {
  const LIB = pinnedLibrary();
  const srv = await serve(), port = srv.address().port, base = `http://localhost:${port}/`;
  const browser = await playwright.chromium.launch({ args: ['--host-resolver-rules=MAP gearhead.test 127.0.0.1'] });
  const shot = async (page, n) => { if (OUT) await page.screenshot({ path: path.join(OUT, n + '.png'), fullPage: false }); };
  const toastSays = async (page, re) => { await page.waitForFunction(r => new RegExp(r).test(document.getElementById('ghp-toast').textContent), re.source, { timeout: 8000 }); };
  const ready = page => page.waitForFunction(() => document.body.classList.contains('ghp-ready'), null, { timeout: 20000 });

  /* supabase: 'offline' (real network, blocked here) | 'unprovisioned' | 'provisioned'; library: 'pinned' | 'tampered' */
  async function open(url, { supabase = 'offline', library = 'pinned', viewport = { width: 1280, height: 900 } } = {}) {
    const ctx = await browser.newContext({ viewport }), page = await ctx.newPage();
    const env = { ctx, page, pageErrors: [], consoleErrors: [], consoleAll: [], requests: [], violations: [] };
    page.on('pageerror', e => env.pageErrors.push(e.message));
    page.on('console', m => { env.consoleAll.push(m.type() + ': ' + m.text()); if (m.type() === 'error') env.consoleErrors.push(m.text()); });
    page.on('requestfailed', r => { if (ENV_NOISE.test(r.url() + r.failure().errorText)) env.envNoise = true; });
    await page.addInitScript(INSTRUMENT);
    await page.route(LIB.url, route => route.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'text/javascript' }, CORS),
      body: library === 'tampered' ? Buffer.concat([LIB.bytes, Buffer.from('\n/* tampered */')]) : LIB.bytes }));
    await page.route(u => /\.supabase\.co$/.test(new URL(u).hostname), route => {
      const r = route.request(), h = r.headers();
      env.requests.push({ method: r.method(), url: r.url(), apikey: h.apikey || null });
      if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      if (r.method() !== 'GET' && r.method() !== 'HEAD') { env.violations.push(r.method() + ' ' + r.url()); return route.abort(); }
      if (supabase === 'offline') return route.continue();
      if (supabase === 'unprovisioned') return route.fulfill(PGRST(404, 'PGRST205', "Could not find the table 'public.plans' in the schema cache"));
      return route.fulfill(PGRST(401, '42501', 'permission denied for table plans'));
    });
    await page.goto(url);
    await ready(page);
    return env;
  }
  const appErrors = env => env.pageErrors.concat(env.consoleErrors.filter(t => !ENV_NOISE.test(t) && !/Failed to load resource/.test(t)));
  /* boot health: no initialisation error anywhere in the console, and the boot's own auth.getSession() check succeeded */
  async function assertCleanBoot(env) {
    same(env.consoleAll.filter(t => BOOT_FAILED.test(t)), [], 'Supabase initialisation errors');
    await env.page.waitForFunction(() => true);
    for (let i = 0; i < 50 && !env.consoleAll.some(t => /Gearhead Labs: Supabase connected\./.test(t)); i++) await new Promise(r => setTimeout(r, 100));
    assert(env.consoleAll.some(t => /^info: Gearhead Labs: Supabase connected\./.test(t)), 'boot auth.getSession() check did not report success: ' + JSON.stringify(env.consoleAll.filter(t => /Gearhead/.test(t))));
    const s = await env.page.evaluate(async () => { const r = await window.GH_SUPABASE.auth.getSession(); return { error: r.error ? String(r.error.message || r.error) : null, hasData: !!r.data }; });
    same(s, { error: null, hasData: true }, 'GH_SUPABASE.auth.getSession()');
  }
  const bootFacts = page => page.evaluate(() => ({ order: __gh.order, createClient: __gh.createClient, wrapFailed: __gh.wrapFailed || null, events: __gh.events,
    fetches: __gh.fetches, ready: window.GH_SUPABASE_READY === true, hasClient: !!(window.GH_SUPABASE && typeof window.GH_SUPABASE.from === 'function'),
    lib: typeof (window.supabase && window.supabase.createClient), mode: GHP.services.mode, adapter: GHP.services.adapter.kind,
    configUrl: window.GH_SUPABASE_CONFIG && window.GH_SUPABASE_CONFIG.url, configKey: window.GH_SUPABASE_CONFIG && window.GH_SUPABASE_CONFIG.publishableKey }));

  await step('pinned library: index.html SRI equals the sha384 of the npm-registry bytes (tarball sha512 verified)', async () => {
    same(LIB.computed, LIB.sri, 'SRI');
  });

  /* ---------------------------------------------------------------- A. anonymous / no-backend (real network) */
  await step('A1. anonymous visitor, Supabase unreachable: real client created once, app reaches no-backend, calculators work', async () => {
    const env = await open(base + '?gh_dev=0&view=garage', { supabase: 'offline' });
    const f = await bootFacts(env.page);
    same([f.lib, f.hasClient, f.ready, f.createClient, f.mode], ['function', true, true, 1, 'no-backend'], 'boot');
    await assertCleanBoot(env);
    await env.page.waitForSelector('text=Accounts are coming soon');
    await env.page.click('#ghp-nav [data-go="calculators"]');
    assert(await env.page.evaluate(() => document.body.classList.contains('ghp-mode-calculators')), 'calculators mode');
    same(env.violations, [], 'non-GET requests');
    same(appErrors(env), [], 'errors');
    await env.ctx.close();
  });

  /* ---------------------------------------------------------------- B / C. development and Premium development */
  {
    const env = await open(base + '?view=home', { supabase: 'offline' }), page = env.page;
    await step('B1. dev mode boots on the integrated page; navigation has Garage and Saved, no Projects', async () => {
      const f = await bootFacts(page);
      same([f.mode, f.createClient], ['development', 1], 'mode / single client');
      const labels = await page.$$eval('#ghp-nav .ghp-nav-long', n => n.map(x => x.textContent));
      same(labels, ['Home', 'Calculators', 'Engineering Lab', 'My Garage', 'Saved', 'Profile'], 'nav');
      assert(!(await page.content()).match(/\bProjects?\b/), 'Projects text present');
    });
    await step('B2. Free garage: sign in, meter 0 of 1, add a vehicle with engine / transmission / drivetrain', async () => {
      await page.click('#ghp-nav [data-go="garage"]');
      await page.fill('form[data-form="signin"] input[name="email"]', 'smoke@example.test');
      await page.click('form[data-form="signin"] button[type="submit"]');
      await page.waitForSelector('.ghp-meter');
      assert(/0 of 1 vehicle/.test(await page.textContent('#ghp-view')), 'meter 0 of 1');
      await page.click('[data-edit-machine="new"]');
      await page.fill('input[name="model_year"]', '2019'); await page.fill('input[name="make"]', 'Ford'); await page.fill('input[name="model"]', 'Mustang');
      await page.selectOption('select[name="machine_type"]', 'automotive'); await page.selectOption('select[name="power_source"]', 'gasoline');
      await page.fill('input[name="engine"]', '5.0L Coyote V8'); await page.fill('input[name="transmission"]', '6-speed manual'); await page.selectOption('select[name="drivetrain"]', 'RWD');
      assert(!(await page.$('select[name="machine_type"] option[value="marine"]')), 'marine offered');
      await page.click('form[data-form="machine"] button[type="submit"]');
      await toastSays(page, /Vehicle added/);
      await page.waitForSelector('[data-new-setup]');
      const t = await page.textContent('#ghp-view');
      assert(/2019 Ford Mustang/.test(t) && /PRIMARY/.test(t) && /5\.0L Coyote V8/.test(t) && /RWD/.test(t), 'machine detail');
      await shot(page, 'b2-machine');
    });
    await step('B3. Test Setups: add two, edit, re-pin, delete (two-step confirm)', async () => {
      for (const n of ['Street', 'Track']) {
        await page.click('[data-new-setup]'); await page.fill('form[data-form="setup"] input[name="name"]', n);
        await page.fill('form[data-form="setup"] textarea[name="description"]', 'Goals: ' + n);
        const before = (await page.$$('.ghp-build')).length;
        await page.click('form[data-form="setup"] button[type="submit"]'); await toastSays(page, /Test Setup added/);
        await page.waitForFunction(n => document.querySelectorAll('.ghp-build').length === n + 1 && document.querySelector('[data-new-setup]'), before);
      }
      await page.click('[data-edit-setup]'); await page.fill('form[data-form="setup"] textarea[name="notes"]', 'edited');
      await page.click('form[data-form="setup"] button[type="submit"]'); await toastSays(page, /Test Setup updated/);
      await page.waitForFunction(() => /edited/.test(document.getElementById('ghp-view').textContent) && document.querySelector('[data-action="repin-setup"]'));
      const repin = await page.$('[data-action="repin-setup"]'); await repin.click(); await repin.click(); await toastSays(page, /Baseline re-pinned/);
      await page.waitForSelector('[data-action="delete-setup"]');
      const del = await page.$('[data-action="delete-setup"]'); await del.click(); await del.click(); await toastSays(page, /Test Setup deleted/);
      await page.waitForFunction(() => document.querySelectorAll('.ghp-build').length === 1);
    });
    await step('B4. Free garage is full: 1 of 1, no add button, upgrade message', async () => {
      await page.click('[data-go="garage"]'); await page.waitForSelector('.ghp-meter');
      const t = await page.textContent('#ghp-view');
      assert(/1 of 1 vehicle/.test(t) && /Free includes 1 vehicle/.test(t), 'full message');
      assert(!(await page.$('[data-edit-machine="new"]')), 'add button still shown');
      await shot(page, 'b4-full');
    });
    await step('B5. Saved and Lab show Premium teasers for Free; no create/save button anywhere', async () => {
      await page.click('#ghp-nav [data-go="saved"]'); await page.waitForSelector('.ghp-teaser');
      await page.click('#ghp-nav [data-go="lab"]'); await page.waitForSelector('.ghp-teaser');
      assert(!(await page.$('[data-action="save-sheet"]:visible')), 'save visible');
    });
    await step('C1. Premium (development grant): second vehicle, plan card from the entitlement, saved calculations read / edit / pin', async () => {
      await page.click('#ghp-nav [data-go="profile"]'); await page.waitForSelector('[data-action="dev-plan"][data-plan="premium"]');
      await page.click('[data-action="dev-plan"][data-plan="premium"]'); await toastSays(page, /Development plan/);
      await page.waitForFunction(() => /Granted by Gearhead Labs/.test(document.getElementById('ghp-view').textContent));
      assert(/PREMIUM/.test(await page.textContent('#ghp-nav .ghp-plan-pill')), 'nav plan pill');
      await page.click('#ghp-nav [data-go="garage"]'); await page.waitForSelector('[data-edit-machine="new"]');
      await page.click('[data-edit-machine="new"]'); await page.fill('input[name="make"]', 'Ducati'); await page.selectOption('select[name="machine_type"]', 'motorcycle');
      await page.click('form[data-form="machine"] button[type="submit"]'); await toastSays(page, /Vehicle added/);
      await page.click('#ghp-nav [data-go="profile"]'); await page.waitForSelector('[data-action="dev-saved"]');
      await page.click('[data-action="dev-saved"]'); await toastSays(page, /Simulated/);
      await page.click('#ghp-nav [data-go="saved"]'); await page.waitForSelector('[data-action="pin"]');
      const t = await page.textContent('#ghp-view');
      assert(/calculation service, which is not available yet/.test(t), 'creation unavailable is explicit');
      assert(!(await page.$('text=/^\\s*(New|Create|Add) saved/i')), 'a create button exists');
      await page.click('[data-action="pin"]'); await toastSays(page, /Pinned/);
      await page.click('[data-edit-saved]'); await page.fill('form[data-form="saved"] input[name="title"]', 'Dyno pull');
      await page.click('form[data-form="saved"] button[type="submit"]'); await toastSays(page, /Saved calculation updated/);
      assert(/Dyno pull/.test(await page.textContent('#ghp-view')) && /PINNED/.test(await page.textContent('#ghp-view')), 'edited + pinned');
      await shot(page, 'c1-saved');
    });
    await step('C2. Engineering Lab on F1.12.4: analyzers load in the frame, an analysis saves with its links; public calculator count unchanged', async () => {
      await page.click('#ghp-nav [data-go="lab"]'); await page.waitForSelector('[data-analyzer="e12_radiator_heat_rejection"]');
      await page.click('[data-analyzer="e12_radiator_heat_rejection"]');
      await page.waitForSelector('#ghp-runbar [data-action="save-sheet"]', { state: 'visible' });
      await page.waitForFunction(() => GHP.engineering.currentAnalyzer() === 'e12_radiator_heat_rejection', null, { timeout: 20000 });
      const cat = await page.evaluate(() => GHP.engineering.catalogCheck());
      same([cat.count, cat.missing, cat.extra], [14, [], []], 'engineering catalog in the frame');
      const counts = await page.evaluate(() => { const C = GHShell.frame.contentWindow.eval('CALCS'); return [C.filter(c => c.id !== 'dashboard' && c.layer !== 'engineering').length, C.filter(c => c.layer === 'engineering').length]; });
      same(counts, [606, 14], 'public calculators stay 606 with the 14 Premium analyzers loaded');
      await page.click('#ghp-runbar [data-action="save-sheet"]'); await page.waitForSelector('form[data-form="analysis"]');
      await page.fill('form[data-form="analysis"] input[name="title"]', 'Radiator baseline');
      const opts = await page.$$eval('form[data-form="analysis"] select[name="machine_id"] option', o => o.map(x => x.value).filter(Boolean));
      await page.selectOption('form[data-form="analysis"] select[name="machine_id"]', opts[0]);
      await page.click('form[data-form="analysis"] button[type="submit"]'); await toastSays(page, /Analysis saved/);
      const saved = await page.evaluate(async () => (await GHP.services.repos.analyses.list()).map(a => [a.title, a.analyzer_version, a.result_trust, !!a.inputs.fields]));
      same(saved, [['Radiator baseline', 'E1-AUTO', 'client_reported', true]], 'stored');
      await shot(page, 'c2-lab');
    });
    await step('B6/C3. no application errors in development / Premium development; no writes left the browser', async () => {
      same(appErrors(env), [], 'errors'); same(env.violations, [], 'non-GET requests');
      await assertCleanBoot(env);
    });
    await env.ctx.close();
  }

  /* ---------------------------------------------------------------- D. real bootstrap order with the actual client */
  await step('D1. real boot order: supabase-js -> config -> boot -> models -> foundation -> app; ONE createClient; GH_SUPABASE ready before the adapter uses it', async () => {
    const env = await open(base + '?gh_dev=0&view=garage', { supabase: 'provisioned' });
    const f = await bootFacts(env.page);
    same(f.wrapFailed, null, 'createClient instrumentation');
    same(f.order, EXPECTED_ORDER(LIB), 'script execution order');
    same([f.lib, f.hasClient, f.ready, f.createClient], ['function', true, true, 1], 'client');
    same([f.mode, f.adapter], ['production', 'foundation'], 'the foundation adapter is running on the bootstrap client');
    const tClient = (f.events.find(e => e[0] === 'GH_SUPABASE') || [])[1], tDom = (f.events.find(e => e[0] === 'DOMContentLoaded') || [])[1];
    assert(tClient != null && f.fetches.length > 0 && f.fetches.every(x => x[1] >= tClient) && tClient >= tDom, 'a Supabase request happened before the bootstrap client existed');
    const host = new URL(f.configUrl).host;
    assert(env.requests.length > 0 && env.requests.every(r => new URL(r.url).host === host && r.apikey === f.configKey), 'requests did not come from the bootstrap client (host / apikey)');
    assert(env.requests.some(r => /\/rest\/v1\/plans\?select=plan_key&limit=1$/.test(r.url)), 'provisioning probe');
    await env.page.waitForSelector('text=Email me a sign-in link');
    same(env.violations, [], 'non-GET requests'); same(appErrors(env), [], 'errors');
    await assertCleanBoot(env);
    await shot(env.page, 'd1-production');
    await env.ctx.close();
  });
  await step('D2. no race: five fresh loads all reach the same state with one client', async () => {
    for (let i = 0; i < 5; i++) {
      const env = await open(base + '?gh_dev=0', { supabase: 'provisioned' });
      const f = await bootFacts(env.page);
      same([f.mode, f.createClient, f.ready, f.order.length], ['production', 1, true, 12], 'load ' + i);
      await env.ctx.close();
    }
  });

  /* ---------------------------------------------------------------- E. foundation fallback, unprovisioned database */
  await step('E1. empty (unprovisioned) project: the real client gets PGRST205 and the app falls back to no-backend cleanly', async () => {
    const env = await open(base + '?gh_dev=0&view=garage', { supabase: 'unprovisioned' });
    const f = await bootFacts(env.page);
    same([f.createClient, f.ready, f.mode, f.adapter], [1, true, 'no-backend', 'none'], 'fallback');
    await assertCleanBoot(env);
    same(env.requests.map(r => r.method + ' ' + new URL(r.url).pathname), ['GET /rest/v1/plans'], 'only the read-only probe');
    await env.page.waitForSelector('text=Accounts are coming soon');
    same(env.violations, [], 'non-GET requests'); same(appErrors(env), [], 'errors');
    await shot(env.page, 'e1-fallback');
    await env.ctx.close();
  });

  /* ---------------------------------------------------------------- F. the F1.12.4 calculator frame */
  await step('F1. calculator frame: F1.12.4 loads (606 public calculators) and renders a calculator from a deep link, with no JavaScript errors', async () => {
    const env = await open(base + '?gh_dev=0', { supabase: 'offline' }), page = env.page;
    await page.waitForFunction(() => window.GHShell && GHShell.isReady(), null, { timeout: 20000 });
    const frameUrl = await page.evaluate(() => GHShell.frame.contentWindow.location.pathname);
    assert(frameUrl.endsWith('/' + F124), 'frame is ' + frameUrl);
    const info = await page.evaluate(() => { const C = GHShell.frame.contentWindow.eval('CALCS'); const c = C.find(c => c.id !== 'dashboard' && c.layer !== 'engineering');
      return { pub: C.filter(c => c.id !== 'dashboard' && c.layer !== 'engineering').length, eng: C.filter(c => c.layer === 'engineering').length, first: c.id }; });
    same([info.pub, info.eng], [606, 0], 'public calculators; no Premium analyzers for an anonymous visitor');
    await page.goto(base + '?gh_dev=0&calc=' + encodeURIComponent(info.first)); await ready(page);
    await page.waitForFunction(id => { const w = GHShell.frame.contentWindow; return w.eval('typeof currentCalc!=="undefined"?currentCalc:null') === id && w.document.querySelector('#calc-container .calc-header, #calc-container .calc-body'); }, info.first, { timeout: 20000 });
    const txt = await page.evaluate(() => GHShell.frame.contentWindow.document.getElementById('calc-container').textContent);
    assert(txt.length > 40 && !/\bNaN\b|\bundefined\b/.test(txt), 'calculator rendered cleanly');
    same(appErrors(env), [], 'errors');
    env.fontsNoise = env.envNoise;
    await shot(page, 'f1-calculator');
    await env.ctx.close();
    console.log(`      note: environment-only Google Fonts TLS failure observed: ${env.fontsNoise ? 'yes (classified, not an app error)' : 'no'}`);
  });

  /* ---------------------------------------------------------------- H. development mode is local-only */
  await step('H1. a public visitor cannot enable dev mode (?gh_dev=1, or a stored dev-session flag); localhost development still works', async () => {
    const pub = `http://gearhead.test:${port}/`;   // a non-localhost name for the same local server (browser host-resolver rule)
    let env = await open(pub + '?gh_dev=1&view=garage', { supabase: 'unprovisioned' });
    same([await env.page.evaluate(() => location.hostname), await env.page.evaluate(() => GHP.services.mode)], ['gearhead.test', 'no-backend'], '?gh_dev=1 on a public host');
    assert(!(await env.page.$('.ghp-dev-pill')), 'DEV pill shown to a public visitor');
    await env.page.evaluate(() => sessionStorage.setItem('ghp_dev_session', '1'));
    await env.page.reload(); await ready(env.page);
    same(await env.page.evaluate(() => GHP.services.mode), 'no-backend', 'stored dev-session flag on a public host');
    same(appErrors(env), [], 'errors');
    await env.ctx.close();
    env = await open(pub + '?gh_dev=1', { supabase: 'provisioned' });
    same(await env.page.evaluate(() => GHP.services.mode), 'production', '?gh_dev=1 on a public host with a live backend stays production');
    await env.ctx.close();
    env = await open(base + '?gh_dev=1&view=home', { supabase: 'offline' });
    same(await env.page.evaluate(() => GHP.services.mode), 'development', 'localhost (legitimate development)');
    await env.ctx.close();
    env = await open(base + '?gh_dev=0', { supabase: 'offline' });
    same(await env.page.evaluate(() => GHP.services.mode), 'no-backend', '?gh_dev=0 still opts out on localhost');
    await env.ctx.close();
  });

  /* ---------------------------------------------------------------- G. SRI */
  await step('G1. a tampered library is blocked by SRI; no client is created and the app still works (no-backend)', async () => {
    const env = await open(base + '?gh_dev=0&view=garage', { supabase: 'unprovisioned', library: 'tampered' });
    const f = await bootFacts(env.page);
    same([f.lib, f.hasClient, f.createClient, f.mode], ['undefined', false, 0, 'no-backend'], 'blocked');
    assert(env.consoleErrors.some(t => /integrity/i.test(t)), 'no SRI error reported');
    same(env.requests, [], 'no Supabase request without the verified library');
    await env.page.waitForSelector('text=Accounts are coming soon');
    same(env.pageErrors, [], 'uncaught errors');
    await env.ctx.close();
  });

  await browser.close(); srv.close();
  const failed = results.filter(r => !r.pass);
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '\n      -> ' + r.error}`);
  console.log(`\nbrowser tests (Chromium ${browser.version()}, integrated index.html, supabase-js ${LIB.version}): ${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('BROWSER TEST ERROR', e); process.exit(2); });
