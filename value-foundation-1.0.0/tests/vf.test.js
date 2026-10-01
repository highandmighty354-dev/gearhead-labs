#!/usr/bin/env node
/* VALUE-FOUNDATION 1.0.0 - deterministic acceptance suite (approved specification §U 1-18).
 *
 * Database stack, every frozen layer READ FROM ITS OWN TAG: test-only shim + DATA-FOUNDATION 0001-0005
 * (DATA-FOUNDATION-1.0.0) + GARAGE-FOUNDATION 0101-0103 (GARAGE-FOUNDATION-1.0.0) + 0201 (DATA-FOUNDATION-1.1.0),
 * then this milestone's 0301 seed. The frozen CALCULATION-FOUNDATION service is loaded from its tag. Every run (main
 * and each negative control) uses fresh databases. No id, timestamp or hash is printed: output is byte-reproducible. */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const { Client } = require('pg');
const { readRecords } = require('../src/csv');
const { loadAdmission } = require('../src/admission');
const { createSpecificationValues } = require('../src/values');
const { createValueEngineAdapter } = require('../src/adapter');
const VU = require('../src/units');
const GEN = require('../tools/generate');
const DFR = require('../../data-foundation-1.1.0/src/repository');
const DFU = require('../../data-foundation-1.1.0/src/units');
const { MUTANTS } = require('./mutants');

const HERE = path.resolve(__dirname, '..'), REPO = path.resolve(HERE, '..');
const cfg = { host: process.env.VF_PGHOST, port: +process.env.VF_PGPORT, user: 'postgres' };
const PG_BIN = process.env.VF_PG_BIN;
const TAG = { DF: 'DATA-FOUNDATION-1.0.0', GF: 'GARAGE-FOUNDATION-1.0.0', DF11: 'DATA-FOUNDATION-1.1.0', CF: 'CALCULATION-FOUNDATION-1.0.0' };
const atTag = (tag, f) => execFileSync('git', ['-C', REPO, 'show', `${tag}:${f}`], { maxBuffer: 64 << 20 });
const STACK = [
  ...['tests/sql/000_supabase_shim.sql', 'supabase/migrations/0001_enums.sql', 'supabase/migrations/0002_tables.sql',
    'supabase/migrations/0003_constraints_triggers.sql', 'supabase/migrations/0004_rls.sql', 'supabase/migrations/0005_reference_seed.sql']
    .map(f => [TAG.DF, 'data-foundation/' + f]),
  ...['0101_test_setups.sql', '0102_test_setups_triggers.sql', '0103_test_setups_rls.sql'].map(f => [TAG.GF, 'garage-foundation/supabase/migrations/' + f]),
  [TAG.DF11, 'data-foundation-1.1.0/supabase/migrations/0201_value_write_boundary.sql'],
];
const SEED = path.join(HERE, GEN.OUT.seed), ROLLBACK = path.join(HERE, GEN.OUT.rollback);

const U = { A: 'aaaaaaaa-0000-4000-8000-00000000000a', B: 'bbbbbbbb-0000-4000-8000-00000000000b' };
const G = { GA: '10000000-0000-4000-8000-0000000000a1', GA2: '10000000-0000-4000-8000-0000000000a2', GB: '10000000-0000-4000-8000-0000000000b1' };
const M = { MA: '20000000-0000-4000-8000-0000000000a1', MS: '20000000-0000-4000-8000-0000000000a5', MC: '20000000-0000-4000-8000-0000000000a6',
  MD: '20000000-0000-4000-8000-0000000000a3', MG: '20000000-0000-4000-8000-0000000000a4', MB: '20000000-0000-4000-8000-0000000000b1' };
let ridN = 0; const rid = () => 'e0000000-0000-4000-8000-' + String(++ridN).padStart(12, '0');

const FP_SQL = `SELECT x FROM (
  SELECT 'col '||table_schema||'.'||table_name||'.'||column_name||' '||udt_name||' '||is_nullable||' '||coalesce(column_default,'') x
    FROM information_schema.columns WHERE table_schema IN ('public','auth')
  UNION ALL SELECT 'con '||conrelid::regclass::text||' '||conname||' '||pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace IN ('public'::regnamespace,'auth'::regnamespace)
  UNION ALL SELECT 'idx '||indexdef FROM pg_indexes WHERE schemaname IN ('public','auth')
  UNION ALL SELECT 'pol '||tablename||' '||policyname||' '||cmd||' '||array_to_string(roles,',')||' '||coalesce(qual,'')||' '||coalesce(with_check,'') FROM pg_policies WHERE schemaname IN ('public','auth')
  UNION ALL SELECT 'trg '||pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace IN ('public'::regnamespace,'auth'::regnamespace)
  UNION ALL SELECT 'fn '||n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||') '||md5(pg_get_functiondef(p.oid))||' '||p.prosecdef||' '||coalesce(array_to_string(p.proacl,','),'')
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','auth') AND p.prokind='f'
  UNION ALL SELECT 'enum '||t.typname||' '||string_agg(e.enumlabel,',' ORDER BY e.enumsortorder) FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid GROUP BY t.typname
  UNION ALL SELECT 'rel '||n.nspname||'.'||c.relname||' '||c.relkind::text||' '||c.relrowsecurity||' '||c.relforcerowsecurity||' '||coalesce(array_to_string(c.relacl,','),'')
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth')
  UNION ALL SELECT 'colacl '||c.relname||'.'||a.attname||' '||array_to_string(a.attacl,',') FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    WHERE a.attacl IS NOT NULL AND c.relnamespace IN ('public'::regnamespace,'auth'::regnamespace)
) s ORDER BY x`;
const CF_ROWS_SQL = `SELECT key||'|'||family||'|'||coalesce(dimension,'<NULL>')||'|'||canonical_unit||'|'||value_kind||'|'||coalesce(description,'<NULL>') r FROM public.canonical_fields ORDER BY key`;

async function connect(db) { const c = new Client({ ...cfg, database: db }); await c.connect(); return c; }
async function freshDb(name, template) {
  const a = await connect('postgres'); await a.query(`DROP DATABASE IF EXISTS ${name}`);
  await a.query(template ? `CREATE DATABASE ${name} TEMPLATE ${template}` : `CREATE DATABASE ${name}`); await a.end();
}
async function dropDb(name) { const a = await connect('postgres'); await a.query(`DROP DATABASE IF EXISTS ${name}`); await a.end(); }
const rowsOf = async (c, sql, p) => (await c.query(sql, p)).rows;
const fingerprint = async c => (await c.query(FP_SQL)).rows.map(r => r.x);
async function applySql(c, sql) {
  try { await c.query(sql); return { ok: true }; }
  catch (e) { try { await c.query('ROLLBACK'); } catch (_) { /* none open */ } return { ok: false, code: e.code, msg: e.message.split('\n')[0] }; }
}
const dump = db => execFileSync(path.join(PG_BIN, 'pg_dump'), ['-h', cfg.host, '-p', String(cfg.port), '-U', 'postgres', db]).toString()
  .split('\n').filter(l => !/^\\(un)?restrict /.test(l)).join('\n');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function loadFrozenCalculation() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-cf-'));
  const files = execFileSync('git', ['-C', REPO, 'ls-tree', '--name-only', `${TAG.CF}:calculation-foundation/src`]).toString().trim().split('\n');
  for (const f of files) fs.writeFileSync(path.join(dir, f), atTag(TAG.CF, 'calculation-foundation/src/' + f));
  const F = require(path.join(dir, 'frozen-sources.js'));
  const mod = { sources: F.loadFrozenSources(F.readFrozenBytesFromTags(REPO)), svc: require(path.join(dir, 'service.js')),
    repo: require(path.join(dir, 'repository.js')), authority: require(path.join(dir, 'authority.js')) };
  fs.rmSync(dir, { recursive: true, force: true });
  return mod;
}

