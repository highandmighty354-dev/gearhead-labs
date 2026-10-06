#!/usr/bin/env node
/* Gearhead Labs canonical tool catalog — static validator (no browser, no network).
 * Checks catalog/gearhead-catalog.json against its sources and the product rules:
 *   - the Free baseline is exactly 606 public calculators (regression guard; F1.12.3 frozen baseline, F1.12.4 build)
 *   - Engineering-tier tools are exactly E01-E14 from premium/models.js and engineering-expansion-v1.js
 *   - the Premium tier is exactly the owner's 147-item roadmap workbook pool, every candidate reconciled, none called
 *     IMPLEMENTED without an implementation, no Do Not Add item re-added, no Free/Engineering name reused
 *   - aliases are never counted, never collide with a tool id, and resolve to a Free calculator that lists them
 *   - every "eligible" calculator has its production catalog row and formula fingerprint (0005 seed); every seed row is accounted for
 *   - the sources have not changed since the file was generated (else: node catalog/build-catalog.js)
 *   - no marine content; every field uses the documented vocabulary */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const REPO = path.resolve(__dirname, '..');
const FREE_BASELINE = 606, ENGINEERING = 14, PREMIUM_ROADMAP = 147, DO_NOT_ADD = 10;
const cat = JSON.parse(fs.readFileSync(path.join(__dirname, 'gearhead-catalog.json'), 'utf8'));
const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, f))).digest('hex');

// sources unchanged
for (const [k, src] of Object.entries(cat.generated_from)) check(sha(src.file) === src.sha256, `${k} source ${src.file} changed since generation: run node catalog/build-catalog.js`);

// vocabulary
const VOCAB = { tier: ['free', 'engineering', 'premium'], access: ['public', 'premium'], kind: ['calculator', 'analyzer', 'workbench'],
  save: ['eligible', 'excluded', 'saveable', 'not_yet_saveable'], vehicle_link: ['optional', 'tbd'],
  status: ['IMPLEMENTED', 'PARTIALLY IMPLEMENTED', 'PLANNED', 'BLOCKED', 'DUPLICATE'],
  lab: ['gasoline', 'diesel', 'ev', 'towing', 'universal', 'engineering', 'premium'] };
const FREE_LABS = ['gasoline', 'diesel', 'ev', 'towing', 'universal'];
const ids = new Set();
for (const t of cat.tools) {
  check(typeof t.id === 'string' && /^[a-z0-9_]+$/.test(t.id), `bad id ${t.id}`);
  check(!ids.has(t.id), `duplicate id ${t.id}`); ids.add(t.id);
  check(typeof t.name === 'string' && t.name.trim().length > 0 && typeof t.category === 'string' && t.category.length > 0, `${t.id}: name/category`);
  for (const [k, allowed] of Object.entries(VOCAB)) check(allowed.includes(t[k]), `${t.id}: ${k}=${t[k]}`);
  check(Array.isArray(t.aliases), `${t.id}: aliases`);
  if (t.tier === 'free') check(t.kind === 'calculator' && FREE_LABS.includes(t.lab) && t.access === 'public' && t.status === 'IMPLEMENTED' && t.implementation, `${t.id}: Free tier fields`);
  if (t.tier === 'engineering') check(t.lab === 'engineering' && t.kind !== 'calculator' && t.access === 'premium' && t.feature === 'engineering_lab' && t.status === 'IMPLEMENTED' && t.save === 'saveable', `${t.id}: Engineering tier fields`);
  if (t.tier === 'premium') {
    check(t.lab === 'premium' && t.access === 'premium' && t.source && t.source.file && t.source.row, `${t.id}: Premium tier fields`);
    check(t.id.startsWith('p_'), `${t.id}: Premium roadmap ids start with p_`);
    // honesty: only a real implementation may be called IMPLEMENTED, and nothing else may point at one
    check((t.status === 'IMPLEMENTED') === !!t.implementation, `${t.id}: status IMPLEMENTED exactly when an implementation is referenced`);
    check(t.save === 'not_yet_saveable', `${t.id}: Premium calculators cannot be saved until their catalog rows exist`);
  }
  if (t.tier !== 'premium') check((t.save === 'eligible') === !!t.formula, `${t.id}: save=eligible exactly when a formula fingerprint exists`);
  check(!/marine|propeller|outboard|cavitation margin|\bboat\b|watercraft|jet ?ski/i.test(`${t.id} ${t.name} ${t.category}`), `${t.id}: marine content`);
}

