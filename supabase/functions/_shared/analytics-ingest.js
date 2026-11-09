/* Gearhead Labs analytics — HTTP layer of the analytics-ingest Edge Function (Request -> Response).
 * Runtime-neutral (Deno and Node 18+); index.ts only reads secrets and wires the database call.
 *
 *   POST /analytics-ingest   body (text/plain or application/json, <= 8 KB):
 *        {"env":"live|test|dev", "events":[...<= 20], "client_errors":n, "client_dropped":n, "wd":bool}
 *
 * The answer is ALWAYS 204 with no body: a page can never learn why a batch was dropped, and a failure here can never
 * surface in the visitor's page. Deployed WITHOUT JWT verification so navigator.sendBeacon works (it cannot set headers).
 * Controls: kill switch, environment fixed by the deployment, origin allow-list (CORS, not authentication), size / count
 * caps, a per-instance in-memory limiter, the bot flag, and the database's validation and shared rate limits.
 * Never stored or logged: the IP address (an in-memory key here; hashed with a daily salt in the database), the full user
 * agent, the body. */

const MAX_BYTES = 8192, MAX_EVENTS = 20;
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl|wget|python|httpclient|axios|node-fetch|go-http|java\/|phantom|puppeteer|playwright|selenium|scrapy/i;

export function uaFamily(ua) {
  ua = String(ua || '');
  if (!ua) return 'Unknown';
  if (BOT_UA.test(ua)) return 'Bot';
  if (/SamsungBrowser\//.test(ua)) return 'Samsung Internet';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Firefox\/|FxiOS\//.test(ua)) return 'Firefox';
  if (/CriOS\/|Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}
export const isBotUa = (ua) => !ua || BOT_UA.test(String(ua));

/* The sender's network for the database's rate limits: an IPv4 address or an IPv6 address (the database reduces IPv6 to
   its /64). Passed to analytics_ingest() only to be hashed with a daily random salt; it is never stored or logged.
   x-forwarded-for is set by the Supabase edge in front of the function; its first entry is the connecting client. */
export function senderNetwork(req) {
  const first = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || (req.headers.get('x-real-ip') || '').trim();
  return /^[0-9a-fA-F:.]{2,45}$/.test(first) ? first : '';
}

export function createRateLimiter({ perMinute = 120, now = () => Date.now(), maxKeys = 10000 } = {}) {
  const seen = new Map();
  return (key) => {
    const t = now();
    if (seen.size > maxKeys) seen.clear();
    const e = seen.get(key);
    if (!e || t - e.start >= 60000) { seen.set(key, { start: t, n: 1 }); return true; }
    e.n += 1;
    return e.n <= perMinute;
  };
}

const intOr0 = (v) => (Number.isInteger(v) && v >= 0 ? Math.min(v, 1000) : 0);

/* deps: { enabled: bool, rpc(fn, args) -> Promise<{error}>, config: {env: 'live'|'test'|'dev', allowedOrigins[]},
 *         allow(key) -> bool, log(msg) }
 *
 * WHAT THE CHECKS HERE DO AND DO NOT MEAN
 *  - The environment (live / test / dev) is fixed by the deployment (config.env, from the ANALYTICS_ENV secret). Nothing
 *    in the request can change it; a batch claiming another environment is rejected by the database ('env_mismatch').
 *  - The Origin allow-list exists for browser CORS and to drop casual cross-site noise. Origin, Referer and User-Agent are
 *    set by whoever sends the request, so they prove nothing about who sent it: a script can copy them exactly. An
 *    anonymous public endpoint cannot prove that an event came from a real visitor; what limits fabricated events is the
 *    database's validation, its per-network and global rate limits, the per-session cap and the bot rules, all best-effort.
 *  - allow() (default: createRateLimiter) is a per-instance, in-memory first line only. Supabase may run several
 *    instances and restart them at any time, so it is NOT a global limit; the database limits are the shared ones. */
export function makeAnalyticsIngestHandler(deps) {
  const allowed = deps.config.allowedOrigins || [];
  const ENV = ['live', 'test', 'dev'].includes(deps.config.env) ? deps.config.env : null;
  const allow = deps.allow || createRateLimiter();
  const log = deps.log || (() => {});
  return async (req) => {
    const origin = req.headers.get('origin') || '';
    const okOrigin = allowed.includes(origin);
    const headers = { 'Vary': 'Origin' };
    if (okOrigin) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'content-type';
      headers['Access-Control-Max-Age'] = '86400';
    }
    const done = (why) => { if (why) log(why); return new Response(null, { status: 204, headers }); };
    try {
      if (req.method === 'OPTIONS') return done();
      if (!deps.enabled || !ENV) return done('analytics-ingest: disabled');
      if (req.method !== 'POST') return done('analytics-ingest: method');
      if (!okOrigin) return done('analytics-ingest: origin refused');
      const net = senderNetwork(req);
      if (!allow(net || 'unknown')) return done('analytics-ingest: rate limited (this instance)');
      const len = +(req.headers.get('content-length') || 0);
      if (len > MAX_BYTES) return done('analytics-ingest: too large');
      const text = await req.text();
      const ua = req.headers.get('user-agent') || '';
      let body;
      try { body = text.length > MAX_BYTES ? null : JSON.parse(text); } catch (e) { body = null; }
      const events = body && Array.isArray(body.events) && body.events.length <= MAX_EVENTS ? body.events : null;
      const meta = { env: ENV, client_env: body && typeof body.env === 'string' ? body.env.slice(0, 10) : null, net, ua_family: uaFamily(ua), bot: isBotUa(ua) || !!(body && body.wd === true),
        client_errors: intOr0(body && body.client_errors), client_dropped: intOr0(body && body.client_dropped) };
      // A malformed or oversize batch from an allowed origin is still reported (as rejected:bad_batch) so Data health shows it.
      const { error } = await deps.rpc('analytics_ingest', { p_batch: events, p_meta: meta });
      if (error) return done('analytics-ingest: database error' + (error.code ? ' ' + error.code : ''));
      return done();
    } catch (e) {
      return done('analytics-ingest: unexpected ' + (e && e.name));
    }
  };
}
