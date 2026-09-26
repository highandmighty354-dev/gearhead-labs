'use strict';
/* CALCULATION-FOUNDATION 1.0.0 - frozen-source loading and integrity verification (DESIGN §1, §6, §13).
 *
 * Source authority vs runtime (SPEC §9):
 *   The implementation is built and verified against the frozen F1.12.3 source tree identified by its tag and
 *   verified SHA/content. Runtime packaging must contain the verified engine and registry sources. Production
 *   runtime dependence on a live Git repository is out of scope.
 *
 *   - loadFrozenSources(bytes) takes the six frozen source byte buffers and VERIFIES them before anything is used.
 *     It never touches Git or the filesystem: whatever supplies the bytes (packaged sources at runtime, tag reads in
 *     build/verification), the same verification decides.
 *   - readFrozenBytesFromTags(repoRoot) is the build/verification supplier: `git show <tag>:<path>` from the frozen
 *     tags, never the working tree.
 * Any verification failure throws CFIntegrityError: the service never starts. */
const crypto = require('crypto');
const vm = require('vm');
const { CFIntegrityError } = require('./errors');

const EXPECT = Object.freeze({
  F1_TAG: 'F1.12.3-UI-MOBILE-HEADER',
  DF_TAG: 'DATA-FOUNDATION-1.0.0',
  PAGE: 'F1_12_3_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html',
  PAGE_SHA256: '02b0ceeed36b17c5ac64daa480c26ea52146f0ade94ac60b6d8f1027ec102c27',
  ENGINE_VERSION: '1.1.0',
  REGISTRY_COUNT: 577,
  PROVEN_COUNT: 252,
  PENDING_COUNT: 8,
  ALIAS_COUNT: 6,
  PERMITTED_ALIASES: Object.freeze(['fraction_to_decimal', 'valve_curtain_area', 'volumetric_efficiency']),
  REGISTRIES: Object.freeze(['GH_E1_FORMULAS', 'GH_E101_FORMULAS', 'GH_LEGACY_FORMULAS', 'GH_BACKFILL_FORMULAS']),
  STATES: Object.freeze(['VALID', 'VALID_WITH_WARNING', 'ESTIMATED', 'INCOMPLETE', 'OUT_OF_RANGE', 'NON_CONVERGENT', 'NOT_APPLICABLE']),
});

/* The six frozen sources the service needs: [name, tag, path]. */
const SOURCE_FILES = Object.freeze([
  ['page', EXPECT.F1_TAG, EXPECT.PAGE],
  ['engine', EXPECT.F1_TAG, 'gh-engine.js'],
  ['migrated', EXPECT.F1_TAG, 'engine-migrated.json'],
  ['pending', EXPECT.F1_TAG, 'engine-pending.json'],
  ['manifest', EXPECT.F1_TAG, 'MANIFEST.sha256'],
  ['catalog', EXPECT.DF_TAG, 'data-foundation/evidence/engine-catalog.json'],
]);

/* Build / verification supplier only (never used by loadFrozenSources itself). */
function readFrozenBytesFromTags(repoRoot) {
  const { execFileSync } = require('child_process');
  const out = {};
  for (const [name, tag, p] of SOURCE_FILES) out[name] = execFileSync('git', ['-C', repoRoot, 'show', `${tag}:${p}`], { maxBuffer: 64 << 20 });
  return out;
}

const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) deepFreeze(o[k]); }
  return o;
}

/* The frozen brace-matching extraction used by engine.test.js / gh-verify.js (same algorithm, re-implemented). */
function grab(html, name) {
  const i = html.indexOf('const ' + name);
  if (i < 0) throw new CFIntegrityError(`registry ${name} not found in page`);
  const b = html.indexOf('{', i); let d = 0, k = b, str = false, esc = false;
  for (;; k++) {
    if (k >= html.length) throw new CFIntegrityError(`registry ${name} is not terminated`);
    const c = html[k];
    if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; }
    else if (c === '"') str = true; else if (c === '{') d++; else if (c === '}') { if (--d === 0) break; }
  }
  return JSON.parse(html.slice(b, k + 1));
}

/* Approved amendment (Option A, DESIGN §6 step 2): the frozen page runs exactly one registry-composition statement
 * at load. Static extraction gives the frozen literals; reproducing ONLY this verified statement gives the
 * runtime-equivalent registry set. No page JavaScript is evaluated. */
const COMPOSITION_STATEMENT = 'Object.assign(GH_LEGACY_FORMULAS, GH_BACKFILL_FORMULAS);';
const REGISTRY_NAMES = '(?:GH_E1_FORMULAS|GH_E101_FORMULAS|GH_LEGACY_FORMULAS|GH_BACKFILL_FORMULAS|GH_CALC_ALIASES)';

