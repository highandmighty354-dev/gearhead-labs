#!/usr/bin/env node
/* DATA-FOUNDATION 1.0.0 - deterministic database suite (spec J).
 * Fresh database -> shim -> migrations 0001-0005 -> idempotency -> fixtures -> checks.
 * Every check runs in its own transaction and is ROLLED BACK. Fixed UUIDs; timestamps compared
 * with the transaction's own now(); no wall-clock assertions. */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { Client } = require('pg');
const HERE = path.resolve(__dirname, '..');
const cfg = { host: process.env.DF_PGHOST, port: +process.env.DF_PGPORT, user: 'postgres' };
const MIG = ['0001_enums.sql', '0002_tables.sql', '0003_constraints_triggers.sql', '0004_rls.sql', '0005_reference_seed.sql']
  .map(f => path.join(HERE, 'supabase', 'migrations', f));

const U = { A: 'aaaaaaaa-0000-4000-8000-000000000001', B: 'bbbbbbbb-0000-4000-8000-000000000002', C: 'cccccccc-0000-4000-8000-000000000003' };
const ID = { GA: '10000000-0000-4000-8000-00000000000a', GB: '10000000-0000-4000-8000-00000000000b',
  MA: '20000000-0000-4000-8000-0000000000a1', MA2: '20000000-0000-4000-8000-0000000000a2', MB: '20000000-0000-4000-8000-0000000000b1',
  CA1: '30000000-0000-4000-8000-0000000000a1', CA2: '30000000-0000-4000-8000-0000000000a2', CA3: '30000000-0000-4000-8000-0000000000a3', CB1: '30000000-0000-4000-8000-0000000000b1',
  CRA: '40000000-0000-4000-8000-0000000000a1', CRB: '40000000-0000-4000-8000-0000000000b1',
  VA1: '50000000-0000-4000-8000-0000000000a1', VB1: '50000000-0000-4000-8000-0000000000b1', CONA: '60000000-0000-4000-8000-0000000000a1',
  RQ1: '70000000-0000-4000-8000-000000000001', RQ2: '70000000-0000-4000-8000-000000000002', RQ3: '70000000-0000-4000-8000-000000000003',
  N1: '90000000-0000-4000-8000-000000000001', N2: '90000000-0000-4000-8000-000000000002', N3: '90000000-0000-4000-8000-000000000003' };

const results = []; let db;
const rec = (group, name, ok, detail) => results.push({ group, name, ok: !!ok, detail: detail || '' });

/* run SQL in a rolled-back transaction as a given role/user. who: 'owner:A' | 'user:B' | 'anon' | 'service' | 'super' */
async function tx(who, fn) {
  await db.query('BEGIN');
  try {
    const [kind, u] = who.split(':');
    const role = { owner: 'authenticated', user: 'authenticated', anon: 'anon', service: 'service_role', super: null }[kind];
    if (role) await db.query(`SET LOCAL ROLE ${role}`);
    await db.query("SELECT set_config('request.jwt.claims', $1, true)", [u ? JSON.stringify({ sub: U[u], role }) : '']);
    return await fn(async (sql, p) => (await db.query(sql, p)));
  } finally { await db.query('ROLLBACK'); }
}
async function attempt(who, sql, p) { try { return await tx(who, async q => { const r = await q(sql, p); return { ok: true, rows: r.rows, n: r.rowCount }; }); }
  catch (e) { return { ok: false, code: e.code, msg: e.message.split('\n')[0] }; } }
async function expectOk(g, name, who, sql, p, check) { const r = await attempt(who, sql, p); const ok = r.ok && (!check || check(r)); rec(g, name, ok, r.ok ? (ok ? `rows ${r.n}` : `unexpected result ${JSON.stringify(r.rows).slice(0, 120)}`) : `${r.code} ${r.msg}`); }
async function expectErr(g, name, who, sql, p, codes, re) { const r = await attempt(who, sql, p); const cs = [].concat(codes);
  const ok = !r.ok && cs.includes(r.code) && (!re || re.test(r.msg)); rec(g, name, ok, r.ok ? `UNEXPECTEDLY SUCCEEDED (rows ${r.n})` : `${r.code} ${r.msg}`); }
async function expectRows(g, name, who, sql, p, n) { const r = await attempt(who, sql, p); rec(g, name, r.ok && r.rows.length === n, r.ok ? `got ${r.rows.length} row(s), expected ${n}` : `${r.code} ${r.msg}`); }
const DENIED = '42501';   // insufficient_privilege: missing GRANT or RLS WITH CHECK violation

