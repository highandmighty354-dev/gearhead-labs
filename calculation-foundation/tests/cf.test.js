#!/usr/bin/env node
/* CALCULATION-FOUNDATION 1.0.0 - deterministic suite (DESIGN §14-§16).
 * Template database: test-only shim + DATA-FOUNDATION 0001-0005 read from the DATA-FOUNDATION-1.0.0 tag, plus
 * fixtures. Every run (main and each mutant) gets a FRESH database cloned from the template. Fixed identities and
 * request ids; timestamps are only compared inside the database; no id, timestamp or hash is printed.
 * jsdom is used ONLY here (verification): P1 runtime-registry comparison and the P2 in-page engine. */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { Client } = require('pg');
const { JSDOM, VirtualConsole } = require('jsdom');
const F = require('../src/frozen-sources');
const { createCalculationService, engineResultOf } = require('../src/service');
const { createRepository } = require('../src/repository');
const { CJ, identity } = require('../src/canonical-json');
const { MUTANTS } = require('./mutants');
const P = require('./parity');

const HERE = path.resolve(__dirname, '..'), REPO = path.resolve(HERE, '..');
const cfg = { host: process.env.CF_PGHOST, port: +process.env.CF_PGPORT, user: 'postgres' };
const DF_TAG = 'DATA-FOUNDATION-1.0.0', MF_TAG = 'MAPPING-FOUNDATION-1.0.0';
const atTag = (tag, f) => execFileSync('git', ['-C', REPO, 'show', `${tag}:${f}`], { maxBuffer: 64 << 20 });
const DF_FILES = ['tests/sql/000_supabase_shim.sql', 'supabase/migrations/0001_enums.sql', 'supabase/migrations/0002_tables.sql',
  'supabase/migrations/0003_constraints_triggers.sql', 'supabase/migrations/0004_rls.sql', 'supabase/migrations/0005_reference_seed.sql'].map(f => 'data-foundation/' + f);

const U = { A: 'aaaaaaaa-0000-4000-8000-00000000000a', B: 'bbbbbbbb-0000-4000-8000-00000000000b', P: 'eeeeeeee-0000-4000-8000-00000000000e',
  X: '99999999-0000-4000-8000-000000000009' /* not an account until a check creates it */ };
const G = { GA: '10000000-0000-4000-8000-0000000000a1', GA2: '10000000-0000-4000-8000-0000000000a2', GB: '10000000-0000-4000-8000-0000000000b1' };
const M = { MA: '20000000-0000-4000-8000-0000000000a1', MH: '20000000-0000-4000-8000-0000000000a2', MD: '20000000-0000-4000-8000-0000000000a3',
  MG: '20000000-0000-4000-8000-0000000000a4', MB: '20000000-0000-4000-8000-0000000000b1', MX: '20000000-0000-4000-8000-0000000000ff' };
const rid = n => 'd0000000-0000-4000-8000-' + String(n).padStart(12, '0');

/* Catalog fingerprint of every user-defined object in public + auth (no exclusions: this milestone adds none). */
const FP_SQL = `SELECT x FROM (
  SELECT 'col '||table_schema||'.'||table_name||'.'||column_name||' '||udt_name||' '||is_nullable||' '||coalesce(column_default,'') x
    FROM information_schema.columns WHERE table_schema IN ('public','auth')
  UNION ALL SELECT 'con '||conrelid::regclass::text||' '||conname||' '||pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace IN ('public'::regnamespace,'auth'::regnamespace)
  UNION ALL SELECT 'idx '||indexdef FROM pg_indexes WHERE schemaname IN ('public','auth')
  UNION ALL SELECT 'pol '||tablename||' '||policyname||' '||cmd||' '||array_to_string(roles,',')||' '||coalesce(qual,'')||' '||coalesce(with_check,'') FROM pg_policies WHERE schemaname IN ('public','auth')
  UNION ALL SELECT 'trg '||pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace IN ('public'::regnamespace,'auth'::regnamespace)
  UNION ALL SELECT 'fn '||n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||') '||md5(pg_get_functiondef(p.oid))||' '||p.prosecdef||' '||coalesce(array_to_string(p.proconfig,','),'')||' '||coalesce(array_to_string(p.proacl,','),'')
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','auth') AND p.prokind='f'
  UNION ALL SELECT 'enum '||t.typname||' '||string_agg(e.enumlabel,',' ORDER BY e.enumsortorder) FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid GROUP BY t.typname
  UNION ALL SELECT 'rel '||n.nspname||'.'||c.relname||' '||c.relkind::text||' '||c.relrowsecurity||' '||c.relforcerowsecurity||' '||coalesce(array_to_string(c.relacl,','),'')
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth')
  UNION ALL SELECT 'colacl '||c.relname||'.'||a.attname||' '||array_to_string(a.attacl,',') FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    WHERE a.attacl IS NOT NULL AND c.relnamespace IN ('public'::regnamespace,'auth'::regnamespace)
) s ORDER BY x`;

async function connect(db) { const c = new Client({ ...cfg, database: db }); await c.connect(); return c; }

/* ---------------------------------------------------------------- one-time setup */
async function setup() {
  const bytes = F.readFrozenBytesFromTags(REPO);
  const sources = F.loadFrozenSources(bytes);
  const html = bytes.page.toString('utf8');
  const dfFrozen = DF_FILES.map(f => ({ f, tag: atTag(DF_TAG, f).toString('utf8'), wt: fs.readFileSync(path.join(REPO, f), 'utf8') }));
  const mappings = JSON.parse(atTag(MF_TAG, 'mapping-foundation/registry/calculator-mappings.json').toString('utf8'));

  // template database
  const admin = await connect('postgres');
  await admin.query('DROP DATABASE IF EXISTS cf_template'); await admin.query('CREATE DATABASE cf_template');
  await admin.end();
  const t = await connect('cf_template');
  for (const x of dfFrozen) await t.query(x.tag);
  await t.query(`INSERT INTO auth.users (id) VALUES ('${U.A}'), ('${U.B}'), ('${U.P}')`);
  // frozen rule: one ACTIVE garage per owner - so A's second garage is created and soft-deleted first
  await t.query(`INSERT INTO public.garages (id, owner_id, name) VALUES ('${G.GA2}','${U.A}','A deleted garage')`);
  await t.query(`INSERT INTO public.machines (id, owner_id, garage_id, name, machine_type) VALUES ('${M.MG}','${U.A}','${G.GA2}','A in deleted garage','marine')`);
  await t.query(`UPDATE public.garages SET deleted_at = now() WHERE id = '${G.GA2}'`);
  await t.query(`INSERT INTO public.garages (id, owner_id, name) VALUES ('${G.GA}','${U.A}','A garage'), ('${G.GB}','${U.B}','B garage')`);
  await t.query(`INSERT INTO public.machines (id, owner_id, garage_id, name, machine_type, is_hypothetical) VALUES
    ('${M.MA}','${U.A}','${G.GA}','A active','automotive',false), ('${M.MH}','${U.A}','${G.GA}','A hypothetical','automotive',true),
    ('${M.MD}','${U.A}','${G.GA}','A soft-deleted','automotive',false), ('${M.MB}','${U.B}','${G.GB}','B active','automotive',false)`);
  await t.query(`UPDATE public.machines SET deleted_at = now() WHERE id = '${M.MD}'`);
  const fpTemplate = (await t.query(FP_SQL)).rows.map(r => r.x);
  await t.end();

  // verification-only jsdom instance of the frozen page (P1 runtime registries, no-formula ids, P2 in-page engine)
  const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://cf.local/', virtualConsole: new VirtualConsole(),
    beforeParse(x) { x.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} }); x.scrollTo = () => {}; x.HTMLCanvasElement.prototype.getContext = () => null; } }).window;
  await new Promise(r => setTimeout(r, 2500));
  const runtimeRegistries = {}; for (const n of [...F.EXPECT.REGISTRIES, 'GH_CALC_ALIASES']) runtimeRegistries[n] = JSON.parse(JSON.stringify(w.eval(n)));
  const pageCalcIds = JSON.parse(JSON.stringify(w.eval('CALCS').map(c => c.id)));
  const inPage = w.GH_ENGINE;
  const inPageReg = {}; for (const id of inPage.listCalculators()) { const d = inPage.describe(id); inPageReg[id] = [d.registry, d.formula_version]; }
  const aliasInPage = JSON.stringify(inPage.calculate('volumetric_efficiency', { actual_cfm: 520, theoretical: 600 }));
  const { vectors, bindFailures } = P.buildVectors(w, sources, mappings);
  w.close();
  return { bytes, sources, html, dfFrozen, fpTemplate, runtimeRegistries, pageCalcIds, inPageReg, aliasInPage, vectors, bindFailures };
}

