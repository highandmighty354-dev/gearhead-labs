#!/usr/bin/env node
/* Gearhead Labs Engineering Encyclopedia — validator (Issue #23). No browser, no network.
 *
 * Checks catalog/gearhead-encyclopedia.json against its sources and its own rules:
 *   - freshness: the recorded sha256 of the catalogue, the enrichment file, the engine page and premium/models.js match the files
 *   - identity: one calculator entry per canonical catalogue tool (no duplicates, none missing), with the catalogue's name, lab,
 *     category and tier; entry ids unique; entry types and relation types from the declared lists
 *   - references: every calculator a concept names exists; every related / expands_to target exists; sections are existing
 *     (lab, category) pairs of the catalogue; lab routes only for labs the app routes
 *   - relations: no self links, no contradictory pair, every not-equivalent link explains itself, inverses present
 *   - terminology: a term, alias or abbreviation shared by two or more concepts must be declared ambiguous, and every declared
 *     ambiguity must really be shared
 *   - Premium boundary: a Premium tool's entry carries no formula and no help text (only the public promo)
 *   - honesty: review statuses from the allowed set, "reviewed" only with a named reviewer and date; unsupported sort modes say
 *     why; no usage, popularity or date fields on entries while their sort mode is unsupported
 *   - order: entries are in deterministic A–Z order (the key the page uses) and each entry's letter matches its term
 * Usage: node catalog/check-encyclopedia.js   (exit 0 = OK) */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const REPO = path.resolve(__dirname, '..');
const FILE = process.env.GH_ENCYCLOPEDIA ? path.resolve(process.env.GH_ENCYCLOPEDIA) : path.join(__dirname, 'gearhead-encyclopedia.json');
const errors = [];
const fail = (m) => errors.push(m);
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, f))).digest('hex');
const sortKey = s => String(s).normalize('NFKD').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const norm = s => sortKey(s);
const letterOf = s => { const c = sortKey(s).charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };

const D = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(REPO, 'catalog/gearhead-catalog.json'), 'utf8'));
const tools = Object.fromEntries(catalog.tools.map(t => [t.id, t]));
const sectionsInCatalog = new Set(catalog.tools.map(t => t.lab + '|' + t.category));
const ROUTED_LABS = new Set(['gasoline', 'diesel', 'ev', 'towing', 'universal']);
const REVIEW = new Set(['draft-unreviewed', 'generated', 'reviewed']);
const METRIC_FIELDS = { 'most-used': ['uses', 'use_count', 'views'], 'least-used': ['uses', 'use_count', 'views'], 'most-popular': ['popularity', 'score', 'rank'], 'recently-added': ['added', 'created'], 'recently-updated': ['updated', 'modified'] };

if (D.schema !== 'gearhead-encyclopedia/1') fail(`schema ${D.schema}`);
for (const [k, v] of Object.entries(D.generated_from || {})) if (!fs.existsSync(path.join(REPO, v.file)) || sha(v.file) !== v.sha256) fail(`stale: ${v.file} changed since the encyclopedia was generated (run node catalog/build-encyclopedia.js)`);
if (Array.isArray(D.problems) && D.problems.length) fail('generator problems: ' + D.problems.join('; '));

const E = D.entries || [];
const byId = new Map();
for (const e of E) {
  if (byId.has(e.id)) fail(`duplicate entry id ${e.id}`); byId.set(e.id, e);
  if (!D.entry_types.includes(e.type)) fail(`${e.id}: entry type ${e.type} not allowed`);
  const prefix = { concept: 'term.', abbreviation: 'abbr.', calculator: 'calc.' }[e.type];
  if (prefix && !e.id.startsWith(prefix)) fail(`${e.id}: id does not start with ${prefix}`);
  if (!e.term || !String(e.term).trim()) fail(`${e.id}: empty term`);
  if (e.letter !== letterOf(e.term)) fail(`${e.id}: letter ${e.letter} but term starts with ${letterOf(e.term)}`);
  if (!e.review || !REVIEW.has(e.review.status)) fail(`${e.id}: review status ${e.review && e.review.status}`);
  if (e.review && e.review.status === 'reviewed' && !(e.review.reviewer && e.review.verified)) fail(`${e.id}: "reviewed" without a reviewer and date`);
  for (const [mode, fields] of Object.entries(METRIC_FIELDS)) if (!(D.sort_modes[mode] || {}).supported) for (const f of fields) if (f in e) fail(`${e.id}: has ${f} while ${mode} sorting is unsupported`);
  for (const s of (e.sections || [])) if (!sectionsInCatalog.has(s.lab + '|' + s.category)) fail(`${e.id}: section ${s.lab} / ${s.category} is not in the catalogue`);
}

/* identity: one calculator entry per canonical tool */
const calcEntries = E.filter(e => e.type === 'calculator');
const seenCalc = new Map();
for (const e of calcEntries) {
  const t = tools[e.calculator];
  if (!t) { fail(`${e.id}: ${e.calculator} is not a canonical catalogue id`); continue; }
  if (seenCalc.has(e.calculator)) fail(`${e.calculator}: two entries (${seenCalc.get(e.calculator)}, ${e.id})`); seenCalc.set(e.calculator, e.id);
  if (e.id !== 'calc.' + t.id || e.term !== t.name || e.lab !== t.lab || e.category !== t.category || e.tier !== t.tier || e.kind !== t.kind) fail(`${e.id}: differs from the catalogue row`);
  if (JSON.stringify(e.former_ids) !== JSON.stringify(t.aliases || [])) fail(`${e.id}: former ids differ from the catalogue aliases`);
  if (t.tier === 'premium' && (e.formula || (e.provenance && /help text/.test(e.provenance.description || '')))) fail(`${e.id}: Premium tool exposes formula or help text`);
  for (const c of e.concepts) { const ce = byId.get(c); if (!ce || ce.type !== 'concept' || !ce.calculators.includes(e.calculator)) fail(`${e.id}: concept link ${c} does not resolve both ways`); }
}
for (const id of Object.keys(tools)) if (!seenCalc.has(id)) fail(`catalogue tool ${id} has no encyclopedia entry`);
const cat = catalog.tools.filter(t => t.kind === 'calculator' || true).length;
if (calcEntries.length !== cat) fail(`calculator entries ${calcEntries.length} vs catalogue tools ${cat}`);