function verifyComposition(html) {
  const lines = html.split('\n');
  const exact = lines.reduce((n, l) => n + (l === COMPOSITION_STATEMENT ? 1 : 0), 0);
  if (exact !== 1) throw new CFIntegrityError(`registry composition statement present ${exact} times as its own line (expected exactly 1)`);
  const assigns = html.match(new RegExp('Object\\.assign\\(\\s*(?:window\\.)?' + REGISTRY_NAMES + '\\b', 'g')) || [];
  if (assigns.length !== 1) throw new CFIntegrityError(`${assigns.length} Object.assign statements target a registry (expected exactly the one frozen composition)`);
  const writes = html.match(new RegExp('\\b' + REGISTRY_NAMES + '\\s*(?:\\[[^\\]\\n]*\\]|\\.[A-Za-z_$][\\w$]*)\\s*=(?!=)', 'g')) || [];
  const deletes = html.match(new RegExp('\\bdelete\\s+(?:window\\.)?' + REGISTRY_NAMES + '\\b', 'g')) || [];
  if (writes.length || deletes.length) throw new CFIntegrityError('a registry is modified by a statement other than the frozen composition');
  const at = html.indexOf('\n' + COMPOSITION_STATEMENT + '\n') + 1;
  const declEnd = n => { const i = html.indexOf('const ' + n); return i < 0 ? -1 : html.indexOf('\n', i); };
  const legacy = declEnd('GH_LEGACY_FORMULAS'), backfill = declEnd('GH_BACKFILL_FORMULAS');
  const engineAt = html.search(/^<script id="GH_ENGINE">$/m);
  if (!(at > 0 && legacy > 0 && backfill > 0 && at > legacy && at > backfill && engineAt > at)) {
    throw new CFIntegrityError('registry composition statement is not between the registry declarations and the embedded engine');
  }
  return { line: html.slice(0, at).split('\n').length, statement: COMPOSITION_STATEMENT };
}

/* Applies ONLY Object.assign(GH_LEGACY_FORMULAS, GH_BACKFILL_FORMULAS) to freshly extracted registry objects and
 * proves it creates or alters no formula body. */
function composeRegistries(registries) {
  const L = registries.GH_LEGACY_FORMULAS, B = registries.GH_BACKFILL_FORMULAS;
  if (!L || !B) throw new CFIntegrityError('GH_LEGACY_FORMULAS or GH_BACKFILL_FORMULAS missing');
  const overlap = Object.keys(L).filter(k => Object.prototype.hasOwnProperty.call(B, k));
  if (overlap.length) throw new CFIntegrityError(`GH_LEGACY_FORMULAS and GH_BACKFILL_FORMULAS overlap on ${overlap.length} key(s)`);
  const before = new Map(Object.keys(L).map(k => [k, JSON.stringify(L[k])]));
  const backfill = new Map(Object.keys(B).map(k => [k, JSON.stringify(B[k])]));
  Object.assign(L, B);
  for (const [k, j] of before) if (JSON.stringify(L[k]) !== j) throw new CFIntegrityError(`composition altered legacy entry ${k}`);
  for (const [k, j] of backfill) if (JSON.stringify(L[k]) !== j || JSON.stringify(B[k]) !== j) throw new CFIntegrityError(`composition altered backfill entry ${k}`);
  if (Object.keys(L).length !== before.size + backfill.size) throw new CFIntegrityError('composed legacy registry has an unexpected size');
  return { legacy_before: before.size, backfill: backfill.size, legacy_after: Object.keys(L).length };
}

