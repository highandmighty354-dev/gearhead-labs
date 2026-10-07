#!/usr/bin/env node
/* Gearhead Labs canonical tool catalog — generator.
 *
 * Builds catalog/gearhead-catalog.json from the authoritative sources only (nothing is typed by hand):
 *   - the public calculators, their categories and labs:   F1.12.4, loaded in Chromium (CALCS, ghLabForCalc)
 *   - formula fingerprints / registries / aliases:          the engine registries in the same page + GH_CALC_ALIASES
 *   - the production catalog rows and engine-proven flags:  supabase/migrations/0005_reference_seed.sql (byte-identical to prod)
 *   - the Premium engineering layer (E01-E14):              premium/models.js ENGINEERING_CATALOG + engineering-expansion-v1.js
 *   - the Free -> Premium calculator migration (21 ids):    premium/models.js PREMIUM_CALCULATORS (2026-10-06, owner-approved;
 *                                                            see Gearhead_Labs_Premium_Migration_AUDIT.xlsx). A calculator id
 *                                                            in this list gets tier:'premium' instead of the default 'free';
 *                                                            everything else found in CALCS stays Free, unchanged.
 *
 * Usage:  node catalog/build-catalog.js            write catalog/gearhead-catalog.json
 *         node catalog/build-catalog.js --check    regenerate in memory and fail if the committed file differs
 * Needs Playwright (Chromium). No network: every request outside the local server is aborted. */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), crypto = require('crypto'), vm = require('vm'), { execSync } = require('child_process');
let pw; try { pw = require('playwright'); } catch (e) { pw = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }

const REPO = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'gearhead-catalog.json');
const PAGE = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
const SEED = 'supabase/migrations/0005_reference_seed.sql';
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, f))).digest('hex');

function readSeed() {
  const s = fs.readFileSync(path.join(REPO, SEED), 'utf8');
  const calculators = {}, formulas = {};
  for (const m of s.matchAll(/^\s*\('([a-z0-9_]+)', '([a-z0-9_]+)', (true|false)\)/gm)) calculators[m[1]] = { canonical: m[2], engine_proven: m[3] === 'true' };
  for (const m of s.matchAll(/^\s*\('([a-z0-9_]+)', '(fv1-[0-9a-f]{8})', '([0-9.]+)', '([A-Z0-9_]+)', '([^']+)'\)/gm)) formulas[m[1]] = { version: m[2], engine: m[3], registry: m[4] };
  return { calculators, formulas };
}

function readEngineering() {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(REPO, 'premium/models.js'), 'utf8'), { window });
  const models = window.GHP.models.ENGINEERING_CATALOG.map(a => ({ ...a }));
  const src = fs.readFileSync(path.join(REPO, 'engineering-expansion-v1.js'), 'utf8');
  const module = [...src.matchAll(/add\('([^']+)','([a-z0-9_]+)','([^']+)'/g)].map(m => ({ group: m[1], id: m[2], name: m[3] }));
  const premiumCalculators = window.GHP.models.PREMIUM_CALCULATORS.map(c => ({ ...c }));
  return { models, module, premiumCalculators };
}

/* E01-E14 are named in the approved catalog. "Builder", "Lab" and "Workbench" are multi-step workbenches; the rest are analyzers. */
const engineeringKind = name => /(Builder|Lab|Workbench)$/.test(name) ? 'workbench' : 'analyzer';

async function readPage() {
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
    await page.waitForFunction(() => typeof CALCS !== 'undefined' && typeof ghLabForCalc === 'function', null, { timeout: 30000 });
    return await page.evaluate(() => {
      const regNames = ['GH_E1_FORMULAS', 'GH_E101_FORMULAS', 'GH_LEGACY_FORMULAS', 'GH_BACKFILL_FORMULAS'];
      const registry = {}; for (const n of regNames) for (const id of Object.keys(window[n] || {})) registry[id] = n;
      const aliases = eval('typeof GH_CALC_ALIASES !== "undefined" ? GH_CALC_ALIASES : {}');
      const calcs = CALCS.filter(c => c.id !== 'dashboard' && c.layer !== 'engineering')
        .map(c => ({ id: c.id, name: c.name, category: c.cat, lab: ghLabForCalc(c) }));
      return { calcs, registry, aliases: { ...aliases } };
    });
  } finally { await browser.close(); srv.close(); }
}

