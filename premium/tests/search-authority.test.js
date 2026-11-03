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
   The first fix (469f9b9) then over-matched: it stripped every non-ASCII character, so "°C" became "c" (641 results, 0 before) and "N·m" gave 457
   (4 before), and it listed results in plain catalogue order, so for 57 names the calculator typed exactly was not first ("Torque from HP" listed
   "HP from Torque" first). The revised rule (engine ghSearchTier) ranks in three tiers - exact name, original rule, word rule - and treats any word
   with a non-ASCII character as notation that must appear as typed.

   WHAT THIS TEST DOES (real Chromium; the repository served over http; the integrated index.html with the real shell scripts and the real engine
   in its frame; every request that is not to the local server is refused, so no network and no Supabase).
   Four loads: desktop in the natural script order; desktop with final-ui-fix.js answered 2.5 s late (the order that broke search); a phone viewport
   in the natural order (the menu opened with its own button); desktop with premium-calculator-gating.js answered 2.5 s late, so the shell's own menu
   rebuilds (app-shell ready(), the Premium gate's apply(), both with an empty query) land after the visitor has typed. For each load, queries are
   TYPED with the keyboard into the real search box and the menu is read back:
     - exactly one search implementation: no final-ui-fix or navigation-ux result host or API, navigation-ux.js not requested;
     - EXPECTED: for 21 representative queries the result ids and their ORDER equal a list written out in this file (independently specified from the
       catalogue, see EXPECTED below): exact names and their case / hyphen / spacing variants, partial, multi-word, hyphen / space / no-space, ids,
       notation ("N·m" -> its four converters; "°C", "°F", "Δp" -> none, as before the fix), notation mixed with a word, and a genuine no-match;
     - REFERENCE: every result list also equals a separately written reference of the specified rule (reference() below; loops over characters,
       not the engine's regular expressions), and contains no duplicate;
     - the "N RESULTS" header equals the number listed; a no-result query shows 0 RESULTS and the "No calculators match" message;
     - a successful search, then a failed one, then the first one again: no stale results, the same list both times;
     - clearing the box restores the full catalogue: the per-lab counts are Gasoline 198, Diesel 42, EV 45, Towing 28, Universal 430 (743, the
       Dashboard entry not counted) and the menu lists 743 calculators;
     - Premium badges: in the results for "piston" exactly the Premium calculators carry the PREMIUM tag;
     - a query typed before the shell has settled is still the one on screen afterwards;
     - clicking a result opens that calculator; no page errors.
   EXHAUSTIVE (desktop, natural order): the exact title of every one of the 743 calculators, and for every fifth one an upper-case variant with
   hyphens for spaces, is entered in the box (Playwright fill(), which fires the box's input event; typing 900 titles key by key would add many
   minutes): the calculator is first, or first among the calculators that share its name; every result equals the reference; original-rule matches
   are never listed after a word-rule-only match; catalogue order is kept within each tier; no duplicates.
   MUTANTS (the test must FAIL on each; SKIP_MUTANTS=1 skips them):
     1. the release's final-ui-fix.js (c9db895) answered late: its search takes the box over;
     2. the release's engine (c9db895): the original matching rule only;
     3. the first fix's engine (469f9b9): symbol queries widen into hundreds of results and exact names are not ranked first;
     4. the working engine with the tiers removed (results in plain catalogue order): exact-name precedence and original-rule precedence lost.

   Run: node premium/tests/search-authority.test.js   (VERBOSE=1 prints passes; GH_REPO=dir tests another checkout)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), { execSync, execFileSync } = require('child_process');
const REPO = process.env.GH_REPO ? path.resolve(process.env.GH_REPO) : path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
const RELEASE = 'c9db895';     // the release that shipped the defect
const FIRST_FIX = '469f9b9';   // the first fix, which over-matched symbol queries and did not rank exact names first
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
const gitFile = (rev, rel) => execFileSync('git', ['-C', REPO, 'show', `${rev}:${rel}`], { maxBuffer: 64 * 1024 * 1024 });

/* EXPECTED: result ids in order, written out from the catalogue (names and categories as the page shows them; checked by hand):
     - "N·m" appears in exactly four names (N·m to lb-ft, lb-ft to N·m, N·m to lb-in, lb-in to N·m); "°C", "°F", "Δp" appear in no name or category,
       and the original rule found nothing for them, so nothing is the right answer;
     - "Torque from HP" is an exact name, so it is first; "HP from Torque" holds every word and follows (and the reverse);
     - "Fuse Sizing" is the name of two calculators (fuse_sizing, ELECTRICAL, FLUID & UTILITIES; fuse_size, UNIVERSAL / ELECTRICAL), both first, in
       catalogue order;
     - "charge": the six names / categories that contain "charge" (original rule) come first, in catalogue order; the three EV "Charging" calculators,
       whose names say "charging" and whose ids say "charge", follow (word rule);
     - "torque N·m": no name containing "N·m" also has "torque" in its name, category or id, so nothing. */
const EXPECTED = [
  ['N·m', ['nm_to_lbft', 'lbft_to_nm', 'nmm_to_lbft', 'lbin_to_nm'], 'notation, original rule'],
  ['°C', [], 'notation, no name or category contains it'],
  ['°F', [], 'notation, no name or category contains it'],
  ['Δp', [], 'notation, no name or category contains it'],
  ['torque N·m', [], 'notation with a word: no calculator has both'],
  ['fast charge', ['dc_fast_charge_time'], 'space where the name has a hyphen'],
  ['Fast-Charge', ['dc_fast_charge_time'], 'hyphen as in the name'],
  ['FAST CHARGE', ['dc_fast_charge_time'], 'upper case'],
  ['fAsT-cHaRgE', ['dc_fast_charge_time'], 'mixed case with hyphen'],
  ['fastcharge', ['dc_fast_charge_time'], 'no space'],
  ['dc_fast_charge_time', ['dc_fast_charge_time'], 'calculator id (reads as the exact name)'],
  ['hp torque', ['hp_from_torque', 'torque_from_hp'], 'multi-word, words not adjacent'],
  ['HP from Torque', ['hp_from_torque', 'torque_from_hp'], 'exact name first'],
  ['Torque from HP', ['torque_from_hp', 'hp_from_torque'], 'exact name first (was second before the review)'],
  ['TORQUE-FROM-HP', ['torque_from_hp', 'hp_from_torque'], 'exact name, upper case with hyphens'],
  ['torque   from hp', ['torque_from_hp', 'hp_from_torque'], 'exact name, extra spaces'],
  ['Fuse Sizing', ['fuse_sizing', 'fuse_size'], 'exact name shared by two calculators'],
  ['charge', ['supercharger_speed', 'turbo_airflow', 'supercharger_parasitic', 'ev_soc_energy', 'ev_charge_added', 'dc_fast_charge_time',
    'ev_charge_time', 'ev_charge_cost', 'ev_charge_loss'], 'original-rule matches before word-rule matches'],
  ['  piston  ', null, 'surrounding spaces (list checked against the reference; must contain piston_acceleration)', 'piston_acceleration'],
  ['torq', null, 'partial word (list checked against the reference; must contain hp_from_torque)', 'hp_from_torque'],
  ['zzqxv nonexistent', [], 'genuine no-match']
];
const EXPECTED_LABS = { 'GASOLINE LAB': 198, 'DIESEL LAB': 42, 'EV LAB': 45, 'TOWING LAB': 28, 'UNIVERSAL LAB': 430 };

/* REFERENCE: the specified rule, written separately from the engine (character loops instead of the engine's regular expressions).
     tier 1  the query and the name are equal once lower-cased with every run of characters that are not letters or digits (any script) made one space;
     tier 2  the trimmed, lower-cased query is a substring of the lower-cased name or category (the original rule);
     tier 3  split the query at whitespace; a word with a character above U+007F must be a substring of the name or category as typed (lower-cased);
             every other word is cut at each character outside a-z / 0-9 and each piece must be a substring of name + category + id cut the same way;
             with no notation word, the pieces joined may instead be a substring of that text with its spaces removed; no pieces and no notation: no tier 3.
   Results: tier 1, then 2, then 3, catalogue order inside each tier. */
const isAlnumAny = ch => /\p{L}|\p{N}/u.test(ch);
const isAsciiAlnum = ch => (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9');
function cut(s, keep) {             // lower-case, keep runs of kept characters, everything else separates
  const parts = []; let cur = '';
  for (const ch of String(s).toLowerCase()) { if (keep(ch)) cur += ch; else { if (cur) parts.push(cur); cur = ''; } }
  if (cur) parts.push(cur);
  return parts;
}
function tierOf(c, query) {
  const q = query.trim().toLowerCase(), name = c.name.toLowerCase(), cat = c.cat.toLowerCase();
  const fq = cut(q, isAlnumAny).join(' ');
  if (fq !== '' && cut(name, isAlnumAny).join(' ') === fq) return 1;
  if (name.indexOf(q) >= 0 || cat.indexOf(q) >= 0) return 2;
  let notation = [], pieces = [];
  for (const w of q.split(/\s+/)) {
    if (!w) continue;
    let nonAscii = false; for (const ch of w) if (ch.codePointAt(0) > 0x7f) nonAscii = true;
    if (nonAscii) notation.push(w); else pieces = pieces.concat(cut(w, isAsciiAlnum));
  }
  if (!notation.length && !pieces.length) return 0;
  const hay = cut(name + ' ' + cat + ' ' + c.id, isAsciiAlnum).join(' ');
  let all = true;
  for (const w of notation) if (name.indexOf(w) < 0 && cat.indexOf(w) < 0) all = false;
  for (const p of pieces) if (hay.indexOf(p) < 0) all = false;
  if (all) return 3;
  if (!notation.length && hay.split(' ').join('').indexOf(pieces.join('')) >= 0) return 3;
  return 0;
}
function reference(calcs, query) {
  const t = { 1: [], 2: [], 3: [] };
  for (const c of calcs) { const x = tierOf(c, query); if (x) t[x].push(c.id); }
  return t[1].concat(t[2], t[3]);
}
const oldRule = (c, q) => c.name.toLowerCase().includes(q.trim().toLowerCase()) || c.cat.toLowerCase().includes(q.trim().toLowerCase());

let checks = 0, failures = 0; const lines = [];
const check = (name, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${name}`); };
const show = a => a.length > 12 ? a.slice(0, 12).join(', ') + ` … (${a.length})` : a.join(', ');

/* what the menu shows: header, listed calculator ids, which of them carry the PREMIUM tag, the empty message, lab counts, foreign result hosts */
const READ_NAV = () => {
  const nav = document.getElementById('calc-nav');
  const items = [...nav.querySelectorAll('a.gh-nav-item')].map(a => ({ id: decodeURIComponent((a.getAttribute('href') || '').replace(/^\?calc=/, '')),
    premium: !!a.querySelector('.gh-premium-tag') }));
  const head = nav.querySelector('.gh-nav-search-title');
  const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return !el.hidden && s.display !== 'none' && s.visibility !== 'hidden' && (r.width > 0 || r.height > 0); };
  return { header: head ? head.textContent.trim() : null, items, empty: (nav.querySelector('.fav-empty') || {}).textContent || null,
    labs: [...nav.querySelectorAll('.gh-lab-head')].map(h => [h.querySelector('span').textContent.trim(), Number(h.querySelector('b').textContent)]),
    home: !!nav.querySelector('.gh-nav-home'),
    foreignHosts: [...document.querySelectorAll('.gh-final-search-results,.gh-search-results')].filter(visible).map(e => e.className + ': ' + e.textContent.trim().slice(0, 60)),
    query: document.getElementById('search-input').value };
};

async function oneLoad(browser, port, label, { viewport = { width: 1280, height: 900 }, delay = {}, quiet = false, exhaustive = false } = {}) {
  const local = [];
  const c = (name, ok, detail) => { if (quiet) { if (!ok) local.push(name); return; } check(`${label} / ${name}`, ok, detail); if (!ok) local.push(name); };
  const ctx = await browser.newContext({ viewport }), page = await ctx.newPage(); page.setDefaultTimeout(15000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
  const requested = [];
  await page.route('**/*', async rt => {
    const u = rt.request().url();
    if (!u.startsWith(`http://127.0.0.1:${port}/`)) return rt.abort();
    const name = new URL(u).pathname.replace(/^\//, '');
    requested.push(name);
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

  /* 1. a query typed while the shell is still settling must survive the shell's menu rebuilds */
  const early = await type('charge');
  await page.waitForTimeout(Math.max(3500, ...Object.values(delay).map(d => d + 1500)));
  const settled = await fr.evaluate(READ_NAV);
  c('early query survives the shell settling', settled.query === 'charge' && settled.header && settled.items.length > 0 && settled.items.some(i => i.id === 'dc_fast_charge_time'),
    `typed "charge" before settle (header ${early.header}); after settle box="${settled.query}", header=${settled.header}, ${settled.items.length} items`);

  /* the catalogue the page shows (data, not the matching code); the Dashboard entry is not a calculator */
  const all = await fr.evaluate(() => CALCS.map(c => ({ id: c.id, name: String(c.name), cat: String(c.cat) })));
  const CALCS = all.filter(x => x.id !== 'dashboard');
  const premiumIds = new Set(await page.evaluate(() => GHP.models.PREMIUM_CALC_IDS.values()));
  c('catalogue: 743 calculators plus the Dashboard entry, no duplicate id', CALCS.length === 743 && all.length === 744 && new Set(CALCS.map(x => x.id)).size === 743,
    `${CALCS.length} calculators, ${all.length} entries, ${new Set(CALCS.map(x => x.id)).size} distinct ids`);

  /* 2. one search implementation */
  const impl = await fr.evaluate(() => ({ finalApi: typeof window.__GH_FINAL_SEARCH, navApi: typeof window.__GH_NAV_UX,
    navInjected: !!document.querySelector('script[data-gh-inject="navigation-ux.js"]') }));
  c('one search implementation', impl.finalApi === 'undefined' && impl.navApi === 'undefined' && !impl.navInjected, JSON.stringify(impl));
  c('navigation-ux.js never requested', !requested.some(n => n.startsWith('navigation-ux.js')), requested.filter(n => /navigation-ux/.test(n)).join(','));

  /* 3. representative queries, typed: independently specified lists, the reference, header, no other UI, no duplicates */
  for (const [q, want, why, mustContain] of EXPECTED) {
    const r = await type(q);
    const ids = r.items.map(i => i.id);
    if (want) c(`"${q}" (${why}) lists exactly the expected ids in order`, JSON.stringify(ids) === JSON.stringify(want), `got [${show(ids)}], expected [${show(want)}]`);
    if (mustContain) c(`"${q}" (${why}) lists ${mustContain}`, ids.includes(mustContain), `got [${show(ids)}]`);
    const ref = reference(CALCS, q);
    c(`"${q}" equals the reference`, JSON.stringify(ids) === JSON.stringify(ref), `got [${show(ids)}], reference [${show(ref)}]`);
    c(`"${q}" no duplicate result`, new Set(ids).size === ids.length, show(ids));
    c(`"${q}" header counts the list`, r.header === `${ids.length} RESULT${ids.length === 1 ? '' : 'S'}`, `header ${r.header}, ${ids.length} listed`);
    c(`"${q}" no other search UI visible`, r.foreignHosts.length === 0, r.foreignHosts.join(' | '));
    if (!ids.length) c(`"${q}" shows the no-result message`, /No calculators match/.test(r.empty || ''), String(r.empty));
  }

  /* 4. stale results and clearing */
  const ok1 = await type('charge');
  const none = await type('zzqxv nonexistent');
  const ok2 = await type('charge');
  c('success -> failure -> success: same list, nothing stale', ok1.items.length > 0 && none.items.length === 0 && JSON.stringify(ok1.items) === JSON.stringify(ok2.items),
    `${ok1.items.length}, then ${none.items.length}, then ${ok2.items.length}`);
  const cleared = await type('');
  const labsGot = Object.fromEntries(cleared.labs);
  c('clearing restores the full catalogue (198 / 42 / 45 / 28 / 430 = 743)', cleared.header === null && cleared.home && JSON.stringify(labsGot) === JSON.stringify(EXPECTED_LABS)
    && cleared.items.length === 743 && cleared.foreignHosts.length === 0,
    `header ${cleared.header}, home ${cleared.home}, labs ${JSON.stringify(labsGot)}, ${cleared.items.length} menu items`);
  c('full menu: PREMIUM tag on exactly the Premium calculators', cleared.items.every(i => i.premium === premiumIds.has(i.id)) && cleared.items.filter(i => i.premium).length === premiumIds.size,
    `${cleared.items.filter(i => i.premium).length} tagged, ${premiumIds.size} Premium ids`);

  /* 5. Premium badges in results */
  const pist = await type('piston');
  const wrongBadge = pist.items.filter(i => i.premium !== premiumIds.has(i.id)).map(i => `${i.id}:${i.premium}`);
  c('"piston": PREMIUM tag on exactly the Premium calculators', pist.items.some(i => i.premium) && pist.items.some(i => !i.premium) && wrongBadge.length === 0,
    `wrong: ${wrongBadge.join(',') || '-'}; ${pist.items.length} results`);

  /* 6. exhaustive exact-title ranking over the whole catalogue */
  if (exhaustive) {
    await openMenu();
    const pos = Object.fromEntries(CALCS.map((x, i) => [x.id, i]));
    const fold = s => cut(s, isAlnumAny).join(' ');
    const bad = { first: [], ref: [], precedence: [], order: [], dup: [] };
    const variant = n => n.toUpperCase().replace(/ /g, '-');
    const queries = CALCS.map(x => [x, x.name]).concat(CALCS.filter((x, i) => i % 5 === 0).map(x => [x, variant(x.name)]));
    for (const [calc, q] of queries) {
      await input.fill(q);
      const ids = (await fr.evaluate(READ_NAV)).items.map(i => i.id);
      const namesakes = CALCS.filter(x => fold(x.name) === fold(calc.name)).map(x => x.id);
      if (!(namesakes.includes(ids[0]) && ids.slice(0, namesakes.length).includes(calc.id))) bad.first.push(`${q} -> [${show(ids.slice(0, 4))}]`);
      if (JSON.stringify(ids) !== JSON.stringify(reference(CALCS, q))) bad.ref.push(q);
      const isOld = id => oldRule(CALCS[pos[id]], q), isExact = id => namesakes.includes(id);
      const lastOld = Math.max(-1, ...ids.map((id, i) => (isOld(id) || isExact(id)) ? i : -1));
      const firstNewOnly = ids.findIndex(id => !isOld(id) && !isExact(id));
      if (firstNewOnly >= 0 && firstNewOnly < lastOld) bad.precedence.push(q);
      const tiers = ids.map(id => isExact(id) ? 1 : isOld(id) ? 2 : 3);
      for (let i = 1; i < ids.length; i++) if (tiers[i] === tiers[i - 1] && pos[ids[i]] < pos[ids[i - 1]]) { bad.order.push(q); break; }
      if (new Set(ids).size !== ids.length) bad.dup.push(q);
    }
    await input.fill('');
    const n = queries.length;
    c(`exhaustive: every exact title (743) and ${n - 743} upper-case / hyphen variants list their calculator first among its namesakes`, !bad.first.length, `${bad.first.length}/${n}: ${bad.first.slice(0, 5).join(' | ')}`);
    c('exhaustive: every list equals the reference', !bad.ref.length, `${bad.ref.length}/${n}: ${bad.ref.slice(0, 5).join(' | ')}`);
    c('exhaustive: original-rule matches never listed after a word-rule-only match', !bad.precedence.length, `${bad.precedence.length}/${n}: ${bad.precedence.slice(0, 5).join(' | ')}`);
    c('exhaustive: catalogue order kept inside each tier', !bad.order.length, `${bad.order.length}/${n}: ${bad.order.slice(0, 5).join(' | ')}`);
    c('exhaustive: no duplicate results', !bad.dup.length, `${bad.dup.length}/${n}: ${bad.dup.slice(0, 5).join(' | ')}`);
  }

  /* 7. a result opens its calculator */
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
    ['desktop, natural order', { exhaustive: true }],
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
    const working = fs.readFileSync(path.join(REPO, F124), 'utf8');
    const TIERED = 'const matches = tiers[0].concat(tiers[1], tiers[2]);';
    if (!working.includes(TIERED)) throw new Error('mutant 4 cannot be built: the tier concatenation is not in the working engine');
    const untiered = Buffer.from(working.replace(TIERED, "const matches = CALCS.filter(c => c.id !== 'dashboard' && ghSearchTier(c, q));"));
    const MUTANTS = [
      ['release final-ui-fix.js, late order', { 'final-ui-fix.js': gitFile(RELEASE, 'final-ui-fix.js') }, { delay: { 'final-ui-fix.js': 2500 } }],
      ['release engine (original matching rule only)', { [F124]: gitFile(RELEASE, F124) }, {}],
      ['first-fix engine 469f9b9 (symbols widened, no ranking)', { [F124]: gitFile(FIRST_FIX, F124) }, { exhaustive: true }],
      ['working engine with the tiers removed (catalogue order only)', { [F124]: untiered }, { exhaustive: true }]
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
