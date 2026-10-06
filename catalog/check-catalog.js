#!/usr/bin/env node
/* Gearhead Labs canonical tool catalog — static validator (no browser, no network).
 * Checks catalog/gearhead-catalog.json against its sources and the product rules:
 *   - the Free baseline is exactly 606 public calculators (regression guard; F1.12.3 frozen baseline, F1.12.4 build)
 *   - Premium-only tools are exactly E01-E14 from premium/models.js and engineering-expansion-v1.js
 *   - aliases are never counted, never collide with a tool id, and resolve to a Free calculator that lists them
 *   - every "eligible" calculator has its production catalog row and formula fingerprint (0005 seed); every seed row is accounted for
 *   - the sources have not changed since the file was generated (else: node catalog/build-catalog.js)
 *   - no marine content; every field uses the documented vocabulary */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const REPO = path.resolve(__dirname, '..');
const FREE_BASELINE = 606, PREMIUM_ONLY = 14;
const cat = JSON.parse(fs.readFileSync(path.join(__dirname, 'gearhead-catalog.json'), 'utf8'));
const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, f))).digest('hex');

// sources unchanged
for (const [k, src] of Object.entries(cat.generated_from)) check(sha(src.file) === src.sha256, `${k} source ${src.file} changed since generation: run node catalog/build-catalog.js`);

// vocabulary
const VOCAB = { tier: ['free', 'premium'], kind: ['calculator', 'analyzer', 'workbench'], save: ['eligible', 'needs_decision', 'saveable'],
  vehicle_link: ['optional'], status: ['current', 'approved', 'future'], lab: ['gasoline', 'diesel', 'ev', 'towing', 'universal', 'engineering'] };
const ids = new Set();
for (const t of cat.tools) {
  check(typeof t.id === 'string' && /^[a-z0-9_]+$/.test(t.id), `bad id ${t.id}`);
  check(!ids.has(t.id), `duplicate id ${t.id}`); ids.add(t.id);
  check(typeof t.name === 'string' && t.name.trim().length > 0 && typeof t.category === 'string' && t.category.length > 0, `${t.id}: name/category`);
  for (const [k, allowed] of Object.entries(VOCAB)) check(allowed.includes(t[k]), `${t.id}: ${k}=${t[k]}`);
  check(Array.isArray(t.aliases), `${t.id}: aliases`);
  check(t.tier === 'free' ? t.kind === 'calculator' && t.lab !== 'engineering' : t.lab === 'engineering' && t.kind !== 'calculator', `${t.id}: tier/kind/lab mismatch`);
  check((t.save === 'eligible') === !!t.formula, `${t.id}: save=eligible exactly when a formula fingerprint exists`);
  check(!/marine|propeller|outboard|cavitation|\bboat\b/i.test(`${t.id} ${t.name} ${t.category}`), `${t.id}: marine content`);
}

// counts
const free = cat.tools.filter(t => t.tier === 'free'), prem = cat.tools.filter(t => t.tier === 'premium');
check(free.length === FREE_BASELINE, `Free public calculators ${free.length} != ${FREE_BASELINE}`);
check(prem.length === PREMIUM_ONLY, `Premium-only tools ${prem.length} != ${PREMIUM_ONLY}`);
const c = cat.counts;
check(c.free_public_calculators === free.length && c.premium_only_tools === prem.length && c.premium_total_access === cat.tools.length, 'counts block');
check(c.aliases_not_counted === cat.aliases.length, 'alias count');
check(Object.values(c.free_by_lab).reduce((a, b) => a + b, 0) === free.length, 'lab totals');
check(c.save.eligible + c.save.needs_decision + c.save.saveable === cat.tools.length, 'save totals');
check(c.approved_future_tools === cat.tools.filter(t => t.status !== 'current').length, 'future tool count');

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
check(free.filter(t => t.save === 'needs_decision').length === FREE_BASELINE - selfRows.length, 'needs_decision = public calculators without a catalog row');

// Premium-only tools = the approved Engineering Lab
const window = {}; vm.runInNewContext(fs.readFileSync(path.join(REPO, 'premium/models.js'), 'utf8'), { window });
const E = window.GHP.models.ENGINEERING_CATALOG;
check(JSON.stringify(prem.map(t => [t.id, t.code, t.name, t.category]).sort()) === JSON.stringify(E.map(a => [a.id, a.code, a.name, a.category]).sort()), 'Premium tools differ from the Engineering Lab catalog in premium/models.js');
const moduleTools = [...fs.readFileSync(path.join(REPO, 'engineering-expansion-v1.js'), 'utf8').matchAll(/add\('[^']+','([a-z0-9_]+)','([^']+)'/g)].map(m => [m[1], m[2]]);
check(JSON.stringify(moduleTools.sort()) === JSON.stringify(prem.map(t => [t.id, t.name]).sort()), 'Premium tools differ from engineering-expansion-v1.js');

if (errors.length) { console.error('catalog check FAILED:\n  - ' + errors.join('\n  - ')); process.exit(1); }
console.log(`catalog check: OK — ${free.length} Free public calculators, ${prem.length} Premium-only tools, ${cat.tools.length} in Premium, ${cat.aliases.length} aliases (not counted); save: ${c.save.eligible} eligible, ${c.save.needs_decision} need a decision, ${c.save.saveable} saveable`);
