#!/usr/bin/env node
/* Gearhead Labs canonical tool catalog — static validator (no browser, no network).
 * Checks catalog/gearhead-catalog.json against its sources and the product rules:
 *   - calculator-kind tools total exactly 606 (regression guard; F1.12.3 frozen baseline, F1.12.4 build), split into
 *     the Free baseline (585) and the 21 calculators approved for Free -> Premium migration (2026-10-06;
 *     premium/models.js PREMIUM_CALCULATORS is authoritative for which ids and how many)
 *   - every migrated calculator names a real Free companion and carries real (non-placeholder) promotion copy
 *   - the Engineering Lab is exactly E01-E14 from premium/models.js and engineering-expansion-v1.js
 *   - aliases are never counted, never collide with a tool id, and resolve to a Free calculator that lists them
 *   - every "eligible" calculator has its production catalog row and formula fingerprint (0005 seed); every seed row is accounted for
 *   - the sources have not changed since the file was generated (else: node catalog/build-catalog.js)
 *   - no marine content; every field uses the documented vocabulary */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const REPO = path.resolve(__dirname, '..');
const FREE_BASELINE = 585, ENGINEERING_LAB_ONLY = 14;
const cat = JSON.parse(fs.readFileSync(path.join(__dirname, 'gearhead-catalog.json'), 'utf8'));
const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, f))).digest('hex');

// sources unchanged
for (const [k, src] of Object.entries(cat.generated_from)) check(sha(src.file) === src.sha256, `${k} source ${src.file} changed since generation: run node catalog/build-catalog.js`);

// the migration's single source of truth (premium/models.js PREMIUM_CALCULATORS) -- never hand-counted here
const modelsWindow = {}; vm.runInNewContext(fs.readFileSync(path.join(REPO, 'premium/models.js'), 'utf8'), { window: modelsWindow });
const MIGRATED = modelsWindow.GHP.models.PREMIUM_CALCULATORS;
const MIGRATED_IDS = new Set(MIGRATED.map(m => m.id));
const MIGRATED_COUNT = MIGRATED.length;

// vocabulary
const VOCAB = { tier: ['free', 'premium'], kind: ['calculator', 'analyzer', 'workbench'], save: ['eligible', 'excluded', 'saveable'],
  vehicle_link: ['optional'], status: ['current', 'approved', 'future'], lab: ['gasoline', 'diesel', 'ev', 'towing', 'universal', 'engineering'] };
const ids = new Set();
for (const t of cat.tools) {
  check(typeof t.id === 'string' && /^[a-z0-9_]+$/.test(t.id), `bad id ${t.id}`);
  check(!ids.has(t.id), `duplicate id ${t.id}`); ids.add(t.id);
  check(typeof t.name === 'string' && t.name.trim().length > 0 && typeof t.category === 'string' && t.category.length > 0, `${t.id}: name/category`);
  for (const [k, allowed] of Object.entries(VOCAB)) check(allowed.includes(t[k]), `${t.id}: ${k}=${t[k]}`);
  check(Array.isArray(t.aliases), `${t.id}: aliases`);
  // Free: always a calculator, never tagged engineering. Premium: either the Engineering Lab (analyzer/workbench,
  // lab=engineering) or one of the owner-approved migrated calculators (kind=calculator, lab unchanged from Free,
  // id in PREMIUM_CALCULATORS) -- a tier=premium calculator NOT on the approved list is a bug, not a feature.
  check(
    t.tier === 'free' ? (t.kind === 'calculator' && t.lab !== 'engineering')
      : t.lab === 'engineering' ? (t.kind !== 'calculator')
        : (t.kind === 'calculator' && t.lab !== 'engineering' && MIGRATED_IDS.has(t.id)),
    `${t.id}: tier/kind/lab mismatch`
  );
  if (t.tier === 'premium' && t.kind === 'calculator') {
    const m = MIGRATED.find(x => x.id === t.id);
    check(!!m, `${t.id}: premium calculator is not in the approved migration list (premium/models.js PREMIUM_CALCULATORS)`);
    check(t.free_companion === (m && m.free_companion), `${t.id}: free_companion does not match the approved migration data`);
    check(typeof t.promotion === 'string' && t.promotion.trim().length > 20, `${t.id}: promotion copy is missing or too short`);
    check(!/pay to use this calculator/i.test(t.promotion || ''), `${t.id}: promotion copy still uses generic placeholder language`);
    const companion = cat.tools.find(x => x.id === t.free_companion);
    check(!!companion && companion.tier === 'free', `${t.id}: free_companion "${t.free_companion}" does not resolve to a Free calculator`);
  } else {
    check(!('free_companion' in t) && !('promotion' in t), `${t.id}: non-migrated tool unexpectedly carries migration fields`);
  }
  check((t.save === 'eligible') === !!t.formula, `${t.id}: save=eligible exactly when a formula fingerprint exists`);
  check(!/marine|propeller|outboard|cavitation|\bboat\b/i.test(`${t.id} ${t.name} ${t.category}`), `${t.id}: marine content`);
}
for (const id of MIGRATED_IDS) check(ids.has(id) && cat.tools.find(t => t.id === id).tier === 'premium', `${id}: in PREMIUM_CALCULATORS but missing, or not tier=premium, in the catalog`);

