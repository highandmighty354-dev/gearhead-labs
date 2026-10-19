#!/usr/bin/env node
/* Gearhead Labs — the Premium offer on the Profile page (Stage 2, Task 2: Premium Profile content).

   WHAT CHANGED. Before this change a signed-out visitor who opened Profile (the destination of the locked calculators' Premium link)
   saw only an email sign-in form: no price, no description of Premium, nothing saying it cannot be bought yet. Profile now shows a
   Premium offer card before the sign-in form (and after the Plan card for a signed-in account without Premium): both prices, what
   Premium adds with the current counts, "Free stays free", and an unambiguous "Online checkout is not open yet". The locked
   calculators' link now says "See Premium →" (it opened Profile already; nothing can be bought) and their card states that checkout
   is not open.

   INDEPENDENT EXPECTATIONS (read by this test from sources other than the page code that renders them):
     - prices: the approved offers seeded by supabase/migrations/0407_premium_product_model.sql (unit_amount in cents, per interval);
     - Premium calculator, Engineering Lab and Free calculator counts: catalog/gearhead-catalog.json (counts), and the Premium count is also
       checked against the number of calculators the engine's own menu tags PREMIUM.

   WHAT THIS TEST DOES (real Chromium; the repository served over http on localhost; the integrated index.html; no network: the pinned
   supabase-js library is answered with the npm-registry bytes (integrity-checked, as in browser-smoke.js) and the Supabase project with what a
   provisioned, signed-out PostgREST returns (401 / 42501); any non-GET request to Supabase fails the test, so no sign-in is ever sent).
   Clicks are real mouse clicks; Back / Forward are the browser's own.
     P. Production, signed-out visitor (?gh_dev=0), at 1280 x 900 and 375 x 812:
        - from a locked Premium calculator (DC Fast-Charge Time, reached through search) the card says "See Premium →" and "Online checkout is
          not open yet", and no calculator boxes are shown;
        - "See Premium" opens Profile in the top-level page (one navigation bar, nothing nested), where the offer card comes BEFORE the
          sign-in card; the offer shows exactly the two migration prices ("$5.99 per month", "$59.99 per year"), the catalogue's Premium
          calculator count, Engineering Lab count and Free count, and a visible checkout-not-open status;
        - nothing on the page offers a purchase, payment, trial or subscription: no button or link whose text says so;
        - the offer does not list saved calculations (saving from a calculator is not available yet);
        - the sign-in form is the existing one ("Email me a sign-in link"), with the note that signing in does not buy or unlock Premium;
        - the offer's buttons open the Engineering Lab preview and the calculators; Back / Forward between the calculator and Profile work;
        - search ("fast charge") and a Free calculator (HP from Torque: 600 lb-ft at 4000 rpm -> 457 HP) still work afterwards;
        - the offer card and page fit the viewport (no horizontal overflow); no page errors; no non-GET Supabase request.
     D. Development mode, signed in (local stand-in, localhost only): a Free account sees the offer card after its Plan card; after the
        development Premium grant the offer card is gone.
     N. Supabase unreachable (no-backend): Profile shows the offer card and the existing "Accounts are unavailable" card.
     C. Saved-calculation copy (GH-IMP-021 follow-up). While the page's own data service reports that saving a calculation is not available
        (GHP.services.repos.savedCalculations.createUnavailableReason is set), no rendered text block may present saved calculations as a
        working feature: every paragraph, list item, lede or tile whose sentences pair "calculation(s)" with save / saved / saving / keep /
        kept / store / pin must, in the same block, say it is not available yet. Scanned views: Home, My Garage, Saved, Engineering Lab and
        Profile for the signed-out production visitor (both viewports) and the development Free account, and Home, My Garage, Saved and
        Engineering Lab after the development Premium grant. The Home Saved tile and the Saved preview must be found and pass (so the scan is
        known to have read real copy).
   MUTANTS (each must make the test fail; SKIP_MUTANTS=1 skips them): premium/shell.js as on main before this change (no offer);
   premium-calculator-gating.js as on main (old link text, no checkout note); premium/models.js with the monthly price changed to 699 cents
   (the page must then disagree with the migration); premium/shell.js as on 205d0c2 (the offer, but Home / Garage / Saved copy still
   advertising saved calculations).

   Run: node premium/tests/premium-profile.test.js   (VERBOSE=1 prints passes; SMOKE_OUT=dir saves screenshots; GH_BASE=rev for the mutants)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os'), crypto = require('crypto'), { execSync, execFileSync } = require('child_process');
const REPO = process.env.GH_REPO ? path.resolve(process.env.GH_REPO) : path.resolve(__dirname, '..', '..');
const BASE = process.env.GH_BASE || '6f12a54';   // main before this change
const OUT = process.env.SMOKE_OUT || null;
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,HEAD,OPTIONS' };

/* ---------- independent expectations ---------- */
function expectedPrices() {
  const sql = fs.readFileSync(path.join(REPO, 'supabase', 'migrations', '0407_premium_product_model.sql'), 'utf8');
  const rows = [...sql.matchAll(/\('premium',\s*'(month|year)',\s*'usd',\s*(\d+),\s*true\)/g)].map(m => ({ interval: m[1], cents: Number(m[2]) }));
  if (rows.length !== 2) throw new Error('0407: expected two premium offers, found ' + rows.length);
  return rows.map(r => ({ text: '$' + (r.cents / 100).toFixed(2), per: 'per ' + r.interval }));
}
const CAT = JSON.parse(fs.readFileSync(path.join(REPO, 'catalog', 'gearhead-catalog.json'), 'utf8')).counts;
const EXPECT = { premiumCalcs: CAT.premium_by_kind.calculator, lab: CAT.engineering_lab_tools, free: CAT.free_public_calculators, prices: expectedPrices() };

