#!/usr/bin/env node
/* PREMIUM-FOUNDATION 1.0.0 - deterministic database suite + negative controls.
 * LOCAL THROWAWAY POSTGRESQL ONLY. Never point this at a real Supabase project.
 *
 * Each database: hosted-Supabase shim (supabase_admin) -> every file in supabase/migrations in version order
 * (applied as the NON-superuser `postgres` role, as on hosted Supabase) -> committed fixtures -> checks.
 * Every check runs in its own transaction and is ROLLED BACK. Fixed UUIDs; no id or timestamp is printed.
 * Negative controls: each mutant is applied to a FRESH fully-migrated database; the named check must then fail,
 * proving the suite detects that defect. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const { Client } = require('pg');

const HERE = path.resolve(__dirname, '..'), REPO = path.resolve(HERE, '..');
const MIG_DIR = path.join(REPO, 'supabase', 'migrations');
const SHIM = fs.readFileSync(path.join(HERE, 'tests', 'sql', '000_hosted_supabase_shim.sql'), 'utf8');
const TAG = 'VALUE-FOUNDATION-1.0.0';
const HOST = process.env.PF_PGHOST, PORT = +process.env.PF_PGPORT;
if (!HOST || !PORT) { console.error('PF_PGHOST / PF_PGPORT not set (use tests/run-tests.sh)'); process.exit(2); }

const EXPECTED_MIGRATIONS = ['0001_enums.sql', '0002_tables.sql', '0003_constraints_triggers.sql', '0004_rls.sql', '0005_reference_seed.sql',
  '0101_test_setups.sql', '0102_test_setups_triggers.sql', '0103_test_setups_rls.sql', '0201_value_write_boundary.sql',
  '0301_value_foundation_v1_seed.sql', '0401_automotive_only.sql', '0402_premium_entitlements.sql', '0403_premium_profiles.sql',
  '0404_premium_garage.sql', '0405_premium_saved_calculations.sql', '0406_premium_engineering_analyses.sql'];
const PUBLIC_TABLES = ['accounts', 'billing_customers', 'calculation_records', 'calculators', 'canonical_fields', 'component_connections',
  'components', 'engineering_analyses', 'engineering_analyzers', 'entitlement_grants', 'formula_versions', 'garages', 'machine_details',
  'machines', 'plan_prices', 'plans', 'profiles', 'saved_calculations', 'stripe_events', 'subscriptions', 'test_setups', 'value_records'];
const SECURITY_DEFINERS = ['df_handle_new_auth_user', 'df_soft_delete_component', 'df_soft_delete_connection', 'df_soft_delete_garage',
  'df_soft_delete_machine', 'gf_repin_test_setup_baseline', 'gf_soft_delete_test_setup', 'pf_engineering_analysis_check',
  'pf_handle_new_auth_user', 'pf_has_feature', 'pf_machine_allowance_ok', 'pf_machine_details_primary', 'pf_my_entitlement', 'pf_saved_calculation_links',
  'pf_soft_delete_engineering_analysis', 'pf_soft_delete_saved_calculation'];
const SERVICE_ONLY = ['pf_grant_manual(uuid, text, timestamptz, text)', 'pf_revoke_grant(uuid)',
  'pf_record_stripe_event(text, text, timestamptz, jsonb)', 'pf_mark_stripe_event_processed(text)', 'pf_upsert_billing_customer(uuid, text)',
  'pf_sync_stripe_subscription(text, uuid, text, text, text, timestamptz, timestamptz, boolean, timestamptz, timestamptz, timestamptz)'];
const BILLING = ['billing_customers', 'subscriptions', 'entitlement_grants', 'stripe_events', 'plans', 'plan_prices'];

const U = { A: 'aaaaaaaa-0000-4000-8000-00000000000a', B: 'bbbbbbbb-0000-4000-8000-00000000000b', C: 'cccccccc-0000-4000-8000-00000000000c',
  L: 'dddddddd-0000-4000-8000-00000000000d', N: 'eeeeeeee-0000-4000-8000-00000000000e', E: 'ffffffff-0000-4000-8000-00000000000f',
  R: '99999999-0000-4000-8000-000000000009' };
/* Client-created rows whose id the client may not choose (column-level INSERT grants) get server ids, captured
 * into ID by the fixtures; everything else uses fixed ids. */
const ID = { GA: '10000000-0000-4000-8000-0000000000a0', GB: '10000000-0000-4000-8000-0000000000b0', GL: '10000000-0000-4000-8000-0000000000d0',
  MA: '20000000-0000-4000-8000-0000000000a1', MB1: '20000000-0000-4000-8000-0000000000b1', MB2: '20000000-0000-4000-8000-0000000000b2',
  ML1: '20000000-0000-4000-8000-0000000000d1', ML2: '20000000-0000-4000-8000-0000000000d2', ML3: '20000000-0000-4000-8000-0000000000d3',
  TA: '30000000-0000-4000-8000-0000000000a1', TB1: '30000000-0000-4000-8000-0000000000b1', TB2: '30000000-0000-4000-8000-0000000000b2',
  CA: '40000000-0000-4000-8000-0000000000a1', CB: '40000000-0000-4000-8000-0000000000b1', CL: '40000000-0000-4000-8000-0000000000d1',
  SB: '50000000-0000-4000-8000-0000000000b1', EB: '60000000-0000-4000-8000-0000000000b1', VA: '70000000-0000-4000-8000-0000000000a1',
  GLGRANT: '80000000-0000-4000-8000-0000000000d1' };
const NULL_NOT_ALLOWED = '22004';
const DENIED = '42501', CHECK = '23514', FK = '23503', UNIQUE = '23505', IMMUTABLE = 'P0001', NOT_FOUND = 'P0002';
const FUTURE = '2099-01-01T00:00:00Z';

/* ---------------------------------------------------------------- database lifecycle */
let dbSeq = 0;
async function connect(db, user) { const c = new Client({ host: HOST, port: PORT, user, database: db }); await c.connect(); return c; }
async function freshDb(label, { order = EXPECTED_MIGRATIONS } = {}) {
  const db = `pf_${label}_${++dbSeq}`.replace(/[^a-z0-9_]/g, '_');
  const admin = await connect('postgres', 'supabase_admin');
  await admin.query(`CREATE DATABASE ${db} OWNER supabase_admin TEMPLATE template0`);
  await admin.end();
  const sa = await connect(db, 'supabase_admin'); await sa.query(SHIM); await sa.end();
  const pg = await connect(db, 'postgres');
  for (const f of order) await pg.query(fs.readFileSync(path.join(MIG_DIR, f), 'utf8'));
  await pg.end();
  return db;
}
async function dropDb(db) { const a = await connect('postgres', 'supabase_admin'); await a.query(`DROP DATABASE ${db} WITH (FORCE)`); await a.end(); }

/* ---------------------------------------------------------------- session helpers */
async function as(c, who) {
  if (who === 'postgres') { await c.query(`SET LOCAL ROLE postgres`); await c.query(`SELECT set_config('request.jwt.claims', '', true)`); return; }
  if (who === 'service') { await c.query(`SET LOCAL ROLE service_role`); await c.query(`SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true)`); return; }
  if (who === 'anon') { await c.query(`SET LOCAL ROLE anon`); await c.query(`SELECT set_config('request.jwt.claims', '{"role":"anon"}', true)`); return; }
  if (who === 'nouid') { await c.query(`SET LOCAL ROLE authenticated`); await c.query(`SELECT set_config('request.jwt.claims', '', true)`); return; }
  await c.query(`SET LOCAL ROLE authenticated`);
  await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U[who], role: 'authenticated' })]);
}
async function q(c, sql, params) { return (await c.query(sql, params)).rows; }
async function one(c, sql, params) { const r = await q(c, sql, params); return r.length ? Object.values(r[0])[0] : undefined; }
async function expectErr(c, sql, params, codes) {
  codes = [].concat(codes);
  await c.query('SAVEPOINT pf_expect');
  try { await c.query(sql, params); } catch (e) {
    await c.query('ROLLBACK TO SAVEPOINT pf_expect');
    if (!codes.includes(e.code)) throw new Error(`expected ${codes.join('/')} but got ${e.code}: ${e.message}`);
    return e;
  }
  await c.query('ROLLBACK TO SAVEPOINT pf_expect');
  throw new Error(`expected error ${codes.join('/')} but the statement succeeded: ${sql.slice(0, 90)}`);
}
const eq = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (cond, what) => { if (!cond) throw new Error(what); };

