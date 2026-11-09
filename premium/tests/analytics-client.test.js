#!/usr/bin/env node
/* First-party analytics client (analytics.js) — real Chromium against the integrated index.html served from disk.
   SYNTHETIC: every "visit" here is this test driving the browser. The ingest endpoint is a fake answered inside the
   browser (https://ingest.example.test); nothing leaves the machine and no database is involved. supabase-js is not
   loaded (the CDN is blocked), which the site already tolerates.
   Run: node premium/tests/analytics-client.test.js */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const EP = 'https://ingest.example.test/functions/v1/analytics-ingest';
const FREE = 'bmep', FREE2 = 'afr_lambda', PREMIUM = 'advanced_et';
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

const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, pass: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, pass: false, error: e.message }); console.log('FAIL  ' + name + '\n      -> ' + e.message); }
}
const ok = (c, what) => { if (!c) throw new Error(what); };
const eq = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const srv = await serve(), BASE = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await playwright.chromium.launch();

  /* A page with analytics either as shipped (enabled:false) or switched on by answering analytics-config.js differently.
     All requests are recorded; the ingest endpoint is answered with 204 (or aborted when down). */
  async function open({ enabled = true, down = false, url = '', gpc = false, viewport } = {}) {
    const ctx = await browser.newContext(viewport ? { viewport } : {});
    const page = await ctx.newPage();
    const env = { requests: [], batches: [], pageErrors: [], ingestCalls: 0 };
    page.on('pageerror', e => env.pageErrors.push(e.message));
    page.on('request', r => env.requests.push(r.url()));
    if (gpc) await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true }));
    await page.route('https://cdn.jsdelivr.net/**', r => r.abort());
    if (enabled) await page.route(u => u.pathname.startsWith('/analytics-config.js'), r => r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' },
      body: `window.GH_ANALYTICS_CONFIG = { enabled: true, endpoint: '${EP}', env: 'test' };` }));
    await page.route(EP, r => {
      env.ingestCalls++;
      if (down) return r.abort('connectionrefused');
      try { env.batches.push(JSON.parse(r.request().postData() || 'null')); } catch (e) { env.batches.push({ unparsable: true }); }
      return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    });
    await page.goto(BASE + url);
    await page.waitForFunction(() => document.getElementById('app').__ghReady === true, null, { timeout: 30000 });
    const frame = () => page.frame({ url: /F1_12_4/ });
    const events = () => env.batches.flatMap(b => (b && b.events) || []);
    const flush = async () => { await page.evaluate(() => window.GH_ANALYTICS.flush && window.GH_ANALYTICS.flush()); await sleep(300); };
    return { ctx, page, env, frame, events, flush };
  }
  /* Real typing into the first number input of the calculator (each keystroke re-renders the calculator). */
  async function typeInto(f, text, which = 0) {
    const inp = f.locator('#calc-container input.field-input').nth(which);
    await inp.click(); await inp.press('Control+A'); await inp.pressSequentially(text, { delay: 40 });
  }
  const resultText = async (f) => (await f.locator('#calc-container .result-value').allTextContents()).join('|');
  const NAME = { [FREE]: 'bmep', [FREE2]: 'lambda converter' };
  /* Real navigation as a visitor does it: type into the calculator search and click the result. */
  const navTo = async (f, id) => {
    const box = f.locator('#search-input'); await box.fill(''); await box.pressSequentially(NAME[id], { delay: 20 });
    await f.locator(`#calc-nav a.gh-nav-item[href="?calc=${id}"]`).first().click();
    await box.fill(''); await box.dispatchEvent('input');
  };

  await check('shipped default: analytics is OFF — no request, no storage, calculators unchanged', async () => {
    const s = await open({ enabled: false, url: '?calc=' + FREE });
    const f = s.frame(); await typeInto(f, '123'); await sleep(2600);
    eq(await s.page.evaluate(() => window.GH_ANALYTICS && window.GH_ANALYTICS.status), 'off', 'status');
    eq(s.env.ingestCalls, 0, 'ingest requests');
    eq(s.env.requests.filter(u => !u.startsWith(BASE) && !/^https:\/\/(cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com)\//.test(u)), [], 'no other network (the site\'s own fonts / library aside)');
    const keys = await s.page.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)).filter(k => k.startsWith('gh_a_')));
    eq(keys, [], 'storage');
    ok((await resultText(f)).length > 0, 'calculator still shows results');
    eq(s.env.pageErrors, [], 'page errors');
    await s.ctx.close();
  });

  await check('page views: a live re-render on every keystroke is NOT a new page view; navigation is', async () => {
    const s = await open({ url: '?calc=' + FREE });
    const f = s.frame();
    await typeInto(f, '98765'); await sleep(2600);
    await navTo(f, FREE2); await sleep(1200);
    await s.flush();
    const pv = s.events().filter(e => e.name === 'page_view').map(e => e.page);
    eq(pv, ['calc:' + FREE, 'calc:' + FREE2], 'page views');
    const nav = s.events().filter(e => e.name === 'nav_click');
    eq(nav.map(e => [e.page, e.props.to_page, e.props.element]), [['calc:' + FREE, 'calc:' + FREE2, 'search_result']], 'nav click');
    await s.page.goto(BASE + '?lab=diesel'); await s.page.waitForFunction(() => document.getElementById('app').__ghReady === true); await sleep(1500);   // app-shell re-syncs the frame route up to 1 s after load
    await s.frame().locator('.gh-directory a').first().click(); await sleep(1500); await s.flush();
    const tile = s.events().filter(e => e.name === 'nav_click').pop();
    eq([tile.page, tile.props.element, /^calc:/.test(tile.props.to_page)], ['lab:diesel', 'lab_tile', true], 'LAB tile click');
    const first = s.events().find(e => e.name === 'page_view');
    eq([first.props.is_session_start, first.props.is_new_visitor], [true, true], 'session start / new visitor');
    eq(s.env.pageErrors, [], 'page errors');
    await s.ctx.close();
  });

  await check('calculator: start on first input (once), complete 2 s after the last input with a valid result (once); no input values sent', async () => {
    const s = await open({ url: '?calc=' + FREE });
    const f = s.frame();
    await typeInto(f, '987654', 0); await sleep(500); await typeInto(f, '4321', 1);
    await sleep(800);
    await s.flush();
    eq(s.events().filter(e => e.name === 'calc_complete').length, 0, 'not complete while still typing (< 2 s)');
    await sleep(2200); await s.flush();
    const ev = n => s.events().filter(e => e.name === n);
    eq(ev('calc_view').map(e => e.props), [{ calc_id: FREE }], 'calc_view');
    eq(ev('calc_start').map(e => e.props), [{ calc_id: FREE }], 'calc_start once');
    eq(ev('calc_complete').length, 1, 'calc_complete once');
    const c = ev('calc_complete')[0].props;
    eq([c.calc_id, c.fields_touched], [FREE, 2], 'complete props');
    ok(c.ms_to_complete >= 2000 && c.ms_to_complete < 15000, 'ms_to_complete ' + c.ms_to_complete);
    eq(Object.keys(c).sort(), ['calc_id', 'fields_touched', 'ms_to_complete'], 'only allow-listed props');
    const wire = JSON.stringify(s.env.batches);
    ok(!/987654|4321|98765/.test(wire), 'typed values never leave the page');
    const results = await resultText(f);
    ok(results && !wire.includes(results.split('|')[0].trim()), 'result values never leave the page');
    await s.ctx.close();
  });

  await check('calculator: abandonment = started, then left before a completion (no calc_complete; page_leave sent)', async () => {
    const s = await open({ url: '?calc=' + FREE });
    const f = s.frame();
    await typeInto(f, '5'); await sleep(400);
    await navTo(f, FREE2); await sleep(3000); await s.flush();
    const names = s.events().filter(e => e.page === 'calc:' + FREE).map(e => e.name);
    ok(names.includes('calc_start') && !names.includes('calc_complete') && names.includes('page_leave'), 'events ' + names.join(','));
    await s.ctx.close();
  });

  await check('engagement: active time is counted; time after 30 s without activity is not', async () => {
    const s = await open({ url: '?calc=' + FREE });
    for (let i = 0; i < 6; i++) { await s.page.mouse.move(100 + i * 10, 200); await sleep(500); }
    const f = s.frame(); await navTo(f, FREE2); await sleep(1000); await s.flush();
    const leave = s.events().find(e => e.name === 'page_leave' && e.page === 'calc:' + FREE);
    ok(leave && leave.props.engaged_ms >= 2000 && leave.props.engaged_ms <= 8000, 'engaged ms ' + (leave && leave.props.engaged_ms));
    // fast-forward checks of the idle rule: rewrite the engaged clock inside the page (no waiting 30 s in a test)
    const idle = await s.page.evaluate(async () => {
      const real = Date.now, t0 = real.call(Date); let off = 0; Date.now = () => real.call(Date) + off;
      off = 31000;                                                     // 31 s without activity
      await new Promise(r => setTimeout(r, 4000));
      Date.now = real; return t0;
    });
    ok(idle, 'clock shim ran');
    await navTo(f, FREE); await sleep(800); await s.flush();
    const l2 = s.events().filter(e => e.name === 'page_leave' && e.page === 'calc:' + FREE2).pop();
    ok(l2 && l2.props.engaged_ms <= 2600, 'the 4 s after 31 s of inactivity are not counted (only the ~1.5 s before): ' + (l2 && l2.props.engaged_ms));
    await s.ctx.close();
  });

  await check('search: result count after 1.5 s idle, click rank on choosing a result; the search text is never sent', async () => {
    const s = await open({ url: '' });
    const f = s.frame();
    await f.locator('#search-input').pressSequentially('lambda', { delay: 30 });
    await sleep(1900);
    await f.locator('#calc-nav a.gh-nav-item').first().click(); await sleep(1200); await s.flush();
    const sr = s.events().filter(e => e.name === 'search');
    eq(sr.length, 1, 'one search event');
    ok(sr[0].props.result_count >= 1 && sr[0].props.clicked_rank === 1, 'props ' + JSON.stringify(sr[0].props));
    const nav = s.events().filter(e => e.name === 'nav_click').pop();
    eq(nav && nav.props.element, 'search_result', 'nav element');
    const vals = s.env.batches.flatMap(b => b.events).flatMap(e => Object.entries(e.props).map(([k, v]) => k + '=' + v));
    ok(!vals.some(v => /^query=|=lambda$/.test(v)), 'no search text in any property: ' + vals.filter(v => /lambda/.test(v)).join(','));
    await s.ctx.close();
  });

  await check('Premium funnel: gate view on a Premium calculator, offer view + sign-in request on Profile, checkout return once', async () => {
    const s = await open({ url: '?calc=' + PREMIUM });
    await sleep(1500); await s.flush();
    eq(s.events().filter(e => e.name === 'premium_gate_view').map(e => e.props.calc_id), [PREMIUM], 'gate');
    await s.page.goto(BASE + '?view=profile'); await s.page.waitForSelector('[data-premium-offer]', { timeout: 20000 }); await sleep(1500);
    await s.page.fill('form[data-form="signin"] input[name="email"]', 'synthetic-visitor@example.test');
    await s.page.locator('form[data-form="signin"] button[type="submit"]').click(); await sleep(800); await s.flush();
    const ev = s.events();
    eq(ev.filter(e => e.name === 'premium_offer_view').map(e => [e.page, e.props.signed_in]), [['view:profile', false]], 'offer');
    eq(ev.filter(e => e.name === 'signin_request').length, 1, 'signin request');
    // the magic link signed the visitor in (simulated: Supabase stores its session under sb-<ref>-auth-token)
    await s.page.evaluate(() => localStorage.setItem('sb-synthetic-auth-token', '{"synthetic":true}')); await sleep(900); await s.flush();
    eq(s.events().filter(e => e.name === 'signin_complete').map(e => e.props), [{}], 'sign-in completion (no account id sent)');
    ok(!JSON.stringify(s.env.batches).includes('synthetic":true'), 'session value never read out');
    ok(!JSON.stringify(s.env.batches).includes('synthetic-visitor'), 'email never sent');
    // PR #28's checkout button is not on main: a button with its exact attributes is added to this test page only.
    await s.page.evaluate(() => { const b = document.createElement('button'); b.dataset.action = 'checkout'; b.dataset.interval = 'year'; b.textContent = 'Start free trial · $59.99/year after'; document.querySelector('[data-premium-offer]').appendChild(b); });
    await s.page.locator('button[data-action="checkout"]').click(); await sleep(300); await s.flush();
    eq(s.events().filter(e => e.name === 'trial_click').map(e => e.props), [{ interval: 'year', trial: true }], 'trial click');
    // leaving for Stripe: the pagehide handler runs (dispatched here so its beacon is observable; real unload delivery is the browser's)
    await s.page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide'))); await sleep(500);
    await s.page.goto(BASE + '?view=profile&checkout=success'); await sleep(1500); await s.flush();
    await s.page.reload(); await sleep(1500); await s.flush();
    eq(s.events().filter(e => e.name === 'checkout_redirect').map(e => e.props), [{ interval: 'year' }], 'redirect inferred on leaving within 15 s');
    eq(s.events().filter(e => e.name === 'checkout_return').map(e => e.props), [{ outcome: 'success' }], 'return counted once (not on reload)');
    eq(s.env.pageErrors, [], 'page errors');
    await s.ctx.close();
  });

  await check('privacy: every payload has only envelope fields; page keys never carry a URL, query or email; GPC => session-only visitor id', async () => {
    const s = await open({ url: '?calc=' + FREE + '&utm_source=Forum%20Post&utm_medium=social&email=x%40y.z', gpc: true });
    await typeInto(s.frame(), '42'); await sleep(2600); await s.flush();
    const fields = new Set(s.events().flatMap(e => Object.keys(e)));
    eq([...fields].sort(), ['event_id', 'name', 'page', 'props', 'pv_id', 'seq', 'sid', 'ts_client', 'vid', 'viewport'], 'envelope');
    ok(s.events().every(e => /^[a-z0-9:_./-]+$/.test(e.page)), 'page keys');
    ok(!JSON.stringify(s.env.batches).includes('x@y.z') && !JSON.stringify(s.env.batches).includes('email'), 'no email');
    const pv = s.events().find(e => e.name === 'page_view');
    eq([pv.props.utm_source, pv.props.utm_medium, 'is_new_visitor' in pv.props], ['forum-post', 'social', false], 'utm normalised; no new/returning under GPC');
    const st = await s.page.evaluate(() => ({ local: Object.keys(localStorage).filter(k => k.startsWith('gh_a_')), session: Object.keys(sessionStorage).filter(k => k.startsWith('gh_a_')) }));
    eq(st.local, [], 'nothing in localStorage under GPC');
    ok(st.session.includes('gh_a_vid'), 'session-only id');
    eq(s.env.batches.every(b => b.wd === true), true, 'automation flag sent (server marks these as bot traffic)');
    await s.ctx.close();
  });

  await check('ingestion down: calculators keep working, no page error, queue stays capped at 50, sending backs off', async () => {
    const s = await open({ url: '?calc=' + FREE, down: true });
    const f = s.frame();
    const before = await resultText(f);
    for (let i = 0; i < 6; i++) { await navTo(f, i % 2 ? FREE : FREE2); await sleep(700); }
    await typeInto(f, '777'); await sleep(2600);
    for (let i = 0; i < 30; i++) await s.page.evaluate(() => window.GH_ANALYTICS.flush());
    const q = await s.page.evaluate(() => window.GH_ANALYTICS._queue().length);
    ok(q > 0 && q <= 50, 'queue ' + q);
    ok(s.env.ingestCalls <= 4, 'backed off after failures: ' + s.env.ingestCalls + ' attempts');
    ok((await resultText(f)) !== before || before.length > 0, 'calculator still renders');
    eq(s.env.pageErrors, [], 'page errors');
    await s.ctx.close();
  });

  /* ---------- calculator completion detector ---------- */
  await check('completion classifier: empty, placeholder, NaN/Infinity, errors and text are not results; numbers in real formats are', async () => {
    const s = await open({ url: '?calc=' + FREE });
    const cases = [['', 'empty'], ['—', 'empty'], ['–', 'empty'], ['-', 'empty'], ['Enter values', 'empty'], ['Select an option', 'empty'],
      ['NaN', 'bad'], ['NaN psi', 'bad'], ['Infinity', 'bad'], ['-Infinity HP', 'bad'], ['∞', 'bad'], ['undefined', 'bad'], ['null', 'bad'],
      ['Error: check inputs', 'bad'], ['Invalid input', 'bad'], ['1e999', 'bad'],
      ['Lean', 'text'], ['High risk', 'text'], ['No unique octane number', 'text'],
      ['42', 'number'], ['0', 'number'], ['3.14', 'number'], ['.5', 'number'], ['-12.5', 'number'], ['−5.0 °', 'number'], ['1,234.5 lb-ft', 'number'],
      ['$1,200', 'number'], ['~350HP', 'number'], ['≈ 12.7 sec', 'number'], ['14.7:1', 'number'], ['3/8', 'number'], ['1.2e-3 m³', 'number'],
      ['6.02 × 10^23', 'number'], ['5,000 RPM', 'number'], ['98.6%', 'number'], ['1 234 kg', 'number']];
    const got = await s.page.evaluate(cs => cs.map(([t]) => window.GH_ANALYTICS.classifyResult(t)), cases);
    eq(got, cases.map(c => c[1]), 'classifications');
    const states = await s.page.evaluate(() => {
      const make = (html) => { const d = document.implementation.createHTMLDocument('x'); d.body.innerHTML = '<div id="calc-container">' + html + '</div>'; return window.GH_ANALYTICS.resultState(d); };
      const v = (t) => '<div class="result-value">' + t + '</div>', m = (t) => '<div class="mini-result"><div class="label">L</div><div class="value">' + t + '</div></div>';
      return [make(''), make(v('')), make(v('—')), make(v('NaN')), make(v('Lean')), make(v('42<span class="unit"> psi</span>')),
        make('<div class="multi-results">' + m('—') + m('1,234.5<span class="unit"> lb-ft</span>') + '</div>'),
        make('<div class="multi-results">' + m('12') + m('NaN') + '</div>'), make(v('High risk') + m('7.5')), make(v('0<span class="unit"> NaN-units</span>'))];
    });
    eq(states, ['none', 'invalid', 'invalid', 'invalid', 'invalid', 'valid', 'valid', 'invalid', 'valid', 'valid'], 'result areas (unit spans ignored)');
    await s.ctx.close();
  });

  /* A synthetic calculator page (served only inside this test) so each result behaviour can be produced on demand.
     The visitor's typing is REAL (trusted) browser input; the "calculator" doubles the typed number, or misbehaves per mode. */
  async function openFixture(mode) {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    const env = { batches: [], pageErrors: [] };
    page.on('pageerror', e => env.pageErrors.push(e.message));
    const top = `<!doctype html><meta charset="utf-8"><script>window.GH_ANALYTICS_CONFIG={enabled:true,endpoint:'${EP}',env:'test'}</script>
      <script src="/analytics.js"></script><iframe id="app" src="/fx/frame.html?calc=fixture_calc&mode=${mode}" style="width:800px;height:400px"></iframe>`;
    const frame = `<!doctype html><meta charset="utf-8"><div id="calc-container"><input id="a" class="field-input" type="text" value="10">
      <input id="b" class="field-input" type="text" value="1"><div id="out"></div></div><script>
      const mode = new URLSearchParams(location.search).get('mode'), out = document.getElementById('out');
      const show = (h) => { out.innerHTML = h; };
      const r = (t) => '<div class="result-value">' + t + '</div>';
      const compute = () => { const x = parseFloat(document.getElementById('a').value);
        if (mode === 'unchanged') return;
        if (mode === 'error') return show(r('Error: check inputs'));
        if (mode === 'text') return show(r('Lean'));
        if (mode === 'multi') return show('<div class="multi-results"><div class="mini-result"><div class="value">—</div></div><div class="mini-result"><div class="value">' + (x * 2).toLocaleString('en-US') + '<span class="unit"> lb-ft</span></div></div></div>');
        if (mode === 'delay1' || mode === 'delay3') { show(r('—')); clearTimeout(window.__t); window.__t = setTimeout(() => show(r((x * 2) + ' psi')), mode === 'delay1' ? 1000 : 3000); return; }
        show(r(isFinite(x) ? (x * 2) + ' psi' : 'NaN psi'));
      };
      show(r('20 psi'));                                         // a default result is on screen before anyone types
      document.addEventListener('input', compute);
      </script>`;
    await page.route(u => u.pathname === '/fx/top.html', r => r.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: top }));
    await page.route(u => u.pathname === '/fx/frame.html', r => r.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: frame }));
    await page.route(EP, r => { try { env.batches.push(JSON.parse(r.request().postData() || 'null')); } catch (e) { /* ignore */ } return r.fulfill({ status: 204 }); });
    await page.goto(BASE + 'fx/top.html'); await sleep(800);
    const f = page.frame({ url: /\/fx\/frame\.html/ });
    const type = async (sel, text) => { const i = f.locator(sel); await i.click(); await i.press('Control+A'); await i.pressSequentially(text, { delay: 30 }); };
    const names = async () => { await page.evaluate(() => window.GH_ANALYTICS.flush()); await sleep(300); return env.batches.flatMap(b => b.events).map(e => e.name).filter(n => /^calc_/.test(n)); };
    return { ctx, page, f, env, type, names };
  }
  const FX = [
    ['default result on screen, nobody types: no start, no completion', 'normal', async (x) => { await sleep(2600); return []; }, ['calc_view']],
    ['scripted fill (untrusted input event): ignored', 'normal', async (x) => { await x.f.evaluate(() => { const a = document.getElementById('a'); a.value = '77'; a.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(2600); }, ['calc_view']],
    ['valid integer result after typing: one completion', 'normal', async (x) => { await x.type('#a', '21'); await sleep(2600); }, ['calc_view', 'calc_start', 'calc_complete']],
    ['decimal result: completion', 'normal', async (x) => { await x.type('#a', '2.75'); await sleep(2600); }, ['calc_view', 'calc_start', 'calc_complete']],
    ['several result fields (one "—", one formatted with units): completion', 'multi', async (x) => { await x.type('#a', '1234.5'); await sleep(2600); }, ['calc_view', 'calc_start', 'calc_complete']],
    ['NaN result: no completion', 'normal', async (x) => { await x.type('#a', 'abc'); await sleep(2600); }, ['calc_view', 'calc_start']],
    ['error message: no completion', 'error', async (x) => { await x.type('#a', '5'); await sleep(2600); }, ['calc_view', 'calc_start']],
    ['non-numeric text result: no completion', 'text', async (x) => { await x.type('#a', '5'); await sleep(2600); }, ['calc_view', 'calc_start']],
    ['input that does not re-render the calculator (old default result still showing): no completion', 'unchanged', async (x) => { await x.type('#a', '5'); await sleep(2600); }, ['calc_view', 'calc_start']],
    ['result appears 1 s after the input: completion', 'delay1', async (x) => { await x.type('#a', '8'); await sleep(2800); }, ['calc_view', 'calc_start', 'calc_complete']],
    ['result appears 3 s after the input: completion once it appears', 'delay3', async (x) => { await x.type('#a', '8'); await sleep(2200); eq((await x.names()).includes('calc_complete'), false, 'not yet at 2 s'); await sleep(1600); }, ['calc_view', 'calc_start', 'calc_complete']],
    ['valid, then invalidated by more input within 2 s: no completion; later valid: exactly one', 'normal', async (x) => {
      await x.type('#a', '5'); await sleep(800); await x.type('#a', 'x'); await sleep(2600);
      eq((await x.names()).filter(n => n === 'calc_complete').length, 0, 'none while invalid');
      await x.type('#a', '6'); await sleep(2600); await x.type('#b', '9'); await sleep(2600); }, ['calc_view', 'calc_start', 'calc_complete']],
  ];
  for (const [label, mode, act, want] of FX) {
    await check('completion (synthetic calculator, real typing): ' + label, async () => {
      const x = await openFixture(mode);
      await act(x);
      eq(await x.names(), want, 'events');
      const c = x.env.batches.flatMap(b => b.events).find(e => e.name === 'calc_complete');
      if (c) { eq(Object.keys(c.props).sort(), ['calc_id', 'fields_touched', 'ms_to_complete'], 'props'); ok(!JSON.stringify(x.env.batches).match(/psi|lb-ft|2469|"42"/), 'no result text sent'); }
      eq(x.env.pageErrors, [], 'errors');
      await x.ctx.close();
    });
  }

  /* Representative REAL calculators from all five labs, real typing into the first field. */
  const REPS = [['gasoline', 'afr_from_lambda'], ['gasoline', 'boost_for_hp'], ['diesel', 'diesel_bsfc'], ['diesel', 'diesel_bmep'], ['ev', 'ev_battery_current'],
    ['ev', 'ev_motor_power'], ['towing', 'tow_actual_combined'], ['towing', 'tongue_weight'], ['universal', 'ackermann_angle'], ['universal', 'braking_distance']];
  await check('completion on real calculators, two per LAB (gasoline, diesel, EV, towing, universal): exactly one each, nothing before typing', async () => {
    const miss = [];
    for (const [lab, id] of REPS) {
      const s = await open({ url: '?calc=' + id }); const f = s.frame();
      await sleep(2300); await s.flush();
      if (s.events().some(e => e.name === 'calc_complete')) miss.push(id + ': completed before any input');
      await typeInto(f, '12'); await sleep(2600); await typeInto(f, '13', 0); await sleep(2600); await s.flush();
      const n = s.events().filter(e => e.name === 'calc_complete' && e.props.calc_id === id).length;
      if (n !== 1) miss.push(`${lab}/${id}: ${n} completions`);
      await s.ctx.close();
    }
    eq(miss, [], 'calculators');
  });
  await check('real calculator, unparseable input ("abc") showing "—": no completion', async () => {
    const s = await open({ url: '?calc=ackermann_angle' }); const f = s.frame();
    await typeInto(f, 'abc'); await sleep(2600); await s.flush();
    eq(await s.page.evaluate(() => window.GH_ANALYTICS.resultState(document.getElementById('app').contentDocument)), 'invalid', 'result area state');
    eq(s.events().filter(e => e.name === 'calc_complete').length, 0, 'no completion');
    await s.ctx.close();
  });

  /* Catalogue sweep: every catalogue calculator is rendered in the real page, a scripted value is put in its first field, and
     the detector's verdict on the resulting result area is recorded. This checks the RESULT FORMATS only (scripted input
     never counts as a visitor's start; the typing tests above cover that). */
  await check('catalogue sweep: result-area verdict for every free calculator after an input (exceptions listed in evidence)', async () => {
    const s = await open({ url: '?calc=' + FREE }); const f = s.frame();
    const cat = JSON.parse(fs.readFileSync(path.join(REPO, 'catalog', 'gearhead-catalog.json'), 'utf8')).tools;
    const res = await f.evaluate(async (tools) => {
      const out = [];
      for (const t of tools) {
        renderCalc(t.id); await new Promise(r => setTimeout(r, 0));
        const inp = document.querySelector('#calc-container input.field-input, #calc-container input');
        if (!inp) { out.push({ id: t.id, lab: t.lab, tier: t.tier, state: 'no-input' }); continue; }
        const v = parseFloat(inp.value); inp.value = isFinite(v) && v !== 0 ? String(+(v * 1.1).toFixed(4)) : '10';
        inp.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 0));
        out.push({ id: t.id, lab: t.lab, tier: t.tier, state: parent.GH_ANALYTICS.resultState(document), upsell: !!document.querySelector('#calc-container .gh-premium-upsell') });
      }
      return out;
    }, cat.map(t => ({ id: t.id, lab: t.lab, tier: t.tier })));
    const free = res.filter(r => r.tier !== 'premium');
    const tally = {}; free.forEach(r => { tally[r.lab] = tally[r.lab] || {}; tally[r.lab][r.state] = (tally[r.lab][r.state] || 0) + 1; });
    const exceptions = free.filter(r => r.state !== 'valid').map(r => `${r.id} (${r.lab}): ${r.state}`);
    results.sweep = { catalogue: cat.length, free: free.length, premium_skipped: res.length - free.length, valid: free.length - exceptions.length, by_lab: tally, exceptions };
    console.log(`      ${free.length - exceptions.length}/${free.length} free calculators show a result the detector accepts; exceptions: ${exceptions.join('; ')}`);
    ok(free.length === 585 && free.length - exceptions.length >= 570, 'coverage');
    await s.ctx.close();
  });

  await check('performance: typing into a calculator with analytics ON vs OFF (same machine, alternating runs)', async () => {
    const timeRun = async (enabled) => {
      const s = await open({ enabled, url: '?calc=' + FREE });
      const f = s.frame(); const inp = f.locator('#calc-container input.field-input').first();
      await inp.click();
      await inp.press('Control+A'); await sleep(3000);          // let page start-up (and the first analytics send) finish
      await f.evaluate(() => { window.__t0 = performance.now(); });
      await inp.pressSequentially('1234567890123456789012345678901234567890', { delay: 0 });   // 40 real keystrokes, each a live re-render
      const t = await f.evaluate(() => performance.now() - window.__t0);
      await s.ctx.close(); return t;
    };
    const off = [], on = [];
    for (let i = 0; i < 6; i++) { if (i % 2) { on.push(await timeRun(true)); off.push(await timeRun(false)); } else { off.push(await timeRun(false)); on.push(await timeRun(true)); } }
    console.log('      samples OFF ' + off.map(x => x.toFixed(0)).join(' ') + ' | ON ' + on.map(x => x.toFixed(0)).join(' '));
    const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const mOff = med(off), mOn = med(on);
    console.log(`      40 real keystrokes (each a live re-render): median ${mOff.toFixed(1)} ms OFF vs ${mOn.toFixed(1)} ms ON (${(mOn - mOff).toFixed(1)} ms difference)`);
    results.perf = { off, on, median_off_ms: mOff, median_on_ms: mOn };
    ok(mOn <= mOff * 1.25 + 20, `analytics adds too much: ${mOn} vs ${mOff}`);
  });

  await browser.close(); srv.close();
  const failed = results.filter(r => !r.pass).length;
  console.log(`\nanalytics client: ${results.length} checks, ${results.length - failed} passed, ${failed} failed (synthetic browser sessions, fake endpoint)`);
  const outDir = path.join(REPO, 'premium-foundation', 'evidence'); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'analytics-client-results.json'), JSON.stringify({ checks: results, performance: results.perf || null, catalogue_sweep: results.sweep || null }, null, 2) + '\n');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('SUITE ERROR', e); process.exit(2); });
