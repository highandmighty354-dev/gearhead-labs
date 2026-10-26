#!/usr/bin/env node
/* Gearhead Labs Engineering Encyclopedia — generator (Issue #23).
 *
 * Builds catalog/gearhead-encyclopedia.json. Nothing in the output is typed by hand here; every field comes from one of:
 *   - catalog/gearhead-catalog.json        calculator identity: id, name, category, lab, tier, kind, former ids (aliases)
 *                                          (the canonical catalogue; this script never writes it)
 *   - the engine page, loaded in Chromium  for FREE calculators only: the help text the calculator page shows (headerHTML's help
 *                                          message) and the formula registry's input labels and outputs (what the page shows)
 *   - premium/models.js                    for PREMIUM tools only: the public promo line the Premium upsell already shows
 *   - catalog/encyclopedia-enrichment.json concept entries (definitions, synonyms, abbreviations, relations, the calculators each
 *                                          concept is calculated with), all marked draft-unreviewed
 * Premium boundary: a Premium tool's entry carries only what a signed-out visitor already sees (name, category, lab, the promo
 * line). No formula, help text or inputs of a Premium tool are copied.
 * Derived, not typed: a concept's sections (existing lab + category) are the sections of the calculators it links to; inverse
 * relations (narrower <-> broader, prerequisite <-> prerequisite-for, related, not-equivalent) are added automatically;
 * abbreviation entries are made from the concepts' abbreviations.
 *
 * Usage:  node catalog/build-encyclopedia.js          write catalog/gearhead-encyclopedia.json
 *         node catalog/build-encyclopedia.js --check  regenerate in memory and fail if the committed file differs
 * Needs Playwright (Chromium). No network: every request outside the local server is aborted. */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), crypto = require('crypto'), vm = require('vm'), { execSync } = require('child_process');
let pw; try { pw = require('playwright'); } catch (e) { pw = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }

const REPO = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'gearhead-encyclopedia.json');
const PAGE = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
const CATALOG = 'catalog/gearhead-catalog.json', ENRICH = 'catalog/encyclopedia-enrichment.json', MODELS = 'premium/models.js';
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, f))).digest('hex');
const ENTRY_TYPES = ['concept', 'abbreviation', 'calculator'];
const RELATION_INVERSE = { broader: 'narrower', narrower: 'broader', prerequisite: 'prerequisite-for', 'prerequisite-for': 'prerequisite', related: 'related', 'not-equivalent': 'not-equivalent' };
const LAB_LABELS = { gasoline: 'Gasoline Lab', diesel: 'Diesel Lab', ev: 'EV Lab', towing: 'Towing Lab', universal: 'Universal Lab', engineering: 'Engineering Lab (Premium)' };
const LAB_ROUTES = new Set(['gasoline', 'diesel', 'ev', 'towing', 'universal']);   // ?lab= keys the engine's router accepts (ghRoute / GH_LABS)
const text = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
const sortKey = s => String(s).normalize('NFKD').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const letterOf = s => { const c = sortKey(s).charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };

/* the engine's public content for the FREE calculators: help text and formula registry rows */
async function readPage(freeIds) {
  const srv = await new Promise(res => { const s = http.createServer((q, r) => {
    const f = path.join(REPO, decodeURIComponent(new URL(q.url, 'http://x').pathname));
    if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'text/javascript' }); fs.createReadStream(f).pipe(r);
  }).listen(0, '127.0.0.1', () => res(s)); });
  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    await page.goto(`http://127.0.0.1:${srv.address().port}/${PAGE}`, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof CALCS !== 'undefined' && typeof renderCalc === 'function', null, { timeout: 30000 });
    return await page.evaluate(ids => {
      /* headerHTML(title, helpMsg) is how every calculator page states its help text; record it while each page renders */
      const orig = headerHTML; let last = null;
      eval('headerHTML = function(t, h){ last = h; return orig(t, h); }');
      const F = Object.assign({}, window.GH_LEGACY_FORMULAS || {}, window.GH_E1_FORMULAS || {}, window.GH_E101_FORMULAS || {});
      const out = {};
      for (const id of ids) {
        last = null;
        try { renderCalc(id, false); } catch (e) { }
        const f = F[id];
        out[id] = { help: last, formula: f ? { inputs: (f.labels || []).slice(), outputs: (f.outputs || [{ out: f.out, unit: f.unit }]).map(o => ({ name: o.out || null, unit: o.unit || '' })) } : null };
      }
      eval('headerHTML = orig');
      return out;
    }, freeIds);
  } finally { await browser.close(); srv.close(); }
}

function readPromos() {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(REPO, MODELS), 'utf8'), { window });
  return Object.fromEntries(window.GHP.models.PREMIUM_CALCULATORS.map(c => [c.id, c.promo || null]));
}

