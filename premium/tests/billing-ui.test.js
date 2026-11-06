#!/usr/bin/env node
/* Gearhead Labs — Premium billing UI (Stripe Checkout / 14-day trial), real Chromium, no network, no Stripe.

   WHAT IS TESTED. premium/config.js has billing.enabled = false, and the site must then look and behave exactly as before
   (premium-profile.test.js and upgrade-navigation.test.js still cover that state in full). With billing enabled (this test serves
   a config override; the repository file is unchanged), using the development adapter on localhost (its checkout is a local
   stand-in that starts the 14-day trial grant; no redirect, no payment):
     OFF  signed-out Profile: "Online checkout is not open yet", no trial/checkout control; the services layer refuses checkout and
          portal; a locked Premium calculator still says "See Premium →".
     ON   signed-out Profile: the offer says 14-day free trial, card required, no charge until the trial ends; its only action is
          "Sign in to start your free trial", which focuses the existing sign-in form; a locked Premium calculator says
          "Start free trial →" (still linking to the Profile offer).
     ON   signed-in Free account: one trial button per approved offer, labelled with the price from premium/models.js (which the
          profile test checks against migration 0407); clicking the monthly one starts the trial: the plan becomes Premium (source
          Trial, access for 14 days) and the offer disappears.
     ON   return from Stripe Checkout: ?checkout=cancelled says nothing was charged; ?checkout=success shows the welcome notice for a
          Premium account and the "setting up" notice for a Free one.
     ON   production adapter with no backend (Supabase unreachable): no checkout control (billing needs a backend).
   No page errors in any scenario.
   Run: node premium/tests/billing-ui.test.js   (VERBOSE=1 prints passes). Exit 0 = all passed. */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os'), crypto = require('crypto'), { execSync, execFileSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,HEAD,OPTIONS' };

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
function pinnedLibrary() {   // as in premium-profile.test.js: the exact npm-registry bytes of the pinned supabase-js, integrity-checked
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const tag = html.match(/<script src="(https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@(\d+\.\d+\.\d+)\/(dist\/umd\/supabase\.js))" integrity="(sha384-[^"]+)" crossorigin="anonymous"><\/script>/);
  if (!tag) throw new Error('index.html: pinned supabase-js tag not found');
  const [, url, version, file] = tag;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghp-sbjs-'));
  execFileSync('npm', ['pack', `@supabase/supabase-js@${version}`, '--pack-destination', dir, '--silent'], { stdio: 'pipe' });
  const tgz = fs.readdirSync(dir).find(f => f.endsWith('.tgz'));
  const published = execFileSync('npm', ['view', `@supabase/supabase-js@${version}`, 'dist.integrity'], { encoding: 'utf8' }).trim();
  const actual = 'sha512-' + crypto.createHash('sha512').update(fs.readFileSync(path.join(dir, tgz))).digest('base64');
  if (actual !== published) throw new Error(`tarball integrity mismatch: ${actual} vs ${published}`);
  execFileSync('tar', ['xzf', path.join(dir, tgz), '-C', dir]);
  const bytes = fs.readFileSync(path.join(dir, 'package', file)); fs.rmSync(dir, { recursive: true, force: true });
  return { url, bytes };
}