// counts
const free = cat.tools.filter(t => t.tier === 'free'), prem = cat.tools.filter(t => t.tier === 'premium');
const migratedCalcs = prem.filter(t => t.kind === 'calculator'), engineeringTools = prem.filter(t => t.lab === 'engineering');
const calcTools = cat.tools.filter(t => t.kind === 'calculator');   // Free + migrated Premium; unaffected by tier
check(free.length === FREE_BASELINE, `Free public calculators ${free.length} != ${FREE_BASELINE}`);
check(migratedCalcs.length === MIGRATED_COUNT, `Migrated Premium calculators ${migratedCalcs.length} != ${MIGRATED_COUNT}`);
check(engineeringTools.length === ENGINEERING_LAB_ONLY, `Engineering Lab tools ${engineeringTools.length} != ${ENGINEERING_LAB_ONLY}`);
check(prem.length === MIGRATED_COUNT + ENGINEERING_LAB_ONLY, `Premium-only tools ${prem.length} != ${MIGRATED_COUNT + ENGINEERING_LAB_ONLY}`);
check(calcTools.length === FREE_BASELINE + MIGRATED_COUNT, `calculator-kind tools ${calcTools.length} != ${FREE_BASELINE + MIGRATED_COUNT}`);
const c = cat.counts;
check(c.free_public_calculators === free.length && c.migrated_premium_calculators === migratedCalcs.length
  && c.engineering_lab_tools === engineeringTools.length && c.premium_only_tools === prem.length
  && c.premium_total_access === cat.tools.length, 'counts block');
check(c.aliases_not_counted === cat.aliases.length, 'alias count');
check(Object.values(c.free_by_lab).reduce((a, b) => a + b, 0) === free.length, 'lab totals');
check(c.save.eligible + c.save.excluded + c.save.saveable === cat.tools.length, 'save totals');
check(c.premium_expansion_validated === engineeringTools.length && cat.premium_expansion.validated === c.premium_expansion_validated, 'premium expansion count');
check(c.approved_future_tools === cat.tools.filter(t => t.status !== 'current').length, 'future tool count');
check(cat.premium_migration.migrated === migratedCalcs.length
  && JSON.stringify(cat.premium_migration.tools.map(t => t.id).sort()) === JSON.stringify(migratedCalcs.map(t => t.id).sort()), 'premium_migration block');

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
// The production seed describes calculator-kind tools only, and does not know about Premium tiering: a migrated
// calculator keeps the exact seed row it always had. So this compares against calcTools (Free + migrated Premium),
// never against free alone -- scoping it to `free` would make every migrated-but-eligible id look "missing".
const eligible = calcTools.filter(t => t.save === 'eligible');
check(rows.length === 583 && selfRows.length === 577 && aliasRows.length === 6, `seed shape ${rows.length}/${selfRows.length}/${aliasRows.length}`);
check(JSON.stringify(eligible.map(t => t.id).sort()) === JSON.stringify(selfRows.map(r => r.id).sort()), 'eligible calculators != the catalog rows of the production seed');
for (const t of eligible) {
  const f = fvs[t.id], r = selfRows.find(x => x.id === t.id);
  check(f && t.formula.version === f.version && t.formula.registry === f.registry, `${t.id}: formula fingerprint differs from the seed`);
  check(r && t.formula.engine_proven === r.proven, `${t.id}: engine_proven differs from the seed`);
}
check(JSON.stringify(aliasRows.map(r => [r.id, r.canonical]).sort()) === JSON.stringify(cat.aliases.map(a => [a.id, a.canonical]).sort()), 'aliases differ from the seed');
check(calcTools.filter(t => t.save === 'excluded').length === calcTools.length - selfRows.length, 'excluded = calculators without a catalog row');
for (const t of calcTools.filter(t => t.save === 'excluded')) check(!rows.some(r => r.id === t.id || r.canonical === t.id), `${t.id}: excluded from saving but present in the production calculator catalog`);

// Engineering Lab = exactly E01-E14 (scoped to lab=engineering: `prem` also includes the 21 migrated calculators now)
const E = modelsWindow.GHP.models.ENGINEERING_CATALOG;
check(JSON.stringify(engineeringTools.map(t => [t.id, t.code, t.name, t.category]).sort()) === JSON.stringify(E.map(a => [a.id, a.code, a.name, a.category]).sort()), 'Engineering Lab tools differ from the catalog in premium/models.js');
const moduleTools = [...fs.readFileSync(path.join(REPO, 'engineering-expansion-v1.js'), 'utf8').matchAll(/add\('[^']+','([a-z0-9_]+)','([^']+)'/g)].map(m => [m[1], m[2]]);
check(JSON.stringify(moduleTools.sort()) === JSON.stringify(engineeringTools.map(t => [t.id, t.name]).sort()), 'Engineering Lab tools differ from engineering-expansion-v1.js');

if (errors.length) { console.error('catalog check FAILED:\n  - ' + errors.join('\n  - ')); process.exit(1); }
console.log(`catalog check: OK — ${free.length} Free public calculators, ${migratedCalcs.length} migrated Premium calculators, ${engineeringTools.length} Engineering Lab tools, ${prem.length} Premium-only tools total, ${cat.tools.length} in Premium, ${cat.aliases.length} aliases (not counted); save: ${c.save.eligible} eligible, ${c.save.excluded} excluded, ${c.save.saveable} saveable; Engineering Lab validated: ${c.premium_expansion_validated}`);