/* concepts and relations */
const concepts = E.filter(e => e.type === 'concept');
const relTypes = new Set(Object.keys(D.relation_types));
const INV = { broader: 'narrower', narrower: 'broader', prerequisite: 'prerequisite-for', 'prerequisite-for': 'prerequisite', related: 'related', 'not-equivalent': 'not-equivalent' };
for (const c of concepts) {
  if (!c.definition && !(c.incomplete || []).includes('definition')) fail(`${c.id}: no definition and not flagged incomplete`);
  for (const id of c.calculators) if (!tools[id]) fail(`${c.id}: calculator ${id} does not exist`);
  const want = new Set(c.calculators.map(id => tools[id] && tools[id].lab + '|' + tools[id].category));
  const got = new Set((c.sections || []).map(s => s.lab + '|' + s.category));
  if ([...want].some(k => !got.has(k)) || [...got].some(k => !want.has(k))) fail(`${c.id}: sections are not exactly those of its calculators`);
  const pairs = new Map();
  for (const r of c.related) {
    if (!relTypes.has(r.type)) fail(`${c.id}: relation type ${r.type} not allowed`);
    const t = byId.get(r.to);
    if (!t || t.type !== 'concept') fail(`${c.id}: related ${r.to} is not a concept entry`);
    if (r.to === c.id) fail(`${c.id}: relates to itself`);
    if (r.type === 'not-equivalent' && !r.note) fail(`${c.id}: not-equivalent link to ${r.to} has no note`);
    if (pairs.has(r.to)) fail(`${c.id}: two relations to ${r.to} (${pairs.get(r.to)} and ${r.type}); keep one`);
    pairs.set(r.to, r.type);
    if (t && t.type === 'concept' && !t.related.some(x => x.to === c.id && x.type === INV[r.type])) fail(`${c.id}: no inverse ${INV[r.type]} on ${r.to}`);
  }
  for (const s of (c.sources || [])) if (!s || !s.title || !s.url) fail(`${c.id}: a source without title and url`);
}

/* terminology collisions */
const holders = new Map();
const hold = (k, id) => { const n = norm(k); if (!n) return; if (!holders.has(n)) holders.set(n, new Set()); holders.get(n).add(id); };
for (const c of concepts) { hold(c.term, c.id); c.aliases.forEach(a => hold(a, c.id)); c.abbreviations.forEach(a => hold(a, c.id)); }
const declared = new Set((D.ambiguous || []).map(a => norm(a.term)));
for (const [k, ids] of holders) if (ids.size > 1 && !declared.has(k)) fail(`"${k}" is used by ${[...ids].join(', ')} but is not declared ambiguous`);
for (const k of declared) if (!holders.has(k) || holders.get(k).size < 2) fail(`"${k}" is declared ambiguous but only one concept uses it`);
for (const a of (D.ambiguous || [])) if (!a.note) fail(`ambiguous "${a.term}" has no note`);
for (const a of E.filter(e => e.type === 'abbreviation')) {
  for (const t of a.expands_to) if (!byId.has(t) || byId.get(t).type !== 'concept') fail(`${a.id}: expands to missing ${t}`);
  if (a.expands_to.length > 1 && !a.note) fail(`${a.id}: several meanings and no note`);
}

/* sort modes and facets */
for (const [m, v] of Object.entries(D.sort_modes)) if (!v.supported && !v.reason) fail(`sort mode ${m}: unsupported without a reason`);
if (!D.sort_modes.az.supported || !D.sort_modes.za.supported) fail('A–Z and Z–A must be supported');
for (const l of D.facets.labs) { if (l.route && (!ROUTED_LABS.has(l.key) || l.route !== `index.html?lab=${l.key}`)) fail(`lab ${l.key}: route ${l.route}`); }
for (const c of D.facets.categories) if (!catalog.tools.some(t => t.category === c.name)) fail(`category ${c.name} not in the catalogue`);

/* deterministic A–Z order */
for (let i = 1; i < E.length; i++) {
  const a = E[i - 1], b = E[i];
  const cmp = sortKey(a.term).localeCompare(sortKey(b.term), 'en') || a.id.localeCompare(b.id);
  if (cmp > 0) { fail(`order: ${a.id} before ${b.id}`); break; }
}

if (errors.length) { console.log(`encyclopedia check: ${errors.length} problem(s)`); errors.slice(0, 40).forEach(e => console.log('  ' + e)); process.exit(1); }
console.log(`encyclopedia check: OK — ${E.length} entries (${concepts.length} concepts, ${E.filter(e => e.type === 'abbreviation').length} abbreviations, ${calcEntries.length} tools = catalogue), ${D.counts.concept_relations_total} relations, ${holders.size} terms/aliases, ${declared.size} declared ambiguous`);
