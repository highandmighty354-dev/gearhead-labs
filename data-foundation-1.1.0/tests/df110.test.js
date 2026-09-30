#!/usr/bin/env node
/* DATA-FOUNDATION 1.1.0 - deterministic suite (owner-approved amendment design §11; test reconciliation CSV).
 *
 * Base template: test-only shim + DATA-FOUNDATION 0001-0005 READ FROM THE DATA-FOUNDATION-1.0.0 TAG + fixtures.
 * Every run (main and each negative control) clones a FRESH database from that template and applies migration 0201
 * (or the mutant's version of it). Fixed identities; timestamps are compared only inside the database; no id,
 * timestamp or hash is printed, so the output is byte-reproducible.
 *
 * Levels (DATA-FOUNDATION-1.1.0-TEST-RECONCILIATION.csv):
 *   S  service-role SQL: the frozen DATA-FOUNDATION database rule still holds after 0201
 *   T  trusted-path behaviour: the service enforces the stricter Value Foundation V1 contract
 *   Line 198 becomes the new SECURITY test: the same authenticated INSERT is now rejected (42501). */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const { Client } = require('pg');
const { createValueWriteService } = require('../src/service');
const { createRepository, ACTIVE_MACHINE_SQL } = require('../src/repository');
const { createFieldContracts, V1_PROVENANCES } = require('../src/validate');
const UNITS = require('../src/units');
const { MUTANTS } = require('./mutants');

const HERE = path.resolve(__dirname, '..'), REPO = path.resolve(HERE, '..');
const cfg = { host: process.env.DV_PGHOST, port: +process.env.DV_PGPORT, user: 'postgres' };
const PG_BIN = process.env.DV_PG_BIN;
const DF_TAG = 'DATA-FOUNDATION-1.0.0', GF_TAG = 'GARAGE-FOUNDATION-1.0.0', CF_TAG = 'CALCULATION-FOUNDATION-1.0.0';
const atTag = (tag, f) => execFileSync('git', ['-C', REPO, 'show', `${tag}:${f}`], { maxBuffer: 64 << 20 });
const DF_FILES = ['tests/sql/000_supabase_shim.sql', 'supabase/migrations/0001_enums.sql', 'supabase/migrations/0002_tables.sql',
  'supabase/migrations/0003_constraints_triggers.sql', 'supabase/migrations/0004_rls.sql', 'supabase/migrations/0005_reference_seed.sql'].map(f => 'data-foundation/' + f);
const GF_FILES = ['0101_test_setups.sql', '0102_test_setups_triggers.sql', '0103_test_setups_rls.sql'].map(f => 'garage-foundation/supabase/migrations/' + f);
const MIG_PATH = path.join(HERE, 'supabase', 'migrations', '0201_value_write_boundary.sql');
const RB_PATH = path.join(HERE, 'supabase', 'rollback', '0201_value_write_boundary.rollback.sql');

const U = { A: 'aaaaaaaa-0000-4000-8000-00000000000a', B: 'bbbbbbbb-0000-4000-8000-00000000000b',
  X: '99999999-0000-4000-8000-000000000009' /* never an account */ };
const G = { GA: '10000000-0000-4000-8000-0000000000a1', GA2: '10000000-0000-4000-8000-0000000000a2', GB: '10000000-0000-4000-8000-0000000000b1' };
const M = { MA: '20000000-0000-4000-8000-0000000000a1', MS: '20000000-0000-4000-8000-0000000000a5', MC: '20000000-0000-4000-8000-0000000000a6',
  MH: '20000000-0000-4000-8000-0000000000a2', MD: '20000000-0000-4000-8000-0000000000a3', MG: '20000000-0000-4000-8000-0000000000a4',
  MB: '20000000-0000-4000-8000-0000000000b1', MX: '20000000-0000-4000-8000-0000000000ff' /* never a machine */ };
const V = { VA1: '50000000-0000-4000-8000-0000000000a1', VB1: '50000000-0000-4000-8000-0000000000b1' };
const CR = { CRA: '40000000-0000-4000-8000-0000000000a1', CRB: '40000000-0000-4000-8000-0000000000b1' };
const rid = n => 'd0000000-0000-4000-8000-' + String(n).padStart(12, '0');

/* TEST FIXTURE ONLY canonical fields (as DATA-FOUNDATION-1.0.0's own suite does). One admitted fixture field per
 * §H storage unit. The Value Foundation V1 47-key admission set is NOT seeded or configured by this milestone. */
const FX = [
  ['fx_length', 'in'], ['fx_force', 'lbf'], ['fx_volume_gal', 'gal'], ['fx_volume_cc', 'cc'], ['fx_area_sq_in', 'sq in'],
  ['fx_area_sq_ft', 'sq ft'], ['fx_ratio', ':1'], ['fx_angle', '°'], ['fx_energy', 'kWh'], ['fx_thread', 'TPI']];
const CONTRACTS = [...FX.map(([key, storage_unit]) => ({ key, storage_unit })), { key: 'fx_mismatch', storage_unit: 'in' }];
// in the database but NOT admitted: fx_weight (lb; the 1.0.0-style S-level field), fx_not_admitted, fx_categorical

/* Catalog fingerprint of every user-defined object in public + auth (identical to CALCULATION-FOUNDATION's FP_SQL). */
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
async function freshDb(name, template) {
  const admin = await connect('postgres');
  await admin.query(`DROP DATABASE IF EXISTS ${name}`);
  await admin.query(template ? `CREATE DATABASE ${name} TEMPLATE ${template}` : `CREATE DATABASE ${name}`);
  await admin.end();
}
async function dropDb(name) { const admin = await connect('postgres'); await admin.query(`DROP DATABASE IF EXISTS ${name}`); await admin.end(); }
const fingerprint = async c => (await c.query(FP_SQL)).rows.map(r => r.x);
/* Apply a migration text the way a runner does (one simple-query batch). On error the open transaction is rolled back
 * so the connection is usable; the error is returned. */
async function applySql(c, sql) {
  try { await c.query(sql); return { ok: true }; }
  catch (e) { try { await c.query('ROLLBACK'); } catch (_) { /* no transaction open */ } return { ok: false, code: e.code, msg: e.message.split('\n')[0] }; }
}
/* pg_dump (16.10+) emits \restrict / \unrestrict lines with a new random token on every run; stripped (as DF 1.0.0). */
const dump = db => execFileSync(path.join(PG_BIN, 'pg_dump'), ['-h', cfg.host, '-p', String(cfg.port), '-U', 'postgres', '-s', db]).toString()
  .split('\n').filter(l => !/^\\(un)?restrict /.test(l)).join('\n');
const diff = (a, b) => ({ onlyA: a.filter(x => !b.includes(x)), onlyB: b.filter(x => !a.includes(x)) });

/* Load the frozen CALCULATION-FOUNDATION-1.0.0 service source from ITS TAG into a temp dir (never the working tree). */
function loadFrozenCalculationService() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'df110-cf-'));
  const files = execFileSync('git', ['-C', REPO, 'ls-tree', '--name-only', `${CF_TAG}:calculation-foundation/src`]).toString().trim().split('\n');
  for (const f of files) fs.writeFileSync(path.join(dir, f), atTag(CF_TAG, 'calculation-foundation/src/' + f));
  const F = require(path.join(dir, 'frozen-sources.js'));
  const svc = require(path.join(dir, 'service.js')), rep = require(path.join(dir, 'repository.js'));
  const sources = F.loadFrozenSources(F.readFrozenBytesFromTags(REPO));
  fs.rmSync(dir, { recursive: true, force: true });
  return { sources, createCalculationService: svc.createCalculationService, createRepository: rep.createRepository, ACTIVE_MACHINE_SQL: rep.ACTIVE_MACHINE_SQL };
}

/* ---------------------------------------------------------------- one-time setup */
async function setup() {
  const dfFrozen = DF_FILES.map(f => ({ f, tag: atTag(DF_TAG, f).toString('utf8'), wt: fs.readFileSync(path.join(REPO, f), 'utf8') }));
  const gfFrozen = GF_FILES.map(f => ({ f, tag: atTag(GF_TAG, f).toString('utf8'), wt: fs.readFileSync(path.join(REPO, f), 'utf8') }));
  const df100Test = atTag(DF_TAG, 'data-foundation/tests/df.test.js').toString('utf8').split('\n');
  const recon = fs.readFileSync(path.join(HERE, 'design', 'DATA-FOUNDATION-1.1.0-TEST-RECONCILIATION.csv'), 'utf8').split(/\r?\n/).slice(1).filter(Boolean)
    .map(l => +l.split(',')[0]);
  const cf = loadFrozenCalculationService();

  // pristine DATA-FOUNDATION-1.0.0 (clean install, no fixtures): the fingerprint every comparison is anchored to
  await freshDb('dv_pristine');
  let t = await connect('dv_pristine');
  for (const x of dfFrozen) await t.query(x.tag);
  const fpPristine = await fingerprint(t);
  await t.end();

  // base template = pristine 1.0.0 + fixtures (superuser, before 0201)
  await freshDb('dv_base', 'dv_pristine');
  t = await connect('dv_base');
  await t.query(`INSERT INTO auth.users (id) VALUES ('${U.A}'), ('${U.B}')`);
  // frozen rule: one ACTIVE garage per owner - so A's second garage is created and soft-deleted first (as CF fixtures)
  await t.query(`INSERT INTO public.garages (id, owner_id, name) VALUES ('${G.GA2}','${U.A}','A deleted garage')`);
  await t.query(`INSERT INTO public.machines (id, owner_id, garage_id, name, machine_type) VALUES ('${M.MG}','${U.A}','${G.GA2}','A in deleted garage','marine')`);
  await t.query(`UPDATE public.garages SET deleted_at = now() WHERE id = '${G.GA2}'`);
  await t.query(`INSERT INTO public.garages (id, owner_id, name) VALUES ('${G.GA}','${U.A}','A garage'), ('${G.GB}','${U.B}','B garage')`);
  await t.query(`INSERT INTO public.machines (id, owner_id, garage_id, name, machine_type, is_hypothetical) VALUES
    ('${M.MA}','${U.A}','${G.GA}','A active','automotive',false), ('${M.MS}','${U.A}','${G.GA}','A semantics','automotive',false),
    ('${M.MC}','${U.A}','${G.GA}','A concurrency','automotive',false), ('${M.MH}','${U.A}','${G.GA}','A hypothetical','automotive',true),
    ('${M.MD}','${U.A}','${G.GA}','A soft-deleted','automotive',false), ('${M.MB}','${U.B}','${G.GB}','B active','automotive',false)`);
  await t.query(`UPDATE public.machines SET deleted_at = now() WHERE id = '${M.MD}'`);
  const rows = [...FX.map(([k, u]) => `('${k}','fixture',NULL,'${u}','numeric','TEST FIXTURE ONLY')`),
    `('fx_mismatch','fixture',NULL,'mm','numeric','TEST FIXTURE ONLY: canonical unit deliberately differs from its contract')`,
    `('fx_not_admitted','fixture',NULL,'in','numeric','TEST FIXTURE ONLY: present in the database, not admitted')`,
    `('fx_weight','fixture',NULL,'lb','numeric','TEST FIXTURE ONLY: DATA-FOUNDATION-1.0.0-style S-level field')`,
    `('fx_categorical','fixture',NULL,'-','categorical','TEST FIXTURE ONLY: S-level categorical')`];
  await t.query(`INSERT INTO public.canonical_fields (key, family, dimension, canonical_unit, value_kind, description) VALUES ${rows.join(',')}`);
  const fvTow = (await t.query(`SELECT formula_version, formula_registry FROM formula_versions WHERE calculator_id='tow_tongue_percent'`)).rows[0];
  const calcIns = `INSERT INTO calculation_records (id, owner_id, machine_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
                   VALUES ($1,$2,$3,'tow_tongue_percent','tow_tongue_percent','1.1.0',$4,$5,'valid','{"t":870,"w":8700}','[{"key":"tongue_weight","value":10}]',$6)`;
  await t.query(calcIns, [CR.CRA, U.A, M.MA, fvTow.formula_registry, fvTow.formula_version, rid(1)]);
  await t.query(calcIns, [CR.CRB, U.B, M.MB, fvTow.formula_registry, fvTow.formula_version, rid(2)]);
  await t.query(`INSERT INTO public.value_records (id, owner_id, machine_id, canonical_field, numeric_value, unit, provenance, context) VALUES
    ('${V.VA1}','${U.A}','${M.MA}','fx_weight',3420,'lb','user_entered','specification'), ('${V.VB1}','${U.B}','${M.MB}','fx_weight',3500,'lb','user_entered','specification')`);
  await t.end();

  return { dfFrozen, gfFrozen, df100Test, recon, cf, fpPristine,
    mig: fs.readFileSync(MIG_PATH, 'utf8'), rb: fs.readFileSync(RB_PATH, 'utf8') };
}

