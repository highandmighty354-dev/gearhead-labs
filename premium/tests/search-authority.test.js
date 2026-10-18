#!/usr/bin/env node
/* Gearhead Labs — one authoritative calculator search (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-038).

   THE DEFECT. Three search implementations existed:
     1. the engine's own ghBuildNav (the search box's oninput -> filterCalcs -> buildNav = ghBuildNav), which works;
     2. final-ui-fix.js (loaded by index.html), which took the search box away from ghBuildNav (capture-phase input listener with
        stopImmediatePropagation, oninput = null) and searched window.CALCS, which is always undefined because the engine declares CALCS with
        const. When the script ran AFTER the calculator frame had loaded, every query answered "No calculators found" while the full catalogue stayed
        on screen below it; when it ran before, it installed itself into the frame's initial blank document instead and did nothing. A race;
     3. navigation-ux.js (injected by app-shell.js), which never installed (it looked for #app inside its own frame) and polled every 100 ms forever.
   And ghBuildNav matched the whole query as one string against name or category only, so "fast charge" missed "DC Fast-Charge Time", multi-word
   queries such as "hp torque" missed "HP from Torque", and an id such as dc_fast_charge_time found nothing.

   WHAT THIS TEST DOES (real Chromium; the repository served over http; the integrated index.html with the real shell scripts and the real engine
   in its frame; every request that is not to the local server is refused, so no network and no Supabase). Queries are typed with the keyboard
   into the real search box; nothing is called that a person would not do.
   Four loads: desktop in the natural script order; desktop with final-ui-fix.js answered 2.5 s late (the order that broke search); a phone viewport
   in the natural order (the menu opened with its own button); desktop with premium-calculator-gating.js answered 2.5 s late, so the shell's own menu
   rebuilds (app-shell ready(), the Premium gate's apply(), both with an empty query) land after the visitor has typed: the engine's route that follows
   them rebuilds with the box's text, and this load guards that the typed search is still what is on screen. For each load:
     - exactly one search implementation: no final-ui-fix or navigation-ux result host or API, navigation-ux.js not injected;
     - exact name, partial, multi-word, hyphen / space / no-space, case variation and calculator id queries find the expected calculator;
     - every result is justified by an independent re-derivation of the matching rule, and nothing the original rule matched is lost
       (the original rule's results are computed here from the catalogue the page shows);
     - the "N RESULTS" header equals the number of results listed;
     - a no-result query shows 0 RESULTS and the "No calculators match" message, with no calculator links;
     - a successful search, then a failed one, then the first one again: no stale results, the same list both times;
     - clearing the box restores the full catalogue: the per-lab counts add up to every calculator in CALCS;
     - Premium badges: in the results for "piston" exactly the Premium calculators carry the PREMIUM tag;
     - a query typed before the shell has settled is still the one on screen afterwards (no reset under a non-empty box);
     - clicking a result opens that calculator;
     - no page errors.
   MUTANTS (the test must FAIL on each, proving it can see the defect): the release's final-ui-fix.js with the late order; the release's engine
   (old matching rule); the release's app-shell.js (navigation-ux.js injection). Each is served from git (c9db895) in place of the working copy;
   SKIP_MUTANTS=1 skips them.

   Run: node premium/tests/search-authority.test.js   (VERBOSE=1 prints passes; GH_REPO=dir tests another checkout)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), { execSync, execFileSync } = require('child_process');
const REPO = process.env.GH_REPO ? path.resolve(process.env.GH_REPO) : path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
const RELEASE = 'c9db895';     // the release that shipped the defect; mutants are served from it
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

/* overrides: { 'file.js': Buffer } served instead of the working copy (mutants) */
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
const releaseFile = rel => execFileSync('git', ['-C', REPO, 'show', `${RELEASE}:${rel}`], { maxBuffer: 64 * 1024 * 1024 });

