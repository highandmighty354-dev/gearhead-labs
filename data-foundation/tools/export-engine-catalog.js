#!/usr/bin/env node
/* ============================================================================
 * DATA-FOUNDATION 1.0.0 · export-engine-catalog.js
 * Reads the TAGGED F1.12.3 Free baseline strictly READ-ONLY (git show on the tag,
 * never the working tree) and produces the calculator / formula-version catalog.
 * It never modifies the F1 application, the engine or the registries.
 *
 *   node tools/export-engine-catalog.js          -> write evidence/engine-catalog.json
 *                                                   + supabase/migrations/0005_reference_seed.sql
 *   node tools/export-engine-catalog.js --check  -> regenerate in memory; FAIL unless both
 *                                                   committed files are byte-identical
 * Any discrepancy against the approved baseline is a hard failure (stop condition).
 * ==========================================================================*/
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execFileSync } = require('child_process');

const TAG = 'F1.12.3-UI-MOBILE-HEADER';
const PAGE = 'F1_12_3_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
const EXPECT = { pageSha256: '02b0ceeed36b17c5ac64daa480c26ea52146f0ade94ac60b6d8f1027ec102c27',
  engineVersion: '1.1.0', registryEntries: 577, migrated: 252, pending: 8, aliases: 6 };
const HERE = path.resolve(__dirname, '..');
const REPO = process.env.DF_REPO_ROOT || path.resolve(HERE, '..');
const CHECK = process.argv.includes('--check');

const fail = (msg) => { console.error('CATALOG DISCREPANCY: ' + msg); process.exit(1); };
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { maxBuffer: 64 << 20 });
const atTag = (f) => git('show', `${TAG}:${f}`);
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