let checks = 0, failures = 0; const lines = [];
const check = (name, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${name}`); };
const ready = page => page.waitForFunction(() => document.body.classList.contains('ghp-ready'), null, { timeout: 20000 });

async function newPage(browser, lib, port) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), page = await ctx.newPage(); page.setDefaultTimeout(15000);
  const env = { ctx, page, errors: [] };
  page.on('pageerror', e => env.errors.push(e.message));
  await page.route('**/*', async rt => {
    const u = rt.request().url();
    if (u === lib.url) return rt.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'text/javascript' }, CORS), body: lib.bytes });
    if (u.startsWith(`http://localhost:${port}/`)) return rt.continue();
    return rt.abort();                               // no network: Supabase, Stripe and everything else unreachable
  });
  return env;
}
const READ = () => {
  const v = document.getElementById('ghp-view'), st = v.querySelector('[data-checkout-status]');
  return { status: st ? st.textContent.replace(/\s+/g, ' ').trim() : null, billingAttr: st ? st.getAttribute('data-billing') : null,
    checkout: [...v.querySelectorAll('[data-action="checkout"]')].map(b => ({ text: b.textContent.trim(), interval: b.dataset.interval })),
    signinFocus: [...v.querySelectorAll('[data-action="signin-focus"]')].map(b => b.textContent.trim()), portal: !!v.querySelector('[data-action="portal"]'),
    offer: !!v.querySelector('[data-premium-offer]'), notice: (v.querySelector('[data-checkout-notice]') || {}).getAttribute ? v.querySelector('[data-checkout-notice]').getAttribute('data-checkout-notice') : null,
    text: v.textContent.replace(/\s+/g, ' ') };
};
async function lockedCta(page, port) {
  const id = await page.evaluate(() => [...GHP.models.PREMIUM_CALC_IDS.values()][0]);
  await page.goto(`http://localhost:${port}/?calc=${encodeURIComponent(id)}`); await ready(page);
  for (let i = 0; i < 40; i++) {
    for (const f of page.frames()) { try { const t = await f.evaluate(() => { const a = document.querySelector('.gh-premium-cta'); return a ? a.textContent.trim() : null; }); if (t) return { id, t }; } catch (e) { /* frame not ready */ } }
    await page.waitForTimeout(250);
  }
  return { id, t: null };
}