function loadFrozenSources(bytes) {
  const fail = why => { throw new CFIntegrityError(why); };
  for (const [name] of SOURCE_FILES) if (!Buffer.isBuffer(bytes && bytes[name])) fail(`frozen source "${name}" missing`);
  const report = [];

  // Page identity
  const pageSha = sha256(bytes.page);
  if (pageSha !== EXPECT.PAGE_SHA256) fail(`page SHA-256 ${pageSha} != ${EXPECT.PAGE_SHA256}`);
  report.push(`page SHA-256 ${pageSha}`);

  // Manifest (the frozen manifest covers the page, gh-engine.js and engine-migrated.json; not engine-pending.json)
  const manifest = new Map(bytes.manifest.toString('utf8').split('\n').filter(Boolean).map(l => [l.slice(66), l.slice(0, 64)]));
  for (const [name, file] of [['page', EXPECT.PAGE], ['engine', 'gh-engine.js'], ['migrated', 'engine-migrated.json']]) {
    if (manifest.get(file) !== sha256(bytes[name])) fail(`${file} does not match the F1 tag's MANIFEST.sha256`);
  }
  report.push('MANIFEST.sha256: page, gh-engine.js, engine-migrated.json match');

  // Embedded engine (frozen ENGINE_EMBED rule, gh-verify-engine.js)
  const html = bytes.page.toString('utf8'), engineSrc = bytes.engine.toString('utf8');
  if ((html.match(/^<script id="GH_ENGINE">$/gm) || []).length !== 1) fail('engine is not embedded exactly once');
  const em = html.match(/<script id="GH_ENGINE">\n([\s\S]*?)<\/script>/);
  if (!em || em[1] !== engineSrc) fail('embedded GH_ENGINE block differs from gh-engine.js');
  report.push('embedded GH_ENGINE block byte-identical to gh-engine.js (embedded once)');

  // Engine: evaluated in-memory from the verified bytes (no temporary file), never modified
  const mod = { exports: {} };
  vm.runInThisContext('(function (module, exports) {' + engineSrc + '\n})', { filename: 'gh-engine.js@F1.12.3-UI-MOBILE-HEADER' }).call({}, mod, mod.exports);
  if (mod.exports.ENGINE_VERSION !== EXPECT.ENGINE_VERSION || typeof mod.exports.createEngine !== 'function') fail('engine module is not gh-engine 1.1.0');

  // Registries + aliases (static extraction from the verified page)
  const registries = {}; for (const r of EXPECT.REGISTRIES) registries[r] = grab(html, r);
  const aliases = grab(html, 'GH_CALC_ALIASES');
  const comp = verifyComposition(html);
  const sizes = composeRegistries(registries);
  deepFreeze(registries); deepFreeze(aliases);
  report.push(`registries: static extraction + verified frozen composition (page line ${comp.line}: ${comp.statement}); `
    + `legacy ${sizes.legacy_before} + backfill ${sizes.backfill} = ${sizes.legacy_after}, no overlap, no formula body changed`);
  const engine = Object.freeze(mod.exports.createEngine(registries, aliases));
  if (engine.version !== EXPECT.ENGINE_VERSION) fail('engine version is not 1.1.0');
  const registry = engine.listCalculators();
  if (registry.length !== EXPECT.REGISTRY_COUNT) fail(`registry has ${registry.length} entries, expected ${EXPECT.REGISTRY_COUNT}`);
  report.push(`gh-engine@${engine.version}; ${registry.length} registry entries`);

  // Authority sets
  const migrated = JSON.parse(bytes.migrated.toString('utf8')), pending = JSON.parse(bytes.pending.toString('utf8'));
  const catalog = JSON.parse(bytes.catalog.toString('utf8'));
  const provenList = migrated.calculators;
  const PROVEN = new Set(provenList), PENDING = new Set(Object.keys(pending.pending || {})), REGISTRY = new Set(registry);
  if (!Array.isArray(provenList) || PROVEN.size !== EXPECT.PROVEN_COUNT || provenList.length !== EXPECT.PROVEN_COUNT || migrated.count !== EXPECT.PROVEN_COUNT) fail('authority set is not 252 unique proven ids');
  if (PENDING.size !== EXPECT.PENDING_COUNT) fail('pending set is not 8 ids');
  for (const id of PENDING) if (PROVEN.has(id)) fail(`pending id ${id} is also proven`);
  for (const id of PROVEN) if (!REGISTRY.has(id)) fail(`proven id ${id} has no registry formula`);
  if (catalog.source.tag !== EXPECT.F1_TAG || catalog.source.page_sha256 !== EXPECT.PAGE_SHA256 || catalog.source.engine_version !== EXPECT.ENGINE_VERSION) fail('DATA-FOUNDATION catalog was not generated from F1.12.3 / gh-engine 1.1.0');
  if (catalog.counts.pending_list !== EXPECT.PENDING_COUNT) fail('DATA-FOUNDATION catalog pending_list count is not 8');
  const catalogProven = catalog.calculators.filter(r => r.engine_proven).map(r => r.calculator_id).sort();
  if (JSON.stringify(catalogProven) !== JSON.stringify([...PROVEN].sort())) fail('authority set differs from the DATA-FOUNDATION catalog engine_proven set');
  report.push(`authority: ${PROVEN.size} proven (= DATA-FOUNDATION catalog), ${PENDING.size} pending (disjoint)`);

  // Fingerprints: engine formula_version = frozen formula_versions row, for every proven id
  const fvRows = new Map(catalog.formula_versions.map(r => [r.calculator_id, r]));
  const describeCache = new Map(), FP = new Map();
  const describe = id => { if (!describeCache.has(id)) describeCache.set(id, deepFreeze(JSON.parse(JSON.stringify(engine.describe(id))))); return describeCache.get(id); };
  for (const id of PROVEN) {
    const d = describe(id), row = fvRows.get(id);
    if (!d || d.canonical_id !== id) fail(`proven id ${id} does not describe as itself`);
    if (!row || row.formula_version !== d.formula_version || row.formula_registry !== d.registry || row.engine_version !== EXPECT.ENGINE_VERSION) fail(`fingerprint mismatch for ${id}`);
    FP.set(id, d.formula_version);
  }
  report.push(`fingerprints: ${FP.size}/${PROVEN.size} equal the frozen formula_versions rows`);

  // Aliases: D2 alias rule, re-derived (never hard-coded), then asserted equal to the expected three
  const catalogCanonical = new Map(catalog.calculators.map(r => [r.calculator_id, r.canonical_id]));
  const aliasIds = Object.keys(aliases);
  if (aliasIds.length !== EXPECT.ALIAS_COUNT) fail(`alias registry has ${aliasIds.length} entries, expected ${EXPECT.ALIAS_COUNT}`);
  const permitted = [];
  for (const a of aliasIds) {
    const k = aliases[a];
    if (catalogCanonical.get(a) !== k) fail(`alias ${a}: DATA-FOUNDATION catalog canonical_id differs from the frozen alias registry`);
    const da = engine.describe(a);
    if (PROVEN.has(k) && da && da.canonical_id === k && describe(k).formula_version === FP.get(k)) permitted.push(a);
  }
  permitted.sort();
  if (JSON.stringify(permitted) !== JSON.stringify(EXPECT.PERMITTED_ALIASES)) fail(`permitted alias set ${permitted.join(',')} differs from the approved set`);
  report.push(`aliases: ${aliasIds.length} in registry; permitted ${permitted.join(', ')}`);

  // Composed registry vs the frozen DATA-FOUNDATION catalog (itself generated from the page's runtime registries)
  for (const id of REGISTRY) {
    const d = engine.describe(id), row = fvRows.get(id);
    if (!row || row.formula_registry !== d.registry || row.formula_version !== d.formula_version) fail(`registry/fingerprint of ${id} differs from the frozen catalog`);
  }
  if (catalog.calculators.length !== REGISTRY.size + aliasIds.length || fvRows.size !== REGISTRY.size) fail('frozen catalog row counts differ from the composed registry');
  for (const r of catalog.calculators) {
    if (REGISTRY.has(r.calculator_id)) {
      if (r.canonical_id !== r.calculator_id || r.engine_proven !== PROVEN.has(r.calculator_id)) fail(`catalog row ${r.calculator_id} disagrees (canonical_id / engine_proven)`);
    } else if (Object.prototype.hasOwnProperty.call(aliases, r.calculator_id)) {
      if (r.canonical_id !== aliases[r.calculator_id] || r.engine_proven !== false) fail(`catalog alias row ${r.calculator_id} disagrees`);
    } else fail(`catalog row ${r.calculator_id} is neither a registry calculator nor an alias`);
  }
  report.push(`frozen catalog: ${REGISTRY.size}/${REGISTRY.size} registry names and fingerprints equal; ${catalog.calculators.length} rows agree (calculator_id, canonical_id, engine_proven, aliases)`);

  const PERMITTED = new Set(permitted);
  return Object.freeze({
    engine,
    engineVersion: engine.version,
    describe,
    isProven: id => PROVEN.has(id),
    isPending: id => PENDING.has(id),
    inRegistry: id => REGISTRY.has(id),
    aliasTarget: id => (Object.prototype.hasOwnProperty.call(aliases, id) ? aliases[id] : undefined),
    isPermittedAlias: id => PERMITTED.has(id),
    fingerprint: id => FP.get(id),
    provenIds: Object.freeze([...PROVEN].sort()),
    pendingIds: Object.freeze([...PENDING].sort()),
    registryIds: Object.freeze([...REGISTRY].sort()),
    aliasIds: Object.freeze([...aliasIds].sort()),
    registries, aliases,
    report: Object.freeze(report),
  });
}

module.exports = { EXPECT, SOURCE_FILES, COMPOSITION_STATEMENT, readFrozenBytesFromTags, loadFrozenSources, verifyComposition, composeRegistries, grab, deepFreeze };