function pinnedLibrary() {   // as in browser-smoke.js: the exact npm-registry bytes of the pinned supabase-js, integrity-checked
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
  const bytes = fs.readFileSync(path.join(dir, 'package', file));
  fs.rmSync(dir, { recursive: true, force: true });
  return { url, bytes };
}

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
const gitFile = (rev, rel) => execFileSync('git', ['-C', REPO, 'show', `${rev}:${rel}`], { maxBuffer: 64 * 1024 * 1024 });

let checks = 0, failures = 0, SAVE_SHOTS = true; const lines = [];
const check = (name, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${name}`); };
const NO_PURCHASE = /\b(buy|purchase|subscribe|subscription|checkout|pay|payment|start (a |your )?trial|free trial|upgrade now)\b/i;

/* what the Profile view shows */
const READ_PROFILE = () => {
  const v = document.getElementById('ghp-view'), offer = v.querySelector('[data-premium-offer]'), signin = v.querySelector('form[data-form="signin"]');
  const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(), s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const status = v.querySelector('[data-checkout-status]');
  const controls = [...v.querySelectorAll('button, a, input[type="submit"]')].filter(visible).map(b => (b.textContent || b.value || '').replace(/\s+/g, ' ').trim());
  const fr = document.getElementById('app'); let nested = null; try { nested = !!fr.contentDocument.getElementById('app'); } catch (e) { nested = 'n/a'; }
  return {
    search: location.search, view: window.GHP && GHP.shell ? GHP.shell.state().view : null, navTop: document.querySelectorAll('#ghp-nav').length, nested,
    offer: !!offer, offerVisible: visible(offer), offerText: offer ? offer.textContent.replace(/\s+/g, ' ').trim() : '',
    prices: offer ? [...offer.querySelectorAll('.ghp-offer-price')].map(p => [p.querySelector('b').textContent.trim(), p.querySelector('span').textContent.trim()]) : [],
    statusVisible: visible(status), statusText: status ? status.textContent.replace(/\s+/g, ' ').trim() : '',
    offerBeforeSignin: !!(offer && signin && (offer.compareDocumentPosition(signin) & Node.DOCUMENT_POSITION_FOLLOWING)),
    signin: !!signin, signinButton: signin ? signin.querySelector('button[type="submit"]').textContent.trim() : null,
    signinNote: (v.querySelector('[data-signin-note]') || {}).textContent || null,
    noBackendCard: /Accounts are unavailable/.test(v.textContent), planCard: [...v.querySelectorAll('h2')].some(h => h.textContent.trim() === 'Plan'),
    offerAfterPlan: (() => { const plan = [...v.querySelectorAll('h2')].find(h => h.textContent.trim() === 'Plan'); return !!(plan && offer && (plan.compareDocumentPosition(offer) & Node.DOCUMENT_POSITION_FOLLOWING)); })(),
    controls, overflow: document.documentElement.scrollWidth > innerWidth, offerFits: offer ? offer.getBoundingClientRect().right <= innerWidth + 0.5 && offer.getBoundingClientRect().left >= -0.5 : null
  };
};
/* saved-calculation copy: every rendered text block that talks about saving / keeping calculations must say it is not available yet */
const READ_SAVED_COPY = () => {
  const reason = (((window.GHP || {}).services || {}).repos || {}).savedCalculations ? GHP.services.repos.savedCalculations.createUnavailableReason || '' : '';
  const v = document.getElementById('ghp-view');
  const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const CALC = /\bcalculations?\b/i, VERB = /\b(save|saved|saves|saving|keep|keeps|kept|keeping|store|stored|storing|pin|pinned)\b/i;
  const AVAIL = /\b(isn[’']t|is not|are not|aren[’']t|not) (yet )?available( yet)?\b/i;
  const blocks = [...v.querySelectorAll('p, li, .ghp-lede, .ghp-tile')].filter(el => !(el.matches('p, li') && el.closest('.ghp-tile'))).filter(visible)
    .map(el => ({ tile: el.classList.contains('ghp-tile') ? el.getAttribute('data-go') : null, text: el.textContent.replace(/\s+/g, ' ').trim() }));
  const claims = blocks.filter(b => b.text.split(/(?<=[.!?])\s+/).some(sn => CALC.test(sn) && VERB.test(sn)));
  return { view: GHP.shell.state().view, reason, claims: claims.map(b => ({ text: b.text, ok: AVAIL.test(b.text) })), blocks: blocks.length,
    savedTile: (blocks.find(b => b.tile === 'saved') || {}).text || null };
};
async function savedCopy(page, views, label, c, need = {}) {
  const seen = [];
  for (const view of views) {
    await page.evaluate(v => GHP.shell.go(v), view);
    await page.waitForFunction(v => GHP.shell.state().view === v && document.getElementById('ghp-view').children.length > 0, view, { timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(600);
    seen.push(await page.evaluate(READ_SAVED_COPY));
  }
  const reason = seen.map(s => s.reason).find(Boolean) || '';
  const bad = seen.flatMap(s => s.claims.filter(x => !x.ok).map(x => `${s.view}: "${x.text}"`));
  const views_ = seen.map(s => `${s.view}(${s.blocks} blocks, ${s.claims.length} saved-calculation mentions)`).join(', ');
  c(`${label}: saving a calculation is reported unavailable by the data service`, /not available/i.test(reason), JSON.stringify(reason));
  c(`${label}: no rendered copy presents saved calculations as working (${views.join(', ')})`, reason ? bad.length === 0 && seen.every(s => s.blocks > 0) : true, bad.join(' | ') || views_);
  if (need.homeTile) { const t = (seen.find(s => s.view === 'home') || {}).savedTile; c(`${label}: Home Saved tile found and says saving is not available yet`, !!t && /not available yet|isn’t available yet/i.test(t), JSON.stringify(t)); }
  if (need.savedPreview) { const sv = seen.find(s => s.view === 'saved') || { claims: [] }; c(`${label}: Saved preview found and says saving is not available yet`, sv.claims.length > 0 && sv.claims.every(x => x.ok), JSON.stringify(sv.claims)); }
}
const frameOf = page => page.frames().find(f => f.url().includes(F124));

async function newPage(browser, lib, viewport, supabase, port) {
  const ctx = await browser.newContext({ viewport }), page = await ctx.newPage(); page.setDefaultTimeout(15000);
  const env = { ctx, page, pageErrors: [], violations: [] };
  page.on('pageerror', e => env.pageErrors.push(e.message));
  await page.route('**/*', async rt => {
    const u = rt.request().url();
    if (u === lib.url) return rt.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'text/javascript' }, CORS), body: lib.bytes });
    if (/\.supabase\.co$/.test(new URL(u).hostname)) {
      const m = rt.request().method();
      if (m === 'OPTIONS') return rt.fulfill({ status: 204, headers: CORS });
      if (m !== 'GET' && m !== 'HEAD') { env.violations.push(m + ' ' + u); return rt.abort(); }
      if (supabase === 'offline') return rt.abort();
      return rt.fulfill({ status: 401, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: JSON.stringify({ code: '42501', details: null, hint: null, message: 'permission denied for table plans' }) });
    }
    if (u.startsWith(`http://localhost:${port}/`)) return rt.continue();
    return rt.abort();
  });
  return env;
}
const ready = page => page.waitForFunction(() => document.body.classList.contains('ghp-ready'), null, { timeout: 20000 });

