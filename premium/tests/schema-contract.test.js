#!/usr/bin/env node
/* Gearhead Labs Premium — adapter vs the REAL approved schema (local throwaway PostgreSQL only).
   Applies the hosted-Supabase test shim and supabase/migrations 0001-0406 to a fresh local database, then:
     A. checks every contract in premium/models.js against the live catalog (column grants, enums, RPCs, analyzers);
     B. runs premium/adapters/foundation.js through a minimal PostgREST-style client that executes each request in
        its own transaction as the `authenticated` / `anon` role with request.jwt.claims, as PostgREST does.
   Never connects to a real Supabase project.   Run through premium/tests/run-tests.sh. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const REPO = path.resolve(__dirname, '..', '..');
const { Client } = require(path.join(REPO, 'premium-foundation', 'node_modules', 'pg'));
const HOST = process.env.PF_PGHOST, PORT = +process.env.PF_PGPORT;
if (!HOST || !PORT) { console.error('PF_PGHOST / PF_PGPORT not set (use premium/tests/run-tests.sh)'); process.exit(2); }
const read = p => fs.readFileSync(path.join(REPO, p), 'utf8');
const MIG = path.join(REPO, 'supabase', 'migrations');

const results = [];
async function test(name, fn) { try { await fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: String(e && e.message || e).slice(0, 400) }); } }
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const eq = (a, b, m) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error(`${m}: got ${A}, expected ${B}`); };
async function rejects(p, check) { try { await p; } catch (e) { if (check) check(e); return e; } throw new Error('expected a rejection'); }

const connect = async (db, user) => { const c = new Client({ host: HOST, port: PORT, user, database: db }); await c.connect(); return c; };
async function freshDb(name, migrate) {
  const a = await connect('postgres', 'supabase_admin');
  await a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`); await a.query(`CREATE DATABASE ${name} TEMPLATE template0`); await a.end();
  const s = await connect(name, 'supabase_admin'); await s.query(read('premium-foundation/tests/sql/000_hosted_supabase_shim.sql')); await s.end();
  if (migrate) { const p = await connect(name, 'postgres'); for (const f of fs.readdirSync(MIG).filter(f => f.endsWith('.sql')).sort()) await p.query(fs.readFileSync(path.join(MIG, f), 'utf8')); await p.end(); }
}

/* ---------------------------------------------------------------- minimal PostgREST-style client over pg */
const qi = id => { if (!/^[a-z_][a-z0-9_]*$/.test(id)) throw new Error('bad identifier ' + id); return '"' + id + '"'; };
function pgClient(pg, session) {
  async function exec(sql, params) {
    const role = session.user ? 'authenticated' : 'anon';
    const claims = session.user ? { sub: session.user.id, role } : { role };
    await pg.query('BEGIN');
    try {
      await pg.query(`SET LOCAL ROLE ${role}`);
      await pg.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
      const r = await pg.query(sql, params); await pg.query('COMMIT'); return { rows: r.rows };
    } catch (e) {
      await pg.query('ROLLBACK').catch(() => {});
      return { error: { code: e.code, message: e.message, details: e.detail || null, hint: e.hint || null }, status: e.code === '42501' ? (session.user ? 403 : 401) : 400 };
    }
  }
  const from = table => {
    const st = { table, op: 'select', cols: null, values: null, where: [], order: null, limit: null, single: false, maybe: false };
    const b = {
      select(cols) { st.cols = cols; return b; }, insert(v) { st.op = 'insert'; st.values = v; return b; }, update(v) { st.op = 'update'; st.values = v; return b; },
      eq(k, v) { st.where.push([k, v]); return b; }, order(c, o) { st.order = [c, o && o.ascending]; return b; }, limit(n) { st.limit = n; return b; },
      single() { st.single = true; return b; }, maybeSingle() { st.maybe = true; return b; },
      then(res, rej) { return run(st).then(res, rej); }
    };
    return b;
  };
  async function run(st) {
    const params = [], p = v => { params.push(v && typeof v === 'object' ? JSON.stringify(v) : v); return '$' + params.length; };
    const cols = st.cols ? st.cols.split(',').map(qi).join(',') : '*';
    const where = st.where.length ? ' WHERE ' + st.where.map(([k, v]) => `${qi(k)} = ${p(v)}`).join(' AND ') : '';
    let sql;
    if (st.op === 'select') sql = `SELECT ${cols} FROM public.${qi(st.table)}${where}` + (st.order ? ` ORDER BY ${qi(st.order[0])} ${st.order[1] ? 'ASC' : 'DESC'}` : '') + (st.limit ? ` LIMIT ${+st.limit}` : '');
    else if (st.op === 'insert') { const ks = Object.keys(st.values); sql = `INSERT INTO public.${qi(st.table)} (${ks.map(qi).join(',')}) VALUES (${ks.map(k => p(st.values[k])).join(',')}) RETURNING ${cols}`; }
    else if (st.op === 'update') sql = `UPDATE public.${qi(st.table)} SET ${Object.keys(st.values).map(k => `${qi(k)} = ${p(st.values[k])}`).join(',')}${where} RETURNING ${cols}`;
    const r = await exec(sql, params);
    if (r.error) return { data: null, error: r.error, status: r.status };
    if (st.single) return r.rows.length === 1 ? { data: r.rows[0], error: null, status: 200 } : { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, status: 406 };
    if (st.maybe) return r.rows.length <= 1 ? { data: r.rows[0] || null, error: null, status: 200 } : { data: null, error: { code: 'PGRST116', message: 'multiple rows' }, status: 406 };
    return { data: r.rows, error: null, status: 200 };
  }
  return {
    from,
    async rpc(fn, args) {
      const names = Object.keys(args || {}), params = names.map(n => args[n]);
      const r = await exec(`SELECT * FROM public.${qi(fn)}(${names.map((n, i) => `${qi(n)} => $${i + 1}`).join(',')})`, params);
      return r.error ? { data: null, error: r.error, status: r.status } : { data: r.rows, error: null, status: 200 };
    },
    auth: {
      async getSession() { return { data: { session: session.user ? { user: session.user } : null }, error: null }; },
      async signInWithOtp() { return { error: null }; }, async signOut() { session.user = null; return { error: null }; },
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; }
    }
  };
}
function loadAdapter(client) {
  const window = {}, document = { readyState: 'complete', addEventListener() {} };
  window.GH_SUPABASE = client;
  const ctx = vm.createContext({ window, document, location: { origin: 'https://gearhead.example', pathname: '/' }, console, setTimeout });
  vm.runInContext(read('premium/models.js'), ctx); vm.runInContext(read('premium/adapters/foundation.js'), ctx);
  return { M: window.GHP.models, F: window.GHP.adapters.foundation };
}

