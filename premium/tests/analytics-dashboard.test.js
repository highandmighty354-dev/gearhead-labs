#!/usr/bin/env node
/* Owner analytics dashboard (owner/analytics.html) — real Chromium, the real pinned supabase-js, a fake Supabase project.
   The dashboard data is the SYNTHETIC report produced by the real analytics_dashboard() function in
   premium-foundation/tests/analytics.test.js (run tests/run-tests.sh first); the Supabase API is answered inside the
   browser, so no real project, account or traffic is involved. Only the owner-check answer differs between cases:
   the database functions themselves enforce the owner rule (tested in analytics.test.js), and this test proves the page
   shows nothing unless they allow it.
   Run: node premium/tests/analytics-dashboard.test.js */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os'), crypto = require('crypto'), { execSync, execFileSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const EVID = path.join(REPO, 'premium-foundation', 'evidence');
const FIX = JSON.parse(fs.readFileSync(path.join(EVID, 'analytics-dashboard-fixture.json'), 'utf8')).report;
const BILL = JSON.parse(fs.readFileSync(path.join(EVID, 'analytics-billing-fixture.json'), 'utf8')).billing;
const SHOTS = process.env.SHOTS || null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

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
/* The supabase-js build owner/analytics.html pins, from the npm registry (verified), so the page's SRI hash still applies. */
function pinnedLibrary() {
  const html = fs.readFileSync(path.join(REPO, 'owner', 'analytics.html'), 'utf8');
  const [, url, version, file] = html.match(/<script src="(https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@(\d+\.\d+\.\d+)\/(dist\/umd\/supabase\.js))" integrity="sha384-[^"]+"/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oa-sbjs-'));
  execFileSync('npm', ['pack', `@supabase/supabase-js@${version}`, '--pack-destination', dir, '--silent'], { stdio: 'pipe' });
  const tgz = fs.readdirSync(dir).find(f => f.endsWith('.tgz'));
  const published = execFileSync('npm', ['view', `@supabase/supabase-js@${version}`, 'dist.integrity'], { encoding: 'utf8' }).trim();
  const actual = 'sha512-' + crypto.createHash('sha512').update(fs.readFileSync(path.join(dir, tgz))).digest('base64');
  if (actual !== published) throw new Error('supabase-js tarball integrity mismatch');
  execFileSync('tar', ['xzf', path.join(dir, tgz), '-C', dir]);
  const bytes = fs.readFileSync(path.join(dir, 'package', file)); fs.rmSync(dir, { recursive: true, force: true });
  return { url, bytes };
}
const cfgSrc = fs.readFileSync(path.join(REPO, 'supabase-config.js'), 'utf8');
const PROJECT = new URL(cfgSrc.match(/url:\s*"([^"]+)"/)[1]).hostname, REF = PROJECT.split('.')[0];
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const USER = { id: 'a0000000-0000-4000-8000-0000000000a0', email: 'owner@example.test' };
const JWT = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: USER.id, role: 'authenticated', exp: 4102444800, aud: 'authenticated' }) + '.sig';

const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, pass: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, pass: false, error: e.message }); console.log('FAIL  ' + name + '\n      -> ' + e.message.split('\n')[0]); }
}
const ok = (c, what) => { if (!c) throw new Error(what); };
const eq = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const nyToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

