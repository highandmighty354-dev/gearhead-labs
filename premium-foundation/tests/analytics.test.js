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
async function freshDb() {
  const db = 'analytics_' + process.pid;
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
const ingest = (c, batch, meta = { env: 'test' }) => one(c, `SELECT public.analytics_ingest($1::jsonb, $2::jsonb)`, [JSON.stringify(batch), JSON.stringify(meta)]);
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
  const tables = ['analytics_owners', 'analytics_events', 'analytics_ingest_stats', 'analytics_sessions', 'analytics_daily', 'analytics_rollup_runs'];
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
  for (const f of ['analytics_rollup(date)', 'analytics_purge()', 'analytics_event_problem(jsonb)', 'analytics_count(text, text, text, bigint)'])
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
    [ev('page_view', { props: { utm_campaign: 'x'.repeat(101) } }), 'bad_prop:utm_campaign']];
  await as(c, 'postgres');
  for (const [e, why] of bad) eq(await one(c, `SELECT public.analytics_event_problem($1::jsonb)`, [JSON.stringify(e)]), why, `reason for ${JSON.stringify(e.props || {})}`);
  await as(c, 'service');
  const all = bad.map(b => b[0]).concat([ev('page_view', { props: { ref_host: 'google.com', utm_source: 'newsletter' } }), ev('calc_start', { props: { calc_id: 'hp_from_et' } })]);
  const r1 = await ingest(c, all.slice(0, 11)), r2 = await ingest(c, all.slice(11));
  eq([r1.accepted + r2.accepted, r1.rejected + r2.rejected], [2, bad.length], 'accepted/rejected');
  await as(c, 'postgres');
  eq(+(await one(c, `SELECT count(*) FROM analytics_events`)), 2, 'rows');
  eq(+(await one(c, `SELECT sum(n) FROM analytics_ingest_stats WHERE outcome = 'rejected'`)), bad.length, 'rejected counted');
  eq(+(await one(c, `SELECT n FROM analytics_ingest_stats WHERE outcome = 'rejected' AND reason = 'unknown_prop:value'`)), 1, 'reason kept');
  eq(+(await one(c, `SELECT count(*) FROM analytics_events WHERE props::text ~ '350|turbo|@'`)), 0, 'no input values / search text / email stored');
});
check('validation', 'bad envelopes: unknown env, empty, oversize (>20) and non-array batches are refused without storing anything', async (c) => {
  await as(c, 'service');
  eq((await ingest(c, [ev('page_view')], { env: 'production' })).reason, 'bad_env', 'env');
  eq((await ingest(c, [], { env: 'test' })).reason, 'bad_batch', 'empty');
  eq((await ingest(c, Array.from({ length: 21 }, () => ev('page_view')))).reason, 'bad_batch', 'oversize');
  eq((await one(c, `SELECT public.analytics_ingest('{"a":1}'::jsonb, '{"env":"test"}')`)).reason, 'bad_batch', 'object');
  eq((await ingest(c, [ev('page_view')], { env: 'test', bot: 'yes', client_errors: 'lots' })).accepted, 1, 'junk meta ignored safely');
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
  eq((await ingest(c, [ev('page_view', { sid: uuid(3, 78), ts_client: '2020-01-01T00:00:00Z' })], { env: 'test', bot: true, ua_family: 'HeadlessChrome<script>', client_errors: 4, client_dropped: 2 })).accepted, 1, 'bot accepted for volume');
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
  eq(r.kpis, { visitors: 3, sessions: 4, page_views: 5, engaged_sessions: 2, avg_engaged_ms: 467000, pages_per_session: 1.25, new_visitors: 2, returning_visitors: 1 }, 'kpis');
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
check('retention', 'purge deletes raw events older than 90 days (rolling them up first) and keeps the daily rollup', async (c) => {
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
    config: { allowedOrigins: [SITE, 'http://localhost:8080', 'https://preview.example.test'], liveOrigins: [SITE] },
    rpc: async (fn, args) => { if (opts.dbDown) return { error: { code: '08006' } };
      await as(c, 'service'); try { await c.query(`SELECT public.${fn}($1::jsonb, $2::jsonb)`, [JSON.stringify(args.p_batch), JSON.stringify(args.p_meta)]); return { error: null }; }
      finally { await as(c, 'postgres'); } } });
  const post = (body, { origin = SITE, ua = CHROME, method = 'POST', raw } = {}) => handle(new Request('https://x.supabase.co/functions/v1/analytics-ingest',
    { method, headers: { origin, 'user-agent': ua, 'content-type': 'text/plain;charset=UTF-8', 'x-forwarded-for': '198.51.100.7' },
      body: method === 'POST' ? (raw !== undefined ? raw : JSON.stringify(body)) : undefined }));
  return { h, post, logs };
}
const rows = async (c) => q(c, `SELECT env, name, ua_family, bot FROM analytics_events ORDER BY id`);
check('edge', 'handler: live origin -> live env; preview origin -> test; localhost -> dev; UA reduced to a family; always 204', async (c) => {
  await as(c, 'postgres'); const { post } = await handlerFor(c);
  for (const [origin, env] of [[SITE, 'live'], ['https://preview.example.test', 'live'], ['http://localhost:8080', 'live']]) {
    const r = await post({ env, events: [ev('page_view')] }, { origin });
    eq([r.status, await r.text(), r.headers.get('access-control-allow-origin')], [204, '', origin], 'response');
  }
  eq((await post({ env: 'test', events: [ev('page_view')] })).status, 204, 'test from live origin');
  eq(await rows(c), [{ env: 'live', name: 'page_view', ua_family: 'Chrome', bot: false }, { env: 'test', name: 'page_view', ua_family: 'Chrome', bot: false },
    { env: 'dev', name: 'page_view', ua_family: 'Chrome', bot: false }, { env: 'test', name: 'page_view', ua_family: 'Chrome', bot: false }], 'stored');
  eq(+(await one(c, `SELECT count(*) FROM analytics_events WHERE props::text LIKE '%198.51%' OR ua_family LIKE '%Windows%'`)), 0, 'no IP / full UA stored');
});
check('edge', 'handler: refuses foreign origins, GET, oversize bodies, >20 events, junk JSON, rate-limit overflow and the kill switch; never errors', async (c) => {
  await as(c, 'postgres');
  let n = 0; const { post, logs } = await handlerFor(c, { allow: () => ++n <= 6 });
  const results = [
    await post({ env: 'live', events: [ev('page_view')] }, { origin: 'https://evil.example' }),
    await post(null, { method: 'GET' }),
    await post(null, { raw: 'x'.repeat(9000) }),
    await post({ env: 'live', events: Array.from({ length: 21 }, () => ev('page_view')) }),
    await post(null, { raw: '{not json' }),
    await post({ env: 'live', events: [ev('page_view')] }, { ua: 'Googlebot/2.1 (+http://www.google.com/bot.html)' }),
    await post({ env: 'live', events: [ev('page_view')], wd: true }),
    await post({ env: 'live', events: [ev('page_view')], client_errors: 3, client_dropped: -4 }),
    await post({ env: 'live', events: [ev('page_view')] }),            // 7th rate-limited request in the minute: refused
  ];
  eq(results.map(r => r.status), Array(9).fill(204), 'always 204');
  eq(results[0].headers.get('access-control-allow-origin'), null, 'no CORS grant for a foreign origin');
  eq(await rows(c), [{ env: 'live', name: 'page_view', ua_family: 'Bot', bot: true }, { env: 'live', name: 'page_view', ua_family: 'Chrome', bot: true },
    { env: 'live', name: 'page_view', ua_family: 'Chrome', bot: false }], 'only the three valid batches are stored (two flagged bot)');
  eq((await q(c, `SELECT outcome, reason, n::int FROM analytics_ingest_stats WHERE outcome IN ('rejected','client_error','client_dropped') ORDER BY outcome, reason`))
    .map(r => `${r.outcome}:${r.reason}=${r.n}`), ['client_error:=3', 'rejected:bad_batch=3'], 'oversize / >20 / junk counted as rejected; negative counter ignored');
  ok(logs.includes('analytics-ingest: origin refused') && logs.includes('analytics-ingest: rate limited'), 'logged reasons');
  ok(!logs.join(' ').match(/198\.51|page_view|Windows/), 'logs carry no IP, payload or user agent');
  const off = await handlerFor(c, { enabled: false });
  eq((await off.post({ env: 'live', events: [ev('page_view')] })).status, 204, 'disabled still 204');
  eq((await rows(c)).length, 3, 'kill switch stores nothing');
});
check('edge', 'handler: database down -> still 204, nothing thrown (the page never sees a failure)', async (c) => {
  const { post, logs } = await handlerFor(c, { dbDown: true });
  eq((await post({ env: 'live', events: [ev('page_view')] })).status, 204, '204');
  ok(logs.some(l => l.startsWith('analytics-ingest: database error')), 'logged');
});

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
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  [analytics/${r.group}] ${r.name}${r.pass ? '' : '\n      -> ' + r.error}`);
  const failed = results.filter(r => !r.pass).length;
  console.log(`\nanalytics: ${results.length} checks, ${results.length - failed} passed, ${failed} failed (synthetic data, throwaway database)`);
  fs.mkdirSync(path.join(HERE, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(HERE, 'evidence', 'analytics-test-results.json'), JSON.stringify(results.map(({ fn, ...r }) => r), null, 2) + '\n');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('SUITE ERROR', e); process.exit(2); });