// counts and tiers
const free = cat.tools.filter(t => t.tier === 'free'), engr = cat.tools.filter(t => t.tier === 'engineering'), prem = cat.tools.filter(t => t.tier === 'premium');
check(free.length === FREE_BASELINE, `Free public calculators ${free.length} != ${FREE_BASELINE}`);
check(engr.length === ENGINEERING, `Engineering analyzers ${engr.length} != ${ENGINEERING}`);
check(prem.length === PREMIUM_ROADMAP, `Premium roadmap candidates ${prem.length} != ${PREMIUM_ROADMAP}`);
const c = cat.counts;
check(c.free_public_calculators === free.length && c.engineering_analyzers === engr.length && c.premium_roadmap_candidates === prem.length, 'counts block');
check(c.implemented_premium_calculators === prem.filter(t => t.status === 'IMPLEMENTED').length, 'implemented Premium count');
check(c.working_tools_with_premium === cat.tools.filter(t => t.status === 'IMPLEMENTED').length, 'working tools count');
check(c.aliases_not_counted === cat.aliases.length, 'alias count');
check(Object.values(c.free_by_lab).reduce((a, b) => a + b, 0) === free.length, 'lab totals');
check(c.save.eligible + c.save.excluded + c.save.saveable + c.save.not_yet_saveable === cat.tools.length, 'save totals');

// Premium roadmap = the owner's workbook, exactly
const roadmap = JSON.parse(fs.readFileSync(path.join(REPO, 'catalog/premium-roadmap.json'), 'utf8'));
const recon = JSON.parse(fs.readFileSync(path.join(REPO, 'catalog/premium-reconciliation.json'), 'utf8'));
check(sha(roadmap.source.file) === roadmap.source.sha256, 'workbook changed since extraction: run python3 catalog/extract-roadmap.py');
const ws = roadmap.workbook_summary, rc = roadmap.counts;
check(ws['Working expansion pool'] === PREMIUM_ROADMAP && rc.working_pool === PREMIUM_ROADMAP, 'workbook working pool != 147');
check(ws['Historical roadmap recovered'] === rc.historical_recovered && ws['Historical roadmap retained after duplicate review'] === rc.historical_retained
  && ws['Additional high-confidence candidates recovered'] === rc.new_research_additions, 'workbook summary differs from its rows');
check(rc.historical_recovered === rc.historical_retained + rc.do_not_add && rc.working_pool === rc.historical_retained + rc.new_research_additions, 'workbook arithmetic');
check(rc.do_not_add === DO_NOT_ADD && cat.do_not_add.length === DO_NOT_ADD, `Do Not Add items != ${DO_NOT_ADD}`);
check(JSON.stringify(prem.map(t => t.id).sort()) === JSON.stringify(roadmap.candidates.map(x => x.id).sort()), 'Premium tier != workbook working pool');
const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const dnaNames = new Set(cat.do_not_add.map(d => norm(d.name)));
for (const t of prem) check(!dnaNames.has(norm(t.name)), `${t.id}: a Do Not Add item was re-added`);
for (const d of cat.do_not_add) check(d.status === 'DUPLICATE / EXCLUDED' && !ids.has(d.id), `${d.id}: Do Not Add must stay excluded`);
const nonPremNames = new Set([...free, ...engr].map(t => norm(t.name)));
for (const t of prem) check(!nonPremNames.has(norm(t.name)), `${t.id}: Premium candidate has the same name as a Free/Engineering tool`);
// reconciliation: every candidate reviewed; every reference real and in the stated layer
check(recon.items.length === PREMIUM_ROADMAP, 'reconciliation does not cover every candidate');
const byId = Object.fromEntries(cat.tools.map(t => [t.id, t]));
for (const i of recon.items) {
  const t = byId[i.id];
  check(t && t.status === i.status, `${i.id}: reconciliation status not reflected in the catalog`);
  for (const e of i.existing) check(byId[e.id] && byId[e.id].tier === (e.layer === 'free' ? 'free' : 'engineering'), `${i.id}: existing reference ${e.id} is not a ${e.layer} tool`);
  check((i.status === 'DUPLICATE') === i.existing.some(e => e.relation === 'duplicate'), `${i.id}: DUPLICATE status without a duplicate reference`);
  for (const o of i.internal_overlaps) check(byId[o.with] && byId[o.with].tier === 'premium', `${i.id}: internal overlap ${o.with} is not a roadmap candidate`);
}
for (const id of recon.first_batch) { const i = recon.items.find(x => x.id === id);
  check(i && i.status === 'PLANNED' && !i.existing.some(e => e.relation !== 'related') && !i.internal_overlaps.length, `${id}: first-batch item must be new, with no overlap`); }