async function build() {
  const catalog = JSON.parse(fs.readFileSync(path.join(REPO, CATALOG), 'utf8'));
  const enrich = JSON.parse(fs.readFileSync(path.join(REPO, ENRICH), 'utf8'));
  const tools = catalog.tools;
  const byId = Object.fromEntries(tools.map(t => [t.id, t]));
  const free = tools.filter(t => t.tier === 'free' && t.kind === 'calculator').map(t => t.id);
  const pageData = await readPage(free);
  const promos = readPromos();
  const problems = [];

  /* ---- concepts (enrichment) ---- */
  const concepts = enrich.concepts.map(c => {
    const calcs = (c.calculators || []).filter((id, i, a) => a.indexOf(id) === i);
    calcs.forEach(id => { if (!byId[id]) problems.push(`${c.id}: calculator ${id} is not in the catalogue`); });
    const sec = new Map();
    calcs.filter(id => byId[id]).forEach(id => { const t = byId[id]; sec.set(t.lab + '|' + t.category, { lab: t.lab, category: t.category }); });
    return {
      id: c.id, type: c.type, term: c.term, letter: letterOf(c.term),
      aliases: (c.aliases || []).slice(), abbreviations: (c.abbreviations || []).slice(),
      definition: c.definition || null, distinctions: c.distinctions || null, units: (c.units || []).slice(),
      sections: [...sec.values()].sort((a, b) => a.lab.localeCompare(b.lab) || a.category.localeCompare(b.category)),
      calculators: calcs.filter(id => byId[id]),
      related: (c.related || []).map(r => ({ to: r.to, type: r.type, note: r.note || null, declared: true })),
      provenance: { definition: c.definition ? (c.definition_source || enrich.provenance_default.definition_source) : null, file: ENRICH },
      review: { status: c.review_status || 'draft-unreviewed', reviewer: c.reviewer || null, verified: c.verified || null },
      sources: (c.sources || []).slice(),
      incomplete: [!c.definition && 'definition', !(c.sources || []).length && 'sources', !(c.calculators || []).length && 'calculators'].filter(Boolean)
    };
  });
  const conceptById = Object.fromEntries(concepts.map(c => [c.id, c]));
  /* inverse relations, so a link can be followed from either end */
  for (const c of concepts) for (const r of c.related.filter(r => r.declared)) {
    const t = conceptById[r.to]; if (!t) continue;
    const inv = RELATION_INVERSE[r.type]; if (!inv) continue;
    if (!t.related.some(x => x.to === c.id && x.type === inv)) t.related.push({ to: c.id, type: inv, note: r.note, declared: false });
  }
  for (const c of concepts) c.related.sort((a, b) => a.type.localeCompare(b.type) || a.to.localeCompare(b.to));

  /* ---- abbreviations ---- */
  const abbrMap = new Map();
  for (const c of concepts) for (const a of c.abbreviations) { const k = a.trim(); if (!abbrMap.has(k)) abbrMap.set(k, []); abbrMap.get(k).push(c.id); }
  const ambiguous = new Map((enrich.ambiguous || []).map(a => [a.term.toLowerCase(), a.note]));
  const abbreviations = [...abbrMap.entries()].map(([a, ids]) => ({
    id: 'abbr.' + slug(a), type: 'abbreviation', term: a, letter: letterOf(a), expands_to: ids.slice().sort(),
    note: ids.length > 1 ? (ambiguous.get(a.toLowerCase()) || null) : null,
    review: { status: 'draft-unreviewed', reviewer: null, verified: null }, provenance: { file: ENRICH }
  }));

  /* ---- calculators (catalogue, one entry per canonical id) ---- */
  const conceptsOfCalc = {};
  for (const c of concepts) for (const id of c.calculators) (conceptsOfCalc[id] = conceptsOfCalc[id] || []).push(c.id);
  const calculators = tools.map(t => {
    const isFree = t.tier === 'free' && t.kind === 'calculator';
    const pd = isFree ? pageData[t.id] : null;
    const description = isFree ? (pd && pd.help ? text(pd.help) : null) : (promos[t.id] ? text(promos[t.id]) : null);
    const e = {
      id: 'calc.' + t.id, type: 'calculator', term: t.name, letter: letterOf(t.name), calculator: t.id,
      kind: t.kind, tier: t.tier, lab: t.lab, category: t.category,
      sections: [{ lab: t.lab, category: t.category }],
      former_ids: (t.aliases || []).slice(),
      description,
      formula: isFree && pd && pd.formula ? pd.formula : null,
      concepts: (conceptsOfCalc[t.id] || []).sort(),
      provenance: { identity: CATALOG, description: description ? (isFree ? 'engine help text (headerHTML)' : 'Premium promo (premium/models.js)') : null, formula: isFree && pd && pd.formula ? 'engine formula registry' : null },
      review: { status: 'generated', reviewer: null, verified: null },
      incomplete: [!description && 'description', isFree && !(pd && pd.formula) && 'formula'].filter(Boolean)
    };
    return e;
  });

  const entries = [...concepts, ...abbreviations, ...calculators]
    .sort((a, b) => sortKey(a.term).localeCompare(sortKey(b.term), 'en') || a.id.localeCompare(b.id));

  /* ---- facets: only labs and categories that exist in the catalogue ---- */
  const labs = {}, cats = {};
  for (const e of entries) for (const s of (e.sections || [])) {
    labs[s.lab] = (labs[s.lab] || 0) + 1;
    const k = s.category; cats[k] = cats[k] || { name: k, labs: new Set(), count: 0 }; cats[k].labs.add(s.lab); cats[k].count++;
  }
  const facets = {
    labs: Object.keys(labs).sort().map(k => ({ key: k, label: LAB_LABELS[k] || k, entries: labs[k], route: LAB_ROUTES.has(k) ? `index.html?lab=${k}` : null })),
    categories: Object.values(cats).map(c => ({ name: c.name, labs: [...c.labs].sort(), entries: c.count })).sort((a, b) => a.name.localeCompare(b.name))
  };
  const count = f => entries.filter(f).length;
  return {
    schema: 'gearhead-encyclopedia/1',
    description: 'Engineering Encyclopedia data (Issue #23): concepts, abbreviations and one entry per canonical tool of catalog/gearhead-catalog.json. Generated by catalog/build-encyclopedia.js; do not edit by hand.',
    generated_from: { catalog: { file: CATALOG, sha256: sha(CATALOG) }, enrichment: { file: ENRICH, sha256: sha(ENRICH) }, page: { file: PAGE, sha256: sha(PAGE) }, models: { file: MODELS, sha256: sha(MODELS) } },
    entry_types: ENTRY_TYPES,
    relation_types: Object.assign({}, enrich.relation_types, { 'prerequisite-for': 'inverse of prerequisite (added automatically)' }),
    ambiguous: enrich.ambiguous || [],
    sort_modes: {
      'az': { supported: true }, 'za': { supported: true },
      'most-used': { supported: false, reason: 'No usage measurement exists: the site has no analytics, and the "recent" list is kept only in each visitor’s own browser.' },
      'least-used': { supported: false, reason: 'No usage measurement exists (see most-used).' },
      'most-popular': { supported: false, reason: 'No defined, measured popularity metric exists.' },
      'recently-added': { supported: false, reason: 'The catalogue records no date a tool was added.' },
      'recently-updated': { supported: false, reason: 'The catalogue records no date a tool was last changed.' }
    },
    facets,
    counts: {
      entries: entries.length, concepts: concepts.length, abbreviations: abbreviations.length, calculators: calculators.length,
      calculators_free: count(e => e.type === 'calculator' && e.tier === 'free'), calculators_premium: count(e => e.type === 'calculator' && e.tier === 'premium'),
      concept_calculator_links: concepts.reduce((n, c) => n + c.calculators.length, 0),
      concept_relations_declared: concepts.reduce((n, c) => n + c.related.filter(r => r.declared).length, 0),
      concept_relations_total: concepts.reduce((n, c) => n + c.related.length, 0),
      calculators_linked_to_a_concept: count(e => e.type === 'calculator' && e.concepts.length),
      review_draft_unreviewed: count(e => e.review.status === 'draft-unreviewed'), review_generated: count(e => e.review.status === 'generated'), review_reviewed: count(e => e.review.status === 'reviewed'),
      incomplete_description: count(e => e.type === 'calculator' && e.incomplete.includes('description')),
      incomplete_formula: count(e => e.type === 'calculator' && e.incomplete.includes('formula')),
      concepts_without_sources: count(e => e.type === 'concept' && !e.sources.length)
    },
    problems,
    entries
  };
}

(async () => {
  const data = await build();
  const json = JSON.stringify(data, null, 1) + '\n';
  if (data.problems.length) { console.error('encyclopedia build: problems:\n  ' + data.problems.join('\n  ')); process.exit(1); }
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== json) { console.error('encyclopedia build --check: catalog/gearhead-encyclopedia.json is stale; run node catalog/build-encyclopedia.js'); process.exit(1); }
    console.log(`encyclopedia build --check: OK (${data.counts.entries} entries)`); return;
  }
  fs.writeFileSync(OUT, json);
  console.log(`encyclopedia written: ${path.relative(REPO, OUT)} — ${data.counts.entries} entries (${data.counts.concepts} concepts, ${data.counts.abbreviations} abbreviations, ${data.counts.calculators} tools)`);
})().catch(e => { console.error(e); process.exit(1); });