async function setup() {
  const cf = loadFrozenCalculation();
  const gen = GEN.build(cf.sources);
  const adm = readRecords(fs.readFileSync(path.join(HERE, 'config/VALUE-FOUNDATION-V1-FINAL-ADMISSION-48.csv'), 'utf8'));
  const dfr = readRecords(fs.readFileSync(path.join(HERE, 'config/VALUE-FOUNDATION-V1-DEFERRED-REGISTER.csv'), 'utf8'));
  const spec = fs.readFileSync(path.join(HERE, 'design/VALUE-FOUNDATION-V1-FINAL-SPECIFICATION.md'), 'utf8');

  await freshDb('vf_stack');                                   // frozen stack, no fixtures, no 0301
  let t = await connect('vf_stack');
  for (const [tag, f] of STACK) await t.query(atTag(tag, f).toString('utf8'));
  const fpStack = await fingerprint(t); const rowsStack = (await rowsOf(t, CF_ROWS_SQL)).map(r => r.r);
  await t.end();

  await freshDb('vf_base', 'vf_stack');                        // + fixtures
  t = await connect('vf_base');
  await t.query(`INSERT INTO auth.users (id) VALUES ('${U.A}'), ('${U.B}')`);
  await t.query(`INSERT INTO public.garages (id, owner_id, name) VALUES ('${G.GA2}','${U.A}','A deleted garage')`);
  await t.query(`INSERT INTO public.machines (id, owner_id, garage_id, name, machine_type) VALUES ('${M.MG}','${U.A}','${G.GA2}','A in deleted garage','automotive')`);
  await t.query(`UPDATE public.garages SET deleted_at = now() WHERE id = '${G.GA2}'`);
  await t.query(`INSERT INTO public.garages (id, owner_id, name) VALUES ('${G.GA}','${U.A}','A garage'), ('${G.GB}','${U.B}','B garage')`);
  await t.query(`INSERT INTO public.machines (id, owner_id, garage_id, name, machine_type) VALUES
    ('${M.MA}','${U.A}','${G.GA}','A main','automotive'), ('${M.MS}','${U.A}','${G.GA}','A semantics','automotive'),
    ('${M.MC}','${U.A}','${G.GA}','A calc','automotive'), ('${M.MD}','${U.A}','${G.GA}','A soft-deleted','automotive'),
    ('${M.MB}','${U.B}','${G.GB}','B main','automotive')`);
  await t.query(`UPDATE public.machines SET deleted_at = now() WHERE id = '${M.MD}'`);
  await t.end();
  return { cf, gen, adm, dfr, spec, fpStack, rowsStack, seed: fs.readFileSync(SEED, 'utf8'), rollback: fs.readFileSync(ROLLBACK, 'utf8') };
}

