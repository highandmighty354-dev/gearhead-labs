#!/usr/bin/env node
/* Gearhead Labs Premium — Chromium smoke test of the shell (no network beyond a local static server, no database).
   Serves the repository on 127.0.0.1 and drives the real index.html in headless Chromium:
     A. development mode (localhost): sign in, Free garage with the 1-vehicle meter, Test Setups, no Projects,
        saved calculations without a create button, Premium via the development tools, Engineering Lab save
     B. no-backend mode (?gh_dev=0): the shell works without accounts
     C. foundation adapter with a fake bootstrap client (injected into the served page only; index.html on disk is not
        changed): an unprovisioned schema falls back to no-backend; a provisioned one offers the magic-link sign-in
   Needs Playwright (resolved from the global npm root) and its Chromium.   Run: node premium/tests/browser-smoke.js */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const OUT = process.env.SMOKE_OUT || null;   // optional screenshot directory

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
async function step(name, fn) { try { await fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: String(e && e.message || e).split('\n')[0].slice(0, 300) }); } }
const assert = (c, m) => { if (!c) throw new Error(m); };

(async () => {
  const srv = await serve(), port = srv.address().port;
  const browser = await playwright.chromium.launch();
  const errorsOf = page => { const errs = []; page.on('pageerror', e => errs.push(e.message)); return errs; };
  const shot = async (page, n) => { if (OUT) await page.screenshot({ path: path.join(OUT, n + '.png'), fullPage: false }); };
  const toastSays = async (page, re) => { await page.waitForFunction(r => new RegExp(r).test(document.getElementById('ghp-toast').textContent), re.source, { timeout: 8000 }); };
  const ready = page => page.waitForFunction(() => document.body.classList.contains('ghp-ready'), null, { timeout: 15000 });

  /* ---------------------------------------------------------------- A. development mode */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), page = await ctx.newPage(), errs = errorsOf(page);
    const base = `http://localhost:${port}/`;
    await step('A1. dev mode boots; navigation has Garage and Saved, no Projects', async () => {
      await page.goto(base + '?view=home'); await ready(page);
      assert(await page.evaluate(() => GHP.services.mode) === 'development', 'mode');
      const labels = await page.$$eval('#ghp-nav .ghp-nav-long', n => n.map(x => x.textContent));
      assert(JSON.stringify(labels) === JSON.stringify(['Home', 'Calculators', 'Engineering Lab', 'My Garage', 'Saved', 'Profile']), 'nav: ' + labels);
      assert(!(await page.content()).match(/\bProjects?\b/), 'Projects text present');
    });
    await step('A2. Free garage: sign in, meter 0 of 1, add a vehicle with engine / transmission / drivetrain', async () => {
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
      await page.waitForSelector('[data-new-setup]');   // the detail view has rendered
      const t = await page.textContent('#ghp-view');
      assert(/2019 Ford Mustang/.test(t) && /PRIMARY/.test(t) && /5\.0L Coyote V8/.test(t) && /RWD/.test(t), 'machine detail');
      await shot(page, 'a2-machine');
    });
    await step('A3. Test Setups: add two, edit, re-pin, delete (two-step confirm)', async () => {
      for (const n of ['Street', 'Track']) {
        await page.click('[data-new-setup]'); await page.fill('form[data-form="setup"] input[name="name"]', n);
        await page.fill('form[data-form="setup"] textarea[name="description"]', 'Goals: ' + n);
        const before = (await page.$$('.ghp-build')).length;
        await page.click('form[data-form="setup"] button[type="submit"]'); await toastSays(page, /Test Setup added/);
        await page.waitForFunction(n => document.querySelectorAll('.ghp-build').length === n + 1 && document.querySelector('[data-new-setup]'), before);
      }
      assert((await page.$$('.ghp-build')).length === 2, 'two setups');
      await page.click('[data-edit-setup]'); await page.fill('form[data-form="setup"] textarea[name="notes"]', 'edited');
      await page.click('form[data-form="setup"] button[type="submit"]'); await toastSays(page, /Test Setup updated/);
      await page.waitForFunction(() => /edited/.test(document.getElementById('ghp-view').textContent) && document.querySelector('[data-action="repin-setup"]'));
      const repin = await page.$('[data-action="repin-setup"]'); await repin.click(); await repin.click(); await toastSays(page, /Baseline re-pinned/);
      await page.waitForSelector('[data-action="delete-setup"]');
      const del = await page.$('[data-action="delete-setup"]'); await del.click(); await del.click(); await toastSays(page, /Test Setup deleted/);
      await page.waitForFunction(() => document.querySelectorAll('.ghp-build').length === 1);
    });
    await step('A4. Free garage is full: 1 of 1, no add button, upgrade message', async () => {
      await page.click('[data-go="garage"]'); await page.waitForSelector('.ghp-meter');
      const t = await page.textContent('#ghp-view');
      assert(/1 of 1 vehicle/.test(t) && /Free includes 1 vehicle/.test(t), 'full message');
      assert(!(await page.$('[data-edit-machine="new"]')), 'add button still shown');
      await shot(page, 'a4-full');
    });
    await step('A5. Saved and Lab show Premium teasers for Free; no create/save button anywhere', async () => {
      await page.click('#ghp-nav [data-go="saved"]'); await page.waitForSelector('.ghp-teaser');
      await page.click('#ghp-nav [data-go="lab"]'); await page.waitForSelector('.ghp-teaser');
      assert(!(await page.$('[data-action="save-sheet"]:visible')), 'save visible');
    });
    await step('A6. Premium (development grant): second vehicle allowed, plan card from the entitlement, saved calculations read / edit / pin', async () => {
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
      await shot(page, 'a6-saved');
    });
    await step('A7. Engineering Lab: open an analyzer and save an analysis linked to a vehicle', async () => {
      await page.click('#ghp-nav [data-go="lab"]'); await page.waitForSelector('[data-analyzer="e12_radiator_heat_rejection"]');
      await page.click('[data-analyzer="e12_radiator_heat_rejection"]');
      await page.waitForSelector('#ghp-runbar [data-action="save-sheet"]', { state: 'visible' });
      await page.waitForFunction(() => GHP.engineering.currentAnalyzer() === 'e12_radiator_heat_rejection', null, { timeout: 20000 });
      await page.click('#ghp-runbar [data-action="save-sheet"]'); await page.waitForSelector('form[data-form="analysis"]');
      await page.fill('form[data-form="analysis"] input[name="title"]', 'Radiator baseline');
      const opts = await page.$$eval('form[data-form="analysis"] select[name="machine_id"] option', o => o.map(x => x.value).filter(Boolean));
      await page.selectOption('form[data-form="analysis"] select[name="machine_id"]', opts[0]);
      await page.click('form[data-form="analysis"] button[type="submit"]'); await toastSays(page, /Analysis saved/);
      const saved = await page.evaluate(async () => (await GHP.services.repos.analyses.list()).map(a => [a.title, a.analyzer_version, a.result_trust]));
      assert(JSON.stringify(saved) === JSON.stringify([['Radiator baseline', 'E1-AUTO', 'client_reported']]), 'stored: ' + JSON.stringify(saved));
      await shot(page, 'a7-lab');
    });
    await step('A8. no uncaught page errors in development mode', async () => { assert(errs.length === 0, errs.join(' | ')); });
    await ctx.close();
  }

  /* ---------------------------------------------------------------- B. no-backend */
  {
    const ctx = await browser.newContext(), page = await ctx.newPage(), errs = errorsOf(page);
    await step('B1. ?gh_dev=0 (no bootstrap client): no-backend mode; garage explains accounts are coming; calculators remain', async () => {
      await page.goto(`http://localhost:${port}/?gh_dev=0&view=garage`); await ready(page);
      assert(await page.evaluate(() => GHP.services.mode) === 'no-backend', 'mode');
      await page.waitForSelector('text=Accounts are coming soon');
      await page.click('#ghp-nav [data-go="calculators"]');
      assert(await page.evaluate(() => document.body.classList.contains('ghp-mode-calculators')), 'calculators mode');
      assert(errs.length === 0, errs.join(' | '));
    });
    await ctx.close();
  }

  /* ---------------------------------------------------------------- C. foundation adapter behind a fake bootstrap client */
  async function withInjected(clientJs, check) {
    const ctx = await browser.newContext(), page = await ctx.newPage(), errs = errorsOf(page);
    await page.route(u => new URL(u).pathname === '/' || new URL(u).pathname === '/index.html', async route => {
      const r = await route.fetch(); let html = await r.text();
      html = html.replace('<script src="premium/services.js', `<script>${clientJs}</script><script src="premium/adapters/foundation.js"></script><script src="premium/services.js`);
      await route.fulfill({ response: r, body: html });
    });
    await page.goto(`http://localhost:${port}/?gh_dev=0&view=garage`); await ready(page);
    await check(page);
    assert(errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  const fakeJs = errorCode => `(function(){const res=${errorCode ? `{data:null,error:{code:'${errorCode}',message:'relation does not exist'},status:404}` : `{data:[],error:{code:'42501',message:'permission denied for table plans'},status:401}`};
    const b={select(){return b},eq(){return b},order(){return b},limit(){return b},maybeSingle(){return b},single(){return b},then(f,r){return Promise.resolve(res).then(f,r)}};
    window.GH_SUPABASE={from(){return b},rpc(){return Promise.resolve(res)},auth:{getSession:async()=>({data:{session:null},error:null}),signInWithOtp:async()=>({error:null}),signOut:async()=>({error:null}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}}}};})();`;
  await step('C1. foundation adapter + unprovisioned schema (PGRST205) -> no-backend, no errors', () => withInjected(fakeJs('PGRST205'), async page => {
    assert(await page.evaluate(() => GHP.services.mode) === 'no-backend', 'mode');
    await page.waitForSelector('text=Accounts are coming soon');
  }));
  await step('C2. foundation adapter + provisioned schema, signed out -> production mode with the magic-link sign-in', () => withInjected(fakeJs(null), async page => {
    assert(await page.evaluate(() => GHP.services.mode) === 'production', 'mode');
    await page.waitForSelector('text=Email me a sign-in link');
    await page.fill('form[data-form="signin"] input[name="email"]', 'driver@example.test');
    await page.click('form[data-form="signin"] button[type="submit"]'); await toastSays(page, /Check your email/);
  }));

  await browser.close(); srv.close();
  const failed = results.filter(r => !r.pass);
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '\n      -> ' + r.error}`);
  console.log(`\nbrowser smoke (Chromium ${browser.version ? '' : ''}headless): ${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('SMOKE ERROR', e); process.exit(2); });