(async () => {
  const commit = git('rev-parse', `${TAG}^{commit}`).toString().trim();
  const pageBuf = atTag(PAGE), engineSrc = atTag('gh-engine.js').toString('utf8');
  const manifest = atTag('MANIFEST.sha256').toString('utf8');
  const migrated = JSON.parse(atTag('engine-migrated.json').toString('utf8'));
  const pending = JSON.parse(atTag('engine-pending.json').toString('utf8'));
  const priorSnap = JSON.parse(atTag('tools/f1122/registry-F1_12_2.json').toString('utf8')); // independent evidence

  // 1. integrity of the tagged inputs
  const pageSha = sha256(pageBuf);
  if (pageSha !== EXPECT.pageSha256) fail(`page sha256 ${pageSha} != approved ${EXPECT.pageSha256}`);
  for (const [f, buf] of [[PAGE, pageBuf], ['gh-engine.js', Buffer.from(engineSrc, 'utf8')]]) {
    const line = manifest.split('\n').find(l => l.endsWith('  ' + f));
    if (!line || line.slice(0, 64) !== sha256(buf)) fail(`${f} does not match the tag's MANIFEST.sha256`);
  }
  const embedded = pageBuf.toString('utf8').match(/<script id="GH_ENGINE">\n([\s\S]*?)<\/script>/);
  if (!embedded || embedded[1] !== engineSrc) fail('engine embedded in the page is not byte-identical to tagged gh-engine.js');

  // 2. load the page (runtime registries exactly as the live page sees them)
  const { JSDOM, VirtualConsole } = require('jsdom');
  const errors = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(String(e.message || e)));
  const w = new JSDOM(pageBuf.toString('utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://df.local/', virtualConsole: vc,
    beforeParse(win) { win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} }); win.scrollTo = () => {};
      win.HTMLCanvasElement.prototype.getContext = () => null; } }).window;
  await new Promise(r => setTimeout(r, 300));
  if (errors.length) fail('page load errors: ' + errors.slice(0, 3).join(' | '));
  const E = w.GH_ENGINE; if (!E) fail('window.GH_ENGINE missing');

  // 3. the same engine in Node (browser == Node)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'df-engine-')); const ef = path.join(tmp, 'gh-engine.js');
  fs.writeFileSync(ef, engineSrc); const { createEngine, ENGINE_VERSION } = require(ef); fs.rmSync(tmp, { recursive: true, force: true });
  const regs = {}; for (const r of ['GH_E1_FORMULAS', 'GH_E101_FORMULAS', 'GH_LEGACY_FORMULAS', 'GH_BACKFILL_FORMULAS']) regs[r] = JSON.parse(JSON.stringify(w.eval(r)));
  const aliases = JSON.parse(JSON.stringify(w.eval('GH_CALC_ALIASES')));
  const N = createEngine(regs, aliases);

  // 4. verify the baseline
  if (E.version !== EXPECT.engineVersion || ENGINE_VERSION !== EXPECT.engineVersion) fail(`engine version page ${E.version} / node ${ENGINE_VERSION} != ${EXPECT.engineVersion}`);
  const ids = E.listCalculators().slice().sort();
  if (ids.length !== EXPECT.registryEntries) fail(`registry entries ${ids.length} != ${EXPECT.registryEntries}`);
  if (JSON.stringify(N.listCalculators().slice().sort()) !== JSON.stringify(ids)) fail('Node and page engines list different calculators');
  const aliasIds = Object.keys(aliases).sort();
  if (aliasIds.length !== EXPECT.aliases) fail(`aliases ${aliasIds.length} != ${EXPECT.aliases}`);
  for (const a of aliasIds) if (!ids.includes(aliases[a])) fail(`alias ${a} -> ${aliases[a]} has no registry formula`);
  if (migrated.count !== EXPECT.migrated || migrated.calculators.length !== EXPECT.migrated) fail(`migrated ${migrated.count} != ${EXPECT.migrated}`);
  for (const m of migrated.calculators) if (!ids.includes(m)) fail(`migrated calculator ${m} not in registry`);
  const pendingIds = Object.keys(pending.pending); if (pendingIds.length !== EXPECT.pending) fail(`pending ${pendingIds.length} != ${EXPECT.pending}`);

  const formulaVersions = [], calculators = [], diffs = [];
  for (const id of ids) {
    const d = E.describe(id), dn = N.describe(id);
    if (JSON.stringify(d) !== JSON.stringify(dn)) fail(`browser/Node describe() differ for ${id}`);
    if (d.canonical_id !== id) fail(`registry id ${id} is not its own canonical id (${d.canonical_id})`);
    const prior = priorSnap.entries[id] && priorSnap.entries[id].fingerprint;
    if (prior !== d.formula_version) diffs.push(`${id}: ${prior} vs ${d.formula_version}`);
    formulaVersions.push({ calculator_id: id, formula_version: d.formula_version, engine_version: E.version, formula_registry: d.registry, first_release: 'F1.12.3' });
    calculators.push({ calculator_id: id, canonical_id: id, engine_proven: migrated.calculators.includes(id) });
  }
  if (diffs.length) fail(`${diffs.length} fingerprint(s) differ from the committed F1.12.2 snapshot: ${diffs.slice(0, 3).join('; ')}`);
  for (const a of aliasIds) {
    const d = E.describe(a); if (d.canonical_id !== aliases[a]) fail(`alias ${a} resolves to ${d.canonical_id}, expected ${aliases[a]}`);
    calculators.push({ calculator_id: a, canonical_id: aliases[a], engine_proven: migrated.calculators.includes(a) });
  }
  calculators.sort((x, y) => x.calculator_id < y.calculator_id ? -1 : 1);

  const catalog = { source: { tag: TAG, commit, page: PAGE, page_sha256: pageSha, engine_version: E.version },
    counts: { registry_entries: ids.length, aliases: aliasIds.length, calculators_rows: calculators.length, formula_versions_rows: formulaVersions.length,
              engine_proven: calculators.filter(c => c.engine_proven).length, migrated_list: migrated.count, pending_list: pendingIds.length },
    verification: { browser_equals_node: true, fingerprints_match_F1_12_2_snapshot: true, embedded_engine_identical: true, manifest_verified: true },
    calculators, formula_versions: formulaVersions };
  const catalogText = JSON.stringify(catalog, null, 1) + '\n';

  const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  const sql = [
    '-- DATA-FOUNDATION 1.0.0 · 0005 reference seed',
    '-- GENERATED by tools/export-engine-catalog.js from the TAGGED Free baseline (read-only). Do not edit by hand.',
    `-- source: ${TAG} @ ${commit}; page sha256 ${pageSha}; gh-engine@${E.version}`,
    `-- ${calculators.length} calculators (${ids.length} registry + ${aliasIds.length} aliases); ${formulaVersions.length} formula versions; ${catalog.counts.engine_proven} engine-proven`,
    '-- canonical_fields: NOT seeded (seed scope is OPEN decision #16).',
    '-- Idempotent: ON CONFLICT DO NOTHING.',
    'BEGIN;',
    'INSERT INTO public.calculators (calculator_id, canonical_id, engine_proven) VALUES',
    calculators.map(c => `  (${q(c.calculator_id)}, ${q(c.canonical_id)}, ${c.engine_proven})`).join(',\n'),
    'ON CONFLICT (calculator_id) DO NOTHING;',
    'INSERT INTO public.formula_versions (calculator_id, formula_version, engine_version, formula_registry, first_release) VALUES',
    formulaVersions.map(f => `  (${q(f.calculator_id)}, ${q(f.formula_version)}, ${q(f.engine_version)}, ${q(f.formula_registry)}, ${q(f.first_release)})`).join(',\n'),
    'ON CONFLICT (calculator_id, formula_version) DO NOTHING;',
    'COMMIT;', ''].join('\n');

  const outCatalog = path.join(HERE, 'evidence', 'engine-catalog.json'), outSql = path.join(HERE, 'supabase', 'migrations', '0005_reference_seed.sql');
  if (CHECK) {
    const same = (f, t) => fs.existsSync(f) && fs.readFileSync(f, 'utf8') === t;
    if (!same(outCatalog, catalogText)) fail('evidence/engine-catalog.json is not what the tagged baseline produces');
    if (!same(outSql, sql)) fail('0005_reference_seed.sql is not what the tagged baseline produces');
    console.log(`CATALOG CHECK PASS: ${calculators.length} calculators, ${formulaVersions.length} formula versions, ${catalog.counts.engine_proven} engine-proven, gh-engine@${E.version}, ${TAG} @ ${commit.slice(0, 7)}`);
  } else {
    fs.writeFileSync(outCatalog, catalogText); fs.writeFileSync(outSql, sql);
    console.log(`CATALOG WRITTEN: ${JSON.stringify(catalog.counts)}`);
  }
  process.exit(0);
})().catch(e => fail(e.stack || String(e)));
