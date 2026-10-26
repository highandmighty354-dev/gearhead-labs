#!/usr/bin/env node
/* Gearhead Labs — Engineering Encyclopedia (Issue #23): data, validator, search and the page.

   WHAT IS CHECKED (real Chromium; the repository served over http, nothing outside it reachable):
     V  the validator (catalog/check-encyclopedia.js) passes on the committed data and FAILS on each of 13 broken copies (duplicate id,
        a calculator that does not exist, an undeclared alias collision, an invalid relation type, a not-equivalent link without a note,
        a Premium formula leak, an invented usage count, broken A–Z order, an invented section, a missing calculator entry, "reviewed"
        without a reviewer, a stale source checksum, two relations to the same concept); the generator's --check (the committed JSON is what the sources produce)
     S  search on the real data (window.GHEnc in Node, the same code the page runs): preferred term, alias, abbreviation, shop
        language, calculator id, former id, units, definition words, words without spaces ("ujoint"), case and accents, special
        characters, every word required, the ambiguity notice for terms with several meanings
     O  A–Z equals an independent sort; Z–A is its exact reverse; equal terms ordered by id; repeated queries give the same order
     F  filters (type, lab, section, access) alone and with search; each canonical calculator appears once; a concept is found from
        every existing section of its calculators; filters use only labs and sections the catalogue has
     U  sorting by usage, popularity or date is refused with the reason (no data), never invented
     P  the page, desktop 1280×900 and iPhone 390×844: loads, no horizontal overflow (list and entries, including the longest), typing,
        the letter bar, keyboard (/ to search, Tab and Enter to open, focus on the entry, Escape), deep links (?q, ?entry, ?cat,
        unknown entry), Back/Forward, filters through the controls, the empty state, unsupported sort options disabled with the reason;
        every link on every concept and abbreviation entry resolves (entries, index.html?calc= ids in the catalogue, ?lab= routes)
     G  Premium boundary: a Premium tool's entry shows no inputs, results or help text; the page loads only its own files; opening
        a Premium tool from the encyclopedia through index.html?calc= still shows the app's Premium gate to a signed-out visitor
     E  the entry point: the calculator search (inside the app) links to the encyclopedia with what was typed, and opens it at top level
   Run: node premium/tests/encyclopedia.test.js   (VERBOSE=1 prints passes)   Exit code 0 = every check passed. */
'use strict';
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os'), vm = require('vm'), { execSync, spawnSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const DATA_FILE = path.join(REPO, 'catalog/gearhead-encyclopedia.json');
const DATA = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const CATALOG = JSON.parse(fs.readFileSync(path.join(REPO, 'catalog/gearhead-catalog.json'), 'utf8'));
const TOOL = Object.fromEntries(CATALOG.tools.map(t => [t.id, t]));