/* Independent re-derivation of the matching rule (written here, not read from the engine):
   old  = the query, lower-cased and trimmed, is a substring of the lower-cased name or category;
   words = every word of the query (letters and digits only) is a substring of name + category + id with all other characters made spaces;
   joined = the query's letters and digits, joined, are a substring of name + category + id with every other character removed. */
const lowerTrim = s => String(s).trim().toLowerCase();
const words = s => String(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const spaced = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ');
const oldRule = (c, q) => c.name.toLowerCase().includes(lowerTrim(q)) || c.cat.toLowerCase().includes(lowerTrim(q));
const newRule = (c, q) => {
  if (oldRule(c, q)) return true;
  const w = words(q); if (!w.length) return false;
  const hay = spaced(c.name + ' ' + c.cat + ' ' + c.id);
  return w.every(x => hay.includes(x)) || hay.replace(/ /g, '').includes(w.join(''));
};

/* the queries and the calculator each must find (ids checked against the catalogue the page shows) */
const MUST_FIND = [
  ['HP from Torque', 'hp_from_torque', 'exact name'],
  ['torq', 'hp_from_torque', 'partial word'],
  ['hp torque', 'hp_from_torque', 'multi-word, words not adjacent'],
  ['fast charge', 'dc_fast_charge_time', 'space where the name has a hyphen'],
  ['Fast-Charge', 'dc_fast_charge_time', 'hyphen as in the name'],
  ['FAST CHARGE', 'dc_fast_charge_time', 'upper case'],
  ['fAsT-cHaRgE', 'dc_fast_charge_time', 'mixed case with hyphen'],
  ['fastcharge', 'dc_fast_charge_time', 'no space'],
  ['dc_fast_charge_time', 'dc_fast_charge_time', 'calculator id'],
  ['charge', 'dc_fast_charge_time', 'single word (worked before the fix)'],
  ['  piston  ', 'piston_acceleration', 'surrounding spaces']
];
const NO_RESULT = 'zzqxv nonexistent';

let checks = 0, failures = 0; const lines = [];
const check = (name, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${name}`); };

/* what the menu shows: header, listed calculator ids, which of them carry the PREMIUM tag, the empty message, lab counts, foreign result hosts */
const READ_NAV = () => {
  const nav = document.getElementById('calc-nav');
  const items = [...nav.querySelectorAll('a.gh-nav-item')].map(a => ({ id: decodeURIComponent((a.getAttribute('href') || '').replace(/^\?calc=/, '')),
    premium: !!a.querySelector('.gh-premium-tag') }));
  const head = nav.querySelector('.gh-nav-search-title');
  const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return !el.hidden && s.display !== 'none' && s.visibility !== 'hidden' && (r.width > 0 || r.height > 0); };
  return { header: head ? head.textContent.trim() : null, items, empty: (nav.querySelector('.fav-empty') || {}).textContent || null,
    labCounts: [...nav.querySelectorAll('.gh-lab-head b')].map(b => Number(b.textContent)), home: !!nav.querySelector('.gh-nav-home'),
    foreignHosts: [...document.querySelectorAll('.gh-final-search-results,.gh-search-results')].filter(visible).map(e => e.className + ': ' + e.textContent.trim().slice(0, 60)),
    query: document.getElementById('search-input').value };
};

async function oneLoad(browser, port, label, { viewport = { width: 1280, height: 900 }, delay = {}, quiet = false } = {}) {
  const local = [];
  const c = (name, ok, detail) => { if (quiet) { if (!ok) local.push(name); return; } check(`${label} / ${name}`, ok, detail); if (!ok) local.push(name); };
  const ctx = await browser.newContext({ viewport }), page = await ctx.newPage(); page.setDefaultTimeout(15000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
  const injected = [];
  await page.route('**/*', async rt => {
    const u = rt.request().url();
    if (!u.startsWith(`http://127.0.0.1:${port}/`)) return rt.abort();
    const name = new URL(u).pathname.replace(/^\//, '');
    injected.push(name);
    if (delay[name]) await new Promise(r => setTimeout(r, delay[name]));
    return rt.continue();
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  const frameOf = () => page.frames().find(f => f.url().includes(F124));
  let fr; for (let i = 0; i < 100 && !(fr = frameOf()); i++) await page.waitForTimeout(100);
  await fr.waitForSelector('#search-input', { state: 'attached' });
  const input = fr.locator('#search-input');
  /* a phone shows the search box only once the menu is open: press the page's own "Open navigation" button, as a person would */
  const openMenu = async () => {
    for (let attempt = 0; attempt < 3 && !(await input.isVisible()); attempt++) {
      const b = fr.locator('[aria-label="Open navigation"]');
      if (await b.count() && await b.first().isVisible()) await b.first().click();
      try { await input.waitFor({ state: 'visible', timeout: 2000 }); } catch (e) { /* retry */ }
    }
  };
  const type = async q => { await openMenu(); await input.click(); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace'); if (q) await page.keyboard.type(q); await page.waitForTimeout(150); return fr.evaluate(READ_NAV); };

  /* 1. a query typed while the shell is still settling must survive app-shell's and the gate's menu rebuilds */
  const early = await type('charge');
  await page.waitForTimeout(Math.max(3500, ...Object.values(delay).map(d => d + 1500)));
  const settled = await fr.evaluate(READ_NAV);
  c('early query survives the shell settling', settled.query === 'charge' && settled.header && settled.items.length > 0 && settled.items.some(i => i.id === 'dc_fast_charge_time'),
    `typed "charge" before settle (header ${early.header}); after settle box="${settled.query}", header=${settled.header}, ${settled.items.length} items`);

  /* the catalogue the page shows (data, not the matching code) */
  const CALCS = await fr.evaluate(() => CALCS.filter(c => c.id !== 'dashboard').map(c => ({ id: c.id, name: String(c.name), cat: String(c.cat) })));
  const premiumIds = new Set(await page.evaluate(() => GHP.models.PREMIUM_CALC_IDS.values()));

  /* 2. one search implementation */
  const impl = await fr.evaluate(() => ({ finalApi: typeof window.__GH_FINAL_SEARCH, navApi: typeof window.__GH_NAV_UX,
    navInjected: !!document.querySelector('script[data-gh-inject="navigation-ux.js"]') }));
  c('one search implementation', impl.finalApi === 'undefined' && impl.navApi === 'undefined' && !impl.navInjected, JSON.stringify(impl));
  c('navigation-ux.js never requested', !injected.some(n => n.startsWith('navigation-ux.js')), injected.filter(n => /navigation-ux/.test(n)).join(','));

  /* 3. the query matrix */
  for (const [q, id, why] of MUST_FIND) {
    const r = await type(q);
    const ids = r.items.map(i => i.id);
    c(`"${q}" (${why}) finds ${id}`, ids.includes(id), `results: ${ids.slice(0, 12).join(', ')}${ids.length > 12 ? '…' : ''} | header ${r.header} | ${r.empty || ''}`);
    c(`"${q}" header counts the list`, r.header === `${ids.length} RESULT${ids.length === 1 ? '' : 'S'}`, `header ${r.header}, ${ids.length} listed`);
    c(`"${q}" no other search UI visible`, r.foreignHosts.length === 0, r.foreignHosts.join(' | '));
    const expected = CALCS.filter(cc => newRule(cc, q)).map(cc => cc.id);
    const lostOld = CALCS.filter(cc => oldRule(cc, q) && !ids.includes(cc.id)).map(cc => cc.id);
    c(`"${q}" results equal the independent rule`, JSON.stringify(ids) === JSON.stringify(expected),
      `extra: ${ids.filter(x => !expected.includes(x)).join(',') || '-'}; missing: ${expected.filter(x => !ids.includes(x)).join(',') || '-'}`);
    c(`"${q}" keeps every match of the original rule`, lostOld.length === 0, lostOld.join(','));
  }

  /* 4. no result, stale results, clear */
  const ok1 = await type('charge');
  const none = await type(NO_RESULT);
  c('no-result query: 0 RESULTS, message, no links', none.header === '0 RESULTS' && /No calculators match/.test(none.empty || '') && none.items.length === 0 && none.foreignHosts.length === 0,
    JSON.stringify({ header: none.header, empty: none.empty, items: none.items.length, hosts: none.foreignHosts }));
  const ok2 = await type('charge');
  c('success -> failure -> success: same list, nothing stale', ok1.items.length > 0 && JSON.stringify(ok1.items) === JSON.stringify(ok2.items),
    `${ok1.items.length} then ${ok2.items.length}`);
  const cleared = await type('');
  const sum = cleared.labCounts.reduce((a, b) => a + b, 0);
  c('clearing restores the full catalogue', cleared.header === null && cleared.home && sum === CALCS.length && cleared.foreignHosts.length === 0,
    `header ${cleared.header}, home ${cleared.home}, lab counts sum ${sum} vs ${CALCS.length} calculators`);

  /* 5. Premium badges in results */
  const pist = await type('piston');
  const wrongBadge = pist.items.filter(i => i.premium !== premiumIds.has(i.id)).map(i => `${i.id}:${i.premium}`);
  c('"piston": PREMIUM tag on exactly the Premium calculators', pist.items.some(i => i.premium) && pist.items.some(i => !i.premium) && wrongBadge.length === 0,
    `wrong: ${wrongBadge.join(',') || '-'}; ${pist.items.length} results`);

  /* 6. a result opens its calculator */
  await type('fast charge');
  let clickError = '';
  try { await fr.locator('#calc-nav a.gh-nav-item[href="?calc=dc_fast_charge_time"]').click({ timeout: 4000 }); } catch (e) { clickError = e.message.split('\n')[0]; }
  await page.waitForTimeout(400);
  const title = await fr.evaluate(() => (document.querySelector('#calc-container .calc-title') || {}).textContent || '');
  c('clicking a result opens it', !clickError && /DC Fast-Charge Time/.test(title), clickError || `title "${title}"`);

  c('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
  await ctx.close();
  return local;
}

(async () => {
  const browser = await playwright.chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const LOADS = [
    ['desktop, natural order', {}],
    ['desktop, final-ui-fix.js answered 2.5 s late', { delay: { 'final-ui-fix.js': 2500 } }],
    ['phone, natural order', { viewport: { width: 390, height: 844 } }],
    /* the shell's own menu rebuilds (app-shell ready(), the Premium gate's apply()) run only after premium-calculator-gating.js arrives: answering it
       2.5 s late puts them after the visitor has typed */
    ['desktop, premium-calculator-gating.js answered 2.5 s late', { delay: { 'premium-calculator-gating.js': 2500 } }]
  ];
  const srv = await serve(), port = srv.address().port;
  for (const [label, opt] of LOADS) await oneLoad(browser, port, label, opt);
  srv.close();

  if (!process.env.SKIP_MUTANTS) {
    const MUTANTS = [
      ['release final-ui-fix.js, late order', { 'final-ui-fix.js': releaseFile('final-ui-fix.js') }, { delay: { 'final-ui-fix.js': 2500 } }],
      ['release engine (original matching rule)', { [F124]: releaseFile(F124) }, {}],
      ['release app-shell.js (navigation-ux.js injection)', { 'app-shell.js': releaseFile('app-shell.js') }, {}]
    ];
    for (const [label, overrides, opt] of MUTANTS) {
      const m = await serve(overrides);
      const failed = await oneLoad(browser, m.address().port, 'mutant: ' + label, Object.assign({ quiet: true }, opt));
      m.close();
      check(`mutant detected: ${label}`, failed.length > 0, 'the test passed against the defective file');
      if (process.env.VERBOSE && failed.length) lines.push(`       (${failed.length} checks failed, e.g. ${failed.slice(0, 3).join('; ')})`);
    }
  }
  await browser.close();
  lines.forEach(l => console.log(l));
  console.log(`search authority (GH-DEF-038): ${checks - failures}/${checks} passed${failures ? `, ${failures} FAILED` : ''}`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
