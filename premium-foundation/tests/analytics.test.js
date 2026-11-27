#!/usr/bin/env node
/* Analytics (0501) database suite. LOCAL THROWAWAY POSTGRESQL ONLY (started by tests/run-tests.sh).
 * Every event here is SYNTHETIC test data: fixed visitor/session ids in the 0a000000-... range, written either through
 * analytics_ingest() (as the Edge Function would) or directly with explicit server timestamps so that sessions, days
 * and periods are exact. Nothing here has seen real website traffic. Each check runs in its own rolled-back transaction. */
'use strict';
const fs = require('fs'), path = require('path');
const { Client } = require('pg');

const HERE = path.resolve(__dirname, '..'), REPO = path.resolve(HERE, '..');
const MIG_DIR = path.join(REPO, 'supabase', 'migrations');
const SHIM = fs.readFileSync(path.join(HERE, 'tests', 'sql', '000_hosted_supabase_shim.sql'), 'utf8');
const HOST = process.env.PF_PGHOST, PORT = +process.env.PF_PGPORT;
if (!HOST || !PORT) { console.error('PF_PGHOST / PF_PGPORT not set (use tests/run-tests.sh)'); process.exit(2); }
const OWNER = 'a0000000-0000-4000-8000-0000000000a0', OTHER = 'b0000000-0000-4000-8000-0000000000b0';
const DENIED = '42501', BAD_ARG = '22023';

async function connect(db, user) { const c = new Client({ host: HOST, port: PORT, user, database: db }); await c.connect(); return c; }
async function freshDb(db = 'analytics_' + process.pid) {
  const a = await connect('postgres', 'supabase_admin'); await a.query(`DROP DATABASE IF EXISTS ${db}`); await a.query(`CREATE DATABASE ${db} TEMPLATE template0`); await a.end();
  const sa = await connect(db, 'supabase_admin'); await sa.query(SHIM);
  await sa.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'owner@example.test'), ($2, 'other@example.test')`, [OWNER, OTHER]); await sa.end();
  const pg = await connect(db, 'postgres');
  for (const f of fs.readdirSync(MIG_DIR).filter(f => f.endsWith('.sql')).sort()) await pg.query(fs.readFileSync(path.join(MIG_DIR, f), 'utf8'));
  await pg.query(`INSERT INTO public.analytics_owners (user_id, note) VALUES ($1, 'synthetic test owner')`, [OWNER]);
  await pg.end();
  return db;
}
async function as(c, who) {
  const claims = { postgres: '', service: '{"role":"service_role"}', anon: '{"role":"anon"}', nouid: '' }[who];
  const role = { postgres: 'postgres', service: 'service_role', anon: 'anon', nouid: 'authenticated' }[who] || 'authenticated';
  await c.query(`SET LOCAL ROLE ${role}`);
  await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [claims !== undefined ? claims : JSON.stringify({ sub: who === 'owner' ? OWNER : OTHER, role: 'authenticated' })]);
}
async function q(c, sql, p) { return (await c.query(sql, p)).rows; }
async function one(c, sql, p) { const r = await q(c, sql, p); return r.length ? Object.values(r[0])[0] : undefined; }
async function expectErr(c, sql, p, codes) {
  codes = [].concat(codes); await c.query('SAVEPOINT x');
  try { await c.query(sql, p); } catch (e) { await c.query('ROLLBACK TO SAVEPOINT x'); if (!codes.includes(e.code)) throw new Error(`expected ${codes} got ${e.code}: ${e.message}`); return; }
  await c.query('ROLLBACK TO SAVEPOINT x'); throw new Error(`expected error ${codes} but succeeded: ${sql.slice(0, 80)}`);
}
const canon = (v) => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const eq = (a, b, what) => { if (JSON.stringify(canon(a)) !== JSON.stringify(canon(b))) throw new Error(`${what}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };

/* ---------------------------------------------------------------- synthetic event builders */
let n = 0;
const hex = (i, w = 12) => i.toString(16).padStart(w, '0');
const uuid = (kind, i) => `0a00000${kind}-0000-4000-8000-${hex(i)}`;      // kind: 1 event, 2 visitor, 3 session, 4 page view
const ev = (name, o = {}) => ({ event_id: uuid(1, ++n), name, vid: o.vid || uuid(2, 1), sid: o.sid || uuid(3, 1), seq: o.seq ?? n,
  page: o.page || 'home', pv_id: o.pv_id || uuid(4, 1), viewport: 'l', props: o.props || {}, ...(o.ts_client ? { ts_client: o.ts_client } : {}) });