let checks = 0, failures = 0; const lines = []; const perf = [];
const check = (name, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${name}`); };

/* ================= V. validator and generator ================= */
function validator() {
  const run = file => spawnSync(process.execPath, [path.join(REPO, 'catalog/check-encyclopedia.js')], { env: Object.assign({}, process.env, file ? { GH_ENCYCLOPEDIA: file } : {}), encoding: 'utf8' });
  const ok = run(null);
  check('V the committed encyclopedia passes the validator', ok.status === 0, ok.stdout + ok.stderr);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-enc-'));
  const clone = () => JSON.parse(JSON.stringify(DATA));
  const find = (d, id) => d.entries.find(e => e.id === id);
  const MUT = [
    ['a duplicate entry id', d => { d.entries.push(Object.assign({}, find(d, 'term.wheel-rate'))); }],
    ['a calculator that does not exist', d => { find(d, 'term.wheel-rate').calculators.push('no_such_calculator'); }],
    ['an undeclared alias collision', d => { find(d, 'term.wheel-rate').aliases.push('roll rate'); }],
    ['an invalid relation type', d => { find(d, 'term.wheel-rate').related[0].type = 'same-as'; }],
    ['a not-equivalent link without a note', d => { const r = find(d, 'term.wheel-rate').related.find(x => x.type === 'not-equivalent'); r.note = null; }],
    ['a Premium tool exposing a formula', d => { find(d, 'calc.dynamic_compression').formula = { inputs: ['Bore'], outputs: [] }; }],
    ['an invented usage count', d => { find(d, 'calc.ujoint_angles').uses = 120; }],
    ['broken A–Z order', d => { const a = d.entries.shift(); d.entries.push(a); }],
    ['an invented section', d => { find(d, 'term.wheel-rate').sections.push({ lab: 'gasoline', category: 'TRANSMISSION' }); }],
    ['a catalogue tool with no entry', d => { d.entries = d.entries.filter(e => e.id !== 'calc.ujoint_angles'); }],
    ['"reviewed" with no reviewer', d => { find(d, 'term.wheel-rate').review.status = 'reviewed'; }],
    ['a stale source checksum', d => { d.generated_from.enrichment.sha256 = '0'.repeat(64); }],
    ['two relations to the same concept', d => { const e = find(d, 'term.wheel-rate'); e.related.push({ to: e.related[0].to, type: 'related', note: null, declared: true }); }]
  ];
  for (const [name, mut] of MUT) {
    const d = clone(); mut(d); const f = path.join(tmp, 'mut.json'); fs.writeFileSync(f, JSON.stringify(d));
    const r = run(f);
    check(`V the validator rejects ${name}`, r.status !== 0, (r.stdout || '').split('\n')[0]);
  }
  const g = spawnSync(process.execPath, [path.join(REPO, 'catalog/build-encyclopedia.js'), '--check'], { encoding: 'utf8' });
  check('V the committed JSON is exactly what the generator produces from its sources (--check)', g.status === 0, g.stdout + g.stderr);
}

/* ================= S, O, F, U. search, order, filters and sort modes on the real data ================= */
function logic() {
  const ctx = { window: {}, console }; vm.runInNewContext(fs.readFileSync(path.join(REPO, 'encyclopedia.js'), 'utf8'), ctx);
  const G = ctx.window.GHEnc, ix = G.buildIndex(DATA);
  const q = o => G.query(ix, typeof o === 'string' ? { q: o } : o);
  const top = (o, id, n = 1) => { const r = q(o).results.slice(0, n).map(e => e.id); return r.includes(id); };
  const SEARCH = [
    ['preferred term "Wheel Rate"', 'Wheel Rate', ['calc.wheel_rate', 'term.wheel-rate'], 2],
    ['alias "posi"', 'posi', ['term.limited-slip-differential'], 1],
    ['alias "rear end ratio"', 'rear end ratio', ['term.final-drive-ratio'], 1],
    ['shop language "gears"', 'gears', ['term.final-drive-ratio'], 3],
    ['abbreviation "DCR"', 'DCR', ['abbr.dcr', 'term.dynamic-compression-ratio'], 2],
    ['abbreviation "LSD"', 'lsd', ['abbr.lsd', 'term.limited-slip-differential'], 2],
    ['abbreviation "BMEP"', 'BMEP', ['abbr.bmep', 'term.bmep'], 2],
    ['calculator id', 'dynamic_compression', ['calc.dynamic_compression'], 1],
    ['former calculator id', 'carb_cfm', ['calc.carb_sizing'], 1],
    ['words without spaces "ujoint"', 'ujoint', ['term.ujoint-operating-angle', 'calc.ujoint_angles'], 2],
    ['hyphenated "u-joint"', 'u-joint', ['term.ujoint-operating-angle'], 2],
    ['upper case "ACKERMANN"', 'ACKERMANN', ['term.ackermann'], 2],
    ['accents "Ackérmann"', 'Ackérmann', ['term.ackermann'], 2],
    ['misspelling listed as an alias "Ackerman"', 'Ackerman', ['term.ackermann'], 2],
    ['British spelling alias "roll centre"', 'roll centre', ['term.roll-center'], 1],
    ['definition words "swept volume"', 'swept volume', ['term.engine-displacement'], 1],
    ['"&" in the query "ring & pinion"', 'ring & pinion', ['term.ring-and-pinion'], 2]
  ];
  for (const [name, s, ids, n] of SEARCH) { const r = q(s).results.slice(0, n).map(e => e.id); check(`S ${name}: ${ids.join(', ')} in the top ${n}`, ids.every(i => r.includes(i)), JSON.stringify(r)); }
  check('S a unit "lb/in" finds entries with that unit', q('lb/in').results.some(e => e.id === 'term.wheel-rate') && q('lb/in').results.some(e => e.id === 'calc.coil_spring'), q('lb/in').results.slice(0, 5).map(e => e.id).join(' '));
  check('S every query word is required: "wheel zzzz" finds nothing', q('wheel zzzz').results.length === 0, q('wheel zzzz').results.length);
  check('S a short query matches word starts, not the middle of words ("rod" does not find "product" only entries)', q('rod').results.every(e => /\brod/i.test(JSON.stringify(e).replace(/_/g, ' '))), q('rod').results.filter(e => !/\brod/i.test(JSON.stringify(e).replace(/_/g, ' '))).map(e => e.id).slice(0, 5).join(' '));
  for (const s of ['<script>alert(1)</script>', '%', '"', '\\', '()', '∑', '   ', 'Ø']) { let r, err = null; try { r = q(s); } catch (e) { err = e.message; } check(`S special characters ${JSON.stringify(s)} do not break the search`, !err && Array.isArray(r.results), err); }
  check('S an empty query returns every entry', q('').results.length === DATA.entries.length, q('').results.length);
  for (const amb of ['spring rate', 'CR', 'compression ratio']) {
    const r = q(amb), n = r.notices.find(x => x.kind === 'ambiguous');
    const meanings = DATA.entries.filter(e => e.type === 'concept' && [e.term].concat(e.aliases, e.abbreviations).some(a => G.words(a) === G.words(amb))).map(e => e.id);
    check(`S "${amb}" shows the "more than one meaning" notice and lists every meaning near the top`, !!n && meanings.length >= 2 && meanings.every(m => r.results.slice(0, meanings.length + 2).some(e => e.id === m)), JSON.stringify({ notice: !!n, meanings, top: r.results.slice(0, 5).map(e => e.id) }));
  }
  check('S a true synonym is not confused with a related concept: "locker" is not an alias of the limited-slip differential', !DATA.entries.find(e => e.id === 'term.limited-slip-differential').aliases.includes('locker'), 'alias present');

  /* O. order */
  const indep = DATA.entries.slice().sort((a, b) => { const k = s => s.normalize('NFKD').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase(); return k(a.term) < k(b.term) ? -1 : k(a.term) > k(b.term) ? 1 : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }).map(e => e.id);
  const az = q({ q: '', sort: 'az' }).results.map(e => e.id), za = q({ q: '', sort: 'za' }).results.map(e => e.id);
  check('O A–Z equals an independent sort by the folded term, then id', JSON.stringify(az) === JSON.stringify(indep), az.findIndex((x, i) => x !== indep[i]));
  check('O Z–A is the exact reverse of A–Z', JSON.stringify(za) === JSON.stringify(az.slice().reverse()), 'differs');
  const dup = DATA.entries.filter(e => e.term === 'Driveshaft Critical Speed').map(e => e.id).sort();
  check('O equal terms are ordered by id (Driveshaft Critical Speed: the calculator, then the concept)', JSON.stringify(az.filter(x => dup.includes(x))) === JSON.stringify(dup), JSON.stringify(dup));
  check('O the same query twice gives the same order', JSON.stringify(q('spring').results.map(e => e.id)) === JSON.stringify(q('spring').results.map(e => e.id)), 'differs');
  check('O letters: every entry is grouped under the first letter of its term', DATA.entries.every(e => e.letter === (/[A-Z]/.test(G.sortKey(e.term).charAt(0).toUpperCase()) ? G.sortKey(e.term).charAt(0).toUpperCase() : '#')), 'mismatch');

  /* F. filters */
  for (const lab of DATA.facets.labs.map(l => l.key)) {
    const r = q({ q: '', lab }).results;
    check(`F lab ${lab}: every result has a ${lab} section (or abbreviates one)`, r.length > 0 && r.every(e => (e.sections || []).some(s => s.lab === lab) || e.type === 'abbreviation'), r.length);
  }
  for (const c of ['DRIVETRAIN & GEARING', 'SUSPENSION, TIRES & GEOMETRY', 'ENGINE', 'UNIVERSAL / VEHICLE DYNAMICS']) {
    const r = q({ q: '', category: c }).results.filter(e => e.type === 'calculator');
    const want = CATALOG.tools.filter(t => t.category === c).map(t => t.id).sort();
    check(`F section "${c}": exactly the catalogue's calculators of that section, each once`, JSON.stringify(r.map(e => e.calculator).sort()) === JSON.stringify(want), `${r.length} vs ${want.length}`);
  }
  for (const [concept, cats] of [['term.wheel-rate', ['SUSPENSION, TIRES & GEOMETRY', 'UNIVERSAL / VEHICLE DYNAMICS']], ['term.final-drive-ratio', ['DRIVETRAIN & GEARING', 'SUSPENSION, TIRES & GEOMETRY']], ['term.intake-valve-closing', ['GASOLINE / ENGINE AIRFLOW & VALVETRAIN', 'ENGINE']], ['term.bmep', ['GASOLINE / ENGINE THERMODYNAMICS', 'DIESEL PERFORMANCE & EFFICIENCY']]])
    for (const c of cats) check(`F ${concept} is found from the section "${c}" (one entry, several sections)`, q({ q: '', category: c }).results.filter(e => e.id === concept).length === 1, 'not listed');
  check('F type: concepts only', q({ q: '', type: 'concept' }).results.every(e => e.type === 'concept') && q({ q: '', type: 'concept' }).results.length === DATA.counts.concepts, q({ q: '', type: 'concept' }).results.length);
  check('F access: Premium only lists only Premium tools', q({ q: '', tier: 'premium' }).results.every(e => e.type === 'calculator' && e.tier === 'premium') && q({ q: '', tier: 'premium' }).results.length === DATA.counts.calculators_premium, q({ q: '', tier: 'premium' }).results.length);
  const comb = q({ q: 'ratio', lab: 'gasoline', type: 'calculator', category: 'DRIVETRAIN & GEARING' }).results;
  check('F search and filters together', comb.length > 0 && comb.every(e => e.type === 'calculator' && e.lab === 'gasoline' && e.category === 'DRIVETRAIN & GEARING') && comb.some(e => e.calculator === 'final_drive_ratio'), comb.map(e => e.id).join(' '));
  const ids = q('').results.filter(e => e.type === 'calculator').map(e => e.calculator);
  check('F each canonical calculator appears once in the whole list', ids.length === new Set(ids).size && ids.length === CATALOG.tools.length, `${ids.length} / ${new Set(ids).size} / ${CATALOG.tools.length}`);
  check('F the filters offer only labs and sections that exist in the catalogue', DATA.facets.categories.every(c => CATALOG.tools.some(t => t.category === c.name)) && DATA.facets.labs.every(l => CATALOG.tools.some(t => t.lab === l.key)), 'unknown facet');
  check('F no invented "Transmission" or "Differential" section', !DATA.facets.categories.some(c => /^(TRANSMISSION|DIFFERENTIAL)$/i.test(c.name)), 'present');
  check('F no results: a combination with nothing in it ("limited slip" in the EV Lab) returns an empty list, not an error', q({ q: 'limited slip', lab: 'ev' }).results.length === 0, q({ q: 'limited slip', lab: 'ev' }).results.length);

  /* U. sort modes */
  for (const m of ['most-used', 'least-used', 'most-popular', 'recently-added', 'recently-updated']) {
    const r = q({ q: '', sort: m });
    check(`U "${m}" is refused with its reason and falls back to A–Z`, DATA.sort_modes[m].supported === false && r.sort === 'az' && r.notices.some(n => n.kind === 'sort' && n.text.includes(DATA.sort_modes[m].reason)) && JSON.stringify(r.results.map(e => e.id)) === JSON.stringify(az), r.sort);
  }
  check('U no entry carries a usage, popularity or date value', DATA.entries.every(e => !['uses', 'use_count', 'views', 'popularity', 'score', 'rank', 'added', 'created', 'updated', 'modified'].some(k => k in e)), 'present');

  /* timing on the real data, for the report */
  let t0 = process.hrtime.bigint(); G.buildIndex(DATA); perf.push(`index build ${(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(1)} ms (Node)`);
  t0 = process.hrtime.bigint(); for (const s of ['wheel', 'dcr', 'compression ratio', 'u-joint', 'lb/in']) q(s); perf.push(`5 searches ${(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(1)} ms (Node)`);
}

