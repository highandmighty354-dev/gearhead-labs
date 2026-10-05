#!/usr/bin/env node
/* Gearhead Labs Premium — frontend adapter contract tests (no network, no credentials, no database).
   Loads premium/models.js and premium/adapters/foundation.js in an isolated VM with a FAKE Supabase client that
   records every request, plus static scans of the frontend files.   Run: node premium/tests/frontend.test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(REPO, p), 'utf8');
const MODELS = read('premium/models.js'), FOUNDATION = read('premium/adapters/foundation.js');

/* ---------------------------------------------------------------- tiny harness */
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, pass: true }); }
  catch (e) { results.push({ name, pass: false, error: (e && e.stack || String(e)).split('\n').slice(0, 3).join(' | ') }); }
}
const assert = (c, msg) => { if (!c) throw new Error(msg || 'assertion failed'); };
const eq = (a, b, msg) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error(`${msg || 'not equal'}: got ${A}, expected ${B}`); };
async function rejects(p, check, msg) {
  try { await p; } catch (e) { if (check) check(e); return e; }
  throw new Error(msg || 'expected a rejection');
}
function throws(fn, check, msg) {
  try { fn(); } catch (e) { if (check) check(e); return e; }
  throw new Error(msg || 'expected an exception');
}

/* ---------------------------------------------------------------- fake Supabase client */
function fakeClient(handler) {
  const calls = [];
  const respond = call => Promise.resolve().then(() => handler ? handler(call) : undefined).then(r => r || { data: call.op === 'select' && !call.single && !call.maybeSingle ? [] : null, error: null, status: 200 });
  const from = table => {
    const call = { table, op: null, select: null, values: null, filters: [], order: null, limit: null, single: false, maybeSingle: false };
    const b = {
      select(cols) { if (call.op === null) call.op = 'select'; call.select = cols; return b; },
      insert(v) { call.op = 'insert'; call.values = v; return b; },
      update(v) { call.op = 'update'; call.values = v; return b; },
      upsert(v) { call.op = 'upsert'; call.values = v; return b; },
      delete() { call.op = 'delete'; return b; },
      eq(k, v) { call.filters.push(['eq', k, v]); return b; },
      neq(k, v) { call.filters.push(['neq', k, v]); return b; },
      in(k, v) { call.filters.push(['in', k, v]); return b; },
      order(c, o) { call.order = [c, o && o.ascending]; return b; },
      limit(n) { call.limit = n; return b; },
      single() { call.single = true; return b; },
      maybeSingle() { call.maybeSingle = true; return b; },
      then(res, rej) { calls.push(call); return respond(call).then(res, rej); }
    };
    return b;
  };
  const client = {
    calls, session: null,
    from,
    rpc(fn, args) { const call = { op: 'rpc', fn, args }; calls.push(call); return respond(call); },
    auth: {
      async getSession() { return { data: { session: client.session }, error: null }; },
      async signInWithOtp(a) { calls.push({ op: 'otp', args: a }); return { data: {}, error: null }; },
      async signOut() { calls.push({ op: 'signout' }); return { error: null }; },
      onAuthStateChange(cb) { client._authCb = cb; return { data: { subscription: { unsubscribe() { client._authCb = null; } } } }; }
    }
  };
  return client;
}
const writes = c => c.calls.filter(x => ['insert', 'update', 'upsert', 'delete'].includes(x.op));

/* ---------------------------------------------------------------- load the browser files in a VM */
function load({ client, readyState = 'complete', noClient = false } = {}) {
  const listeners = {};
  const spy = { createClient: 0 };
  const document = { readyState, addEventListener(ev, cb) { (listeners[ev] = listeners[ev] || []).push(cb); } };
  const window = { supabase: { createClient() { spy.createClient++; throw new Error('createClient must not be called by the adapter'); } } };
  if (!noClient) window.GH_SUPABASE = client || fakeClient();
  const ctx = vm.createContext({ window, document, location: { origin: 'https://gearhead.example', pathname: '/' }, console, setTimeout, clearTimeout });
  vm.runInContext(MODELS, ctx, { filename: 'models.js' });
  vm.runInContext(FOUNDATION, ctx, { filename: 'foundation.js' });
  return { M: window.GHP.models, F: window.GHP.adapters.foundation, window, spy, fire: ev => (listeners[ev] || []).forEach(f => f()) };
}
async function ready(handler) {
  const client = fakeClient(handler);
  const env = load({ client });
  const A = await env.F.create();
  client.calls.length = 0;   // forget the provisioning probe
  return { ...env, A, client };
}
const U1 = '11111111-1111-4111-8111-111111111111', U2 = '22222222-2222-4222-8222-222222222222', U3 = '33333333-3333-4333-8333-333333333333';
const pgErr = (code, message, status) => () => ({ data: null, error: { code, message: message || code, details: null, hint: null }, status: status || 400 });