(async () => {
  const admin = new Client({ ...cfg, database: 'postgres' }); await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS df_test'); await admin.query('CREATE DATABASE df_test'); await admin.end();
  db = new Client({ ...cfg, database: 'df_test' }); await db.connect();
  const applyAll = async () => { for (const f of MIG) await db.query(fs.readFileSync(f, 'utf8')); };
  /* pg_dump (16.10+) emits \restrict / \unrestrict lines carrying a NEW RANDOM security token on every
   * run; they are the only non-schema content and are stripped so identical schemas compare equal. */
  const dump = () => execFileSync(path.join(process.env.DF_PG_BIN, 'pg_dump'), ['-h', cfg.host, '-p', String(cfg.port), '-U', 'postgres', '-s', 'df_test']).toString()
    .split('\n').filter(l => !/^\\(un)?restrict /.test(l)).join('\n');
  await db.query(fs.readFileSync(path.join(HERE, 'tests', 'sql', '000_supabase_shim.sql'), 'utf8'));

  // ---------------- SCHEMA ----------------
  await applyAll();
  const d1 = dump(); const c1 = (await db.query('SELECT (SELECT count(*) FROM calculators) c, (SELECT count(*) FROM formula_versions) f')).rows[0];
  await applyAll();
  const d2 = dump(); const c2 = (await db.query('SELECT (SELECT count(*) FROM calculators) c, (SELECT count(*) FROM formula_versions) f')).rows[0];
  rec('schema', 'migrations apply cleanly from an empty database', true, '0001-0005');
  rec('schema', 're-applying all migrations is a no-op (schema dump byte-identical, seed unchanged)', d1 === d2 && JSON.stringify(c1) === JSON.stringify(c2), `dump ${d1.length} bytes; rows ${JSON.stringify(c2)}`);
  fs.writeFileSync(path.join(HERE, 'evidence', 'schema-dump.sql'), d1.replace(/^-- Dumped (from|by) .*$/gm, '-- Dumped $1 (version line removed for determinism)'));

  const TABLES = ['accounts', 'garages', 'machines', 'components', 'component_connections', 'canonical_fields', 'value_records', 'calculators', 'formula_versions', 'calculation_records'];
  const rls = (await db.query(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY relname`)).rows;
  rec('schema', 'exactly the 10 specified tables exist', JSON.stringify(rls.map(r => r.relname).sort()) === JSON.stringify([...TABLES].sort()), rls.map(r => r.relname).join(','));
  rec('schema', 'RLS enabled AND forced on all 10 tables', rls.every(r => r.relrowsecurity && r.relforcerowsecurity), rls.filter(r => !(r.relrowsecurity && r.relforcerowsecurity)).map(r => r.relname).join(',') || 'all');

  /* expected columns: [name, udt_name, nullable] - written from spec section B */
  const COLS = {
    accounts: [['id', 'uuid', 0], ['created_at', 'timestamptz', 0], ['deleted_at', 'timestamptz', 1]],
    garages: [['id', 'uuid', 0], ['owner_id', 'uuid', 0], ['name', 'text', 1], ['created_at', 'timestamptz', 0], ['updated_at', 'timestamptz', 0], ['deleted_at', 'timestamptz', 1]],
    machines: [['id', 'uuid', 0], ['owner_id', 'uuid', 0], ['garage_id', 'uuid', 0], ['name', 'text', 0], ['machine_type', 'machine_type_enum', 0], ['marine_type', 'marine_type_enum', 1],
      ['propulsion', 'propulsion_enum', 1], ['power_source', 'power_source_enum', 1], ['is_hypothetical', 'bool', 0], ['created_at', 'timestamptz', 0], ['updated_at', 'timestamptz', 0], ['deleted_at', 'timestamptz', 1]],
    components: [['id', 'uuid', 0], ['owner_id', 'uuid', 0], ['machine_id', 'uuid', 0], ['kind', 'component_kind_enum', 0], ['parent_component_id', 'uuid', 1], ['manufacturer', 'text', 1],
      ['model', 'text', 1], ['part_number', 'text', 1], ['label', 'text', 1], ['created_at', 'timestamptz', 0], ['updated_at', 'timestamptz', 0], ['deleted_at', 'timestamptz', 1]],
    component_connections: [['id', 'uuid', 0], ['owner_id', 'uuid', 0], ['machine_id', 'uuid', 0], ['from_component_id', 'uuid', 0], ['to_component_id', 'uuid', 0], ['relation', 'text', 0],
      ['created_at', 'timestamptz', 0], ['deleted_at', 'timestamptz', 1]],
    canonical_fields: [['key', 'text', 0], ['family', 'text', 0], ['dimension', 'text', 1], ['canonical_unit', 'text', 0], ['value_kind', 'text', 0], ['description', 'text', 1]],
    value_records: [['id', 'uuid', 0], ['owner_id', 'uuid', 0], ['machine_id', 'uuid', 0], ['component_id', 'uuid', 1], ['canonical_field', 'text', 0], ['numeric_value', 'float8', 1],
      ['option_value', 'text', 1], ['unit', 'text', 0], ['provenance', 'provenance_enum', 0], ['context', 'value_context_enum', 0], ['source', 'text', 1], ['calculation_id', 'uuid', 1],
      ['supersedes_id', 'uuid', 1], ['recorded_at', 'timestamptz', 0]],
    calculators: [['calculator_id', 'text', 0], ['canonical_id', 'text', 0], ['engine_proven', 'bool', 0]],
    formula_versions: [['calculator_id', 'text', 0], ['formula_version', 'text', 0], ['engine_version', 'text', 0], ['formula_registry', 'text', 0], ['first_release', 'text', 0]],
    calculation_records: [['id', 'uuid', 0], ['owner_id', 'uuid', 0], ['machine_id', 'uuid', 1], ['calculator_id', 'text', 0], ['canonical_id', 'text', 0], ['engine_version', 'text', 0],
      ['formula_registry', 'text', 0], ['formula_version', 'text', 0], ['result_state', 'result_state_enum', 0], ['inputs', 'jsonb', 0], ['missing', '_text', 0], ['warnings', '_text', 0],
      ['outputs', 'jsonb', 0], ['input_value_ids', '_uuid', 1], ['request_id', 'uuid', 0], ['created_at', 'timestamptz', 0]] };
  for (const t of TABLES) {
    const got = (await db.query(`SELECT column_name, udt_name, (is_nullable='YES')::int nul FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t])).rows.map(r => [r.column_name, r.udt_name, r.nul]);
    rec('schema', `columns, types and nullability: ${t}`, JSON.stringify(got) === JSON.stringify(COLS[t]), JSON.stringify(got) === JSON.stringify(COLS[t]) ? `${got.length} columns` : 'got ' + JSON.stringify(got).slice(0, 200));
  }
  const ENUMS = { machine_type_enum: 'automotive,motorcycle,atv_three_wheeler,side_by_side_utv,snowmobile,marine,go_kart,other_custom',
    marine_type_enum: 'power_boat,pwc,sailboat,auxiliary_sailboat,other', propulsion_enum: 'outboard,inboard,v_drive,sterndrive_io,forward_drive,pod,jet,surface_drive,saildrive,electric,custom',
    power_source_enum: 'gasoline,diesel,electric,hybrid,other', component_kind_enum: 'engine,transmission,transfer_case,differential_final_drive,axle,wheel_tire,other_custom',
    provenance_enum: 'calculated,measured,manufacturer_specified,user_entered,derived,empirical,estimated,unknown', value_context_enum: 'specification,operating_state',
    result_state_enum: 'valid,valid_with_warning,estimated,incomplete,out_of_range,non_convergent,not_applicable' };
  for (const [e, vals] of Object.entries(ENUMS)) {
    const got = (await db.query(`SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) v FROM pg_enum WHERE enumtypid = $1::regtype`, ['public.' + e])).rows[0].v;
    rec('schema', `enum ${e}`, got === vals, got);
  }
  const FKS = ['machines_garage_same_owner_fk', 'components_machine_same_owner_fk', 'components_parent_same_machine_fk', 'connections_machine_same_owner_fk', 'connections_from_same_machine_fk',
    'connections_to_same_machine_fk', 'values_machine_same_owner_fk', 'values_component_same_machine_fk', 'values_calculation_same_owner_fk', 'values_supersedes_same_owner_fk',
    'calc_formula_version_fk', 'calc_machine_same_owner_fk'];
  const fkRows = (await db.query(`SELECT conname, array_length(conkey,1) n FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace`)).rows;
  rec('schema', 'all 12 composite ownership / same-machine / formula-version foreign keys present (2 columns each)', FKS.every(n => fkRows.find(r => r.conname === n && r.n === 2)), FKS.filter(n => !fkRows.find(r => r.conname === n && r.n === 2)).join(',') || '12/12');
  const IDX = ['garages_one_active_per_owner', 'values_superseded_once', 'values_machine_field_ctx_idx', 'calc_owner_created_idx', 'calc_machine_created_idx', 'calc_calculator_idx',
    'calc_request_idempotent', 'connections_unique', 'machines_owner_idx', 'components_machine_idx'];
  const idxRows = (await db.query(`SELECT indexname FROM pg_indexes WHERE schemaname='public'`)).rows.map(r => r.indexname);
  rec('schema', 'specified indexes and unique constraints present', IDX.every(i => idxRows.includes(i)), IDX.filter(i => !idxRows.includes(i)).join(',') || `${IDX.length}/${IDX.length}`);
  const cat = JSON.parse(fs.readFileSync(path.join(HERE, 'evidence', 'engine-catalog.json'), 'utf8'));
  const dbCalc = (await db.query('SELECT calculator_id, canonical_id, engine_proven FROM calculators ORDER BY calculator_id')).rows;
  const dbFv = (await db.query('SELECT calculator_id, formula_version, engine_version, formula_registry, first_release FROM formula_versions ORDER BY calculator_id')).rows;
  rec('schema', 'reference seed = engine catalog: 583 calculators (577 + 6 aliases), 577 formula versions, 252 engine-proven',
    dbCalc.length === 583 && dbFv.length === 577 && dbCalc.filter(r => r.engine_proven).length === 252 &&
    JSON.stringify(dbCalc) === JSON.stringify(cat.calculators.map(c => ({ calculator_id: c.calculator_id, canonical_id: c.canonical_id, engine_proven: c.engine_proven }))) &&
    JSON.stringify(dbFv) === JSON.stringify([...cat.formula_versions].sort((a, b) => a.calculator_id < b.calculator_id ? -1 : 1)), `${dbCalc.length} / ${dbFv.length} / ${dbCalc.filter(r => r.engine_proven).length}`);
  rec('schema', 'canonical_fields not seeded (seed scope OPEN #16)', (await db.query('SELECT count(*)::int n FROM canonical_fields')).rows[0].n === 0, 'empty');

  // ---------------- FIXTURES (committed, superuser) ----------------
  await db.query(`INSERT INTO auth.users (id) VALUES ($1),($2),($3)`, [U.A, U.B, U.C]);
  const acc = (await db.query('SELECT count(*)::int n FROM accounts')).rows[0].n;
  rec('ownership', 'sign-up creates the Account row server-side (auth.users trigger)', acc === 3, `${acc} accounts`);
  await db.query(`INSERT INTO canonical_fields (key, family, dimension, canonical_unit, value_kind, description) VALUES
    ('test_weight','chassis_weight','mass','lb','numeric','TEST FIXTURE ONLY'),('test_bore','engine','length','in','numeric','TEST FIXTURE ONLY'),
    ('test_transmission','transmission',NULL,'-','categorical','TEST FIXTURE ONLY')`);
  await db.query(`INSERT INTO garages (id, owner_id) VALUES ($1,$2),($3,$4)`, [ID.GA, U.A, ID.GB, U.B]);
  await db.query(`INSERT INTO machines (id, owner_id, garage_id, name, machine_type) VALUES ($1,$2,$3,'A car','automotive'),($4,$2,$3,'A boat','marine'),($5,$6,$7,'B car','automotive')`,
    [ID.MA, U.A, ID.GA, ID.MA2, ID.MB, U.B, ID.GB]);
  await db.query(`INSERT INTO components (id, owner_id, machine_id, kind) VALUES ($1,$2,$3,'engine'),($4,$2,$3,'transmission'),($5,$2,$6,'engine'),($7,$8,$9,'engine')`,
    [ID.CA1, U.A, ID.MA, ID.CA2, ID.CA3, ID.MA2, ID.CB1, U.B, ID.MB]);
  await db.query(`INSERT INTO component_connections (id, owner_id, machine_id, from_component_id, to_component_id, relation) VALUES ($1,$2,$3,$4,$5,'drives')`, [ID.CONA, U.A, ID.MA, ID.CA1, ID.CA2]);
  const fvTow = (await db.query(`SELECT formula_version, formula_registry FROM formula_versions WHERE calculator_id='tow_tongue_percent'`)).rows[0];
  const calcIns = `INSERT INTO calculation_records (id, owner_id, machine_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
                   VALUES ($1,$2,$3,'tow_tongue_percent','tow_tongue_percent','1.1.0',$4,$5,'valid','{"t":870,"w":8700}','[{"key":"tongue_weight","value":10}]',$6)`;
  await db.query(calcIns, [ID.CRA, U.A, ID.MA, fvTow.formula_registry, fvTow.formula_version, ID.RQ1]);
  await db.query(calcIns, [ID.CRB, U.B, ID.MB, fvTow.formula_registry, fvTow.formula_version, ID.RQ1]);
  await db.query(`INSERT INTO value_records (id, owner_id, machine_id, canonical_field, numeric_value, unit, provenance, context) VALUES ($1,$2,$3,'test_weight',3420,'lb','user_entered','specification'),($4,$5,$6,'test_weight',3500,'lb','user_entered','specification')`,
    [ID.VA1, U.A, ID.MA, ID.VB1, U.B, ID.MB]);

  const vIns = (f, v, o, unit, prov, extra = '') => `INSERT INTO value_records (machine_id, canonical_field, numeric_value, option_value, unit, provenance, context${extra ? ', ' + extra.split('=')[0] : ''})
      VALUES ('${ID.MA}','${f}',${v === null ? 'NULL' : v},${o === null ? 'NULL' : `'${o}'`},'${unit}','${prov}','specification'${extra ? ", '" + extra.split('=')[1] + "'" : ''}) RETURNING id, owner_id, numeric_value, provenance`;

  // ---------------- REQUIRED FIELDS / INVALID DATA ----------------
  await expectErr('invalid', 'machine without name rejected', 'owner:A', `INSERT INTO machines (garage_id, machine_type) VALUES ('${ID.GA}','automotive')`, [], '23502');
  await expectErr('invalid', 'machine with blank name rejected', 'owner:A', `INSERT INTO machines (garage_id, name, machine_type) VALUES ('${ID.GA}','  ','automotive')`, [], '23514');
  await expectErr('invalid', 'invalid machine_type rejected', 'owner:A', `INSERT INTO machines (garage_id, name, machine_type) VALUES ('${ID.GA}','x','car')`, [], '22P02');
  await expectErr('invalid', 'marine_type on a non-marine machine rejected', 'owner:A', `INSERT INTO machines (garage_id, name, machine_type, marine_type) VALUES ('${ID.GA}','x','automotive','sailboat')`, [], '23514');
  await expectOk('invalid', 'marine_type on a marine machine accepted; propulsion and power source independent', 'owner:A', `INSERT INTO machines (garage_id, name, machine_type, marine_type, propulsion, power_source) VALUES ('${ID.GA}','x','marine','sailboat','saildrive','diesel')`);
  await expectOk('invalid', 'hypothetical machine accepted', 'owner:A', `INSERT INTO machines (garage_id, name, machine_type, is_hypothetical) VALUES ('${ID.GA}','Dream build','automotive',true) RETURNING is_hypothetical`, [], r => r.rows[0].is_hypothetical === true);
  await expectErr('invalid', 'component as its own parent rejected', 'super', `UPDATE components SET parent_component_id = id WHERE id='${ID.CA1}'`, [], '23514');
  await expectErr('invalid', 'self-connection rejected', 'owner:A', `INSERT INTO component_connections (machine_id, from_component_id, to_component_id, relation) VALUES ('${ID.MA}','${ID.CA1}','${ID.CA1}','drives')`, [], '23514');
  await expectErr('invalid', 'duplicate connection rejected', 'owner:A', `INSERT INTO component_connections (machine_id, from_component_id, to_component_id, relation) VALUES ('${ID.MA}','${ID.CA1}','${ID.CA2}','drives')`, [], '23505');
  await expectErr('invalid', 'second active garage for the same account rejected', 'owner:A', `INSERT INTO garages DEFAULT VALUES`, [], '23505');
  await expectErr('invalid', 'malformed formula_version rejected', 'super', `INSERT INTO formula_versions VALUES ('tow_tongue_percent','v1-zzz','1.1.0','X','F1.12.3')`, [], '23514');
  await expectErr('invalid', 'categorical field with an empty option rejected', 'owner:A', vIns('test_transmission', null, '', '-', 'user_entered'), [], '23514');

  // ---------------- FOREIGN KEYS (RLS bypassed: superuser) ----------------
  await expectErr('foreign-key', 'orphan machine (no such garage) rejected', 'super', `INSERT INTO machines (owner_id, garage_id, name, machine_type) VALUES ('${U.A}','${ID.N1}','x','automotive')`, [], '23503');
  await expectErr('foreign-key', 'A machine in B garage rejected by composite FK', 'super', `INSERT INTO machines (owner_id, garage_id, name, machine_type) VALUES ('${U.A}','${ID.GB}','x','automotive')`, [], '23503');
  await expectErr('foreign-key', 'A component on B machine rejected by composite FK', 'super', `INSERT INTO components (owner_id, machine_id, kind) VALUES ('${U.A}','${ID.MB}','engine')`, [], '23503');
  await expectErr('foreign-key', 'component parent on another machine rejected', 'super', `INSERT INTO components (owner_id, machine_id, kind, parent_component_id) VALUES ('${U.A}','${ID.MA}','axle','${ID.CA3}')`, [], '23503');
  await expectErr('foreign-key', 'connection across machines rejected', 'super', `INSERT INTO component_connections (owner_id, machine_id, from_component_id, to_component_id, relation) VALUES ('${U.A}','${ID.MA}','${ID.CA1}','${ID.CA3}','drives')`, [], '23503');
  await expectErr('foreign-key', 'A value on B machine rejected by composite FK', 'super', `INSERT INTO value_records (owner_id, machine_id, canonical_field, numeric_value, unit, provenance, context) VALUES ('${U.A}','${ID.MB}','test_weight',1,'lb','user_entered','specification')`, [], '23503');
  await expectErr('foreign-key', 'value component from another machine rejected', 'super', `INSERT INTO value_records (owner_id, machine_id, component_id, canonical_field, numeric_value, unit, provenance, context) VALUES ('${U.A}','${ID.MA}','${ID.CA3}','test_bore',4,'in','user_entered','specification')`, [], '23503');
  await expectErr('foreign-key', 'A value citing B calculation rejected by composite FK', 'super', `INSERT INTO value_records (owner_id, machine_id, canonical_field, numeric_value, unit, provenance, context, calculation_id) VALUES ('${U.A}','${ID.MA}','test_weight',1,'lb','calculated','specification','${ID.CRB}')`, [], '23503');
  await expectErr('foreign-key', 'A calculation on B machine rejected by composite FK', 'super',
    `INSERT INTO calculation_records (owner_id, machine_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
     VALUES ('${U.A}','${ID.MB}','tow_tongue_percent','tow_tongue_percent','1.1.0','${fvTow.formula_registry}','${fvTow.formula_version}','valid','{}','[]','${ID.RQ2}')`, [], '23503');
  await expectErr('foreign-key', 'value with an unknown canonical field rejected', 'owner:A', vIns('no_such_field', 1, null, 'lb', 'user_entered'), [], '23503');

  // ---------------- OWNERSHIP / RLS MATRIX ----------------
  const G = 'rls';
  // accounts
  await expectRows(G, 'accounts: owner sees own row', 'owner:A', 'SELECT * FROM accounts', [], 1);
  await expectRows(G, 'accounts: other user cannot see A', 'user:B', `SELECT * FROM accounts WHERE id='${U.A}'`, [], 0);
  await expectErr(G, 'accounts: anon denied', 'anon', 'SELECT * FROM accounts', [], DENIED);
  await expectErr(G, 'accounts: client INSERT denied', 'owner:C', `INSERT INTO accounts (id) VALUES ('${U.C}')`, [], DENIED);
  await expectErr(G, 'accounts: client UPDATE denied', 'owner:A', `UPDATE accounts SET deleted_at = now()`, [], DENIED);
  await expectErr(G, 'accounts: client DELETE denied', 'owner:A', `DELETE FROM accounts`, [], DENIED);
  // user-owned tables: select / cross-user / anon / delete
  for (const [t, ownId] of [['garages', ID.GA], ['machines', ID.MA], ['components', ID.CA1], ['component_connections', ID.CONA], ['value_records', ID.VA1], ['calculation_records', ID.CRA]]) {
    await expectRows(G, `${t}: owner sees own row`, 'owner:A', `SELECT id FROM ${t} WHERE id='${ownId}'`, [], 1);
    await expectRows(G, `${t}: other user cannot see A row`, 'user:B', `SELECT id FROM ${t} WHERE id='${ownId}'`, [], 0);
    await expectRows(G, `${t}: other user sees only own rows`, 'user:B', `SELECT id FROM ${t} WHERE owner_id <> '${U.B}'`, [], 0);
    await expectErr(G, `${t}: anon denied`, 'anon', `SELECT id FROM ${t}`, [], DENIED);
    await expectErr(G, `${t}: client DELETE denied (owner)`, 'owner:A', `DELETE FROM ${t} WHERE id='${ownId}'`, [], DENIED);
  }
  // inserts: default owner, spoofed owner, cross-user parent
  await expectOk(G, 'garages: new account creates its garage; owner_id comes from auth.uid()', 'owner:C', `INSERT INTO garages (name) VALUES ('C garage') RETURNING owner_id`, [], r => r.rows[0].owner_id === U.C);
  await expectErr(G, 'garages: spoofed owner_id rejected', 'owner:C', `INSERT INTO garages (owner_id) VALUES ('${U.A}')`, [], DENIED);
  await expectOk(G, 'machines: owner inserts into own garage', 'owner:A', `INSERT INTO machines (garage_id, name, machine_type) VALUES ('${ID.GA}','A2','automotive') RETURNING owner_id`, [], r => r.rows[0].owner_id === U.A);
  await expectErr(G, 'machines: spoofed owner_id rejected', 'user:B', `INSERT INTO machines (owner_id, garage_id, name, machine_type) VALUES ('${U.A}','${ID.GA}','x','automotive')`, [], DENIED);
  await expectErr(G, 'machines: B cannot place a machine in A garage', 'user:B', `INSERT INTO machines (garage_id, name, machine_type) VALUES ('${ID.GA}','x','automotive')`, [], '23503');
  await expectErr(G, 'components: B cannot attach to A machine', 'user:B', `INSERT INTO components (machine_id, kind) VALUES ('${ID.MA}','engine')`, [], '23503');
  await expectErr(G, 'components: spoofed owner_id rejected', 'user:B', `INSERT INTO components (owner_id, machine_id, kind) VALUES ('${U.A}','${ID.MA}','engine')`, [], DENIED);
  await expectErr(G, 'connections: B cannot connect A components', 'user:B', `INSERT INTO component_connections (machine_id, from_component_id, to_component_id, relation) VALUES ('${ID.MA}','${ID.CA2}','${ID.CA1}','x')`, [], '23503');
  await expectOk(G, 'value_records: owner inserts own value; owner from auth.uid()', 'owner:A', vIns('test_weight', 3450, null, 'lb', 'measured', 'source=scale ticket'), [], r => r.rows[0].owner_id === U.A);
  await expectErr(G, 'value_records: spoofed owner_id rejected', 'user:B', `INSERT INTO value_records (owner_id, machine_id, canonical_field, numeric_value, unit, provenance, context) VALUES ('${U.A}','${ID.MA}','test_weight',1,'lb','user_entered','specification')`, [], DENIED);
  await expectErr(G, 'value_records: B cannot add a value to A machine', 'user:B', `INSERT INTO value_records (machine_id, canonical_field, numeric_value, unit, provenance, context) VALUES ('${ID.MA}','test_weight',1,'lb','user_entered','specification')`, [], '23503');
  await expectErr(G, 'calculation_records: client INSERT blocked (no Calculation API yet)', 'owner:A',
    `INSERT INTO calculation_records (machine_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
     VALUES ('${ID.MA}','tow_tongue_percent','tow_tongue_percent','1.1.0','${fvTow.formula_registry}','${fvTow.formula_version}','valid','{}','[]','${ID.RQ3}')`, [], DENIED);
  await expectOk(G, 'calculation_records: controlled service path can insert', 'service',
    `INSERT INTO calculation_records (owner_id, machine_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
     VALUES ('${U.A}','${ID.MA}','tow_tongue_percent','tow_tongue_percent','1.1.0','${fvTow.formula_registry}','${fvTow.formula_version}','valid','{}','[]','${ID.RQ3}')`);
  // updates
  await expectOk(G, 'garages: owner renames own garage', 'owner:A', `UPDATE garages SET name='Shop' WHERE id='${ID.GA}'`, [], r => r.n === 1);
  await expectRows(G, 'garages: other user UPDATE affects 0 rows', 'user:B', `UPDATE garages SET name='hijack' WHERE id='${ID.GA}' RETURNING id`, [], 0);
  await expectErr(G, 'garages: owner_id not updatable by client', 'owner:A', `UPDATE garages SET owner_id='${U.B}' WHERE id='${ID.GA}'`, [], DENIED);
  await expectErr(G, 'garages: created_at not updatable by client', 'owner:A', `UPDATE garages SET created_at='2000-01-01' WHERE id='${ID.GA}'`, [], DENIED);
  await expectOk(G, 'machines: owner updates identity fields', 'owner:A', `UPDATE machines SET name='A car v2', power_source='gasoline' WHERE id='${ID.MA}'`, [], r => r.n === 1);
  await expectErr(G, 'machines: garage_id not updatable by client', 'owner:A', `UPDATE machines SET garage_id='${ID.GA}' WHERE id='${ID.MA}'`, [], DENIED);
  await expectRows(G, 'machines: other user UPDATE affects 0 rows', 'user:B', `UPDATE machines SET name='x' WHERE id='${ID.MA}' RETURNING id`, [], 0);
  await expectErr(G, 'components: machine_id not updatable by client', 'owner:A', `UPDATE components SET machine_id='${ID.MA2}' WHERE id='${ID.CA1}'`, [], DENIED);
  await expectErr(G, 'connections: only deleted_at updatable by client', 'owner:A', `UPDATE component_connections SET relation='x' WHERE id='${ID.CONA}'`, [], DENIED);
  await expectErr(G, 'value_records: no client UPDATE', 'owner:A', `UPDATE value_records SET numeric_value=1 WHERE id='${ID.VA1}'`, [], DENIED);
  await expectErr(G, 'calculation_records: no client UPDATE', 'owner:A', `UPDATE calculation_records SET result_state='incomplete' WHERE id='${ID.CRA}'`, [], DENIED);
  // reference data
  for (const t of ['canonical_fields', 'calculators', 'formula_versions']) {
    await expectOk(G, `${t}: authenticated read`, 'owner:A', `SELECT 1 FROM ${t} LIMIT 1`, [], r => t === 'canonical_fields' || r.n === 1);
    await expectErr(G, `${t}: authenticated write denied`, 'owner:A', `DELETE FROM ${t}`, [], DENIED);
    await expectErr(G, `${t}: anon denied (OPEN #17 not granted)`, 'anon', `SELECT 1 FROM ${t}`, [], DENIED);
  }

  // ---------------- UNKNOWN vs ZERO ----------------
  const Z = 'unknown-vs-zero';
  await expectOk(Z, 'zero is a KNOWN value (0, user_entered)', 'owner:A', vIns('test_weight', 0, null, 'lb', 'user_entered'), [], r => r.rows[0].numeric_value === 0 && r.rows[0].provenance === 'user_entered');
  await expectOk(Z, 'unknown = no value + provenance unknown', 'owner:A', vIns('test_weight', null, null, 'lb', 'unknown'), [], r => r.rows[0].numeric_value === null);
  await expectErr(Z, 'no value with a known provenance rejected', 'owner:A', vIns('test_weight', null, null, 'lb', 'user_entered'), [], '23514');
  await expectErr(Z, 'a number with provenance unknown rejected', 'owner:A', vIns('test_weight', 5, null, 'lb', 'unknown'), [], '23514');
  await expectErr(Z, 'zero with provenance unknown rejected (zero is not unknown)', 'owner:A', vIns('test_weight', 0, null, 'lb', 'unknown'), [], '23514');
  await expectErr(Z, 'both numeric and option rejected', 'owner:A', vIns('test_weight', 5, 'x', 'lb', 'user_entered'), [], '23514');
  await expectErr(Z, 'categorical field given a number rejected', 'owner:A', vIns('test_transmission', 5, null, '-', 'user_entered'), [], '23514', /DF_KIND/);
  await expectErr(Z, 'numeric field given an option rejected', 'owner:A', vIns('test_weight', null, 'heavy', 'lb', 'user_entered'), [], '23514', /DF_KIND/);
  await expectOk(Z, 'categorical field with a declared option accepted', 'owner:A', vIns('test_transmission', null, 'manual', '-', 'user_entered'));
  for (const bad of ["'NaN'", "'Infinity'", "'-Infinity'"]) await expectErr(Z, `non-finite ${bad} rejected as a known value`, 'owner:A', vIns('test_weight', bad + '::float8', null, 'lb', 'user_entered'), [], '23514');

  // ---------------- UNITS ----------------
  await expectErr('units', 'value in a non-canonical unit rejected (kg for an lb field)', 'owner:A', vIns('test_weight', 1551, null, 'kg', 'user_entered'), [], '23514', /DF_UNIT/);
  await expectOk('units', 'value in the canonical engine-native unit accepted', 'owner:A', vIns('test_bore', 4.25, null, 'in', 'manufacturer_specified'));

  // ---------------- PROVENANCE ----------------
  await expectErr('provenance', 'calculated without calculation_id rejected', 'owner:A', vIns('test_weight', 1, null, 'lb', 'calculated'), [], '23514');
  await expectErr('provenance', 'derived without calculation_id rejected', 'owner:A', vIns('test_weight', 1, null, 'lb', 'derived'), [], '23514');
  for (const p of ['calculated', 'derived']) await expectOk('provenance', `${p} linked to its own Calculation accepted`, 'owner:A', vIns('test_weight', 10, null, 'lb', p, `calculation_id=${ID.CRA}`));
  for (const p of ['measured', 'manufacturer_specified', 'user_entered', 'empirical', 'estimated']) await expectOk('provenance', `provenance ${p} accepted`, 'owner:A', vIns('test_weight', 1, null, 'lb', p));
  await expectErr('provenance', "'imported' is not a provenance category", 'owner:A', vIns('test_weight', 1, null, 'lb', 'imported'), [], '22P02');
  await expectOk('provenance', 'import channel recorded in source with original provenance kept', 'owner:A', vIns('test_weight', 3420, null, 'lb', 'manufacturer_specified', 'source=import: spec sheet'));
  await expectOk('provenance', 'operating_state context accepted separately from specification', 'owner:A',
    `INSERT INTO value_records (machine_id, canonical_field, numeric_value, unit, provenance, context) VALUES ('${ID.MA}','test_weight',3600,'lb','measured','operating_state') RETURNING context`, [], r => r.rows[0].context === 'operating_state');

  // ---------------- IMMUTABILITY / HISTORY ----------------
  const I = 'immutability';
  for (const who of ['super', 'service']) {
    await expectErr(I, `value UPDATE refused for ${who}`, who, `UPDATE value_records SET numeric_value=1 WHERE id='${ID.VA1}'`, [], 'P0001', /DF_IMMUTABLE/);
    await expectErr(I, `value DELETE refused for ${who}`, who, `DELETE FROM value_records WHERE id='${ID.VA1}'`, [], 'P0001', /DF_IMMUTABLE/);
    await expectErr(I, `calculation UPDATE refused for ${who}`, who, `UPDATE calculation_records SET outputs='[]' WHERE id='${ID.CRA}'`, [], 'P0001', /DF_IMMUTABLE/);
    await expectErr(I, `calculation DELETE refused for ${who}`, who, `DELETE FROM calculation_records WHERE id='${ID.CRA}'`, [], 'P0001', /DF_IMMUTABLE/);
  }
  await expectErr(I, 'value TRUNCATE refused', 'super', 'TRUNCATE value_records CASCADE', [], 'P0001', /DF_IMMUTABLE/);
  await expectErr(I, 'calculation TRUNCATE refused', 'super', 'TRUNCATE calculation_records CASCADE', [], 'P0001', /DF_IMMUTABLE/);
  await expectErr(I, 'formula version UPDATE refused', 'super', `UPDATE formula_versions SET engine_version='9' WHERE calculator_id='tow_tongue_percent'`, [], 'P0001', /DF_IMMUTABLE/);
  await expectErr(I, 'formula version DELETE refused', 'super', `DELETE FROM formula_versions WHERE calculator_id='tow_tongue_percent'`, [], 'P0001', /DF_IMMUTABLE/);
  await expectErr(I, 'owner_id change refused even for service role', 'service', `UPDATE machines SET owner_id='${U.B}' WHERE id='${ID.MA}'`, [], 'P0001', /DF_IMMUTABLE/);
  await expectErr(I, 'component machine_id change refused even for service role', 'service', `UPDATE components SET machine_id='${ID.MA2}' WHERE id='${ID.CA1}'`, [], 'P0001', /DF_IMMUTABLE/);
  await expectErr(I, 'connection can only be soft-deleted (service role)', 'service', `UPDATE component_connections SET relation='y' WHERE id='${ID.CONA}'`, [], 'P0001', /DF_IMMUTABLE/);
  await expectOk(I, 'client-supplied created_at ignored: server time used', 'owner:A',
    `INSERT INTO machines (garage_id, name, machine_type, created_at) VALUES ('${ID.GA}','t','automotive','1999-01-01') RETURNING created_at = now() AS server_time`, [], r => r.rows[0].server_time === true);
  await expectOk(I, 'client-supplied recorded_at ignored: server time used', 'owner:A',
    `INSERT INTO value_records (machine_id, canonical_field, numeric_value, unit, provenance, context, recorded_at) VALUES ('${ID.MA}','test_weight',1,'lb','user_entered','specification','1999-01-01') RETURNING recorded_at = now() AS server_time`, [], r => r.rows[0].server_time === true);
  await expectOk(I, 'service-role UPDATE cannot rewrite created_at', 'service', `UPDATE garages SET created_at='1999-01-01', name='n' WHERE id='${ID.GA}' RETURNING created_at <> '1999-01-01'::timestamptz AS kept`, [], r => r.rows[0].kept === true);
  await expectOk(I, 'correction = new row superseding the old; current value follows the chain', 'owner:A', `
    WITH c AS (INSERT INTO value_records (machine_id, canonical_field, numeric_value, unit, provenance, context, supersedes_id)
               VALUES ('${ID.MA}','test_weight',3399,'lb','measured','specification','${ID.VA1}') RETURNING id)
    SELECT (SELECT numeric_value FROM value_records WHERE id='${ID.VA1}') AS old_kept, (SELECT count(*) FROM c) AS added`, [], r => r.rows[0].old_kept === 3420 && +r.rows[0].added === 1);
  await expectErr(I, 'a value can be superseded only once (linear history)', 'owner:A', `
    WITH x AS (INSERT INTO value_records (machine_id, canonical_field, numeric_value, unit, provenance, context, supersedes_id) VALUES ('${ID.MA}','test_weight',1,'lb','measured','specification','${ID.VA1}'))
    INSERT INTO value_records (machine_id, canonical_field, numeric_value, unit, provenance, context, supersedes_id) VALUES ('${ID.MA}','test_weight',2,'lb','measured','specification','${ID.VA1}')`, [], '23505');
  await expectErr(I, 'superseding a different field rejected', 'owner:A',
    `INSERT INTO value_records (machine_id, canonical_field, numeric_value, unit, provenance, context, supersedes_id) VALUES ('${ID.MA}','test_bore',4,'in','measured','specification','${ID.VA1}')`, [], '23514', /DF_SUPERSEDE/);
  await expectErr(I, 'superseding across contexts rejected', 'owner:A',
    `INSERT INTO value_records (machine_id, canonical_field, numeric_value, unit, provenance, context, supersedes_id) VALUES ('${ID.MA}','test_weight',4,'lb','measured','operating_state','${ID.VA1}')`, [], '23514', /DF_SUPERSEDE/);

  // ---------------- ENGINE FINGERPRINT ASSOCIATION ----------------
  const F = 'fingerprint';
  await expectErr(F, 'calculation with an unknown formula_version rejected', 'service',
    `INSERT INTO calculation_records (owner_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
     VALUES ('${U.A}','tow_tongue_percent','tow_tongue_percent','1.1.0','X','fv1-00000000','valid','{}','[]','${ID.N3}')`, [], '23503');
  await expectErr(F, 'calculation citing another calculator\u2019s fingerprint rejected', 'service',
    `INSERT INTO calculation_records (owner_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
     VALUES ('${U.A}','bmep','bmep','1.1.0','X','${fvTow.formula_version}','valid','{}','[]','${ID.N3}')`, [], '23503');
  const fvCarb = (await db.query(`SELECT formula_version, formula_registry FROM formula_versions WHERE calculator_id='carb_sizing'`)).rows[0];
  await expectOk(F, 'alias recorded with requested id and catalog canonical id (carb_cfm -> carb_sizing)', 'service',
    `INSERT INTO calculation_records (owner_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
     VALUES ('${U.A}','carb_cfm','carb_sizing','1.1.0','${fvCarb.formula_registry}','${fvCarb.formula_version}','valid','{}','[]','${ID.N3}')`);
  await expectErr(F, 'canonical_id not matching the catalog rejected', 'service',
    `INSERT INTO calculation_records (owner_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
     VALUES ('${U.A}','carb_cfm','tow_tongue_percent','1.1.0','X','${fvTow.formula_version}','valid','{}','[]','${ID.N3}')`, [], '23514', /DF_CALC/);
  await expectErr(F, 'input_value_ids citing another user\u2019s value rejected', 'service',
    `INSERT INTO calculation_records (owner_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id, input_value_ids)
     VALUES ('${U.A}','tow_tongue_percent','tow_tongue_percent','1.1.0','X','${fvTow.formula_version}','valid','{}','[]','${ID.N3}', ARRAY['${ID.VB1}']::uuid[])`, [], '23503', /DF_CALC/);

  // real engine round trip: the tagged F1.12.3 engine computes; the record stores its result verbatim
  const { JSDOM, VirtualConsole } = require('jsdom');
  const REPO = process.env.DF_REPO_ROOT || path.resolve(HERE, '..');
  const page = execFileSync('git', ['-C', REPO, 'show', 'F1.12.3-UI-MOBILE-HEADER:F1_12_3_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html'], { maxBuffer: 64 << 20 }).toString();
  const w = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://df.local/', virtualConsole: new VirtualConsole(),
    beforeParse(win) { win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} }); win.scrollTo = () => {}; win.HTMLCanvasElement.prototype.getContext = () => null; } }).window;
  await new Promise(r => setTimeout(r, 300));
  const canon = x => Array.isArray(x) ? x.map(canon) : (x && typeof x === 'object') ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canon(x[k])])) : x;
  const cases = [['tow_tongue_percent', { t: { value: 870, provenance: 'measured' }, w: { value: 8700, provenance: 'manufacturer_specified' } }],
                 ['tow_tongue_percent', { t: { value: 870, provenance: 'measured' } }],                                   // UNKNOWN -> incomplete
                 ['speed_converter', { s_in: 60, s_from: 'fps' }],                                                         // D-009 categorical
                 ['understeer_gradient', { cf_stiff: 180, cr_stiff: 210, ug_fpct: 48, ug_vw: 3420 }]];
  let k = 0;
  for (const [calc, inputs] of cases) {
    const r = JSON.parse(JSON.stringify(w.GH_ENGINE.calculate(calc, inputs)));
    const req = `80000000-0000-4000-8000-${String(++k).padStart(12, '0')}`;
    const res = await attempt('service', `
      WITH ins AS (INSERT INTO calculation_records (owner_id, machine_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, missing, warnings, outputs, request_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *) SELECT * FROM ins`,
      [U.A, ID.MA, r.calculator_id, r.canonical_id, r.engine_version, r.formula.registry, r.formula.version, r.state.toLowerCase(), JSON.stringify(inputs), r.missing, r.warnings, JSON.stringify(r.outputs), req]);
    const row = res.ok && res.rows[0];
    const ok = row && JSON.stringify(canon(row.inputs)) === JSON.stringify(canon(inputs)) && JSON.stringify(canon(row.outputs)) === JSON.stringify(canon(r.outputs))
      && row.formula_version === r.formula.version && row.engine_version === '1.1.0' && row.result_state === r.state.toLowerCase();
    rec(F, `engine round trip ${calc} (${r.state}, ${r.formula.version})`, ok, res.ok ? `outputs ${JSON.stringify(r.outputs.map(o => o.value))}` : `${res.code} ${res.msg}`);
  }
  await expectOk(F, 'recalculation creates a NEW record; the original is unchanged', 'service', `
    WITH n AS (INSERT INTO calculation_records (owner_id, machine_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
               SELECT owner_id, machine_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, '${ID.N2}' FROM calculation_records WHERE id='${ID.CRA}' RETURNING id)
    SELECT (SELECT count(*) FROM n) added, (SELECT outputs FROM calculation_records WHERE id='${ID.CRA}') orig`, [], r => +r.rows[0].added === 1 && r.rows[0].orig[0].value === 10);

  // ---------------- DELETION ----------------
  const D = 'deletion';
  await expectOk(D, 'owner can soft-delete own machine (Decision B function)', 'owner:A', `SELECT public.df_soft_delete_machine('${ID.MA}')`, [], r => r.n === 1);   // void result: success = the call completed
  {
    const r = await (async () => { try { return await tx('owner:A', async q => {
      await q(`SELECT public.df_soft_delete_machine('${ID.MA}')`);
      const m = (await q(`SELECT count(*)::int n FROM machines WHERE id='${ID.MA}'`)).rows[0].n, c = (await q(`SELECT count(*)::int n FROM components WHERE machine_id='${ID.MA}'`)).rows[0].n;
      const cn = (await q(`SELECT count(*)::int n FROM component_connections WHERE machine_id='${ID.MA}'`)).rows[0].n;
      const v = (await q(`SELECT count(*)::int n FROM value_records WHERE id='${ID.VA1}'`)).rows[0].n, h = (await q(`SELECT count(*)::int n FROM calculation_records WHERE id='${ID.CRA}'`)).rows[0].n;
      const again = (await q(`UPDATE machines SET name='zombie' WHERE id='${ID.MA}' RETURNING id`)).rowCount;
      return { m, c, cn, v, h, again }; }); } catch (e) { return { err: e.message }; } })();
    rec(D, 'after soft delete: machine/components/connections hidden; value + history survive; deleted row not updatable', r.m === 0 && r.c === 0 && r.cn === 0 && r.v === 1 && r.h === 1 && r.again === 0, JSON.stringify(r));
  }
  {
    const r = await (async () => { try { return await tx('owner:A', async q => {
      await q(`SELECT public.df_soft_delete_garage('${ID.GA}')`);
      return { g: (await q('SELECT count(*)::int n FROM garages')).rows[0].n, m: (await q('SELECT count(*)::int n FROM machines')).rows[0].n }; }); } catch (e) { return { err: e.message }; } })();
    rec(D, 'soft-deleting the garage hides all its machines', r.g === 0 && r.m === 0, JSON.stringify(r));
  }
  for (const t of ['garages', 'machines', 'components', 'component_connections']) await expectErr(D, `hard DELETE of ${t} refused even for the superuser`, 'super', `DELETE FROM ${t}`, [], 'P0001', /DF_IMMUTABLE/);
  {
    const r = await (async () => { try { return await tx('owner:A', async q => { await q(`SELECT public.df_soft_delete_garage('${ID.GA}')`); return (await q(`INSERT INTO garages (name) VALUES ('New') RETURNING id`)).rowCount; }); } catch (e) { return e.code; } })();
    rec(D, 'a new active garage is allowed after soft-deleting the previous one', r === 1, String(r));
  }

  // ---------------- SOFT-DELETE (Decision B functions) ----------------
  const SD = 'soft-delete';
  /* steps inside ONE rolled-back transaction; tryStep isolates an expected error with a savepoint */
  async function steps(who, fn) {
    try { return await tx(who, async q => fn(q, async (sql) => { await q('SAVEPOINT sd'); try { await q(sql); await q('RELEASE SAVEPOINT sd'); return { ok: true }; }
      catch (e) { await q('ROLLBACK TO SAVEPOINT sd'); return { ok: false, code: e.code, msg: e.message.split('\n')[0] }; } })); }
    catch (e) { return { err: e.message }; }
  }
  const FNS = [['garage', 'garages', ID.GA, ID.GB], ['machine', 'machines', ID.MA, ID.MB], ['component', 'components', ID.CA1, ID.CB1], ['connection', 'component_connections', ID.CONA, null]];
  for (const [fnName, table, own, other] of FNS) {
    const r = await steps('owner:A', async (q, tryStep) => {
      const before = (await q(`SELECT owner_id, created_at FROM ${table} WHERE id='${own}'`)).rows[0];
      const call = await tryStep(`SELECT public.df_soft_delete_${fnName}('${own}')`);
      const visible = (await q(`SELECT count(*)::int n FROM ${table} WHERE id='${own}'`)).rows[0].n;
      await q('RESET ROLE');                                           // inspect as superuser inside the same transaction
      const after = (await q(`SELECT owner_id, created_at, deleted_at, deleted_at = now() AS server_time FROM ${table} WHERE id='${own}'`)).rows[0];
      return { call, visible, before, after };
    });
    rec(SD, `df_soft_delete_${fnName}: owner succeeds; row hidden from owner SELECT; deleted_at set server-side`,
      r.call && r.call.ok && r.visible === 0 && r.after.deleted_at !== null && r.after.server_time === true, JSON.stringify({ call: r.call, visible: r.visible, err: r.err }));
    rec(SD, `df_soft_delete_${fnName}: owner_id and created_at unchanged`,
      r.before && r.after && r.before.owner_id === r.after.owner_id && +r.before.created_at === +r.after.created_at, r.err || 'unchanged');
    const rr = await steps('owner:A', async (q, tryStep) => {
      await q(`SELECT public.df_soft_delete_${fnName}('${own}')`); await q('RESET ROLE');
      const first = (await q(`SELECT deleted_at::text d FROM ${table} WHERE id='${own}'`)).rows[0].d;
      await q(`SET LOCAL ROLE authenticated`);
      const again = await tryStep(`SELECT public.df_soft_delete_${fnName}('${own}')`);
      await q('RESET ROLE'); const second = (await q(`SELECT deleted_at::text d FROM ${table} WHERE id='${own}'`)).rows[0].d;
      return { again, same: first === second };
    });
    rec(SD, `df_soft_delete_${fnName}: repeat on an already-deleted row -> DF_NOT_FOUND, deleted_at not re-stamped`,
      rr.again && !rr.again.ok && rr.again.code === 'P0002' && /DF_NOT_FOUND/.test(rr.again.msg) && rr.same === true, JSON.stringify(rr));
    if (other) {
      const rc = await steps('user:B', async (q, tryStep) => {
        const call = await tryStep(`SELECT public.df_soft_delete_${fnName}('${own}')`);
        await q('RESET ROLE'); const still = (await q(`SELECT deleted_at IS NULL AS active FROM ${table} WHERE id='${own}'`)).rows[0].active;
        return { call, still };
      });
      rec(SD, `df_soft_delete_${fnName}: another user cannot delete A's row (same error as not found; row untouched)`,
        rc.call && !rc.call.ok && rc.call.code === 'P0002' && rc.still === true, JSON.stringify(rc));
    }
    await expectErr(SD, `df_soft_delete_${fnName}: anon cannot execute`, 'anon', `SELECT public.df_soft_delete_${fnName}('${own}')`, [], DENIED);
    await expectErr(SD, `df_soft_delete_${fnName}: signed-in session without a user id rejected (DF_AUTH)`, 'owner', `SELECT public.df_soft_delete_${fnName}('${own}')`, [], DENIED, /DF_AUTH/);
    await expectErr(SD, `df_soft_delete_${fnName}: non-existent id -> DF_NOT_FOUND`, 'owner:A', `SELECT public.df_soft_delete_${fnName}('${ID.N1}')`, [], 'P0002', /DF_NOT_FOUND/);
  }
  {
    const r = await steps('owner:A', async (q) => {
      await q(`SELECT public.df_soft_delete_component('${ID.CA2}')`);
      return { machine: (await q(`SELECT count(*)::int n FROM machines WHERE id='${ID.MA}'`)).rows[0].n,
               other: (await q(`SELECT count(*)::int n FROM components WHERE id='${ID.CA1}'`)).rows[0].n,
               gone: (await q(`SELECT count(*)::int n FROM components WHERE id='${ID.CA2}'`)).rows[0].n };
    });
    rec(SD, 'deleting one component leaves its machine and sibling components visible (no cascade invented)', r.machine === 1 && r.other === 1 && r.gone === 0, JSON.stringify(r));
  }
  {
    const r = await steps('owner:A', async (q, tryStep) => {
      const upd = await tryStep(`UPDATE garages SET deleted_at = now()`);          // no WHERE: PostgreSQL skips the SELECT-policy check
      await q('RESET ROLE');
      return { upd, a_deleted: (await q(`SELECT deleted_at IS NOT NULL AS d FROM garages WHERE id='${ID.GA}'`)).rows[0].d,
               b_active: (await q(`SELECT deleted_at IS NULL AS a FROM garages WHERE id='${ID.GB}'`)).rows[0].a };
    });
    rec(SD, 'WHERE-less owner UPDATE of deleted_at can only affect the caller\u2019s own rows; another user\u2019s row is untouched',
      r.b_active === true, `update ${r.upd && r.upd.ok ? 'succeeded' : 'rejected'}; caller's own garage ${r.a_deleted ? 'soft-deleted' : 'unchanged'}; B garage active: ${r.b_active}`);
  }
  await expectErr(SD, 'direct owner UPDATE of deleted_at with a WHERE clause is still rejected by RLS (why Decision B exists)', 'owner:A',
    `UPDATE machines SET deleted_at = now() WHERE id='${ID.MA}'`, [], DENIED, /row-level security/);
  {
    const f = (await db.query(`SELECT p.proname, p.prosecdef, p.proconfig, has_function_privilege('anon', p.oid, 'EXECUTE') anon_x,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') auth_x, coalesce(array_to_string(p.proacl, ','), '') acl, pg_get_function_identity_arguments(p.oid) args
       FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'df\_soft\_delete\_%' ORDER BY 1`)).rows;
    rec(SD, 'exactly four fixed-table soft-delete functions, one uuid argument each (no general-purpose mechanism)',
      JSON.stringify(f.map(x => x.proname)) === JSON.stringify(['df_soft_delete_component', 'df_soft_delete_connection', 'df_soft_delete_garage', 'df_soft_delete_machine']) && f.every(x => x.args === 'p_id uuid'), f.map(x => `${x.proname}(${x.args})`).join(', '));
    rec(SD, 'each is SECURITY DEFINER with a fixed empty search_path', f.every(x => x.prosecdef && JSON.stringify(x.proconfig) === JSON.stringify(['search_path=""'])), JSON.stringify(f.map(x => x.proconfig)));
    rec(SD, 'EXECUTE: authenticated only; not anon, not PUBLIC', f.every(x => x.auth_x && !x.anon_x && !/(^|,)=X/.test(x.acl)), f.map(x => x.acl).join(' | '));
  }

  // ---------------- IDEMPOTENCY ----------------
  await expectErr('idempotency', 'same (owner, request_id) twice rejected', 'service',
    `INSERT INTO calculation_records (owner_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
     VALUES ('${U.A}','tow_tongue_percent','tow_tongue_percent','1.1.0','X','${fvTow.formula_version}','valid','{}','[]','${ID.RQ1}')`, [], '23505');
  rec('idempotency', 'the same request_id is independent per owner (A and B fixtures share RQ1)', (await db.query(`SELECT count(DISTINCT owner_id)::int n FROM calculation_records WHERE request_id=$1`, [ID.RQ1])).rows[0].n === 2, '2 owners');

  // ---------------- REPORT ----------------
  await db.end();
  const groups = [...new Set(results.map(r => r.group))];
  console.log('='.repeat(72)); console.log('GEARHEAD LABS - DATA-FOUNDATION 1.0.0 - DATABASE SUITE'); console.log('='.repeat(72));
  let fails = 0;
  for (const g of groups) { const rs = results.filter(r => r.group === g), f = rs.filter(r => !r.ok); fails += f.length;
    console.log(`[${f.length ? 'FAIL' : 'PASS'}] ${g.toUpperCase().padEnd(16)} ${rs.length - f.length} passed, ${f.length} failed`);
    f.forEach(x => console.log(`    x ${x.name}\n        ${x.detail}`)); }
  fs.writeFileSync(path.join(HERE, 'evidence', 'test-results.json'), JSON.stringify(results, null, 1) + '\n');
  console.log(`\nTOTAL ${results.length} checks, ${results.length - fails} passed, ${fails} failed`);
  console.log(fails ? 'DATA-FOUNDATION SUITE: FAIL' : 'DATA-FOUNDATION SUITE: PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('SUITE ERROR:', e.stack || e); process.exit(2); });