/* ---------------------------------------------------------------- fixtures (committed) */
async function fixtures(db) {
  const sa = await connect(db, 'supabase_admin');
  for (const k of ['A', 'B', 'C', 'L', 'E']) await sa.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [U[k], `${k.toLowerCase()}@example.test`]);
  await sa.end();
  const c = await connect(db, 'postgres');
  const tx = async (fn) => { await c.query('BEGIN'); try { await fn(); await c.query('COMMIT'); } catch (e) { await c.query('ROLLBACK'); throw e; } };
  const calc = await q(c, `SELECT f.calculator_id, f.formula_version, f.engine_version, f.formula_registry
      FROM public.formula_versions f JOIN public.calculators k ON k.calculator_id = f.calculator_id AND k.canonical_id = f.calculator_id
      ORDER BY f.calculator_id, f.formula_version LIMIT 1`);
  const field = await q(c, `SELECT key, canonical_unit FROM public.canonical_fields WHERE value_kind = 'numeric' ORDER BY key LIMIT 1`);
  const k = calc[0], f = field[0];
  // Premium grants for B and L (trusted server path)
  await tx(async () => { await as(c, 'service');
    await c.query(`SELECT public.pf_grant_manual($1, 'premium', NULL, 'fixture B')`, [U.B]);
    await c.query(`INSERT INTO public.entitlement_grants (id, account_id, plan_key, source, note) VALUES ($1, $2, 'premium', 'manual', 'fixture L')`, [ID.GLGRANT, U.L]); });
  // A (Free): one garage, one machine, details, test setup
  await tx(async () => { await as(c, 'A');
    await c.query(`INSERT INTO public.garages (id, name) VALUES ($1, 'A garage')`, [ID.GA]);
    await c.query(`INSERT INTO public.machines (id, garage_id, name, machine_type, power_source) VALUES ($1, $2, 'A car', 'automotive', 'gasoline')`, [ID.MA, ID.GA]);
    await c.query(`INSERT INTO public.machine_details (machine_id, model_year, make, model, is_primary) VALUES ($1, 2019, 'Ford', 'Mustang', true)`, [ID.MA]);
    ID.TA = await one(c, `INSERT INTO public.test_setups (machine_id, name) VALUES ($1, 'A baseline') RETURNING id`, [ID.MA]); });
  // B (Premium): garage, two machines, two test setups
  await tx(async () => { await as(c, 'B');
    await c.query(`INSERT INTO public.garages (id, name) VALUES ($1, 'B garage')`, [ID.GB]);
    await c.query(`INSERT INTO public.machines (id, garage_id, name, machine_type) VALUES ($1, $3, 'B one', 'automotive'), ($2, $3, 'B two', 'automotive')`, [ID.MB1, ID.MB2, ID.GB]);
    ID.TB1 = await one(c, `INSERT INTO public.test_setups (machine_id, name) VALUES ($1, 'B1 street') RETURNING id`, [ID.MB1]);
    ID.TB2 = await one(c, `INSERT INTO public.test_setups (machine_id, name) VALUES ($1, 'B2 track') RETURNING id`, [ID.MB2]); });
  // L (Premium, then lapsed): three machines
  await tx(async () => { await as(c, 'L');
    await c.query(`INSERT INTO public.garages (id, name) VALUES ($1, 'L garage')`, [ID.GL]);
    await c.query(`INSERT INTO public.machines (id, garage_id, name, machine_type) VALUES ($1, $4, 'L1', 'automotive'), ($2, $4, 'L2', 'automotive'), ($3, $4, 'L3', 'automotive')`, [ID.ML1, ID.ML2, ID.ML3, ID.GL]);
    await c.query(`INSERT INTO public.machine_details (machine_id, make) VALUES ($1, 'Lapsed')`, [ID.ML1]); });
  // calculation records + one value (trusted server path only)
  await tx(async () => { await as(c, 'service');
    const ins = `INSERT INTO public.calculation_records (id, owner_id, machine_id, calculator_id, canonical_id, engine_version, formula_registry,
                   formula_version, result_state, inputs, outputs, request_id) VALUES ($1, $2, $3, $4, $4, $5, $6, $7, 'valid', '{}', '[]', $1)`;
    await c.query(ins, [ID.CA, U.A, ID.MA, k.calculator_id, k.engine_version, k.formula_registry, k.formula_version]);
    await c.query(ins, [ID.CB, U.B, ID.MB1, k.calculator_id, k.engine_version, k.formula_registry, k.formula_version]);
    await c.query(ins, [ID.CL, U.L, ID.ML1, k.calculator_id, k.engine_version, k.formula_registry, k.formula_version]);
    await c.query(`INSERT INTO public.value_records (id, owner_id, machine_id, canonical_field, numeric_value, unit, provenance, context)
                   VALUES ($1, $2, $3, $4, 1.5, $5, 'measured', 'specification')`, [ID.VA, U.A, ID.MA, f.key, f.canonical_unit]); });
  // B's Premium objects
  await tx(async () => { await as(c, 'B');
    ID.SB = await one(c, `INSERT INTO public.saved_calculations (calculation_id, title) VALUES ($1, 'B saved') RETURNING id`, [ID.CB]);
    ID.EB = await one(c, `INSERT INTO public.engineering_analyses (analyzer_id, analyzer_version, machine_id, title, inputs, inputs_unit_system)
                   VALUES ('e12_radiator_heat_rejection', 'E1-AUTO', $1, 'B radiator', '{"fields":{"e12_m":{"value":"40"}}}', 'imperial') RETURNING id`, [ID.MB1]); });
  // L lapses (grant revoked by the server)
  await tx(async () => { await as(c, 'service'); await c.query(`SELECT public.pf_revoke_grant($1)`, [ID.GLGRANT]); });
  await c.end();
  return { calc: k, field: f };
}

/* ---------------------------------------------------------------- checks */
const CHECKS = [];
const check = (group, name, fn) => CHECKS.push({ group, name, fn });