/* ---------------------------------------------------------------- static scans */
function frontendFiles() {
  const out = execFileSync('git', ['-C', REPO, 'ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\n');
  return out.filter(f => f && /\.(js|html|css)$/.test(f) && fs.existsSync(path.join(REPO, f))
    && !/^(premium-foundation|supabase|docs|node_modules)\//.test(f) && !/(^|\/)node_modules\//.test(f) && !f.startsWith('premium/tests/'));
}
const FILES = frontendFiles();
const contents = Object.fromEntries(FILES.map(f => [f, read(f)]));
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  await test('scan covers the frontend (root pages and scripts, premium/)', () => {
    for (const f of ['index.html', 'app-shell.js', 'supabase-boot.js', 'supabase-config.js', 'premium/models.js', 'premium/adapters/foundation.js', 'premium/services.js'])
      assert(FILES.includes(f), f + ' not scanned');
  });

  // 1
  await test('1. createClient() exists exactly once in the whole frontend: supabase-boot.js', () => {
    eq(FILES.filter(f => /\bcreateClient\s*\(/.test(stripComments(contents[f]))), ['supabase-boot.js'], 'createClient call sites');
    eq((stripComments(contents['supabase-boot.js']).match(/\bcreateClient\s*\(/g) || []).length, 1, 'calls in supabase-boot.js');
    assert(!fs.existsSync(path.join(REPO, 'premium/adapters/supabase.js')), 'obsolete Phase 3A adapter still present');
  });
  // 2
  await test('2. foundation.js never calls createClient or loads the SDK (static + runtime spy)', async () => {
    assert(!/createClient/.test(FOUNDATION), 'createClient text present');
    assert(!/createElement\(\s*['"]script/.test(FOUNDATION) && !/cdn\.|jsdelivr|unpkg|supabase-js|import\(/.test(FOUNDATION), 'SDK loading code present');
    const { A, spy, client } = await ready();
    client.session = { user: { id: U1, email: 'a@x.test' } };
    await A.tables.machines.list(); await A.entitlement.mine(); await A.auth.getUser();
    eq(spy.createClient, 0, 'createClient calls');
  });
  // 3-5
  await test('3. no service_role anywhere in the frontend', () => {
    eq(FILES.filter(f => /service_role/i.test(contents[f])), [], 'files');
    assert(!/service.?role/i.test(FOUNDATION + MODELS), 'new files mention the service role');
  });
  await test('4. no sb_secret anywhere in the frontend', () => eq(FILES.filter(f => /sb_secret/i.test(contents[f])), [], 'files'));
  await test('5. no database password or credential-shaped values in the frontend; new files hold no key at all', () => {
    const bad = /postgres(ql)?:\/\/[^\s'"]*:[^\s'"@]+@|SUPABASE_DB_PASSWORD|\bDB_PASSWORD\b|\bPGPASSWORD\b|password\s*[:=]\s*['"][^'"]+['"]|eyJhbGciOi/i;
    eq(FILES.filter(f => bad.test(contents[f])), [], 'files with credential-shaped content');
    for (const [n, src] of [['foundation.js', FOUNDATION], ['models.js', MODELS]])
      assert(!/password|sb_publishable_|anonKey|publishableKey|apikey|eyJ[A-Za-z0-9_-]{10,}/i.test(src), n + ' contains key/password material');
    eq(FILES.filter(f => /sb_publishable_/.test(contents[f])), ['supabase-config.js'], 'the public key lives only in the generated config');
  });
  // 6
  await test('6. no wildcard select anywhere in the new code, and none sent at runtime', async () => {
    const star = /\.select\(\s*(['"`])\s*\*\s*\1\s*\)/;
    assert(!star.test(FOUNDATION) && !star.test(MODELS), 'wildcard select in new code');
    eq(FILES.filter(f => star.test(contents[f])), [], 'wildcard select in the frontend');
    const { A, M, client } = await ready();
    for (const t of Object.keys(M.TABLES)) await A.tables[t].list();
    assert(client.calls.every(c => c.op !== 'select' || (typeof c.select === 'string' && !c.select.includes('*'))), 'a wildcard select was sent');
  });
  // 7
  await test('7. server-controlled columns cannot be submitted (models and adapter; nothing reaches the client)', async () => {
    const { A, M, client } = await ready();
    eq([...M.SERVER_CONTROLLED].sort(), ['account_id', 'baseline_pinned_at', 'created_at', 'deleted_at', 'id', 'owner_id', 'result_trust', 'updated_at'], 'server-controlled list');
    for (const [t, c] of Object.entries(M.TABLES)) {
      for (const col of [...c.insert, ...c.update]) assert(!M.SERVER_CONTROLLED.includes(col), `${t}.${col} whitelisted`);
      for (const col of M.SERVER_CONTROLLED) {
        if (c.insert.length) await rejects(A.tables[t].insert({ [col]: U1 }), e => eq(e.code, 'server_controlled', `${t} insert ${col}`));
        if (c.update.length) await rejects(A.tables[t].update(U1, { [col]: U1 }), e => eq(e.code, 'server_controlled', `${t} update ${col}`));
      }
    }
    await rejects(A.tables.machines.insert({ garage_id: U1, name: 'x', machine_type: 'automotive', colour: 'red' }), e => eq(e.code, 'not_writable', 'unknown column'));
    await rejects(A.tables.profiles.update(U1, { favorite_machine_id: U2 }), e => eq(e.code, 'not_writable', 'favorite_machine_id is not a client source of truth'));
    eq(writes(client), [], 'writes reached the client');
  });
  // 8
  await test('8. protected tables cannot be written; billing/webhook tables are unreachable; no raw client passthrough', async () => {
    const { A, M } = await ready();
    eq([...M.PROTECTED_TABLES].sort(), ['billing_customers', 'calculation_records', 'entitlement_grants', 'plan_prices', 'plans', 'stripe_events', 'subscriptions', 'value_records'], 'protected list');
    for (const t of M.PROTECTED_TABLES) {
      if (!A.tables[t]) { assert(['billing_customers', 'stripe_events'].includes(t), t + ' missing'); continue; }
      for (const m of ['insert', 'update', 'softDelete', 'upsert', 'delete']) assert(A.tables[t][m] === undefined, `${t}.${m} exists`);
      throws(() => M.prepareInsert(t, {}), e => eq(e.code, 'forbidden_write', t));
      throws(() => M.prepareUpdate(t, {}), e => eq(e.code, 'forbidden_write', t));
    }
    assert(!('billing_customers' in A.tables) && !('stripe_events' in A.tables) && !('accounts' in A.tables), 'server-only table exposed');
    for (const k of ['client', 'from', 'rpc', 'supabase', 'raw']) assert(!(k in A), 'adapter exposes ' + k);
    for (const t of Object.values(A.tables)) for (const m of ['upsert', 'delete', 'from', 'rpc']) assert(!(m in t), 'table exposes ' + m);
    throws(() => { A.tables.value_records.insert = () => {}; if (A.tables.value_records.insert) throw new Error('mutable'); }, null, 'table api must be frozen');
  });
  // 9
  await test('9. marine values and marine columns are rejected before any request', async () => {
    const { A, M, client } = await ready();
    assert(!M.enumValues('machine_type').includes('marine'), 'marine offered');
    await rejects(A.tables.machines.insert({ garage_id: U1, name: 'Boat', machine_type: 'marine' }), e => eq(e.code, 'marine_blocked', 'insert'));
    await rejects(A.tables.machines.update(U1, { machine_type: 'marine' }), e => eq(e.code, 'marine_blocked', 'update'));
    await rejects(A.tables.machines.insert({ garage_id: U1, name: 'x', machine_type: 'automotive', propulsion: 'outboard' }), e => eq(e.code, 'marine_blocked', 'propulsion'));
    await rejects(A.tables.machines.update(U1, { marine_type: 'pwc' }), e => eq(e.code, 'marine_blocked', 'marine_type'));
    eq(writes(client), [], 'writes');
  });
  // 10
  await test('10. invalid enum values are rejected (machine type, power source, experience, units, component kind)', async () => {
    const { A, client } = await ready();
    const bad = [
      () => A.tables.machines.insert({ garage_id: U1, name: 'x', machine_type: 'truck' }),
      () => A.tables.machines.insert({ garage_id: U1, name: 'x', machine_type: 'automotive', power_source: 'nitro' }),
      () => A.tables.profiles.update(U1, { experience_level: 'Expert' }),
      () => A.tables.profiles.update(U1, { preferred_unit_system: 'si' }),
      () => A.tables.profiles.update(U1, { preferred_unit_system: null }),
      () => A.tables.components.insert({ machine_id: U1, kind: 'turbo' }),
      () => A.tables.engineering_analyses.insert({ analyzer_id: 'e01_turbo_compressor_map', analyzer_version: 'E1-AUTO', title: 't', inputs: {}, inputs_unit_system: 'si' }),
      () => A.tables.engineering_analyses.insert({ analyzer_id: 'e15_marine_propeller', analyzer_version: 'E1-AUTO', title: 't', inputs: {}, inputs_unit_system: 'metric' })
    ];
    for (const f of bad) await rejects(f(), e => eq(e.code, 'invalid', 'code ' + f.toString().slice(6, 90)));
    eq(writes(client), [], 'writes');
  });
  // 11
  await test('11. entitlement response maps to the view model (free, premium, trial, malformed); signed-out makes no call', async () => {
    const { M } = load();
    const free = M.entitlementFromRpc([{ plan_key: 'free', is_premium: false, features: [], source: null, ends_at: null }]);
    eq({ ...free }, { signedIn: true, plan: 'free', isPremium: false, features: [], source: null, endsAt: null, isTrial: false }, 'free');
    const prem = M.entitlementFromRpc([{ plan_key: 'premium', is_premium: true, features: ['saved_calculations', 'engineering_lab', 'garage_unlimited', 'bogus'], source: 'manual', ends_at: null }]);
    eq([prem.plan, prem.isPremium, [...prem.features], prem.source, prem.isTrial], ['premium', true, ['engineering_lab', 'garage_unlimited', 'saved_calculations'], 'manual', false], 'premium');
    const trial = M.entitlementFromRpc({ plan_key: 'premium', is_premium: true, features: ['engineering_lab'], source: 'trial', ends_at: '2099-01-01T00:00:00Z' });
    eq([trial.isTrial, trial.endsAt, M.planLabel(trial)], [true, '2099-01-01T00:00:00.000Z', 'Premium (trial)'], 'trial grant');
    eq(M.planLabel(prem, M.subscriptionView({ stripe_subscription_id: 'sub_1', status: 'trialing' })), 'Premium (trial)', 'Stripe trialing');
    for (const junk of [[], null, undefined, 'x', [{}], [{ plan_key: 'premium', is_premium: 'yes' }], [{ plan_key: 'free', is_premium: true, features: ['engineering_lab'] }], [{ is_premium: true }]])
      eq(M.entitlementFromRpc(junk).isPremium, false, 'fails closed for ' + JSON.stringify(junk));
    eq(M.entitlementFromRpc([{ plan_key: 'premium', is_premium: true, features: [], source: 'hack' }]).source, null, 'unknown source');
    assert(M.canAddMachine(free, 0) && !M.canAddMachine(free, 1) && M.canAddMachine(prem, 5) && !M.canAddMachine(trial, 1), 'machine allowance helper');
    const env = await ready(c => c.op === 'rpc' ? { data: [{ plan_key: 'premium', is_premium: true, features: ['engineering_lab'], source: 'stripe', ends_at: null }], error: null } : undefined);
    eq((await env.A.entitlement.mine()).signedIn, false, 'anonymous');
    eq(env.client.calls.filter(c => c.op === 'rpc').length, 0, 'no rpc while signed out');
    env.client.session = { user: { id: U1, email: 'a@x.test' } };
    const mine = await env.A.entitlement.mine();
    eq([mine.isPremium, mine.source], [true, 'stripe'], 'signed in');
    eq(env.client.calls.filter(c => c.op === 'rpc').map(c => [c.fn, c.args]), [['pf_my_entitlement', undefined]], 'rpc call');
  });
  // 12-17 (+ session / network)
  const ALLOWANCE = 'new row violates row-level security policy "pf_machines_free_allowance" for table "machines"';
  await test('12. 42501 naming pf_machines_free_allowance -> Free includes 1 vehicle + upgrade (and a plain 42501 -> not allowed)', async () => {
    const { A } = await ready(pgErr('42501', ALLOWANCE, 403));
    const e = await rejects(A.tables.machines.insert({ garage_id: U1, name: 'Second', machine_type: 'automotive' }));
    eq([e.kind, e.upgrade, e.message], ['free_machine_limit', true, 'Free includes 1 vehicle. Upgrade to Gearhead Labs Premium to add more.'], 'mapped');
    const { M } = load();
    const f = M.mapError({ code: '42501', message: 'new row violates row-level security policy for table "engineering_analyses"' });
    eq([f.kind, f.upgrade], ['forbidden', false], 'plain 42501');
    eq(M.mapError({ code: '42501', message: 'permission denied for table plans' }, { status: 401 }).kind, 'forbidden', '42501 with HTTP 401 is a permission error, not an expired session');
  });
  await test('13. 23505 -> already exists, retry', async () => {
    const { A } = await ready(pgErr('23505', 'duplicate key value violates unique constraint'));
    const e = await rejects(A.tables.test_setups.insert({ machine_id: U1, name: 'Street' }));
    eq([e.kind, e.retry], ['conflict', true], 'mapped');
  });
  await test('14. 23503 -> linked item not found', async () => {
    const { A } = await ready(pgErr('23503', 'insert or update on table violates foreign key constraint'));
    eq((await rejects(A.tables.test_setups.insert({ machine_id: U1, name: 'Street' }))).kind, 'link_not_found', 'mapped');
  });
  await test('15. 23514 -> invalid value', async () => {
    const { A } = await ready(pgErr('23514', 'new row violates check constraint'));
    eq((await rejects(A.tables.machine_details.update(U1, { notes: 'x' }))).kind, 'invalid', 'mapped');
  });
  await test('16. P0001 -> can’t be changed', async () => {
    const { A } = await ready(pgErr('P0001', 'PF_IMMUTABLE: ...'));
    eq((await rejects(A.tables.engineering_analyses.update(U1, { title: 'x' }))).kind, 'immutable', 'mapped');
  });
  await test('17. P0002 -> not found; PGRST116 -> no rows', async () => {
    const { A } = await ready(pgErr('P0002', 'PF_NOT_FOUND: no active saved calculation owned by the caller'));
    eq((await rejects(A.tables.saved_calculations.softDelete(U1))).kind, 'not_found', 'P0002');
    const { M } = load();
    eq(M.mapError({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, { status: 406 }).kind, 'no_rows', 'PGRST116');
  });
  await test('session expiry (401 / PGRST301) and network failures map correctly', async () => {
    const { M } = load();
    const s = M.mapError({ code: 'PGRST301', message: 'JWT expired' }, { status: 401 });
    eq([s.kind, s.sessionExpired], ['session_expired', true], 'PGRST301');
    eq(M.mapError({ message: 'Unauthorized', status: 401 }).kind, 'session_expired', 'bare 401');
    let probed = false;
    const { A } = await ready(() => { if (!probed) { probed = true; return undefined; } throw new TypeError('Failed to fetch'); });
    const n = await rejects(A.tables.machines.list());
    eq([n.kind, n.retry], ['network', true], 'thrown fetch error');
    eq(M.mapError({ message: 'TypeError: Failed to fetch', code: '' }, { status: 0 }).kind, 'network', 'supabase-js network shape');
    eq(M.mapError({ code: 'XX000', message: 'boom' }).kind, 'unknown', 'unknown');
  });
  // 18
  await test('18. PGRST205 / 42P01 (schema not provisioned) -> no-backend: create() rejects with noBackend; runtime marks the adapter unavailable', async () => {
    for (const code of ['PGRST205', '42P01']) {
      const env = load({ client: fakeClient(pgErr(code, 'relation does not exist', 404)) });
      const e = await rejects(env.F.create());
      eq([e.kind, e.noBackend], ['not_provisioned', true], code);
    }
    const missing = load({ noClient: true });
    eq((await rejects(missing.F.create())).noBackend, true, 'no bootstrap client');
    let probe = true;
    const env = await ready(c => { if (probe) { probe = false; return undefined; } return pgErr('42P01', 'relation "public.machines" does not exist', 404)(); });
    let fired = 0; env.A.onUnavailable(() => fired++);
    eq((await rejects(env.A.tables.machines.list())).noBackend, true, 'runtime noBackend');
    eq([env.A.status, fired], ['not_provisioned', 1], 'status + listener');
    const anonProvisioned = load({ client: fakeClient(pgErr('42501', 'permission denied for table plans', 401)) });
    assert(await anonProvisioned.F.create(), 'a signed-out visitor on a provisioned database is not "no backend"');
  });
  // 19
  await test('19. a zero-row update is reported as not-found (never as success)', async () => {
    const { A, client } = await ready(c => c.op === 'update' ? { data: [], error: null, status: 200 } : undefined);
    const e = await rejects(A.tables.test_setups.update(U1, { name: 'Renamed' }));
    eq(e.kind, 'not_found', 'kind');
    const u = client.calls.find(c => c.op === 'update');
    eq([u.table, u.values, u.filters, u.select], ['test_setups', { name: 'Renamed' }, [['eq', 'id', U1]], 'id,machine_id,name,description,notes,baseline_pinned_at,created_at,updated_at'], 'request shape');
  });
  // 20
  await test('20. RPC names are exactly the approved set (static + runtime)', async () => {
    const APPROVED = ['df_soft_delete_component', 'df_soft_delete_garage', 'df_soft_delete_machine', 'gf_repin_test_setup_baseline',
      'gf_soft_delete_test_setup', 'pf_my_entitlement', 'pf_soft_delete_engineering_analysis', 'pf_soft_delete_saved_calculation'];
    const { A, M, client } = await ready();
    const allNames = o => Object.values(o).flatMap(v => typeof v === 'string' ? [v] : allNames(v));
    eq(allNames(M.RPC).sort(), APPROVED, 'every RPC name in models');
    eq(Object.keys(M.RPC).sort(), ['myEntitlement', 'repinTestSetupBaseline', 'softDelete'], 'RPC map keys');
    assert(!/\.rpc\(\s*['"`]/.test(FOUNDATION), 'foundation.js names an RPC literally instead of using models RPC');
    client.session = { user: { id: U1, email: 'a@x.test' } };
    for (const t of Object.values(A.tables)) if (t.softDelete) await t.softDelete(U1);
    await A.testSetups.repinBaseline(U1); await A.entitlement.mine();
    eq([...new Set(client.calls.filter(c => c.op === 'rpc').map(c => c.fn))].sort(), APPROVED, 'runtime RPCs');
    assert(client.calls.filter(c => c.op === 'rpc' && c.fn !== 'pf_my_entitlement').every(c => JSON.stringify(Object.keys(c.args)) === '["p_id"]' && c.args.p_id === U1), 'rpc args');
    await rejects(A.tables.machines.softDelete('not-a-uuid'), e => eq(e.code, 'invalid', 'bad id'));
  });
  // 21
  await test('21. explicit select column lists on every read (list, get, insert/update returning)', async () => {
    const { A, M, client } = await ready(c => (c.op === 'insert') ? { data: { ok: 1 }, error: null } : c.op === 'update' ? { data: [{ ok: 1 }], error: null } : undefined);
    for (const [t, c] of Object.entries(M.TABLES)) {
      await A.tables[t].list();
      const key = t === 'engineering_analyzers' ? 'e01_turbo_compressor_map' : ['plans', 'plan_prices', 'subscriptions'].includes(t) ? 'premium' : U1;
      await A.tables[t].get(key);
      assert(c.select.length > 0 && c.select.every(col => /^[a-z_]+$/.test(col)), t + ' select list');
    }
    await A.tables.test_setups.insert({ machine_id: U1, name: 'Street' });
    await A.tables.test_setups.update(U1, { notes: 'n' });
    for (const call of client.calls.filter(c => c.table)) eq(call.select, M.TABLES[call.table].select.join(','), `${call.table} ${call.op} select`);
    eq(M.TABLES.entitlement_grants.select.includes('note'), false, 'operator note never selected');
    const sel = client.calls.find(c => c.table === 'saved_calculations' && c.op === 'select' && !c.maybeSingle);
    eq([sel.order, sel.limit], [['created_at', false], 500], 'ordering and limit');
    await rejects(A.tables.machines.list({ owner_id: U1 }), e => eq(e.code, 'not_filterable', 'arbitrary filter column'));
    await rejects(A.tables.machines.list({ garage_id: "1' or 1=1" }), e => eq(e.code, 'invalid', 'malformed filter value'));
  });
  // 22
  await test('22. saved-calculation CREATE is impossible through the client adapter', async () => {
    const { A, M, client } = await ready();
    eq(M.TABLES.saved_calculations.insert, [], 'insert whitelist');
    eq(A.tables.saved_calculations.insert, undefined, 'insert method');
    eq(A.capabilities.savedCalculationCreate, false, 'capability');
    throws(() => M.prepareInsert('saved_calculations', { title: 'x', calculation_id: U1 }), e => eq(e.code, 'forbidden_write', 'prepareInsert'));
    for (const fn of ['list', 'get', 'update', 'softDelete']) eq(typeof A.tables.saved_calculations[fn], 'function', fn + ' available');
    await A.tables.saved_calculations.list({ pinned: true });
    eq(writes(client).filter(c => c.table === 'saved_calculations' && c.op !== 'update'), [], 'create requests');
  });
  // 23
  await test('23. calculation_records / value_records cannot be written through the adapter', async () => {
    const { A, M } = await ready();
    for (const t of ['calculation_records', 'value_records']) {
      eq([M.TABLES[t].insert, M.TABLES[t].update, M.TABLES[t].softDelete], [[], [], null], t + ' contract');
      eq(Object.keys(A.tables[t]).sort(), ['columns', 'get', 'list', 'name'], t + ' api');
      throws(() => M.prepareInsert(t, { machine_id: U1 }), e => eq(e.code, 'forbidden_write', t));
    }
    assert(!/calculation_records['"`]?\s*\)\s*\.(insert|update|upsert)|value_records['"`]?\s*\)\s*\.(insert|update|upsert)/.test(FOUNDATION), 'literal write to protected table');
  });
  // 24
  await test('24. setting the primary machine is ONE write; no client-side clearing loop', async () => {
    assert(!/is_primary\s*:\s*false/.test(FOUNDATION), 'foundation.js clears is_primary');
    const a = await ready(c => c.op === 'update' ? { data: [{ machine_id: U2, is_primary: true }], error: null } : undefined);
    await a.A.machines.setPrimary(U2);
    eq(writes(a.client).map(c => [c.table, c.op, c.values, c.filters]), [['machine_details', 'update', { is_primary: true }, [['eq', 'machine_id', U2]]]], 'existing details');
    const b = await ready(c => c.op === 'update' ? { data: [], error: null } : c.op === 'insert' ? { data: { machine_id: U3, is_primary: true }, error: null } : undefined);
    await b.A.machines.setPrimary(U3);
    eq(writes(b.client).map(c => [c.table, c.op, c.values]), [['machine_details', 'update', { is_primary: true }], ['machine_details', 'insert', { machine_id: U3, is_primary: true }]], 'no details row yet');
    assert(writes(a.client).concat(writes(b.client)).every(c => !c.values || c.values.is_primary !== false), 'a clearing write was sent');
  });

  /* ---------------------------------------------------------------- additional behaviour */
  await test('models contracts are frozen (whitelists cannot be widened at runtime)', () => {
    const { M } = load();
    throws(() => { 'use strict'; M.TABLES.machines.insert.push('owner_id'); });
    throws(() => { 'use strict'; M.SERVER_CONTROLLED.pop(); });
    throws(() => { 'use strict'; M.TABLES.saved_calculations.insert = ['title']; });
    eq(M.TABLES.machines.insert.includes('owner_id'), false, 'still excluded');
    eq(M.ANALYZER_IDS.has('e01_turbo_compressor_map') && M.ANALYZER_IDS.size, 14, 'analyzer set');
    assert(typeof M.ANALYZER_IDS.add !== 'function', 'analyzer set is mutable');
  });
  await test('validation mirrors the CHECK constraints (lengths in characters, years, https avatar, JSON size, blanks)', () => {
    const { M } = load();
    const d = v => () => M.prepareInsert('machine_details', Object.assign({ machine_id: U1 }, v));
    throws(d({ make: 'x'.repeat(61) }), e => eq(e.code, 'invalid'));
    eq(M.prepareInsert('machine_details', { machine_id: U1, make: '\u{1F697}'.repeat(60) }).make.length, 120, '60 astral characters are 60 characters');
    throws(d({ model_year: 1885 })); throws(d({ model_year: 2101 })); throws(d({ model_year: 2019.5 }));
    eq(M.prepareInsert('machine_details', { machine_id: U1, model_year: '2019', make: '  ', notes: '' }), { machine_id: U1, model_year: 2019, make: null, notes: null }, 'blank text becomes null');
    throws(d({ notes: 'n'.repeat(2001) }));
    throws(() => M.prepareUpdate('profiles', { avatar_url: 'http://x.test/a.png' }));
    throws(() => M.prepareUpdate('profiles', { avatar_url: 'javascript:alert(1)' }));
    throws(() => M.prepareInsert('machines', { garage_id: U1, name: '   ', machine_type: 'automotive' }), e => eq(Object.keys(e.errors), ['name']));
    throws(() => M.prepareUpdate('saved_calculations', { title: 't'.repeat(121) }));
    throws(() => M.prepareInsert('engineering_analyses', { analyzer_id: 'e01_turbo_compressor_map', analyzer_version: 'E1-AUTO', title: 't', inputs: [1, 2], inputs_unit_system: 'metric' }));
    throws(() => M.prepareInsert('engineering_analyses', { analyzer_id: 'e01_turbo_compressor_map', analyzer_version: 'E1-AUTO', title: 't', inputs: { blob: 'x'.repeat(70000) }, inputs_unit_system: 'metric' }), e => assert(/64 KB/.test(e.message)));
    throws(() => M.prepareUpdate('test_setups', {}), e => eq(e.message, 'Nothing to change.'));
    throws(() => M.prepareInsert('machines', { garage_id: 'nope', name: 'x', machine_type: 'automotive' }));
  });
  await test('Phase 3A values map accurately or are preserved as text (owner decisions 2-4)', () => {
    const { M } = load();
    const v = M.fromPhase3aVehicle({ year: 2019, make: 'Ford', model: 'F-150', trim: 'XLT', vehicle_type: 'Truck', fuel_type: 'E85 / Flex Fuel',
      drivetrain: '4WD', engine: '5.0L Coyote V8', transmission: 'Automatic', notes: 'Daily driver', is_primary: true });
    eq(v.machine, { name: '2019 Ford F-150 XLT', machine_type: 'automotive', power_source: 'other', is_hypothetical: false }, 'machine');
    eq(v.details.notes, 'Daily driver\nBody style: Truck\nFuel: E85 / flex fuel\nDrivetrain: 4WD', 'notes keep what has no column');
    eq(v.components, [{ kind: 'engine', label: '5.0L Coyote V8' }, { kind: 'transmission', label: 'Automatic' }], 'components');
    eq([M.fromPhase3aVehicle({ vehicle_type: 'Car', fuel_type: 'Gasoline' }).machine.machine_type, M.fromPhase3aVehicle({ vehicle_type: 'Car', fuel_type: 'Gasoline' }).details.notes], ['automotive', null], 'exact mapping adds nothing');
    eq(M.fromPhase3aVehicle({ vehicle_type: 'Off-Road' }).machine.machine_type, 'other_custom', 'Off-Road is not guessed');
    eq(M.fromPhase3aVehicle({ vehicle_type: 'Hovercraft' }).details.notes, 'Vehicle type: Hovercraft', 'unknown type preserved');
    eq(M.fromPhase3aVehicle({ vehicle_type: 'Motorcycle', fuel_type: 'Plug-in Hybrid' }).machine, { name: 'My vehicle', machine_type: 'motorcycle', power_source: 'hybrid', is_hypothetical: false }, 'motorcycle / PHEV');
    eq(M.fromPhase3aBuild({ name: 'Street', status: 'Street/Strip', goals: '11s quarter', description: 'Bolt-ons', notes: 'Cam next' }),
      { name: 'Street', description: 'Bolt-ons\nGoals: 11s quarter', notes: 'Cam next\nBuild status: Street/Strip' }, 'build -> test setup');
    for (const x of [v.machine, v.details]) assert(!Object.keys(x).some(k => M.SERVER_CONTROLLED.includes(k) || M.MARINE_COLUMNS.includes(k)), 'mapping emits forbidden column');
  });
  await test('garage.ensure: one active garage; a concurrent-create conflict re-selects instead of failing', async () => {
    let lists = 0;
    const { A, client } = await ready(c => {
      if (c.table === 'garages' && c.op === 'select') return { data: lists++ === 0 ? [] : [{ id: U1, name: 'My Garage' }], error: null };
      if (c.table === 'garages' && c.op === 'insert') return pgErr('23505', 'duplicate key value violates unique constraint "garages_one_active_per_owner"')();
    });
    eq((await A.garage.ensure()).id, U1, 'garage');
    eq(client.calls.map(c => c.op), ['select', 'insert', 'select'], 'sequence');
  });
  await test('engineering analyses: version pinned from the catalog; Phase 3A field names are not accepted', async () => {
    const { A, client } = await ready(c => c.table === 'engineering_analyzers' ? { data: { analyzer_id: 'e12_radiator_heat_rejection', analyzer_version: 'E1-AUTO' }, error: null }
      : c.op === 'insert' ? { data: { id: U2 }, error: null } : undefined);
    await A.analyses.create({ analyzer_id: 'e12_radiator_heat_rejection', title: 'Radiator', inputs: { fields: {} }, inputs_unit_system: 'imperial', machine_id: U1 });
    eq(writes(client)[0].values, { analyzer_id: 'e12_radiator_heat_rejection', analyzer_version: 'E1-AUTO', machine_id: U1, title: 'Radiator', inputs: { fields: {} }, inputs_unit_system: 'imperial' }, 'insert row');
    await rejects(A.analyses.create({ analyzer_id: 'e12_radiator_heat_rejection', name: 'x', input_data: {} }), e => eq(e.code, 'not_writable', 'legacy names'));
  });
  await test('auth: magic link via the single client, input checked first, session mapped, listener unsubscribes', async () => {
    const { A, client } = await ready();
    eq(await A.auth.getUser(), null, 'signed out');
    await rejects(A.auth.signIn({ email: 'not-an-email' }), e => eq(e.code, 'invalid', 'bad email'));
    eq(client.calls.filter(c => c.op === 'otp').length, 0, 'no OTP for a bad email');
    eq(await A.auth.signIn({ email: ' Driver@Example.TEST ' }), { pendingVerification: true }, 'otp result');
    eq(client.calls.find(c => c.op === 'otp').args, { email: 'driver@example.test', options: { emailRedirectTo: 'https://gearhead.example/' } }, 'otp args');
    const seen = []; const off = A.auth.onChange((u, ev) => seen.push([u && u.id, ev]));
    client._authCb('SIGNED_IN', { user: { id: U1, email: 'driver@example.test', role: 'authenticated' } }); client._authCb('SIGNED_OUT', null);
    eq(seen, [[U1, 'SIGNED_IN'], [null, 'SIGNED_OUT']], 'events'); off(); eq(client._authCb, null, 'unsubscribed');
    await A.auth.signOut(); eq(client.calls.filter(c => c.op === 'signout').length, 1, 'sign out');
  });
  await test('create() waits for DOMContentLoaded so the bootstrap client exists first', async () => {
    const client = fakeClient();
    const env = load({ client, readyState: 'loading' });
    let done = false; const p = env.F.create().then(a => { done = true; return a; });
    await new Promise(r => setTimeout(r, 20));
    eq([done, client.calls.length], [false, 0], 'nothing before DOMContentLoaded');
    env.fire('DOMContentLoaded'); await p; eq(done, true, 'resolved after the event');
  });
  /* ---------------------------------------------------------------- steps 3-5: legacy removal and static rules */
  const LIVE = ['premium/services.js', 'premium/shell.js', 'premium/engineering-bridge.js', 'premium/adapters/dev-local.js', 'premium/adapters/foundation.js', 'premium/models.js'];
  await test('deprecated Phase 3A model names are gone, and every GHP.models name the live files read exists', () => {
    const { M } = load();
    for (const n of ['legacy', 'PLANS', 'ENTITLEMENT_STATUSES', 'PREMIUM_FEATURES', 'VEHICLE_TYPES', 'FUEL_TYPES', 'DRIVETRAINS', 'TRANSMISSIONS',
      'BUILD_STATUSES', 'PROJECT_STATUSES', 'EXPERIENCE_LEVELS', 'UNIT_SYSTEMS', 'SCHEMAS', 'validate', 'evaluateEntitlement']) assert(!(n in M), 'still exported: ' + n);
    for (const f of LIVE) for (const m of read(f).matchAll(/\bM\.([A-Za-z_]+)/g)) assert(M[m[1]] !== undefined, `${f} reads missing M.${m[1]}`);
  });
  await test('no frontend file references Phase 3A tables, fields, entitlement logic or Projects', () => {
    const bad = /['"`](vehicles|builds|projects|entitlements)['"`]|\b(vehicle_id|build_id|project_id|favorite_vehicle_id|favorite_build_id)\b|\bR\.(vehicles|builds|projects|profiles)\b|\bProjects?\b|data-[a-z-]*project|0001_premium_schema/;
    const bad3a = /evaluateEntitlement|PREMIUM_TRIAL|\.from\(\s*['"`]entitlements['"`]|getForUser|saved_analyses|provider_customer_id/;
    eq(FILES.filter(f => bad3a.test(contents[f])), [], 'Phase 3A entitlement logic');
    const hits = FILES.filter(f => !/^(F1_|E1_)/.test(f) && bad.test(contents[f]));
    eq(hits, [], 'files');
  });
  await test('the Supabase client is touched only by supabase-boot.js (creates it) and foundation.js (uses it), in every frontend file', () => {
    const touch = FILES.filter(f => /\bGH_SUPABASE\b|window\.supabase\b/.test(stripComments(contents[f])));
    eq(touch.sort(), ['premium/adapters/foundation.js', 'supabase-boot.js'], 'files touching the client');
    assert(!/window\.supabase\b/.test(stripComments(FOUNDATION)), 'foundation.js reaches for the library instead of the bootstrap client');
  });
  await test('live premium code: no client creation, no obsolete adapter, no hard deletes, no raw table access', () => {
    for (const f of LIVE) {
      const src = stripComments(read(f));
      assert(!/createClient/.test(src), f + ': createClient');
      assert(!/adapters\.supabase\b|GH_SUPABASE/.test(src) || f === 'premium/adapters/foundation.js', f + ': touches the bootstrap client or the obsolete adapter');
      assert(!/\.delete\(\s*\)|\.upsert\(/.test(src), f + ': hard delete / upsert');
      assert(!/\.from\(/.test(src) || f === 'premium/adapters/foundation.js', f + ': raw table access');
      assert(!/\.select\(\s*['"`]\s*\*/.test(src), f + ': wildcard select');
    }
    assert(!/\bcreate\s*\(|\binsert\b/.test(read('premium/services.js').split('const savedCalculations = {')[1].split('const billing = {')[0]), 'savedCalculations repository has a create/insert path');
  });

  await test('index.html: one pinned + SRI-checked supabase-js, then config, boot, models, foundation, app files; F1.12.4 frame', () => {
    const html = read('index.html');
    const scripts = [...html.matchAll(/<script\b([^>]*)>\s*<\/script>/g)].map(m => m[1]);
    const srcs = scripts.map(a => (a.match(/\bsrc="([^"]+)"/) || [])[1]);
    eq(srcs.map(s => s.replace(/\?v=[^"]*$/, '')), ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js', 'supabase-config.js', 'supabase-boot.js',
      'premium/models.js', 'premium/adapters/foundation.js', 'premium/config.js', 'premium/adapters/dev-local.js', 'premium/services.js', 'premium/engineering-bridge.js',
      'premium/shell.js', 'app-shell.js', 'final-ui-fix.js'], 'script order');
    const cdn = scripts[0];
    assert(/\bintegrity="sha384-Rj26LVGvoeRVR6\+mwQmFfcR3QOBEwT\+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok"/.test(cdn) && /\bcrossorigin="anonymous"/.test(cdn), 'SRI + crossorigin on the library');
    eq(srcs.filter(s => /^https?:/.test(s)).length, 1, 'exactly one external script');
    assert(!/supabase-js@2["\/](?!\.)|supabase-js@2"|supabase-js@latest|supabase-js"/.test(html), 'an unpinned supabase-js reference remains');
    assert(!/premium\/adapters\/supabase\.js/.test(html), 'obsolete adapter still referenced');
    eq((html.match(/<iframe[^>]*\bsrc="([^"?]+)/) || [])[1], 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html', 'calculator frame');
    for (const s of srcs.filter(s => !/^https?:/.test(s))) assert(fs.existsSync(path.join(REPO, s.replace(/\?.*$/, ''))), 'missing script ' + s);
    for (const m of html.matchAll(/<link[^>]+href="([^"?]+)/g)) assert(fs.existsSync(path.join(REPO, m[1])), 'missing stylesheet ' + m[1]);
  });

  /* ---------------------------------------------------------------- Step 4: development adapter conformance */
  const nodeCrypto = require('crypto');
  function browserEnv({ hostname = 'gearhead.example', search = '', client = null, files = ['models', 'dev-local'] } = {}) {
    const store = {}, session = {};
    const storage = o => ({ getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; } });
    const docListeners = {};
    const document = { readyState: 'complete', visibilityState: 'visible', addEventListener(ev, cb) { (docListeners[ev] = docListeners[ev] || []).push(cb); } };
    const window = {};
    if (client) window.GH_SUPABASE = client;
    const ctx = vm.createContext({ window, document, location: { hostname, search, origin: 'https://' + hostname, pathname: '/' }, localStorage: storage(store), sessionStorage: storage(session),
      console, setTimeout, clearTimeout, URLSearchParams, crypto: nodeCrypto.webcrypto });
    window.GHP_CONFIG = { development: { allowOnLocalhost: true, allowQueryFlag: true, queryFlag: 'gh_dev' } };
    const SRC = { models: MODELS, foundation: FOUNDATION, 'dev-local': read('premium/adapters/dev-local.js'), services: read('premium/services.js') };
    for (const f of files) vm.runInContext(SRC[f], ctx, { filename: f + '.js' });
    return { window, M: window.GHP.models, store };
  }
  const { scenarios, helpers } = require('./conformance.js');
  {
    const env = browserEnv();
    const dev = await env.window.GHP.adapters.development.create();
    const emails = { free: 'free@example.test', premium: 'premium@example.test' };
    const ctx = {
      M: env.M,
      async as(user) { await dev.auth.signIn({ email: emails[user] }); return dev; },
      async grant(user) { await ctx.as(user); await dev.devTools.setPlan('premium'); },
      async revoke(user) { await ctx.as(user); await dev.devTools.setPlan('free'); },
      async seedSavedCalculation(user, machineId) { await ctx.as(user); await dev.devTools.simulateServerSavedCalculation({ machine_id: machineId }); }
    };
    const shared = {}, h = helpers();
    for (const [name, fn] of scenarios) await test('dev conformance: ' + name, () => fn(ctx, shared, h));
    await test('dev adapter exposes the same surface as the foundation adapter (plus devTools only)', async () => {
      const fEnv = load({ client: fakeClient() }), F = await fEnv.F.create();
      const surface = a => Object.keys(a).filter(k => k !== 'devTools').sort();
      eq(surface(dev), surface(F), 'adapter keys');
      for (const t of Object.keys(F.tables)) eq(Object.keys(dev.tables[t]).sort(), Object.keys(F.tables[t]).sort(), t + ' methods');
      for (const k of ['auth', 'entitlement', 'garage', 'machines', 'testSetups', 'analyses']) eq(Object.keys(dev[k]).sort(), Object.keys(F[k]).sort(), k);
      eq(dev.tables.saved_calculations.insert, undefined, 'no saved-calculation create');
      assert(!('simulateServerSavedCalculation' in dev.tables.saved_calculations) && !('setPlan' in dev.entitlement), 'dev-only tools leak into the contract');
    });
  }

  /* ---------------------------------------------------------------- Step 3: services on the development adapter */
  await test('services: adapter selection (development on localhost; no-backend without a bootstrap client or schema)', async () => {
    const d = browserEnv({ hostname: 'localhost', files: ['models', 'dev-local', 'services'] });
    await d.window.GHP.services.ready; eq(d.window.GHP.services.mode, 'development', 'localhost');
    const n = browserEnv({ files: ['models', 'foundation', 'dev-local', 'services'] });
    await n.window.GHP.services.ready; eq(n.window.GHP.services.mode, 'no-backend', 'no bootstrap client');
    await rejects(n.window.GHP.services.repos.machines.list(), e => eq(e.kind, 'not_provisioned', 'repos refuse in no-backend'));
    const p = browserEnv({ files: ['models', 'foundation', 'dev-local', 'services'], client: fakeClient(pgErr('PGRST205', 'Could not find the table public.plans', 404)) });
    await p.window.GHP.services.ready; eq(p.window.GHP.services.mode, 'no-backend', 'schema not provisioned');
    const o = browserEnv({ files: ['models', 'foundation', 'dev-local', 'services'], client: fakeClient() });
    await o.window.GHP.services.ready; eq(o.window.GHP.services.mode, 'production', 'provisioned');
    const q = browserEnv({ hostname: 'localhost', search: '?gh_dev=0', files: ['models', 'foundation', 'dev-local', 'services'] });
    await q.window.GHP.services.ready; eq(q.window.GHP.services.mode, 'no-backend', '?gh_dev=0 on localhost');
    eq(d.window.GHP.services.repos.savedCalculations.create, undefined, 'no saved-calculation create in services');
  });
  await test('services: a backend that becomes unavailable at runtime falls back to no-backend and announces it', async () => {
    let broken = false;   // the schema disappears after a successful start
    const client = fakeClient(c => broken ? pgErr('42P01', 'relation does not exist', 404)() : (c.op === 'rpc' ? { data: [{ plan_key: 'free', is_premium: false, features: [], source: null, ends_at: null }], error: null } : undefined));
    client.session = { user: { id: U1, email: 'a@x.test' } };
    const env = browserEnv({ files: ['models', 'foundation', 'services'], client });
    const S = env.window.GHP.services; await S.ready;
    eq(S.mode, 'production', 'started normally');
    const seen = []; S.on('mode', m => seen.push(m));
    broken = true;
    await rejects(S.repos.machines.list());
    await new Promise(r => setTimeout(r, 10));
    eq([S.mode, seen, S.auth.user], ['no-backend', ['no-backend'], null], 'fallback');
  });
  await test('services: Free garage flow (create with specs, allowance, drivetrain/notes merge, components, primary, Test Setups)', async () => {
    const env = browserEnv({ hostname: 'localhost', files: ['models', 'dev-local', 'services'] });
    const S = env.window.GHP.services, R = S.repos; await S.ready;
    await rejects(R.machines.list(), e => assert(e.signIn, 'sign-in required'));
    await S.auth.signIn({ email: 'driver@example.test' }); await new Promise(r => setTimeout(r, 5));
    eq(S.entitlements.state.plan, 'free', 'free');
    const m = await R.machines.create({ model_year: '2019', make: 'Ford', model: 'Mustang', machine_type: 'automotive', power_source: 'gasoline', engine: '5.0L V8', transmission: '6-speed manual', drivetrain: 'RWD', notes: 'Weekend car', is_primary: false });
    eq([m.name, m.is_primary, m.engine.label, m.transmission.label, m.drivetrain, m.details.notes], ['2019 Ford Mustang', true, '5.0L V8', '6-speed manual', 'RWD', 'Weekend car'], 'created view (first vehicle becomes primary)');
    eq(await R.machines.allowance(), { used: 1, limit: 1, canAdd: false }, 'allowance');
    const before = (await R.machines.list()).length;
    eq((await rejects(R.machines.create({ machine_type: 'motorcycle', make: 'Honda' }))).kind, 'free_machine_limit', 'second vehicle');
    eq((await R.machines.list()).length, before, 'nothing half-created');
    let u = await R.machines.update(m.id, { drivetrain: 'AWD' });
    eq([u.drivetrain, u.details.notes], ['AWD', 'Weekend car'], 'drivetrain change keeps notes');
    u = await R.machines.update(m.id, { notes: 'Track car' });
    eq([u.drivetrain, u.details.notes], ['AWD', 'Track car'], 'notes change keeps drivetrain');
    u = await R.machines.update(m.id, { engine: '5.2L Voodoo', transmission: '' });
    eq([u.engine.label, u.transmission], ['5.2L Voodoo', null], 'component update + soft delete');
    await rejects(R.machines.update(m.id, { machine_type: 'marine' }), e => eq(e.code, 'marine_blocked', 'marine'));
    const t = await R.testSetups.create({ machine_id: m.id, name: 'Street', description: 'Goals: 12s', notes: null });
    for (const n of ['Track', 'Dyno', 'Winter']) await R.testSetups.create({ machine_id: m.id, name: n });
    eq((await R.testSetups.list(m.id)).length, 4, 'unlimited setups');
    await R.testSetups.update(t.id, { notes: 'edited' }); await R.testSetups.repin(t.id); await R.testSetups.remove(t.id);
    eq((await R.testSetups.list(m.id)).length, 3, 'setup deleted');
    const p = await R.profile.getMine(); eq([p.email, p.preferred_unit_system], ['driver@example.test', 'imperial'], 'profile');
    eq((await R.profile.saveMine({ display_name: 'Driver', experience_level: 'enthusiast', favorite_machine_id: m.id })).display_name, 'Driver', 'profile save ignores favorite_machine_id');
    eq(await R.billing.subscriptions(), [], 'subscriptions');
    await R.machines.remove(m.id);
    eq(await R.machines.allowance(), { used: 0, limit: 1, canAdd: true }, 'deleting frees the allowance');
  });
  await test('services: Premium analyses from a bridge capture (size limit, links, version), saved calculations without create, lapse', async () => {
    const env = browserEnv({ hostname: 'localhost', files: ['models', 'dev-local', 'services'] });
    const S = env.window.GHP.services, R = S.repos; await S.ready;
    await S.auth.signIn({ email: 'pro@example.test' }); await new Promise(r => setTimeout(r, 5));
    const snap = { analyzer_id: 'e13_intercooler_thermal', input_data: { schema: 1, analyzer_id: 'e13_intercooler_thermal', unit_system: 'metric', fields: { a: { value: '1', unit: '', canonical: null } } }, result_data: { schema: 1, results: [] } };
    await rejects(R.analyses.saveNew(snap, { title: 'IC' }), e => eq([e.kind, e.upgrade], ['forbidden', true], 'Free cannot save analyses'));
    await S.dev.setPlan('premium');
    eq([S.entitlements.isPremium(), S.entitlements.has('garage_unlimited')], [true, true], 'premium');
    const m1 = await R.machines.create({ machine_type: 'automotive', make: 'BMW', model: 'M3' }), m2 = await R.machines.create({ machine_type: 'motorcycle', make: 'Ducati' });
    await R.machines.setPrimary(m2.id);
    eq((await R.machines.list()).map(m => [m.make || m.details.make, m.is_primary]), [['Ducati', true], ['BMW', false]], 'primary moved, listed first');
    const ts = await R.testSetups.create({ machine_id: m1.id, name: 'Track' });
    const a = await R.analyses.saveNew(snap, { title: 'IC', test_setup_id: ts.id });
    eq([a.analyzer_version, a.inputs_unit_system, a.machine_id, a.result_trust], ['E1-AUTO', 'metric', m1.id, 'client_reported'], 'saved');
    eq((await R.analyses.saveExisting(a.id, snap, { title: 'IC v2' })).title, 'IC v2', 'updated');
    const big = { analyzer_id: 'e13_intercooler_thermal', input_data: { schema: 1, unit_system: 'metric', fields: { blob: 'x'.repeat(70000) } }, result_data: null };
    await rejects(R.analyses.saveNew(big, { title: 'Too big' }), e => assert(/64 KB/.test(e.message), 'size'));
    eq(R.savedCalculations.canCreate, false, 'cannot create');
    await S.dev.simulateSavedCalculation({ machine_id: m1.id });
    const [sc] = await R.savedCalculations.list();
    eq((await R.savedCalculations.pin(sc.id, true)).pinned, true, 'pin');
    eq((await R.savedCalculations.update(sc.id, { title: 'Renamed', create: true })).title, 'Renamed', 'edit (unknown keys dropped)');
    await S.dev.setPlan('free');
    eq(S.entitlements.isPremium(), false, 'lapsed');
    await rejects(R.savedCalculations.pin(sc.id, false), e => eq(e.kind, 'forbidden', 'lapsed pin'));
    eq((await R.savedCalculations.list()).length, 1, 'lapsed read');
    eq((await R.analyses.list()).length, 1, 'lapsed analyses read');
    await R.analyses.remove(a.id); await R.savedCalculations.remove(sc.id);
    eq((await R.machines.list()).length, 2, 'machines retained');
    await rejects(R.machines.create({ machine_type: 'automotive', make: 'Audi' }), e => eq(e.kind, 'free_machine_limit', 'lapsed cannot add'));
  });
  await test('services: setting the primary vehicle sends exactly ONE write (no client-side clearing anywhere in the live code)', async () => {
    // client code never clears the flag; the development adapter emulates the DATABASE (column default + 0404 trigger)
    for (const f of LIVE.filter(f => f !== 'premium/adapters/dev-local.js')) assert(!/is_primary\s*:\s*false|is_primary\s*=\s*false/.test(stripComments(read(f))), f + ' clears is_primary');
    const devSrc = stripComments(read('premium/adapters/dev-local.js'));
    eq((devSrc.match(/is_primary\s*=\s*false/g) || []).length, 1, 'dev adapter clears the flag in exactly one place');
    assert(/function movePrimary[\s\S]{0,200}is_primary = false/.test(devSrc), 'that place is the trigger emulation (movePrimary)');
    const client = fakeClient(c => c.op === 'rpc' ? { data: [{ plan_key: 'premium', is_premium: true, features: ['garage_unlimited'], source: 'manual', ends_at: null }], error: null }
      : c.op === 'update' ? { data: [{ machine_id: U2, is_primary: true }], error: null }
      : c.table === 'machine_details' && c.op === 'select' ? { data: [{ machine_id: U1, is_primary: true }, { machine_id: U2, is_primary: false }], error: null } : undefined);
    client.session = { user: { id: U1, email: 'a@x.test' } };
    const env = browserEnv({ files: ['models', 'foundation', 'services'], client });
    const S = env.window.GHP.services; await S.ready;
    client.calls.length = 0;
    await S.repos.machines.setPrimary(U2);
    eq(writes(client).map(c => [c.table, c.op, c.values, c.filters]), [['machine_details', 'update', { is_primary: true }, [['eq', 'machine_id', U2]]]], 'writes');
  });
  await test('services: entitlement comes only from the adapter; an expired session signs the user out locally', async () => {
    let probed = false;
    const client = fakeClient(c => {
      if (!probed) { probed = true; return undefined; }
      if (c.op === 'rpc' && c.fn === 'pf_my_entitlement') return { data: [{ plan_key: 'premium', is_premium: true, features: ['engineering_lab'], source: 'trial', ends_at: '2099-01-01T00:00:00Z' }], error: null };
      if (c.table === 'machines') return pgErr('PGRST301', 'JWT expired', 401)();
    });
    client.session = { user: { id: U1, email: 'a@x.test' } };
    const env = browserEnv({ files: ['models', 'foundation', 'services'], client });
    const S = env.window.GHP.services; await S.ready;
    eq([S.entitlements.state.isTrial, S.entitlements.has('engineering_lab'), S.entitlements.has('garage_unlimited')], [true, true, false], 'from pf_my_entitlement');
    assert(!('setPlan' in S.entitlements) && S.dev === null, 'no client-side grant path in production');
    const authEvents = []; S.on('auth', u => authEvents.push(u));
    await rejects(S.repos.machines.list(), e => eq(e.kind, 'session_expired', 'expired'));
    eq([S.auth.user, authEvents], [null, [null]], 'signed out locally');
  });

  const failed = results.filter(r => !r.pass);
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '\n      -> ' + r.error}`);
  console.log(`\nfrontend adapter tests: ${results.length - failed.length}/${results.length} passed (${FILES.length} frontend files scanned)`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('SUITE ERROR', e); process.exit(2); });