/* ---------------------------------------------------------------- one suite run */
async function runSuite(S, dbName, mutant) {
  const results = [];
  const rec = (group, name, ok, detail) => results.push({ group, name, ok: !!ok, detail: detail || '' });
  const admin = await connect('postgres');
  await admin.query(`DROP DATABASE IF EXISTS ${dbName}`); await admin.query(`CREATE DATABASE ${dbName} TEMPLATE cf_template`); await admin.end();
  const adm = await connect(dbName), svc1 = await connect(dbName), svc2 = await connect(dbName);
  const mk = client => (mutant && mutant.repository ? mutant.repository(client) : createRepository(client));
  const components = mutant && mutant.components;
  const service = createCalculationService({ sources: S.sources, repository: mk(svc1), components });
  const service2 = createCalculationService({ sources: S.sources, repository: mk(svc2), components });
  const src = S.sources;
  const call = async (owner, req) => { try { return await service.calculate(owner === null ? undefined : { owner_id: owner }, req); } catch (e) { return { outcome: 'threw', code: 'THREW', reason: e.message.split('\n')[0] }; } };
  const rows = async (owner, r) => Number((await adm.query('SELECT count(*) FROM public.calculation_records WHERE owner_id = $1 AND request_id = $2', [owner, r])).rows[0].count);
  const allRows = async () => Number((await adm.query('SELECT count(*) FROM public.calculation_records')).rows[0].count);
  const fmt = o => (o.outcome === 'rejected' || o.outcome === 'threw' ? `${o.outcome} ${o.code} ${o.reason}` : o.outcome === 'conflict' ? `conflict ${o.code}` : `${o.outcome} ${o.record ? o.record.result_state : ''}`);
  async function expectReject(g, name, owner, req, code, reason) {
    const before = await allRows(); const o = await call(owner, req); const after = await allRows();
    rec(g, name, o.outcome === 'rejected' && o.code === code && (!reason || o.reason === reason) && after === before, `${fmt(o)}; rows +${after - before}`);
  }
  async function asRole(role, uid, sql, params) {
    await adm.query('BEGIN');
    try { await adm.query(`SET LOCAL ROLE ${role}`); await adm.query("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
      const r = await adm.query(sql, params); return { ok: true, n: r.rowCount, rows: r.rows }; }
    catch (e) { return { ok: false, code: e.code, msg: e.message.split('\n')[0] }; }
    finally { await adm.query('ROLLBACK'); }
  }
  const HP = 'hp_from_torque', TQ = 'torque_from_hp', SC = 'speed_converter', BL = 'bearing_life', VTA = 'valve_throat_area';

  // ============ INTEGRITY (P1) ============
  const IN = 'integrity';
  rec(IN, 'P1 frozen sources verified: page SHA-256, MANIFEST, embedded engine, gh-engine 1.1.0, 577 registry, 252 proven = catalog, 8 pending, fingerprints, aliases, composition, catalog',
    src.report.length === 9, src.report.length + ' verification steps');
  rec(IN, 'P1 shim + DATA-FOUNDATION 0001-0005 read from the DATA-FOUNDATION-1.0.0 tag are byte-identical to the working tree', S.dfFrozen.every(x => x.tag === x.wt), `${S.dfFrozen.filter(x => x.tag === x.wt).length}/${S.dfFrozen.length}`);
  {
    const raw = {}; for (const r of F.EXPECT.REGISTRIES) raw[r] = F.grab(S.html, r);
    const eqKeysAndContent = (a, b) => JSON.stringify(Object.keys(a)) === JSON.stringify(Object.keys(b)) && JSON.stringify(a) === JSON.stringify(b);
    const legacyStaticEqualsRuntime = eqKeysAndContent(raw.GH_LEGACY_FORMULAS, S.runtimeRegistries.GH_LEGACY_FORMULAS);
    const mod = { exports: {} }; require('vm').runInThisContext('(function(module,exports){' + S.bytes.engine.toString('utf8') + '\n})').call({}, mod, mod.exports);
    const Estatic = mod.exports.createEngine(raw, F.grab(S.html, 'GH_CALC_ALIASES'));
    const diff = Object.keys(S.inPageReg).filter(id => Estatic.describe(id).registry !== S.inPageReg[id][0]);
    const provenDiff = diff.filter(id => src.isProven(id));
    rec(IN, 'P1 static extraction alone is NOT runtime-equivalent: 96/577 registry-name differences from the in-page runtime (60/252 proven)',
      !legacyStaticEqualsRuntime && diff.length === 96 && provenDiff.length === 60, `${diff.length}/577, proven ${provenDiff.length}/252`);
    const allEqual = [...F.EXPECT.REGISTRIES, 'GH_CALC_ALIASES'].every(n => eqKeysAndContent(n === 'GH_CALC_ALIASES' ? src.aliases : src.registries[n], S.runtimeRegistries[n]));
    rec(IN, 'P1 static extraction + verified frozen composition = the runtime registries evaluated in jsdom (all five: content and key order)', allEqual, allEqual ? '5/5 identical' : 'differs');
    const d2 = Object.keys(S.inPageReg).filter(id => { const d = src.describe(id); return d.registry !== S.inPageReg[id][0] || d.formula_version !== S.inPageReg[id][1]; });
    rec(IN, 'P1 composed engine = in-page engine: 0 registry-name and 0 fingerprint differences (577/577)', d2.length === 0 && Object.keys(S.inPageReg).length === 577, `${d2.length} differences over ${Object.keys(S.inPageReg).length}`);
    const fpSame = Object.keys(S.inPageReg).every(id => Estatic.describe(id).formula_version === src.describe(id).formula_version);
    rec(IN, 'P1 composition changes no formula fingerprint (static vs composed, 577/577)', fpSame, fpSame ? '577/577 identical' : 'differs');
    const ov = Object.keys(raw.GH_LEGACY_FORMULAS).filter(k => k in raw.GH_BACKFILL_FORMULAS).length;
    rec(IN, 'P1 GH_LEGACY_FORMULAS and GH_BACKFILL_FORMULAS share no keys', ov === 0, `${ov} overlapping (legacy ${Object.keys(raw.GH_LEGACY_FORMULAS).length}, backfill ${Object.keys(raw.GH_BACKFILL_FORMULAS).length})`);
    let comp; try { comp = F.verifyComposition(S.html); } catch (e) { comp = null; }
    rec(IN, 'P1 the exact frozen composition statement is detected (page line 8708)', comp && comp.line === 8708 && comp.statement === F.COMPOSITION_STATEMENT, comp ? `line ${comp.line}` : 'not detected');
  }
  const failsClosed = (fn, re) => { try { fn(); return { ok: false, detail: 'did NOT fail' }; } catch (e) { return { ok: e.code === 'CF_INTEGRITY' && (!re || re.test(e.reason)), detail: `${e.code}: ${e.reason}` }; } };
  const tamper = (name, mutate, re) => { const t = failsClosed(() => F.loadFrozenSources(mutate(Object.assign({}, S.bytes))), re); rec(IN, name, t.ok, t.detail); };
  const flip = (buf, at) => { const b = Buffer.from(buf); b[at] = b[at] ^ 1; return b; };
  tamper('tamper: engine bytes altered by one byte -> service never starts (CF_INTEGRITY)', b => Object.assign(b, { engine: flip(b.engine, 2000) }), /MANIFEST/);
  tamper('tamper: registry formula character altered in the page -> CF_INTEGRITY', b => Object.assign(b, { page: Buffer.from(S.html.replace('"expr":"(torq*rpm)/5252"', '"expr":"(torq*rpm)/5253"')) }), /page SHA-256/);
  tamper('tamper: authority file altered (engine-migrated.json) -> CF_INTEGRITY', b => Object.assign(b, { migrated: Buffer.from(b.migrated.toString().replace('"deck_height"', '"deck_heighx"')) }), /MANIFEST/);
  tamper('tamper: frozen catalog fingerprint altered -> CF_INTEGRITY', b => { const c = JSON.parse(b.catalog); c.formula_versions.find(r => r.calculator_id === HP).formula_version = 'fv1-00000000'; return Object.assign(b, { catalog: Buffer.from(JSON.stringify(c)) }); }, /fingerprint|differs from the frozen catalog/);
  tamper('tamper: a frozen source missing -> CF_INTEGRITY', b => { delete b.pending; return b; }, /missing/);
  const vc = (name, html, re) => { const t = failsClosed(() => F.verifyComposition(html), re); rec(IN, name, t.ok, t.detail); };
  vc('composition control: statement missing -> CF_INTEGRITY', S.html.replace(F.COMPOSITION_STATEMENT + '\n', ''), /0 times/);
  vc('composition control: statement altered -> CF_INTEGRITY', S.html.replace(F.COMPOSITION_STATEMENT, 'Object.assign(GH_BACKFILL_FORMULAS, GH_LEGACY_FORMULAS);'), /0 times/);
  vc('composition control: statement duplicated -> CF_INTEGRITY', S.html.replace(F.COMPOSITION_STATEMENT, F.COMPOSITION_STATEMENT + '\n' + F.COMPOSITION_STATEMENT), /2 times/);
  vc('composition control: another registry write added -> CF_INTEGRITY', S.html.replace(F.COMPOSITION_STATEMENT, F.COMPOSITION_STATEMENT + '\nGH_E1_FORMULAS["x"] = {};'), /other than the frozen composition/);
  { const t = failsClosed(() => { const r = {}; for (const n of F.EXPECT.REGISTRIES) r[n] = F.grab(S.html, n); const k = Object.keys(r.GH_LEGACY_FORMULAS)[0]; r.GH_BACKFILL_FORMULAS[k] = r.GH_LEGACY_FORMULAS[k]; F.composeRegistries(r); }, /overlap/);
    rec(IN, 'composition control: overlapping registries -> CF_INTEGRITY', t.ok, t.detail); }

  // ============ AUTHORITY ============
  const AU = 'authority';
  { let n = 0, bad = []; for (const id of src.provenIds) { n++; const o = await call(U.A, { calculator_id: id, inputs: {}, request_id: rid(100000 + n) });
      if (o.outcome !== 'created' || o.result.canonical_id !== id) bad.push(id); }
    rec(AU, 'all 252 proven calculators execute and persist (empty inputs -> INCOMPLETE records)', bad.length === 0 && n === 252, `${n - bad.length}/${n}${bad.length ? ' failing: ' + bad.slice(0, 3).join(',') : ''}`); }
  const notProven = src.registryIds.filter(id => !src.isProven(id) && !src.isPending(id));
  { const before = await allRows(); let ok = 0; for (const id of notProven) { const o = await call(U.A, { calculator_id: id, inputs: {}, request_id: rid(200000) });
      if (o.outcome === 'rejected' && o.code === 'CF_NOT_PROVEN' && o.reason === 'not_proven') ok++; }
    rec(AU, 'every non-proven registry calculator rejected CF_NOT_PROVEN before execution, no record', ok === notProven.length && notProven.length === 317 && await allRows() === before, `${ok}/${notProven.length} (325 non-proven = 317 + 8 pending)`); }
  { const before = await allRows(); let ok = 0; for (const id of src.pendingIds) { const o = await call(U.A, { calculator_id: id, inputs: {}, request_id: rid(200001) });
      if (o.outcome === 'rejected' && o.code === 'CF_NOT_PROVEN' && o.reason === 'pending') ok++; }
    rec(AU, 'all 8 pending calculators rejected CF_NOT_PROVEN (pending), no record', ok === 8 && await allRows() === before, `${ok}/8`); }
  { // Master §3: "Dashboard is not a calculator" - the page's 30 formula-less CALCS entries are the dashboard + the 29 (ENGINE.md)
    const noFormula = S.pageCalcIds.filter(id => !src.inRegistry(id) && src.aliasTarget(id) === undefined && id !== 'dashboard');
    const before = await allRows(); let ok = 0; for (const id of [...noFormula, 'dashboard', 'no_such_calculator']) { const o = await call(U.A, { calculator_id: id, inputs: {}, request_id: rid(200002) });
      if (o.outcome === 'rejected' && o.code === 'CF_UNKNOWN_CALCULATOR') ok++; }
    rec(AU, 'no-formula page calculators (the 29), the dashboard and an unknown id rejected CF_UNKNOWN_CALCULATOR, no record', ok === noFormula.length + 2 && noFormula.length === 29 && await allRows() === before, `${ok}/${noFormula.length + 2} (no-formula ${noFormula.length})`); }
  { const bad = src.aliasIds.filter(a => !src.isPermittedAlias(a)); const before = await allRows(); let ok = 0;
    for (const a of bad) { const o = await call(U.A, { calculator_id: a, inputs: {}, request_id: rid(200003) }); if (o.outcome === 'rejected' && o.code === 'CF_ALIAS_NOT_PERMITTED') ok++; }
    rec(AU, 'aliases to unproven canonical calculators rejected CF_ALIAS_NOT_PERMITTED (airflow_from_ve, carb_cfm, sae_fraction_to_mm)', ok === 3 && bad.length === 3 && await allRows() === before, `${ok}/${bad.length}`); }
  { const inputs = { fraction_to_decimal: { num_fd: 3, den_fd: 8 }, valve_curtain_area: { vd: 2.02, vlift2: 0.55, port_ca: 2.1 }, volumetric_efficiency: { actual_cfm: 520, theoretical: 600 } };
    const expectCanon = { fraction_to_decimal: 'fraction_decimal', valve_curtain_area: 'curtain_area', volumetric_efficiency: 'volumetric_eff' };
    let ok = 0, n = 300; for (const a of Object.keys(inputs)) { n++; const o = await call(U.A, { calculator_id: a, inputs: inputs[a], request_id: rid(n) });
      if (o.outcome === 'created' && o.result.calculator_id === a && o.result.canonical_id === expectCanon[a] && o.record.calculator_id === a && o.record.canonical_id === expectCanon[a]
        && o.result.formula.version === src.fingerprint(expectCanon[a])) ok++; }
    rec(AU, 'the 3 permitted aliases execute: result and record keep the requested calculator_id and the frozen canonical_id', ok === 3, `${ok}/3`); }
  { const o = await call(U.A, { calculator_id: 'volumetric_efficiency', inputs: { actual_cfm: 520, theoretical: 600 }, request_id: rid(304) });
    rec(AU, 'alias result is byte-identical to the in-page engine for the alias id', o.outcome === 'created' && JSON.stringify(engineResultOf(o.result)) === S.aliasInPage, fmt(o)); }

  // ============ VALIDATION ============
  const VA = 'validation';
  await expectReject(VA, 'missing trusted owner context -> CF_NO_OWNER', null, { calculator_id: HP, inputs: {}, request_id: rid(400) }, 'CF_NO_OWNER');
  { const before = await allRows(); const o = await (async () => { try { return await service.calculate({ owner_id: U.A, role: 'x' }, { calculator_id: HP, inputs: {}, request_id: rid(401) }); } catch (e) { return { outcome: 'threw' }; } })();
    rec(VA, 'owner context with an extra key -> CF_NO_OWNER', o.code === 'CF_NO_OWNER' && await allRows() === before, fmt(o)); }
  await expectReject(VA, 'request-supplied owner_id rejected (CF_MALFORMED_REQUEST); the owner comes only from trusted context', U.A, { calculator_id: HP, inputs: { torq: 1, rpm: 1 }, request_id: rid(402), owner_id: U.B }, 'CF_MALFORMED_REQUEST', 'unexpected_request_key');
  await expectReject(VA, 'request not an object -> CF_MALFORMED_REQUEST', U.A, 'hp_from_torque', 'CF_MALFORMED_REQUEST');
  await expectReject(VA, 'inputs not an object -> CF_MALFORMED_REQUEST', U.A, { calculator_id: HP, inputs: [1, 2], request_id: rid(403) }, 'CF_MALFORMED_REQUEST');
  await expectReject(VA, 'non-canonical (uppercase) request_id -> CF_MALFORMED_REQUEST', U.A, { calculator_id: HP, inputs: {}, request_id: rid(404).toUpperCase() }, 'CF_MALFORMED_REQUEST');
  await expectReject(VA, 'malformed machine_id -> CF_MALFORMED_REQUEST', U.A, { calculator_id: HP, inputs: {}, request_id: rid(405), machine_id: 'machine-1' }, 'CF_MALFORMED_REQUEST');
  await expectReject(VA, 'extra input key -> CF_UNKNOWN_INPUT_KEY (the engine alone would silently ignore it)', U.A, { calculator_id: HP, inputs: { torq: 400, rpm: 5000, boost: 5 }, request_id: rid(406) }, 'CF_UNKNOWN_INPUT_KEY');
  await expectReject(VA, 'NaN -> CF_NON_REPRESENTABLE_INPUT', U.A, { calculator_id: HP, inputs: { torq: NaN, rpm: 5000 }, request_id: rid(407) }, 'CF_NON_REPRESENTABLE_INPUT');
  await expectReject(VA, '+Infinity -> CF_NON_REPRESENTABLE_INPUT', U.A, { calculator_id: HP, inputs: { torq: Infinity, rpm: 5000 }, request_id: rid(408) }, 'CF_NON_REPRESENTABLE_INPUT');
  await expectReject(VA, '-Infinity -> CF_NON_REPRESENTABLE_INPUT', U.A, { calculator_id: HP, inputs: { torq: -Infinity, rpm: 5000 }, request_id: rid(409) }, 'CF_NON_REPRESENTABLE_INPUT');
  await expectReject(VA, '-0 -> CF_NON_REPRESENTABLE_INPUT', U.A, { calculator_id: HP, inputs: { torq: -0, rpm: 5000 }, request_id: rid(410) }, 'CF_NON_REPRESENTABLE_INPUT');
  await expectReject(VA, 'empty string for a numeric input -> CF_NON_NUMERIC_INPUT', U.A, { calculator_id: HP, inputs: { torq: '', rpm: 5000 }, request_id: rid(411) }, 'CF_NON_NUMERIC_INPUT');
  await expectReject(VA, 'numeric string "400" -> CF_NON_NUMERIC_INPUT', U.A, { calculator_id: HP, inputs: { torq: '400', rpm: 5000 }, request_id: rid(412) }, 'CF_NON_NUMERIC_INPUT');
  await expectReject(VA, 'boolean for a numeric input -> CF_NON_NUMERIC_INPUT', U.A, { calculator_id: HP, inputs: { torq: true, rpm: 5000 }, request_id: rid(413) }, 'CF_NON_NUMERIC_INPUT');
  await expectReject(VA, 'invalid categorical option ("FPS") -> CF_INVALID_OPTION', U.A, { calculator_id: SC, inputs: { s_in: 60, s_from: 'FPS' }, request_id: rid(414) }, 'CF_INVALID_OPTION');
  await expectReject(VA, 'wrong categorical type ("3" for numeric option 3) -> CF_INVALID_OPTION', U.A, { calculator_id: BL, inputs: { load_br: 1000, rated_load: 5000, rpm_br: 1800, life_exp: '3' }, request_id: rid(415) }, 'CF_INVALID_OPTION');
  await expectReject(VA, 'empty string for a categorical input -> CF_INVALID_OPTION', U.A, { calculator_id: SC, inputs: { s_in: 60, s_from: '' }, request_id: rid(416) }, 'CF_INVALID_OPTION');
  await expectReject(VA, 'provenance wrapper with empty provenance -> CF_INVALID_PROVENANCE', U.A, { calculator_id: HP, inputs: { torq: { value: 400, provenance: '' }, rpm: 5000 }, request_id: rid(417) }, 'CF_INVALID_PROVENANCE');
  await expectReject(VA, 'provenance wrapper with an extra key -> CF_INVALID_PROVENANCE', U.A, { calculator_id: HP, inputs: { torq: { value: 400, provenance: 'measured', unit: 'lb-ft' }, rpm: 5000 }, request_id: rid(418) }, 'CF_INVALID_PROVENANCE');
  await expectReject(VA, 'provenance wrapper without provenance -> CF_INVALID_PROVENANCE', U.A, { calculator_id: HP, inputs: { torq: { value: 400 }, rpm: 5000 }, request_id: rid(419) }, 'CF_INVALID_PROVENANCE');
  await expectReject(VA, 'wrapped value NaN -> CF_NON_REPRESENTABLE_INPUT', U.A, { calculator_id: HP, inputs: { torq: { value: NaN, provenance: 'measured' }, rpm: 5000 }, request_id: rid(420) }, 'CF_NON_REPRESENTABLE_INPUT');
  { const o = await call(U.A, { calculator_id: HP, inputs: { torq: { value: 400, provenance: 'dyno sheet (unverified claim)' }, rpm: 5000 }, request_id: rid(421) });
    const stored = o.record && o.record.inputs.torq;
    rec(VA, 'valid provenance wrapper accepted; the claim is stored verbatim in inputs, never validated as fact', o.outcome === 'created' && o.result.state === 'VALID' && stored && stored.provenance === 'dyno sheet (unverified claim)' && stored.value === 400, fmt(o)); }
  { const o = await call(U.A, { calculator_id: SC, inputs: { s_in: 60, s_from: 'fps' }, request_id: rid(422) });
    rec(VA, 'exact declared categorical option accepted', o.outcome === 'created' && o.result.state === 'VALID', fmt(o)); }

  // ============ ENGINE_CONTRACT ============
  const EC = 'engine_contract';
  { const o = await call(U.A, { calculator_id: HP, inputs: { torq: 0, rpm: 5000 }, request_id: rid(500) });
    rec(EC, 'explicit 0 is a KNOWN zero: VALID, output 0, persisted', o.outcome === 'created' && o.result.state === 'VALID' && o.result.outputs[0].value === 0 && o.record.result_state === 'valid' && o.record.inputs.torq === 0, fmt(o)); }
  { const o = await call(U.A, { calculator_id: HP, inputs: { rpm: 5000 }, request_id: rid(501) });
    rec(EC, 'missing input is UNKNOWN (never 0): INCOMPLETE, missing [torq], output null, persisted', o.outcome === 'created' && o.result.state === 'INCOMPLETE' && JSON.stringify(o.record.missing) === '["torq"]' && o.result.outputs[0].value === null && o.record.result_state === 'incomplete' && !('torq' in o.record.inputs), fmt(o)); }
  { const o = await call(U.A, { calculator_id: HP, inputs: { torq: null, rpm: 5000 }, request_id: rid(502) });
    rec(EC, 'explicit null is UNKNOWN: INCOMPLETE, stored as null', o.outcome === 'created' && o.result.state === 'INCOMPLETE' && o.record.inputs.torq === null && JSON.stringify(o.record.missing) === '["torq"]', fmt(o)); }
  { const o = await call(U.A, { calculator_id: TQ, inputs: { hp2: 100, rpm2: 0 }, request_id: rid(503) });
    rec(EC, 'OUT_OF_RANGE is a valid engine result and is persisted', o.outcome === 'created' && o.result.state === 'OUT_OF_RANGE' && o.record.result_state === 'out_of_range', fmt(o)); }
  { let ok = 0, n = 510; for (const c of src.describe(SC).inputs[1].choices) { n++; const o = await call(U.A, { calculator_id: SC, inputs: { s_in: 60, s_from: c.value }, request_id: rid(n) }); if (o.outcome === 'created' && o.result.state === 'VALID') ok++; }
    rec(EC, 'every declared speed_converter option executes (exact D-009 matching)', ok === 4, `${ok}/4`); }
  { const o = await call(U.A, { calculator_id: BL, inputs: { load_br: 1000, rated_load: 5000, rpm_br: 1800, life_exp: 3 }, request_id: rid(520) });
    const rt = o.outcome === 'created' ? (await adm.query(`SELECT jsonb_typeof(inputs->'life_exp') t FROM public.calculation_records WHERE request_id = $1`, [rid(520)])).rows[0].t : null;
    rec(EC, 'numeric categorical option 3 accepted and stored as a JSON number', o.outcome === 'created' && o.result.state === 'VALID' && rt === 'number', `${fmt(o)}; stored type ${rt}`); }
  { const o = await call(U.A, { calculator_id: VTA, inputs: { vta_d: 2.02, vta_v: 1.6 }, request_id: rid(530) });
    const keys = o.record ? o.record.outputs.map(x => x.key) : [];
    const ok = o.outcome === 'created' && JSON.stringify(keys) === '["throat_area","valve_area","throat_diameter","throat_area"]'
      && o.record.outputs[0].label !== o.record.outputs[3].label && CJ(o.record.outputs) === CJ(o.result.outputs);   // jsonb reorders object keys: compare by content
    rec(EC, 'valve_throat_area: duplicate key throat_area kept at output_index 0 AND 3, distinct labels, stored verbatim in order', ok, `${fmt(o)}; keys ${keys.join(',')}`); }
  { const o = await call(U.A, { calculator_id: HP, inputs: { torq: 425, rpm: 5600 }, request_id: rid(531) });
    const direct = JSON.stringify(src.engine.calculate(HP, { rpm: 5600, torq: 425 }));
    rec(EC, 'service result = frozen engine result, unchanged (engine part byte-identical)', o.outcome === 'created' && JSON.stringify(engineResultOf(o.result)) === direct, fmt(o)); }
  { const o = await call(U.A, { calculator_id: HP, inputs: { torq: 425, rpm: 5600 }, request_id: rid(532) });
    const meta = o.result ? Object.keys(o.result).slice(-5).join(',') : '';
    rec(EC, 'result = engine result + exactly five metadata fields (record_id, request_id, owner_id, machine_id, created_at)', meta === 'record_id,request_id,owner_id,machine_id,created_at' && o.result.record_id === o.record.record_id, meta); }

  // ============ IDEMPOTENCY ============
  const ID = 'idempotency';
  { const r = rid(600), req = { calculator_id: HP, inputs: { torq: 400, rpm: 5000 }, request_id: r };
    const o1 = await call(U.A, req), o2 = await call(U.A, req);
    rec(ID, 'identical replay returns the ORIGINAL stored record (same record_id), nothing executed or written', o1.outcome === 'created' && o2.outcome === 'replayed' && o2.record.record_id === o1.record.record_id && await rows(U.A, r) === 1, `${fmt(o1)} / ${fmt(o2)}`);
    const o3 = await call(U.A, { request_id: r, inputs: { rpm: 5000, torq: 400 }, calculator_id: HP });
    rec(ID, 'replay with different key order is the same canonical request -> replayed', o3.outcome === 'replayed' && o3.record.record_id === o1.record.record_id, fmt(o3));
    const before = (await adm.query('SELECT inputs, outputs FROM public.calculation_records WHERE request_id = $1', [r])).rows[0];
    const o4 = await call(U.A, { calculator_id: HP, inputs: { torq: 401, rpm: 5000 }, request_id: r });
    const after = (await adm.query('SELECT inputs, outputs FROM public.calculation_records WHERE request_id = $1', [r])).rows[0];
    rec(ID, 'same request_id, different inputs -> CF_REQUEST_CONFLICT; original untouched; no second record', o4.outcome === 'conflict' && o4.code === 'CF_REQUEST_CONFLICT' && CJ(before) === CJ(after) && await rows(U.A, r) === 1, fmt(o4));
    const o5 = await call(U.A, { calculator_id: HP, inputs: { torq: 400, rpm: 5000 }, request_id: r, machine_id: M.MA });
    rec(ID, 'same request_id, different machine_id -> CF_REQUEST_CONFLICT', o5.outcome === 'conflict' && await rows(U.A, r) === 1, fmt(o5));
    const o6 = await call(U.A, { calculator_id: HP, inputs: { torq: { value: 400, provenance: 'measured' }, rpm: 5000 }, request_id: r });
    rec(ID, 'bare 400 vs {value: 400, provenance} are different canonical requests -> conflict', o6.outcome === 'conflict', fmt(o6));
    const o7 = await call(U.A, { calculator_id: 'volumetric_efficiency', inputs: { actual_cfm: 400, theoretical: 5000 }, request_id: r });
    rec(ID, 'same request_id, different calculator -> conflict', o7.outcome === 'conflict', fmt(o7));
    const o8 = await call(U.A, { calculator_id: HP, inputs: { torq: 400, rpm: 5000 }, request_id: rid(601) });
    rec(ID, 'recalculation uses a new request_id -> a new immutable record', o8.outcome === 'created' && o8.record.record_id !== o1.record.record_id && await rows(U.A, rid(601)) === 1, fmt(o8));
    const o9 = await call(U.B, req);
    rec(ID, 'request_id idempotency is per owner: the same request_id for another owner creates its own record', o9.outcome === 'created' && await rows(U.B, r) === 1 && await rows(U.A, r) === 1, fmt(o9)); }
  { const r = rid(602);
    const o1 = await call(U.A, { calculator_id: HP, inputs: { torq: 'x', rpm: 1 }, request_id: r });
    const o2 = await call(U.A, { calculator_id: HP, inputs: { torq: 1, rpm: 1 }, request_id: r });
    rec(ID, 'a pre-engine rejection consumes nothing: the same request_id later creates the record', o1.outcome === 'rejected' && o2.outcome === 'created' && await rows(U.A, r) === 1, `${fmt(o1)} / ${fmt(o2)}`); }
  { const r = rid(603), req = { calculator_id: HP, inputs: { rpm: 5000 }, request_id: r };
    const o1 = await call(U.A, req), o2 = await call(U.A, req);
    rec(ID, 'an INCOMPLETE result is persisted and replayed', o1.outcome === 'created' && o1.record.result_state === 'incomplete' && o2.outcome === 'replayed' && o2.record.record_id === o1.record.record_id, `${fmt(o1)} / ${fmt(o2)}`); }
  { const r = rid(604), req = { calculator_id: HP, inputs: { torq: 1, rpm: 1 }, request_id: r };
    const o1 = await call(U.X, req);
    await adm.query(`INSERT INTO auth.users (id) VALUES ('${U.X}')`);
    const o2 = await call(U.X, req);
    rec(ID, 'a failed transaction commits nothing; a later retry creates the record normally', o1.outcome === 'rejected' && o1.code === 'CF_PERSISTENCE' && o1.detail.sqlstate === '23503' && o2.outcome === 'created' && await rows(U.X, r) === 1, `${fmt(o1)} (${o1.detail && o1.detail.sqlstate}) / ${fmt(o2)}`); }
  { const r = rid(605), req = { calculator_id: HP, inputs: { torq: 350, rpm: 6000 }, request_id: r };
    const outs = await Promise.all([service.calculate({ owner_id: U.A }, req), service2.calculate({ owner_id: U.A }, req)]);
    const kinds = outs.map(o => o.outcome).sort().join(',');
    rec(ID, 'concurrent identical first requests: exactly one record; outcomes created + replayed', kinds === 'created,replayed' && await rows(U.A, r) === 1 && outs[0].record.record_id === outs[1].record.record_id, kinds); }
  { const r = rid(606);
    const outs = await Promise.all([service.calculate({ owner_id: U.A }, { calculator_id: HP, inputs: { torq: 350, rpm: 6000 }, request_id: r }), service2.calculate({ owner_id: U.A }, { calculator_id: HP, inputs: { torq: 351, rpm: 6000 }, request_id: r })]);
    const kinds = outs.map(o => o.outcome).sort().join(',');
    rec(ID, 'concurrent conflicting first requests: exactly one record; outcomes conflict + created', kinds === 'conflict,created' && await rows(U.A, r) === 1, kinds); }

  // ============ MACHINE ============
  const MC = 'machine';
  { const o = await call(U.A, { calculator_id: HP, inputs: { torq: 300, rpm: 4000 }, request_id: rid(700), machine_id: M.MA });
    rec(MC, 'own active machine -> created, machine_id recorded', o.outcome === 'created' && o.record.machine_id === M.MA && o.result.machine_id === M.MA, fmt(o)); }
  { const o = await call(U.A, { calculator_id: HP, inputs: { torq: 300, rpm: 4000 }, request_id: rid(701), machine_id: M.MH });
    rec(MC, 'own hypothetical machine is permitted', o.outcome === 'created' && o.record.machine_id === M.MH, fmt(o)); }
  { const o = await call(U.A, { calculator_id: HP, inputs: { torq: 300, rpm: 4000 }, request_id: rid(702) });
    rec(MC, 'standalone calculation (no machine) -> machine_id null', o.outcome === 'created' && o.record.machine_id === null, fmt(o)); }
  await expectReject(MC, 'soft-deleted machine -> CF_MACHINE_NOT_FOUND, no record', U.A, { calculator_id: HP, inputs: { torq: 1, rpm: 1 }, request_id: rid(703), machine_id: M.MD }, 'CF_MACHINE_NOT_FOUND');
  await expectReject(MC, 'machine in a soft-deleted garage -> CF_MACHINE_NOT_FOUND, no record', U.A, { calculator_id: HP, inputs: { torq: 1, rpm: 1 }, request_id: rid(704), machine_id: M.MG }, 'CF_MACHINE_NOT_FOUND');
  await expectReject(MC, "another owner's machine -> CF_MACHINE_NOT_FOUND, no record", U.A, { calculator_id: HP, inputs: { torq: 1, rpm: 1 }, request_id: rid(705), machine_id: M.MB }, 'CF_MACHINE_NOT_FOUND');
  await expectReject(MC, 'non-existent machine -> CF_MACHINE_NOT_FOUND, no record', U.A, { calculator_id: HP, inputs: { torq: 1, rpm: 1 }, request_id: rid(706), machine_id: M.MX }, 'CF_MACHINE_NOT_FOUND');
  { const repo = createRepository(svc2); let blocked = null;
    await repo.begin(); const active = await repo.activeMachine(U.A, M.MA);
    const other = await connect(dbName);
    try { await other.query("SET lock_timeout = '300ms'"); await other.query(`UPDATE public.machines SET deleted_at = now() WHERE id = '${M.MA}'`); blocked = false; }
    catch (e) { blocked = e.code === '55P03'; } finally { await other.end(); await repo.rollback(); }
    rec(MC, 'the machine check locks the machine row: a concurrent soft delete waits (lock_not_available)', active === true && blocked === true, `active ${active}, concurrent delete blocked ${blocked}`); }

  // ============ SECURITY ============
  const SE = 'security';
  const aRec = rid(700);
  { const r = await asRole('authenticated', U.A, `INSERT INTO public.calculation_records (owner_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
      VALUES ('${U.A}', '${HP}', '${HP}', '1.1.0', 'GH_LEGACY_FORMULAS', '${src.fingerprint(HP)}', 'valid', '{}', '[]', '${rid(800)}')`);
    rec(SE, 'a client (authenticated) cannot INSERT calculation records', !r.ok && r.code === '42501', r.ok ? 'UNEXPECTEDLY SUCCEEDED' : r.code); }
  { const r = await asRole('authenticated', U.A, `UPDATE public.calculation_records SET warnings = '{}' WHERE request_id = '${aRec}'`);
    rec(SE, 'a client cannot UPDATE its own record', !r.ok && r.code === '42501', r.ok ? 'UNEXPECTEDLY SUCCEEDED' : r.code); }
  { const r = await asRole('authenticated', U.A, `DELETE FROM public.calculation_records WHERE request_id = '${aRec}'`);
    rec(SE, 'a client cannot DELETE its own record', !r.ok && r.code === '42501', r.ok ? 'UNEXPECTEDLY SUCCEEDED' : r.code); }
  { const r = await asRole('service_role', null, `UPDATE public.calculation_records SET warnings = '{}' WHERE request_id = '${aRec}'`);
    rec(SE, 'mutation attempt: even the service role cannot UPDATE a persisted record (DF_IMMUTABLE)', !r.ok && r.code === 'P0001' && /DF_IMMUTABLE/.test(r.msg), r.ok ? 'UNEXPECTEDLY SUCCEEDED' : r.msg); }
  { const r = await asRole('service_role', null, `DELETE FROM public.calculation_records WHERE request_id = '${aRec}'`);
    rec(SE, 'deletion attempt: even the service role cannot DELETE a persisted record (DF_IMMUTABLE)', !r.ok && r.code === 'P0001', r.ok ? 'UNEXPECTEDLY SUCCEEDED' : r.msg); }
  { let r; try { await adm.query(`UPDATE public.calculation_records SET warnings = '{}' WHERE request_id = '${aRec}'`); r = 'UNEXPECTEDLY SUCCEEDED'; } catch (e) { r = e.code; }
    rec(SE, 'records are immutable for every role, including the superuser', r === 'P0001', r); }
  { const own = await asRole('authenticated', U.A, 'SELECT count(*)::int n FROM public.calculation_records'), total = Number((await adm.query(`SELECT count(*) FROM public.calculation_records WHERE owner_id = '${U.A}'`)).rows[0].count);
    const other = await asRole('authenticated', U.B, `SELECT count(*)::int n FROM public.calculation_records WHERE owner_id = '${U.A}'`);
    rec(SE, "owners read only their own records (frozen RLS): A sees all of A's, B sees none of A's", own.ok && own.rows[0].n === total && other.ok && other.rows[0].n === 0, `A ${own.rows && own.rows[0].n}/${total}; B sees ${other.rows && other.rows[0].n}`); }
  { const r = await asRole('anon', null, 'SELECT count(*) FROM public.calculation_records');
    rec(SE, 'anon cannot read calculation records', !r.ok && r.code === '42501', r.ok ? 'UNEXPECTEDLY SUCCEEDED' : r.code); }
  const svcInsert = (fields) => asRole('service_role', null, `INSERT INTO public.calculation_records (owner_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
    VALUES ('${U.A}', '${fields.calc}', '${fields.canon}', '1.1.0', 'GH_LEGACY_FORMULAS', '${fields.fv}', 'valid', '{}', '[]', '${fields.rid}')`);
  { const r = await svcInsert({ calc: HP, canon: HP, fv: 'fv1-00000000', rid: rid(801) });
    rec(SE, 'frozen contract: an invalid formula_version is rejected by the database (FK)', !r.ok && r.code === '23503', r.ok ? 'UNEXPECTEDLY SUCCEEDED' : r.code); }
  { const r = await svcInsert({ calc: HP, canon: HP, fv: src.fingerprint(TQ), rid: rid(802) });
    rec(SE, "frozen contract: another calculator's fingerprint is rejected by the database (FK)", !r.ok && r.code === '23503', r.ok ? 'UNEXPECTEDLY SUCCEEDED' : r.code); }
  { const r = await svcInsert({ calc: 'volumetric_efficiency', canon: 'fraction_decimal', fv: src.fingerprint('fraction_decimal'), rid: rid(803) });
    rec(SE, 'frozen contract: an alias with an incorrect canonical_id is rejected by the database', !r.ok && r.code === '23514', r.ok ? 'UNEXPECTEDLY SUCCEEDED' : r.code); }
  { const r = await svcInsert({ calc: HP, canon: HP, fv: src.fingerprint(HP), rid: rid(600) });
    rec(SE, 'frozen contract: a duplicate (owner, request_id) is rejected by the database', !r.ok && r.code === '23505', r.ok ? 'UNEXPECTEDLY SUCCEEDED' : r.code); }
  { const bad = Number((await adm.query(`SELECT count(*) FROM public.calculation_records WHERE owner_id NOT IN ('${U.A}','${U.B}','${U.P}','${U.X}')`)).rows[0].count);
    rec(SE, 'every record belongs to a trusted-context owner', bad === 0, `${bad} foreign-owner rows`); }

  // ============ PARITY (P2) + ROUNDTRIP (P4) ============
  const par = await P.runParity(service, S.vectors, U.P);
  rec('parity', 'P2 all 252 proven calculators bound to live fields and covered', S.bindFailures.length === 0 && par.calculators === 252, `${par.calculators}/252; bind failures ${S.bindFailures.length}`);
  rec('parity', 'P2 every vector created a record (defaults, all x1.07, each x1.13, each = 0, every categorical choice)', par.notCreated === 0 && par.vectors > 0, `${par.vectors} vectors; not created ${par.notCreated}`);
  rec('parity', 'P2 service engine result byte-identical JSON to the in-page GH_ENGINE for every vector', par.mismatches === 0 && par.calculatorsExact === 252, `${par.vectors - par.mismatches}/${par.vectors} vectors; ${par.comparisons} output comparisons; ${par.calculatorsExact}/252 calculators exact`);
  const rt = await P.runRoundTrip(adm, par.executed, U.P);
  rec('roundtrip', 'P4 one persisted row per P2 execution', rt.rows === rt.executed && rt.executed === par.vectors, `${rt.rows} rows / ${rt.executed} executions`);
  rec('roundtrip', 'P4 every persisted row equals the stored projection of its engine result exactly', rt.equal === rt.executed, `${rt.equal}/${rt.executed}`);
  rec('roundtrip', 'P4 every persisted outputs array keeps the engine order (output_index)', rt.outputsInOrder === rt.executed, `${rt.outputsInOrder}/${rt.executed}`);
  { const byRid = new Map((await adm.query('SELECT request_id, calculator_id, canonical_id, machine_id, inputs FROM public.calculation_records WHERE owner_id = $1', [U.P])).rows.map(r => [r.request_id, r]));
    let same = 0;
    for (const e of par.executed) { const r = byRid.get(e.request_id); if (!r) continue;
      const fromRow = identity({ calculator_id: r.calculator_id, canonical_id: r.canonical_id, machine_id: r.machine_id, inputs: r.inputs });
      const fromRequest = identity({ calculator_id: e.result.calculator_id, canonical_id: e.result.canonical_id, machine_id: null, inputs: e.vector });
      if (fromRow === fromRequest) same++; }
    rec('roundtrip', 'T-ID-RT: the canonical identity recomputed from each stored jsonb row equals the identity of its original request', same === par.executed.length && same > 0, `${same}/${par.executed.length}`); }

  // ============ PERSISTENCE ============
  const PE = 'persistence';
  { const r = (await adm.query('SELECT count(*) FILTER (WHERE input_value_ids IS NOT NULL)::int v, count(*) FILTER (WHERE result_state::text <> lower(result_state::text))::int s, count(*) FILTER (WHERE created_at > now())::int t, count(*)::int n FROM public.calculation_records')).rows[0];
    rec(PE, 'input_value_ids is NULL on every record (D4)', r.v === 0, `${r.v}/${r.n}`);
    rec(PE, 'result_state stored lowercase for every record', r.s === 0, `${r.s}/${r.n}`);
    rec(PE, 'created_at is server-set on every record', r.t === 0 && r.n > 0, `${r.n} records`); }
  { const r = (await adm.query(`SELECT r.calculator_id, r.formula_version FROM public.calculation_records r
      WHERE NOT EXISTS (SELECT 1 FROM public.calculators c WHERE c.calculator_id = r.canonical_id AND c.engine_proven)`)).rows;
    rec(PE, 'every persisted record is for a proven canonical calculator (no unproven record exists)', r.length === 0, `${r.length} unproven records`); }

  // ============ BOUNDARY ============
  const BO = 'boundary';
  { const r = (await adm.query('SELECT (SELECT count(*) FROM public.canonical_fields)::int f, (SELECT count(*) FROM public.value_records)::int v')).rows[0];
    rec(BO, 'no canonical_fields seed and no value_records written (D4)', r.f === 0 && r.v === 0, `canonical_fields ${r.f}, value_records ${r.v}`); }
  { const fp = (await adm.query(FP_SQL)).rows.map(x => x.x);
    rec(BO, 'no database object created or changed: catalog fingerprint identical to the frozen template', JSON.stringify(fp) === JSON.stringify(S.fpTemplate), `${fp.length} catalog entries`); }
  { const fsList = fs.existsSync(path.join(HERE, 'supabase'));
    rec(BO, 'calculation-foundation/ contains no supabase/ directory and no migration', !fsList, fsList ? 'present' : 'absent'); }

  await adm.end(); await svc1.end(); await svc2.end();
  return { results, parity: par, roundtrip: rt };
}

/* ---------------------------------------------------------------- main */
(async () => {
  const S = await setup();
  const main = await runSuite(S, 'cf_main', null);
  const groups = [...new Set(main.results.map(r => r.group))];
  console.log('='.repeat(72)); console.log('GEARHEAD LABS - CALCULATION-FOUNDATION 1.0.0 - SUITE'); console.log('='.repeat(72));
  for (const line of S.sources.report) console.log('  ' + line);
  let fails = 0;
  for (const g of groups) { const rs = main.results.filter(r => r.group === g), f = rs.filter(r => !r.ok); fails += f.length;
    console.log(`[${f.length ? 'FAIL' : 'PASS'}] ${g.toUpperCase().padEnd(16)} ${rs.length - f.length} passed, ${f.length} failed`);
    f.forEach(x => console.log(`    x ${x.name}\n        ${x.detail}`)); }
  console.log(`[INFO] P2 ${main.parity.vectors} vectors, ${main.parity.comparisons} output comparisons, ${main.parity.calculatorsExact}/252 calculators byte-identical`);
  console.log(`[INFO] P4 ${main.roundtrip.equal}/${main.roundtrip.executed} persisted rows equal their projection`);
  console.log(`\nTOTAL ${main.results.length} checks, ${main.results.length - fails} passed, ${fails} failed`);

  const neg = [];
  for (let i = 0; i < MUTANTS.length; i++) {
    const [name, build] = MUTANTS[i];
    let r, err = '';
    try { r = await runSuite(S, `cf_mutant_${i}`, build(S.sources)); } catch (e) { err = e.message.split('\n')[0]; }
    const failed = r ? r.results.filter(x => !x.ok) : [];
    neg.push({ mutation: name, detected: !!err || failed.length > 0, failed_checks: failed.map(x => x.name), error: err });
  }
  const undetected = neg.filter(n => !n.detected);
  console.log(`\n[${undetected.length ? 'FAIL' : 'PASS'}] NEGATIVE_CONTROLS ${neg.length - undetected.length}/${neg.length} mutants detected`);
  neg.forEach(n => console.log(`    ${n.detected ? '+' : 'x'} ${n.mutation}: ${n.error ? 'suite error' : n.failed_checks.length + ' check(s) failed'}`));

  fs.writeFileSync(path.join(HERE, 'evidence', 'test-results.json'), JSON.stringify({ checks: main.results, negative_controls: neg }, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'evidence', 'parity-results.json'), JSON.stringify({
    p2: { calculators: main.parity.calculators, calculators_exact: main.parity.calculatorsExact, vectors: main.parity.vectors,
      output_comparisons: main.parity.comparisons, mismatches: main.parity.mismatches, per_calculator: main.parity.perCalc },
    p4: { rows: main.roundtrip.rows, executed: main.roundtrip.executed, equal: main.roundtrip.equal, outputs_in_order: main.roundtrip.outputsInOrder } }, null, 1) + '\n');
  const pass = fails === 0 && undetected.length === 0;
  console.log(pass ? '\nCALCULATION-FOUNDATION SUITE: PASS' : '\nCALCULATION-FOUNDATION SUITE: FAIL');
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('SUITE ERROR:', e.stack || e); process.exit(2); });