async function build() {
  const [pg, seed, eng] = [await readPage(), readSeed(), readEngineering()];
  const aliasOf = {}; for (const [a, c] of Object.entries(pg.aliases)) (aliasOf[c] = aliasOf[c] || []).push(a);
  const premiumCalcById = Object.fromEntries(eng.premiumCalculators.map(c => [c.id, c]));
  const migratedFound = new Set();
  const tools = [];
  for (const c of pg.calcs) {
    const f = seed.formulas[c.id], k = seed.calculators[c.id];
    const migration = premiumCalcById[c.id];
    if (migration) migratedFound.add(c.id);
    tools.push(Object.assign({
      id: c.id, name: c.name, category: c.category, lab: c.lab, tier: migration ? 'premium' : 'free', kind: 'calculator',
      save: f ? 'eligible' : 'excluded',
      formula: f ? { version: f.version, registry: f.registry, engine_proven: !!(k && k.engine_proven) } : null,
      vehicle_link: 'optional', status: 'current', aliases: (aliasOf[c.id] || []).sort()
    }, migration ? { free_companion: migration.free_companion, promotion: migration.promo } : {}));
  }
  /* Post-condition (stop-condition check from the implementation brief): every id in
     premium/models.js PREMIUM_CALCULATORS must have matched a real, currently-Free
     calculator found on the live page. A miss here means the audit's migration list no
     longer maps cleanly onto the live catalog -- the build must fail loudly, not guess. */
  const missingMigrationIds = eng.premiumCalculators.map(c => c.id).filter(id => !migratedFound.has(id));
  if (missingMigrationIds.length) {
    throw new Error('PREMIUM_CALCULATORS id(s) not found as a Free calculator on the live page: ' + missingMigrationIds.join(', '));
  }
  const analyzerIdSet = new Set(eng.models.map(a => a.id));
  const collidingIds = eng.premiumCalculators.map(c => c.id).filter(id => analyzerIdSet.has(id));
  if (collidingIds.length) {
    throw new Error('PREMIUM_CALCULATORS id(s) collide with an Engineering Lab analyzer id: ' + collidingIds.join(', '));
  }
  const moduleById = Object.fromEntries(eng.module.map(m => [m.id, m]));
  for (const a of eng.models) {
    tools.push({
      id: a.id, code: a.code, name: a.name, category: a.category, lab: 'engineering', tier: 'premium', kind: engineeringKind(a.name),
      save: 'saveable', formula: null, vehicle_link: 'optional', status: 'current',
      qa: 'qualified for engineering design/QA; not counted as public calculators (ENGINEERING_EXPANSION_CATALOG_V1.md)',
      module_group: moduleById[a.id] ? moduleById[a.id].group : null, aliases: []
    });
  }
  tools.sort((x, y) => (x.tier === y.tier ? 0 : x.tier === 'free' ? -1 : 1) || x.id.localeCompare(y.id));
  const count = (pred) => tools.filter(pred).length;
  const by = (list, key) => list.reduce((o, t) => (o[t[key]] = (o[t[key]] || 0) + 1, o), {});
  const free = tools.filter(t => t.tier === 'free'), prem = tools.filter(t => t.tier === 'premium');
  const migratedPremiumCalcs = prem.filter(t => t.kind === 'calculator');
  const engineeringLabTools = prem.filter(t => t.lab === 'engineering');
  return {
    schema: 'gearhead-catalog/1',
    description: 'Canonical Gearhead Labs tool catalog. Free = public calculators (no account). Premium ($5.99/month or $59.99/year) = everything Free plus the Premium-only tools below (21 migrated calculators, approved 2026-10-06, plus the Engineering Lab), My Garage and saved work. Aliases are alternate ids that resolve to a tool; they are never counted.',
    generated_from: { page: { file: PAGE, sha256: sha(PAGE) }, seed: { file: SEED, sha256: sha(SEED) },
      models: { file: 'premium/models.js', sha256: sha('premium/models.js') }, engineering: { file: 'engineering-expansion-v1.js', sha256: sha('engineering-expansion-v1.js') } },
    counts: {
      free_public_calculators: free.length,
      migrated_premium_calculators: migratedPremiumCalcs.length,
      engineering_lab_tools: engineeringLabTools.length,
      premium_only_tools: prem.length,
      premium_total_access: tools.length,
      aliases_not_counted: Object.keys(pg.aliases).length,
      free_by_lab: by(free, 'lab'),
      premium_by_kind: by(prem, 'kind'),
      save: { eligible: count(t => t.save === 'eligible'), excluded: count(t => t.save === 'excluded'), saveable: count(t => t.save === 'saveable') },
      premium_expansion_validated: engineeringLabTools.length,
      approved_future_tools: 0
    },
    decisions: [
      `Owner decision 2026-10-06: the ${count(t => t.save === 'excluded')} public calculators without a formula fingerprint are EXCLUDED from saved calculations for now (save = "excluded"). They stay Free and unchanged; the database already refuses them (no calculators row).`,
      `Owner decision 2026-10-06: ${migratedPremiumCalcs.length} existing Free calculators are migrated to Premium, cutting the originally-proposed 70-item list to the 21 the audit actually recommended (Gearhead_Labs_Premium_Migration_AUDIT.xlsx; 49 rejected as Engineering Lab duplicates, SEO/on-ramp anchors, or workbook-arithmetic errors). Free drops from 606 to ${free.length}; the Engineering Lab (E01-E14) is unaffected. The 147-item future roadmap remains unimplemented and uncounted.`
    ],
    premium_migration: {
      rule: 'A Free calculator moves to Premium only from an owner-approved audit in this repository (Gearhead_Labs_Premium_Migration_AUDIT.xlsx). Each migrated calculator keeps a named Free companion as its on-ramp and stays visible (not hidden) in the Free calculator navigation with a Premium indicator.',
      migrated: migratedPremiumCalcs.length,
      tools: migratedPremiumCalcs.map(t => ({ id: t.id, name: t.name, category: t.category, free_companion: t.free_companion })).sort((a, b) => a.id.localeCompare(b.id))
    },
    premium_expansion: {
      rule: 'A Premium tool enters this catalog only from approved engineering/product work in this repository, after QA. No count target (the historical ~140 / 752 figures are not used).',
      validated: engineeringLabTools.length,
      sources: [
        { source: 'ENGINEERING_EXPANSION_CATALOG_V1.md (abeea94, 2026-10-04)', outcome: `${engineeringLabTools.length} research-qualified systems E01-E14: all built (engineering-expansion-v1.js, 4ac4ba3) and live in the Premium Engineering Lab` },
        { source: 'engineering-expansion-v1.js history (406d6a1, 2026-10-04)', outcome: '3 out-of-scope (non-automotive) analyzers removed by the owner; not in the catalog' },
        { source: 'earlier planning outside this repository (a 39-item "Coming Soon" queue, a 791-item master list)', outcome: 'not in the repository and not designated Premium; not counted until provided, reviewed and approved' }
      ]
    },
    pending_human_approval: [
      'Any further Premium expansion tools: none is approved in the repository beyond E01-E14, so approved_future_tools is 0.',
      'E01-E14 are live in the Premium Engineering Lab but are not counted as public calculators until their QA sign-off (ENGINEERING_EXPANSION_CATALOG_V1.md).',
      'The 147-item future Premium calculator roadmap (beyond the 21 migrated 2026-10-06) is not in this repository and is not counted until provided, reviewed and approved.'
    ],
    aliases: Object.entries(pg.aliases).map(([id, canonical]) => ({ id, canonical })).sort((a, b) => a.id.localeCompare(b.id)),
    tools
  };
}

/* Stable, diff-friendly JSON: one tool per line. */
function serialize(cat) {
  const { tools, aliases, ...head } = cat;
  const lines = JSON.stringify(head, null, 2).replace(/\n}$/, '');
  return `${lines},\n  "aliases": [\n${aliases.map(a => '    ' + JSON.stringify(a)).join(',\n')}\n  ],\n  "tools": [\n${tools.map(t => '    ' + JSON.stringify(t)).join(',\n')}\n  ]\n}\n`;
}

(async () => {
  const text = serialize(await build());
  if (process.argv.includes('--check')) {
    const same = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === text;
    console.log(same ? 'catalog: committed file matches the sources' : 'catalog: committed file is OUT OF DATE (run node catalog/build-catalog.js)');
    process.exit(same ? 0 : 1);
  }
  fs.writeFileSync(OUT, text);
  console.log('catalog written: ' + path.relative(REPO, OUT));
})().catch(e => { console.error(e); process.exit(2); });