(async () => {
  const LIB = pinnedLibrary();
  const srv = await serve(), BASE = `http://127.0.0.1:${srv.address().port}/owner/analytics.html`;
  const browser = await playwright.chromium.launch();

  /* owner: true | false | 'error';  signedIn;  report: what analytics_dashboard returns (or {error}) */
  async function open({ signedIn = true, owner = true, report = FIX, viewport = { width: 1280, height: 900 } } = {}) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const env = { rpc: [], pageErrors: [], other: [] };
    page.on('pageerror', e => env.pageErrors.push(e.message));
    if (signedIn) await page.addInitScript(([key, s]) => localStorage.setItem(key, s), [`sb-${REF}-auth-token`,
      JSON.stringify({ access_token: JWT, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'synthetic', user: { ...USER, aud: 'authenticated', role: 'authenticated' } })]);
    await page.route(LIB.url, r => r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' }, body: LIB.bytes }));
    const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    await page.route(u => u.hostname === PROJECT, r => {
      const req = r.request(), u = new URL(req.url());
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
      const m = /\/rest\/v1\/rpc\/(\w+)$/.exec(u.pathname);
      if (!m) { env.other.push(req.method() + ' ' + u.pathname); return r.fulfill({ status: 404, headers: CORS, body: '{}' }); }
      const fn = m[1], args = JSON.parse(req.postData() || '{}'); env.rpc.push({ fn, args });
      const json = (status, body) => r.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (fn === 'analytics_is_owner') return owner === 'error' ? json(404, { code: 'PGRST202', message: 'not found' }) : json(200, owner === true);
      if (fn === 'analytics_refresh') return owner === true ? r.fulfill({ status: 204, headers: CORS }) : json(403, { code: '42501', message: 'ANALYTICS_NOT_AUTHORISED' });
      if (fn === 'analytics_dashboard') {
        if (owner !== true) return json(403, { code: '42501', message: 'ANALYTICS_NOT_AUTHORISED' });
        if (report.error) return json(400, report.error);
        return json(200, report);
      }
      return json(404, { code: 'PGRST202' });
    });
    await page.goto(BASE);
    return { ctx, page, env };
  }
  const text = (p, sel) => p.locator(sel).innerText();
  const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  await check('signed out: the sign-in form only; no report request is made', async () => {
    const s = await open({ signedIn: false });
    await s.page.waitForSelector('#oa-signin');
    eq(s.env.rpc.length, 0, 'rpc calls');
    ok(!(await s.page.locator('#overview').count()), 'no report');
    eq(s.env.pageErrors, [], 'errors');
    await s.ctx.close();
  });

  await check('signed in, not the owner: "Not authorised"; the report function is never called and nothing is shown', async () => {
    const s = await open({ owner: false });
    await s.page.waitForSelector('[data-state="not-authorised"]');
    eq(s.env.rpc.map(x => x.fn), ['analytics_is_owner'], 'only the owner check');
    ok(!(await s.page.locator('.oa-kpi').count()), 'no figures');
    await s.ctx.close();
  });

  await check('database refuses even though the page was tricked into believing it is the owner: error shown, no figures', async () => {
    const s = await open({ owner: true, report: { error: { code: '42501', message: 'ANALYTICS_NOT_AUTHORISED' } } });
    await s.page.waitForSelector('[data-state="error"]');
    ok((await text(s.page, '#oa-report')).includes('Not authorised'), 'message');
    ok(!(await s.page.locator('.oa-kpi').count()), 'no figures');
    await s.ctx.close();
  });

  await check('analytics not installed on the database: a clear message, no crash', async () => {
    const s = await open({ owner: 'error' });
    await s.page.waitForSelector('[data-state="unavailable"]');
    eq(s.env.pageErrors, [], 'errors');
    await s.ctx.close();
  });

  await check('owner: every section renders the synthetic report exactly (KPIs, comparison, pages, traffic, calculators, LABs, funnel, health)', async () => {
    const s = await open();
    await s.page.waitForSelector('#overview .oa-kpi');
    const k = await s.page.locator('#overview .oa-kpi').evaluateAll(els => els.map(e => [e.querySelector('.l').textContent, e.querySelector('.v').textContent]));
    eq(k, [['Visitors', '3'], ['Sessions', '4'], ['Page views', '5'], ['Engaged sessions', '2'], ['Avg engaged time / session', '7m 47s']], 'KPI tiles');
    ok((await text(s.page, '#overview')).includes('no change') || (await text(s.page, '#overview')).includes('vs previous'), 'previous-period comparison shown');
    for (const id of ['overview', 'pages', 'traffic', 'calculators', 'engagement', 'funnel', 'revenue', 'health']) ok(await s.page.locator('#' + id).count(), 'section ' + id);
    const pages = await text(s.page, '#pages');
    ok(pages.includes('Brake Mean Effective Pressure') || pages.includes('HP') || /hp_from_et|Horsepower/i.test(pages), 'calculator names from the catalogue');
    const t = await text(s.page, '#traffic');
    ok(/Organic search/.test(t) && /Direct/.test(t) && /Campaign/.test(t) && t.includes('www.google.com') && t.includes('newsletter / email / fall'), 'traffic');
    const c = await text(s.page, '#calculators');
    ok(/\b2\b[\s\S]*\b1\b[\s\S]*50\.0%/.test(c), 'starts / completions / completion rate 50.0%');
    ok(/LAB/.test(c) && /free calculators had no views/.test(c), 'LAB comparison and zero-use count');
    const f = await text(s.page, '#funnel');
    ok(/Premium offer seen/.test(f) && /Trial button clicked/.test(f) && /Back from checkout: success/.test(f), 'funnel steps');
    ok(await s.page.locator('[data-billing="pending"]').count(), 'Stripe pending status');
    ok(/Bot sessions excluded/i.test(await text(s.page, '#health')) && /Last event received/.test(await text(s.page, '#health')), 'data health');
    ok(await s.page.locator('[data-banner="test"]').count() === 0, 'no test banner for live');
    eq(s.env.rpc.slice(0, 3).map(x => x.fn), ['analytics_is_owner', 'analytics_refresh', 'analytics_dashboard'], 'call order');
    eq(s.env.pageErrors, [], 'errors');
    if (SHOTS) await s.page.screenshot({ path: path.join(SHOTS, 'dashboard-desktop.png'), fullPage: true });
    await s.ctx.close();
  });

  await check('date filters: 7 / 30 / 90 days / 12 months / custom send the right range; environment switch; bad custom range refused locally', async () => {
    const s = await open();
    await s.page.waitForSelector('#overview .oa-kpi');
    const t = nyToday();
    const last = () => s.env.rpc.filter(x => x.fn === 'analytics_dashboard').pop().args;
    eq(last(), { p_from: addDays(t, -29), p_to: t, p_env: 'live' }, 'default 30 days');
    for (const [k, n] of [['7d', 7], ['90d', 90], ['12m', 365]]) {
      await s.page.click(`[data-preset="${k}"]`); await sleep(300);
      eq(last(), { p_from: addDays(t, 1 - n), p_to: t, p_env: 'live' }, k);
      eq(await s.page.getAttribute(`[data-preset="${k}"]`, 'aria-pressed'), 'true', k + ' pressed');
    }
    await s.page.click('[data-preset="custom"]');
    await s.page.fill('#oa-from', '2026-11-02'); await s.page.fill('#oa-to', '2026-11-08'); await s.page.click('[data-apply]'); await sleep(300);
    eq(last(), { p_from: '2026-11-02', p_to: '2026-11-08', p_env: 'live' }, 'custom');
    const n0 = s.env.rpc.length;
    await s.page.fill('#oa-from', '2026-11-09'); await s.page.click('[data-apply]'); await sleep(300);
    eq(s.env.rpc.length, n0, 'start after end is not sent');
    ok((await text(s.page, '#oa-report')).includes('on or before'), 'message');
    await s.page.fill('#oa-from', '2026-11-02'); await s.page.click('[data-apply]'); await sleep(300); await s.page.selectOption('#oa-env', 'test'); await sleep(300);
    eq(last().p_env, 'test', 'environment');
    ok(await s.page.locator('[data-banner="test"]').count(), 'TEST DATA banner');
    await s.ctx.close();
  });

  await check('live Stripe figures (synthetic live-mode billing) replace the pending status', async () => {
    const s = await open({ report: { ...FIX, billing: BILL } });
    await s.page.waitForSelector('[data-billing="live"]');
    const r = await text(s.page, '#revenue');
    ok(r.includes('$5.00') && r.includes('$59.99'), 'MRR $5.00 / ARR $59.99 from the yearly price');
    await s.ctx.close();
  });

  await check('empty live database: zeros and the "no live visitor data yet" notice, no errors', async () => {
    const empty = JSON.parse(JSON.stringify(FIX));
    Object.keys(empty.kpis).forEach(k => { empty.kpis[k] = 0; empty.kpis_previous[k] = 0; });
    Object.assign(empty, { pages: [], channels: [], referrers: [], campaigns: [], calculators: [], funnel: [], navigation: { by_element: {}, top_paths: [] } });
    empty.trend = empty.trend.map(t => ({ ...t, visitors: 0, sessions: 0, page_views: 0 }));
    empty.health = { ...empty.health, by_day: [], totals: {}, last_event_at: null, bot_sessions: 0 };
    const s = await open({ report: empty });
    await s.page.waitForSelector('[data-banner="no-live"]');
    eq(s.env.pageErrors, [], 'errors');
    await s.ctx.close();
  });

  for (const [label, vp] of [['phone 390x844', { width: 390, height: 844 }], ['tablet 768x1024', { width: 768, height: 1024 }], ['desktop 1440x900', { width: 1440, height: 900 }]]) {
    await check(`layout ${label}: no horizontal page scroll; controls reachable; tables scroll inside their own box`, async () => {
      const s = await open({ viewport: vp });
      await s.page.waitForSelector('#health .oa-kpi');
      eq(await overflow(s.page), 0, 'page overflow px');
      const btn = await s.page.locator('[data-preset="7d"]').boundingBox();
      ok(btn && btn.x >= 0 && btn.x + btn.width <= vp.width && btn.height >= 32, 'filter button on screen and tappable');
      if (SHOTS) await s.page.screenshot({ path: path.join(SHOTS, `dashboard-${vp.width}.png`), fullPage: true });
      await s.ctx.close();
    });
  }

  await check('the dashboard is not linked from the public site and is marked noindex', async () => {
    const html = fs.readFileSync(path.join(REPO, 'owner', 'analytics.html'), 'utf8');
    ok(/<meta name="robots" content="noindex,nofollow,noarchive">/.test(html), 'noindex');
    const pub = ['index.html', 'app-shell.js', 'premium/shell.js', 'sitemap.xml', 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html']
      .filter(f => fs.existsSync(path.join(REPO, f))).filter(f => fs.readFileSync(path.join(REPO, f), 'utf8').includes('owner/analytics'));
    eq(pub, [], 'public files linking to the dashboard');
    ok(!fs.readFileSync(path.join(REPO, 'owner', 'analytics.html'), 'utf8').includes('analytics-config.js'), 'the dashboard itself is not tracked');
  });

  await browser.close(); srv.close();
  const failed = results.filter(r => !r.pass).length;
  console.log(`\nanalytics dashboard: ${results.length} checks, ${results.length - failed} passed, ${failed} failed (synthetic report, fake Supabase API)`);
  fs.writeFileSync(path.join(EVID, 'analytics-dashboard-results.json'), JSON.stringify(results, null, 2) + '\n');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('SUITE ERROR', e); process.exit(2); });