// ---- integrity
check('integrity', 'migration directory is exactly the approved 16 files in version order', async () => {
  eq(fs.readdirSync(MIG_DIR).filter(f => f.endsWith('.sql')).sort(), EXPECTED_MIGRATIONS, 'migrations');
});
check('integrity', 'frozen foundation files are byte-identical to tag VALUE-FOUNDATION-1.0.0 and the manifest', async () => {
  const lines = fs.readFileSync(path.join(REPO, 'supabase', 'FROZEN-SOURCES.sha256'), 'utf8').split('\n').filter(l => l && !l.startsWith('#'));
  eq(lines.length, 12, 'manifest entries');
  for (const l of lines) {
    const [sha, local, tagPath] = l.split(/\s+/);
    const tagBytes = execFileSync('git', ['-C', REPO, 'show', `${TAG}:${tagPath}`], { maxBuffer: 64 << 20 });
    const localBytes = fs.readFileSync(path.join(REPO, local));
    ok(Buffer.compare(tagBytes, localBytes) === 0, `${local} differs from ${TAG}:${tagPath}`);
    eq(crypto.createHash('sha256').update(localBytes).digest('hex'), sha, `${local} sha256`);
  }
});
check('integrity', 'reference data: 583 calculators, 577 formula versions, 252 engine-proven, 47 canonical fields, 2 plans, 14 analyzers', async (c) => {
  const r = (await q(c, `SELECT (SELECT count(*) FROM calculators)::int a, (SELECT count(*) FROM formula_versions)::int b,
    (SELECT count(*) FROM calculators WHERE engine_proven)::int p, (SELECT count(*) FROM canonical_fields)::int cf,
    (SELECT count(*) FROM plans)::int pl, (SELECT count(*) FROM engineering_analyzers)::int an`))[0];
  eq(r, { a: 583, b: 577, p: 252, cf: 47, pl: 2, an: 14 }, 'counts');
  eq(await one(c, `SELECT count(*)::int FROM calculators c WHERE NOT EXISTS (SELECT 1 FROM calculators k WHERE k.calculator_id = c.canonical_id)`), 0, 'dangling aliases');
  eq(await one(c, `SELECT count(*)::int FROM canonical_fields WHERE value_kind <> 'numeric' OR canonical_unit IS NULL`), 0, 'canonical field integrity');
});
check('integrity', 'exactly the 22 expected public tables; RLS enabled AND forced on every one', async (c) => {
  const r = await q(c, `SELECT relname, relrowsecurity e, relforcerowsecurity f FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' ORDER BY relname`);
  eq(r.map(x => x.relname), PUBLIC_TABLES, 'tables');
  eq(r.filter(x => !(x.e && x.f)).map(x => x.relname), [], 'tables without enabled+forced RLS');
});
check('integrity', 'anon holds no privilege on any public table or column', async (c) => {
  const bad = await q(c, `SELECT c.relname, p FROM pg_class c, unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND has_table_privilege('anon', c.oid, p)`);
  eq(bad, [], 'anon table privileges');
  eq(await one(c, `SELECT count(*)::int FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid WHERE c.relnamespace = 'public'::regnamespace
    AND a.attnum > 0 AND (has_column_privilege('anon', c.oid, a.attnum, 'SELECT') OR has_column_privilege('anon', c.oid, a.attnum, 'UPDATE'))`), 0, 'anon column privileges');
});
check('integrity', 'authenticated holds no DELETE / TRUNCATE / REFERENCES / TRIGGER on any public table', async (c) => {
  eq(await q(c, `SELECT c.relname, p FROM pg_class c, unnest(ARRAY['DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND has_table_privilege('authenticated', c.oid, p)`), [], 'privileges');
});
check('integrity', 'no client write path to value_records, calculation_records or billing/entitlement tables', async (c) => {
  for (const t of ['value_records', 'calculation_records', ...BILLING])
    for (const p of ['INSERT', 'UPDATE']) ok(!(await one(c, `SELECT has_table_privilege('authenticated', $1, $2)`, [`public.${t}`, p])), `authenticated ${p} on ${t}`);
  eq(await q(c, `SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND cmd <> 'SELECT'
    AND tablename = ANY ($1)`, [['value_records', 'calculation_records', ...BILLING]]), [], 'write policies');
});
check('integrity', 'SECURITY DEFINER inventory is exact; each pins search_path, is owned by non-superuser postgres (BYPASSRLS), not executable by anon', async (c) => {
  const r = await q(c, `SELECT p.proname, p.proconfig, r.rolname, r.rolsuper, r.rolbypassrls, has_function_privilege('anon', p.oid, 'EXECUTE') anon_x
    FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef ORDER BY p.proname`);
  eq(r.map(x => x.proname), SECURITY_DEFINERS, 'definers');
  for (const x of r) {
    ok(JSON.stringify(x.proconfig) === JSON.stringify(['search_path=""']), `${x.proname} search_path ${JSON.stringify(x.proconfig)}`);
    ok(x.rolname === 'postgres' && !x.rolsuper && x.rolbypassrls, `${x.proname} owner`);
    ok(!x.anon_x || x.proname === 'df_handle_new_auth_user', `${x.proname} executable by anon`);
  }
});
check('integrity', 'trusted-server functions are executable by service_role only', async (c) => {
  for (const f of SERVICE_ONLY) {
    const r = (await q(c, `SELECT has_function_privilege('service_role', $1, 'EXECUTE') s, has_function_privilege('authenticated', $1, 'EXECUTE') a,
      has_function_privilege('anon', $1, 'EXECUTE') n`, [`public.${f}`]))[0];
    eq(r, { s: true, a: false, n: false }, f);
  }
});
check('integrity', 'sign-up (server trigger) creates account + profile, no grant; effective plan is free', async (c) => {
  // auth.users is written by Supabase Auth, not by postgres/clients: use the cluster owner, in a rolled-back transaction.
  const a = await connect(c.database, 'supabase_admin');
  try {
    await a.query('BEGIN');
    await a.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'n@example.test')`, [U.N]);
    await as(a, 'postgres');
    eq(await one(a, `SELECT count(*)::int FROM accounts WHERE id = $1`, [U.N]), 1, 'account');
    eq(await one(a, `SELECT count(*)::int FROM profiles WHERE account_id = $1 AND preferred_unit_system = 'imperial'`, [U.N]), 1, 'profile');
    eq(await one(a, `SELECT count(*)::int FROM entitlement_grants WHERE account_id = $1`, [U.N]), 0, 'grants');
    await as(a, 'N');
    eq(await q(a, `SELECT plan_key, is_premium, features FROM pf_my_entitlement()`), [{ plan_key: 'free', is_premium: false, features: [] }], 'entitlement');
  } finally { await a.query('ROLLBACK').catch(() => {}); await a.end(); }
});

// ---- isolation (User A vs User B)
const OWNED = [['garages', 'id', 'GA', 'GB'], ['machines', 'id', 'MA', 'MB1'], ['machine_details', 'machine_id', 'MA', 'MB1'],
  ['test_setups', 'id', 'TA', 'TB1'], ['calculation_records', 'id', 'CA', 'CB'], ['saved_calculations', 'id', null, 'SB'],
  ['engineering_analyses', 'id', null, 'EB'], ['value_records', 'id', 'VA', null]];
check('isolation', 'A cannot read any of B\'s rows, and B cannot read any of A\'s', async (c) => {
  await as(c, 'A');
  for (const [t, col, , b] of OWNED) if (b) eq(await one(c, `SELECT count(*)::int FROM public.${t} WHERE ${col} = $1`, [ID[b]]), 0, `A sees B ${t}`);
  eq(await one(c, `SELECT count(*)::int FROM profiles WHERE account_id = $1`, [U.B]), 0, 'A sees B profile');
  eq(await one(c, `SELECT count(*)::int FROM entitlement_grants WHERE account_id = $1`, [U.B]), 0, 'A sees B grants');
  eq(await one(c, `SELECT count(*)::int FROM accounts WHERE id = $1`, [U.B]), 0, 'A sees B account');
  await as(c, 'B');
  for (const [t, col, a] of OWNED) if (a) eq(await one(c, `SELECT count(*)::int FROM public.${t} WHERE ${col} = $1`, [ID[a]]), 0, `B sees A ${t}`);
  eq(await one(c, `SELECT count(*)::int FROM profiles WHERE account_id = $1`, [U.A]), 0, 'B sees A profile');
  eq(await one(c, `SELECT count(*)::int FROM profiles`), 1, 'B sees only own profile');
});
check('isolation', 'A cannot update B\'s rows (0 rows affected, data unchanged)', async (c) => {
  await as(c, 'A');
  for (const [sql, p] of [[`UPDATE machines SET name = 'x' WHERE id = $1`, ID.MB1], [`UPDATE machine_details SET make = 'x' WHERE machine_id = $1`, ID.MB1],
    [`UPDATE profiles SET display_name = 'x' WHERE account_id = $1`, U.B], [`UPDATE saved_calculations SET title = 'x' WHERE id = $1`, ID.SB],
    [`UPDATE engineering_analyses SET title = 'x' WHERE id = $1`, ID.EB], [`UPDATE test_setups SET name = 'x' WHERE id = $1`, ID.TB1]])
    eq((await c.query(sql, [p])).rowCount, 0, sql);
  await as(c, 'postgres');
  eq(await one(c, `SELECT title FROM saved_calculations WHERE id = $1`, [ID.SB]), 'B saved', 'B saved title');
  eq(await one(c, `SELECT name FROM machines WHERE id = $1`, [ID.MB1]), 'B one', 'B machine name');
});
check('isolation', 'A cannot attach records to B\'s objects (composite owner FKs / policies)', async (c) => {
  await as(c, 'A');
  await expectErr(c, `INSERT INTO machine_details (machine_id, make) VALUES ($1, 'steal')`, [ID.MB2], [DENIED, FK]);
  await expectErr(c, `INSERT INTO test_setups (machine_id, name) VALUES ($1, 'steal')`, [ID.MB1], [DENIED, FK]);
  await expectErr(c, `UPDATE profiles SET favorite_machine_id = $1 WHERE account_id = $2`, [ID.MB1, U.A], FK);
  await as(c, 'B');
  await expectErr(c, `INSERT INTO saved_calculations (calculation_id, title) VALUES ($1, 'steal')`, [ID.CA], FK);
  await expectErr(c, `INSERT INTO engineering_analyses (analyzer_id, analyzer_version, machine_id, title, inputs, inputs_unit_system)
                      VALUES ('e01_turbo_compressor_map', 'E1-AUTO', $1, 'steal', '{}', 'imperial')`, [ID.MA], FK);
  await expectErr(c, `INSERT INTO saved_calculations (calculation_id, test_setup_id, title) VALUES ($1, $2, 'steal')`, [ID.CB, ID.TA], FK);
});
check('isolation', 'A cannot soft-delete B\'s rows through the SECURITY DEFINER functions (not-found, nothing changes)', async (c) => {
  await as(c, 'A');
  await expectErr(c, `SELECT pf_soft_delete_saved_calculation($1)`, [ID.SB], NOT_FOUND);
  await expectErr(c, `SELECT pf_soft_delete_engineering_analysis($1)`, [ID.EB], NOT_FOUND);
  await expectErr(c, `SELECT df_soft_delete_machine($1)`, [ID.MB1], NOT_FOUND);
  await as(c, 'postgres');
  eq(await one(c, `SELECT count(*)::int FROM saved_calculations WHERE id = $1 AND deleted_at IS NULL`, [ID.SB]), 1, 'B saved intact');
  eq(await one(c, `SELECT count(*)::int FROM engineering_analyses WHERE id = $1 AND deleted_at IS NULL`, [ID.EB]), 1, 'B analysis intact');
});
check('isolation', 'anon can read nothing and call nothing', async (c) => {
  await as(c, 'anon');
  for (const t of ['profiles', 'machines', 'plans', 'engineering_analyzers', 'entitlement_grants', 'calculators'])
    await expectErr(c, `SELECT 1 FROM public.${t} LIMIT 1`, [], DENIED);
  await expectErr(c, `SELECT pf_has_feature('engineering_lab')`, [], DENIED);
  await expectErr(c, `SELECT * FROM pf_my_entitlement()`, [], DENIED);
  await expectErr(c, `SELECT pf_soft_delete_saved_calculation($1)`, [ID.SB], DENIED);
});

// ---- Free allowance (owner decision 1: 1 machine)
check('allowance', 'a Free user can create one machine; a second is refused', async (c) => {
  await as(c, 'C');
  const g = await one(c, `INSERT INTO garages (name) VALUES ('C') RETURNING id`);
  await c.query(`INSERT INTO machines (garage_id, name, machine_type) VALUES ($1, 'first', 'automotive')`, [g]);
  await expectErr(c, `INSERT INTO machines (garage_id, name, machine_type) VALUES ($1, 'second', 'automotive')`, [g], DENIED);
});
check('allowance', 'a Free user cannot create two machines in one statement', async (c) => {
  await as(c, 'C');
  const g = await one(c, `INSERT INTO garages (name) VALUES ('C') RETURNING id`);
  await expectErr(c, `INSERT INTO machines (garage_id, name, machine_type) VALUES ($1, 'one', 'automotive'), ($1, 'two', 'automotive')`, [g], DENIED);
});
check('allowance', 'A (Free, already has one machine) cannot add another', async (c) => {
  await as(c, 'A');
  await expectErr(c, `INSERT INTO machines (garage_id, name, machine_type) VALUES ($1, 'second', 'automotive')`, [ID.GA], DENIED);
});
check('allowance', 'soft-deleting the machine (or its garage) frees the allowance; deletion cannot be undone to exceed it', async (c) => {
  await as(c, 'C');
  const g1 = await one(c, `INSERT INTO garages (name) VALUES ('C1') RETURNING id`);
  const m1 = await one(c, `INSERT INTO machines (garage_id, name, machine_type) VALUES ($1, 'm1', 'automotive') RETURNING id`, [g1]);
  await c.query(`SELECT df_soft_delete_machine($1)`, [m1]);
  const m2 = await one(c, `INSERT INTO machines (garage_id, name, machine_type) VALUES ($1, 'm2', 'automotive') RETURNING id`, [g1]);
  await c.query(`SELECT df_soft_delete_garage($1)`, [g1]);
  const g2 = await one(c, `INSERT INTO garages (name) VALUES ('C2') RETURNING id`);
  await c.query(`INSERT INTO machines (garage_id, name, machine_type) VALUES ($1, 'm3', 'automotive')`, [g2]);
  eq((await c.query(`UPDATE machines SET deleted_at = NULL WHERE id = $1`, [m1])).rowCount, 0, 'client cannot revive a deleted machine');
  eq((await c.query(`UPDATE machines SET deleted_at = NULL WHERE id = $1`, [m2])).rowCount, 0, 'client cannot revive a machine of a deleted garage');
});
check('allowance', 'a Premium user can create additional machines', async (c) => {
  await as(c, 'B');
  for (let i = 0; i < 3; i++) await c.query(`INSERT INTO machines (garage_id, name, machine_type) VALUES ($1, $2, 'automotive')`, [ID.GB, `extra ${i}`]);
  eq(await one(c, `SELECT count(*)::int FROM machines`), 5, 'B machines');
});
check('allowance', 'a lapsed Premium user keeps existing machines (read/update) but cannot add more', async (c) => {
  await as(c, 'L');
  eq(await one(c, `SELECT count(*)::int FROM machines`), 3, 'L machines visible');
  eq((await c.query(`UPDATE machine_details SET make = 'Still mine' WHERE machine_id = $1`, [ID.ML1])).rowCount, 1, 'L updates details');
  await expectErr(c, `INSERT INTO machines (garage_id, name, machine_type) VALUES ($1, 'L4', 'automotive')`, [ID.GL], DENIED);
});

// ---- saved calculations (owner decision 1: Free = none)
check('saved_calculations', 'a Free user cannot create a saved calculation (even on their own record)', async (c) => {
  await as(c, 'A');
  await expectErr(c, `INSERT INTO saved_calculations (calculation_id, title) VALUES ($1, 'mine')`, [ID.CA], DENIED);
});
check('saved_calculations', 'a lapsed user cannot create or edit, but can still read and soft-delete', async (c) => {
  await as(c, 'L');
  await expectErr(c, `INSERT INTO saved_calculations (calculation_id, title) VALUES ($1, 'late')`, [ID.CL], DENIED);
  await as(c, 'B');
  const s = await one(c, `INSERT INTO saved_calculations (calculation_id, title) VALUES ($1, 'to lapse') RETURNING id`, [ID.CB]);
  await as(c, 'service');
  await c.query(`UPDATE entitlement_grants SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL`, [U.B]);
  await as(c, 'B');
  await expectErr(c, `UPDATE saved_calculations SET title = 'edit' WHERE id = $1`, [s], DENIED);
  eq(await one(c, `SELECT count(*)::int FROM saved_calculations`), 2, 'B still reads');
  await c.query(`SELECT pf_soft_delete_saved_calculation($1)`, [s]);
});
check('saved_calculations', 'Premium create: machine is filled from the calculation; inconsistent links are refused', async (c) => {
  await as(c, 'B');
  const s = await one(c, `INSERT INTO saved_calculations (calculation_id, title, test_setup_id) VALUES ($1, 'ok', $2) RETURNING machine_id`, [ID.CB, ID.TB1]);
  eq(s, ID.MB1, 'machine filled');
  await expectErr(c, `INSERT INTO saved_calculations (calculation_id, title, test_setup_id) VALUES ($1, 'bad', $2)`, [ID.CB, ID.TB2], CHECK);
  await expectErr(c, `INSERT INTO saved_calculations (calculation_id, title, machine_id) VALUES ($1, 'bad', $2)`, [ID.CB, ID.MB2], CHECK);
});
check('saved_calculations', 'clients cannot change calculation_id/owner/deleted_at or hard-delete; soft delete is permanent', async (c) => {
  await as(c, 'B');
  await expectErr(c, `UPDATE saved_calculations SET calculation_id = $1 WHERE id = $2`, [ID.CB, ID.SB], DENIED);
  await expectErr(c, `UPDATE saved_calculations SET deleted_at = now() WHERE id = $1`, [ID.SB], DENIED);
  await expectErr(c, `INSERT INTO saved_calculations (owner_id, calculation_id, title) VALUES ($1, $2, 'x')`, [U.B, ID.CB], DENIED);
  await expectErr(c, `DELETE FROM saved_calculations WHERE id = $1`, [ID.SB], DENIED);
  await c.query(`SELECT pf_soft_delete_saved_calculation($1)`, [ID.SB]);
  eq(await one(c, `SELECT count(*)::int FROM saved_calculations WHERE id = $1`, [ID.SB]), 0, 'hidden after soft delete');
  await expectErr(c, `SELECT pf_soft_delete_saved_calculation($1)`, [ID.SB], NOT_FOUND);
  await as(c, 'service');
  await expectErr(c, `DELETE FROM saved_calculations WHERE id = $1`, [ID.SB], DENIED);
  await as(c, 'postgres');   // table owner: only the triggers stand in the way
  await expectErr(c, `UPDATE saved_calculations SET deleted_at = NULL WHERE id = $1`, [ID.SB], IMMUTABLE);
  await expectErr(c, `DELETE FROM saved_calculations WHERE id = $1`, [ID.SB], IMMUTABLE);
});

// ---- engineering analyses
check('engineering', 'a Free user cannot save an engineering analysis', async (c) => {
  await as(c, 'A');
  await expectErr(c, `INSERT INTO engineering_analyses (analyzer_id, analyzer_version, title, inputs, inputs_unit_system)
                      VALUES ('e01_turbo_compressor_map', 'E1-AUTO', 'x', '{}', 'imperial')`, [], DENIED);
});
check('engineering', 'Premium save: version pinned, trust label fixed, inputs validated, links consistent', async (c) => {
  await as(c, 'B');
  const r = (await q(c, `INSERT INTO engineering_analyses (analyzer_id, analyzer_version, test_setup_id, title, inputs, inputs_unit_system, result_snapshot)
    VALUES ('e14_heat_exchanger_matching', 'E1-AUTO', $1, 'ok', '{"fields":{}}', 'metric', '{"results":[]}') RETURNING machine_id, result_trust`, [ID.TB2]))[0];
  eq(r, { machine_id: ID.MB2, result_trust: 'client_reported' }, 'row');
  const base = `INSERT INTO engineering_analyses (analyzer_id, analyzer_version, title, inputs, inputs_unit_system`;
  await expectErr(c, `${base}) VALUES ('e14_heat_exchanger_matching', 'E2-FUTURE', 'x', '{}', 'imperial')`, [], CHECK);
  await expectErr(c, `${base}) VALUES ('e15_marine_propeller', 'E1-AUTO', 'x', '{}', 'imperial')`, [], FK);
  await expectErr(c, `${base}) VALUES ('e01_turbo_compressor_map', 'E1-AUTO', 'x', '[1,2]', 'imperial')`, [], CHECK);
  await expectErr(c, `${base}) VALUES ('e01_turbo_compressor_map', 'E1-AUTO', 'x', jsonb_build_object('blob', (SELECT string_agg(md5(i::text), '') FROM generate_series(1, 3000) i)), 'imperial')`, [], CHECK);
  await expectErr(c, `${base}, result_trust) VALUES ('e01_turbo_compressor_map', 'E1-AUTO', 'x', '{}', 'imperial', 'engine_verified')`, [], DENIED);
  await expectErr(c, `${base}, machine_id, test_setup_id) VALUES ('e01_turbo_compressor_map', 'E1-AUTO', 'x', '{}', 'imperial', $1, $2)`, [ID.MB1, ID.TB2], CHECK);
  await expectErr(c, `UPDATE engineering_analyses SET analyzer_id = 'e01_turbo_compressor_map' WHERE id = $1`, [ID.EB], DENIED);
});
check('engineering', 'a lapsed user cannot save or edit analyses; the analyzer catalog is read-only to clients', async (c) => {
  await as(c, 'L');
  await expectErr(c, `INSERT INTO engineering_analyses (analyzer_id, analyzer_version, title, inputs, inputs_unit_system)
                      VALUES ('e01_turbo_compressor_map', 'E1-AUTO', 'x', '{}', 'imperial')`, [], DENIED);
  await as(c, 'B');
  eq(await one(c, `SELECT count(*)::int FROM engineering_analyzers`), 14, 'catalog readable');
  await expectErr(c, `INSERT INTO engineering_analyzers VALUES ('e15_marine', 'E15', 'Marine', 'Thermal', 'E1-AUTO')`, [], DENIED);
  await expectErr(c, `UPDATE engineering_analyzers SET analyzer_version = 'x'`, [], DENIED);
});

// ---- entitlement & billing security
check('entitlements', 'a client cannot self-grant, extend, alter, delete or truncate entitlements', async (c) => {
  await as(c, 'A');
  await expectErr(c, `INSERT INTO entitlement_grants (account_id, plan_key, source) VALUES ($1, 'premium', 'manual')`, [U.A], DENIED);
  await as(c, 'B');
  await expectErr(c, `UPDATE entitlement_grants SET ends_at = $1`, [FUTURE], DENIED);
  await expectErr(c, `UPDATE entitlement_grants SET revoked_at = NULL`, [], DENIED);
  await expectErr(c, `DELETE FROM entitlement_grants`, [], DENIED);
  await expectErr(c, `TRUNCATE entitlement_grants`, [], DENIED);
  await expectErr(c, `UPDATE plans SET features = ARRAY['engineering_lab']`, [], DENIED);
  await expectErr(c, `INSERT INTO plans VALUES ('free_premium', 'x', false, ARRAY['engineering_lab'], true)`, [], DENIED);
});
check('entitlements', 'a client cannot write or read server-only billing tables, nor call the server functions', async (c) => {
  await as(c, 'A');
  await expectErr(c, `INSERT INTO billing_customers (account_id, stripe_customer_id) VALUES ($1, 'cus_X')`, [U.A], DENIED);
  await expectErr(c, `INSERT INTO subscriptions (stripe_subscription_id, account_id, stripe_customer_id, status) VALUES ('sub_X', $1, 'cus_X', 'active')`, [U.A], DENIED);
  await expectErr(c, `INSERT INTO stripe_events (event_id, event_type, payload) VALUES ('evt_X', 'x', '{}')`, [], DENIED);
  await expectErr(c, `SELECT 1 FROM billing_customers`, [], DENIED);
  await expectErr(c, `SELECT 1 FROM stripe_events`, [], DENIED);
  await expectErr(c, `SELECT pf_grant_manual($1, 'premium', NULL, 'self')`, [U.A], DENIED);
  await expectErr(c, `SELECT pf_sync_stripe_subscription('sub_X', $1, 'cus_X', 'active', NULL, now(), $2, false, NULL, NULL, now())`, [U.A, FUTURE], DENIED);
  await expectErr(c, `SELECT pf_record_stripe_event('evt_X', 'x', NULL, '{}')`, [], DENIED);
  await expectErr(c, `SELECT pf_upsert_billing_customer($1, 'cus_X')`, [U.A], DENIED);
  await expectErr(c, `SELECT pf_revoke_grant($1)`, [ID.GLGRANT], DENIED);
});
check('entitlements', 'pf_has_feature / pf_my_entitlement reflect only the caller', async (c) => {
  await as(c, 'A');
  eq(await one(c, `SELECT pf_has_feature('engineering_lab')`), false, 'A lab');
  eq(await q(c, `SELECT plan_key, is_premium FROM pf_my_entitlement()`), [{ plan_key: 'free', is_premium: false }], 'A plan');
  await as(c, 'B');
  eq(await one(c, `SELECT pf_has_feature('engineering_lab')`), true, 'B lab');
  eq(await q(c, `SELECT plan_key, is_premium, features, source FROM pf_my_entitlement()`),
    [{ plan_key: 'premium', is_premium: true, features: ['engineering_lab', 'garage_unlimited', 'saved_calculations'], source: 'manual' }], 'B plan');
  await as(c, 'L');
  eq(await one(c, `SELECT pf_has_feature('saved_calculations')`), false, 'L lapsed');
  await as(c, 'nouid');
  eq(await one(c, `SELECT pf_has_feature('engineering_lab')`), false, 'no uid');
});
check('entitlements', 'expired, future-dated, revoked and deactivated-plan grants confer nothing', async (c) => {
  await as(c, 'service');
  await c.query(`INSERT INTO entitlement_grants (account_id, plan_key, source, starts_at, ends_at) VALUES ($1, 'premium', 'manual', now() - interval '2 days', now() - interval '1 day')`, [U.C]);
  await c.query(`INSERT INTO entitlement_grants (account_id, plan_key, source, starts_at, ends_at) VALUES ($1, 'premium', 'manual', now() + interval '1 day', NULL)`, [U.C]);
  await as(c, 'C');
  eq(await one(c, `SELECT pf_has_feature('engineering_lab')`), false, 'expired/future');
  await as(c, 'postgres');
  await c.query(`UPDATE plans SET active = false WHERE plan_key = 'premium'`);
  await as(c, 'B');
  eq(await one(c, `SELECT pf_has_feature('engineering_lab')`), false, 'inactive plan');
});
check('entitlements', 'even the server cannot rewrite grant history (guard, no delete, no truncate, no un-revoke)', async (c) => {
  await as(c, 'service');
  const g = await one(c, `SELECT id FROM entitlement_grants WHERE account_id = $1`, [U.B]);
  await expectErr(c, `UPDATE entitlement_grants SET plan_key = 'free' WHERE id = $1`, [g], [IMMUTABLE, CHECK]);
  await expectErr(c, `UPDATE entitlement_grants SET account_id = $1 WHERE id = $2`, [U.A, g], IMMUTABLE);
  await expectErr(c, `UPDATE entitlement_grants SET revoked_at = NULL WHERE id = $1`, [ID.GLGRANT], IMMUTABLE);
  await expectErr(c, `DELETE FROM entitlement_grants WHERE id = $1`, [g], DENIED);
  await expectErr(c, `TRUNCATE entitlement_grants`, [], DENIED);
  await expectErr(c, `INSERT INTO entitlement_grants (account_id, plan_key, source) VALUES ($1, 'free', 'manual')`, [U.C], CHECK);
  await as(c, 'postgres');   // table owner (no privilege barrier): the refusal triggers alone must hold
  await expectErr(c, `DELETE FROM entitlement_grants WHERE id = $1`, [g], IMMUTABLE);
  await expectErr(c, `TRUNCATE entitlement_grants CASCADE`, [], IMMUTABLE);
  await expectErr(c, `UPDATE entitlement_grants SET revoked_at = NULL WHERE id = $1`, [ID.GLGRANT], IMMUTABLE);
});

// ---- Stripe readiness (server path)
check('stripe', 'webhook events are idempotent and immutable', async (c) => {
  await as(c, 'service');
  eq(await one(c, `SELECT pf_record_stripe_event('evt_1', 'customer.subscription.updated', now(), '{"n":1}')`), true, 'first delivery');
  eq(await one(c, `SELECT pf_record_stripe_event('evt_1', 'customer.subscription.updated', now(), '{"n":2}')`), false, 'replay');
  eq(await one(c, `SELECT payload->>'n' FROM stripe_events WHERE event_id = 'evt_1'`), '1', 'payload unchanged');
  await c.query(`SELECT pf_mark_stripe_event_processed('evt_1')`);
  await expectErr(c, `SELECT pf_mark_stripe_event_processed('evt_1')`, [], NOT_FOUND);
  await expectErr(c, `UPDATE stripe_events SET payload = '{}' WHERE event_id = 'evt_1'`, [], IMMUTABLE);
  await expectErr(c, `DELETE FROM stripe_events`, [], [IMMUTABLE, DENIED]);
});
check('stripe', 'subscription lifecycle drives exactly one grant: activate, replay, renew, cancel, resubscribe', async (c) => {
  await as(c, 'postgres');
  await c.query(`INSERT INTO plan_prices VALUES ('price_test', 'premium', 'month', 'usd', 999, true)`);
  await as(c, 'service');
  await c.query(`SELECT pf_upsert_billing_customer($1, 'cus_C')`, [U.C]);
  const sync = (status, end) => c.query(`SELECT pf_sync_stripe_subscription('sub_C', $1, 'cus_C', $2, 'price_test', now(), $3, false, NULL, NULL, clock_timestamp())`, [U.C, status, end]);
  const grants = async () => q(c, `SELECT plan_key, source, revoked_at IS NULL open, ends_at::text e FROM entitlement_grants WHERE account_id = $1 ORDER BY created_at, revoked_at NULLS LAST`, [U.C]);
  const premium = async () => { await as(c, 'C'); const v = await one(c, `SELECT pf_has_feature('engineering_lab')`); await as(c, 'service'); return v; };
  await sync('active', '2098-01-01T00:00:00Z');
  eq(await premium(), true, 'active');
  await sync('active', '2098-01-01T00:00:00Z');
  eq((await grants()).length, 1, 'replay creates nothing');
  await sync('active', '2098-02-01T00:00:00Z');
  const g = await grants(); eq(g.length, 1, 'renewal extends'); ok(g[0].e.startsWith('2098-02-01'), 'extended end');
  await sync('past_due', '2098-02-01T00:00:00Z');
  eq(await premium(), true, 'past_due keeps access to period end');
  await sync('canceled', '2098-02-01T00:00:00Z');
  eq(await premium(), false, 'canceled');
  await sync('active', '2098-03-01T00:00:00Z');
  eq(await premium(), true, 'resubscribed');
  eq((await grants()).map(x => x.open), [false, true], 'one revoked + one open');
  await sync('active', '2000-01-01T00:00:00Z');
  eq(await premium(), false, 'stale period end revokes');
});
check('stripe', 'billing integrity: one customer per account, subscription customer must match its account, unknown price refused', async (c) => {
  await as(c, 'service');
  await c.query(`SELECT pf_upsert_billing_customer($1, 'cus_A')`, [U.A]);
  await c.query(`SELECT pf_upsert_billing_customer($1, 'cus_A')`, [U.A]);
  await expectErr(c, `SELECT pf_upsert_billing_customer($1, 'cus_OTHER')`, [U.A], UNIQUE);
  await expectErr(c, `SELECT pf_sync_stripe_subscription('sub_X', $1, 'cus_A', 'active', NULL, now(), $2, false, NULL, NULL, now())`, [U.B, FUTURE], FK);
  await expectErr(c, `SELECT pf_sync_stripe_subscription('sub_Y', $1, 'cus_A', 'active', 'price_unknown', now(), $2, false, NULL, NULL, now())`, [U.A, FUTURE], FK);
  await expectErr(c, `DELETE FROM billing_customers`, [], [IMMUTABLE, DENIED]);
});

// ---- append-only history (foundation rules hold for every role)
check('append_only', 'value_records: no client insert/update; no update/delete/truncate even for the server', async (c) => {
  await as(c, 'A');
  await expectErr(c, `INSERT INTO value_records (machine_id, canonical_field, unit, provenance, context) VALUES ($1, 'x', 'x', 'unknown', 'specification')`, [ID.MA], DENIED);
  await expectErr(c, `UPDATE value_records SET numeric_value = 2 WHERE id = $1`, [ID.VA], DENIED);
  await as(c, 'service');
  await expectErr(c, `UPDATE value_records SET numeric_value = 2 WHERE id = $1`, [ID.VA], IMMUTABLE);
  await expectErr(c, `DELETE FROM value_records WHERE id = $1`, [ID.VA], IMMUTABLE);
  await expectErr(c, `TRUNCATE value_records CASCADE`, [], [IMMUTABLE, DENIED]);
});
check('append_only', 'calculation_records: no client insert/update; no update/delete/truncate even for the server', async (c) => {
  await as(c, 'B');
  await expectErr(c, `INSERT INTO calculation_records (calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
                      SELECT calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, gen_random_uuid() FROM calculation_records LIMIT 1`, [], DENIED);
  await as(c, 'service');
  await expectErr(c, `UPDATE calculation_records SET result_state = 'incomplete' WHERE id = $1`, [ID.CB], IMMUTABLE);
  await expectErr(c, `DELETE FROM calculation_records WHERE id = $1`, [ID.CA], [IMMUTABLE, FK]);
  await expectErr(c, `TRUNCATE calculation_records CASCADE`, [], [IMMUTABLE, DENIED]);
});

// ---- automotive-only (owner decision 2)
check('marine', 'marine machine types and fields are refused for clients and the server', async (c) => {
  await as(c, 'A');
  await expectErr(c, `UPDATE machines SET machine_type = 'marine' WHERE id = $1`, [ID.MA], CHECK);
  await expectErr(c, `UPDATE machines SET marine_type = 'power_boat' WHERE id = $1`, [ID.MA], DENIED);
  await expectErr(c, `UPDATE machines SET propulsion = 'outboard' WHERE id = $1`, [ID.MA], DENIED);
  await as(c, 'C');
  const g = await one(c, `INSERT INTO garages (name) VALUES ('C') RETURNING id`);
  await expectErr(c, `INSERT INTO machines (garage_id, name, machine_type) VALUES ($1, 'boat', 'marine')`, [g], [CHECK, DENIED]);
  await expectErr(c, `INSERT INTO machines (garage_id, name, machine_type, propulsion) VALUES ($1, 'jet', 'automotive', 'jet')`, [g], [CHECK, DENIED]);
  await as(c, 'service');
  await expectErr(c, `INSERT INTO machines (owner_id, garage_id, name, machine_type, marine_type) VALUES ($1, $2, 'x', 'marine', 'pwc')`, [U.A, ID.GA], CHECK);
  await expectErr(c, `UPDATE machines SET propulsion = 'inboard' WHERE id = $1`, [ID.MA], CHECK);
});
check('marine', 'automotive machines (car, motorcycle, UTV...) remain fully supported', async (c) => {
  await as(c, 'B');
  for (const t of ['automotive', 'motorcycle', 'side_by_side_utv'])
    await c.query(`INSERT INTO machines (garage_id, name, machine_type, power_source) VALUES ($1, $2, $3::machine_type_enum, 'diesel')`, [ID.GB, `m ${t}`, t]);
});

// ---- profiles
check('profiles', 'a user edits own display fields; identity/timestamps are server-controlled; avatar must be https', async (c) => {
  await as(c, 'A');
  eq((await c.query(`UPDATE profiles SET display_name = 'Alpha', location = 'Austin', experience_level = 'experienced',
    preferred_unit_system = 'metric', favorite_machine_id = $1 WHERE account_id = $2`, [ID.MA, U.A])).rowCount, 1, 'own update');
  eq(await q(c, `SELECT display_name, preferred_unit_system FROM profiles`), [{ display_name: 'Alpha', preferred_unit_system: 'metric' }], 'saved');
  await expectErr(c, `UPDATE profiles SET avatar_url = 'http://example.test/a.png'`, [], CHECK);
  await expectErr(c, `UPDATE profiles SET avatar_url = 'javascript:alert(1)'`, [], CHECK);
  await expectErr(c, `UPDATE profiles SET account_id = $1`, [U.B], DENIED);
  await expectErr(c, `UPDATE profiles SET created_at = now() - interval '1 year'`, [], DENIED);
  await expectErr(c, `INSERT INTO profiles (account_id) VALUES ($1)`, [U.N], DENIED);
  await as(c, 'postgres');   // table owner: no privilege barrier, so this exercises the guard trigger itself
  const before = await one(c, `SELECT created_at::text FROM profiles WHERE account_id = $1`, [U.A]);
  await c.query(`UPDATE profiles SET created_at = now() - interval '1 year' WHERE account_id = $1`, [U.A]);
  eq(await one(c, `SELECT created_at::text FROM profiles WHERE account_id = $1`, [U.A]), before, 'created_at kept by the guard');
  await expectErr(c, `UPDATE profiles SET account_id = $1 WHERE account_id = $2`, [U.B, U.A], [IMMUTABLE, UNIQUE]);
});

// ---- SECURITY DEFINER behaviour
check('security_definer', 'soft-delete functions require authentication and act only on the caller\'s active row', async (c) => {
  await as(c, 'nouid');
  await expectErr(c, `SELECT pf_soft_delete_engineering_analysis($1)`, [ID.EB], DENIED);
  await expectErr(c, `SELECT gf_soft_delete_test_setup($1)`, [ID.TB1], DENIED);
  await as(c, 'B');
  await c.query(`SELECT pf_soft_delete_engineering_analysis($1)`, [ID.EB]);
  await as(c, 'postgres');
  ok(await one(c, `SELECT deleted_at IS NOT NULL FROM engineering_analyses WHERE id = $1`, [ID.EB]), 'deleted_at set under FORCE RLS by a non-superuser owner');
});
check('security_definer', 'internal definers (allowance, link checks, sign-up) are not callable by clients', async (c) => {
  for (const [f, who] of [['pf_saved_calculation_links()', 'B'], ['pf_engineering_analysis_check()', 'B'], ['pf_handle_new_auth_user()', 'B'], ['pf_machine_details_primary()', 'B'], ['pf_machine_allowance_ok()', 'anon']])
    eq(await one(c, `SELECT has_function_privilege($1, $2, 'EXECUTE')`, [who === 'anon' ? 'anon' : 'authenticated', `public.${f}`]), false, f);
});

// ---- added in the pre-approval review
check('allowance', 'outside READ COMMITTED the allowance fails closed (a REPEATABLE READ race could otherwise pass it)', async (c) => {
  const sa = await connect(c.database, 'supabase_admin');
  await sa.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'r@example.test') ON CONFLICT (id) DO NOTHING`, [U.R]); await sa.end();
  const s = await connect(c.database, 'postgres');
  await s.query('BEGIN'); await as(s, 'R'); const g = await one(s, `INSERT INTO garages (name) VALUES ('R') RETURNING id`); await s.query('COMMIT'); await s.end();
  const ins = `INSERT INTO machines (garage_id, name, machine_type) VALUES ($1, 'first', 'automotive')`;
  for (const iso of ['REPEATABLE READ', 'SERIALIZABLE']) {
    const x = await connect(c.database, 'postgres');
    try { await x.query(`BEGIN ISOLATION LEVEL ${iso}`); await as(x, 'R'); await expectErr(x, ins, [g], DENIED); }
    finally { await x.query('ROLLBACK').catch(() => {}); await x.end(); }
  }
  const y = await connect(c.database, 'postgres');
  try { await y.query('BEGIN ISOLATION LEVEL READ COMMITTED'); await as(y, 'R'); eq((await y.query(ins, [g])).rowCount, 1, 'READ COMMITTED first machine'); }
  finally { await y.query('ROLLBACK').catch(() => {}); await y.end(); }
});
check('garage', 'marking a machine primary moves the flag; deleting the primary never locks the choice; nobody else can clear it', async (c) => {
  await as(c, 'B');
  await c.query(`INSERT INTO machine_details (machine_id, make, is_primary) VALUES ($1, 'one', true)`, [ID.MB1]);
  await c.query(`INSERT INTO machine_details (machine_id, make, is_primary) VALUES ($1, 'two', true)`, [ID.MB2]);
  eq(await q(c, `SELECT machine_id FROM machine_details WHERE is_primary`), [{ machine_id: ID.MB2 }], 'moved on insert');
  await c.query(`UPDATE machine_details SET is_primary = true WHERE machine_id = $1`, [ID.MB1]);
  eq(await q(c, `SELECT machine_id FROM machine_details WHERE is_primary`), [{ machine_id: ID.MB1 }], 'moved on update');
  await c.query(`SELECT df_soft_delete_machine($1)`, [ID.MB1]);
  eq((await c.query(`UPDATE machine_details SET is_primary = true WHERE machine_id = $1`, [ID.MB2])).rowCount, 1, 'new primary after deleting the old one');
  await expectErr(c, `INSERT INTO machine_details (machine_id, is_primary) VALUES ($1, true)`, [ID.MA], [DENIED, FK]);
  await as(c, 'postgres');
  eq(await q(c, `SELECT owner_id, machine_id FROM machine_details WHERE is_primary ORDER BY owner_id`),
    [{ owner_id: U.A, machine_id: ID.MA }, { owner_id: U.B, machine_id: ID.MB2 }], 'one primary per owner; A untouched by B');
});
check('test_setups', 'CURRENT behaviour (owner decision pending): Free may create several Test Setups on its one machine, but cannot attach saved work to them', async (c) => {
  await as(c, 'A');
  for (const n of ['street', 'track', 'dyno']) await c.query(`INSERT INTO test_setups (machine_id, name) VALUES ($1, $2)`, [ID.MA, n]);
  eq(await one(c, `SELECT count(*)::int FROM test_setups`), 4, 'A test setups');
  await expectErr(c, `INSERT INTO saved_calculations (calculation_id, test_setup_id, title) VALUES ($1, $2, 'x')`, [ID.CA, ID.TA], DENIED);
  await expectErr(c, `INSERT INTO engineering_analyses (analyzer_id, analyzer_version, test_setup_id, title, inputs, inputs_unit_system)
                      VALUES ('e01_turbo_compressor_map', 'E1-AUTO', $1, 'x', '{}', 'imperial')`, [ID.TA], DENIED);
});
check('entitlements', 'clients read their own grants but never the operator note', async (c) => {
  await as(c, 'B');
  eq(await one(c, `SELECT count(*)::int FROM (SELECT id, plan_key, source, ends_at, revoked_at FROM entitlement_grants) g`), 1, 'own grant readable');
  await expectErr(c, `SELECT note FROM entitlement_grants`, [], DENIED);
  await expectErr(c, `SELECT * FROM entitlement_grants`, [], DENIED);
});
check('stripe', 'late or out-of-order webhooks never overwrite a newer state or re-open access', async (c) => {
  await as(c, 'postgres');
  await c.query(`INSERT INTO plan_prices VALUES ('price_order', 'premium', 'month', 'usd', 999, true)`);
  await as(c, 'service');
  await c.query(`SELECT pf_upsert_billing_customer($1, 'cus_O')`, [U.C]);
  const sync = (status, at) => one(c, `SELECT pf_sync_stripe_subscription('sub_O', $1, 'cus_O', $2, 'price_order', now(), '2098-01-01', false, NULL, NULL, $3)`, [U.C, status, at]);
  const premium = async () => { await as(c, 'C'); const v = await one(c, `SELECT pf_has_feature('engineering_lab')`); await as(c, 'service'); return v; };
  eq(await sync('active', '2030-01-01T10:00:00Z'), true, 'activation applied');
  eq(await sync('canceled', '2030-01-01T10:05:00Z'), true, 'cancellation applied');
  eq(await sync('active', '2030-01-01T10:00:00Z'), false, 'stale activation ignored');
  eq(await premium(), false, 'no access after cancellation');
  eq(await one(c, `SELECT status FROM subscriptions WHERE stripe_subscription_id = 'sub_O'`), 'canceled', 'mirror keeps newest state');
  eq(await sync('canceled', '2030-01-01T10:05:00Z'), true, 'same-time replay is idempotent');
  eq(await one(c, `SELECT count(*)::int FROM entitlement_grants WHERE source_ref = 'sub_O'`), 1, 'no extra grants');
  await expectErr(c, `SELECT pf_sync_stripe_subscription('sub_O', $1, 'cus_O', 'active', 'price_order', now(), '2098-01-01', false, NULL, NULL, NULL)`, [U.C], NULL_NOT_ALLOWED);
});