(async () => {
  const lib = pinnedLibrary();
  const browser = await playwright.chromium.launch(Object.assign({ args: [] }, CHROMIUM ? { executablePath: CHROMIUM } : {}));
  const cfg = fs.readFileSync(path.join(REPO, 'premium', 'config.js'), 'utf8');
  check('repository config ships with billing disabled', /billing:\s*{\s*enabled:\s*false\s*}/.test(cfg), 'premium/config.js');
  const ON = cfg.replace(/billing:\s*{\s*enabled:\s*false\s*}/, 'billing: { enabled: true }');
  const offOn = { off: await serve(), on: await serve({ 'premium/config.js': ON }) };
  const PRICES = await (async () => { const env = await newPage(browser, lib, offOn.off.address().port); await env.page.goto(`http://localhost:${offOn.off.address().port}/?view=profile`); await ready(env.page);
    const o = await env.page.evaluate(() => GHP.models.PREMIUM_OFFERS.map(x => ({ interval: x.interval, label: x.label }))); await env.ctx.close(); return o; })();

  /* ---------------- OFF */
  { const port = offOn.off.address().port, env = await newPage(browser, lib, port), page = env.page;
    await page.goto(`http://localhost:${port}/?view=profile`); await ready(page);
    const r = await page.evaluate(READ);
    check('OFF, signed out: "Online checkout is not open yet", no trial or checkout control', /Online checkout is not open yet/.test(r.status || '') && r.billingAttr === null && !r.checkout.length && !r.signinFocus.length && !/free trial/i.test(r.text), JSON.stringify(r).slice(0, 400));
    const refused = await page.evaluate(async () => { const B = GHP.services.repos.billing; const out = { enabled: B.enabled() };
      try { await GHP.services.auth.signIn({ email: 'off@example.test' }); } catch (e) { out.signin = e.message; }
      for (const k of ['checkout', 'portal']) { try { await B[k]('month'); out[k] = 'resolved'; } catch (e) { out[k] = e.message; } } return out; });
    check('OFF: the services layer reports billing disabled and refuses checkout and portal', refused.enabled === false && refused.checkout === 'Online checkout is not open yet.' && refused.portal === 'Online checkout is not open yet.', JSON.stringify(refused));
    const cta = await lockedCta(page, port);
    check('OFF: a locked Premium calculator still says "See Premium →"', cta.t === 'See Premium →', JSON.stringify(cta));
    check('OFF: no page errors', env.errors.length === 0, env.errors.join(' | '));
    await env.ctx.close(); }

  /* ---------------- ON */
  { const port = offOn.on.address().port, env = await newPage(browser, lib, port), page = env.page;
    await page.goto(`http://localhost:${port}/?view=profile`); await ready(page);
    let r = await page.evaluate(READ);
    check('ON, signed out: the offer explains the 14-day trial, the card requirement and no charge until it ends',
      r.billingAttr === 'on' && /14-day free trial/.test(r.status) && /payment card is required/i.test(r.status) && /won’t be charged until the trial ends/.test(r.status) && !/not open yet/.test(r.status), r.status);
    check('ON, signed out: the only billing action is "Sign in to start your free trial" (no checkout button)', r.signinFocus.length === 1 && r.signinFocus[0] === 'Sign in to start your free trial' && !r.checkout.length, JSON.stringify(r));
    await page.click('[data-action="signin-focus"]');
    check('ON, signed out: that button focuses the existing sign-in form', await page.evaluate(() => document.activeElement && document.activeElement.matches('form[data-form="signin"] input[name="email"]')), 'focus');
    const cta = await lockedCta(page, port);
    check('ON: a locked Premium calculator says "Start free trial →"', cta.t === 'Start free trial →', JSON.stringify(cta));

    await page.goto(`http://localhost:${port}/?view=profile`); await ready(page);
    await page.fill('form[data-form="signin"] input[name="email"]', 'trial@example.test');
    await page.click('form[data-form="signin"] button[type="submit"]');
    await page.waitForSelector('[data-action="checkout"]');
    r = await page.evaluate(READ);
    check('ON, signed-in Free account: one trial button per approved offer, labelled with its price',
      r.checkout.length === PRICES.length && PRICES.every((o, i) => r.checkout[i].interval === o.interval && r.checkout[i].text === `Start free trial · ${o.label} after`), JSON.stringify({ got: r.checkout, PRICES }));
    check('ON, Free account with no billing record: no Manage billing button', !r.portal, JSON.stringify(r));
    await page.click('[data-action="checkout"][data-interval="month"]');
    await page.waitForFunction(() => !document.querySelector('[data-premium-offer]') && /Trial/.test(document.getElementById('ghp-view').textContent));
    const ent = await page.evaluate(() => GHP.services.entitlements.state);
    const days = (Date.parse(ent.endsAt) - Date.now()) / 864e5;
    check('ON: the monthly trial button starts the 14-day trial (development stand-in): Premium, source trial, ~14 days, offer gone',
      ent.isPremium && ent.source === 'trial' && days > 13.9 && days <= 14.01 && !(await page.evaluate(READ)).offer, JSON.stringify(ent));

    await page.goto(`http://localhost:${port}/?view=profile&checkout=success`); await ready(page); await page.waitForSelector('[data-checkout-notice]');
    check('ON: return from Checkout (success) as Premium: welcome notice', (await page.evaluate(READ)).notice === 'success', 'notice');
    await page.goto(`http://localhost:${port}/?view=profile&checkout=cancelled`); await ready(page); await page.waitForSelector('[data-checkout-notice]');
    r = await page.evaluate(READ);
    check('ON: return from Checkout (cancelled): says nothing was charged', r.notice === 'cancelled' && /Nothing was charged/.test(r.text), r.text.slice(0, 200));
    await page.evaluate(() => GHP.services.dev.setPlan('free'));
    await page.goto(`http://localhost:${port}/?view=profile&checkout=success`); await ready(page); await page.waitForSelector('[data-checkout-notice]');
    check('ON: return from Checkout (success) before access arrives: "setting up" notice, no grant claimed', (await page.evaluate(READ)).notice === 'pending', 'notice');
    check('ON: no page errors', env.errors.length === 0, env.errors.join(' | '));
    await env.ctx.close(); }

  /* ---------------- ON, production adapter without a backend */
  { const port = offOn.on.address().port, env = await newPage(browser, lib, port), page = env.page;
    await page.goto(`http://localhost:${port}/?gh_dev=0&view=profile`); await ready(page); await page.waitForTimeout(1500);
    const r = await page.evaluate(READ), en = await page.evaluate(() => [GHP.services.mode, GHP.services.repos.billing.enabled()]);
    check('ON, no backend reachable: billing reported unavailable and no trial or checkout control is offered', en[1] === false && !r.checkout.length && !r.signinFocus.length, JSON.stringify({ en, r: r.status }));
    check('ON, no backend: no page errors', env.errors.length === 0, env.errors.join(' | '));
    await env.ctx.close(); }

  await browser.close(); offOn.off.close(); offOn.on.close();
  console.log(lines.join('\n'));
  console.log(`billing UI: ${checks - failures}/${checks} passed`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
