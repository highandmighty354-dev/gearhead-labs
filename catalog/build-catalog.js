#!/usr/bin/env node
/* Gearhead Labs canonical tool catalog — generator.
 *
 * Builds catalog/gearhead-catalog.json from the authoritative sources only (nothing is typed by hand):
 *   - the public calculators, their categories and labs:   F1.12.4, loaded in Chromium (CALCS, ghLabForCalc)
 *   - formula fingerprints / registries / aliases:          the engine registries in the same page + GH_CALC_ALIASES
 *   - the production catalog rows and engine-proven flags:  supabase/migrations/0005_reference_seed.sql (byte-identical to prod)
 *   - the Premium engineering layer (E01-E14):              premium/models.js ENGINEERING_CATALOG + engineering-expansion-v1.js
 *   - the Premium calculator roadmap (147 candidates):      catalog/premium-roadmap.json (extracted from the owner's workbook)
 *     and its reviewed reconciliation:                      catalog/premium-reconciliation.json
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
  return { models, module };
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

const ROADMAP = 'catalog/premium-roadmap.json', RECON = 'catalog/premium-reconciliation.json';

async function build() {
  const [pg, seed, eng] = [await readPage(), readSeed(), readEngineering()];
  const roadmap = JSON.parse(fs.readFileSync(path.join(REPO, ROADMAP), 'utf8'));
  const recon = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(REPO, RECON), 'utf8')).items.map(i => [i.id, i]));
  const aliasOf = {}; for (const [a, c] of Object.entries(pg.aliases)) (aliasOf[c] = aliasOf[c] || []).push(a);
  const tools = [];
  /* FREE: the public calculators of F1.12.4, unchanged. */
  for (const c of pg.calcs) {
    const f = seed.formulas[c.id], k = seed.calculators[c.id];
    tools.push({
      id: c.id, name: c.name, category: c.category, lab: c.lab, tier: 'free', access: 'public', kind: 'calculator', status: 'IMPLEMENTED',
      save: f ? 'eligible' : 'excluded',
      formula: f ? { version: f.version, registry: f.registry, engine_proven: !!(k && k.engine_proven) } : null,
      implementation: { file: PAGE, ref: c.id }, vehicle_link: 'optional', aliases: (aliasOf[c.id] || []).sort()
    });
  }
  /* ENGINEERING: the Premium-only Engineering Lab, E01-E14. */
  const moduleById = Object.fromEntries(eng.module.map(m => [m.id, m]));
  for (const a of eng.models) {
    tools.push({
      id: a.id, code: a.code, name: a.name, category: a.category, lab: 'engineering', tier: 'engineering', access: 'premium', feature: 'engineering_lab',
      kind: engineeringKind(a.name), status: 'IMPLEMENTED', save: 'saveable', formula: null,
      implementation: { file: 'engineering-expansion-v1.js', ref: a.id }, vehicle_link: 'optional',
      qa: 'qualified for engineering design/QA; not counted as public calculators (ENGINEERING_EXPANSION_CATALOG_V1.md)',
      module_group: moduleById[a.id] ? moduleById[a.id].group : null, aliases: []
    });
  }
  /* PREMIUM: the 147 roadmap candidates from the owner's workbook, with their reconciled status. None is built yet. */
  for (const c of roadmap.candidates) {
    const r = recon[c.id];
    if (!r) throw new Error('roadmap candidate without reconciliation: ' + c.id);
    tools.push({
      id: c.id, name: c.name, category: c.section, lab: 'premium', tier: 'premium', access: 'premium', kind: c.kind, status: r.status,
      save: 'not_yet_saveable', formula: null, implementation: null, vehicle_link: 'tbd',
      source: { file: roadmap.source.file, sheet: c.origin.sheet, row: c.origin.row, list: c.origin.list, rank: c.origin.rank },
      existing: r.existing.map(e => ({ id: e.id, layer: e.layer, relation: e.relation })), internal_overlaps: r.internal_overlaps.map(o => o.with),
      first_batch: r.first_batch, aliases: []
    });
  }
  const order = { free: 0, engineering: 1, premium: 2 };
  tools.sort((x, y) => order[x.tier] - order[y.tier] || x.id.localeCompare(y.id));
  const count = (pred) => tools.filter(pred).length;
  const by = (list, key) => list.reduce((o, t) => (o[t[key]] = (o[t[key]] || 0) + 1, o), {});
  const free = tools.filter(t => t.tier === 'free'), engr = tools.filter(t => t.tier === 'engineering'), prem = tools.filter(t => t.tier === 'premium');
  return {
    schema: 'gearhead-catalog/2',
    description: 'Canonical Gearhead Labs tool catalog. Three distinct tiers: FREE (the public calculators, no account), ENGINEERING (the Premium-only Engineering Lab, E01-E14) and PREMIUM (the Premium calculator roadmap from the owner\'s workbook). Gearhead Labs Premium ($5.99/month or $59.99/year) gives access to everything implemented in all three. Only status IMPLEMENTED is a working tool. Aliases are alternate ids that resolve to a tool; they are never counted.',
    generated_from: { page: { file: PAGE, sha256: sha(PAGE) }, seed: { file: SEED, sha256: sha(SEED) },
      models: { file: 'premium/models.js', sha256: sha('premium/models.js') }, engineering: { file: 'engineering-expansion-v1.js', sha256: sha('engineering-expansion-v1.js') },
      roadmap: { file: ROADMAP, sha256: sha(ROADMAP) }, reconciliation: { file: RECON, sha256: sha(RECON) } },
    counts: {
      free_public_calculators: free.length,
      engineering_analyzers: engr.length,
      premium_roadmap_candidates: prem.length,
      premium_roadmap_by_status: by(prem, 'status'),
      premium_roadmap_by_kind: by(prem, 'kind'),
      implemented_premium_calculators: count(t => t.tier === 'premium' && t.status === 'IMPLEMENTED'),
      working_tools_with_premium: count(t => t.status === 'IMPLEMENTED'),
      do_not_add: roadmap.do_not_add.length,
      aliases_not_counted: Object.keys(pg.aliases).length,
      free_by_lab: by(free, 'lab'),
      engineering_by_kind: by(engr, 'kind'),
      save: { eligible: count(t => t.save === 'eligible'), excluded: count(t => t.save === 'excluded'), saveable: count(t => t.save === 'saveable'), not_yet_saveable: count(t => t.save === 'not_yet_saveable') }
    },
    decisions: [
      `Owner decision 2026-10-06: the ${count(t => t.save === 'excluded')} public calculators without a formula fingerprint are EXCLUDED from saved calculations for now (save = "excluded"). They stay Free and unchanged; the database already refuses them (no calculators row).`,
      'Owner decision 2026-10-06: catalog/source/Gearhead_Labs_Premium_Master_Roadmap.xlsx is the source of truth for the Premium calculator roadmap (147-item working pool; its "Do Not Add" tab stays excluded).'
    ],
    pending_human_approval: [
      `Reconciliation findings (catalog/premium-reconciliation.json): ${count(t => t.tier === 'premium' && t.status === 'DUPLICATE')} candidates duplicate an existing Free calculator and ${count(t => t.tier === 'premium' && t.status === 'PARTIALLY IMPLEMENTED')} are partially implemented by an existing Free calculator or E01-E14; each needs a keep / extend / drop decision.`,
      'Internal overlaps inside the workbook (pairs computing the same quantity) are listed per candidate in internal_overlaps.',
      'Premium calculator delivery: calculator code is public static JavaScript today, so it cannot be withheld from non-Premium visitors without a server-side delivery path (a database/storage change). See docs/PREMIUM-CATALOG.md.',
      'E01-E14 are live in the Premium Engineering Lab but are not counted as public calculators until their QA sign-off (ENGINEERING_EXPANSION_CATALOG_V1.md).'
    ],
    do_not_add: roadmap.do_not_add.map(d => ({ id: d.id, name: d.name, status: 'DUPLICATE / EXCLUDED', reason: d.reason, source: { sheet: d.origin.sheet, row: d.origin.row } })),
    aliases: Object.entries(pg.aliases).map(([id, canonical]) => ({ id, canonical })).sort((a, b) => a.id.localeCompare(b.id)),
    tools
  };
}

/* Stable, diff-friendly JSON: one tool per line. */
function serialize(cat) {
  const { tools, aliases, do_not_add, ...head } = cat;
  const lines = JSON.stringify(head, null, 2).replace(/\n}$/, '');
  return `${lines},\n  "do_not_add": [\n${do_not_add.map(a => '    ' + JSON.stringify(a)).join(',\n')}\n  ],\n  "aliases": [\n${aliases.map(a => '    ' + JSON.stringify(a)).join(',\n')}\n  ],\n  "tools": [\n${tools.map(t => '    ' + JSON.stringify(t)).join(',\n')}\n  ]\n}\n`;
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