const META = { env: 'test', client_env: 'test' };
const ingest = (c, batch, meta = META) => one(c, `SELECT public.analytics_ingest($1::jsonb, $2::jsonb)`, [JSON.stringify(batch), JSON.stringify(meta)]);
/* Direct insert (as the table owner) with an exact server time, for sessionisation / period tests. ts = ISO with offset. */
async function put(c, ts, e, env = 'test', bot = false) {
  await c.query(`INSERT INTO public.analytics_events (event_id, env, name, ts_server, vid, sid, pv_id, seq, page, props, bot)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [e.event_id, env, e.name, ts, e.vid, e.sid, e.pv_id, e.seq, e.page, JSON.stringify(e.props), bot]);
}
const NY = (d, hm) => `${d}T${hm}:00-05:00`;   // November/December dates: America/New_York is UTC-5

/* ---------------------------------------------------------------- checks */
const checks = [];
const check = (group, name, fn) => checks.push({ group, name, fn });

check('security', 'no client role can read or write any analytics table; RLS enabled and forced; no policies', async (c) => {
  const tables = ['analytics_owners', 'analytics_events', 'analytics_ingest_stats', 'analytics_sessions', 'analytics_daily', 'analytics_rollup_runs',
    'analytics_visitors', 'analytics_rate', 'analytics_rate_salt'];
  for (const t of tables) {
    for (const who of ['anon', 'other', 'owner', 'service']) {
      await as(c, who); await expectErr(c, `SELECT 1 FROM public.${t} LIMIT 1`, [], DENIED);
      await expectErr(c, `INSERT INTO public.${t} DEFAULT VALUES`, [], [DENIED, '23502']);
    }
    await as(c, 'postgres');
    eq(await one(c, `SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = $1::regclass`, ['public.' + t]), true, t + ' rls');
  }
  eq(+(await one(c, `SELECT count(*) FROM pg_policies WHERE tablename LIKE 'analytics%'`)), 0, 'policies');
});
check('security', 'function privileges: ingest = service_role only; dashboard/refresh = signed-in only; rollup/purge = nobody', async (c) => {
  const x = async (role, f) => one(c, `SELECT has_function_privilege($1, $2, 'EXECUTE')`, [role, 'public.' + f]);
  eq([await x('service_role', 'analytics_ingest(jsonb, jsonb)'), await x('authenticated', 'analytics_ingest(jsonb, jsonb)'), await x('anon', 'analytics_ingest(jsonb, jsonb)')], [true, false, false], 'ingest');
  eq([await x('authenticated', 'analytics_dashboard(date, date, text)'), await x('anon', 'analytics_dashboard(date, date, text)'), await x('service_role', 'analytics_dashboard(date, date, text)')], [true, false, false], 'dashboard');
  for (const f of ['analytics_rollup(date)', 'analytics_rollup_pending()', 'analytics_purge()', 'analytics_event_problem(jsonb)', 'analytics_count(text, text, text, bigint)',
                   'analytics_rate_check(text, text, integer)', 'analytics_count_refusal(text, text, bigint)', 'analytics_storage_bytes()'])
    for (const r of ['anon', 'authenticated', 'service_role']) eq(await x(r, f), false, `${r} ${f}`);
  await as(c, 'anon'); await expectErr(c, `SELECT public.analytics_ingest('[]', '{"env":"test"}')`, [], DENIED);
  await as(c, 'owner'); await expectErr(c, `SELECT public.analytics_ingest('[]', '{"env":"test"}')`, [], DENIED);
  await expectErr(c, `SELECT public.analytics_rollup(current_date)`, [], DENIED);
  await expectErr(c, `SELECT public.analytics_purge()`, [], DENIED);
});
check('owner', 'owner gets the report; a signed-in non-owner, a token without a user, anon and service_role are refused', async (c) => {
  const sql = `SELECT public.analytics_dashboard('2026-11-01', '2026-11-07', 'test')`;
  await as(c, 'owner'); const r = await one(c, sql); ok(r && r.kpis && r.billing, 'owner report');
  eq(await one(c, `SELECT public.analytics_is_owner()`), true, 'owner flag');
  await as(c, 'other'); await expectErr(c, sql, [], DENIED); await expectErr(c, `SELECT public.analytics_refresh()`, [], DENIED);
  eq(await one(c, `SELECT public.analytics_is_owner()`), false, 'non-owner flag');
  await expectErr(c, `SELECT public.analytics_billing_metrics('2026-11-01', '2026-11-07')`, [], DENIED);
  await as(c, 'nouid'); await expectErr(c, sql, [], DENIED);
  await as(c, 'anon'); await expectErr(c, sql, [], DENIED);
  await as(c, 'service'); await expectErr(c, sql, [], DENIED);
  await as(c, 'owner');
  await expectErr(c, `SELECT public.analytics_dashboard('2026-11-07', '2026-11-01', 'test')`, [], BAD_ARG);
  await expectErr(c, `SELECT public.analytics_dashboard('2024-01-01', '2026-11-01', 'test')`, [], BAD_ARG);
  await expectErr(c, `SELECT public.analytics_dashboard('2026-11-01', '2026-11-02', 'prod')`, [], BAD_ARG);
});
check('validation', 'only catalogued events with allow-listed, well-typed properties are stored; each rejection is counted by reason', async (c) => {
  await as(c, 'service');
  const bad = [
    [ev('made_up_event'), 'unknown_event'],
    [ev('calc_start', { props: { calc_id: 'hp_from_et', value: 350 } }), 'unknown_prop:value'],                // a calculator input value
    [ev('calc_complete', { props: { calc_id: 'x1', fields_touched: 2, ms_to_complete: 10, result: '12.3' } }), 'unknown_prop:result'],
    [ev('search', { props: { result_count: 3, query: 'turbo boost' } }), 'unknown_prop:query'],               // search text: owner decision, not stored
    [ev('page_view', { props: { email: 'a@b.c' } }), 'unknown_prop:email'],
    [ev('page_view', { page: 'calc:hp?email=a@b.c' }), 'bad_page'],
    [ev('page_view', { page: 'CALC:HP' }), 'bad_page'],
    [ev('calc_start', { props: {} }), 'missing_prop:calc_id'],
    [ev('calc_start', { props: { calc_id: 'DROP TABLE' } }), 'bad_prop:calc_id'],
    [ev('page_leave', { props: { engaged_ms: 1800001 } }), 'bad_prop:engaged_ms'],
    [ev('page_leave', { props: { engaged_ms: -5 } }), 'bad_prop:engaged_ms'],
    [ev('page_leave', { props: { engaged_ms: '100' } }), 'bad_prop:engaged_ms'],
    [ev('page_view', { props: { ref_host: 'https://evil.example/path' } }), 'bad_prop:ref_host'],
    [ev('page_view', { props: { utm_source: 'Bad Source!' } }), 'bad_prop:utm_source'],
    [ev('checkout_return', { props: { outcome: 'maybe' } }), 'bad_prop:outcome'],
    [{ ...ev('page_view'), event_id: 'not-a-uuid' }, 'bad_id'],
    [{ ...ev('page_view'), ip: '203.0.113.9' }, 'unknown_field'],
    [{ ...ev('page_view'), seq: -1 }, 'bad_seq'],
    [{ ...ev('page_view'), ts_client: '2026-13-45T25:00:00Z' }, 'bad_ts'],
    [ev('page_view', { props: { utm_campaign: 'x'.repeat(101) } }), 'bad_prop:utm_campaign'],
    // hostile payloads
    [{ ...ev('page_view'), env: 'live' }, 'unknown_field'],                                  // an event cannot carry its own environment
    [{ ...ev('page_view'), name: "page_view'; DROP TABLE analytics_events; --" }, 'unknown_event'],
    [ev('page_view', { page: '<script>alert(1)</script>' }), 'bad_page'],
    [ev('page_view', { page: 'calc:' + 'a'.repeat(5000) }), 'bad_page'],
    [ev('page_view', { page: 'calc:hp\u0430' }), 'bad_page'],                               // a look-alike (Cyrillic) letter
    [JSON.parse('{"event_id":"0a000001-0000-4000-8000-00000000ffff","name":"calc_start","vid":"0a000002-0000-4000-8000-000000000001","sid":"0a000003-0000-4000-8000-000000000001","seq":1,"page":"home","props":{"calc_id":"x","__proto__":{"admin":true}}}'), 'unknown_prop:__proto__'],
    [ev('calc_start', { props: { calc_id: { nested: 'x' } } }), 'bad_prop:calc_id'],
    [ev('calc_start', { props: ['calc_id'] }), 'bad_props'],
    [{ ...ev('page_view'), seq: 1.5 }, 'bad_seq'],
    [{ ...ev('page_view'), vid: '0A000002-0000-4000-8000-000000000001' }, 'bad_id'],
    [ev('page_leave', { props: { engaged_ms: 1e12 } }), 'bad_prop:engaged_ms'],
    [ev('search', { props: { result_count: 3, clicked_rank: '1 OR 1=1' } }), 'bad_prop:clicked_rank'],
    ['not an object', 'not_object']];
  await as(c, 'postgres');
  for (const [e, why] of bad) eq(await one(c, `SELECT public.analytics_event_problem($1::jsonb)`, [JSON.stringify(e)]), why, `reason for ${JSON.stringify(e).slice(0, 120)}`);
  await as(c, 'service');
  const all = bad.map(b => b[0]).concat([ev('page_view', { props: { ref_host: 'google.com', utm_source: 'newsletter' } }), ev('calc_start', { props: { calc_id: 'hp_from_et' } })]);
  let acc = 0, rej = 0;
  for (let i = 0; i < all.length; i += 20) { const r = await ingest(c, all.slice(i, i + 20)); acc += r.accepted; rej += r.rejected; }
  eq([acc, rej], [2, bad.length], 'accepted/rejected');
  await as(c, 'postgres');
  eq(+(await one(c, `SELECT count(*) FROM analytics_events`)), 2, 'rows');
  eq(+(await one(c, `SELECT sum(n) FROM analytics_ingest_stats WHERE outcome = 'rejected'`)), bad.length, 'rejected counted');
  eq(+(await one(c, `SELECT n FROM analytics_ingest_stats WHERE outcome = 'rejected' AND reason = 'unknown_prop:value'`)), 1, 'reason kept');
  eq(+(await one(c, `SELECT count(*) FROM analytics_events WHERE props::text ~ '350|turbo|@|admin|DROP'`)), 0, 'no input values / search text / email / hostile content stored');
  eq(+(await one(c, `SELECT to_regclass('public.analytics_events') IS NOT NULL`)), 1, 'table intact');
});
check('validation', 'bad envelopes: unknown env, empty, oversize (>20) and non-array batches are refused without storing anything', async (c) => {
  await as(c, 'service');
  eq((await ingest(c, [ev('page_view')], { env: 'production' })).reason, 'bad_env', 'env');
  eq((await ingest(c, [], META)).reason, 'bad_batch', 'empty');
  eq((await ingest(c, Array.from({ length: 21 }, () => ev('page_view')))).reason, 'bad_batch', 'oversize');
  eq((await one(c, `SELECT public.analytics_ingest('{"a":1}'::jsonb, '{"env":"test","client_env":"test"}')`)).reason, 'bad_batch', 'object');
  eq((await ingest(c, [ev('page_view')], { ...META, bot: 'yes', client_errors: 'lots' })).accepted, 1, 'junk meta ignored safely');
  await as(c, 'postgres');
  eq(+(await one(c, `SELECT count(*) FROM analytics_events`)), 1, 'only the valid one');
});
check('duplicates', 'a replayed event id is stored once and counted as a duplicate (sendBeacon + retry)', async (c) => {
  await as(c, 'service');
  const e = ev('page_view'), f = ev('page_ping', { props: { engaged_ms_delta: 5000 } });
  eq(await ingest(c, [e, f]), { accepted: 2, duplicate: 0, rejected: 0, capped: 0 }, 'first');
  eq(await ingest(c, [e, f, e]), { accepted: 0, duplicate: 3, rejected: 0, capped: 0 }, 'replay');
  await as(c, 'postgres');
  eq(+(await one(c, `SELECT count(*) FROM analytics_events`)), 2, 'rows');
  eq(+(await one(c, `SELECT n FROM analytics_ingest_stats WHERE outcome = 'duplicate'`)), 3, 'dup stats');
});
check('abuse', 'per-session cap (500 / 24 h), bot flag, skewed client clock, client error counters', async (c) => {
  await as(c, 'postgres');
  const sid = uuid(3, 77);
  await c.query(`INSERT INTO analytics_events (event_id, env, name, vid, sid, seq, page) SELECT gen_random_uuid(), 'test', 'page_ping', $1, $2, g, 'home'
                 FROM generate_series(1, 500) g`, [uuid(2, 77), sid]);
  await as(c, 'service');
  eq((await ingest(c, [ev('page_view', { sid })])).capped, 1, 'capped');
  eq((await ingest(c, [ev('page_view', { sid: uuid(3, 78), ts_client: '2020-01-01T00:00:00Z' })], { ...META, bot: true, ua_family: 'HeadlessChrome<script>', client_errors: 4, client_dropped: 2 })).accepted, 1, 'bot accepted for volume');
  await as(c, 'postgres');
  const row = (await q(c, `SELECT bot, ts_client, ua_family FROM analytics_events WHERE sid = $1`, [uuid(3, 78)]))[0];
  eq([row.bot, row.ts_client, row.ua_family], [true, null, 'HeadlessChromescript'], 'bot row, skewed clock dropped, UA sanitised');
  eq((await q(c, `SELECT outcome, n::int FROM analytics_ingest_stats WHERE outcome IN ('capped','bot','client_error','client_dropped') ORDER BY outcome`)).map(r => `${r.outcome}=${r.n}`),
    ['bot=1', 'capped=1', 'client_dropped=2', 'client_error=4'], 'stats');
  await expectErr(c, `UPDATE analytics_events SET page = 'x'`, [], DENIED);
  await expectErr(c, `DELETE FROM analytics_events`, [], DENIED);
  await expectErr(c, `TRUNCATE analytics_events`, [], DENIED);
});

/* A synthetic day (2026-11-03, New York) with known answers:
 *  V1/S1  10:00 page_view home (google.com, new) -> 10:01 page_view calc:hp_from_et (nav_click lab_tile) -> calc_view/start/complete
 *         page_leave home 40 s; page_leave calc 20 s; 10:50 page_view lab:diesel (gap > 30 min => second session), leave 5 s
 *  V2/S2  11:00 page_view home (direct, new), calc_view + calc_start on calc:hp_from_et (no completion => abandon), leave 3 s
 *  V3/S3  12:00 page_view premium (utm newsletter/email/fall, returning), premium_offer_view, trial_click, checkout_return success,
 *         page_pings summing to 31 min on one page view (capped at 30 min)
 *  BOT    12:30 a flagged bot session with 3 page views: excluded from every metric, counted as 1 bot session */
async function seedDay(c, d = '2026-11-03', env = 'test', base = 0) {
  const V = (i) => uuid(2, base + i), S = (i) => uuid(3, base + i), P = (i) => uuid(4, base + i);
  const E = (name, o) => ev(name, o);
  const s1 = { vid: V(1), sid: S(1) };
  await put(c, NY(d, '10:00'), E('page_view', { ...s1, page: 'home', pv_id: P(1), props: { ref_host: 'www.google.com', is_new_visitor: true, is_session_start: true } }), env);
  await put(c, NY(d, '10:01'), E('page_leave', { ...s1, page: 'home', pv_id: P(1), props: { engaged_ms: 40000 } }), env);
  await put(c, NY(d, '10:01'), E('nav_click', { ...s1, page: 'home', pv_id: P(1), props: { to_page: 'calc:hp_from_et', element: 'lab_tile' } }), env);
  await put(c, NY(d, '10:01'), E('page_view', { ...s1, page: 'calc:hp_from_et', pv_id: P(2) }), env);
  await put(c, NY(d, '10:01'), E('calc_view', { ...s1, page: 'calc:hp_from_et', pv_id: P(2), props: { calc_id: 'hp_from_et' } }), env);
  await put(c, NY(d, '10:02'), E('calc_start', { ...s1, page: 'calc:hp_from_et', pv_id: P(2), props: { calc_id: 'hp_from_et' } }), env);
  await put(c, NY(d, '10:03'), E('calc_complete', { ...s1, page: 'calc:hp_from_et', pv_id: P(2), props: { calc_id: 'hp_from_et', fields_touched: 2, ms_to_complete: 9000 } }), env);
  await put(c, NY(d, '10:04'), E('page_leave', { ...s1, page: 'calc:hp_from_et', pv_id: P(2), props: { engaged_ms: 20000 } }), env);
  await put(c, NY(d, '10:50'), E('page_view', { ...s1, page: 'lab:diesel', pv_id: P(3) }), env);
  await put(c, NY(d, '10:51'), E('page_leave', { ...s1, page: 'lab:diesel', pv_id: P(3), props: { engaged_ms: 5000 } }), env);
  const s2 = { vid: V(2), sid: S(2) };
  await put(c, NY(d, '11:00'), E('page_view', { ...s2, page: 'calc:hp_from_et', pv_id: P(4), props: { is_new_visitor: true } }), env);
  await put(c, NY(d, '11:00'), E('calc_view', { ...s2, page: 'calc:hp_from_et', pv_id: P(4), props: { calc_id: 'hp_from_et' } }), env);
  await put(c, NY(d, '11:01'), E('calc_start', { ...s2, page: 'calc:hp_from_et', pv_id: P(4), props: { calc_id: 'hp_from_et' } }), env);
  await put(c, NY(d, '11:01'), E('page_leave', { ...s2, page: 'calc:hp_from_et', pv_id: P(4), props: { engaged_ms: 3000 } }), env);
  const s3 = { vid: V(3), sid: S(3) };
  await put(c, NY(d, '12:00'), E('page_view', { ...s3, page: 'view:home', pv_id: P(5), props: { utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'fall', is_new_visitor: false } }), env);
  await put(c, NY(d, '12:00'), E('premium_offer_view', { ...s3, page: 'view:home', pv_id: P(5), props: { signed_in: false } }), env);
  for (let i = 0; i < 6; i++) await put(c, NY(d, `12:0${i + 1}`), E('page_ping', { ...s3, page: 'view:home', pv_id: P(5), props: { engaged_ms_delta: 300000 } }), env);
  await put(c, NY(d, '12:08'), E('page_leave', { ...s3, page: 'view:home', pv_id: P(5), props: { engaged_ms: 60000 } }), env);
  await put(c, NY(d, '12:08'), E('trial_click', { ...s3, page: 'view:home', pv_id: P(5), props: { interval: 'month', trial: true } }), env);
  await put(c, NY(d, '12:09'), E('checkout_return', { ...s3, page: 'view:home', pv_id: P(5), props: { outcome: 'success' } }), env);
  const sb = { vid: V(9), sid: S(9) };
  for (let i = 0; i < 3; i++) await put(c, NY(d, `12:3${i}`), E('page_view', { ...sb, page: 'home', pv_id: P(90 + i) }), env, true);
}

check('sessions', 'sessionisation: 30-minute gap splits a session; landing/exit pages; channels; engaged flag; time cap; bots flagged', async (c) => {
  await as(c, 'postgres'); await seedDay(c); await c.query(`SELECT public.analytics_rollup('2026-11-03')`);
  const s = await q(c, `SELECT landing_page l, exit_page x, page_views pv, engaged_ms::int ms, engaged e, channel ch, is_new, bot FROM analytics_sessions ORDER BY started_at`);
  eq(s, [
    { l: 'home', x: 'calc:hp_from_et', pv: 2, ms: 60000, e: true, ch: 'organic', is_new: true, bot: false },
    { l: 'lab:diesel', x: 'lab:diesel', pv: 1, ms: 5000, e: false, ch: 'direct', is_new: null, bot: false },
    { l: 'calc:hp_from_et', x: 'calc:hp_from_et', pv: 1, ms: 3000, e: false, ch: 'direct', is_new: true, bot: false },
    { l: 'view:home', x: 'view:home', pv: 1, ms: 1800000, e: true, ch: 'campaign', is_new: false, bot: false },
    { l: 'home', x: 'home', pv: 3, ms: 0, e: true, ch: 'direct', is_new: null, bot: true }], 'sessions');
});
check('aggregation', 'daily rollup matches the hand-computed answers; re-running it changes nothing (idempotent)', async (c) => {
  await as(c, 'postgres'); await seedDay(c);
  await c.query(`SELECT public.analytics_rollup('2026-11-03')`);
  const snap = async () => (await q(c, `SELECT metric, dim, value::numeric::text v FROM analytics_daily ORDER BY metric, dim`)).map(r => `${r.metric}|${r.dim}|${r.v}`);
  const first = await snap();
  await c.query(`SELECT public.analytics_rollup('2026-11-03')`);
  eq(await snap(), first, 'idempotent');
  const m = Object.fromEntries(first.map(l => { const [a, b, v] = l.split('|'); return [`${a}|${b}`, +v]; }));
  eq([m['pv|home'], m['pv|calc:hp_from_et'], m['pv|lab:diesel'], m['pv|view:home']], [1, 2, 1, 1], 'page views (bot excluded)');
  eq([m['calc_view|hp_from_et'], m['calc_start|hp_from_et'], m['calc_complete|hp_from_et'], m['calc_abandon|hp_from_et'], m['calc_ms_to_complete|hp_from_et']], [2, 2, 1, 1, 9000], 'calculator');
  eq([m['entrances|home'], m['exits|calc:hp_from_et'], m['exits|home']], [1, 2, undefined], 'entrances/exits (bot excluded)');
  eq([m['pv_engaged_ms|view:home'], m['pv_engaged_ms|home']], [1800000, 40000], 'engaged ms by page (30-minute cap per page view)');
  eq([m['nav|lab_tile'], m['nav_path|home>calc:hp_from_et']], [1, 1], 'navigation');
  eq([m['funnel_sessions|premium_offer_view'], m['funnel_sessions|trial_click'], m['funnel_sessions|checkout_return:success']], [1, 1, 1], 'funnel');
  eq(m['bot_sessions|'], 1, 'bot sessions');
});
check('dashboard', 'owner report: KPIs, previous-period comparison, date filter boundaries, environment separation, funnel, health', async (c) => {
  await as(c, 'postgres');
  await seedDay(c, '2026-11-03', 'test', 0);       // current period (11-02 .. 11-08)
  await seedDay(c, '2026-10-28', 'test', 100);     // previous period (10-26 .. 11-01)
  await seedDay(c, '2026-11-03', 'live', 200);     // a different environment, same day
  await seedDay(c, '2026-11-09', 'test', 300);     // the day after the range
  for (const d of ['2026-11-03', '2026-10-28', '2026-11-09']) await c.query(`SELECT public.analytics_rollup($1)`, [d]);
  await as(c, 'owner');
  const r = await one(c, `SELECT public.analytics_dashboard('2026-11-02', '2026-11-08', 'test')`);
  eq(r.range, { from: '2026-11-02', to: '2026-11-08', previous_from: '2026-10-26', previous_to: '2026-11-01', env: 'test', timezone: 'America/New_York' }, 'range');
  eq(r.kpis, { visitors: 3, sessions: 4, page_views: 5, engaged_sessions: 2, avg_engaged_ms: 467000, pages_per_session: 1.25, new_visitors: 3, returning_visitors: 0 }, 'kpis');
  eq(r.kpis_previous.sessions, 4, 'previous period');
  eq(r.trend.length, 7, 'one trend point per day'); eq(r.trend.find(t => t.day === '2026-11-03').sessions, 4, 'trend day');
  eq(r.trend.filter(t => t.sessions > 0).length, 1, 'nothing outside the range leaks in');
  eq(r.channels.map(x => `${x.channel}:${x.sessions}`).sort(), ['campaign:1', 'direct:2', 'organic:1'], 'channels');
  eq(r.campaigns, [{ source: 'newsletter', medium: 'email', campaign: 'fall', sessions: 1, engaged: 1 }], 'campaigns');
  eq(r.referrers, [{ host: 'www.google.com', sessions: 1 }], 'referrers');
  eq(r.calculators, [{ calc_id: 'hp_from_et', views: 2, starts: 2, completes: 1, abandons: 1, ms_to_complete: 9000, premium_gate_views: 0 }], 'calculators');
  eq(r.pages[0], { page: 'calc:hp_from_et', views: 2, entrances: 1, exits: 2, engaged_ms: 23000, leaves: 2 }, 'top page');
  eq(r.funnel.filter(f => f.sessions).map(f => f.step), ['premium_offer_view', 'trial_click', 'checkout_return:success'], 'funnel steps');
  eq(r.navigation.by_element, { lab_tile: 1 }, 'nav');
  eq(r.health.bot_sessions, 1, 'health bot sessions');
  ok(r.health.last_rollup_at, 'last rollup');
  eq(r.billing.status, 'pending', 'billing pending');
  // the exact function output, kept as the (synthetic) fixture the dashboard UI test renders
  fs.writeFileSync(path.join(HERE, 'evidence', 'analytics-dashboard-fixture.json'), JSON.stringify({ note: 'SYNTHETIC test data from analytics.test.js (throwaway database), not real traffic', report: r }, null, 2) + '\n');
  const live = await one(c, `SELECT public.analytics_dashboard('2026-11-02', '2026-11-08', 'live')`);
  eq([live.kpis.sessions, live.kpis_previous.sessions], [4, 0], 'live environment is separate');
});
check('dashboard', 'empty range returns zeros, not errors; refresh is owner-only and rolls up today', async (c) => {
  await as(c, 'service'); await ingest(c, [ev('page_view', { sid: uuid(3, 500) })]);
  await as(c, 'owner'); await c.query(`SELECT public.analytics_refresh()`);
  const today = await one(c, `SELECT (now() AT TIME ZONE 'America/New_York')::date::text`);
  const r = await one(c, `SELECT public.analytics_dashboard($1, $1, 'test')`, [today]);
  eq([r.kpis.sessions, r.kpis.page_views], [1, 1], 'refreshed today');
  ok(r.health.last_event_at, 'last event');
  eq(r.health.totals.accepted, 1, 'ingestion volume');
  const e = await one(c, `SELECT public.analytics_dashboard('2020-01-01', '2020-01-31', 'test')`);
  eq([e.kpis.sessions, e.kpis.visitors, e.pages.length, e.calculators.length], [0, 0, 0, 0], 'empty');
});
check('retention', 'purge deletes raw events older than 30 days (rolling them up first) and keeps the daily rollup', async (c) => {
  await as(c, 'postgres');
  const old = await one(c, `SELECT ((now() AT TIME ZONE 'America/New_York')::date - 120)::text`);
  await seedDay(c, old, 'test', 600);
  await c.query(`DELETE FROM analytics_daily`);                       // pretend the day was never rolled up
  const r = await one(c, `SELECT public.analytics_purge()`);
  eq(r.events > 0, true, 'deleted');
  eq(+(await one(c, `SELECT count(*) FROM analytics_events`)), 0, 'raw gone');
  eq(+(await one(c, `SELECT value FROM analytics_daily WHERE metric = 'pv' AND dim = 'home' AND day = $1`, [old])), 1, 'rollup kept');
  await put(c, new Date().toISOString(), ev('page_view'));
  await expectErr(c, `DELETE FROM analytics_events`, [], DENIED);   // the purge flag does not leak out of the function
});
check('retention', '30-day boundary: a 29-day-old raw event is kept, a 31-day-old one is deleted (after its day is rolled up)', async (c) => {
  await as(c, 'postgres');
  const day = (n) => one(c, `SELECT ((now() AT TIME ZONE 'America/New_York')::date - ${n})::text`);
  await put(c, NY(await day(29), '12:00'), ev('page_view', { sid: uuid(3, 9500), pv_id: uuid(4, 9500) }));
  await put(c, NY(await day(31), '12:00'), ev('page_view', { sid: uuid(3, 9501), pv_id: uuid(4, 9501) }));
  await c.query(`SELECT public.analytics_purge()`);
  eq(+(await one(c, `SELECT count(*) FROM analytics_events`)), 1, 'only the 29-day-old event remains');
  eq(+(await one(c, `SELECT value FROM analytics_daily WHERE metric = 'pv' AND dim = 'home' AND day = $1`, [await day(31)])), 1, 'the deleted day was rolled up first');
});
check('billing', 'Stripe figures: pending with no data, still pending with TEST-mode data only, live figures from billing tables only', async (c) => {
  await as(c, 'owner');
  eq((await one(c, `SELECT public.analytics_billing_metrics('2026-11-01', '2026-11-30')`)).status, 'pending', 'no data');
  await as(c, 'postgres');
  const sa = await connect(c.database, 'supabase_admin');
  const users = ['c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002'];
  for (const u of users) await sa.query(`INSERT INTO auth.users (id) VALUES ($1) ON CONFLICT DO NOTHING`, [u]);
  await sa.end();
  await c.query(`INSERT INTO plan_prices VALUES ('price_m', 'premium', 'month', 'usd', 599, true), ('price_y', 'premium', 'year', 'usd', 5999, true)`);
  await as(c, 'service');
  for (const [i, u] of users.entries()) await c.query(`SELECT pf_upsert_billing_customer($1, $2)`, [u, `cus_T${i}`]);
  const evt = (id, type, sub, live, extra = {}) => c.query(`SELECT pf_record_stripe_event($1, $2, $3, $4::jsonb)`,
    [id, type, '2026-11-05T12:00:00Z', JSON.stringify({ id, type, livemode: live, data: { object: { object: 'invoice', subscription: sub, ...extra } } })]);
  // test-mode subscription: active, paid
  await c.query(`SELECT pf_sync_stripe_subscription('sub_T0', $1, 'cus_T0', 'active', 'price_m', now(), '2098-01-01', false, NULL, NULL, now())`, [users[0]]);
  await evt('evt_t1', 'invoice.paid', 'sub_T0', false, { amount_paid: 599, billing_reason: 'subscription_create' });
  await as(c, 'owner');
  const p = await one(c, `SELECT public.analytics_billing_metrics('2026-11-01', '2026-11-30')`);
  eq(p.status, 'pending', 'test-mode only => still pending');
  // a live-mode yearly subscription
  await as(c, 'service');
  await c.query(`SELECT pf_sync_stripe_subscription('sub_L1', $1, 'cus_T1', 'active', 'price_y', now(), '2098-01-01', false, NULL, NULL, now())`, [users[1]]);
  await evt('evt_l1', 'invoice.paid', 'sub_L1', true, { amount_paid: 5999, billing_reason: 'subscription_create' });
  await evt('evt_l2', 'invoice.payment_failed', 'sub_L1', true, { id: 'in_1' });
  await as(c, 'owner');
  const l = await one(c, `SELECT public.analytics_billing_metrics('2026-11-01', '2026-11-30')`);
  eq([l.status, l.active_paying, l.mrr_cents, l.arr_cents, l.paid_conversions, l.failed_payments, l.renewals, l.cancellations],
    ['live', 1, 500, 5999, 1, 1, 0, 0], 'live figures exclude the test-mode subscription');
  fs.writeFileSync(path.join(HERE, 'evidence', 'analytics-billing-fixture.json'), JSON.stringify({ note: 'SYNTHETIC live-mode Stripe data from analytics.test.js', billing: l }, null, 2) + '\n');
});


/* ---------------------------------------------------------------- the analytics-ingest Edge Function handler, end to end
 * The real handler module (supabase/functions/_shared/analytics-ingest.js) with its rpc wired to this throwaway database
 * as service_role, exactly as the Supabase client would call it. */
const HANDLER = path.join(REPO, 'supabase', 'functions', '_shared', 'analytics-ingest.js');
const SITE = 'https://www.gearhead-labs.com', CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
async function handlerFor(c, opts = {}) {
  const h = await import(require('url').pathToFileURL(HANDLER).href);
  const logs = [];
  const handle = h.makeAnalyticsIngestHandler({ enabled: opts.enabled !== false, log: (m) => logs.push(m), allow: opts.allow,
    config: { env: opts.env === undefined ? 'live' : opts.env, allowedOrigins: [SITE, 'http://localhost:8080'], addressSource: opts.source },
    rpc: async (fn, args) => { if (opts.calls) opts.calls.push(fn);
      if (opts.dbDown) return { error: { code: '08006' } };
      if (opts.seen) opts.seen.push(args.p_meta.net);
      await as(c, 'service'); try { await c.query(`SELECT public.${fn}($1::jsonb, $2::jsonb)`, [JSON.stringify(args.p_batch), JSON.stringify(args.p_meta)]); return { error: null }; }
      finally { await as(c, 'postgres'); } } });
  const post = (body, { origin = SITE, ua = CHROME, method = 'POST', raw, ip = '198.51.100.7', headers = {} } = {}) => handle(new Request('https://x.supabase.co/functions/v1/analytics-ingest',
    { method, headers: { origin, 'user-agent': ua, 'content-type': 'text/plain;charset=UTF-8', 'x-forwarded-for': ip + ', 10.0.0.1', ...headers },
      body: method === 'POST' ? (raw !== undefined ? raw : JSON.stringify(body)) : undefined }));
  return { h, post, logs, handle };
}
const rows = async (c) => q(c, `SELECT env, name, ua_family, bot FROM analytics_events ORDER BY id`);
const stat = async (c, outcome) => (await q(c, `SELECT env, reason, n::int FROM analytics_ingest_stats WHERE outcome = $1 ORDER BY env, reason`, [outcome])).map(r => `${r.env}:${r.reason}=${r.n}`);

check('environment', 'the environment is fixed by the deployment: a forged production Origin or a page-supplied env cannot make events live', async (c) => {
  await as(c, 'postgres');
  const test = await handlerFor(c, { env: 'test' });
  // a script sends the real site's Origin and claims "live" to a TEST deployment: rejected whole, nothing stored
  eq((await test.post({ env: 'live', events: [ev('page_view')] }, { origin: SITE })).status, 204, '204');
  eq(await rows(c), [], 'forged origin + env:live -> nothing stored');
  // the same forged Origin with the honest env is stored as TEST — the Origin decides nothing
  await test.post({ env: 'test', events: [ev('page_view')] }, { origin: SITE });
  // no env at all -> rejected
  await test.post({ events: [ev('page_view')] }, { origin: SITE });
  eq((await rows(c)).map(r => r.env), ['test'], 'only the matching batch, stored as test');
  // a LIVE deployment: a page claiming "test" or "dev" cannot route its events elsewhere either; localhost Origin changes nothing
  const live = await handlerFor(c, { env: 'live' });
  await live.post({ env: 'test', events: [ev('page_view')] }, { origin: 'http://localhost:8080' });
  await live.post({ env: 'dev', events: [ev('page_view')] });
  await live.post({ env: 'live', events: [ev('page_view')] }, { origin: 'http://localhost:8080' });
  eq((await rows(c)).map(r => r.env), ['test', 'live'], 'live deployment stores only live, and only when the page agrees');
  eq(await stat(c, 'rejected'), ['live:env_mismatch=2', 'test:env_mismatch=2'], 'mismatches counted in Data health');
  // directly at the database: the service caller's env wins; a missing/foreign client_env is refused
  await as(c, 'service');
  eq((await ingest(c, [ev('page_view')], { env: 'test', client_env: 'live' })).reason, 'env_mismatch', 'db: claimed live');
  eq((await ingest(c, [ev('page_view')], { env: 'test' })).reason, 'env_mismatch', 'db: no claim');
  eq((await ingest(c, [ev('page_view')], { env: 'production', client_env: 'production' })).reason, 'bad_env', 'db: unknown env');
  // an unconfigured deployment accepts nothing
  await as(c, 'postgres');
  const none = await handlerFor(c, { env: '' }); await none.post({ env: 'live', events: [ev('page_view')] });
  eq((await rows(c)).length, 2, 'no ANALYTICS_ENV -> dropped');
});

check('limits', 'per-network limits: 600 per 10 min and 5,000 per day per address; IPv6 grouped by /56; addresses never stored', async (c) => {
  await as(c, 'service');
  const batch = (k) => Array.from({ length: 20 }, (_, i) => ev('page_view', { sid: uuid(3, 1000 + k * 20 + i) }));
  const send = (k, net) => ingest(c, batch(k), { ...META, net });
  for (let k = 0; k < 30; k++) eq((await send(k, '198.51.100.7')).accepted, 20, 'within limit ' + k);          // 600 = the 10-minute limit
  eq((await send(30, '198.51.100.7')).reason, 'net_10min', '601st event in 10 minutes');
  eq((await send(31, '198.51.100.8')).accepted, 20, 'another address is unaffected');
  for (let k = 0; k < 30; k++) await send(100 + k, '2001:db8:1:2::1');
  eq((await send(140, '2001:db8:1:2:ffff:ffff:ffff:fffe')).reason, 'net_10min', 'same IPv6 /64 shares the limit');
  eq((await send(141, '2001:db8:1:7f::1')).reason, 'net_10min', 'another /64 in the same /56 shares it too (rotating /64s gains nothing)');
  eq((await send(142, '2001:db8:1:100::1')).accepted, 20, 'the next /56 is unaffected');
  await as(c, 'postgres');
  await c.query(`UPDATE analytics_rate SET n = 5000 WHERE kind = 'net_day'`);                                   // a day's worth already used
  await c.query(`DELETE FROM analytics_rate WHERE kind = 'net_10min'`);
  await as(c, 'service');
  eq((await send(150, '198.51.100.8')).reason, 'net_day', 'daily limit');
  await as(c, 'postgres');
  eq(await stat(c, 'rate_limited'), ['test:net_10min=60', 'test:net_day=20'], 'counted in Data health');
  for (const t of ['analytics_events', 'analytics_ingest_stats', 'analytics_rate', 'analytics_rate_salt', 'analytics_sessions', 'analytics_daily', 'analytics_visitors'])
    eq(+(await one(c, `SELECT count(*) FROM public.${t} x WHERE x::text ~ '198\\.51|2001:db8|203\\.0\\.113|\\\\x[0-9a-f]*c63364'`)), 0, 'address in ' + t);
  eq(+(await one(c, `SELECT count(DISTINCT octet_length(key)) FROM analytics_rate`)), 1, 'keys are fixed-length hashes');
  eq(+(await one(c, `SELECT count(*) FROM analytics_rate_salt`)), 1, 'one salt (today)');
  await c.query(`INSERT INTO analytics_rate_salt (day) VALUES (current_date - 5)`);
  await c.query(`INSERT INTO analytics_rate (kind, key, win_start, n) VALUES ('net_day', '\\x00', now() - interval '3 days', 1)`);
  await c.query(`SELECT public.analytics_purge()`);
  eq([+(await one(c, `SELECT count(*) FROM analytics_rate_salt WHERE day < current_date - 1`)), +(await one(c, `SELECT count(*) FROM analytics_rate WHERE win_start < now() - interval '2 days'`))], [0, 0], 'old salts and counters purged');
});
check('limits', 'unknown address: missing, malformed, ranges and junk all share ONE small allowance (300 per 10 min, 2,000 per day)', async (c) => {
  await as(c, 'service');
  const batch = (k, n = 20) => Array.from({ length: n }, (_, i) => ev('page_view', { sid: uuid(3, 3000 + k * 20 + i) }));
  const odd = [undefined, '', 'unknown', 'not-an-ip', '10.0.0.0/8', '2001:db8::/32', '1.2.3', '01.2.3.4', '1.2.3.4:443', 'fe80::1%eth0', '999.1.1.1'];
  for (let k = 0; k < 15; k++) eq((await ingest(c, batch(k), { ...META, net: odd[k % odd.length] })).accepted, 20, 'shared allowance ' + k);   // 300
  eq((await ingest(c, batch(15), { ...META, net: '1.2.3.4:443' })).reason, 'unknown_10min', 'a "new" malformed value is the same identity');
  await as(c, 'postgres');
  eq(+(await one(c, `SELECT count(DISTINCT key) FROM analytics_rate WHERE kind = 'net_10min'`)), 1, 'eleven different junk values -> one counter');
  await c.query(`DELETE FROM analytics_rate WHERE kind = 'net_10min'`); await c.query(`UPDATE analytics_rate SET n = 2000 WHERE kind = 'net_day'`);
  await as(c, 'service');
  eq((await ingest(c, batch(16), { ...META, net: 'junk' })).reason, 'unknown_day', 'daily unknown allowance');
  eq((await ingest(c, batch(17), { ...META, net: '198.51.100.20' })).accepted, 20, 'a real address is not affected by the unknown allowance');
});
check('limits', 'project ceilings: 2,000 per hour and 10,000 per day for ALL environments together, checked first; refused batches create no rows', async (c) => {
  await as(c, 'postgres');
  eq(await one(c, `SELECT public.analytics_limits()`), { storage_mb: 150, rollup_headroom_mb: 32, batch_reserve_bytes: 262144, event_reserve_bytes: 2048,
    global_day: 10000, global_hour: 2000, net_10min: 600, net_day: 5000, unknown_10min: 300, unknown_day: 2000, refusal_exact_events: 2000, refusal_sample_seconds: 60 }, 'limits');
  await as(c, 'service');
  const batch = (k) => Array.from({ length: 20 }, (_, i) => ev('page_view', { sid: uuid(3, 5000 + k * 20 + i) }));
  // 100 batches of 20 from 100 DIFFERENT addresses (rotation) = 2,000: exactly the hourly ceiling
  for (let k = 0; k < 100; k++) eq((await ingest(c, batch(k), { ...META, net: '203.0.113.' + (k + 1) })).accepted, 20, 'within hour ' + k);
  await as(c, 'postgres');
  const before = +(await one(c, `SELECT count(*) FROM analytics_rate`));
  await as(c, 'service');
  for (let k = 100; k < 140; k++) eq((await ingest(c, batch(k), { ...META, net: '192.0.2.' + (k - 99) })).reason, 'global_hour', 'rotation cannot pass the hourly ceiling ' + k);
  await as(c, 'postgres');
  eq(+(await one(c, `SELECT count(*) FROM analytics_rate`)), before, '40 refused batches from 40 new addresses created no counter rows');
  eq(+(await one(c, `SELECT n FROM analytics_rate WHERE kind = 'global_hour'`)), 2000, 'hour counter not inflated by refused batches');
  eq(+(await one(c, `SELECT count(*) FROM analytics_events WHERE env = 'test'`)), 2000, 'stored = ceiling');
  // daily ceiling enforced on its own: a fresh hour, but the day is used up
  await c.query(`UPDATE analytics_rate SET n = 0 WHERE kind = 'global_hour'`); await c.query(`UPDATE analytics_rate SET n = 9990 WHERE kind = 'global_day'`);
  await as(c, 'service');
  eq((await ingest(c, batch(150), { ...META, net: '198.51.100.99' })).reason, 'global_day', 'daily ceiling (9,990 + 20 > 10,000)');
  await as(c, 'postgres');
  eq([+(await one(c, `SELECT n FROM analytics_rate WHERE kind = 'global_day'`)), +(await one(c, `SELECT n FROM analytics_rate WHERE kind = 'global_hour'`))], [9990, 0], 'nothing reserved by the refused batch');
  eq(+(await one(c, `SELECT count(*) FROM analytics_rate WHERE kind LIKE 'net_%'`)), 200, 'no per-network row for it either (100 addresses x 2 windows, unchanged)');
  await as(c, 'service');
  eq((await ingest(c, batch(151).slice(0, 10), { ...META, net: '198.51.100.99' })).accepted, 10, 'exactly up to the ceiling');
  eq((await ingest(c, batch(152), { env: 'dev', client_env: 'dev', net: '198.51.100.99' })).reason, 'global_day', 'another environment shares the project ceiling (a day can never hold more than 10,000 events)');
  await as(c, 'postgres');
  eq(await stat(c, 'rate_limited'), ['dev:global_day=20', 'test:global_day=20', 'test:global_hour=800'], 'counted in Data health');
});
check('limits', 'storage budget: when analytics tables exceed storage_mb nothing more is accepted and no counter changes (Premium space protected)', async (c) => {
  await as(c, 'postgres');
  eq((await one(c, `SELECT public.analytics_limits()`)).storage_mb, 150, 'default budget 150 MB');
  const lim = await one(c, `SELECT pg_get_functiondef('public.analytics_limits()'::regprocedure)`);
  await c.query(lim.replace('"storage_mb": 150', '"storage_mb": 0'));                 // inside this rolled-back test only
  await as(c, 'service');
  eq((await ingest(c, [ev('page_view', { sid: uuid(3, 9700) })], { ...META, net: '198.51.100.70' })).reason, 'storage_cap', 'refused');
  await as(c, 'postgres');
  eq([+(await one(c, `SELECT count(*) FROM analytics_events`)), +(await one(c, `SELECT count(*) FROM analytics_rate`))], [0, 0], 'nothing stored, no counter created');
  eq(await stat(c, 'rate_limited'), ['test:storage_cap=1'], 'visible in Data health');
});
check('limits', 'one network over ITS limit gives the reservation back: it cannot use up the environment budget', async (c) => {
  await as(c, 'service');
  const batch = (k) => Array.from({ length: 20 }, (_, i) => ev('page_view', { sid: uuid(3, 8000 + k * 20 + i) }));
  for (let k = 0; k < 30; k++) await ingest(c, batch(k), { ...META, net: '198.51.100.50' });                 // 600: its 10-minute limit
  for (let k = 30; k < 80; k++) eq((await ingest(c, batch(k), { ...META, net: '198.51.100.50' })).reason, 'net_10min', 'refused ' + k);
  await as(c, 'postgres');
  eq([+(await one(c, `SELECT n FROM analytics_rate WHERE kind = 'global_hour'`)), +(await one(c, `SELECT n FROM analytics_rate WHERE kind = 'global_day'`))], [600, 600], '1,000 refused events did not consume the global budget');
});

check('limits', 'storage gate counts the batch: accepted only if size + batch reserve + events x event reserve fits under the ingest threshold', async (c) => {
  await as(c, 'postgres');
  const B = +(await one(c, `SELECT public.analytics_storage_bytes()`)); const MB = 1048576;
  const storage = Math.ceil(B / MB) + 1, room = storage * MB - B;            // room under the threshold: between 1 and 2 MB
  const lim = await one(c, `SELECT pg_get_functiondef('public.analytics_limits()'::regprocedure)`);
  await c.query(lim.replace('"storage_mb": 150, "rollup_headroom_mb": 32, "batch_reserve_bytes": 262144, "event_reserve_bytes": 2048',
    `"storage_mb": ${storage}, "rollup_headroom_mb": 0, "batch_reserve_bytes": ${room - 10000}, "event_reserve_bytes": 1000`));   // rolled back
  await as(c, 'service');
  eq((await ingest(c, Array.from({ length: 20 }, (_, i) => ev('page_view', { sid: uuid(3, 9800 + i) })), { ...META, net: '198.51.100.71' })).reason, 'storage_cap', '20 events need reserve + 20,000 bytes > room: refused');
  eq((await ingest(c, [ev('page_view', { sid: uuid(3, 9830) })], { ...META, net: '198.51.100.71' })).accepted, 1, '1 event needs reserve + 1,000 bytes <= room: accepted');
  await as(c, 'postgres');
  ok(+(await one(c, `SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid() AND granted`)) === 1, 'an accepted batch holds the analytics write lock until its transaction ends');
});
check('limits', 'a batch refused before the lock takes no lock and writes no counter; the refusal writes at most its Data health row', async (c) => {
  await as(c, 'postgres'); await c.query(`INSERT INTO analytics_rate (kind, key, win_start, n) VALUES ('global_hour', sha256(convert_to('global|project', 'UTF8')), date_trunc('hour', now()), 2000)`);
  await as(c, 'service');
  eq((await ingest(c, [ev('page_view', { sid: uuid(3, 9840) })], { ...META, net: '198.51.100.72' })).reason, 'global_hour', 'refused');
  await as(c, 'postgres');
  eq(+(await one(c, `SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid()`)), 0, 'no lock taken');
  eq([+(await one(c, `SELECT count(*) FROM analytics_rate`)), +(await one(c, `SELECT count(*) FROM analytics_rate_salt`))], [1, 0], 'no counter, no salt created');
});
check('limits', 'refusal counting is bounded: exact up to 2,000 per day and reason, then at most one update a minute (a lower bound)', async (c) => {
  await as(c, 'postgres'); await c.query(`INSERT INTO analytics_rate (kind, key, win_start, n) VALUES ('global_hour', sha256(convert_to('global|project', 'UTF8')), date_trunc('hour', now()), 2000)`);
  await as(c, 'service');
  for (let k = 0; k < 105; k++) await ingest(c, Array.from({ length: 20 }, (_, i) => ev('page_view', { sid: uuid(3, 20000 + k * 20 + i) })), { ...META, net: '198.51.100.73' });   // 2,100 refused events
  await as(c, 'postgres');
  eq(await stat(c, 'rate_limited'), ['test:global_hour=2000'], 'exact to 2,000, then not written within the minute');
  const xmin = await one(c, `SELECT xmin::text FROM analytics_ingest_stats WHERE outcome = 'rate_limited'`);
  await as(c, 'service'); await ingest(c, [ev('page_view', { sid: uuid(3, 22200) })], { ...META, net: '198.51.100.73' });
  await as(c, 'postgres');
  eq(await one(c, `SELECT xmin::text FROM analytics_ingest_stats WHERE outcome = 'rate_limited'`), xmin, 'quiet period: the row was not rewritten');
  await c.query(`UPDATE analytics_ingest_stats SET last_at = now() - interval '61 seconds' WHERE outcome = 'rate_limited'`);
  await as(c, 'service'); await ingest(c, [ev('page_view', { sid: uuid(3, 22201) })], { ...META, net: '198.51.100.73' });
  await as(c, 'postgres');
  eq(await stat(c, 'rate_limited'), ['test:global_hour=2001'], 'after a minute the next refusal is recorded');
});
check('limits', 'rollups are gated by the storage budget too: no rollup that could pass it; purge still deletes on time', async (c) => {
  await as(c, 'postgres');
  await put(c, NY('2026-11-03', '12:00'), ev('page_view', { sid: uuid(3, 9850) }));
  const lim = await one(c, `SELECT pg_get_functiondef('public.analytics_limits()'::regprocedure)`);
  await c.query(lim.replace('"storage_mb": 150', '"storage_mb": 0'));                 // rolled back
  eq(+(await one(c, `SELECT public.analytics_rollup_pending()`)), -1, 'stopped at the gate');
  eq([+(await one(c, `SELECT count(*) FROM analytics_sessions`)), +(await one(c, `SELECT count(*) FROM analytics_daily`)), +(await one(c, `SELECT count(*) FROM analytics_rollup_runs`))], [0, 0, 0], 'nothing written');
  const old = ev('page_view', { sid: uuid(3, 9851) }); await put(c, new Date(Date.now() - 40 * 86400000).toISOString(), old);
  const r = await one(c, `SELECT public.analytics_purge()`);
  eq([r.events >= 1, r.days_purged_without_rollup >= 1], [true, true], 'raw rows deleted on time; the un-rolled day is reported');
  eq(+(await one(c, `SELECT count(*) FROM analytics_events WHERE event_id = $1`, [old.event_id])), 0, '40-day-old event gone');
});
check('health', 'Data health reports storage used, the ingest stop point, the budget and how refusals are counted', async (c) => {
  await as(c, 'owner');
  const h = (await one(c, `SELECT public.analytics_dashboard('2026-11-01', '2026-11-07', 'test')`)).health;
  ok(h.storage.used_bytes > 0, 'used');
  eq([h.storage.budget_bytes, h.storage.ingest_stops_at_bytes], [150 * 1048576, 118 * 1048576], 'budget and stop point');
  eq(h.refusal_counting, { exact_up_to_events: 2000, then_at_most_one_update_per_seconds: 60 }, 'refusal counting');
});

check('edge', 'sender address: the left-most X-Forwarded-For entry is NEVER trusted; the source is a deployment setting (default none)', async (c) => {
  const h = await import(require('url').pathToFileURL(HANDLER).href);
  const R = (hd) => new Request('https://x.supabase.co/functions/v1/analytics-ingest', { method: 'POST', headers: hd });
  const forged = { 'x-forwarded-for': '6.6.6.6, 198.51.100.7', 'cf-connecting-ip': '198.51.100.7', 'x-real-ip': '6.6.6.6' };
  eq(h.senderNetwork(R(forged)), '', 'default (none): nothing trusted');
  eq(h.senderNetwork(R(forged), 'none'), '', 'none');
  eq(h.senderNetwork(R(forged), 'cf-connecting-ip'), '198.51.100.7', 'cf-connecting-ip: the platform value, not the forged first entry');
  eq(h.senderNetwork(R(forged), 'xff-right-1'), '198.51.100.7', 'xff-right-1: the hop the platform appended');
  eq(h.senderNetwork(R({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7, 198.51.100.7, 10.1.2.3' }), 'xff-right-2'), '198.51.100.7', 'xff-right-2: one platform proxy after it');
  eq(h.senderNetwork(R({ 'x-forwarded-for': '198.51.100.7' }), 'xff-right-2'), '', 'chain shorter than the setting: unknown, not the first entry');
  eq(h.senderNetwork(R({}), 'cf-connecting-ip'), '', 'missing header: unknown');
  eq(h.senderNetwork(R({}), 'xff-right-1'), '', 'missing chain: unknown');
  eq(h.senderNetwork(R({ 'cf-connecting-ip': '198.51.100.7, 6.6.6.6' }), 'cf-connecting-ip'), '', 'a list where one address is expected: unknown');
  eq(h.senderNetwork(R({ 'x-forwarded-for': '6.6.6.6,' }), 'xff-right-1'), '', 'empty right-most hop: unknown');
  eq(h.senderNetwork(R(forged), 'something-else'), '', 'unrecognised setting falls back to nothing trusted');
});
check('edge', 'sender address parsing: exact IPv4 / IPv6 only; malformed values are "unknown"; IPv6 normalised; IPv4-mapped reduced', async (c) => {
  const h = await import(require('url').pathToFileURL(HANDLER).href);
  const cases = [['198.51.100.7', '198.51.100.7'], [' 203.0.113.9 ', '203.0.113.9'], ['0.0.0.0', '0.0.0.0'], ['255.255.255.255', '255.255.255.255'],
    ['256.1.1.1', ''], ['1.2.3', ''], ['01.2.3.4', ''], ['1.2.3.4.5', ''], ['1.2.3.4:443', ''], ['1.2.3.4/24', ''], ['example.com', ''], ['', ''], ['unknown', ''],
    ['2001:DB8::1', '2001:db8::1'], ['2001:0db8:0000:0000:0000:0000:0000:0001', '2001:db8::1'], ['::1', '::1'], ['::ffff:198.51.100.7', '198.51.100.7'],
    ['::ffff:c633:6407', '198.51.100.7'], ['fe80::1%eth0', ''], ['[2001:db8::1]', ''], ['2001:db8::1::2', ''], ['2001:db8:::1', ''], ['x'.repeat(60), ''], [null, ''], ['1.2.3.4 5.6.7.8', '']];
  for (const [i, o] of cases) eq(h.parseAddress(i), o, 'parse ' + JSON.stringify(i));
});
check('edge', 'end to end: forged first entries from one real network map to ONE counter; repeated requests share it; default setting uses the unknown allowance', async (c) => {
  await as(c, 'postgres');
  const seen = [];
  const { post } = await handlerFor(c, { source: 'xff-right-1', seen });
  for (let i = 0; i < 25; i++) await post({ env: 'live', events: [ev('page_view', { sid: uuid(3, 9000 + i) })] }, { ip: `6.6.${i}.${i}`, headers: { 'x-forwarded-for': `6.6.${i}.${i}, 198.51.100.7` } });
  eq([...new Set(seen)], ['198.51.100.7'], '25 rotating forged first entries -> the one platform-appended address');
  eq(+(await one(c, `SELECT count(DISTINCT key) FROM analytics_rate WHERE kind = 'net_10min'`)), 1, 'one network counter');
  eq(+(await one(c, `SELECT n FROM analytics_rate WHERE kind = 'net_10min'`)), 25, 'repeated requests accumulate on it');
  const seen2 = [];
  const d = await handlerFor(c, { seen: seen2 });                                                     // no setting: none
  await d.post({ env: 'live', events: [ev('page_view', { sid: uuid(3, 9100) })] }, { headers: { 'cf-connecting-ip': '198.51.100.9' } });
  eq(seen2, [''], 'nothing trusted by default');
});

check('edge', 'handler: UA reduced to a family; network passed for hashing only; always 204; CORS only for allowed origins', async (c) => {
  await as(c, 'postgres'); const { post, logs } = await handlerFor(c);
  const r = await post({ env: 'live', events: [ev('page_view')] });
  eq([r.status, await r.text(), r.headers.get('access-control-allow-origin')], [204, '', SITE], 'response');
  eq(await rows(c), [{ env: 'live', name: 'page_view', ua_family: 'Chrome', bot: false }], 'stored');
  eq(+(await one(c, `SELECT count(*) FROM analytics_events WHERE props::text LIKE '%198.51%' OR ua_family LIKE '%Windows%'`)), 0, 'no IP / full UA stored');
  ok(!logs.join(' ').match(/198\.51/), 'no address logged');
});
check('edge', 'LIMITATION made explicit: a script that copies a browser\'s headers is accepted like a visitor (only limits and bot rules bound it)', async (c) => {
  await as(c, 'postgres'); const { post } = await handlerFor(c);
  await post({ env: 'live', events: [ev('page_view')] }, { ua: 'curl/8.5.0' });                  // an honest script: flagged bot
  await post({ env: 'live', events: [ev('page_view')] });                                         // a script forging Origin + Chrome UA
  eq((await rows(c)).map(r => [r.env, r.bot]), [['live', true], ['live', false]], 'the forged one is indistinguishable from a visitor');
});
check('edge', 'handler: refuses foreign origins, GET, oversize bodies, >20 events, junk JSON and the kill switch; never errors', async (c) => {
  await as(c, 'postgres');
  const { post, logs } = await handlerFor(c);
  const results = [
    await post({ env: 'live', events: [ev('page_view')] }, { origin: 'https://evil.example' }),
    await post({ env: 'live', events: [ev('page_view')] }, { origin: '' }),
    await post(null, { method: 'GET' }),
    await post(null, { raw: 'x'.repeat(9000) }),
    await post({ env: 'live', events: Array.from({ length: 21 }, () => ev('page_view')) }),
    await post(null, { raw: '{not json' }),
    await post(null, { raw: '{"env":"live","events":{"0":1}}' }),
    await post({ env: 'live', events: [ev('page_view')] }, { ua: 'Googlebot/2.1 (+http://www.google.com/bot.html)' }),
    await post({ env: 'live', events: [ev('page_view')], wd: true }),
    await post({ env: 'live', events: [ev('page_view')], client_errors: 3, client_dropped: -4 }),
  ];
  eq(results.map(r => r.status), Array(10).fill(204), 'always 204');
  eq(results[0].headers.get('access-control-allow-origin'), null, 'no CORS grant for a foreign origin');
  eq(await rows(c), [{ env: 'live', name: 'page_view', ua_family: 'Bot', bot: true }, { env: 'live', name: 'page_view', ua_family: 'Chrome', bot: true },
    { env: 'live', name: 'page_view', ua_family: 'Chrome', bot: false }], 'only the three valid batches are stored (two flagged bot)');
  eq(await stat(c, 'rejected'), ['live:bad_batch=4'], 'oversize / >20 / junk / non-array counted as rejected');
  eq(await stat(c, 'client_error'), ['live:=3'], 'client error counter; negative ignored');
  ok(logs.filter(l => l === 'analytics-ingest: origin refused').length === 2, 'logged');
  ok(!logs.join(' ').match(/198\.51|page_view|Windows/), 'logs carry no IP, payload or user agent');
  const off = await handlerFor(c, { enabled: false });
  eq((await off.post({ env: 'live', events: [ev('page_view')] })).status, 204, 'disabled still 204');
  eq((await rows(c)).length, 3, 'kill switch stores nothing');
});
/* ---------------------------------------------------------------- B2: the receiver's byte limit (B1)
 * The body is read as a stream and at most 8,192 BYTES are accepted, whatever Content-Length says. Bodies are built here as
 * ReadableStreams with highWaterMark 0, so a chunk is produced only when the receiver asks for it: `st` records how many
 * chunks / bytes were pulled and whether the receiver cancelled the stream. The existing check above ("refuses foreign origins,
 * GET, oversize bodies ...") is unchanged and is B2-17. */
const enc = (s) => new TextEncoder().encode(s);
function chunked(chunks, { errorAt } = {}) {
  const st = { pulled: 0, bytes: 0, cancelled: false }; let i = 0;
  const stream = new ReadableStream({
    pull(ctrl) {
      if (errorAt !== undefined && i === errorAt) { st.pulled++; ctrl.error(new TypeError('connection reset')); return; }
      if (i >= chunks.length) { ctrl.close(); return; }
      const ch = chunks[i++]; st.pulled++; st.bytes += ch.byteLength; ctrl.enqueue(ch);
    },
    cancel() { st.cancelled = true; } }, { highWaterMark: 0 });
  return { stream, st };
}
const splitBytes = (b, size) => { const out = []; for (let o = 0; o < b.length; o += size) out.push(b.slice(o, o + size)); return out; };
const bodyReq = (body, { method = 'POST', origin = SITE, headers = {} } = {}) => new Request('https://x.supabase.co/functions/v1/analytics-ingest',
  { method, headers: { origin, 'user-agent': CHROME, 'content-type': 'text/plain;charset=UTF-8', 'x-forwarded-for': '198.51.100.9', ...headers },
    ...(body === undefined ? {} : { body, duplex: 'half' }) });
/* A valid one-event batch (env live), optionally with an extra ignored field, padded with spaces (JSON ignores them) to exactly n bytes. */
function padded(n, pad = '') {
  const s = JSON.stringify(pad ? { env: 'live', events: [ev('page_view')], pad } : { env: 'live', events: [ev('page_view')] });
  const b = enc(s); if (b.length > n) throw new Error(`batch is ${b.length} bytes, more than ${n}`);
  const out = new Uint8Array(n); out.set(b); out.fill(0x20, b.length); return out;
}
const bad = async (c) => stat(c, 'rejected');

check('edge-bytes', 'B2-1 no Content-Length, exactly 8,192 bytes of a valid batch: accepted, stored once, stream read to the end', async (c) => {
  await as(c, 'postgres'); const calls = [];
  const { handle } = await handlerFor(c, { calls });
  const b = padded(8192); eq(b.length, 8192, 'body is exactly the limit');
  const { stream, st } = chunked(splitBytes(b, 1000));
  eq((await handle(bodyReq(stream))).status, 204, '204');
  eq([calls.length, (await rows(c)).length, st.cancelled, st.bytes], [1, 1, false, 8192], 'stored once; not cancelled; every byte read');
});
check('edge-bytes', 'B2-2 no Content-Length, 8,193 bytes: refused as bad_batch (reported, as before), nothing stored, reader cancelled, reading bounded', async (c) => {
  await as(c, 'postgres'); const calls = [];
  const { handle } = await handlerFor(c, { calls });
  const { stream, st } = chunked(splitBytes(padded(8193), 1024));
  eq((await handle(bodyReq(stream))).status, 204, '204');
  eq([(await rows(c)).length, await bad(c), calls.length], [0, ['live:bad_batch=1'], 1], 'not stored; counted as bad_batch');
  ok(st.cancelled, 'reader cancelled');
  ok(st.bytes <= 8192 + 1024, `pulled ${st.bytes} bytes: at most the limit plus one chunk`);
});
check('edge-bytes', 'B2-3 Content-Length: 100 but a 20 KB body: the declared length is not trusted; refused at 8,192 bytes, cancelled', async (c) => {
  await as(c, 'postgres');
  const { handle } = await handlerFor(c);
  const { stream, st } = chunked(splitBytes(padded(20480), 4096));
  eq((await handle(bodyReq(stream, { headers: { 'content-length': '100' } }))).status, 204, '204');
  eq([(await rows(c)).length, await bad(c)], [0, ['live:bad_batch=1']], 'not stored; counted');
  ok(st.cancelled && st.bytes <= 8192 + 4096, `cancelled after ${st.bytes} bytes`);
});
check('edge-bytes', 'B2-4 Content-Length: 9000 declared: refused before any byte is read (unchanged), nothing stored or counted', async (c) => {
  await as(c, 'postgres'); const calls = [];
  const { handle, logs } = await handlerFor(c, { calls });
  const { stream, st } = chunked(splitBytes(padded(9000), 1024));
  eq((await handle(bodyReq(stream, { headers: { 'content-length': '9000' } }))).status, 204, '204');
  eq([st.pulled, calls.length, (await rows(c)).length, await bad(c)], [0, 0, 0, []], 'body never read; database never called');
  ok(logs.includes('analytics-ingest: too large'), 'logged');
});
check('edge-bytes', 'B2-5 the limit counts BYTES: 3,000 "€" (9,000+ bytes, about 3,100 characters) around a valid batch is refused', async (c) => {
  await as(c, 'postgres');
  const { handle } = await handlerFor(c);
  const text = JSON.stringify({ env: 'live', events: [ev('page_view')], pad: '€'.repeat(3000) });
  ok(text.length < 8192 && enc(text).length > 8192, `characters ${text.length} < 8,192 < bytes ${enc(text).length} (the previous character count accepted this)`);
  const { stream } = chunked(splitBytes(enc(text), 1500));
  eq((await handle(bodyReq(stream))).status, 204, '204');
  eq([(await rows(c)).length, await bad(c)], [0, ['live:bad_batch=1']], 'refused, not stored');
});
check('edge-bytes', 'B2-6 a typical page-close beacon (text/plain, about 2.5 KB, ten events) is accepted unchanged', async (c) => {
  await as(c, 'postgres');
  const { post } = await handlerFor(c);
  const batch = { env: 'live', events: Array.from({ length: 10 }, (_, i) => ev('page_view', { sid: uuid(3, 7100 + i) })) };
  const size = enc(JSON.stringify(batch)).length; ok(size > 2000 && size < 7800, `beacon is ${size} bytes`);
  eq((await post(batch)).status, 204, '204');
  eq((await rows(c)).length, 10, 'all ten stored');
});
check('edge-bytes', 'B2-7 invalid UTF-8 and a byte-order mark within the limit: decoded exactly as req.text() did (behaviour unchanged), event stored', async (c) => {
  await as(c, 'postgres');
  const { h, handle } = await handlerFor(c);
  const samples = [[0xff, 0xfe], [0x80, 0x41], [0xe2, 0x82], [0xc0, 0xaf], [0xed, 0xa0, 0x80]];
  for (const s of samples) {
    const bytes = new Uint8Array([...enc('{"a":"'), ...s, ...enc('"}')]);
    const before = await new Request('https://x/', { method: 'POST', body: bytes }).text();
    const now = (await h.readBodyLimited(new Request('https://x/', { method: 'POST', body: bytes }))).text;
    eq(now, before, 'same text as req.text() for bytes ' + s.map(x => x.toString(16)).join(' '));
  }
  const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...enc('{}')]);
  eq((await h.readBodyLimited(new Request('https://x/', { method: 'POST', body: bom }))).text, await new Request('https://x/', { method: 'POST', body: bom }).text(), 'BOM handled as before');
  const s = JSON.stringify({ env: 'live', events: [ev('page_view')], pad: 'XX' });
  const i = s.indexOf('XX'); const b = enc(s);
  const withInvalid = new Uint8Array([...b.slice(0, i), 0xff, 0xfe, ...b.slice(i + 2)]);
  eq((await handle(bodyReq(new Uint8Array([0xef, 0xbb, 0xbf, ...withInvalid])))).status, 204, '204');
  eq((await rows(c)).length, 1, 'stored, as before (invalid bytes in an ignored field became U+FFFD)');
});
check('edge-bytes', 'B2-8 one 64 KB chunk: refused without copying any of it; reader cancelled', async (c) => {
  await as(c, 'postgres');
  const { h, handle } = await handlerFor(c);
  const big = () => chunked([padded(65536)]);
  const a = big(); const r = await h.readBodyLimited(bodyReq(a.stream));
  eq([r.oversize, r.bytes, r.text, a.st.cancelled], [true, 0, null, true], 'oversize; 0 bytes kept; cancelled');
  const b = big(); eq((await handle(bodyReq(b.stream))).status, 204, '204');
  eq([(await rows(c)).length, await bad(c)], [0, ['live:bad_batch=1']], 'not stored');
});
check('edge-bytes', 'B2-9 exactly 8,192 bytes followed by one more non-empty chunk: refused', async (c) => {
  await as(c, 'postgres');
  const { h, handle } = await handlerFor(c);
  const mk = () => chunked([...splitBytes(padded(8192), 2048), enc(' ')]);
  const a = mk(); const r = await h.readBodyLimited(bodyReq(a.stream));
  eq([r.oversize, r.bytes, a.st.cancelled], [true, 8192, true], 'oversize after keeping exactly 8,192 bytes');
  const b = mk(); eq((await handle(bodyReq(b.stream))).status, 204, '204');
  eq([(await rows(c)).length, await bad(c)], [0, ['live:bad_batch=1']], 'not stored');
});
check('edge-bytes', 'B2-10 a 3-byte character crossing the limit (8,191 + 3 bytes, whole or split): refused', async (c) => {
  await as(c, 'postgres');
  const { h } = await handlerFor(c);
  const base = padded(8191), euro = enc('€');
  const whole = chunked([base, euro]); const r1 = await h.readBodyLimited(bodyReq(whole.stream));
  eq([r1.oversize, r1.bytes, whole.st.cancelled], [true, 8191, true], 'whole character: refused, 8,191 kept');
  const cut = chunked([new Uint8Array([...base, euro[0]]), euro.slice(1)]); const r2 = await h.readBodyLimited(bodyReq(cut.stream));
  eq([r2.oversize, r2.bytes, cut.st.cancelled], [true, 8192, true], 'split character: refused, 8,192 kept');
});
check('edge-bytes', 'B2-11 a valid multibyte character split across chunks inside a valid batch: decoded correctly and stored', async (c) => {
  await as(c, 'postgres');
  const { h, handle } = await handlerFor(c);
  const b = padded(4000, 'ü€𝄞'); const s = new TextDecoder().decode(b);
  const at = enc(s.slice(0, s.indexOf('€'))).length + 1;                 // cut inside the 3-byte "€"
  const four = enc(s.slice(0, s.indexOf('𝄞'))).length + 2;                // cut inside the 4-byte "𝄞"
  const parts = () => [b.slice(0, at), b.slice(at, four), b.slice(four)];
  const a = chunked(parts()); eq((await h.readBodyLimited(bodyReq(a.stream))).text, s, 'decoded text equals the original');
  const x = chunked(parts()); eq((await handle(bodyReq(x.stream))).status, 204, '204');
  eq((await rows(c)).length, 1, 'stored');
});
check('edge-bytes', 'B2-12 Content-Length missing, empty, non-numeric or negative counts as absent (body read and judged by its bytes); a declared 9000.5 is still refused early', async (c) => {
  await as(c, 'postgres');
  const { handle, h } = await handlerFor(c);
  eq([h.declaredLength(null), h.declaredLength(''), h.declaredLength('abc'), h.declaredLength('-5'), h.declaredLength('1e4'), h.declaredLength(' 120 '), h.declaredLength('9000.5')],
    [null, null, null, null, null, 120, 9000.5], 'parsing');
  for (const v of ['', 'abc', '-5']) eq((await handle(bodyReq(padded(600), { headers: { 'content-length': v } }))).status, 204, 'content-length ' + JSON.stringify(v));
  eq((await rows(c)).length, 3, 'all three small batches stored');
  const { stream, st } = chunked([padded(600)]);
  eq((await handle(bodyReq(stream, { headers: { 'content-length': '9000.5' } }))).status, 204, '204');
  eq([st.pulled, (await rows(c)).length], [0, 3], '9000.5: refused unread, as the previous reading did');
});
check('edge-bytes', 'B2-13 a body that errors mid-read: 204, database never called, nothing stored', async (c) => {
  await as(c, 'postgres'); const calls = [];
  const { handle, logs } = await handlerFor(c, { calls });
  const { stream } = chunked(splitBytes(padded(3000), 1000), { errorAt: 1 });
  eq((await handle(bodyReq(stream))).status, 204, '204');
  eq([calls.length, (await rows(c)).length], [0, 0], 'no database call');
  ok(logs.some(l => l.startsWith('analytics-ingest: unexpected')), 'logged as unexpected (no payload)');
});
check('edge-bytes', 'B2-14 an empty body and a POST with no body: 204, reported as bad_batch exactly as before', async (c) => {
  await as(c, 'postgres');
  const { handle, h } = await handlerFor(c);
  eq(await h.readBodyLimited(bodyReq(undefined)), { text: '', oversize: false, bytes: 0 }, 'null body reads as empty');
  eq((await handle(bodyReq(''))).status, 204, 'empty');
  eq((await handle(bodyReq(undefined))).status, 204, 'no body');
  eq([(await rows(c)).length, await bad(c)], [0, ['live:bad_batch=2']], 'both reported, nothing stored');
});
check('edge-bytes', 'B2-15 OPTIONS, a foreign origin and the kill switch never read the body and never call the database', async (c) => {
  await as(c, 'postgres');
  const calls = [];
  const on = await handlerFor(c, { calls }), off = await handlerFor(c, { calls, enabled: false });
  const o = chunked([padded(500)]); const opt = await on.handle(bodyReq(o.stream, { method: 'OPTIONS' }));
  eq([opt.status, opt.headers.get('access-control-allow-origin')], [204, SITE], 'preflight unchanged');
  const f = chunked([padded(500)]); eq((await on.handle(bodyReq(f.stream, { origin: 'https://evil.example' }))).status, 204, 'foreign origin');
  const k = chunked([padded(500)]); eq((await off.handle(bodyReq(k.stream))).status, 204, 'kill switch');
  eq([o.st.pulled, f.st.pulled, k.st.pulled, calls.length, (await rows(c)).length], [0, 0, 0, 0, 0], 'no body read, no database call');
});
check('edge-bytes', 'B2-16 a 1 MB stream in 1 KB chunks: reader cancelled; bytes pulled at most 8,192 + one chunk; 8,192 kept', async (c) => {
  await as(c, 'postgres');
  const { h } = await handlerFor(c);
  const { stream, st } = chunked(Array.from({ length: 1024 }, () => new Uint8Array(1024).fill(0x20)));
  const r = await h.readBodyLimited(bodyReq(stream));
  eq([r.oversize, r.bytes, st.cancelled], [true, 8192, true], 'refused at the limit');
  eq([st.pulled, st.bytes], [9, 9216], 'pulled 9 chunks (9,216 bytes) out of 1,024');
});

check('edge', 'in-memory limiter is PER INSTANCE (documented as not global): two instances each allow their own quota; window resets', async (c) => {
  const h = await import(require('url').pathToFileURL(HANDLER).href);
  let t = 0; const a = h.createRateLimiter({ perMinute: 3, now: () => t }), b = h.createRateLimiter({ perMinute: 3, now: () => t });
  eq([a('k'), a('k'), a('k'), a('k')], [true, true, true, false], 'instance A: 3 then refused');
  eq([b('k'), b('k'), b('k')], [true, true, true], 'instance B does not know about A');
  t = 60000; eq(a('k'), true, 'new minute (and a restart would also reset it)');
  await as(c, 'postgres'); let n = 0; const { post, logs } = await handlerFor(c, { allow: () => ++n <= 1 });
  await post({ env: 'live', events: [ev('page_view')] }); await post({ env: 'live', events: [ev('page_view')] });
  eq((await rows(c)).length, 1, 'refused by this instance before reaching the database');
  ok(logs.includes('analytics-ingest: rate limited (this instance)'), 'logged');
});
check('edge', 'handler: database down -> still 204, nothing thrown (the page never sees a failure)', async (c) => {
  const { post, logs } = await handlerFor(c, { dbDown: true });
  eq((await post({ env: 'live', events: [ev('page_view')] })).status, 204, '204');
  ok(logs.some(l => l.startsWith('analytics-ingest: database error')), 'logged');
});

/* ---------------------------------------------------------------- new vs returning visitors
 * Period P = 2026-11-02 .. 11-08 (previous: 10-26 .. 11-01). One page view per (visitor, day), each its own session.
 *   A first 11-03 (one session)              -> P new
 *   B first 11-03, again 11-05                -> P new (once)
 *   C first 10-20, again 11-04 (its page claims is_new_visitor: true — ignored) -> P returning
 *   D first 10-28, again 11-04 and 11-06      -> P returning; previous: new
 *   E storage cleared: a NEW id on 11-06 (the same person's old id X was seen 10-20 only) -> P new; X not active in P
 *   F first 11-08 (last day of P)             -> P new
 *   G first 11-09 (after P)                   -> not in P
 *   H first 11-01 (last day of previous), again 11-02 (first day of P) -> P returning; previous: new
 * P: visitors 7 = new 4 (A B E F) + returning 3 (C D H). Previous: visitors 2 = new 2 (D H) + returning 0. */
check('sessions', 'campaigns: each session the page starts for a new campaign is its own session with that campaign; navigation inside a session keeps it; one visitor', async (c) => {
  await as(c, 'postgres');
  const d = '2026-11-03', V = uuid(2, 900), SA = uuid(3, 901), SB = uuid(3, 902), SC = uuid(3, 903);
  const A = { utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'spring' }, B = { utm_source: 'moparcenter', utm_medium: 'banner', utm_campaign: 'fall' };
  // campaign A arrives (session A), the visitor navigates, then campaign B arrives 5 minutes later (session B), then a direct visit
  await put(c, NY(d, '09:00'), ev('page_view', { vid: V, sid: SA, page: 'home', pv_id: uuid(4, 901), props: { is_session_start: true, ...A } }));
  await put(c, NY(d, '09:01'), ev('page_view', { vid: V, sid: SA, page: 'calc:bmep', pv_id: uuid(4, 902) }));
  await put(c, NY(d, '09:06'), ev('page_view', { vid: V, sid: SB, page: 'home', pv_id: uuid(4, 903), props: { is_session_start: true, ...B } }));
  await put(c, NY(d, '09:12'), ev('page_view', { vid: V, sid: SC, page: 'lab:diesel', pv_id: uuid(4, 904), props: { is_session_start: true } }));
  await c.query(`SELECT public.analytics_rollup('${d}')`);
  const s = await q(c, `SELECT sid::text sid, page_views pv, channel ch, utm_source src, utm_medium med, utm_campaign camp FROM analytics_sessions WHERE vid = $1 ORDER BY started_at`, [V]);
  eq(s, [
    { sid: SA, pv: 2, ch: 'campaign', src: 'newsletter', med: 'email', camp: 'spring' },
    { sid: SB, pv: 1, ch: 'campaign', src: 'moparcenter', med: 'banner', camp: 'fall' },
    { sid: SC, pv: 1, ch: 'direct', src: null, med: null, camp: null }], 'three sessions, each attributed to the campaign that started it');
  eq(+(await one(c, `SELECT count(*) FROM analytics_visitors WHERE vid = $1`, [V])), 1, 'one visitor');
});
check('visitors', 'new vs returning are mutually exclusive and come from each id\'s first recorded day, not the page\'s flag', async (c) => {
  await as(c, 'postgres');
  const V = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, X: 9 };
  const visits = [['A', '11-03'], ['B', '11-03'], ['B', '11-05'], ['C', '10-20'], ['C', '11-04'], ['D', '10-28'], ['D', '11-04'], ['D', '11-06'],
    ['X', '10-20'], ['E', '11-06'], ['F', '11-08'], ['G', '11-09'], ['H', '11-01'], ['H', '11-02']];
  let k = 0;
  for (const [who, d] of visits) {
    const vid = uuid(2, 700 + V[who]), sid = uuid(3, 700 + ++k);
    await put(c, NY('2026-' + d, '12:00'), ev('page_view', { vid, sid, pv_id: uuid(4, 700 + k), props: who === 'C' && d === '11-04' ? { is_new_visitor: true } : {} }));
  }
  await c.query(`SELECT public.analytics_rollup_pending()`);       // every day with events, oldest first
  await as(c, 'owner');
  const r = await one(c, `SELECT public.analytics_dashboard('2026-11-02', '2026-11-08', 'test')`);
  const pick = (x) => [x.visitors, x.new_visitors, x.returning_visitors];
  eq(pick(r.kpis), [7, 4, 3], 'period: visitors / new / returning');
  eq(pick(r.kpis_previous), [2, 2, 0], 'previous period');
  eq(r.kpis.new_visitors + r.kpis.returning_visitors, r.kpis.visitors, 'mutually exclusive and complete');
  const one11 = await one(c, `SELECT public.analytics_dashboard('2026-11-04', '2026-11-04', 'test')`);
  eq(pick(one11.kpis), [2, 0, 2], 'single day 11-04: C and D both returning');
  // rolling days up again, in reverse order, changes nothing
  await as(c, 'postgres');
  for (const d of ['2026-11-08', '2026-11-03', '2026-10-20', '2026-11-04']) await c.query(`SELECT public.analytics_rollup($1)`, [d]);
  await as(c, 'owner');
  eq(pick((await one(c, `SELECT public.analytics_dashboard('2026-11-02', '2026-11-08', 'test')`)).kpis), [7, 4, 3], 'order-independent');
  // bot-only ids never become visitors
  await as(c, 'postgres');
  await put(c, NY('2026-11-03', '13:00'), ev('page_view', { vid: uuid(2, 799), sid: uuid(3, 799) }), 'test', true);
  await c.query(`SELECT public.analytics_rollup('2026-11-03')`);
  eq(+(await one(c, `SELECT count(*) FROM analytics_visitors WHERE vid = $1`, [uuid(2, 799)])), 0, 'bot id not recorded');
});

/* ---------------------------------------------------------------- C2: rollup watermark (C1), with COMMITTED data and several connections
 * Each check below gets its own throwaway database (the same migrations, the same synthetic owner), because these checks
 * need real commits, real lock waits between connections and real transaction failures, which the rolled-back
 * single-connection checks above cannot show. Ingest goes through analytics_ingest() as service_role, exactly as the Edge
 * Function calls it. Direct inserts with an exact server time are made as the table owner WHILE HOLDING the analytics lock,
 * the rule every insert path must follow (analytics_ingest() is the only one in the product). */
const LOCK = '7104202611130501';
const ownChecks = [];
const checkOwn = (name, fn) => ownChecks.push({ group: 'rollup-watermark', name, fn });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const nyDay = (x, back = 0) => one(x, `SELECT ((now() AT TIME ZONE 'America/New_York')::date - $1::int)::text`, [back]);
async function svcIngest(x, batch, net = '198.51.100.40') {
  await x.query('BEGIN'); await x.query('SET LOCAL ROLE service_role');
  try { const r = await one(x, `SELECT public.analytics_ingest($1::jsonb, $2::jsonb)`, [JSON.stringify(batch), JSON.stringify({ ...META, net })]); await x.query('COMMIT'); return r; }
  catch (e) { await x.query('ROLLBACK'); throw e; }
}
async function putLocked(x, ts, e) {                                    // a direct insert that follows the lock rule
  await x.query('BEGIN'); await x.query(`SELECT pg_advisory_xact_lock(${LOCK})`); await put(x, ts, e); await x.query('COMMIT');
  return one(x, `SELECT id FROM analytics_events WHERE event_id = $1`, [e.event_id]);
}
const pvDay = async (x, d) => +(await one(x, `SELECT coalesce(sum(value), 0) FROM analytics_daily WHERE env = 'test' AND metric = 'pv' AND day = $1`, [d]));
const rawDay = async (x, d) => +(await one(x, `SELECT count(*) FROM analytics_events WHERE env = 'test' AND name = 'page_view'
  AND (ts_server AT TIME ZONE 'America/New_York')::date = $1`, [d]));
const runRow = (x, d) => q(x, `SELECT ran_at, max_event_id::text wm FROM analytics_rollup_runs WHERE day = $1 AND env = 'test'`, [d]).then(r => r[0]);
/* No day holds an event its watermark does not cover, and per day the rolled-up page views equal the raw page views. */
async function consistent(x, what) {
  eq(+(await one(x, `SELECT count(*) FROM (SELECT (ts_server AT TIME ZONE 'America/New_York')::date d, max(id) m FROM analytics_events GROUP BY 1) e
     WHERE e.m > coalesce((SELECT max(max_event_id) FROM analytics_rollup_runs r WHERE r.day = e.d), 0)`)), 0, what + ': every day covered by its watermark');
  const off = await q(x, `SELECT e.d::text, e.n, coalesce(p.v, 0)::int v FROM
     (SELECT (ts_server AT TIME ZONE 'America/New_York')::date d, count(*)::int n FROM analytics_events WHERE env = 'test' AND name = 'page_view' AND NOT bot GROUP BY 1) e
     LEFT JOIN (SELECT day, sum(value) v FROM analytics_daily WHERE env = 'test' AND metric = 'pv' GROUP BY day) p ON p.day = e.d WHERE e.n <> coalesce(p.v, 0)`);
  eq(off, [], what + ': rolled-up page views equal raw page views on every day');
}

checkOwn('C2-1 ingestion waiting behind a rollup\'s lock: its event (older timestamp, newer id) is rolled up by the next run', async (db) => {
  const pg = await connect(db, 'postgres'), ing = await connect(db, 'postgres'), rol = await connect(db, 'postgres');
  try {
    await svcIngest(ing, [ev('page_view', { sid: uuid(3, 61) })]);
    await pg.query(`SELECT public.analytics_rollup_pending()`);
    const today = await nyDay(pg);
    await ing.query('BEGIN'); await ing.query('SET LOCAL ROLE service_role'); await ing.query('SELECT now()');   // the ingest transaction starts
    await pause(300);
    await rol.query('BEGIN'); await rol.query(`SELECT public.analytics_rollup_pending()`);                       // a rollup takes the lock
    const t0 = Date.now(); const late = ev('page_view', { sid: uuid(3, 62) });
    const waiting = ing.query(`SELECT public.analytics_ingest($1::jsonb, $2::jsonb)`, [JSON.stringify([late]), JSON.stringify({ ...META, net: '198.51.100.40' })]);
    await pause(500); await rol.query('COMMIT');
    await waiting; await ing.query('COMMIT');
    ok(Date.now() - t0 >= 450, 'the ingest waited for the rollup\'s lock');
    const lt = await q(pg, `SELECT id::text, ts_server FROM analytics_events WHERE event_id = $1`, [late.event_id]); const run = await runRow(pg, today);
    ok(lt[0].ts_server < run.ran_at, 'the late event\'s timestamp is EARLIER than that rollup\'s ran_at (the case the time check missed)');
    ok(BigInt(lt[0].id) > BigInt(run.wm), 'its id is above the day\'s watermark');
    eq([await pvDay(pg, today), await rawDay(pg, today)], [1, 2], 'before the next run: 1 of 2 rolled up');
    eq(+(await one(pg, `SELECT public.analytics_rollup_pending()`)), 1, 'the next run re-opens exactly today');
    eq(await pvDay(pg, today), 2, 'after it: 2 of 2');
    await consistent(pg, 'C2-1');
  } finally { await Promise.all([pg.end(), ing.end(), rol.end()]); }
});
checkOwn('C2-2 older timestamp with a newer event id on a past day: that day is rolled up again (the time check would not)', async (db) => {
  const pg = await connect(db, 'postgres');
  try {
    const d = await nyDay(pg, 3);
    await putLocked(pg, NY(d, '12:00'), ev('page_view', { sid: uuid(3, 71) }));
    eq(+(await one(pg, `SELECT public.analytics_rollup_pending()`)), 1, 'day rolled up');
    const before = await runRow(pg, d);
    const lateId = await putLocked(pg, NY(d, '12:30'), ev('page_view', { sid: uuid(3, 72) }));
    ok(new Date(NY(d, '12:30')) < before.ran_at && BigInt(lateId) > BigInt(before.wm), 'older timestamp than ran_at, newer id than the watermark');
    eq(await one(pg, `SELECT $1::timestamptz >= max(ts_server) FROM analytics_events WHERE (ts_server AT TIME ZONE 'America/New_York')::date = $2`, [before.ran_at, d]), true,
      'the previous time-based check would have treated the day as complete');
    eq(+(await one(pg, `SELECT public.analytics_rollup_pending()`)), 1, 'the watermark check re-opens it');
    eq([await pvDay(pg, d), (await runRow(pg, d)).wm], [2, String(lateId)], 'both events rolled up; watermark advanced to the late id');
    await consistent(pg, 'C2-2');
  } finally { await pg.end(); }
});
checkOwn('C2-3 midnight: an event stamped 23:59:59.999 yesterday, stored after yesterday was rolled up, lands in yesterday; today unchanged', async (db) => {
  const pg = await connect(db, 'postgres');
  try {
    const y = await nyDay(pg, 1), t = await nyDay(pg, 0);
    await putLocked(pg, NY(y, '23:00'), ev('page_view', { sid: uuid(3, 81) }));
    await putLocked(pg, `${t}T00:00:01-05:00`, ev('page_view', { sid: uuid(3, 82) }));
    eq(+(await one(pg, `SELECT public.analytics_rollup_pending()`)), 2, 'yesterday and today rolled up');
    const todayRow = await q(pg, `SELECT xmin::text x FROM analytics_daily WHERE day = $1 ORDER BY metric, dim`, [t]);
    await putLocked(pg, `${y}T23:59:59.999-05:00`, ev('page_view', { sid: uuid(3, 83) }));
    eq(+(await one(pg, `SELECT public.analytics_rollup_pending()`)), 1, 'only yesterday re-opened');
    eq([await pvDay(pg, y), await pvDay(pg, t)], [2, 1], 'the late event is counted on yesterday, not today');
    eq(await q(pg, `SELECT xmin::text x FROM analytics_daily WHERE day = $1 ORDER BY metric, dim`, [t]), todayRow, 'today\'s rows not rewritten');
    await consistent(pg, 'C2-3');
  } finally { await pg.end(); }
});
checkOwn('C2-4 a delayed event 12 days back: only that day is rolled up again; neighbouring days are untouched', async (db) => {
  const pg = await connect(db, 'postgres');
  try {
    const d11 = await nyDay(pg, 11), d12 = await nyDay(pg, 12), d13 = await nyDay(pg, 13);
    for (const [d, k] of [[d11, 1], [d12, 2], [d13, 3]]) await putLocked(pg, NY(d, '10:00'), ev('page_view', { sid: uuid(3, 90 + k) }));
    eq(+(await one(pg, `SELECT public.analytics_rollup_pending()`)), 3, 'three days rolled up');
    const snap = async (d) => q(pg, `SELECT xmin::text x, metric, dim FROM analytics_daily WHERE day = $1 ORDER BY metric, dim`, [d]);
    const [s11, s13] = [await snap(d11), await snap(d13)];
    await putLocked(pg, NY(d12, '09:00'), ev('page_view', { sid: uuid(3, 99) }));
    eq(+(await one(pg, `SELECT public.analytics_rollup_pending()`)), 1, 'exactly one day re-opened');
    eq([await pvDay(pg, d11), await pvDay(pg, d12), await pvDay(pg, d13)], [1, 2, 1], 'counted on its own day');
    eq([await snap(d11), await snap(d13)], [s11, s13], 'neighbouring days not rewritten');
    await consistent(pg, 'C2-4');
  } finally { await pg.end(); }
});
checkOwn('C2-5 a rollup that fails part-way changes nothing (aggregates, run rows, watermarks); the retry is complete; a further retry has nothing to do', async (db) => {
  const pg = await connect(db, 'postgres');
  try {
    const d1 = await nyDay(pg, 5), d2 = await nyDay(pg, 4);
    await putLocked(pg, NY(d1, '10:00'), ev('page_view', { sid: uuid(3, 111) }));
    await putLocked(pg, NY(d2, '10:00'), ev('page_view', { sid: uuid(3, 112) }));
    await pg.query(`CREATE FUNCTION public.c2_fail() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN
      IF NEW.day = '${d2}' THEN RAISE EXCEPTION 'C2 injected failure'; END IF; RETURN NEW; END $f$`);
    await pg.query(`CREATE TRIGGER c2_fail BEFORE INSERT ON public.analytics_daily FOR EACH ROW EXECUTE FUNCTION public.c2_fail()`);
    await expectErrPlain(pg, `SELECT public.analytics_rollup_pending()`, /C2 injected failure/);
    eq([+(await one(pg, `SELECT count(*) FROM analytics_daily`)), +(await one(pg, `SELECT count(*) FROM analytics_sessions`)),
        +(await one(pg, `SELECT count(*) FROM analytics_rollup_runs`))], [0, 0, 0], 'the first day\'s work was rolled back too: no aggregates, no run rows, no watermarks');
    await pg.query(`DROP TRIGGER c2_fail ON public.analytics_daily`); await pg.query(`DROP FUNCTION public.c2_fail()`);
    eq(+(await one(pg, `SELECT public.analytics_rollup_pending()`)), 2, 'retry rolls up both days');
    eq([await pvDay(pg, d1), await pvDay(pg, d2)], [1, 1], 'complete');
    eq(+(await one(pg, `SELECT public.analytics_rollup_pending()`)), 0, 'a further retry has nothing to do');
    eq([await pvDay(pg, d1), await pvDay(pg, d2)], [1, 1], 'no double count');
    await consistent(pg, 'C2-5');
  } finally { await pg.end(); }
});
checkOwn('C2-6 rollup and purge started together, in both orders, serialise on the lock: purged days keep their aggregates, kept days are complete', async (db) => {
  const a = await connect(db, 'postgres'), b = await connect(db, 'postgres');
  try {
    for (const [first, second, tag] of [['purge', 'rollup', 'P'], ['rollup', 'purge', 'R']]) {
      const old = await nyDay(a, tag === 'P' ? 40 : 41), recent = await nyDay(a, tag === 'P' ? 2 : 3);
      await putLocked(a, NY(old, '10:00'), ev('page_view', { sid: uuid(3, tag === 'P' ? 121 : 122) }));
      await putLocked(a, NY(recent, '10:00'), ev('page_view', { sid: uuid(3, tag === 'P' ? 123 : 124) }));
      const sql = { purge: `SELECT public.analytics_purge()`, rollup: `SELECT public.analytics_rollup_pending()` };
      await a.query('BEGIN'); await a.query(sql[first]);                         // holds the lock
      const t0 = Date.now(); const pending = b.query(sql[second]);
      await pause(400); await a.query('COMMIT'); await pending;
      ok(Date.now() - t0 >= 350, `${tag}: the second waited for the first`);
      eq(+(await one(a, `SELECT count(*) FROM analytics_events WHERE (ts_server AT TIME ZONE 'America/New_York')::date = $1`, [old])), 0, `${tag}: old raw events deleted`);
      eq([await pvDay(a, old), await pvDay(a, recent)], [1, 1], `${tag}: purged day kept its aggregate; recent day complete; nothing counted twice`);
    }
    await consistent(a, 'C2-6');
  } finally { await Promise.all([a.end(), b.end()]); }
});
checkOwn('C2-7 stress: 8 writers (each batch repeats an earlier event id) against a rollup loop and a purge: no loss, no double count, duplicates counted once', async (db) => {
  const pg = await connect(db, 'postgres');
  let stop = false; const sent = [];
  async function writer(w) {
    const x = await connect(db, 'postgres'); let prev = null; let busy = 0;
    try {
      for (let k = 0; k < 40; k++) {
        const fresh = ev('page_view', { sid: uuid(3, 20000 + w * 100 + k), vid: uuid(2, 20000 + w) });
        const batch = prev ? [fresh, prev] : [fresh];
        const r = await svcIngest(x, batch, `10.0.${w}.1`);
        if (r.reason) busy++; else { sent.push(fresh.event_id); prev = fresh; }
      }
    } finally { await x.end(); }
    return busy;
  }
  async function roller() { const x = await connect(db, 'postgres'); let n = 0; try { while (!stop) { await x.query(`SELECT public.analytics_rollup_pending()`); n++; await pause(15); } } finally { await x.end(); } return n; }
  async function purger() { const x = await connect(db, 'postgres'); try { await pause(200); await x.query(`SELECT public.analytics_purge()`); } finally { await x.end(); } }
  try {
    const r = roller(); const p = purger();
    const busy = await Promise.all([...Array(8).keys()].map(writer));
    stop = true; const runs = await r; await p;
    await pg.query(`SELECT public.analytics_rollup_pending()`);
    const accepted = +(await one(pg, `SELECT count(*) FROM analytics_events WHERE env = 'test'`));
    eq(accepted, sent.length, 'every accepted event stored once (' + sent.length + ')');
    eq(+(await one(pg, `SELECT count(DISTINCT event_id) FROM analytics_events`)), accepted, 'no duplicate event ids stored');
    const dups = +(await one(pg, `SELECT coalesce(sum(n), 0) FROM analytics_ingest_stats WHERE env = 'test' AND outcome = 'duplicate'`));
    ok(dups > 0, `repeated ids counted as duplicates (${dups})`);
    eq(+(await one(pg, `SELECT coalesce(sum(value), 0) FROM analytics_daily WHERE env = 'test' AND metric = 'pv'`)), accepted, 'rolled-up page views equal stored events');
    ok(runs > 5, `the rollup loop ran ${runs} times during the writes`);
    eq(busy.reduce((s, v) => s + v, 0), 0, 'no batch refused');
    await consistent(pg, 'C2-7');
  } finally { stop = true; await pg.end(); }
});
checkOwn('C2-8 no new events: nothing rewritten, only the heartbeat moves (watermarks kept); at the storage gate: -1 and nothing recorded', async (db) => {
  const pg = await connect(db, 'postgres');
  try {
    const y = await nyDay(pg, 1), t = await nyDay(pg, 0);
    const yid = await putLocked(pg, NY(y, '10:00'), ev('page_view', { sid: uuid(3, 131) }));
    eq(+(await one(pg, `SELECT public.analytics_rollup_pending()`)), 1, 'yesterday rolled up');
    const daily = await q(pg, `SELECT xmin::text x FROM analytics_daily ORDER BY day, metric, dim`);
    const sess = await q(pg, `SELECT xmin::text x FROM analytics_sessions ORDER BY skey`);
    const yRow = await runRow(pg, y), t1 = await runRow(pg, t);
    eq([yRow.wm, t1.wm], [String(yid), '0'], 'watermarks: yesterday = its event id; today (no events) = 0');
    await pause(50);
    eq(+(await one(pg, `SELECT public.analytics_rollup_pending()`)), 0, 'nothing to roll up');
    eq([await q(pg, `SELECT xmin::text x FROM analytics_daily ORDER BY day, metric, dim`), await q(pg, `SELECT xmin::text x FROM analytics_sessions ORDER BY skey`)], [daily, sess], 'no aggregate rewritten');
    const t2 = await runRow(pg, t), y2 = await runRow(pg, y);
    ok(t2.ran_at > t1.ran_at && t2.wm === '0', 'heartbeat: today\'s ran_at advanced, its watermark untouched');
    eq([y2.ran_at.getTime(), y2.wm], [yRow.ran_at.getTime(), String(yid)], 'yesterday\'s run row untouched');
    const asOwner = async (sql) => { await pg.query('BEGIN'); await as(pg, 'owner'); try { const r = await one(pg, sql, sql.includes('$1') ? [y] : []); await pg.query('COMMIT'); return r; } catch (e) { await pg.query('ROLLBACK'); throw e; } };
    const before = (await asOwner(`SELECT public.analytics_dashboard($1, $1, 'test')`)).health.last_rollup_at;
    await pause(50); await asOwner(`SELECT public.analytics_refresh()`);
    ok(new Date((await asOwner(`SELECT public.analytics_dashboard($1, $1, 'test')`)).health.last_rollup_at) > new Date(before), '"Last rollup" still moves on every successful run (owner Refresh)');
    // storage gate, with a new pending event
    await putLocked(pg, NY(y, '11:00'), ev('page_view', { sid: uuid(3, 132) }));
    const runsBefore = await q(pg, `SELECT day::text, env, ran_at, max_event_id::text FROM analytics_rollup_runs ORDER BY 1, 2`);
    const lim = await one(pg, `SELECT pg_get_functiondef('public.analytics_limits()'::regprocedure)`);
    await pg.query(lim.replace('"storage_mb": 150', '"storage_mb": 0'));
    eq(+(await one(pg, `SELECT public.analytics_rollup_pending()`)), -1, 'stopped at the gate');
    eq(await q(pg, `SELECT day::text, env, ran_at, max_event_id::text FROM analytics_rollup_runs ORDER BY 1, 2`), runsBefore, 'no heartbeat and no watermark written at the gate');
    eq(await pvDay(pg, y), 1, 'aggregates unchanged at the gate');
    await pg.query(lim);                                                     // limits restored
    eq(+(await one(pg, `SELECT public.analytics_rollup_pending()`)), 1, 'after the gate opens, the day is still pending and is rolled up');
    await consistent(pg, 'C2-8');
  } finally { await pg.end(); }
});
checkOwn('C2-9 a direct analytics_rollup() now holds the lock: an ingest waits for it, and the event it then stores is rolled up by the next run', async (db) => {
  const pg = await connect(db, 'postgres'), ing = await connect(db, 'postgres'), rol = await connect(db, 'postgres');
  try {
    const today = await nyDay(pg);
    await svcIngest(ing, [ev('page_view', { sid: uuid(3, 141) })]);
    await ing.query('BEGIN'); await ing.query('SET LOCAL ROLE service_role'); await ing.query('SELECT now()');
    await pause(200);
    await rol.query('BEGIN'); await rol.query(`SELECT public.analytics_rollup($1)`, [today]);
    eq(+(await one(rol, `SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid() AND granted`)), 1, 'the direct rollup holds the analytics lock');
    const t0 = Date.now(); const late = ev('page_view', { sid: uuid(3, 142) });
    const waiting = ing.query(`SELECT public.analytics_ingest($1::jsonb, $2::jsonb)`, [JSON.stringify([late]), JSON.stringify({ ...META, net: '198.51.100.40' })]);
    await pause(500); await rol.query('COMMIT'); await waiting; await ing.query('COMMIT');
    ok(Date.now() - t0 >= 450, 'the ingest waited for the direct rollup');
    const run = await runRow(pg, today); const id = await one(pg, `SELECT id::text FROM analytics_events WHERE event_id = $1`, [late.event_id]);
    ok(BigInt(id) > BigInt(run.wm), 'the event stored after it has an id above its watermark');
    eq(+(await one(pg, `SELECT public.analytics_rollup_pending()`)), 1, 'so the next run re-opens today');
    eq(await pvDay(pg, today), 2, 'both counted');
    await consistent(pg, 'C2-9');
  } finally { await Promise.all([pg.end(), ing.end(), rol.end()]); }
});
checkOwn('C2-10 sequence post-condition: the events id sequence has cache 1, increment 1, no cycle; the migration\'s check refuses cache 10 or CYCLE', async (db) => {
  const pg = await connect(db, 'postgres');
  try {
    eq(await q(pg, `SELECT cache_size::int, increment_by::int, cycle FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'analytics_events_id_seq'`),
      [{ cache_size: 1, increment_by: 1, cycle: false }], 'as created');
    eq(await one(pg, `SELECT pg_get_serial_sequence('public.analytics_events', 'id')`), 'public.analytics_events_id_seq', 'identity sequence');
    const sql = fs.readFileSync(path.join(MIG_DIR, '0501_analytics.sql'), 'utf8');
    const post = sql.slice(sql.indexOf('-- ---------------------------------------------------------------- post-conditions'), sql.lastIndexOf('COMMIT;'));
    ok(post.includes('cache_size = 1') && post.includes('NOT s.cycle'), 'the post-condition block contains the sequence check');
    await pg.query('BEGIN'); await pg.query(post); await pg.query('ROLLBACK');                     // passes as created
    for (const change of ['CACHE 10', 'CYCLE', 'INCREMENT BY 2']) {
      await pg.query('BEGIN'); await pg.query(`ALTER SEQUENCE public.analytics_events_id_seq ${change}`);
      await expectErrPlain(pg, post, /ANALYTICS_0501_POSTCONDITION: the events id sequence/); await pg.query('ROLLBACK');
    }
  } finally { await pg.end(); }
});
async function expectErrPlain(x, sql, re) {
  let err = null; try { await x.query(sql); } catch (e) { err = e; }
  if (!err) throw new Error(`expected an error matching ${re} but the statement succeeded`);
  if (!re.test(err.message)) throw new Error(`expected an error matching ${re}, got: ${err.message}`);
}

/* ---------------------------------------------------------------- runner */
(async () => {
  fs.mkdirSync(path.join(HERE, 'evidence'), { recursive: true });
  const db = await freshDb();
  const results = [];
  for (const k of checks) {
    const c = await connect(db, 'postgres'); c.database = db;
    try { await c.query('BEGIN'); await k.fn(c); results.push({ ...k, pass: true }); }
    catch (e) { results.push({ ...k, pass: false, error: e.message }); }
    finally { await c.query('ROLLBACK').catch(() => {}); await c.end(); }
  }
  const a = await connect('postgres', 'supabase_admin'); await a.query(`DROP DATABASE ${db} WITH (FORCE)`); await a.end();
  for (const [i, k] of ownChecks.entries()) {                          // C2: each in its own committed throwaway database
    const own = `analytics_c2_${i}_${process.pid}`;
    try { await freshDb(own); await k.fn(own); results.push({ ...k, pass: true }); }
    catch (e) { results.push({ ...k, pass: false, error: e.message }); }
    finally { const x = await connect('postgres', 'supabase_admin'); await x.query(`DROP DATABASE IF EXISTS ${own} WITH (FORCE)`); await x.end(); }
  }
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  [analytics/${r.group}] ${r.name}${r.pass ? '' : '\n      -> ' + r.error}`);
  const failed = results.filter(r => !r.pass).length;
  console.log(`\nanalytics: ${results.length} checks, ${results.length - failed} passed, ${failed} failed (synthetic data, throwaway database)`);
  fs.mkdirSync(path.join(HERE, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(HERE, 'evidence', 'analytics-test-results.json'), JSON.stringify(results.map(({ fn, ...r }) => r), null, 2) + '\n');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('SUITE ERROR', e); process.exit(2); });