// aliases
for (const a of cat.aliases) {
  check(!ids.has(a.id), `alias ${a.id} collides with a tool id`);
  const target = cat.tools.find(t => t.id === a.canonical);
  check(target && target.tier === 'free' && target.aliases.includes(a.id), `alias ${a.id} -> ${a.canonical} does not resolve to a Free calculator that lists it`);
}
check(cat.tools.reduce((n, t) => n + t.aliases.length, 0) === cat.aliases.length, 'every listed alias is in the alias table');

// production seed (0005, byte-identical to the provisioned database)
const seed = fs.readFileSync(path.join(REPO, 'supabase/migrations/0005_reference_seed.sql'), 'utf8');
const rows = [...seed.matchAll(/^\s*\('([a-z0-9_]+)', '([a-z0-9_]+)', (true|false)\)/gm)].map(m => ({ id: m[1], canonical: m[2], proven: m[3] === 'true' }));
const fvs = Object.fromEntries([...seed.matchAll(/^\s*\('([a-z0-9_]+)', '(fv1-[0-9a-f]{8})', '[0-9.]+', '([A-Z0-9_]+)'/gm)].map(m => [m[1], { version: m[2], registry: m[3] }]));
const selfRows = rows.filter(r => r.id === r.canonical), aliasRows = rows.filter(r => r.id !== r.canonical);
const eligible = free.filter(t => t.save === 'eligible');
check(rows.length === 583 && selfRows.length === 577 && aliasRows.length === 6, `seed shape ${rows.length}/${selfRows.length}/${aliasRows.length}`);
check(JSON.stringify(eligible.map(t => t.id).sort()) === JSON.stringify(selfRows.map(r => r.id).sort()), 'eligible calculators != the catalog rows of the production seed');
for (const t of eligible) {
  const f = fvs[t.id], r = selfRows.find(x => x.id === t.id);
  check(f && t.formula.version === f.version && t.formula.registry === f.registry, `${t.id}: formula fingerprint differs from the seed`);
  check(r && t.formula.engine_proven === r.proven, `${t.id}: engine_proven differs from the seed`);
}
check(JSON.stringify(aliasRows.map(r => [r.id, r.canonical]).sort()) === JSON.stringify(cat.aliases.map(a => [a.id, a.canonical]).sort()), 'aliases differ from the seed');
check(free.filter(t => t.save === 'excluded').length === FREE_BASELINE - selfRows.length, 'excluded = public calculators without a catalog row');
for (const t of free.filter(t => t.save === 'excluded')) check(!rows.some(r => r.id === t.id || r.canonical === t.id), `${t.id}: excluded from saving but present in the production calculator catalog`);

// Premium-only tools = the approved Engineering Lab
const window = {}; vm.runInNewContext(fs.readFileSync(path.join(REPO, 'premium/models.js'), 'utf8'), { window });
const E = window.GHP.models.ENGINEERING_CATALOG;
check(JSON.stringify(engr.map(t => [t.id, t.code, t.name, t.category]).sort()) === JSON.stringify(E.map(a => [a.id, a.code, a.name, a.category]).sort()), 'Premium tools differ from the Engineering Lab catalog in premium/models.js');
const moduleTools = [...fs.readFileSync(path.join(REPO, 'engineering-expansion-v1.js'), 'utf8').matchAll(/add\('[^']+','([a-z0-9_]+)','([^']+)'/g)].map(m => [m[1], m[2]]);
check(JSON.stringify(moduleTools.sort()) === JSON.stringify(engr.map(t => [t.id, t.name]).sort()), 'Premium tools differ from engineering-expansion-v1.js');

if (errors.length) { console.error('catalog check FAILED:\n  - ' + errors.join('\n  - ')); process.exit(1); }
console.log(`catalog check: OK — FREE ${free.length} public calculators · ENGINEERING ${engr.length} analyzers · PREMIUM roadmap ${prem.length} candidates (${c.implemented_premium_calculators} implemented; ${Object.entries(c.premium_roadmap_by_status).map(([k, v]) => v + ' ' + k).join(', ')}) · Do Not Add ${cat.do_not_add.length} excluded · ${cat.aliases.length} aliases (not counted)`);