/* ================= P, G, E. the page ================= */
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

async function pages(browser, port) {
  const base = `http://127.0.0.1:${port}/`;
  for (const [label, viewport, mobile] of [['desktop', { width: 1280, height: 900 }, false], ['iPhone', { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile }), page = await ctx.newPage(); page.setDefaultTimeout(10000);
    const errs = [], requests = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('request', r => requests.push(r.url()));
    await page.route('**/*', rt => rt.request().url().startsWith(base) ? rt.continue() : rt.abort());
    const ready = async url => { const t = Date.now(); await page.goto(base + url, { waitUntil: 'load' }); await page.waitForFunction(() => document.getElementById('enc').getAttribute('aria-busy') === 'false'); return Date.now() - t; };
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const tag = s => `P ${label}: ${s}`;

    const ms = await ready('encyclopedia.html');
    perf.push(`${label}: page ready ${ms} ms (local server)`);
    check(tag('loads and lists every entry A–Z'), (await page.textContent('#count')).startsWith(`${DATA.entries.length} entries`) && (await page.locator('a.item').count()) === DATA.entries.length, await page.textContent('#count'));
    check(tag('no horizontal overflow (list)'), (await overflow()) <= 0, await overflow());
    check(tag('the search box and every control has an accessible name'), await page.evaluate(() => [...document.querySelectorAll('input,select,button')].every(el => (el.labels && el.labels.length) || el.getAttribute('aria-label') || el.textContent.trim())), 'unlabelled control');
    check(tag('unsupported sort options are disabled and say why'), await page.evaluate(() => [...document.querySelectorAll('#f-sort option[disabled]')].length === 5 && /no analytics/.test(document.getElementById('sort-note').textContent)), 'not disabled');

    /* typing */
    await page.keyboard.press('/'); check(tag('"/" focuses the search box'), await page.evaluate(() => document.activeElement.id === 'q'), 'not focused');
    await page.keyboard.type('posi'); await page.waitForTimeout(250);
    check(tag('typing "posi" lists the limited-slip differential first and writes ?q= to the address'), (await page.locator('a.item').first().getAttribute('data-id')) === 'term.limited-slip-differential' && (await page.evaluate(() => location.search)) === '?q=posi', await page.locator('a.item').first().getAttribute('data-id'));
    /* keyboard: Tab to the first result, Enter opens it, focus goes to the entry title */
    for (let i = 0; i < 12 && !(await page.evaluate(() => document.activeElement.classList.contains('item'))); i++) await page.keyboard.press('Tab');
    await page.keyboard.press('Enter'); await page.waitForTimeout(150);
    check(tag('Tab reaches the first result, Enter opens it and focus moves to the entry title'), await page.evaluate(() => document.activeElement.id === 'entry-title' && document.activeElement.textContent === 'Limited-Slip Differential' && /entry=term\.limited-slip-differential/.test(location.search)), await page.evaluate(() => document.activeElement.id + ' ' + location.search));
    check(tag('no horizontal overflow (an entry open)'), (await overflow()) <= 0, await overflow());
    if (mobile) { check(tag('on a phone the entry replaces the list'), await page.evaluate(() => getComputedStyle(document.getElementById('listwrap')).display === 'none' && getComputedStyle(document.getElementById('entry')).display !== 'none'), 'both shown'); }
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    check(tag('Escape closes the entry'), await page.evaluate(() => !/entry=/.test(location.search) && !document.body.classList.contains('has-entry')), await page.evaluate(() => location.search));
    await page.goBack(); await page.waitForTimeout(150);
    check(tag('Back reopens the entry (history)'), await page.evaluate(() => /entry=term\.limited-slip-differential/.test(location.search) && document.getElementById('entry-title')), await page.evaluate(() => location.search));

    /* letter bar */
    await ready('encyclopedia.html');
    await page.click('#letters button[data-l="W"]'); await page.waitForTimeout(150);
    check(tag('the letter bar jumps to W (heading focused and on screen)'), await page.evaluate(() => { const h = document.getElementById('letter-W'), r = h.getBoundingClientRect(); return document.activeElement === h && r.top >= -2 && r.top < innerHeight; }), 'not on screen');
    check(tag('letters with no entries are disabled'), await page.evaluate(() => [...document.querySelectorAll('#letters button')].every(b => b.disabled === !document.getElementById('letter-' + (b.dataset.l === '#' ? 'num' : b.dataset.l)))), 'mismatch');

    /* deep links, filters, empty state */
    await ready('encyclopedia.html?entry=term.wheel-rate');
    const wr = await page.evaluate(() => ({ t: document.getElementById('entry-title') && document.getElementById('entry-title').textContent, links: [...document.querySelectorAll('#entry a')].map(a => a.getAttribute('href') + '|' + (a.getAttribute('target') || '') + '|' + (a.dataset.id || '')) }));
    check(tag('?entry= opens that entry directly'), wr.t === 'Wheel Rate', JSON.stringify(wr.t));
    check(tag('the entry links to its calculators through index.html?calc= at top level'), ['wheel_rate', 'wheel_motion', 'anti_roll_bar_wheel_rate'].every(id => wr.links.includes(`index.html?calc=${id}|_top|`)), wr.links.join(' '));
    await ready('encyclopedia.html?entry=term.does-not-exist');
    check(tag('an unknown ?entry= says so instead of failing'), /Entry not found/.test(await page.textContent('#entry')), await page.textContent('#entry'));
    await ready('encyclopedia.html?q=zzzz-nothing');
    check(tag('the empty state explains and offers to clear'), /No entries match/.test(await page.textContent('#list')) && (await page.locator('#clear-all').count()) === 1, await page.textContent('#list'));
    await page.click('#clear-all'); await page.waitForTimeout(150);
    check(tag('"Clear search and filters" restores the full list'), (await page.locator('a.item').count()) === DATA.entries.length && (await page.evaluate(() => location.search)) === '', await page.evaluate(() => location.search));
    if (mobile) {
      check(tag('on a phone the filters start folded, so the list gets the screen'), await page.evaluate(() => !document.getElementById('fbox').open && getComputedStyle(document.getElementById('f-cat')).display !== 'none' && !document.getElementById('f-cat').checkVisibility()), 'filters open');
      await page.click('#fbox > summary'); await page.waitForTimeout(100);
      check(tag('tapping "Filters & sort" opens them'), await page.evaluate(() => document.getElementById('fbox').open && document.getElementById('f-cat').checkVisibility()), 'not opened');
    }
    await page.selectOption('#f-cat', 'DRIVETRAIN & GEARING'); await page.selectOption('#f-type', 'concept'); await page.waitForTimeout(150);
    const fl = await page.evaluate(() => [...document.querySelectorAll('a.item')].map(a => a.dataset.id));
    check(tag('the Section and Type controls filter the list and are kept in the address'), fl.length > 0 && fl.every(id => id.startsWith('term.')) && fl.includes('term.final-drive-ratio') && (await page.evaluate(() => location.search)).includes('cat=DRIVETRAIN'), fl.join(' '));
    await ready('encyclopedia.html?sort=most-used');
    check(tag('?sort=most-used is refused with the reason, A–Z shown'), /not available/.test(await page.textContent('#notices')) && (await page.locator('a.item').first().getAttribute('data-id')) === DATA.entries[0].id, await page.textContent('#notices'));

    /* every link on every concept and abbreviation entry, and overflow on the longest entries */
    if (!mobile) {
      const bad = [];
      for (const e of DATA.entries.filter(x => x.type !== 'calculator')) {
        await page.evaluate(id => { history.replaceState(null, '', '?entry=' + id); dispatchEvent(new PopStateEvent('popstate')); }, e.id);
        const links = await page.evaluate(() => [...document.querySelectorAll('#entry a')].map(a => ({ href: a.getAttribute('href'), id: a.dataset.id || null, cat: a.dataset.cat || null })));
        for (const l of links) {
          if (l.id) { if (!DATA.entries.some(x => x.id === l.id)) bad.push(`${e.id} -> ${l.id}`); continue; }
          if (l.cat) { if (!DATA.facets.categories.some(c => c.name === l.cat)) bad.push(`${e.id} -> section ${l.cat}`); continue; }
          const m = /^index\.html\?(calc|lab)=([a-z0-9_]+)$/.exec(l.href || '');
          if (!m || (m[1] === 'calc' && !TOOL[m[2]]) || (m[1] === 'lab' && !['gasoline', 'diesel', 'ev', 'towing', 'universal'].includes(m[2]))) bad.push(`${e.id} -> ${l.href}`);
        }
      }
      check(`P every link on the ${DATA.counts.concepts + DATA.counts.abbreviations} concept and abbreviation entries resolves (entries, sections, calculators, labs)`, bad.length === 0, bad.slice(0, 8).join(' | '));
    }
    const longest = DATA.entries.slice().sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length).slice(0, 3);
    for (const e of longest) { await ready('encyclopedia.html?entry=' + encodeURIComponent(e.id)); check(tag(`no horizontal overflow on a long entry (${e.id})`), (await overflow()) <= 0, await overflow()); }

    /* G. Premium boundary on the page */
    await ready('encyclopedia.html?entry=calc.dynamic_compression');
    const pe = await page.evaluate(() => ({ text: document.getElementById('entry').innerText, open: [...document.querySelectorAll('#entry a.btn')].map(a => a.getAttribute('href')) }));
    check(tag('a Premium tool shows no inputs, results or formula, only the public promo, and says sign-in is required'), !/Inputs|Results/.test(pe.text) && /Premium sign-in required/.test(pe.text) && pe.open[0] === 'index.html?calc=dynamic_compression', pe.text.slice(0, 200));
    const foreign = requests.filter(u => !/\/(encyclopedia\.html|encyclopedia\.js|catalog\/gearhead-encyclopedia\.json)(\?|$)/.test(u.replace(base, '/')));
    check(tag('the page loads only its own three files (no Premium code, no profile data, no third party)'), foreign.length === 0, foreign.slice(0, 5).join(' '));
    check(tag('no page errors'), errs.length === 0, errs.slice(0, 3).join(' | '));
    if (mobile) await page.screenshot({ path: path.join(os.tmpdir(), 'gh-enc-iphone.png') }); else await page.screenshot({ path: path.join(os.tmpdir(), 'gh-enc-desktop.png') });
    await ctx.close();
  }

  /* G (app side) and E: the app keeps its Premium gate; the entry point inside the app */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), page = await ctx.newPage(); page.setDefaultTimeout(15000);
  await page.route('**/*', rt => rt.request().url().startsWith(base) ? rt.continue() : rt.abort());
  await page.goto(base + 'index.html?calc=dynamic_compression', { waitUntil: 'load' }); await page.waitForTimeout(2500);
  const fr = page.frames().find(f => f.url().includes(F124));
  check('G opening a Premium tool from the encyclopedia (index.html?calc=dynamic_compression) still shows the app\'s Premium gate when signed out', fr && await fr.evaluate(() => !!document.querySelector('.gh-premium-upsell') && document.querySelectorAll('#calc-container .calc-body input').length === 0), 'no gate');
  const link = fr && await fr.evaluate(() => { const a = document.getElementById('gh-enc-link'); return a && { href: a.getAttribute('href'), target: a.target, text: a.textContent }; });
  check('E the calculator search area links to the encyclopedia, opening at top level', !!link && link.href === 'encyclopedia.html' && link.target === '_top', JSON.stringify(link));
  if (fr) { await fr.evaluate(() => { const i = document.getElementById('search-input'); i.value = 'posi'; i.dispatchEvent(new Event('input')); }); }
  const link2 = fr && await fr.evaluate(() => document.getElementById('gh-enc-link').getAttribute('href'));
  check('E the link carries what was typed in the calculator search (?q=)', link2 === 'encyclopedia.html?q=posi', link2);
  if (fr) await fr.click('#gh-enc-link').catch(() => {});
  await page.waitForTimeout(1200);
  check('E following it opens the encyclopedia at top level with the search already run', /\/encyclopedia\.html\?q=posi$/.test(page.url()) && await page.evaluate(() => document.getElementById('q') && document.getElementById('q').value === 'posi'), page.url());
  await ctx.close();
}

(async () => {
  const t0 = Date.now();
  validator();
  logic();
  const srv = await serve(), browser = await playwright.chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  try { await pages(browser, srv.address().port); } finally { await browser.close(); srv.close(); }
  lines.forEach(l => console.log(l));
  perf.forEach(p => console.log('  perf ' + p));
  console.log(`encyclopedia: ${checks} checks, ${failures} failures (${Math.round((Date.now() - t0) / 1000)} s); screenshots in ${os.tmpdir()}/gh-enc-desktop.png and gh-enc-iphone.png`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