async function production(browser, lib, port, label, viewport, c) {
  const env = await newPage(browser, lib, viewport, 'provisioned', port), page = env.page, base = `http://localhost:${port}/`;
  const settle = () => page.waitForTimeout(700);
  const tryClick = async sel => { try { await page.click(sel, { timeout: 4000 }); return ''; } catch (e) { return e.message.split('\n')[0]; } };
  const openMenu = async fr => {
    const input = fr.locator('#search-input');
    for (let i = 0; i < 3 && !(await input.isVisible()); i++) {
      const b = fr.locator('[aria-label="Open navigation"]');
      if (await b.count() && await b.first().isVisible()) await b.first().click();
      try { await input.waitFor({ state: 'visible', timeout: 2000 }); } catch (e) { /* retry */ }
    }
  };
  const search = async (fr, q) => { await openMenu(fr); await fr.locator('#search-input').click(); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace'); await page.keyboard.type(q); await page.waitForTimeout(200); };
  await page.goto(base + '?gh_dev=0'); await ready(page); await page.waitForTimeout(1500);
  const mode = await page.evaluate(() => GHP.services.mode);
  c('production mode, signed out', mode === 'production', mode);

  /* the locked calculator's card */
  let fr = frameOf(page);
  const premiumTagged = await fr.evaluate(() => { ghBuildNav(''); return document.querySelectorAll('#calc-nav .gh-premium-tag').length; });
  await search(fr, 'fast charge');
  await fr.locator('#calc-nav a.gh-nav-item[href="?calc=dc_fast_charge_time"]').click(); await settle();
  const card = await fr.evaluate(() => { const u = document.querySelector('.gh-premium-upsell'); return u ? { text: u.textContent.replace(/\s+/g, ' '), cta: (u.querySelector('a.gh-premium-cta') || {}).textContent, inputs: document.querySelectorAll('#calc-container .calc-body input').length } : null; });
  c('locked calculator: "See Premium →" link, checkout-not-open note, no calculator boxes', !!card && /^See Premium/.test((card.cta || '').trim()) && /Online checkout is not open yet/.test(card.text) && card.inputs === 0 && !NO_PURCHASE.test(card.cta || ''),
    JSON.stringify(card));

  /* See Premium -> Profile */
  await fr.locator('a.gh-premium-cta').click(); await settle();
  const p = await page.evaluate(READ_PROFILE);
  if (OUT && SAVE_SHOTS) await page.screenshot({ path: path.join(OUT, `profile-${label.replace(/\W+/g, '-')}.png`), fullPage: true });
  c('See Premium opens Profile in the top-level page (one navigation bar, nothing nested)', p.search === '?view=profile' && p.view === 'profile' && p.navTop === 1 && p.nested === false, JSON.stringify({ search: p.search, view: p.view, navTop: p.navTop, nested: p.nested }));
  c('the offer card is shown, before the sign-in card', p.offerVisible && p.signin && p.offerBeforeSignin, JSON.stringify({ offer: p.offerVisible, signin: p.signin, before: p.offerBeforeSignin }));
  const wantPrices = EXPECT.prices.map(x => [x.text, x.per]);
  c(`prices equal the migration's approved offers ${JSON.stringify(wantPrices)}`, JSON.stringify(p.prices) === JSON.stringify(wantPrices), JSON.stringify(p.prices));
  c(`Premium calculator count ${EXPECT.premiumCalcs} (catalogue) = PREMIUM-tagged calculators in the menu (${premiumTagged})`,
    new RegExp(`\\b${EXPECT.premiumCalcs} Premium calculators\\b`).test(p.offerText) && premiumTagged === EXPECT.premiumCalcs, `tagged ${premiumTagged}; ${p.offerText.slice(0, 400)}`);
  c(`Engineering Lab count ${EXPECT.lab} and Free count ${EXPECT.free} (catalogue)`, new RegExp(`\\b${EXPECT.lab} engineering tools\\b`).test(p.offerText) && new RegExp(`All ${EXPECT.free} free calculators`).test(p.offerText), p.offerText.slice(0, 600));
  c('checkout-not-open status visible and unambiguous', p.statusVisible && /^Online checkout is not open yet\./.test(p.statusText) && /can’t be bought/.test(p.statusText), p.statusText);
  const offending = p.controls.filter(t => NO_PURCHASE.test(t));
  c('no control offers a purchase, payment, trial or subscription', offending.length === 0, JSON.stringify(offending) + ' of ' + JSON.stringify(p.controls));
  c('the offer does not list saved calculations', !/saved calculations?/i.test(p.offerText), p.offerText);
  c('existing sign-in form, with the note that signing in does not buy or unlock Premium', p.signinButton === 'Email me a sign-in link' && /does not buy or unlock Premium/.test(p.signinNote || ''), JSON.stringify({ button: p.signinButton, note: p.signinNote }));
  c('layout: offer card within the viewport, no horizontal overflow', p.offerFits === true && !p.overflow, JSON.stringify({ fits: p.offerFits, overflow: p.overflow }));

  /* Back / Forward */
  await page.goBack({ waitUntil: 'commit', timeout: 5000 }).catch(() => null); await settle();
  const b = await page.evaluate(() => ({ view: GHP.shell.state().view, title: (document.getElementById('app').contentDocument.querySelector('#calc-container .calc-title') || {}).textContent }));
  await page.goForward({ waitUntil: 'commit', timeout: 5000 }).catch(() => null); await settle();
  const f = await page.evaluate(READ_PROFILE);
  c('Back returns to the calculator, Forward returns to the offer', b.view === 'calculators' && b.title === 'DC Fast-Charge Time' && f.view === 'profile' && f.offerVisible, JSON.stringify({ back: b, forward: [f.view, f.offerVisible] }));

  /* the offer's buttons open existing pages */
  const e1 = await tryClick('[data-premium-offer] [data-go="lab"]'); await settle();
  const lab = await page.evaluate(() => ({ view: GHP.shell.state().view, teaser: !!document.querySelector('#ghp-view .ghp-teaser'), text: document.getElementById('ghp-view').textContent }));
  c('"Preview the Engineering Lab" opens the Lab preview, which links back to the offer', !e1 && lab.view === 'lab' && lab.teaser && /See what Premium includes/.test(lab.text) && /Online checkout is not open yet/.test(lab.text), JSON.stringify({ view: lab.view, teaser: lab.teaser }));
  const e2 = await tryClick('#ghp-view [data-go="profile"]'); await settle();
  c('"See what Premium includes" returns to the offer', !e2 && await page.evaluate(() => GHP.shell.state().view === 'profile' && !!document.querySelector('[data-premium-offer]')), e2 || 'not on the offer');
  const e3 = await tryClick('[data-premium-offer] [data-go="calculators"]'); await settle();
  if (e3) await page.click('#ghp-nav [data-go="calculators"]').catch(() => null);
  c('"Open the calculators" shows the calculators', !e3 && await page.evaluate(() => GHP.shell.state().view === 'calculators' && document.body.classList.contains('ghp-mode-calculators')), e3 || 'not on calculators');

  /* search and a Free calculator still work */
  fr = frameOf(page);
  await search(fr, 'hp torque');
  const ids = await fr.evaluate(() => [...document.querySelectorAll('#calc-nav a.gh-nav-item')].map(a => a.getAttribute('href')));
  await fr.locator('#calc-nav a.gh-nav-item[href="?calc=hp_from_torque"]').click(); await settle();
  await fr.locator('#torq').click({ clickCount: 3 }); await page.keyboard.type('600'); await page.waitForTimeout(400);
  const result = await fr.evaluate(() => (document.querySelector('#calc-container .result-value') || {}).textContent || '');
  c('search and a Free calculator still work (600 lb-ft x 4000 rpm -> 457 HP; 600 x 4000 / 5252 = 456.97)', JSON.stringify(ids) === JSON.stringify(['?calc=hp_from_torque', '?calc=torque_from_hp']) && /^457\s*HP$/.test(result.trim()), JSON.stringify({ ids, result }));

  await savedCopy(page, ['home', 'garage', 'saved', 'lab', 'profile'], 'signed-out copy', c, { homeTile: true });

  c('no page errors', env.pageErrors.length === 0, env.pageErrors.join(' | '));
  c('no non-GET request to Supabase', env.violations.length === 0, env.violations.join(' | '));
  await env.ctx.close();
}

async function development(browser, lib, port, c) {
  const env = await newPage(browser, lib, { width: 1280, height: 900 }, 'offline', port), page = env.page;
  await page.goto(`http://localhost:${port}/?view=profile`); await ready(page);
  await page.fill('form[data-form="signin"] input[name="email"]', 'profile@example.test');
  await page.click('form[data-form="signin"] button[type="submit"]');
  await page.waitForFunction(() => /Plan/.test(document.getElementById('ghp-view').textContent) && !document.querySelector('form[data-form="signin"]'));
  const free = await page.evaluate(READ_PROFILE);
  c('development, signed-in Free account: offer card after the Plan card', free.offerVisible && free.planCard && free.offerAfterPlan, JSON.stringify({ offer: free.offerVisible, plan: free.planCard, after: free.offerAfterPlan }));
  await savedCopy(page, ['home', 'garage', 'saved', 'lab', 'profile'], 'development Free copy', c, { homeTile: true, savedPreview: true });
  await page.evaluate(() => GHP.shell.go('profile')); await page.waitForSelector('[data-action="dev-plan"][data-plan="premium"]');
  await page.click('[data-action="dev-plan"][data-plan="premium"]');
  await page.waitForFunction(() => /Granted by Gearhead Labs/.test(document.getElementById('ghp-view').textContent));
  const prem = await page.evaluate(READ_PROFILE);
  c('development, Premium grant: no offer card', !prem.offer && prem.planCard, JSON.stringify({ offer: prem.offer, plan: prem.planCard }));
  await savedCopy(page, ['home', 'garage', 'saved', 'lab'], 'development Premium copy', c, { homeTile: true });
  c('development: no page errors', env.pageErrors.length === 0, env.pageErrors.join(' | '));
  await env.ctx.close();
}

async function noBackend(browser, lib, port, c) {
  const env = await newPage(browser, lib, { width: 375, height: 812 }, 'offline', port), page = env.page;
  await page.goto(`http://localhost:${port}/?gh_dev=0&view=profile`); await ready(page); await page.waitForTimeout(1500);
  const n = await page.evaluate(READ_PROFILE);
  c('Supabase unreachable: offer card and the existing "Accounts are unavailable" card', n.offerVisible && n.noBackendCard && !n.signin && !n.overflow, JSON.stringify({ offer: n.offerVisible, noBackend: n.noBackendCard, signin: n.signin, overflow: n.overflow }));
  c('no-backend: no page errors', env.pageErrors.length === 0, env.pageErrors.join(' | '));
  await env.ctx.close();
}

async function all(browser, lib, overrides, quiet) {
  const failed = []; SAVE_SHOTS = !quiet;
  const srv = await serve(overrides), port = srv.address().port;
  const mk = label => (name, ok, detail) => { if (quiet) { if (!ok) failed.push(name); return; } check(`${label} / ${name}`, ok, detail); };
  await production(browser, lib, port, 'production desktop 1280 x 900', { width: 1280, height: 900 }, mk('production desktop 1280 x 900'));
  await production(browser, lib, port, 'production phone 375 x 812', { width: 375, height: 812 }, mk('production phone 375 x 812'));
  await development(browser, lib, port, mk('development'));
  await noBackend(browser, lib, port, mk('no-backend phone'));
  srv.close();
  return failed;
}

(async () => {
  const lib = pinnedLibrary();
  const browser = await playwright.chromium.launch(Object.assign({ args: [] }, CHROMIUM ? { executablePath: CHROMIUM } : {}));
  await all(browser, lib, {}, false);
  if (!process.env.SKIP_MUTANTS) {
    const models = fs.readFileSync(path.join(REPO, 'premium', 'models.js'), 'utf8');
    const PRICE = "{ interval: 'month', currency: 'usd', amount: 599, label: '$5.99/month' }";
    if (!models.includes(PRICE)) throw new Error('price mutant cannot be built');
    const MUTANTS = [
      [`premium/shell.js as on ${BASE} (no offer)`, { 'premium/shell.js': gitFile(BASE, 'premium/shell.js') }],
      [`premium-calculator-gating.js as on ${BASE} (old link, no checkout note)`, { 'premium-calculator-gating.js': gitFile(BASE, 'premium-calculator-gating.js') }],
      ['premium/shell.js as on 205d0c2 (saved calculations still advertised)', { 'premium/shell.js': gitFile('205d0c2', 'premium/shell.js') }],
      ['premium/models.js monthly price 699 cents', { 'premium/models.js': Buffer.from(models.replace(PRICE, "{ interval: 'month', currency: 'usd', amount: 699, label: '$6.99/month' }")) }]
    ];
    for (const [label, overrides] of MUTANTS) {
      let failed;
      try { failed = await all(browser, lib, overrides, true); } catch (e) { failed = ['threw: ' + e.message.split('\n')[0]]; }
      check(`mutant detected: ${label}`, failed.length > 0, 'the test passed against the mutant');
      if (process.env.VERBOSE && failed.length) lines.push(`       (${failed.length} checks failed, e.g. ${failed.slice(0, 3).join('; ')})`);
    }
  }
  await browser.close();
  lines.forEach(l => console.log(l));
  console.log(`premium profile: ${checks - failures}/${checks} passed${failures ? `, ${failures} FAILED` : ''}`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