/* ---------------------------------------------------------------- one suite run */
async function runSuite(S, db, mutant) {
  const results = [];
  const rec = (group, name, ok, detail) => results.push({ group, name, ok: !!ok, detail: String(detail === undefined ? '' : detail) });
  const mu = mutant || {};
  const seedSql = mu.seed ? mu.seed(S.seed) : S.seed, rollbackSql = mu.rollback ? mu.rollback(S.rollback) : S.rollback;
  const admission = loadAdmission(mu.config ? mu.config(JSON.parse(JSON.stringify(S.gen.config))) : undefined);
  const scratch = [];
  const scratchDb = async (suffix, template) => { const n = `${db}_${suffix}`; scratch.push(n); await freshDb(n, template); return connect(n); };
  const UROLE = /(^|_)(spec|specification|measured|calculated|derived|estimated|target|goal|desired|actual|current|default|nominal|setpoint)(_|$)/;
  const USLUG = /_(in|mm|cc|gal|lbf|n|l|deg|kwh|tpi|to_1|sq_in|sq_ft|ratio_to_1)$/;

  // ============ INTEGRITY ============
  const IN = 'integrity';
  for (const [name, f, want] of [['approved specification', 'design/VALUE-FOUNDATION-V1-FINAL-SPECIFICATION.md', 'a28cfddb7a5bb43f0767a5dd04ed0ea9acf67616c4b9f264b1ebc0e737560555'],
    ['admission artifact', 'config/VALUE-FOUNDATION-V1-FINAL-ADMISSION-48.csv', 'f9b91aa8a653c76fa3cb56b94e5d62e0538ba7e929b09f77fab89e33aa205d9f'],
    ['deferred register', 'config/VALUE-FOUNDATION-V1-DEFERRED-REGISTER.csv', 'f2fa130db594e9cb15442041b6e706a11595adbc1b41fc74c022ddd48cc85f04']]) {
    const h = sha(fs.readFileSync(path.join(HERE, f)));
    rec(IN, `${name} is the approved original, byte for byte (SHA-256 ${want.slice(0, 12)}...)`, h === want, h === want ? 'match' : 'MISMATCH');
  }
  { const files = ['config/admission-config.json', GEN.OUT.seed, GEN.OUT.rollback];
    const want = [S.gen.configText, S.gen.seed, S.gen.rollback];
    const ok = files.every((f, i) => fs.readFileSync(path.join(HERE, f), 'utf8') === want[i]);
    rec(IN, 'generation check: committed configuration, 0301 seed and rollback are byte-identical to their mechanical derivation', ok, ok ? '3/3 identical' : 'DIFF'); }
  { const df11 = ['errors.js', 'repository.js', 'service.js', 'units.js', 'validate.js'].every(f => atTag(TAG.DF11, 'data-foundation-1.1.0/src/' + f).toString() === fs.readFileSync(path.join(REPO, 'data-foundation-1.1.0/src', f), 'utf8'));
    rec(IN, 'the trusted write path used is the closed DATA-FOUNDATION-1.1.0 source, byte-identical to its tag', df11, df11 ? '5/5 identical' : 'DIFF');
    const stack = STACK.every(([tag, f]) => atTag(tag, f).toString() === fs.readFileSync(path.join(REPO, f), 'utf8'));
    rec(IN, 'database stack (DATA 0001-0005, GARAGE 0101-0103, 0201) read from tags equals the working tree', stack, `${STACK.length} files`); }
  { const src = ['csv.js', 'admission.js', 'units.js', 'values.js', 'adapter.js'].map(f => fs.readFileSync(path.join(HERE, 'src', f), 'utf8'));
    const code = src.map(s => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/'[^'\n]*'/g, "''")).join('\n');
    const reqs = [...src.join('\n').matchAll(/require\(\s*'([^']+)'\s*\)/g)].map(m => m[1]);
    const allowed = r => r.startsWith('./') || r.startsWith('../../data-foundation-1.1.0/src/') || ['fs', 'path', 'crypto'].includes(r);
    const literals = (code.match(/(?<![\w.])\d+\.\d+/g) || []);
    const f1 = /gh-engine|GH_ENGINE|F1_12_3|batch9|fieldDisplayValue|convertFromDisplay|canonicalUnit\(|toFixed|Math\.round|INSERT|UPDATE|DELETE|value_records/.test(code);
    rec(IN, '[U16] Value Foundation source: no F1/engine code, no SQL, no own conversion constant, no rounding; only DATA-FOUNDATION-1.1.0 / local requires',
      reqs.every(allowed) && literals.length === 0 && !f1, `requires ok ${reqs.every(allowed)}; decimal literals ${literals.length}; F1/SQL markers ${f1}`); }

  // ============ ADMISSION (U1-U4, U12, U13) ============
  const AD = 'admission';
  const fields = admission.config.fields, keyRows = admission.config.keys;
  rec(AD, '[U1] exactly 48 admitted source fields -> 47 canonical quantity keys', fields.length === 48 && admission.keys().length === 47, `${fields.length} -> ${admission.keys().length}`);
  { const want = S.adm.map(r => [r.draft_field_id, r.canonical_key, r.engine_key, r.storage_unit_D002, r.value_role]);
    const got = fields.map(f => [f.draft_field_id, f.canonical_key, f.engine_key, f.storage_unit, f.value_role]);
    rec(AD, '[U1] configuration equals the approved admission artifact row for row (source field, key, engine key, storage unit, role)', same(want, got), same(want, got) ? '48/48' : 'DIFF'); }
  { const specD = [...S.spec.slice(S.spec.indexOf('## D. '), S.spec.indexOf('## E. ')).matchAll(/^\| (\d+) \| `([a-z0-9_]+)` \| `([a-z0-9_]+)` \| `([^`]+)` \|/gm)].map(m => [m[2], m[3], m[4]]);
    rec(AD, '[U1] configuration equals the approved specification §D table, in order', same(specD, fields.map(f => [f.canonical_key, f.draft_field_id, f.engine_key])), `${specD.length} rows`);
    const specE = new Set([...S.spec.slice(S.spec.indexOf('## E. '), S.spec.indexOf('## F. ')).matchAll(/`([a-z][a-z0-9_]*)`/g)].map(m => m[1]));
    rec(AD, '[U1] the 47 keys are exactly the §E key table', admission.keys().every(k => specE.has(k)) && admission.keys().length === 47, `${admission.keys().filter(k => specE.has(k)).length}/47 in §E`); }
  { const deferred = new Set(S.dfr.map(r => r.draft_field_id)), leaked = fields.filter(f => deferred.has(f.draft_field_id));
    rec(AD, '[U1][U13] no deferred-register field is in the production admission set', leaked.length === 0 && S.dfr.length === 52, `${leaked.length} leaked of ${S.dfr.length} deferred`); }
  { const c = {}; for (const f of fields) c[f.canonical_key] = (c[f.canonical_key] || 0) + 1;
    const shared = Object.keys(c).filter(k => c[k] > 1);
    rec(AD, '[U2] one key per quantity: the only shared key is vehicle_cg_height', same(shared, ['vehicle_cg_height']), shared.join(','));
    const vcg = fields.filter(f => f.canonical_key === 'vehicle_cg_height').map(f => `${f.draft_field_id}>${f.engine_key}`).sort();
    rec(AD, '[U2] vehicle_cg_height covers exactly its 2 approved source fields', same(vcg, ['center_of_gravity_height__in>anti_squat.cg', 'vehicle_cg_height__in>anti_dive.cgH']), vcg.join(' ')); }
  { const keys = admission.keys();
    const badRe = keys.filter(k => !/^[a-z][a-z0-9_]*$/.test(k)), slug = keys.filter(k => USLUG.test(k)), role = keys.filter(k => UROLE.test(k));
    const calc = fields.filter(f => f.canonical_key === f.calculator_id).map(f => f.canonical_key);
    rec(AD, '[U3] key naming: frozen regex; no unit slug; no value-role word; no key named after its own source calculator',
      !badRe.length && !slug.length && !role.length && !calc.length, `regex ${badRe.length}, slug ${slug.length}, role ${role.length}, own-calculator ${calc.length}`); }
  { const present = ['supercharger_to_crank_speed_ratio', 'clutch_release_force'].every(k => admission.isAdmitted(k));
    const absent = ['supercharger_drive_ratio', 'clutch_required_release_force'].every(k => !admission.isAdmitted(k));
    rec(AD, '[U3] approved renames present; old names absent', present && absent, `present ${present}, old absent ${absent}`); }
  { const C = (r => r.fields || r)(JSON.parse(fs.readFileSync(path.join(REPO, 'mapping-foundation/registry/canonical-fields.json'), 'utf8')));
    const bad = fields.filter(f => { const m = C.find(x => x.key === f.draft_field_id); return !m || m.canonical_unit !== f.storage_unit; });
    const adm = S.adm.filter(r => r.storage_unit_D002 !== r.engine_native_unit);
    rec(AD, '[U4] storage unit = engine-native unit (artifact) = the frozen F1 input unit (MAPPING-FOUNDATION, verbatim source) for all 48',
      bad.length === 0 && adm.length === 0, `${bad.length + adm.length} differ`); }
  { const ok = fields.every(f => same([...f.input_units.map(u => u.token)].sort(), [...DFU.inputUnitsFor(f.storage_unit)].sort()));
    rec(AD, '[U4] every field\u2019s admitted units are exactly the trusted path\u2019s §H unit set for its storage unit', ok, ok ? '48/48' : 'DIFF'); }
  { const ok = fields.every(f => { const d = S.cf.sources.describe(f.calculator_id); return S.cf.sources.isProven(f.calculator_id) && d.canonical_id === f.calculator_id && d.inputs.some(i => i.var === f.var); });
    rec(AD, '[U14] every engine key is an input of a proven canonical frozen calculator', ok, ok ? '48/48' : 'DIFF'); }
  { const cat = keyRows.filter(k => k.value_kind !== 'numeric').length;
    const bt = admission.keys().filter(k => /^bearing_type/.test(k)).length + fields.filter(f => /^bearing_type/.test(f.draft_field_id)).length;
    rec(AD, '[U12] no categorical field admitted (OWN-6): all 47 keys numeric; bearing_type neither a key nor a source field', cat === 0 && bt === 0, `categorical ${cat}; bearing_type ${bt}`); }
  { const mi = S.dfr.filter(r => r.category.includes('MULTI-INSTANCE')).map(r => r.draft_field_id).sort();
    const q = [...S.spec.slice(S.spec.indexOf('## Q. '), S.spec.indexOf('## R. ')).matchAll(/^\| `([a-z0-9_]+)` \|/gm)].map(m => m[1]).sort();
    const kpa = S.dfr.filter(r => /king_pin/.test(r.draft_field_id));
    rec(AD, '[U13] the 19 multi-instance exclusions (§Q) and king_pin_arm are in the deferred register, none admitted',
      mi.length === 19 && same(mi, q) && kpa.length === 1 && !fields.some(f => mi.includes(f.draft_field_id) || /king_pin/.test(f.draft_field_id)), `MI ${mi.length}, §Q ${q.length}, king_pin_arm ${kpa.length}`); }
  { const ek = new Set(fields.map(f => f.engine_key)), fedDeferred = S.dfr.filter(r => ek.has(r.engine_key));
    rec(AD, '[U13][U14] no deferred field\u2019s engine key is ever fed by the adapter configuration', fedDeferred.length === 0, `${fedDeferred.length} deferred engine keys fed`); }
  { const j = fields.find(f => f.draft_field_id === 'pipe_diameter__in'); const k = admission.key('jpipe_resonator_diameter');
    rec(AD, 'J-pipe: user-facing label says "Inside Diameter"; frozen label kept verbatim; key and engine key as approved',
      j && /Inside Diameter/.test(j.display_label) && j.frozen_label === 'Pipe Diameter' && j.canonical_key === 'jpipe_resonator_diameter' && j.engine_key === 'jpipe_resonator.dia_jp',
      j ? `${j.display_label} (frozen: ${j.frozen_label})` : 'missing');
    rec(AD, 'J-pipe: seeded description is the approved artifact\u2019s definition verbatim (inside-diameter engineering interpretation)',
      k && k.description === S.adm.find(r => r.draft_field_id === 'pipe_diameter__in').definition && /INSIDE diameter/.test(k.description), 'verbatim');
    const others = fields.filter(f => f.draft_field_id !== 'pipe_diameter__in' && f.display_label !== f.frozen_label).length;
    rec(AD, 'every other display label is the frozen calculator input label, verbatim (one approved override only)', others === 0, `${others} other overrides`); }
  { const g = fields.find(f => f.draft_field_id === 'def_tank__gal');
    rec(AD, 'gal (US): the artifact label is kept for display and mapped to the trusted token gal; §H unchanged',
      same(g.input_units, [{ label: 'gal (US)', token: 'gal' }, { label: 'L', token: 'L' }]) && admission.resolveUnit('def_tank_capacity', 'gal (US)') === 'gal' && DFU.TABLE.gal.L[1] === 3.785411784,
      g.input_units.map(u => `${u.label}->${u.token}`).join(', ')); }
  { const bad = [];
    for (const [l, m] of Object.entries(VU.LABELS)) { try { VU.unitsForArtifactEntry(l); } catch (e) { bad.push(l); } if (!DFU.STORAGE_UNITS.some(s => DFU.inputUnitsFor(s).includes(m.token))) bad.push(m.token); }
    let refused = 0; for (const x of ['gal (UK)', 'inch', 'MM', 'in, kg']) { try { VU.unitsForArtifactEntry(x); } catch (e) { refused++; } }
    rec(AD, 'unit-label table: every label maps to a real trusted-path token; unknown labels are refused, never guessed', bad.length === 0 && refused === 4, `${bad.length} bad; ${refused}/4 refused`); }

  // ============ MIGRATION (0301) ============
  const MG = 'migration';
  const expectedRows = [...new Map(S.adm.map(r => [r.canonical_key, `${r.canonical_key}|${r.mapping_foundation_family}|<NULL>|${r.storage_unit_D002}|numeric|${r.definition}`])).values()].sort();
  { const stmts = seedSql.replace(/--.*$/gm, '').replace(/DO \$\$[\s\S]*?END \$\$;/g, '').replace(/'(?:[^']|'')*'/g, "''");
    const ddl = (stmts.match(/\b(CREATE|ALTER|DROP|GRANT|REVOKE|COMMENT)\b[^;]*/gi) || []).map(s => s.replace(/\s+/g, ' ').slice(0, 40));
    rec(MG, '0301 creates no database object: its only DDL is a transaction-scoped TEMP table (ON COMMIT DROP)', ddl.length === 1 && /^CREATE TEMP TABLE vf_0301_expected/.test(ddl[0]) && /ON COMMIT DROP/.test(seedSql), ddl.join(' | ')); }
  const ci = await scratchDb('clean', 'vf_stack');
  const a1 = await applySql(ci, seedSql);
  rec(MG, 'clean install: 0301 applies on the frozen stack (DATA 1.0.0 + GARAGE + DATA 1.1.0)', a1.ok, a1.ok ? 'applied' : `${a1.code} ${a1.msg}`);
  const rows1 = (await rowsOf(ci, CF_ROWS_SQL)).map(r => r.r);
  rec(MG, '[U1] database holds exactly the 47 approved canonical_fields rows (family, dimension NULL, engine-native unit, numeric, approved definition)', same(rows1, expectedRows), `${rows1.length} rows; ${rows1.filter(r => !expectedRows.includes(r)).length} unexpected`);
  { const n = (await rowsOf(ci, "SELECT count(*)::int n FROM public.canonical_fields WHERE value_kind <> 'numeric' OR key LIKE 'bearing_type%'"))[0].n;
    rec(MG, '[U12] no categorical row is seeded (database)', n === 0, `${n} categorical rows`); }
  { const fp = await fingerprint(ci); rec(MG, '0301 changes rows only: catalog fingerprint identical to the frozen stack', same(fp, S.fpStack), `${fp.filter(x => !S.fpStack.includes(x)).length + S.fpStack.filter(x => !fp.includes(x)).length} differing entries`); }
  const d1 = dump(`${db}_clean`); const a2 = await applySql(ci, seedSql); const d2 = dump(`${db}_clean`);
  rec(MG, 'idempotent: re-running 0301 succeeds and the full schema+data dump is byte-identical', a2.ok && d1 === d2, a2.ok ? `dump ${d1 === d2 ? 'identical' : 'DIFFERS'}` : `${a2.code} ${a2.msg}`);
  const r1 = await applySql(ci, rollbackSql); const rowsR = (await rowsOf(ci, CF_ROWS_SQL)).map(r => r.r);
  rec(MG, 'rollback (no values yet) removes exactly the 47 rows: rows and catalog equal the frozen stack', r1.ok && same(rowsR, S.rowsStack) && same(await fingerprint(ci), S.fpStack), r1.ok ? `${rowsR.length} rows left` : `${r1.code} ${r1.msg}`);
  const r2 = await applySql(ci, rollbackSql);
  rec(MG, 'rollback is idempotent', r2.ok && same((await rowsOf(ci, CF_ROWS_SQL)).map(r => r.r), S.rowsStack), r2.ok ? 'ok' : `${r2.code} ${r2.msg}`);
  const a3 = await applySql(ci, seedSql);
  rec(MG, 're-applying 0301 after rollback restores the identical 47 rows', a3.ok && same((await rowsOf(ci, CF_ROWS_SQL)).map(r => r.r), expectedRows), a3.ok ? 'ok' : `${a3.code} ${a3.msg}`);
  await ci.end();
  for (const [label, sql] of [['a pre-existing row with a different unit', `INSERT INTO public.canonical_fields VALUES ('block_deck_height','ENGINE',NULL,'mm','numeric','conflicting')`],
    ['a pre-existing row with a different description', `INSERT INTO public.canonical_fields VALUES ('vehicle_cg_height','SUSPENSION, TIRES & GEOMETRY',NULL,'in','numeric','other text')`],
    ['a pre-existing old (renamed) key', `INSERT INTO public.canonical_fields VALUES ('supercharger_drive_ratio','x',NULL,':1','numeric',NULL)`],
    ['a pre-existing deferred field id as a key', `INSERT INTO public.canonical_fields VALUES ('rocker_ratio__to_1','x',NULL,':1','numeric',NULL)`]]) {
    const c = await scratchDb('conflict', 'vf_stack'); await c.query(sql);
    const before = (await rowsOf(c, CF_ROWS_SQL)).map(r => r.r); const r = await applySql(c, seedSql); const after = (await rowsOf(c, CF_ROWS_SQL)).map(r => r.r);
    rec(MG, `post-conditions, not ON CONFLICT alone: ${label} aborts 0301 and nothing is inserted`, !r.ok && /VF_0301_POSTCONDITION/.test(r.msg || '') && same(before, after), r.ok ? 'UNEXPECTEDLY APPLIED' : `aborted; rows ${before.length} -> ${after.length}`);
    await c.end(); await dropDb(`${db}_conflict`); scratch.pop();
  }

  // ---------------- run database: base (frozen stack + fixtures) + 0301 ----------------
  await freshDb(db, 'vf_base');
  const adm = await connect(db), s1 = await connect(db), k1 = await connect(db), k2 = await connect(db);
  const ap = await applySql(adm, seedSql);
  rec(MG, 'upgrade in place: 0301 applies to a populated database (accounts, garages, machines present)', ap.ok, ap.ok ? 'applied' : `${ap.code} ${ap.msg}`);
  const guard = async p => { try { return await p; } catch (e) { return { outcome: 'threw', code: 'THREW', reason: e.message.split('\n')[0] }; } };
  const values = createSpecificationValues({ repository: DFR.createRepository(s1), admission, components: mu.values });
  const calc = S.cf.svc.createCalculationService({ sources: S.cf.sources, repository: S.cf.repo.createRepository(k1) });
  const calcDirect = S.cf.svc.createCalculationService({ sources: S.cf.sources, repository: S.cf.repo.createRepository(k2) });
  let reads = 0;
  const countingValues = Object.freeze({ current: (o, q) => { reads++; return values.current(o, q); } });
  const adapter = createValueEngineAdapter({ admission, values: countingValues, calculationService: calc, sources: S.cf.sources, components: mu.adapter });
  const nVals = async () => (await rowsOf(adm, 'SELECT count(*)::int n FROM public.value_records'))[0].n;
  const nCalc = async () => (await rowsOf(adm, 'SELECT count(*)::int n FROM public.calculation_records'))[0].n;
  const stored = async id => (await rowsOf(adm, 'SELECT numeric_value, numeric_value::text AS txt, unit, provenance, owner_id FROM public.value_records WHERE id = $1', [id]))[0];
  const fmt = o => (!o ? 'none' : o.outcome === 'created' ? `created ${o.value.numeric_value === null ? 'null' : o.value.numeric_value} ${o.value.unit}` : `${o.outcome} ${o.code || ''} ${o.reason || ''}`);
  const W = (owner, key, value, unit, provenance, extra) => guard(values.write(owner ? { owner_id: owner } : undefined,
    Object.assign({ machine_id: M.MA, canonical_key: key, value, unit, provenance: provenance || 'manufacturer_specified' }, extra || {})));

  // ============ VALUES: units, zero/negative, invalid, unknown, current (U5-U8, U10, U11) ============
  const VA = 'values';
  const VEC = [
    ['block_deck_height', 25.4, 'mm', 1, '25.4 mm -> 1 in'], ['block_deck_height', 1, 'in', 1, '1 in -> 1 in'],
    ['block_deck_height', -12.7, 'mm', -0.5, '-12.7 mm -> -0.5 in'], ['block_deck_height', 12.7, 'mm', 0.5, '12.7 mm -> 0.5 in (exact division, not the reciprocal)'],
    ['block_deck_height', 76.2, 'mm', 3.0000000000000004, '76.2 mm -> 3.0000000000000004 in (binary64, unrounded)'],
    ['block_deck_height', 1000, 'mm', 39.37007874015748, '[U16] D-1 regression: 1000 mm -> 39.37007874015748 in'],
    ['clutch_clamp_load', 4.4482216152605, 'N', 1, '4.4482216152605 N -> 1 lbf'],
    ['def_tank_capacity', 3.785411784, 'L', 1, '3.785411784 L -> 1 gal'], ['def_tank_capacity', 5, 'gal (US)', 5, 'label gal (US) -> token gal: 5 -> 5 gal'],
    ['def_tank_capacity', 7, 'gal', 7, 'token gal accepted: 7 -> 7 gal'],
    ['piston_crown_volume', 1, 'cu in', 16.387064, '1 cu in -> 16.387064 cc'], ['piston_crown_volume', -5, 'cc', -5, '-5 cc stays -5 cc (dish sign preserved)'],
    ['intake_port_effective_flow_area', 645.16, 'mm²', 1, '645.16 mm² -> 1 sq in'], ['intake_port_effective_flow_area', 6.4516, 'cm²', 1, '6.4516 cm² -> 1 sq in'],
    ['vehicle_side_projected_area', 0.09290304, 'm²', 1, '0.09290304 m² -> 1 sq ft'],
    ['portal_hub_reduction_ratio', 3.73, ':1', 3.73, ':1 identity'], ['max_steer_angle_inside_wheel', 42.5, '°', 42.5, '° identity'],
    ['traction_battery_gross_energy', 75, 'kWh', 75, 'kWh identity'], ['lr_jacking_screw_thread_pitch', 18, 'TPI', 18, 'TPI identity']];
  for (const [k, v, u, want, label] of VEC) {
    const o = await W(U.A, k, v, u); const r = o.outcome === 'created' ? await stored(o.value.value_id) : null;
    rec(VA, `[U6] ${label}`, r && Object.is(r.numeric_value, want) && r.unit === admission.key(k).canonical_unit, r ? `stored ${r.txt} ${r.unit}` : fmt(o));
  }
  { const back = VU.toDisplayUnit('in', 'mm', 1); const o = await W(U.A, 'block_deck_height', back, 'mm'); const r = o.outcome === 'created' ? await stored(o.value.value_id) : null;
    rec(VA, '[U6] direction rule round trip: 1 in -> display 25.4 mm -> write 25.4 mm -> 1 in', back === 25.4 && r && r.numeric_value === 1, r ? `${back} mm -> ${r.txt} in` : fmt(o)); }
  for (const [v, u, label] of [[0, 'mm', 'explicit zero (0 mm) stored as a known 0'], [-0, 'in', '-0 stored as +0']]) {
    const o = await W(U.A, 'block_deck_height', v, u); const r = o.outcome === 'created' ? await stored(o.value.value_id) : null;
    rec(VA, `[U7] ${label}`, r && r.txt === '0' && Object.is(r.numeric_value, 0), r ? `stored ${r.txt}` : fmt(o));
  }
  for (const [k, v, u, code, label] of [
    ['block_deck_height', 1, 'kg', 'VF_UNSUPPORTED_UNIT', 'unsupported unit kg for a length'], ['def_tank_capacity', 1, 'gal (UK)', 'VF_UNSUPPORTED_UNIT', 'gal (UK) (not an admitted label)'],
    ['portal_hub_reduction_ratio', 1, 'mm', 'VF_UNSUPPORTED_UNIT', 'mm for a ratio'], ['lr_jacking_screw_thread_pitch', 1, 'mm', 'VF_UNSUPPORTED_UNIT', 'thread pitch in mm for TPI (reciprocal, not in V1)'],
    ['block_deck_height', NaN, 'in', 'VW_INVALID_VALUE', 'NaN input'], ['block_deck_height', Infinity, 'mm', 'VW_INVALID_VALUE', 'Infinity input'],
    ['piston_crown_volume', Number.MAX_VALUE, 'cu in', 'VW_INVALID_CONVERSION', 'non-finite result (overflow cu in -> cc)'],
    ['block_deck_height', 4, null, 'VW_UNSUPPORTED_UNIT', 'known value without a unit']]) {
    const before = await nVals(); const o = await W(U.A, k, v, u); const after = await nVals();
    rec(VA, `[U8] rejected, nothing stored: ${label}`, o.outcome === 'rejected' && o.code === code && after === before, `${fmt(o)}; rows +${after - before}`);
  }
  { const o = await W(U.A, 'clutch_slave_cylinder_bore', null, null, 'unknown'); const r = o.outcome === 'created' ? await stored(o.value.value_id) : null;
    rec(VA, '[U10] unknown = no value + provenance unknown (never 0, never a default)', r && r.numeric_value === null && r.provenance === 'unknown', r ? `stored ${r.txt === null ? 'NULL' : r.txt} ${r.provenance}` : fmt(o)); }
  for (const [label, req, code] of [['blank input is never stored', { machine_id: M.MA, canonical_key: 'block_deck_height', value: '', unit: 'in', provenance: 'user_entered' }, 'VW_INVALID_VALUE'],
    ['a missing value is never defaulted', { machine_id: M.MA, canonical_key: 'block_deck_height', unit: 'in', provenance: 'user_entered' }, 'VW_MALFORMED_REQUEST'],
    ['a numeric string is not coerced', { machine_id: M.MA, canonical_key: 'block_deck_height', value: '9.5', unit: 'in', provenance: 'user_entered' }, 'VW_INVALID_VALUE']]) {
    const before = await nVals(); const o = await guard(values.write({ owner_id: U.A }, req)); const after = await nVals();
    rec(VA, `[U10] ${label}`, o.outcome === 'rejected' && o.code === code && after === before, `${fmt(o)}; rows +${after - before}`);
  }
  { const ids = [];
    for (const [v, p] of [[9.0, 'manufacturer_specified'], [9.1, 'measured'], [9.2, 'estimated']]) { const o = await W(U.A, 'block_deck_height', v, 'in', p, { machine_id: M.MS }); ids.push(o.outcome === 'created' ? o.value : null); }
    const cur = await guard(values.current({ owner_id: U.A }, { machine_id: M.MS, canonical_key: 'block_deck_height' }));
    const chain = ids.every(Boolean) && ids[0].supersedes_id === null && ids[1].supersedes_id === ids[0].value_id && ids[2].supersedes_id === ids[1].value_id;
    rec(VA, '[U11] newest non-superseded value is current; linear supersession; history retained', chain && cur.outcome === 'found' && cur.value.numeric_value === 9.2, `chain ${chain}; current ${cur.outcome === 'found' ? cur.value.numeric_value : fmt(cur)}`);
    rec(VA, '[U11] no provenance priority: a newer estimated value supersedes a measured one', cur.outcome === 'found' && cur.value.provenance === 'estimated', cur.outcome === 'found' ? cur.value.provenance : fmt(cur));
    const abs = await guard(values.current({ owner_id: U.A }, { machine_id: M.MS, canonical_key: 'panhard_bar_length' }));
    rec(VA, '[U10] nothing recorded -> current is absent (not zero)', abs.outcome === 'absent', fmt(abs)); }
  { const bad = (await rowsOf(adm, 'SELECT count(*)::int n FROM public.value_records v JOIN public.canonical_fields f ON f.key = v.canonical_field WHERE v.unit <> f.canonical_unit'))[0].n;
    rec(VA, '[U4] every stored value is in its key\u2019s engine-native canonical unit (DF_UNIT holds)', bad === 0, `${bad} off-unit`); }

  // ============ DISPLAY (U5, U9) ============
  const DI = 'display';
  for (const [x, d, want, label] of [[2.5, 1, '3', '2.5 -> 3 (half away from zero)'], [-2.5, 1, '-3', '-2.5 -> -3 (symmetric)'], [0.125, 2, '0.13', '0.125 -> 0.13'],
    [1.005, 3, '1', 'binary case: 1.005 is below 1.005 in binary, so shows 1.00 -> "1"'], [1 / 3, undefined, '0.333333', 'default 6 significant digits'],
    [25.4, undefined, '25.4', 'trailing zeros dropped'], [1234567, undefined, '1234570', '6 significant digits for every quantity'], [0.000123456789, undefined, '0.000123457', 'small values keep 6 significant digits'],
    [-0, undefined, '0', '-0 shows as 0'], [-0.5, undefined, '-0.5', 'negative value shown with sign']]) {
    let got; try { got = (mu.values && mu.values.format ? mu.values.format : VU.formatDisplay)(x, d); } catch (e) { got = 'THREW'; }
    rec(DI, `[U9] ${label}`, got === want, got);
  }
  rec(DI, '[U9] the 1.005 binary caveat is the raw rounding (1.00), not 1.01', (1.005).toPrecision(3) === '1.00', (1.005).toPrecision(3));
  for (const [k, stored_, unit, want] of [['block_deck_height', 1, 'mm', '25.4'], ['block_deck_height', 1, 'in', '1'], ['piston_crown_volume', 16.387064, 'cu in', '1'],
    ['def_tank_capacity', 1, 'L', '3.78541'], ['def_tank_capacity', 1, 'gal (US)', '1'], ['intake_port_effective_flow_area', 1, 'mm²', '645.16'],
    ['intake_port_effective_flow_area', 1, 'cm²', '6.4516'], ['vehicle_side_projected_area', 1, 'm²', '0.092903'], ['clutch_clamp_load', 1, 'N', '4.44822']]) {
    let d; try { d = values.display(k, stored_, unit); } catch (e) { d = { text: 'THREW' }; }
    rec(DI, `[U5] stored ${stored_} ${admission.key(k).canonical_unit} displays as ${want} ${unit}`, d.text === want && d.label === unit, `${d.text} ${d.label || ''}`);
  }
  { const before = (await rowsOf(adm, "SELECT md5(string_agg(id::text||coalesce(numeric_value::text,'n')||unit, ',' ORDER BY id)) h FROM public.value_records"))[0].h;
    let n = 0, err = 0;
    for (const k of admission.keys()) {
      const cur = await guard(values.current({ owner_id: U.A }, { machine_id: M.MA, canonical_key: k }));
      const v = cur.outcome === 'found' ? cur.value.numeric_value : 1;
      for (const u of admission.unitsFor(k)) { try { const d = values.display(k, v, u.label); n++; if (v !== null && (typeof d.text !== 'string' || !d.known)) err++; } catch (e) { err++; } }
    }
    const after = (await rowsOf(adm, "SELECT md5(string_agg(id::text||coalesce(numeric_value::text,'n')||unit, ',' ORDER BY id)) h FROM public.value_records"))[0].h;
    rec(DI, '[U5] every key renders in every admitted unit, and display never alters a stored value', err === 0 && before === after && n >= 47, `${n} renderings, ${err} errors, storage ${before === after ? 'unchanged' : 'CHANGED'}`);
    let unk; try { unk = values.display('clutch_slave_cylinder_bore', null, 'mm'); } catch (e) { unk = { text: 'THREW' }; }
    rec(DI, '[U10] unknown is displayed as no value, never as 0', unk.text === null && unk.known === false, String(unk.text)); }

  // ============ SERVER AUTHORITY (U15) + EXCLUSIONS (U13) ============
  const SA = 'authority';
  { await adm.query('BEGIN'); let r;
    try { await adm.query('SET LOCAL ROLE authenticated'); await adm.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U.A, role: 'authenticated' })]);
      await adm.query(`INSERT INTO public.value_records (machine_id, canonical_field, numeric_value, unit, provenance, context) VALUES ('${M.MA}','block_deck_height',9,'in','user_entered','specification')`); r = 'accepted'; }
    catch (e) { r = e.code; } finally { await adm.query('ROLLBACK'); }
    rec(SA, '[U15] a direct authenticated INSERT of a Value Foundation value is rejected (42501): the trusted path is the only writer', r === '42501', r); }
  for (const [label, owner, extra, code] of [
    ['a request-supplied owner_id is rejected', U.A, { owner_id: U.A }, 'VF_MALFORMED_REQUEST'],
    ['no verified owner context', null, {}, 'VW_NO_OWNER'],
    ['spoofed ownership: B writing to A\u2019s machine', U.B, {}, 'VW_MACHINE_NOT_FOUND'],
    ['soft-deleted machine', U.A, { machine_id: M.MD }, 'VW_MACHINE_NOT_FOUND'],
    ['active machine in a soft-deleted garage', U.A, { machine_id: M.MG }, 'VW_MACHINE_NOT_FOUND'],
    ['operating_state context (V1 stores SPECIFICATION only)', U.A, { context: 'operating_state' }, 'VW_CONTEXT_NOT_PERMITTED'],
    ['calculated provenance (no calculated write-back)', U.A, { provenance: 'calculated' }, 'VW_PROVENANCE_NOT_PERMITTED'],
    ['empirical provenance (test results deferred)', U.A, { provenance: 'empirical' }, 'VW_PROVENANCE_NOT_PERMITTED'],
    ['component-level value (no Component Attribution)', U.A, { component_id: '30000000-0000-4000-8000-0000000000a1' }, 'VW_COMPONENT_NOT_PERMITTED']]) {
    const before = await nVals(); const o = await W(owner, 'block_deck_height', 9, 'in', 'user_entered', extra); const after = await nVals();
    rec(SA, `[U15] ${label}`, o.outcome === 'rejected' && o.code === code && after === before, `${fmt(o)}; rows +${after - before}`);
  }
  { const o = await W(U.A, 'block_deck_height', 9.5, 'in', 'measured'); const r = o.outcome === 'created' ? await stored(o.value.value_id) : null;
    rec(SA, '[U15] owner of a stored value is the verified login (owner isolation)', r && r.owner_id === U.A, r ? 'owner = login' : fmt(o));
    const ob = await guard(values.current({ owner_id: U.B }, { machine_id: M.MA, canonical_key: 'block_deck_height' }));
    rec(SA, '[U15] another owner cannot read A\u2019s current value', ob.outcome === 'rejected' && ob.code === 'VW_MACHINE_NOT_FOUND', fmt(ob)); }
  { const ids = [...S.dfr.map(r => r.draft_field_id), 'king_pin_arm', 'supercharger_drive_ratio', 'clutch_required_release_force', 'bearing_type', ...S.adm.map(r => r.draft_field_id)];
    let rejected = 0; const before = await nVals();
    for (const k of ids) { const o = await W(U.A, k, 1, 'in'); if (o.outcome === 'rejected' && o.code === 'VF_FIELD_NOT_ADMITTED') rejected++; }
    const after = await nVals();
    rec(SA, '[U13] every deferred field (incl. the 19 multi-instance and king_pin_arm), old renamed keys, bearing_type and raw source-field ids are refused',
      rejected === ids.length && after === before, `${rejected}/${ids.length} refused; rows +${after - before}`); }

  // ============ VALUE -> ENGINE ADAPTER (U14) ============
  const AE = 'adapter';
  const A = { owner_id: U.A };
  const run = req => guard(adapter.calculate(A, Object.assign({ request_id: rid(), machine_id: M.MC }, req)));
  const rec_ = o => (o && o.calculation && o.calculation.outcome === 'created' ? o.calculation.record : null);
  const sup = o => (o && o.supplied ? o.supplied.map(s => `${s.var}<${s.canonical_key}`).join(',') : 'none');
  const valsBefore = (await rowsOf(adm, "SELECT md5(string_agg(id::text||coalesce(numeric_value::text,'n'), ',' ORDER BY id)) h FROM public.value_records"))[0].h;
  await W(U.A, 'jpipe_resonator_diameter', 2.37, 'in', 'measured', { machine_id: M.MC });
  { const o = await run({ calculator_id: 'jpipe_resonator', inputs: { freq_jp: 80 } }); const r = rec_(o);
    const d = await guard(calcDirect.calculate(A, { calculator_id: 'jpipe_resonator', inputs: { freq_jp: 80, dia_jp: 2.37 }, request_id: rid(), machine_id: M.MC }));
    const dr = d.outcome === 'created' ? d.record : null;
    rec(AE, '[U14] the stored inside diameter feeds exactly its engine key (dia_jp); the condition freq_jp stays explicit', r && sup(o) === 'dia_jp<jpipe_resonator_diameter' && r.inputs.dia_jp === 2.37 && r.inputs.freq_jp === 80, `${sup(o)}; ${r ? r.result_state : fmt(o.calculation)}`);
    rec(AE, '[U14] no competing logic: result equals the frozen service computing the same explicit inputs', r && dr && r.result_state === dr.result_state && same(r.outputs, dr.outputs), r && dr ? `${r.result_state}; outputs ${same(r.outputs, dr.outputs) ? 'identical' : 'DIFFER'}` : 'missing'); }
  { const o = await run({ calculator_id: 'jpipe_resonator', inputs: {} }); const r = rec_(o);
    rec(AE, '[U14] goals/conditions are never auto-fed: without freq_jp the engine reports INCOMPLETE', r && r.result_state === 'incomplete' && r.missing.includes('freq_jp') && sup(o) === 'dia_jp<jpipe_resonator_diameter', r ? `${r.result_state} missing ${r.missing}` : fmt(o.calculation)); }
  { const o = await run({ calculator_id: 'jpipe_resonator', inputs: { freq_jp: 80, dia_jp: 3 } }); const r = rec_(o);
    rec(AE, '[U14] an explicit request input wins over the stored value', r && r.inputs.dia_jp === 3 && sup(o) === '', r ? `dia_jp ${r.inputs.dia_jp}; supplied [${sup(o)}]` : fmt(o.calculation));
    const o2 = await run({ calculator_id: 'jpipe_resonator', inputs: { freq_jp: 80, dia_jp: null } }); const r2 = rec_(o2);
    rec(AE, '[U14] an explicit null is explicit too: never filled from storage', r2 && r2.result_state === 'incomplete' && r2.missing.includes('dia_jp') && sup(o2) === '', r2 ? `${r2.result_state}` : fmt(o2.calculation)); }
  await W(U.A, 'jpipe_resonator_diameter', null, null, 'unknown', { machine_id: M.MC });
  { const o = await run({ calculator_id: 'jpipe_resonator', inputs: { freq_jp: 80 } }); const r = rec_(o);
    rec(AE, '[U10][U14] a current UNKNOWN supplies nothing (never 0): the engine reports INCOMPLETE', r && r.result_state === 'incomplete' && r.missing.includes('dia_jp') && !('dia_jp' in r.inputs) && sup(o) === '', r ? `${r.result_state}; supplied [${sup(o)}]` : fmt(o.calculation)); }
  { const o = await run({ calculator_id: 'anti_squat', inputs: {} }); const r = rec_(o);
    rec(AE, '[U14] absent values supply nothing (INCOMPLETE, nothing invented)', r && r.result_state === 'incomplete' && Object.keys(r.inputs).length === 0, r ? `${r.result_state}; inputs ${Object.keys(r.inputs).length}` : fmt(o.calculation)); }
  const sc = { bore2: 4.03, stroke2: 3.48, chamber: 64, gasket: 9.2 };
  for (const [v, label] of [[0, 'explicit zero is supplied as 0 (flat-top piston)'], [-5, 'a negative value is supplied with its sign (dish)']]) {
    await W(U.A, 'piston_crown_volume', v, 'cc', 'measured', { machine_id: M.MC });
    const o = await run({ calculator_id: 'static_compression', inputs: sc }); const r = rec_(o);
    rec(AE, `[U7][U14] ${label}`, r && Object.is(r.inputs.piston, v) && sup(o) === 'piston<piston_crown_volume' && r.result_state !== 'incomplete', r ? `piston ${r.inputs.piston}; ${r.result_state}` : fmt(o.calculation));
  }
  await W(U.A, 'vehicle_cg_height', 20, 'in', 'measured', { machine_id: M.MC });
  await W(U.A, 'rear_suspension_side_view_ic_height_at_reference_wheelbase', 8, 'in', 'measured', { machine_id: M.MC });
  await W(U.A, 'front_suspension_side_view_ic_height', 7, 'in', 'measured', { machine_id: M.MC });
  { const o1 = await run({ calculator_id: 'anti_squat', inputs: {} }), o2 = await run({ calculator_id: 'anti_dive', inputs: { bias: 60 } });
    const r1 = rec_(o1), r2 = rec_(o2);
    rec(AE, '[U2][U14] the shared vehicle_cg_height feeds both of its engine keys (anti_squat.cg and anti_dive.cgH)',
      r1 && r2 && r1.inputs.cg === 20 && r2.inputs.cgH === 20 && sup(o1).includes('cg<vehicle_cg_height') && sup(o2).includes('cgH<vehicle_cg_height'), `${sup(o1)} | ${sup(o2)}`);
    rec(AE, '[U14] each calculator receives only its own admitted engine keys (bias stays an explicit input)', r2 && sup(o2) === 'cgH<vehicle_cg_height,icH<front_suspension_side_view_ic_height' && r2.inputs.bias === 60, sup(o2)); }
  await W(U.A, 'jpipe_resonator_diameter', 76.2, 'mm', 'measured', { machine_id: M.MC });
  { const o = await run({ calculator_id: 'jpipe_resonator', inputs: { freq_jp: 80 } }); const r = rec_(o);
    const dbIn = r ? (await rowsOf(adm, "SELECT (inputs->>'dia_jp')::float8 v FROM public.calculation_records WHERE id = $1", [r.record_id]))[0].v : null;
    rec(AE, '[U14] no conversion in the adapter: the engine-native stored value (3.0000000000000004 in) is supplied bit-for-bit', r && Object.is(r.inputs.dia_jp, 3.0000000000000004) && Object.is(dbIn, 3.0000000000000004), r ? `${r.inputs.dia_jp}` : fmt(o.calculation)); }
  { const before = await nCalc(); const o = await guard(adapter.calculate(A, { calculator_id: 'jpipe_resonator', inputs: { freq_jp: 80 }, request_id: rid(), machine_id: M.MD })); const after = await nCalc();
    rec(AE, '[U14] soft-deleted machine: rejected by the trusted read; nothing is calculated or stored', o.calculation && o.calculation.outcome === 'rejected' && o.calculation.code === 'VW_MACHINE_NOT_FOUND' && after === before, `${fmt(o.calculation)}; records +${after - before}`); }
  { const before = await nCalc(); const o = await guard(adapter.calculate({ owner_id: U.B }, { calculator_id: 'jpipe_resonator', inputs: { freq_jp: 80 }, request_id: rid(), machine_id: M.MC })); const after = await nCalc();
    rec(AE, '[U14] owner isolation: B cannot feed a calculation from A\u2019s machine', o.calculation && o.calculation.outcome === 'rejected' && after === before, `${fmt(o.calculation)}; records +${after - before}`); }
  { const unproven = [...S.cf.sources.registryIds].sort().find(id => !S.cf.sources.isProven(id) && S.cf.sources.aliasTarget(id) === undefined);
    reads = 0; const o = await guard(adapter.calculate(A, { calculator_id: unproven, inputs: {}, request_id: rid(), machine_id: M.MC }));
    rec(AE, '[U14] only proven calculators: no stored value is read for an unproven calculator, and the frozen authority rejects it', reads === 0 && o.calculation && o.calculation.outcome === 'rejected' && o.calculation.code === 'CF_NOT_PROVEN', `${reads} reads; ${fmt(o.calculation)}`); }
  { reads = 0; const o = await guard(adapter.calculate(A, { calculator_id: 'jpipe_resonator', inputs: { freq_jp: 80 }, request_id: rid() })); const r = rec_(o);
    rec(AE, '[U14] no machine: nothing is read or supplied; the request reaches the frozen service unchanged', reads === 0 && r && r.result_state === 'incomplete' && sup(o) === '', `${reads} reads; ${r ? r.result_state : fmt(o.calculation)}`); }
  { const ids = [...new Set([...S.cf.sources.registryIds, ...S.cf.sources.aliasIds, ...S.cf.sources.provenIds])].sort();
    const auth = S.cf.authority.createAuthority(S.cf.sources); const canon = adapter.resolveCalculator;
    const mism = ids.filter(id => { const a = auth.resolve(id); return (a.ok ? a.canonical : null) !== canon(id); });
    rec(AE, '[U14] the adapter\u2019s calculator resolution (as deployed) equals the frozen authority for every registry / alias id', mism.length === 0 && ids.length > 500, `${ids.length} ids; ${mism.length} differ`); }
  { const n = (await rowsOf(adm, 'SELECT count(*)::int n FROM public.calculation_records WHERE input_value_ids IS NOT NULL'))[0].n;
    rec(AE, '[U14] input_value_ids is never populated (deferred, OWN-9B)', n === 0, `${n} populated`);
    const valsAfter = (await rowsOf(adm, "SELECT md5(string_agg(id::text||coalesce(numeric_value::text,'n'), ',' ORDER BY id)) h FROM public.value_records WHERE NOT (machine_id = '" + M.MC + "' AND canonical_field IN ('jpipe_resonator_diameter','piston_crown_volume','vehicle_cg_height','rear_suspension_side_view_ic_height_at_reference_wheelbase','front_suspension_side_view_ic_height'))"))[0].h;
    rec(AE, '[U14] calculations never modify stored values; calculated results are not written back (OWN-2)', valsBefore === valsAfter && (await rowsOf(adm, "SELECT count(*)::int n FROM public.value_records WHERE provenance IN ('calculated','derived')"))[0].n === 0, valsBefore === valsAfter ? 'unchanged; 0 calculated rows' : 'CHANGED'); }

  // permanence: once a key is referenced the rollback refuses
  { const before = (await rowsOf(adm, CF_ROWS_SQL)).length; const r = await applySql(adm, rollbackSql); const after = (await rowsOf(adm, CF_ROWS_SQL)).length;
    rec(MG, 'keys are permanent once referenced: the rollback refuses when values exist, and nothing is removed', !r.ok && /VF_0301_ROLLBACK_REFUSED/.test(r.msg || '') && before === after && after === 47, r.ok ? 'UNEXPECTEDLY ROLLED BACK' : `refused; ${after} rows kept`); }

  await adm.end(); await s1.end(); await k1.end(); await k2.end();
  for (const n of [...scratch, db]) await dropDb(n);
  return { results };
}

(async () => {
  const S = await setup();
  const main = await runSuite(S, 'vf_main', null);
  const groups = [...new Set(main.results.map(r => r.group))];
  console.log('='.repeat(72)); console.log('GEARHEAD LABS - VALUE-FOUNDATION 1.0.0 - ACCEPTANCE SUITE (approved specification §U)'); console.log('='.repeat(72));
  console.log('  specification a28cfddb...; admission f9b91aa8... (48 fields -> 47 keys); deferred register f2fa130d... (52)');
  console.log('  stack from tags: DATA-FOUNDATION 1.0.0 + GARAGE-FOUNDATION 1.0.0 + DATA-FOUNDATION 1.1.0; seed 0301; frozen CALCULATION service');
  let fails = 0;
  for (const g of groups) { const rs = main.results.filter(r => r.group === g), f = rs.filter(r => !r.ok); fails += f.length;
    console.log(`[${f.length ? 'FAIL' : 'PASS'}] ${g.toUpperCase().padEnd(14)} ${rs.length - f.length} passed, ${f.length} failed`);
    f.forEach(x => console.log(`    x ${x.name}\n        ${x.detail}`)); }
  const tags = [...new Set(main.results.flatMap(r => (r.name.match(/\[U\d+\]/g) || [])))].sort((a, b) => +a.slice(2, -1) - +b.slice(2, -1));
  console.log(`[INFO] §U criteria exercised in-suite: ${tags.join(' ')} (U17, U18: isolation gate)`);
  console.log(`\nTOTAL ${main.results.length} checks, ${main.results.length - fails} passed, ${fails} failed`);

  const neg = [];
  for (let i = 0; i < (process.env.VF_MAIN_ONLY ? 0 : MUTANTS.length); i++) {   // VF_MAIN_ONLY: development only, never for evidence
    const [name, build] = MUTANTS[i];
    let spec = null, invalid = '', err = '', r = null;
    try { spec = build(S); if (spec.seed) { if (spec.seed(S.seed) === S.seed) throw new Error('seed mutation did not apply'); }
      if (spec.rollback) { if (spec.rollback(S.rollback) === S.rollback) throw new Error('rollback mutation did not apply'); }
      if (spec.config) { const c = spec.config(JSON.parse(JSON.stringify(S.gen.config))); if (same(c, S.gen.config)) throw new Error('config mutation did not apply'); } }
    catch (e) { invalid = e.message.split('\n')[0]; }
    if (!invalid) { try { r = await runSuite(S, `vf_mut_${i}`, spec); } catch (e) { err = e.message.split('\n')[0]; } }
    const failed = r ? r.results.filter(x => !x.ok) : [];
    neg.push({ mutation: name, valid: !invalid, detected: !invalid && (!!err || failed.length > 0), failed_checks: failed.map(x => x.name), error: err || invalid });
  }
  const undetected = neg.filter(n => !n.detected);
  console.log(`\n[${undetected.length ? 'FAIL' : 'PASS'}] NEGATIVE_CONTROLS ${neg.length - undetected.length}/${neg.length} mutants detected`);
  neg.forEach(n => console.log(`    ${n.detected ? '+' : 'x'} ${n.mutation}: ${!n.valid ? 'MUTANT NOT APPLIED (' + n.error + ')' : n.error ? 'suite error' : n.failed_checks.length + ' check(s) failed'}`));
  fs.writeFileSync(path.join(HERE, 'evidence', 'test-results.json'), JSON.stringify({ checks: main.results, negative_controls: neg }, null, 1) + '\n');
  for (const n of ['vf_base', 'vf_stack']) await dropDb(n);
  const pass = fails === 0 && undetected.length === 0;
  console.log(pass ? '\nVALUE-FOUNDATION-1.0.0 SUITE: PASS' : '\nVALUE-FOUNDATION-1.0.0 SUITE: FAIL');
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('SUITE ERROR:', e.stack || e); process.exit(2); });