const A_ID = 'a0000000-0000-4000-8000-00000000000a', B_ID = 'b0000000-0000-4000-8000-00000000000b';

(async () => {
  await freshDb('fe_contract', true);
  const owner = await connect('fe_contract', 'postgres');
  const { M } = loadAdapter({ from() {}, rpc() {}, auth: {} });
  let pgVersion;
  { const r = await owner.query('SHOW server_version'); pgVersion = r.rows[0].server_version; }

  /* ================================================================ A. catalog contract */
  const grants = {};
  for (const r of (await owner.query(`SELECT table_name t, privilege_type p, array_agg(column_name::text) cs FROM information_schema.column_privileges
      WHERE grantee = 'authenticated' AND table_schema = 'public' GROUP BY 1, 2`)).rows) (grants[r.t] = grants[r.t] || {})[r.p] = new Set(r.cs);
  const has = (t, p, c) => !!(grants[t] && grants[t][p] && grants[t][p].has(c));

  await test('A1. every select column is readable by authenticated; every insert/update column is granted', () => {
    for (const [t, c] of Object.entries(M.TABLES)) {
      for (const col of c.select) assert(has(t, 'SELECT', col), `${t}.${col} not readable`);
      for (const col of c.insert) assert(has(t, 'INSERT', col), `${t}.${col} not insertable`);
      for (const col of c.update) assert(has(t, 'UPDATE', col), `${t}.${col} not updatable`);
      for (const col of [...c.filters, c.key, ...(c.order ? [c.order] : [])]) assert(has(t, 'SELECT', col), `${t}.${col} not readable for filter/key/order`);
    }
  });
  await test('A2. protected tables: authenticated holds no write privilege; server-only tables are not readable either', async () => {
    for (const t of M.PROTECTED_TABLES) for (const p of ['INSERT', 'UPDATE', 'DELETE'])
      eq((await owner.query(`SELECT has_table_privilege('authenticated', $1, $2) x`, ['public.' + t, p])).rows[0].x, false, `${t} ${p}`);
    for (const t of ['value_records', 'calculation_records', 'plans', 'plan_prices', 'subscriptions', 'entitlement_grants'])
      assert(!grants[t] || (!grants[t].INSERT && !grants[t].UPDATE), t + ' has a column write grant');
    for (const t of ['billing_customers', 'stripe_events']) assert(!grants[t], t + ' readable');
    assert(!has('entitlement_grants', 'SELECT', 'note'), 'grant note readable');
  });
  await test('A3. enums equal the database (machine_type minus the blocked marine value)', async () => {
    const lab = async t => (await owner.query(`SELECT array_agg(enumlabel::text ORDER BY enumsortorder) l FROM pg_enum WHERE enumtypid = $1::regtype`, ['public.' + t])).rows[0].l;
    eq(M.enumValues('machine_type'), (await lab('machine_type_enum')).filter(v => v !== 'marine'), 'machine_type');
    eq(M.enumValues('power_source'), await lab('power_source_enum'), 'power_source');
    eq(M.enumValues('experience_level'), await lab('pf_experience_level_enum'), 'experience_level');
    eq(M.enumValues('unit_system'), await lab('pf_unit_system_enum'), 'unit_system');
    eq(M.enumValues('component_kind'), await lab('component_kind_enum'), 'component_kind');
    eq(M.BLOCKED_VALUES.machine_type, ['marine'], 'blocked');
  });
  await test('A4. every adapter RPC exists, takes p_id uuid (soft delete/re-pin), is executable by authenticated and not by anon', async () => {
    const allNames = o => Object.values(o).flatMap(v => typeof v === 'string' ? [v] : allNames(v));
    const fns = allNames(M.RPC).map(f => [f, f === M.RPC.myEntitlement ? '' : 'uuid']);
    eq(fns.length, 8, 'eight client RPCs');
    for (const [fn, args] of fns) {
      const r = (await owner.query(`SELECT p.oid::regprocedure::text sig, has_function_privilege('authenticated', p.oid, 'EXECUTE') a, has_function_privilege('anon', p.oid, 'EXECUTE') n,
          pg_get_function_identity_arguments(p.oid) ia FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = $1`, [fn])).rows;
      eq(r.length, 1, fn + ' exists once');
      eq([r[0].a, r[0].n], [true, false], fn + ' EXECUTE');
      eq(r[0].ia, args ? 'p_id ' + args : '', fn + ' arguments');
    }
    const out = (await owner.query(`SELECT array_agg(a ORDER BY o) c FROM pg_proc p, unnest(p.proargnames, p.proargmodes) WITH ORDINALITY u(a, m, o)
        WHERE p.proname = 'pf_my_entitlement' AND m = 't'`)).rows[0].c;
    eq(out, ['plan_key', 'is_premium', 'features', 'source', 'ends_at'], 'pf_my_entitlement columns read by entitlementFromRpc');
  });
  await test('A5. analyzer catalog and feature vocabulary match the database', async () => {
    eq(M.ENGINEERING_CATALOG.map(a => [a.id, a.code, a.category]), (await owner.query(`SELECT analyzer_id, code, category FROM engineering_analyzers ORDER BY code`)).rows.map(r => [r.analyzer_id, r.code, r.category]), 'analyzers');
    eq([...M.FEATURES].sort(), (await owner.query(`SELECT features FROM plans WHERE plan_key = 'premium'`)).rows[0].features.sort(), 'premium features');
  });

  /* ================================================================ B. the adapter against the database */
  const sa = await connect('fe_contract', 'supabase_admin');
  await sa.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'free@example.test'), ($2, 'premium@example.test')`, [A_ID, B_ID]); await sa.end();
  const sessA = { user: null }, sessB = { user: null };
  const pgA = await connect('fe_contract', 'postgres'), pgB = await connect('fe_contract', 'postgres');
  const A = await loadAdapter(pgClient(pgA, sessA)).F.create();   // probe as a signed-out visitor: provisioned, so it resolves
  const B = await loadAdapter(pgClient(pgB, sessB)).F.create();
  sessA.user = { id: A_ID, email: 'free@example.test' }; sessB.user = { id: B_ID, email: 'premium@example.test' };
  await owner.query(`SET ROLE service_role`); await owner.query(`SELECT public.pf_grant_manual($1, 'premium', NULL, 'contract test')`, [B_ID]); await owner.query(`RESET ROLE`);

  const fixture = { A: {}, B: {} };
  await test('B1. Free user: one garage, one machine from Phase 3A values, details, engine/transmission components', async () => {
    const v = M.fromPhase3aVehicle({ year: 2019, make: 'Ford', model: 'F-150', vehicle_type: 'Truck', fuel_type: 'E85 / Flex Fuel', drivetrain: '4WD', engine: '5.0L V8', transmission: 'Automatic', is_primary: true });
    const g = await A.garage.ensure();
    eq((await A.garage.ensure()).id, g.id, 'ensure is idempotent');
    const m = await A.tables.machines.insert({ ...v.machine, garage_id: g.id });
    eq([m.machine_type, m.power_source, m.name], ['automotive', 'other', '2019 Ford F-150'], 'machine');
    const d = await A.tables.machine_details.insert({ ...v.details, machine_id: m.id });
    assert(d.is_primary && /Drivetrain: 4WD/.test(d.notes), 'details');
    for (const c of v.components) await A.tables.components.insert({ ...c, machine_id: m.id });
    eq((await A.tables.components.list({ machine_id: m.id })).map(c => c.kind).sort(), ['engine', 'transmission'], 'components');
    Object.assign(fixture.A, { garage: g.id, machine: m.id });
  });
  await test('B2. Free user: second machine -> free_machine_limit (real RLS error mapped)', async () => {
    const e = await rejects(A.tables.machines.insert({ garage_id: fixture.A.garage, name: 'Second', machine_type: 'motorcycle' }));
    eq([e.kind, e.upgrade], ['free_machine_limit', true], 'mapped');
  });
  await test('B3. Free user: unlimited Test Setups (Phase 3A build mapping), edit, re-pin, soft delete', async () => {
    const ids = [];
    for (const b of [{ name: 'Street', goals: '12s', status: 'Street' }, { name: 'Track' }, { name: 'Dyno' }, { name: 'Winter' }])
      ids.push((await A.tables.test_setups.insert({ ...M.fromPhase3aBuild(b), machine_id: fixture.A.machine })).id);
    eq((await A.tables.test_setups.list({ machine_id: fixture.A.machine })).length, 4, 'four setups');
    eq((await A.tables.test_setups.update(ids[0], { notes: 'edited' })).notes, 'edited', 'edit');
    eq(await A.testSetups.repinBaseline(ids[1]), true, 're-pin');
    await A.tables.test_setups.softDelete(ids[3]);
    eq((await A.tables.test_setups.list()).length, 3, 'deleted setup hidden');
    await rejects(A.tables.test_setups.softDelete(ids[3]), e => eq(e.kind, 'not_found', 'second delete'));
    fixture.A.setup = ids[0];
  });
  await test('B4. Free user: engineering analysis refused (forbidden); no saved-calculation create exists; entitlement reads Free', async () => {
    const e = await rejects(A.analyses.create({ analyzer_id: 'e01_turbo_compressor_map', title: 'x', inputs: {}, inputs_unit_system: 'imperial' }));
    eq(e.kind, 'forbidden', 'analysis');
    eq(A.tables.saved_calculations.insert, undefined, 'no create');
    const ent = await A.entitlement.mine();
    eq([ent.plan, ent.isPremium, M.canAddMachine(ent, 1)], ['free', false, false], 'entitlement');
  });
  await test('B5. Premium user: several machines; primary is one write and the database moves it (also after deleting the primary)', async () => {
    const g = await B.garage.ensure();
    const ms = [];
    for (const n of ['One', 'Two', 'Three']) ms.push((await B.tables.machines.insert({ garage_id: g.id, name: n, machine_type: 'automotive' })).id);
    await B.machines.setPrimary(ms[0]);                       // no details row yet -> inserted as primary
    await B.tables.machine_details.insert({ machine_id: ms[1], make: 'Chevrolet' });
    await B.machines.setPrimary(ms[1]);
    eq((await B.tables.machine_details.list()).filter(d => d.is_primary).map(d => d.machine_id), [ms[1]], 'moved');
    await B.tables.machines.softDelete(ms[1]);
    await B.machines.setPrimary(ms[2]);
    eq((await B.tables.machine_details.list()).filter(d => d.is_primary).map(d => d.machine_id), [ms[2]], 'no lock-in after deleting the primary');
    Object.assign(fixture.B, { garage: g.id, machine: ms[0], machine2: ms[2] });
    const ent = await B.entitlement.mine();
    eq([ent.isPremium, ent.source, M.canAddMachine(ent, 3)], [true, 'manual', true], 'entitlement');
  });
  await test('B6. Premium user: analysis version pinned from the catalog, linked to a Test Setup, edited, soft-deleted', async () => {
    const ts = await B.tables.test_setups.insert({ machine_id: fixture.B.machine, name: 'Track' });
    const a = await B.analyses.create({ analyzer_id: 'e12_radiator_heat_rejection', title: 'Radiator', inputs: { schema: 1, fields: { e12_m: { value: '40' } } },
      inputs_unit_system: 'imperial', result_snapshot: { results: [] }, test_setup_id: ts.id });
    eq([a.analyzer_version, a.machine_id, a.result_trust], ['E1-AUTO', fixture.B.machine, 'client_reported'], 'pinned + machine filled + trust label');
    eq((await B.tables.engineering_analyses.update(a.id, { title: 'Radiator v2' })).title, 'Radiator v2', 'edit');
    await rejects(B.tables.engineering_analyses.update(a.id, { analyzer_id: 'e01_turbo_compressor_map' }), e => eq(e.code, 'not_writable', 'analyzer immutable'));
    await B.tables.engineering_analyses.softDelete(a.id);
    eq((await B.tables.engineering_analyses.list()).length, 0, 'hidden');
  });
  await test('B7. Premium user: saved calculations are list / edit / pin / delete only (row created by the trusted server path)', async () => {
    const calc = (await owner.query(`SELECT f.calculator_id, f.formula_version, f.engine_version, f.formula_registry FROM formula_versions f
        JOIN calculators k ON k.calculator_id = f.calculator_id AND k.canonical_id = f.calculator_id ORDER BY 1, 2 LIMIT 1`)).rows[0];
    await owner.query(`SET ROLE service_role`);
    const cr = (await owner.query(`INSERT INTO calculation_records (owner_id, machine_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
        VALUES ($1, $2, $3, $3, $4, $5, $6, 'valid', '{}', '[]', gen_random_uuid()) RETURNING id`, [B_ID, fixture.B.machine, calc.calculator_id, calc.engine_version, calc.formula_registry, calc.formula_version])).rows[0].id;
    await owner.query(`RESET ROLE`);
    // stand-in for the future trusted endpoint: the table owner files the saved calculation
    const sc = (await owner.query(`INSERT INTO saved_calculations (owner_id, calculation_id, title) VALUES ($1, $2, 'Filed by server') RETURNING id`, [B_ID, cr])).rows[0].id;
    const list = await B.tables.saved_calculations.list();
    eq(list.map(s => [s.id, s.machine_id]), [[sc, fixture.B.machine]], 'list');
    eq((await B.tables.saved_calculations.update(sc, { title: 'Renamed', pinned: true })).pinned, true, 'edit + pin');
    eq((await B.tables.saved_calculations.list({ pinned: true })).length, 1, 'pinned filter');
    eq((await B.tables.calculation_records.list()).map(r => r.id), [cr], 'own calculation readable');
    await B.tables.saved_calculations.softDelete(sc);
    eq((await B.tables.saved_calculations.list()).length, 0, 'deleted');
  });
  await test('B8. cross-account: updates of another user’s rows are not-found; their rows are invisible; their RPC targets are not-found', async () => {
    eq((await B.tables.machines.list()).some(m => m.id === fixture.A.machine), false, 'A machine invisible to B');
    await rejects(B.tables.machines.update(fixture.A.machine, { name: 'Stolen' }), e => eq(e.kind, 'not_found', 'zero-row update'));
    await rejects(B.tables.test_setups.update(fixture.A.setup, { name: 'Stolen' }), e => eq(e.kind, 'not_found', 'setup'));
    await rejects(B.tables.machines.softDelete(fixture.A.machine), e => eq(e.kind, 'not_found', 'soft delete'));
    await rejects(B.machines.setPrimary(fixture.A.machine), e => assert(['forbidden', 'link_not_found'].includes(e.kind), e.kind));
    eq((await owner.query(`SELECT name FROM machines WHERE id = $1`, [fixture.A.machine])).rows[0].name, '2019 Ford F-150', 'unchanged');
    eq((await owner.query(`SELECT is_primary FROM machine_details WHERE machine_id = $1`, [fixture.A.machine])).rows[0].is_primary, true, 'A primary untouched');
  });
  await test('B9. read-only views: grants without the note, subscriptions, plans, analyzers; protected tables expose no write method', async () => {
    const grantsB = await B.tables.entitlement_grants.list();
    eq([grantsB.length, 'note' in grantsB[0]], [1, false], 'grants');
    eq(await B.entitlement.subscriptions(), [], 'subscriptions');
    eq((await B.tables.plans.list()).map(p => p.plan_key).sort(), ['free', 'premium'], 'plans');
    eq((await B.tables.engineering_analyzers.list()).length, 14, 'analyzers');
    for (const t of ['value_records', 'calculation_records', 'plans', 'plan_prices', 'subscriptions', 'entitlement_grants']) eq(B.tables[t].insert || B.tables[t].update || null, null, t);
  });
  await test('B10. marine stays impossible end to end (client refuses before sending; the database refuses as well)', async () => {
    await rejects(B.tables.machines.insert({ garage_id: fixture.B.garage, name: 'Boat', machine_type: 'marine' }), e => eq(e.code, 'marine_blocked', 'client'));
    const r = await pgClient(pgB, sessB).from('machines').update({ machine_type: 'marine' }).eq('id', fixture.B.machine2).select('id');
    eq(r.error && r.error.code, '23514', 'database CHECK (raw request, bypassing the adapter)');
  });
  await test('B11. an unprovisioned database makes create() reject with noBackend (raw 42P01 mapped)', async () => {
    await freshDb('fe_empty', false);
    const pgE = await connect('fe_empty', 'postgres');
    const e = await rejects(loadAdapter(pgClient(pgE, { user: null })).F.create());
    eq([e.kind, e.noBackend], ['not_provisioned', true], 'noBackend');
    await pgE.end();
  });

  /* ================================================================ C. conformance scenarios (shared with the dev adapter) */
  {
    const { scenarios, helpers } = require('./conformance.js');
    await freshDb('fe_conf', true);
    const own = await connect('fe_conf', 'postgres');
    const ids = { free: 'c0000000-0000-4000-8000-00000000000f', premium: 'c0000000-0000-4000-8000-0000000000aa' };
    const s2 = await connect('fe_conf', 'supabase_admin');
    await s2.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'free@example.test'), ($2, 'premium@example.test')`, [ids.free, ids.premium]); await s2.end();
    const adapters = {}, conns = [];
    for (const u of ['free', 'premium']) {
      const c = await connect('fe_conf', 'postgres'); conns.push(c);
      adapters[u] = await loadAdapter(pgClient(c, { user: { id: ids[u], email: u + '@example.test' } })).F.create();
    }
    const asService = async (sql, params) => { await own.query('SET ROLE service_role'); try { return await own.query(sql, params); } finally { await own.query('RESET ROLE'); } };
    const ctx = {
      M,
      async as(u) { return adapters[u]; },
      async grant(u) { await asService(`SELECT public.pf_grant_manual($1, 'premium', NULL, 'conformance')`, [ids[u]]); },
      async revoke(u) { for (const r of (await asService(`SELECT id FROM entitlement_grants WHERE account_id = $1 AND revoked_at IS NULL`, [ids[u]])).rows) await asService(`SELECT public.pf_revoke_grant($1)`, [r.id]); },
      async seedSavedCalculation(u, machineId) {
        const k = (await own.query(`SELECT f.calculator_id, f.formula_version, f.engine_version, f.formula_registry FROM formula_versions f
            JOIN calculators c ON c.calculator_id = f.calculator_id AND c.canonical_id = f.calculator_id ORDER BY 1, 2 LIMIT 1`)).rows[0];
        const cr = (await asService(`INSERT INTO calculation_records (owner_id, machine_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
            VALUES ($1, $2, $3, $3, $4, $5, $6, 'valid', '{}', '[]', gen_random_uuid()) RETURNING id`, [ids[u], machineId, k.calculator_id, k.engine_version, k.formula_registry, k.formula_version])).rows[0].id;
        await own.query(`INSERT INTO saved_calculations (owner_id, calculation_id, title) VALUES ($1, $2, 'Filed by server')`, [ids[u], cr]);   // stand-in for the future trusted endpoint
      }
    };
    const shared = {}, h = helpers();
    for (const [name, fn] of scenarios) await test('real-schema conformance: ' + name, () => fn(ctx, shared, h));
    for (const c of [own, ...conns]) await c.end();
  }

  /* ================================================================ D. services (step 3) on the foundation adapter and the real schema */
  await test('D1. services on the real schema: production mode, Free garage flow with specs, allowance, drivetrain merge, Test Setups, profile', async () => {
    await freshDb('fe_svc', true);
    const sa3 = await connect('fe_svc', 'supabase_admin');
    const uid = 'd0000000-0000-4000-8000-00000000000d';
    await sa3.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'svc@example.test')`, [uid]); await sa3.end();
    const c = await connect('fe_svc', 'postgres');
    const window = { GHP_CONFIG: { development: { allowOnLocalhost: true, allowQueryFlag: false, queryFlag: 'gh_dev' } } }, store = {};
    window.GH_SUPABASE = pgClient(c, { user: { id: uid, email: 'svc@example.test' } });
    const storage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
    const ctx = vm.createContext({ window, document: { readyState: 'complete', visibilityState: 'visible', addEventListener() {} }, location: { hostname: 'gearhead.example', search: '', origin: 'https://gearhead.example', pathname: '/' },
      sessionStorage: storage, localStorage: storage, console, setTimeout, clearTimeout, URLSearchParams });
    for (const f of ['premium/models.js', 'premium/adapters/foundation.js', 'premium/services.js']) vm.runInContext(read(f), ctx, { filename: f });
    const S = window.GHP.services, Rp = S.repos; await S.ready;
    eq([S.mode, S.auth.user && S.auth.user.id, S.entitlements.state.plan], ['production', uid, 'free'], 'started');
    const m = await Rp.machines.create({ model_year: '1999', make: 'Mazda', model: 'Miata', machine_type: 'automotive', power_source: 'gasoline', engine: '1.8L BP', transmission: '5-speed', drivetrain: 'RWD', notes: 'Autocross' });
    eq([m.name, m.is_primary, m.engine.label, m.drivetrain, m.details.notes], ['1999 Mazda Miata', true, '1.8L BP', 'RWD', 'Autocross'], 'created');
    const raw = await loadAdapter(window.GH_SUPABASE).F.create();
    const g = (await raw.tables.garages.list())[0];
    eq((await rejects(raw.tables.machines.insert({ garage_id: g.id, name: 'Second', machine_type: 'automotive' }))).kind, 'free_machine_limit', 'database allowance (bypassing the services pre-check)');
    const u = await Rp.machines.update(m.id, { drivetrain: 'AWD', transmission: '' });
    eq([u.drivetrain, u.details.notes, u.transmission], ['AWD', 'Autocross', null], 'merge + component soft delete via df_soft_delete_component');
    for (const n of ['Street', 'Track', 'Rain']) await Rp.testSetups.create({ machine_id: m.id, name: n });
    eq((await Rp.testSetups.list(m.id)).length, 3, 'setups');
    eq((await Rp.profile.saveMine({ display_name: 'Svc', experience_level: 'professional' })).experience_level, 'professional', 'profile');
    await rejects(Rp.analyses.saveNew({ analyzer_id: 'e01_turbo_compressor_map', input_data: { unit_system: 'imperial', fields: {} } }, { title: 'x' }), e => eq(e.kind, 'forbidden', 'Free analysis'));
    await c.end();
  });

  for (const c of [owner, pgA, pgB]) await c.end();
  const failed = results.filter(r => !r.pass);
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '\n      -> ' + r.error}`);
  console.log(`\nschema contract: ${results.length - failed.length}/${results.length} passed (PostgreSQL ${pgVersion}, throwaway local cluster)`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('SUITE ERROR', e); process.exit(2); });