/* ---------------------------------------------------------------- one suite run */
async function runSuite(S, dbName, mutant) {
  const results = [];
  const rec = (group, name, ok, detail) => results.push({ group, name, ok: !!ok, detail: detail || '' });
  const mig = mutant && mutant.migration ? mutant.migration(S.mig) : S.mig;
  const rb = mutant && mutant.rollback ? mutant.rollback(S.rb) : S.rb;
  const scratch = [];
  const scratchDb = async (suffix, template) => { const n = `${dbName}_${suffix}`; scratch.push(n); await freshDb(n, template); return connect(n); };

  // ============ INTEGRITY ============
  const IN = 'integrity';
  rec(IN, 'shim + DATA-FOUNDATION 0001-0005 read from the DATA-FOUNDATION-1.0.0 tag are byte-identical to the working tree',
    S.dfFrozen.every(x => x.tag === x.wt), `${S.dfFrozen.filter(x => x.tag === x.wt).length}/${S.dfFrozen.length}`);
  rec(IN, 'GARAGE-FOUNDATION 0101-0103 read from the GARAGE-FOUNDATION-1.0.0 tag are byte-identical to the working tree',
    S.gfFrozen.every(x => x.tag === x.wt), `${S.gfFrozen.filter(x => x.tag === x.wt).length}/${S.gfFrozen.length}`);
  rec(IN, 'active-machine rule is byte-identical to CALCULATION-FOUNDATION-1.0.0 ACTIVE_MACHINE_SQL (read from its tag)',
    ACTIVE_MACHINE_SQL === S.cf.ACTIVE_MACHINE_SQL, ACTIVE_MACHINE_SQL === S.cf.ACTIVE_MACHINE_SQL ? 'identical' : 'differs');
  { // a client (owner:A / user:B) test call that performs a direct value INSERT, starting on line n (SQL on n or n+1)
    const isClientValueInsert = n => { const a = S.df100Test[n - 1] || '', b = S.df100Test[n] || '';
      if (!/await expect(Ok|Err)\(/.test(a) || !/'(owner:A|user:B)'/.test(a)) return false;
      return /INSERT INTO value_records|vIns\(/.test(/vIns\(|INSERT INTO/.test(a) ? a : b); };
    const found = S.df100Test.map((_, i) => i + 1).filter(isClientValueInsert);
    rec(IN, 'the 29 reconciled lines are EXACTLY the client direct value INSERT tests in df.test.js at the DATA-FOUNDATION-1.0.0 tag',
      S.recon.length === 29 && JSON.stringify(found) === JSON.stringify([...S.recon].sort((x, y) => x - y)), `${found.length} found in df.test.js, ${S.recon.length} in the CSV`); }
  { const src = ['errors.js', 'units.js', 'validate.js', 'repository.js', 'service.js'].map(f => fs.readFileSync(path.join(HERE, 'src', f), 'utf8')).join('\n');
    const reqs = [...src.matchAll(/require\(\s*'([^']+)'\s*\)/g)].map(m => m[1]);
    const foreign = reqs.filter(r => !r.startsWith('./'));
    const f1 = /gh-engine|GH_ENGINE|F1_12_3|Encyclopedia|batch9|fieldDisplayValue|toPrecision|toFixed|Math\.round|0\.0393701|0\.03937|0\.224809|0\.264172|0\.0610237|10\.7639|1\.34102/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''));
    rec(IN, 'trusted path is self-contained: no F1 page / engine code, no display rounding, no rounded reciprocal constant', foreign.length === 0 && !f1,
      `external requires: ${foreign.join(',') || 'none'}; F1/rounding markers: ${f1}`); }
  { const stmts = mig.replace(/--.*$/gm, '').replace(/DO \$\$[\s\S]*?\$\$;/g, '').split(';').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const want = ['BEGIN', 'REVOKE INSERT ON public.value_records FROM authenticated', 'DROP POLICY IF EXISTS df_values_insert ON public.value_records', 'COMMIT'];
    rec(IN, 'migration 0201 contains exactly the two approved statements (plus BEGIN / post-condition block / COMMIT)',
      JSON.stringify(stmts) === JSON.stringify(want), stmts.join(' | ').slice(0, 200)); }

  // ============ MIGRATION ============
  const MG = 'migration';
  // clean install from an empty database: shim + 1.0.0 (tag) + 0201
  const ci = await scratchDb('clean');
  for (const x of S.dfFrozen) await ci.query(x.tag);
  const r1 = await applySql(ci, mig);
  rec(MG, 'clean install: shim + DATA-FOUNDATION-1.0.0 (tag) + 0201 applies from an empty database', r1.ok, r1.ok ? '0201 applied' : `${r1.code} ${r1.msg}`);
  const fpAmended = await fingerprint(ci);
  const dumpA = dump(`${dbName}_clean`);
  const r2 = await applySql(ci, mig);
  const fpAgain = await fingerprint(ci), dumpB = dump(`${dbName}_clean`);
  rec(MG, 'repeat application is a no-op (idempotent): succeeds, schema dump and catalog fingerprint byte-identical',
    r2.ok && dumpA === dumpB && JSON.stringify(fpAmended) === JSON.stringify(fpAgain), r2.ok ? `dump ${dumpA === dumpB ? 'identical' : 'differs'}` : `${r2.code} ${r2.msg}`);
  { const d = diff(S.fpPristine, fpAmended);
    const oldRel = d.onlyA.find(x => x.startsWith('rel public.value_records ')), newRel = d.onlyB.find(x => x.startsWith('rel public.value_records '));
    const pol = d.onlyA.find(x => x.startsWith('pol value_records df_values_insert INSERT authenticated '));
    const ok = d.onlyA.length === 2 && d.onlyB.length === 1 && !!oldRel && !!newRel && !!pol
      && newRel === oldRel.replace('authenticated=ar/', 'authenticated=r/') && newRel !== oldRel;
    rec(MG, 'exactly two catalog changes vs pristine 1.0.0: authenticated INSERT (a) withdrawn from value_records ACL, policy df_values_insert removed; nothing else',
      ok, `removed ${d.onlyA.length}, added ${d.onlyB.length}${ok ? '' : ': ' + JSON.stringify(d).slice(0, 300)}`);
    rec(MG, 'no object created: no new table, column, function, trigger, index, constraint, policy or enum',
      d.onlyB.every(x => x.startsWith('rel public.value_records ')), `${d.onlyB.length} added entr${d.onlyB.length === 1 ? 'y' : 'ies'}`); }
  rec(MG, 'no reference data seeded by 0201: canonical_fields empty on a clean install', (await ci.query('SELECT count(*)::int n FROM public.canonical_fields')).rows[0].n === 0, 'canonical_fields 0');
  if (!mutant) fs.writeFileSync(path.join(HERE, 'evidence', 'schema-dump.sql'), dumpA.replace(/^-- Dumped (from|by) .*$/gm, '-- Dumped $1 (version line removed for determinism)'));

  // rollback restores DATA-FOUNDATION-1.0.0 exactly; rollback is itself idempotent; re-applying 0201 re-amends
  const rr = await applySql(ci, rb);
  const fpRolled = await fingerprint(ci);
  rec(MG, 'rollback script restores the DATA-FOUNDATION-1.0.0 catalog exactly (fingerprint equals a fresh 1.0.0 database)',
    rr.ok && JSON.stringify(fpRolled) === JSON.stringify(S.fpPristine), rr.ok ? `${diff(S.fpPristine, fpRolled).onlyA.length + diff(S.fpPristine, fpRolled).onlyB.length} differing entries` : `${rr.code} ${rr.msg}`);
  const rr2 = await applySql(ci, rb);
  rec(MG, 'rollback is idempotent (second run succeeds, catalog unchanged)', rr2.ok && JSON.stringify(await fingerprint(ci)) === JSON.stringify(S.fpPristine), rr2.ok ? 'ok' : `${rr2.code} ${rr2.msg}`);
  const rr3 = await applySql(ci, mig);
  rec(MG, 're-applying 0201 after rollback yields the amended catalog again (round trip)', rr3.ok && JSON.stringify(await fingerprint(ci)) === JSON.stringify(fpAmended), rr3.ok ? 'ok' : `${rr3.code} ${rr3.msg}`);
  await ci.end();

  // post-rollback behaviour: the 1.0.0 authenticated INSERT (df.test.js line 198) works again
  { const c = await scratchDb('rolled', 'dv_base'); const a = await applySql(c, mig), b = await applySql(c, rb);
    let ok = false, det = '';
    try { await c.query('BEGIN'); await c.query('SET LOCAL ROLE authenticated'); await c.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U.A, role: 'authenticated' })]);
      const r = await c.query(`INSERT INTO value_records (machine_id, canonical_field, numeric_value, unit, provenance, context, source) VALUES ('${M.MA}','fx_weight',3450,'lb','measured','specification','scale ticket') RETURNING owner_id`);
      ok = a.ok && b.ok && r.rows[0].owner_id === U.A; det = 'authenticated INSERT accepted'; } catch (e) { det = `${e.code} ${e.message.split('\n')[0]}`; } finally { await c.query('ROLLBACK'); }
    rec(MG, 'post-rollback verification: the DATA-FOUNDATION-1.0.0 client INSERT behaviour (df.test.js:198) is restored', ok, det); await c.end(); }

  // transactional: a failing post-condition leaves NOTHING changed
  { const c = await scratchDb('postfail', 'dv_base');
    await c.query('DROP TRIGGER df_no_truncate ON public.value_records');
    const before = await fingerprint(c); const r = await applySql(c, mig); const after = await fingerprint(c);
    rec(MG, 'transactional: a failed post-condition aborts 0201 and leaves the catalog unchanged (INSERT grant and policy still present)',
      !r.ok && /DF_0201_POSTCONDITION/.test(r.msg || '') && JSON.stringify(before) === JSON.stringify(after), r.ok ? 'UNEXPECTEDLY APPLIED' : `aborted: ${/DF_0201_POSTCONDITION: [^:]+/.exec(r.msg || '') ? 'post-condition' : r.msg}; catalog ${JSON.stringify(before) === JSON.stringify(after) ? 'unchanged' : 'CHANGED'}`);
    await c.end(); }
  { const c = await scratchDb('selfcheck', 'dv_base');
    const noRevoke = mig.replace('REVOKE INSERT ON public.value_records FROM authenticated;', '');
    const r = await applySql(c, noRevoke);
    rec(MG, 'self-check: 0201 without its REVOKE is refused by its own post-conditions', noRevoke !== mig && !r.ok && /still holds INSERT/.test(r.msg || ''), r.ok ? 'UNEXPECTEDLY APPLIED' : 'refused');
    await c.end(); }

  // the run database: base template (1.0.0 + fixtures) + 0201
  await freshDb(dbName, 'dv_base');
  const adm = await connect(dbName), svc1 = await connect(dbName), svc2 = await connect(dbName);
  const applied = await applySql(adm, mig);
  rec(MG, 'upgrade in place: 0201 applies to a populated DATA-FOUNDATION-1.0.0 database; existing rows untouched',
    applied.ok && (await adm.query('SELECT count(*)::int n FROM public.value_records')).rows[0].n === 2, applied.ok ? 'applied; 2 existing values kept' : `${applied.code} ${applied.msg}`);
  const fpRun = await fingerprint(adm);

  async function asRole(role, uid, sql, params) {
    await adm.query('BEGIN');
    try { if (role) await adm.query(`SET LOCAL ROLE ${role}`); await adm.query("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
      const r = await adm.query(sql, params); return { ok: true, n: r.rowCount, rows: r.rows }; }
    catch (e) { return { ok: false, code: e.code, msg: e.message.split('\n')[0] }; }
    finally { await adm.query('ROLLBACK'); }
  }
  const fmtR = r => (r.ok ? `ok rows ${r.n}` : `${r.code} ${r.msg}`);
  const DENIED = '42501';
  const insVal = (owner, machine) => `INSERT INTO public.value_records (${owner ? 'owner_id, ' : ''}machine_id, canonical_field, numeric_value, unit, provenance, context)
    VALUES (${owner ? `'${owner}', ` : ''}'${machine}','fx_length',4.25,'in','user_entered','specification') RETURNING id`;

  // ============ SECURITY ============
  const SE = 'security';
  { const r = await asRole('authenticated', U.A, `INSERT INTO value_records (machine_id, canonical_field, numeric_value, unit, provenance, context, source) VALUES ('${M.MA}','fx_weight',3450,'lb','measured','specification','scale ticket') RETURNING owner_id`);
    rec(SE, '[df:198] SECURITY: the owner\u2019s direct authenticated INSERT of its own value is now REJECTED (42501)', !r.ok && r.code === DENIED, fmtR(r)); }
  { const r = await asRole('authenticated', U.A, insVal(null, M.MA)); rec(SE, 'authenticated INSERT (owner defaulted from auth.uid()) rejected (42501)', !r.ok && r.code === DENIED, fmtR(r)); }
  { const r = await asRole('authenticated', U.B, insVal(U.A, M.MA)); rec(SE, 'authenticated INSERT with a spoofed owner rejected (42501)', !r.ok && r.code === DENIED, fmtR(r)); }
  { const r = await asRole('authenticated', U.B, insVal(null, M.MB)); rec(SE, 'user B INSERT on its own machine rejected (42501)', !r.ok && r.code === DENIED, fmtR(r)); }
  { const r = await asRole('anon', null, insVal(U.A, M.MA)); rec(SE, 'anon INSERT rejected (42501)', !r.ok && r.code === DENIED, fmtR(r)); }
  { const r = await asRole('authenticated', U.A, `UPDATE value_records SET numeric_value = 1 WHERE id = '${V.VA1}'`); rec(SE, 'authenticated UPDATE still rejected (42501)', !r.ok && r.code === DENIED, fmtR(r)); }
  { const r = await asRole('authenticated', U.A, `DELETE FROM value_records WHERE id = '${V.VA1}'`); rec(SE, 'authenticated DELETE still rejected (42501)', !r.ok && r.code === DENIED, fmtR(r)); }
  { const r = await asRole('authenticated', U.A, 'TRUNCATE value_records'); rec(SE, 'authenticated TRUNCATE rejected (42501)', !r.ok && r.code === DENIED, fmtR(r)); }
  { const r = await asRole('authenticated', U.A, `SELECT id FROM value_records WHERE id = '${V.VA1}'`); rec(SE, 'authenticated SELECT of own value preserved', r.ok && r.rows.length === 1, fmtR(r)); }
  { const r = await asRole('authenticated', U.B, `SELECT id FROM value_records WHERE owner_id <> '${U.B}'`); rec(SE, 'another owner\u2019s values stay hidden (df_values_select)', r.ok && r.rows.length === 0, fmtR(r)); }
  { const r = await asRole('anon', null, 'SELECT id FROM value_records'); rec(SE, 'anon SELECT still denied (42501)', !r.ok && r.code === DENIED, fmtR(r)); }
  { const r = await asRole('service_role', null, insVal(U.A, M.MA)); rec(SE, 'the service role can perform an authorized write (owner explicit)', r.ok && r.n === 1, fmtR(r)); }
  { const q = (await adm.query(`SELECT r, p, has_table_privilege(r, 'public.value_records', p) g FROM unnest(ARRAY['anon','authenticated']) r,
      unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p ORDER BY r, p`)).rows;
    const granted = q.filter(x => x.g).map(x => `${x.r}:${x.p}`);
    rec(SE, 'privilege matrix on value_records: authenticated SELECT only; anon nothing', JSON.stringify(granted) === JSON.stringify(['authenticated:SELECT']), granted.join(',') || 'none'); }
  { const q = (await adm.query(`SELECT count(*)::int n FROM pg_class c, aclexplode(c.relacl) a WHERE c.oid = 'public.value_records'::regclass AND a.grantee = 0`)).rows[0].n;
    const col = (await adm.query(`SELECT has_any_column_privilege('authenticated','public.value_records','INSERT') ai, has_any_column_privilege('authenticated','public.value_records','UPDATE') au,
      has_any_column_privilege('anon','public.value_records','INSERT') ni, (SELECT count(*)::int FROM pg_attribute WHERE attrelid='public.value_records'::regclass AND attacl IS NOT NULL) ca`)).rows[0];
    rec(SE, 'no PUBLIC grant and no column-level INSERT/UPDATE grant on value_records', q === 0 && !col.ai && !col.au && !col.ni && col.ca === 0, `PUBLIC ${q}, column ACLs ${col.ca}`); }
  { const p = (await adm.query(`SELECT policyname, cmd FROM pg_policies WHERE schemaname='public' AND tablename='value_records' ORDER BY policyname`)).rows;
    rec(SE, 'policies on value_records: exactly df_values_select (SELECT); df_values_insert absent', JSON.stringify(p) === JSON.stringify([{ policyname: 'df_values_select', cmd: 'SELECT' }]), p.map(x => `${x.policyname}:${x.cmd}`).join(',')); }
  { const t = (await adm.query(`SELECT tgname FROM pg_trigger WHERE tgrelid='public.value_records'::regclass AND NOT tgisinternal ORDER BY tgname`)).rows.map(x => x.tgname);
    rec(SE, 'value_records triggers preserved: df_append_only, df_no_truncate, df_stamp, df_validate', t.join(',') === 'df_append_only,df_no_truncate,df_stamp,df_validate', t.join(',')); }
  { const f = (await adm.query(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname IN ('public','auth') AND p.prokind = 'f' AND p.prorettype <> 'trigger'::regtype AND pg_get_functiondef(p.oid) ~* 'value_records'
        AND (has_function_privilege('authenticated', p.oid, 'EXECUTE') OR has_function_privilege('anon', p.oid, 'EXECUTE'))`)).rows;
    const v = (await adm.query(`SELECT count(*)::int n FROM pg_views WHERE schemaname IN ('public','auth')`)).rows[0].n;
    const ru = (await adm.query(`SELECT count(*)::int n FROM pg_rules WHERE schemaname = 'public' AND tablename = 'value_records'`)).rows[0].n;
    const mem = (await adm.query(`SELECT pg_has_role('authenticated','service_role','MEMBER') a, pg_has_role('anon','service_role','MEMBER') b`)).rows[0];
    rec(SE, 'no alternate client write path: no client-callable function touches value_records, no view, no rule, no role path to service_role',
      f.length === 0 && v === 0 && ru === 0 && !mem.a && !mem.b, `functions ${f.length}, views ${v}, rules ${ru}, role path ${mem.a || mem.b}`); }
  { const d = diff(fpAmended, fpRun); rec(SE, 'upgraded database and clean install have the identical catalog', d.onlyA.length === 0 && d.onlyB.length === 0, `${d.onlyA.length + d.onlyB.length} differing entries`); }

  // ---------------- service instances (the trusted path) ----------------
  const contracts = mutant && mutant.contracts ? mutant.contracts(createFieldContracts(CONTRACTS)) : createFieldContracts(CONTRACTS);
  const mk = client => (mutant && mutant.repository ? mutant.repository(client) : createRepository(client));
  const components = mutant && mutant.components;
  const service = createValueWriteService({ repository: mk(svc1), contracts, components });
  const service2 = createValueWriteService({ repository: mk(svc2), contracts, components });
  const guard = async p => { try { return await p; } catch (e) { return { outcome: 'threw', code: 'THREW', reason: e.message.split('\n')[0] }; } };
  const call = (owner, req, svc) => guard((svc || service).write(owner === null ? undefined : { owner_id: owner }, req));
  const cur = (owner, machine, field) => guard(service.current({ owner_id: owner }, { machine_id: machine, canonical_field: field }));
  const allVals = async () => (await adm.query('SELECT count(*)::int n FROM public.value_records')).rows[0].n;
  const dbRow = async id => (await adm.query('SELECT owner_id, machine_id, component_id, canonical_field, numeric_value, numeric_value::text AS txt, option_value, unit, provenance, context, source, supersedes_id FROM public.value_records WHERE id = $1', [id])).rows[0];
  const fmt = o => (o.outcome === 'rejected' || o.outcome === 'threw' ? `${o.outcome} ${o.code} ${o.reason}` : `${o.outcome}${o.value ? ` ${o.value.provenance} ${o.value.numeric_value === null ? 'null' : Object.is(o.value.numeric_value, -0) ? '-0' : o.value.numeric_value} ${o.value.unit}` : ''}`);
  async function expectReject(g, name, owner, req, code, reason) {
    const before = await allVals(); const o = await call(owner, req); const after = await allVals();
    rec(g, name, o.outcome === 'rejected' && o.code === code && (!reason || o.reason === reason) && after === before, `${fmt(o)}; rows +${after - before}`);
    return o;
  }
  async function expectCreated(g, name, owner, req, check) {
    const before = await allVals(); const o = await call(owner, req); const after = await allVals();
    let row = null; if (o.outcome === 'created') row = await dbRow(o.value.value_id);
    const ok = o.outcome === 'created' && after === before + 1 && !!row && (!check || check(o.value, row));
    rec(g, name, ok, `${fmt(o)}; rows +${after - before}${row ? `; stored ${row.txt === null ? 'NULL' : row.txt} ${row.unit}` : ''}`);
    return o.outcome === 'created' ? o.value : null;
  }
  const req = (field, value, unit, provenance, extra) => Object.assign({ machine_id: M.MA, canonical_field: field, value, unit, provenance }, extra || {});

  // ============ PRESERVATION (S: service-role SQL, the frozen database rules after 0201) ============
  const PR = 'preservation';
  const sIns = (f, v, o, unit, prov, opts = {}) => `INSERT INTO public.value_records (owner_id, machine_id, canonical_field, numeric_value, option_value, unit, provenance, context${opts.cols ? ', ' + opts.cols : ''})
    VALUES ('${opts.owner || U.A}','${opts.machine || M.MA}','${f}',${v === null ? 'NULL' : v},${o === null ? 'NULL' : `'${o}'`},'${unit}','${prov}','${opts.ctx || 'specification'}'${opts.vals ? ', ' + opts.vals : ''})
    RETURNING id, owner_id, numeric_value, provenance, context`;
  const sOk = async (name, sql, check) => { const r = await asRole('service_role', null, sql); rec(PR, name, r.ok && (!check || check(r)), fmtR(r)); };
  const sErr = async (name, sql, code, re) => { const r = await asRole('service_role', null, sql); rec(PR, name, !r.ok && r.code === code && (!re || re.test(r.msg)), fmtR(r)); };
  await sErr('[df:156 S] categorical value with an empty option rejected (values_option_nonempty)', sIns('fx_categorical', null, '', '-', 'user_entered'), '23514', /values_option_nonempty/);
  await sErr('[df:170 S] unknown canonical field rejected (DF_VALUE)', sIns('no_such_field', 1, null, 'lb', 'user_entered'), '23503', /DF_VALUE/);
  await sOk('[df:198 S] the same value written by the service role is accepted with the explicit owner', sIns('fx_weight', 3450, null, 'lb', 'measured', { cols: 'source', vals: "'scale ticket'" }), r => r.rows[0].owner_id === U.A);
  await sErr('[df:199 S] owner/machine mismatch rejected by composite FK values_machine_same_owner_fk (A on B machine)', sIns('fx_weight', 1, null, 'lb', 'user_entered', { machine: M.MB }), '23503', /values_machine_same_owner_fk/);
  await sErr('[df:200 S] owner/machine mismatch rejected by composite FK values_machine_same_owner_fk (B on A machine)', sIns('fx_weight', 1, null, 'lb', 'user_entered', { owner: U.B }), '23503', /values_machine_same_owner_fk/);
  await sOk('[df:228 S] zero is a KNOWN value (0, user_entered)', sIns('fx_weight', 0, null, 'lb', 'user_entered'), r => r.rows[0].numeric_value === 0 && r.rows[0].provenance === 'user_entered');
  await sOk('[df:229 S] unknown = no value + provenance unknown', sIns('fx_weight', null, null, 'lb', 'unknown'), r => r.rows[0].numeric_value === null);
  await sErr('[df:230 S] no value with a known provenance rejected', sIns('fx_weight', null, null, 'lb', 'user_entered'), '23514');
  await sErr('[df:231 S] a number with provenance unknown rejected (values_unknown_has_no_value)', sIns('fx_weight', 5, null, 'lb', 'unknown'), '23514', /values_unknown_has_no_value/);
  await sErr('[df:232 S] zero with provenance unknown rejected (zero is not unknown)', sIns('fx_weight', 0, null, 'lb', 'unknown'), '23514', /values_unknown_has_no_value/);
  await sErr('[df:233 S] both numeric and option rejected (values_known_has_exactly_one)', sIns('fx_weight', 5, 'x', 'lb', 'user_entered'), '23514', /values_known_has_exactly_one/);
  await sErr('[df:234 S] categorical field given a number rejected (DF_KIND)', sIns('fx_categorical', 5, null, '-', 'user_entered'), '23514', /DF_KIND/);
  await sErr('[df:235 S] numeric field given an option rejected (DF_KIND)', sIns('fx_weight', null, 'heavy', 'lb', 'user_entered'), '23514', /DF_KIND/);
  await sOk('[df:236 S] categorical field with a declared option accepted', sIns('fx_categorical', null, 'manual', '-', 'user_entered'));
  for (const bad of ["'NaN'", "'Infinity'", "'-Infinity'"]) await sErr(`[df:237 S] non-finite ${bad} rejected as a known value (values_numeric_finite)`, sIns('fx_weight', bad + '::float8', null, 'lb', 'user_entered'), '23514', /values_numeric_finite/);
  await sErr('[df:240 S] value in a non-canonical unit rejected (DF_UNIT backstop: kg for an lb field)', sIns('fx_weight', 1551, null, 'kg', 'user_entered'), '23514', /DF_UNIT/);
  await sOk('[df:241 S] value in the canonical engine-native unit accepted', sIns('fx_length', 4.25, null, 'in', 'manufacturer_specified'));
  await sErr('[df:244 S] calculated without calculation_id rejected', sIns('fx_weight', 1, null, 'lb', 'calculated'), '23514', /values_calculated_needs_calculation/);
  await sErr('[df:245 S] derived without calculation_id rejected', sIns('fx_weight', 1, null, 'lb', 'derived'), '23514', /values_calculated_needs_calculation/);
  for (const p of ['calculated', 'derived']) await sOk(`[df:246 S] ${p} linked to its own Calculation accepted (database rule preserved)`, sIns('fx_weight', 10, null, 'lb', p, { cols: 'calculation_id', vals: `'${CR.CRA}'` }));
  for (const p of ['measured', 'manufacturer_specified', 'user_entered', 'empirical', 'estimated']) await sOk(`[df:247 S] provenance ${p} accepted by the database`, sIns('fx_weight', 1, null, 'lb', p));
  await sErr("[df:248 S] 'imported' is not a provenance category (22P02)", sIns('fx_weight', 1, null, 'lb', 'imported'), '22P02');
  await sOk('[df:249 S] import channel recorded in source with the original provenance kept', sIns('fx_weight', 3420, null, 'lb', 'manufacturer_specified', { cols: 'source', vals: "'import: spec sheet'" }));
  await sOk('[df:250 S] operating_state context accepted by the database (generic rule)', sIns('fx_weight', 3600, null, 'lb', 'measured', { ctx: 'operating_state' }), r => r.rows[0].context === 'operating_state');
  await sOk('[df:270 S] service-supplied recorded_at ignored: server time used (df_stamp)',
    `INSERT INTO public.value_records (owner_id, machine_id, canonical_field, numeric_value, unit, provenance, context, recorded_at) VALUES ('${U.A}','${M.MA}','fx_weight',1,'lb','user_entered','specification','1999-01-01') RETURNING recorded_at = now() AS server_time`,
    r => r.rows[0].server_time === true);
  await sOk('[df:273 S] correction = new row superseding the old; old row kept', `
    WITH c AS (INSERT INTO public.value_records (owner_id, machine_id, canonical_field, numeric_value, unit, provenance, context, supersedes_id)
               VALUES ('${U.A}','${M.MA}','fx_weight',3399,'lb','measured','specification','${V.VA1}') RETURNING id)
    SELECT (SELECT numeric_value FROM public.value_records WHERE id='${V.VA1}') AS old_kept, (SELECT count(*) FROM c) AS added`, r => r.rows[0].old_kept === 3420 && +r.rows[0].added === 1);
  await sErr('[df:277 S] a value can be superseded only once (values_superseded_once)', `
    WITH x AS (INSERT INTO public.value_records (owner_id, machine_id, canonical_field, numeric_value, unit, provenance, context, supersedes_id) VALUES ('${U.A}','${M.MA}','fx_weight',1,'lb','measured','specification','${V.VA1}'))
    INSERT INTO public.value_records (owner_id, machine_id, canonical_field, numeric_value, unit, provenance, context, supersedes_id) VALUES ('${U.A}','${M.MA}','fx_weight',2,'lb','measured','specification','${V.VA1}')`, '23505', /values_superseded_once/);
  await sErr('[df:280 S] superseding a different field rejected (DF_SUPERSEDE)', sIns('fx_length', 4, null, 'in', 'measured', { cols: 'supersedes_id', vals: `'${V.VA1}'` }), '23514', /DF_SUPERSEDE/);
  await sErr('[df:282 S] superseding across contexts rejected (DF_SUPERSEDE)', sIns('fx_weight', 4, null, 'lb', 'measured', { ctx: 'operating_state', cols: 'supersedes_id', vals: `'${V.VA1}'` }), '23514', /DF_SUPERSEDE/);
  for (const [op, sql] of [['UPDATE', `UPDATE public.value_records SET numeric_value = 1 WHERE id = '${V.VA1}'`], ['DELETE', `DELETE FROM public.value_records WHERE id = '${V.VA1}'`], ['TRUNCATE', 'TRUNCATE public.value_records CASCADE']]) {
    await sErr(`append-only: service-role ${op} refused (DF_IMMUTABLE)`, sql, 'P0001', /DF_IMMUTABLE/);
  }

  // ============ TRUSTED PATH (T: the Value Foundation V1 contract, one per reconciled line) ============
  const TP = 'trusted-path';
  await expectReject(TP, '[df:156 T] categorical field not admitted in V1 (allowlist rejects before the database)', U.A, req('fx_categorical', null, null, 'user_entered'), 'VW_FIELD_NOT_ADMITTED');
  await expectReject(TP, '[df:170 T] unknown canonical field rejected by the key allowlist', U.A, req('no_such_field', 1, 'in', 'user_entered'), 'VW_FIELD_NOT_ADMITTED');
  const t198 = await expectCreated(TP, '[df:198 T] trusted path writes the owner\u2019s value; owner derived from the verified login', U.A,
    req('fx_length', 4.25, 'in', 'measured', { source: 'scale ticket' }), (v, row) => v.owner_id === U.A && row.owner_id === U.A && row.numeric_value === 4.25);
  await expectReject(TP, '[df:199 T] a request-supplied owner_id is never used (request rejected)', U.B, Object.assign(req('fx_length', 1, 'in', 'user_entered'), { owner_id: U.A }), 'VW_MALFORMED_REQUEST', 'unexpected_key');
  await expectReject(TP, '[df:200 T] B cannot add a value to A\u2019s machine (active-machine owner filter)', U.B, req('fx_length', 1, 'in', 'user_entered'), 'VW_MACHINE_NOT_FOUND');
  await expectCreated(TP, '[df:228 T] explicit zero preserved as a known 0', U.A, Object.assign(req('fx_force', 0, 'lbf', 'user_entered'), { machine_id: M.MH }), (v, row) => Object.is(v.numeric_value, 0) && row.txt === '0' && row.provenance === 'user_entered');
  await expectCreated(TP, '[df:229 T] unknown written as no value + provenance unknown, stored in the canonical unit', U.A, Object.assign(req('fx_volume_gal', null, null, 'unknown'), { machine_id: M.MH }), (v, row) => row.numeric_value === null && row.provenance === 'unknown' && row.unit === 'gal');
  await expectReject(TP, '[df:230 T] no value with a known provenance rejected before the database', U.A, req('fx_length', null, 'in', 'user_entered'), 'VW_INVALID_VALUE', 'known_value_required');
  await expectReject(TP, '[df:231 T] a number with provenance unknown rejected before the database', U.A, req('fx_length', 5, 'in', 'unknown'), 'VW_INVALID_VALUE', 'unknown_has_no_value');
  await expectReject(TP, '[df:232 T] zero with provenance unknown rejected (zero is not unknown)', U.A, req('fx_length', 0, 'in', 'unknown'), 'VW_INVALID_VALUE', 'unknown_has_no_value');
  await expectReject(TP, '[df:233 T] an option value is not part of the V1 request (numeric keys only)', U.A, Object.assign(req('fx_length', 5, 'in', 'user_entered'), { option_value: 'x' }), 'VW_MALFORMED_REQUEST', 'unexpected_key');
  await expectReject(TP, '[df:234 T] categorical field given a number: not admitted in V1', U.A, req('fx_categorical', 5, '-', 'user_entered'), 'VW_FIELD_NOT_ADMITTED');
  await expectReject(TP, '[df:235 T] numeric field given a text option: numeric input required', U.A, req('fx_length', 'heavy', 'in', 'user_entered'), 'VW_INVALID_VALUE', 'numeric_value_required');
  await expectReject(TP, '[df:236 T] categorical field with an option: not admitted in V1', U.A, req('fx_categorical', 'manual', '-', 'user_entered'), 'VW_FIELD_NOT_ADMITTED');
  for (const [label, bad] of [['NaN', NaN], ['Infinity', Infinity], ['-Infinity', -Infinity]]) await expectReject(TP, `[df:237 T] non-finite ${label} rejected before the database`, U.A, req('fx_length', bad, 'in', 'user_entered'), 'VW_INVALID_VALUE', 'non_finite_value');
  await expectReject(TP, '[df:240 T] unsupported unit rejected (kg for a length field)', U.A, req('fx_length', 1551, 'kg', 'user_entered'), 'VW_UNSUPPORTED_UNIT');
  await expectCreated(TP, '[df:241 T] a supported unit is converted and stored in the engine-native unit (101.6 mm -> 4 in)', U.A, Object.assign(req('fx_length', 101.6, 'mm', 'manufacturer_specified'), { machine_id: M.MH }), (v, row) => row.unit === 'in' && row.numeric_value === 4);
  await expectReject(TP, '[df:244 T] provenance calculated not permitted in V1 (no calculated write-back)', U.A, req('fx_length', 1, 'in', 'calculated'), 'VW_PROVENANCE_NOT_PERMITTED');
  await expectReject(TP, '[df:245 T] provenance derived not permitted in V1', U.A, req('fx_length', 1, 'in', 'derived'), 'VW_PROVENANCE_NOT_PERMITTED');
  await expectReject(TP, '[df:246 T] a calculation link cannot be supplied: calculated values are never written back in V1', U.A, Object.assign(req('fx_length', 10, 'in', 'calculated'), { calculation_id: CR.CRA }), 'VW_MALFORMED_REQUEST', 'unexpected_key');
  for (const p of ['user_entered', 'manufacturer_specified', 'estimated', 'measured']) await expectCreated(TP, `[df:247 T] V1 provenance ${p} accepted`, U.A, Object.assign(req('fx_angle', 30, '°', p), { machine_id: M.MH }), (v, row) => row.provenance === p);
  await expectReject(TP, '[df:247 T] provenance empirical REJECTED in V1 (test results deferred)', U.A, req('fx_length', 1, 'in', 'empirical'), 'VW_PROVENANCE_NOT_PERMITTED');
  await expectReject(TP, "[df:248 T] 'imported' rejected by the provenance allowlist", U.A, req('fx_length', 1, 'in', 'imported'), 'VW_PROVENANCE_NOT_PERMITTED');
  await expectCreated(TP, '[df:249 T] channel recorded in source (frozen meaning); the entered value and unit are not stored (G-5)', U.A,
    Object.assign(req('fx_length', 254, 'mm', 'manufacturer_specified', { source: 'import: spec sheet' }), { machine_id: M.MH }),
    (v, row) => row.source === 'import: spec sheet' && row.unit === 'in' && row.numeric_value === 10 && row.txt === '10');
  await expectReject(TP, '[df:250 T] operating_state context rejected in V1 (specification only)', U.A, req('fx_length', 1, 'in', 'user_entered', { context: 'operating_state' }), 'VW_CONTEXT_NOT_PERMITTED');
  await expectReject(TP, '[df:270 T] recorded_at cannot be supplied to the trusted path', U.A, Object.assign(req('fx_length', 1, 'in', 'user_entered'), { recorded_at: '1999-01-01' }), 'VW_MALFORMED_REQUEST', 'unexpected_key');
  { const r = t198 ? (await adm.query(`SELECT recorded_at > '2000-01-01'::timestamptz AS server FROM public.value_records WHERE id = $1`, [t198.value_id])).rows[0] : null;
    rec(TP, '[df:270 T] the service never supplies recorded_at: the server stamp is used', !!r && r.server === true, r ? `server ${r.server}` : 'no row'); }
  { const a = await call(U.A, Object.assign(req('fx_energy', 60, 'kWh', 'estimated'), { machine_id: M.MS }));
    const b = await call(U.A, Object.assign(req('fx_energy', 75, 'kWh', 'measured'), { machine_id: M.MS }));
    const c = await cur(U.A, M.MS, 'fx_energy');
    rec(TP, '[df:273 T] a correction supersedes the current head under the series lock; current follows the chain',
      a.outcome === 'created' && b.outcome === 'created' && b.value.supersedes_id === a.value.value_id && c.outcome === 'found' && c.value.numeric_value === 75, `${fmt(a)} / ${fmt(b)} / current ${fmt(c)}`); }
  { // stale head on the first attempt -> values_superseded_once (23505) -> savepoint rollback -> retry with the fresh head
    const base = mk(svc1); let calls = 0; let staleId = null;
    const stale = Object.freeze(Object.assign({}, base, { async head(o, m, f, ctx) { calls++; const h = await base.head(o, m, f, ctx);
      if (calls === 1 && h && h.supersedes_id) { staleId = h.supersedes_id; return Object.assign({}, h, { id: h.supersedes_id }); } return h; } }));
    const s = createValueWriteService({ repository: stale, contracts, components });
    const before = await allVals(); const o = await guard(s.write({ owner_id: U.A }, Object.assign(req('fx_energy', 80, 'kWh', 'measured'), { machine_id: M.MS }))); const after = await allVals();
    const c = await cur(U.A, M.MS, 'fx_energy');
    rec(TP, '[df:277 T] a double supersede is refused by values_superseded_once; the service retries against the fresh head',
      o.outcome === 'created' && calls === 2 && !!staleId && after === before + 1 && c.outcome === 'found' && c.value.numeric_value === 80 && o.value.supersedes_id !== staleId, `${fmt(o)}; head reads ${calls}; rows +${after - before}`); }
  { const a = await call(U.A, Object.assign(req('fx_ratio', 3.73, ':1', 'manufacturer_specified'), { machine_id: M.MS }));
    const b = await call(U.A, Object.assign(req('fx_thread', 18, 'TPI', 'manufacturer_specified'), { machine_id: M.MS }));
    rec(TP, '[df:280 T] the head lookup is scoped to (machine, field, context): a different field starts its own series',
      a.outcome === 'created' && b.outcome === 'created' && a.value.supersedes_id === null && b.value.supersedes_id === null, `${fmt(a)} / ${fmt(b)}`); }
  await expectCreated(TP, '[df:282 T] context is fixed to specification (an explicit specification context accepted)', U.A,
    Object.assign(req('fx_area_sq_ft', 21.5, 'sq ft', 'estimated', { context: 'specification' }), { machine_id: M.MH }), (v, row) => row.context === 'specification');

  // ============ VALUES ============
  const VA = 'values';
  await expectReject(VA, 'missing value key rejected: never silently unknown, zero or a default', U.A, { machine_id: M.MA, canonical_field: 'fx_length', unit: 'in', provenance: 'user_entered' }, 'VW_MALFORMED_REQUEST', 'value_required');
  await expectReject(VA, 'blank input rejected: blank never becomes a machine value', U.A, req('fx_length', '', 'in', 'user_entered'), 'VW_INVALID_VALUE', 'numeric_value_required');
  await expectReject(VA, 'numeric string rejected: no string coercion', U.A, req('fx_length', '4.25', 'in', 'user_entered'), 'VW_INVALID_VALUE', 'numeric_value_required');
  await expectReject(VA, 'non-numeric input rejected (boolean)', U.A, req('fx_length', true, 'in', 'user_entered'), 'VW_INVALID_VALUE', 'numeric_value_required');
  await expectReject(VA, 'non-numeric input rejected (object)', U.A, req('fx_length', { v: 1 }, 'in', 'user_entered'), 'VW_INVALID_VALUE', 'numeric_value_required');
  await expectCreated(VA, 'negative zero -> +0 (identity unit)', U.A, Object.assign(req('fx_force', -0, 'lbf', 'user_entered'), { machine_id: M.MH }), (v, row) => Object.is(v.numeric_value, 0) && Object.is(row.numeric_value, 0) && row.txt === '0');
  await expectCreated(VA, 'negative zero -> +0 (after conversion: -0 mm)', U.A, Object.assign(req('fx_length', -0, 'mm', 'user_entered'), { machine_id: M.MH }), (v, row) => Object.is(row.numeric_value, 0) && row.txt === '0');
  { // observed at the service -> repository boundary: the contract must not rely on the driver (node-pg sends -0 as "0")
    const base = mk(svc1), seen = [];
    const spy = Object.freeze(Object.assign({}, base, { async insert(p) { seen.push(p.numeric_value); return base.insert(p); } }));
    const s = createValueWriteService({ repository: spy, contracts, components });
    const o1 = await guard(s.write({ owner_id: U.A }, Object.assign(req('fx_force', -0, 'lbf', 'user_entered'), { machine_id: M.MH })));
    const o2 = await guard(s.write({ owner_id: U.A }, Object.assign(req('fx_length', -0, 'mm', 'user_entered'), { machine_id: M.MH })));
    rec(VA, 'negative zero is normalized by the service BEFORE insert (+0 handed to the database, identity and converted)',
      o1.outcome === 'created' && o2.outcome === 'created' && seen.length === 2 && seen.every(x => Object.is(x, 0)), `${seen.map(x => (Object.is(x, -0) ? '-0' : String(x))).join(',')}`); }
  await expectCreated(VA, 'explicit zero after conversion stays a known zero (0 N -> 0 lbf)', U.A, Object.assign(req('fx_force', 0, 'N', 'measured'), { machine_id: M.MH }), (v, row) => row.txt === '0' && row.provenance === 'measured');
  await expectCreated(VA, 'negative values: sign preserved (field contract, spec §H): -0.5 in', U.A, Object.assign(req('fx_length', -0.5, 'in', 'user_entered'), { machine_id: M.MH }), (v, row) => row.numeric_value === -0.5);
  await expectCreated(VA, 'large finite value accepted unchanged (1e300 in)', U.A, Object.assign(req('fx_length', 1e300, 'in', 'user_entered'), { machine_id: M.MH }), (v, row) => row.numeric_value === 1e300);
  await expectReject(VA, 'non-finite result rejected (overflow: max double cu in -> cc)', U.A, req('fx_volume_cc', Number.MAX_VALUE, 'cu in', 'user_entered'), 'VW_INVALID_CONVERSION', 'non_finite_result');
  await expectReject(VA, 'out-of-range result rejected (nonzero input underflows: 1e-307 mm)', U.A, req('fx_length', 1e-307, 'mm', 'user_entered'), 'VW_INVALID_CONVERSION', 'out_of_range_result');
  await expectReject(VA, 'known value without a unit rejected', U.A, req('fx_length', 4, null, 'user_entered'), 'VW_UNSUPPORTED_UNIT', 'unit_required');
  await expectCreated(VA, 'unknown needs no unit (stored in the canonical unit)', U.A, Object.assign(req('fx_area_sq_in', null, null, 'unknown'), { machine_id: M.MH }), (v, row) => row.unit === 'sq in' && row.numeric_value === null);
  await expectReject(VA, 'unknown with an unsupported unit still rejected', U.A, req('fx_area_sq_in', null, 'kg', 'unknown'), 'VW_UNSUPPORTED_UNIT');
  await expectReject(VA, 'component-level value rejected (V1 is machine-level)', U.A, req('fx_length', 1, 'in', 'user_entered', { component_id: '30000000-0000-4000-8000-0000000000a1' }), 'VW_COMPONENT_NOT_PERMITTED');
  await expectReject(VA, 'supersedes_id cannot be supplied (the service owns supersession)', U.A, Object.assign(req('fx_length', 1, 'in', 'user_entered'), { supersedes_id: V.VA1 }), 'VW_MALFORMED_REQUEST', 'unexpected_key');
  await expectReject(VA, 'empty source rejected', U.A, req('fx_length', 1, 'in', 'user_entered', { source: '  ' }), 'VW_MALFORMED_REQUEST', 'source_invalid');
  { const byProv = {}; for (const p of V1_PROVENANCES) byProv[p] = 1;
    rec(VA, 'V1 provenance allowlist is exactly user_entered, manufacturer_specified, estimated, measured, unknown',
      JSON.stringify([...V1_PROVENANCES].sort()) === JSON.stringify(['estimated', 'manufacturer_specified', 'measured', 'unknown', 'user_entered']), V1_PROVENANCES.join(',')); }

  // ============ UNITS (spec §H vectors, bit-exact, stored value read back from the database) ============
  const UN = 'units';
  const VEC = [
    ['fx_length', 25.4, 'mm', 1, '25.4 mm -> 1 in'], ['fx_length', 1, 'in', 1, '1 in -> 1 in (storage unit, identity)'],
    ['fx_length', -12.7, 'mm', -0.5, '-12.7 mm -> -0.5 in (sign preserved)'], ['fx_length', 12.7, 'mm', 0.5, '12.7 mm -> 0.5 in (division, not the binary reciprocal 0.49999999999999994)'],
    ['fx_length', 50.8, 'mm', 2, '50.8 mm -> 2 in (division, not 1.9999999999999998)'], ['fx_length', 76.2, 'mm', 3.0000000000000004, '76.2 mm -> 3.0000000000000004 in (binary64 quotient, no write rounding)'],
    ['fx_length', 1000, 'mm', 39.37007874015748, 'D-1 regression: 1000 mm -> 39.37007874015748 in (no x25.4 or /25.4 mis-scaling)'],
    ['fx_force', 4.4482216152605, 'N', 1, '4.4482216152605 N -> 1 lbf'], ['fx_force', 100, 'lbf', 100, '100 lbf -> 100 lbf'],
    ['fx_volume_gal', 3.785411784, 'L', 1, '3.785411784 L -> 1 gal'], ['fx_volume_gal', 3, 'L', 0.7925161570744452, '3 L -> 0.7925161570744452 gal (division, not reciprocal)'],
    ['fx_volume_cc', 1, 'cu in', 16.387064, '1 cu in -> 16.387064 cc'], ['fx_volume_cc', -5, 'cc', -5, '-5 cc stays -5 cc (piston-crown sign preserved)'],
    ['fx_area_sq_in', 645.16, 'mm²', 1, '645.16 mm² -> 1 sq in'], ['fx_area_sq_in', 6.4516, 'cm²', 1, '6.4516 cm² -> 1 sq in'],
    ['fx_area_sq_in', 5, 'mm²', 0.007750015500031001, '5 mm² -> 0.007750015500031001 sq in (division, not reciprocal)'],
    ['fx_area_sq_ft', 0.09290304, 'm²', 1, '0.09290304 m² -> 1 sq ft'], ['fx_area_sq_ft', 100, 'm²', 1076.391041670972, '100 m² -> 1076.391041670972 sq ft (division, not reciprocal)'],
    ['fx_ratio', 3.73, ':1', 3.73, ':1 identity (no conversion in V1)'], ['fx_angle', 42.5, '°', 42.5, '° identity (no conversion in V1)'],
    ['fx_energy', 75, 'kWh', 75, 'kWh identity (no conversion in V1)'], ['fx_thread', 18, 'TPI', 18, 'TPI identity (no conversion in V1)']];
  for (const [f, v, u, want, label] of VEC) {
    await expectCreated(UN, `vector ${label}`, U.A, Object.assign(req(f, v, u, 'manufacturer_specified'), { machine_id: M.MH }),
      (val, row) => Object.is(row.numeric_value, want) && Object.is(val.numeric_value, want) && row.unit === contracts.get(f).storage_unit);
  }
  rec(UN, 'round trip 1 in -> 25.4 mm (display) -> 1 in (write) is exact', 1 * UNITS.FACTOR.MM_PER_IN === 25.4 && UNITS.normalize('in', 'mm', 1 * UNITS.FACTOR.MM_PER_IN).value === 1, 'exact');
  for (const [f, u, label] of [['fx_ratio', 'mm', 'mm for a ratio'], ['fx_thread', 'mm', 'thread pitch in mm for TPI (a reciprocal relation, not in V1)'],
    ['fx_force', 'lb', 'lb (mass) for a force'], ['fx_area_sq_in', 'mm2', 'ASCII mm2 (exact unit tokens only)'], ['fx_length', 'MM', 'MM (case-sensitive tokens)'],
    ['fx_energy', 'kW', 'kW for an energy'], ['fx_volume_gal', 'gal (UK)', 'imperial gallon']]) {
    await expectReject(UN, `unsupported unit rejected: ${label}`, U.A, req(f, 1, u, 'user_entered'), 'VW_UNSUPPORTED_UNIT', 'unit_not_supported_for_field');
  }
  { const want = { 'in': 'in,mm', 'lbf': 'lbf,N', 'gal': 'gal,L', 'cc': 'cc,cu in', 'sq in': 'sq in,mm²,cm²', 'sq ft': 'sq ft,m²', ':1': ':1', '°': '°', 'kWh': 'kWh', 'TPI': 'TPI' };
    const got = {}; for (const s of UNITS.STORAGE_UNITS) got[s] = UNITS.inputUnitsFor(s).join(',');
    rec(UN, 'conversion table is exactly the spec §H pair set (10 storage units)', JSON.stringify(got) === JSON.stringify(want), Object.keys(got).length + ' storage units'); }
  { const exact = Object.entries(UNITS.TABLE).every(([, m]) => Object.values(m).every(([op, k]) => op === 'id' || Object.values(UNITS.FACTOR).includes(k)));
    const f = UNITS.FACTOR;
    rec(UN, 'every factor is an exact §H defining constant (no rounded reciprocal)', exact && f.MM_PER_IN === 25.4 && f.N_PER_LBF === 4.4482216152605 && f.L_PER_GAL === 3.785411784
      && f.CC_PER_CU_IN === 16.387064 && f.MM2_PER_SQ_IN === 645.16 && f.CM2_PER_SQ_IN === 6.4516 && f.M2_PER_SQ_FT === 0.09290304, 'factors checked'); }
  { const r = await adm.query(`SELECT count(*)::int n FROM public.value_records v JOIN public.canonical_fields f ON f.key = v.canonical_field WHERE v.unit IS DISTINCT FROM f.canonical_unit`);
    rec(UN, 'every stored value is in its field\u2019s canonical engine-native unit (DF_UNIT holds for the whole table)', r.rows[0].n === 0, `${r.rows[0].n} off-unit rows`); }
  { const r = await adm.query(`SELECT count(*)::int n FROM public.canonical_fields WHERE dimension IS NOT NULL`);
    rec(UN, 'dimension stays NULL (G-3): the service never writes canonical_fields', r.rows[0].n === 0, `${r.rows[0].n} rows with a dimension`); }

  // ============ SEMANTICS ============
  const SM = 'semantics';
  { const o = await cur(U.A, M.MS, 'fx_force'); rec(SM, 'nothing recorded -> current is absent (never zero, never a default)', o.outcome === 'absent', fmt(o)); }
  { const ids = [];
    for (const [v, p] of [[1200, 'manufacturer_specified'], [1180, 'measured'], [1210, 'estimated']]) { const o = await call(U.A, Object.assign(req('fx_force', v, 'lbf', p), { machine_id: M.MS })); ids.push(o.outcome === 'created' ? o.value : null); }
    const chain = ids.every(Boolean) && ids[0].supersedes_id === null && ids[1].supersedes_id === ids[0].value_id && ids[2].supersedes_id === ids[1].value_id;
    const kept = (await adm.query(`SELECT count(*)::int n FROM public.value_records WHERE machine_id = $1 AND canonical_field = 'fx_force'`, [M.MS])).rows[0].n;
    const heads = (await adm.query(`SELECT count(*)::int n FROM public.value_records v WHERE machine_id = $1 AND canonical_field = 'fx_force' AND NOT EXISTS (SELECT 1 FROM public.value_records s WHERE s.supersedes_id = v.id)`, [M.MS])).rows[0].n;
    const c = await cur(U.A, M.MS, 'fx_force');
    rec(SM, 'append-only linear history: each write supersedes the previous head; superseded rows retained', chain && kept === 3, `chain ${chain}, rows ${kept}`);
    rec(SM, 'exactly one current value per series (one non-superseded head)', heads === 1, `${heads} heads`);
    rec(SM, 'no provenance priority: the newest value is current even when a measured value exists (estimated wins by recency)', c.outcome === 'found' && c.value.numeric_value === 1210 && c.value.provenance === 'estimated', fmt(c)); }
  { await call(U.A, Object.assign(req('fx_force', null, null, 'unknown'), { machine_id: M.MS }));
    const c = await cur(U.A, M.MS, 'fx_force');
    rec(SM, 'UNKNOWN != ZERO: a newer unknown becomes current as no value (not 0, not the previous value)', c.outcome === 'found' && c.value.numeric_value === null && c.value.provenance === 'unknown', fmt(c)); }
  { const o = await call(U.A, Object.assign(req('fx_force', 0, 'lbf', 'measured'), { machine_id: M.MS })); const c = await cur(U.A, M.MS, 'fx_force');
    rec(SM, 'UNKNOWN != ZERO: a later explicit zero is current as a known 0', o.outcome === 'created' && c.outcome === 'found' && Object.is(c.value.numeric_value, 0) && c.value.provenance === 'measured', fmt(c)); }
  { const o = await call(U.A, Object.assign(req('fx_length', 7, 'in', 'user_entered'), { machine_id: M.MS }));
    const r = o.outcome === 'created' ? await asRole('service_role', null, `UPDATE public.value_records SET numeric_value = 8 WHERE id = '${o.value.value_id}'`) : { ok: true };
    rec(SM, 'a trusted-path value is append-only: service-role UPDATE refused (DF_IMMUTABLE)', !r.ok && r.code === 'P0001', fmtR(r)); }
  { const [a, b] = await Promise.all([call(U.A, Object.assign(req('fx_length', 11, 'in', 'measured'), { machine_id: M.MC })), call(U.A, Object.assign(req('fx_length', 12, 'in', 'measured'), { machine_id: M.MC }), service2)]);
    const heads = (await adm.query(`SELECT count(*)::int n FROM public.value_records v WHERE machine_id = $1 AND canonical_field = 'fx_length' AND NOT EXISTS (SELECT 1 FROM public.value_records s WHERE s.supersedes_id = v.id)`, [M.MC])).rows[0].n;
    const linked = a.outcome === 'created' && b.outcome === 'created' && ((a.value.supersedes_id === null && b.value.supersedes_id === a.value.value_id) || (b.value.supersedes_id === null && a.value.supersedes_id === b.value.value_id));
    rec(SM, 'concurrent writers on one series (two connections): both succeed, serialized into one linear chain, one current', linked && heads === 1, `${a.outcome}/${b.outcome}, linked ${linked}, heads ${heads}`); }
  { const o = await guard(service.current({ owner_id: U.A }, { machine_id: M.MA, canonical_field: 'fx_weight' }));
    rec(SM, 'current-value read is restricted to admitted fields', o.outcome === 'rejected' && o.code === 'VW_FIELD_NOT_ADMITTED', fmt(o)); }

  // ============ OWNERSHIP / SOFT DELETE ============
  const OW = 'ownership';
  await expectReject(OW, 'no owner context rejected', null, req('fx_length', 1, 'in', 'user_entered'), 'VW_NO_OWNER');
  { const before = await allVals(); const o = await guard(service.write({ owner_id: U.A, role: 'admin' }, req('fx_length', 1, 'in', 'user_entered'))); const after = await allVals();
    rec(OW, 'owner context with extra claims rejected', o.outcome === 'rejected' && o.code === 'VW_NO_OWNER' && after === before, fmt(o)); }
  { const o = await guard(service.write({ owner_id: 'not-a-uuid' }, req('fx_length', 1, 'in', 'user_entered'))); rec(OW, 'malformed owner id rejected', o.outcome === 'rejected' && o.code === 'VW_NO_OWNER', fmt(o)); }
  await expectReject(OW, 'a request-supplied owner equal to the login is still rejected (ownership never comes from the request)', U.A, Object.assign(req('fx_length', 1, 'in', 'user_entered'), { owner_id: U.A }), 'VW_MALFORMED_REQUEST', 'unexpected_key');
  await expectReject(OW, 'soft-deleted machine rejected', U.A, Object.assign(req('fx_length', 1, 'in', 'user_entered'), { machine_id: M.MD }), 'VW_MACHINE_NOT_FOUND');
  await expectReject(OW, 'active machine in a soft-deleted garage rejected', U.A, Object.assign(req('fx_length', 1, 'in', 'user_entered'), { machine_id: M.MG }), 'VW_MACHINE_NOT_FOUND');
  await expectReject(OW, 'nonexistent machine rejected', U.A, Object.assign(req('fx_length', 1, 'in', 'user_entered'), { machine_id: M.MX }), 'VW_MACHINE_NOT_FOUND');
  await expectReject(OW, 'an owner context that is not an account rejected', U.X, req('fx_length', 1, 'in', 'user_entered'), 'VW_MACHINE_NOT_FOUND');
  await expectReject(OW, 'B cannot write to A\u2019s machine even with a valid login', U.B, Object.assign(req('fx_length', 1, 'in', 'user_entered'), { machine_id: M.MA }), 'VW_MACHINE_NOT_FOUND');
  await expectCreated(OW, 'B writes to its own machine; owner is B', U.B, Object.assign(req('fx_length', 2, 'in', 'user_entered'), { machine_id: M.MB }), (v, row) => row.owner_id === U.B);
  { const o = await guard(service.current({ owner_id: U.A }, { machine_id: M.MD, canonical_field: 'fx_length' })); rec(OW, 'current-value read of a soft-deleted machine rejected', o.outcome === 'rejected' && o.code === 'VW_MACHINE_NOT_FOUND', fmt(o)); }
  { const o = await guard(service.current({ owner_id: U.B }, { machine_id: M.MA, canonical_field: 'fx_length' })); rec(OW, 'current-value read of another owner\u2019s machine rejected', o.outcome === 'rejected' && o.code === 'VW_MACHINE_NOT_FOUND', fmt(o)); }
  for (const [what, sql] of [['machine', `UPDATE public.machines SET deleted_at = now() WHERE id = '${M.MA}'`], ['garage', `UPDATE public.garages SET deleted_at = now() WHERE id = '${G.GA}'`]]) {
    const repo = mk(svc1); let active = null, blocked = null;
    await repo.begin(); active = await repo.activeMachine(U.A, M.MA);
    const other = await connect(dbName);
    try { await other.query("SET lock_timeout = '300ms'"); await other.query(sql); blocked = false; }
    catch (e) { blocked = e.code === '55P03'; } finally { await other.end(); await repo.rollback(); }
    rec(OW, `FOR SHARE: a concurrent soft delete of the ${what} waits while a write holds the active-machine check`, active === true && blocked === true, `active ${active}, blocked ${blocked}`);
  }
  await expectReject(OW, 'field contract checked against the database: storage unit mismatch rejected before insert', U.A, req('fx_mismatch', 1, 'in', 'user_entered'), 'VW_CONTRACT_MISMATCH');
  await expectReject(OW, 'a canonical field present in the database but not admitted is rejected', U.A, req('fx_not_admitted', 1, 'in', 'user_entered'), 'VW_FIELD_NOT_ADMITTED');
  { const bad = []; for (const [name, list] of [['unknown storage unit', [{ key: 'x', storage_unit: 'lb' }]], ['duplicate key', [{ key: 'x', storage_unit: 'in' }, { key: 'x', storage_unit: 'in' }]],
    ['bad key', [{ key: 'X-1', storage_unit: 'in' }]], ['extra property', [{ key: 'x', storage_unit: 'in', unit: 'mm' }]]]) {
    try { createFieldContracts(list); bad.push(name); } catch (e) { if (e.code !== 'VW_CONFIGURATION') bad.push(name); } }
    rec(OW, 'invalid field-contract configuration refuses to start (VW_CONFIGURATION)', bad.length === 0, bad.join(',') || '4/4 refused'); }

  await adm.end(); await svc1.end(); await svc2.end();

  // ============ COMBINED (DATA-FOUNDATION-1.0.0 + GARAGE-FOUNDATION-1.0.0 + 0201) ============
  const CO = 'combined';
  { const c = await scratchDb('combined', 'dv_pristine');
    for (const x of S.gfFrozen) await c.query(x.tag);
    const fpGf = await fingerprint(c);
    const r = await applySql(c, mig);
    const d = diff(fpGf, await fingerprint(c));
    rec(CO, '0201 applies on top of DATA-FOUNDATION-1.0.0 + GARAGE-FOUNDATION-1.0.0 with exactly the same two catalog changes',
      r.ok && d.onlyA.length === 2 && d.onlyB.length === 1, r.ok ? `removed ${d.onlyA.length}, added ${d.onlyB.length}` : `${r.code} ${r.msg}`);
    await c.query(`INSERT INTO auth.users (id) VALUES ('${U.A}')`);
    await c.query(`INSERT INTO public.garages (id, owner_id, name) VALUES ('${G.GA}','${U.A}','A garage')`);
    await c.query(`INSERT INTO public.machines (id, owner_id, garage_id, name, machine_type) VALUES ('${M.MA}','${U.A}','${G.GA}','A active','automotive')`);
    await c.query(`INSERT INTO public.canonical_fields (key, family, dimension, canonical_unit, value_kind, description) VALUES ('fx_length','fixture',NULL,'in','numeric','TEST FIXTURE ONLY')`);
    const role = async (sql, p) => { await c.query('BEGIN'); try { await c.query('SET LOCAL ROLE authenticated'); await c.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U.A, role: 'authenticated' })]);
      const x = await c.query(sql, p); return { ok: true, n: x.rowCount }; } catch (e) { return { ok: false, code: e.code, msg: e.message.split('\n')[0] }; } finally { await c.query('ROLLBACK'); } };
    const g = await role(`INSERT INTO public.test_setups (machine_id, name) VALUES ('${M.MA}','Track day')`);
    rec(CO, 'GARAGE-FOUNDATION unaffected: the owner still creates a Test Setup through its own client grant', g.ok && g.n === 1, fmtR(g));
    const vi = await role(`INSERT INTO public.value_records (machine_id, canonical_field, numeric_value, unit, provenance, context) VALUES ('${M.MA}','fx_length',1,'in','user_entered','specification')`);
    rec(CO, 'combined database: authenticated value INSERT rejected (42501)', !vi.ok && vi.code === DENIED, fmtR(vi));
    const k1 = await connect(`${dbName}_combined`), k2 = await connect(`${dbName}_combined`);
    const cs = S.cf.createCalculationService({ sources: S.cf.sources, repository: S.cf.createRepository(k1) });
    const co = await guard(cs.calculate({ owner_id: U.A }, { calculator_id: 'hp_from_torque', inputs: {}, request_id: rid(9001), machine_id: M.MA }));
    rec(CO, 'CALCULATION-FOUNDATION unaffected: the frozen calculation service (from its tag) persists through the service role', co.outcome === 'created', co.outcome === 'created' ? `created ${co.record.result_state}` : fmt(co));
    const vs = createValueWriteService({ repository: mk(k2), contracts: createFieldContracts([{ key: 'fx_length', storage_unit: 'in' }]), components });
    const vo = await guard(vs.write({ owner_id: U.A }, req('fx_length', 25.4, 'mm', 'measured')));
    rec(CO, 'combined database: the trusted value path writes (25.4 mm -> 1 in)', vo.outcome === 'created' && vo.value.numeric_value === 1, fmt(vo));
    await k1.end(); await k2.end(); await c.end(); }

  // ============ RECONCILIATION (the 29 DATA-FOUNDATION-1.0.0 direct-insert tests, CSV) ============
  const RC = 'reconciliation', perLine = [];
  for (const n of S.recon) {
    const tagged = results.filter(r => r.name.startsWith(`[df:${n} `));
    const sLevel = tagged.filter(r => r.name.startsWith(`[df:${n} S]`) || r.name.startsWith(`[df:${n}] SECURITY`));
    const tLevel = tagged.filter(r => r.name.startsWith(`[df:${n} T]`));
    perLine.push({ line: n, s: sLevel.length, t: tLevel.length, ok: sLevel.length > 0 && tLevel.length > 0 && tagged.every(r => r.ok) });
  }
  const done = perLine.filter(x => x.ok).length;
  rec(RC, 'all 29 reconciled lines re-proven at both levels (S = database rule or security test, T = trusted path), every check passing',
    done === 29, `${done}/29 lines; S checks ${perLine.reduce((a, x) => a + x.s, 0)}, T checks ${perLine.reduce((a, x) => a + x.t, 0)}`);
  rec(RC, 'line 198 is the new security test: the historical OK is now a 42501 rejection',
    results.some(r => r.name.startsWith('[df:198] SECURITY') && r.ok), 'security');

  for (const n of [...scratch, dbName]) await dropDb(n);
  return { results };
}

(async () => {
  const S = await setup();
  const main = await runSuite(S, 'dv_main', null);
  const groups = [...new Set(main.results.map(r => r.group))];
  console.log('='.repeat(72)); console.log('GEARHEAD LABS - DATA-FOUNDATION 1.1.0 - VALUE-WRITE BOUNDARY SUITE'); console.log('='.repeat(72));
  console.log('  base: shim + DATA-FOUNDATION 0001-0005 read from the DATA-FOUNDATION-1.0.0 tag; amendment: 0201');
  console.log('  trusted path: service-role application code (no SECURITY DEFINER); active-machine rule from CALCULATION-FOUNDATION-1.0.0');
  let fails = 0;
  for (const g of groups) { const rs = main.results.filter(r => r.group === g), f = rs.filter(r => !r.ok); fails += f.length;
    console.log(`[${f.length ? 'FAIL' : 'PASS'}] ${g.toUpperCase().padEnd(16)} ${rs.length - f.length} passed, ${f.length} failed`);
    f.forEach(x => console.log(`    x ${x.name}\n        ${x.detail}`)); }
  const rc = main.results.find(r => r.group === 'reconciliation');
  console.log(`[INFO] RECONCILIATION ${rc ? rc.detail : 'missing'}`);
  console.log(`\nTOTAL ${main.results.length} checks, ${main.results.length - fails} passed, ${fails} failed`);

  const neg = [];
  for (let i = 0; i < (process.env.DV_MAIN_ONLY ? 0 : MUTANTS.length); i++) {   // DV_MAIN_ONLY: development only, never for evidence
    const [name, build] = MUTANTS[i];
    let r = null, err = '', invalid = '';
    let spec; try { spec = build(S); if (spec.migration) spec.migration(S.mig); if (spec.rollback) spec.rollback(S.rb); } catch (e) { invalid = e.message.split('\n')[0]; }
    if (!invalid) { try { r = await runSuite(S, `dv_mutant_${i}`, spec); } catch (e) { err = e.message.split('\n')[0]; } }
    const failed = r ? r.results.filter(x => !x.ok) : [];
    neg.push({ mutation: name, valid: !invalid, detected: !invalid && (!!err || failed.length > 0), failed_checks: failed.map(x => x.name), error: err || invalid });
  }
  const undetected = neg.filter(n => !n.detected);
  console.log(`\n[${undetected.length ? 'FAIL' : 'PASS'}] NEGATIVE_CONTROLS ${neg.length - undetected.length}/${neg.length} mutants detected`);
  neg.forEach(n => console.log(`    ${n.detected ? '+' : 'x'} ${n.mutation}: ${!n.valid ? 'MUTANT NOT APPLIED (' + n.error + ')' : n.error ? 'suite error' : n.failed_checks.length + ' check(s) failed'}`));

  fs.writeFileSync(path.join(HERE, 'evidence', 'test-results.json'), JSON.stringify({ checks: main.results, negative_controls: neg }, null, 1) + '\n');
  for (const n of ['dv_base', 'dv_pristine']) await dropDb(n);
  const pass = fails === 0 && undetected.length === 0;
  console.log(pass ? '\nDATA-FOUNDATION-1.1.0 SUITE: PASS' : '\nDATA-FOUNDATION-1.1.0 SUITE: FAIL');
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('SUITE ERROR:', e.stack || e); process.exit(2); });