/* ---------------------------------------------------------------- catalog fingerprint (idempotency / order) */
const FP_SQL = `SELECT x FROM (
  SELECT 'col '||table_schema||'.'||table_name||'.'||column_name||' '||udt_name||' '||is_nullable||' '||coalesce(column_default,'') x
    FROM information_schema.columns WHERE table_schema IN ('public','auth')
  UNION ALL SELECT 'con '||conrelid::regclass::text||' '||conname||' '||pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace IN ('public'::regnamespace,'auth'::regnamespace)
  UNION ALL SELECT 'idx '||indexdef FROM pg_indexes WHERE schemaname IN ('public','auth')
  UNION ALL SELECT 'pol '||tablename||' '||policyname||' '||permissive||' '||cmd||' '||array_to_string(roles,',')||' '||coalesce(qual,'')||' '||coalesce(with_check,'') FROM pg_policies WHERE schemaname IN ('public','auth')
  UNION ALL SELECT 'trg '||pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace IN ('public'::regnamespace,'auth'::regnamespace)
  UNION ALL SELECT 'fn '||p.proname||'('||pg_get_function_identity_arguments(p.oid)||') '||md5(pg_get_functiondef(p.oid))||' '||p.prosecdef||' '||coalesce(array_to_string(p.proacl,','),'') FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
  UNION ALL SELECT 'enum '||t.typname||' '||string_agg(e.enumlabel,',' ORDER BY e.enumsortorder) FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid GROUP BY t.typname
  UNION ALL SELECT 'rel '||c.relname||' '||c.relrowsecurity||' '||c.relforcerowsecurity||' '||coalesce(array_to_string(c.relacl,','),'') FROM pg_class c WHERE c.relnamespace='public'::regnamespace
  UNION ALL SELECT 'colacl '||c.relname||'.'||a.attname||' '||array_to_string(a.attacl,',') FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE a.attacl IS NOT NULL AND c.relnamespace='public'::regnamespace
  /*ROWS*/UNION ALL SELECT 'rows '||(SELECT count(*) FROM public.calculators)||' '||(SELECT count(*) FROM public.formula_versions)||' '||(SELECT count(*) FROM public.canonical_fields)||' '||(SELECT count(*) FROM public.plans)||' '||(SELECT count(*) FROM public.engineering_analyzers)
) s ORDER BY x`;
const FP_CORE_SQL = FP_SQL.replace(/\/\*ROWS\*\/[^\n]*\n/, '');
async function fpLines(db, sql = FP_SQL) { const c = await connect(db, 'postgres'); const r = (await q(c, sql)).map(x => x.x); await c.end(); return r; }
async function fingerprint(db) { return crypto.createHash('sha256').update((await fpLines(db)).join('\n')).digest('hex'); }
const ROLLBACKS = ['0406_premium_engineering_analyses', '0405_premium_saved_calculations', '0404_premium_garage', '0403_premium_profiles',
  '0402_premium_entitlements', '0401_automotive_only'].map(n => path.join(REPO, 'supabase', 'rollback', `${n}.rollback.sql`));
/* Function body taken from a migration, for mutants that must differ from the real definition by one clause. */
function fnDef(file, name, from, to) {
  const s = fs.readFileSync(path.join(MIG_DIR, file), 'utf8'), i = s.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`), j = s.indexOf('END $$;', i) + 7;
  const def = s.slice(i, j); if (!def.includes(from)) throw new Error(`mutant source for ${name} not found`); return def.replace(from, to);
}

/* ---------------------------------------------------------------- runner */
async function runChecks(db, { only } = {}) {
  const results = [];
  for (const ch of CHECKS) {
    if (only && !only.includes(ch.name)) continue;
    const c = await connect(db, 'postgres');
    let err = null;
    try { await c.query('BEGIN'); await ch.fn(c); } catch (e) { err = e; }
    try { await c.query('ROLLBACK'); } catch (e) {}
    await c.end();
    results.push({ group: ch.group, name: ch.name, pass: !err, error: err ? String(err.message || err).slice(0, 300) : undefined });
  }
  return results;
}

async function concurrencyCheck(db) {
  // Two simultaneous first-machine inserts by the same Free user: exactly one may succeed.
  const setup = await connect(db, 'postgres');
  await setup.query('BEGIN'); await as(setup, 'E');
  const g = await one(setup, `INSERT INTO garages (name) VALUES ('E') RETURNING id`);
  await setup.query('COMMIT'); await setup.end();
  const c1 = await connect(db, 'postgres'), c2 = await connect(db, 'postgres');
  await c1.query('BEGIN'); await as(c1, 'E');
  await c2.query('BEGIN'); await as(c2, 'E');
  await c1.query(`INSERT INTO machines (garage_id, name, machine_type) VALUES ($1, 'race-1', 'automotive')`, [g]);   // holds the allowance lock
  const second = c2.query(`INSERT INTO machines (garage_id, name, machine_type) VALUES ($1, 'race-2', 'automotive')`, [g])
    .then(() => 'succeeded', e => e.code);
  await new Promise(r => setTimeout(r, 400));
  await c1.query('COMMIT');
  const outcome = await second;
  await c2.query(outcome === 'succeeded' ? 'COMMIT' : 'ROLLBACK');
  await c1.end(); await c2.end();
  const v = await connect(db, 'postgres');
  const n = await one(v, `SELECT count(*)::int FROM machines WHERE owner_id = $1 AND deleted_at IS NULL`, [U.E]); await v.end();
  const pass = outcome === DENIED && n === 1;
  return { group: 'allowance', name: 'concurrent first-machine inserts by one Free user: exactly one succeeds (advisory lock)', pass,
    error: pass ? undefined : `second insert: ${outcome}; active machines: ${n}` };
}

const MUTANTS = [
  ['restrictive allowance policy dropped', `DROP POLICY pf_machines_free_allowance ON public.machines`, 'a Free user can create one machine; a second is refused'],
  ['allowance function always true', `CREATE OR REPLACE FUNCTION public.pf_machine_allowance_ok() RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$ SELECT true $$`,
    'A (Free, already has one machine) cannot add another'],
  ['client granted INSERT on entitlement_grants + permissive policy', `GRANT INSERT ON public.entitlement_grants TO authenticated;
     CREATE POLICY m_ins ON public.entitlement_grants FOR INSERT TO authenticated WITH CHECK (account_id = auth.uid())`,
    'a client cannot self-grant, extend, alter, delete or truncate entitlements'],
  ['saved_calculations insert policy not feature-gated', `DROP POLICY pf_saved_calculations_insert ON public.saved_calculations;
     CREATE POLICY pf_saved_calculations_insert ON public.saved_calculations FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid())`,
    'a Free user cannot create a saved calculation (even on their own record)'],
  ['engineering_analyses RLS disabled', `ALTER TABLE public.engineering_analyses NO FORCE ROW LEVEL SECURITY; ALTER TABLE public.engineering_analyses DISABLE ROW LEVEL SECURITY`,
    'A cannot read any of B\'s rows, and B cannot read any of A\'s'],
  ['automotive-only constraint dropped', `ALTER TABLE public.machines DROP CONSTRAINT pf_machines_automotive_only`,
    'marine machine types and fields are refused for clients and the server'],
  ['pf_grant_manual executable by clients', `GRANT EXECUTE ON FUNCTION public.pf_grant_manual(uuid, text, timestamptz, text) TO authenticated`,
    'trusted-server functions are executable by service_role only'],
  ['pf_has_feature ignores ends_at', `CREATE OR REPLACE FUNCTION public.pf_has_feature(p_feature text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
     SELECT EXISTS (SELECT 1 FROM public.entitlement_grants g JOIN public.plans p ON p.plan_key = g.plan_key AND p.active
     WHERE g.account_id = auth.uid() AND g.revoked_at IS NULL AND g.starts_at <= now() AND p_feature = ANY (p.features)) $$`,
    'expired, future-dated, revoked and deactivated-plan grants confer nothing'],
  ['grant guard trigger dropped', `DROP TRIGGER pf_guard ON public.entitlement_grants`,
    'even the server cannot rewrite grant history (guard, no delete, no truncate, no un-revoke)'],
  ['webhook recorder not idempotent', `CREATE OR REPLACE FUNCTION public.pf_record_stripe_event(p_event_id text, p_event_type text, p_stripe_created_at timestamptz, p_payload jsonb)
     RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN INSERT INTO public.stripe_events (event_id, event_type, stripe_created_at, payload)
     VALUES (p_event_id, p_event_type, p_stripe_created_at, p_payload) ON CONFLICT (event_id) DO NOTHING; RETURN true; END $$`,
    'webhook events are idempotent and immutable'],
  ['anon granted SELECT on billing_customers', `GRANT SELECT ON public.billing_customers TO anon`, 'anon holds no privilege on any public table or column'],
  ['soft delete without owner check', `CREATE OR REPLACE FUNCTION public.pf_soft_delete_saved_calculation(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
     DECLARE uid uuid := auth.uid(); n int; BEGIN IF uid IS NULL THEN RAISE EXCEPTION 'PF_AUTH' USING ERRCODE = '42501'; END IF;
     UPDATE public.saved_calculations SET deleted_at = now() WHERE id = p_id AND deleted_at IS NULL; GET DIAGNOSTICS n = ROW_COUNT;
     IF n <> 1 THEN RAISE EXCEPTION 'PF_NOT_FOUND' USING ERRCODE = 'P0002'; END IF; END $$`,
    'A cannot soft-delete B\'s rows through the SECURITY DEFINER functions (not-found, nothing changes)'],
  ['0201 undone: client INSERT on value_records', `GRANT INSERT ON public.value_records TO authenticated;
     CREATE POLICY m_val ON public.value_records FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid())`,
    'no client write path to value_records, calculation_records or billing/entitlement tables'],
  ['profiles readable by everyone', `DROP POLICY pf_profiles_select ON public.profiles; CREATE POLICY pf_profiles_select ON public.profiles FOR SELECT TO authenticated USING (true)`,
    'A cannot read any of B\'s rows, and B cannot read any of A\'s'],
  ['grant delete refusal dropped', `DROP TRIGGER pf_no_delete ON public.entitlement_grants`,
    'even the server cannot rewrite grant history (guard, no delete, no truncate, no un-revoke)'],
  ['definer search_path removed', `ALTER FUNCTION public.pf_has_feature(text) RESET search_path`,
    'SECURITY DEFINER inventory is exact; each pins search_path, is owned by non-superuser postgres (BYPASSRLS), not executable by anon'],
  ['Stripe ordering guard removed', fnDef('0402_premium_entitlements.sql', 'pf_sync_stripe_subscription', '\n  WHERE s.stripe_state_at <= EXCLUDED.stripe_state_at;', ';'),
    'late or out-of-order webhooks never overwrite a newer state or re-open access'],
  ['allowance isolation guard removed', fnDef('0404_premium_garage.sql', 'pf_machine_allowance_ok', "  IF current_setting('transaction_isolation') <> 'read committed' THEN RETURN false; END IF;\n", ''),
    'outside READ COMMITTED the allowance fails closed (a REPEATABLE READ race could otherwise pass it)'],
  ['primary-move trigger dropped', `DROP TRIGGER pf_primary ON public.machine_details`,
    'marking a machine primary moves the flag; deleting the primary never locks the choice; nobody else can clear it'],
  ['primary-move not owner-scoped', fnDef('0404_premium_garage.sql', 'pf_machine_details_primary', 'WHERE owner_id = NEW.owner_id AND machine_id', 'WHERE machine_id'),
    'marking a machine primary moves the flag; deleting the primary never locks the choice; nobody else can clear it'],
  ['operator note readable by clients', `GRANT SELECT (note) ON public.entitlement_grants TO authenticated`,
    'clients read their own grants but never the operator note'],
];

(async () => {
  const started = Date.now();
  const out = { suite: 'PREMIUM-FOUNDATION 1.0.0', postgres: null, checks: [], idempotency: null, order_equivalence: null, rollback: null, mutants: [] };
  const main = await freshDb('main');
  { const c = await connect(main, 'postgres'); out.postgres = await one(c, `SHOW server_version`); await c.end(); }
  await fixtures(main);
  out.checks = await runChecks(main);
  out.checks.push(await concurrencyCheck(main));
  await dropDb(main);

  // idempotency: every migration applied twice -> identical catalog
  const once = await freshDb('once'), twice = await freshDb('twice');
  { const c = await connect(twice, 'postgres'); for (const f of EXPECTED_MIGRATIONS) await c.query(fs.readFileSync(path.join(MIG_DIR, f), 'utf8')); await c.end(); }
  const fpOnce = await fingerprint(once), fpTwice = await fingerprint(twice);
  out.idempotency = { pass: fpOnce === fpTwice };
  // order equivalence: 0201 before 0101-0103 (as listed in the brief) vs version order
  const alt = EXPECTED_MIGRATIONS.slice(0, 5).concat(['0201_value_write_boundary.sql', '0101_test_setups.sql', '0102_test_setups_triggers.sql', '0103_test_setups_rls.sql'], EXPECTED_MIGRATIONS.slice(9));
  const altDb = await freshDb('altorder', { order: alt });
  out.order_equivalence = { pass: (await fingerprint(altDb)) === fpOnce };
  // rollback: 0406 -> 0401 on a fully provisioned database must leave exactly the frozen foundation (plus, because the
  // migration role does not own auth.users, the documented inert sign-up trigger), and re-applying 0401-0406 afterwards
  // must reproduce the full catalog.
  const frozenDb = await freshDb('frozen', { order: EXPECTED_MIGRATIONS.slice(0, 10) });
  const rb = await freshDb('rollback');
  { const c = await connect(rb, 'postgres'); for (const f of ROLLBACKS) await c.query(fs.readFileSync(f, 'utf8')); await c.end(); }
  const frozenLines = await fpLines(frozenDb, FP_CORE_SQL), rbLines = await fpLines(rb, FP_CORE_SQL);
  const extra = rbLines.filter(l => !frozenLines.includes(l)), missing = frozenLines.filter(l => !rbLines.includes(l));
  const residueOk = extra.length === 2 && extra.some(l => l.startsWith('fn pf_handle_new_auth_user() ')) && extra.some(l => l.startsWith('trg CREATE TRIGGER pf_on_auth_user_created '));
  { const c = await connect(rb, 'postgres'); for (const f of EXPECTED_MIGRATIONS.slice(10)) await c.query(fs.readFileSync(path.join(MIG_DIR, f), 'utf8')); await c.end(); }
  const reprovisionOk = (await fingerprint(rb)) === fpOnce;
  out.rollback = { pass: missing.length === 0 && residueOk && reprovisionOk, missing: missing.length, extra: extra.map(l => l.slice(0, 60)), reprovision: reprovisionOk };
  await dropDb(once); await dropDb(twice); await dropDb(altDb); await dropDb(frozenDb); await dropDb(rb);

  for (const [name, sql, target] of MUTANTS) {
    const db = await freshDb('mutant');
    const m = await connect(db, 'postgres'); await m.query(sql); await m.end();
    await fixtures(db);
    const r = await runChecks(db, { only: [target] });
    out.mutants.push({ mutant: name, target, killed: r.length === 1 && !r[0].pass });
    await dropDb(db);
  }

  for (const r of out.checks) console.log(`${r.pass ? 'PASS' : 'FAIL'}  [${r.group}] ${r.name}${r.pass ? '' : '\n      -> ' + r.error}`);
  console.log(`${out.idempotency.pass ? 'PASS' : 'FAIL'}  [idempotency] every migration applied twice leaves the catalog fingerprint unchanged`);
  console.log(`${out.order_equivalence.pass ? 'PASS' : 'FAIL'}  [order] 0201 before 0101-0103 yields the same catalog as version order`);
  console.log(`${out.rollback.pass ? 'PASS' : 'FAIL'}  [rollback] 0406->0401 restores the frozen catalog (only the inert sign-up trigger remains); re-applying 0401-0406 restores the full catalog${out.rollback.pass ? '' : '\n      -> ' + JSON.stringify(out.rollback)}`);
  for (const m of out.mutants) console.log(`${m.killed ? 'KILLED  ' : 'SURVIVED'}  mutant: ${m.mutant}`);
  const failed = out.checks.filter(r => !r.pass).length + (out.idempotency.pass ? 0 : 1) + (out.order_equivalence.pass ? 0 : 1) + (out.rollback.pass ? 0 : 1);
  const survived = out.mutants.filter(m => !m.killed).length;
  console.log(`\n${out.checks.length} checks: ${out.checks.length - out.checks.filter(r => !r.pass).length} passed, ${out.checks.filter(r => !r.pass).length} failed; idempotency ${out.idempotency.pass ? 'ok' : 'FAILED'}; order ${out.order_equivalence.pass ? 'ok' : 'FAILED'}; rollback ${out.rollback.pass ? 'ok' : 'FAILED'}; mutants: ${out.mutants.length - survived}/${out.mutants.length} killed. PostgreSQL ${out.postgres}.`);
  out.summary = { checks: out.checks.length, failed, mutants: out.mutants.length, survived };
  fs.mkdirSync(path.join(HERE, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(HERE, 'evidence', 'test-results.json'), JSON.stringify(out, null, 2) + '\n');
  if (process.env.PF_VERBOSE) console.error(`elapsed ${((Date.now() - started) / 1000).toFixed(1)}s`);
  process.exit(failed || survived ? 1 : 0);
})().catch(e => { console.error('SUITE ERROR', e); process.exit(2); });
