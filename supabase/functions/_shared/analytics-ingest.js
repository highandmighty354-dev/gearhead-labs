/* Gearhead Labs analytics — HTTP layer of the analytics-ingest Edge Function (Request -> Response).
 * Runtime-neutral (Deno and Node 18+); index.ts only reads secrets and wires the database call.
 *
 *   POST /analytics-ingest   body (text/plain or application/json, <= 8 KB):
 *        {"env":"live|test|dev", "events":[...<= 20], "client_errors":n, "client_dropped":n, "wd":bool}
 *
 * The answer is ALWAYS 204 with no body: a page can never learn why a batch was dropped, and a failure here can never
 * surface in the visitor's page. Deployed WITHOUT JWT verification so navigator.sendBeacon works (it cannot set headers).
 * Protection instead: kill switch, origin allow-list, size / count caps, best-effort per-address rate limit, bot flag,
 * and the database's own validation (analytics_ingest(): catalogue, property allow-lists, duplicates, per-session cap).
 * Never stored or logged: the IP address (used only as an in-memory rate-limit key), the full user agent, the body. */

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

const isLocal = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);

/* Environment: decided by the server, never trusted blindly from the page.
 *   localhost origins -> dev;  an origin in liveOrigins -> live (or test if the page says test);  any other allowed origin -> test */
export function decideEnv(origin, asked, { liveOrigins = [] } = {}) {
  if (isLocal(origin)) return 'dev';
  if (liveOrigins.includes(origin)) return asked === 'test' ? 'test' : 'live';
  return 'test';
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

/* deps: { enabled: bool, rpc(fn, args) -> Promise<{error}>, config: {allowedOrigins[], liveOrigins[]}, allow(key) -> bool, log(msg) } */
export function makeAnalyticsIngestHandler(deps) {
  const allowed = deps.config.allowedOrigins || [];
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
      if (!deps.enabled) return done('analytics-ingest: disabled');
      if (req.method !== 'POST') return done('analytics-ingest: method');
      if (!okOrigin) return done('analytics-ingest: origin refused');
      const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
      if (!allow(ip)) return done('analytics-ingest: rate limited');
      const len = +(req.headers.get('content-length') || 0);
      if (len > MAX_BYTES) return done('analytics-ingest: too large');
      const text = await req.text();
      const ua = req.headers.get('user-agent') || '';
      let body;
      try { body = text.length > MAX_BYTES ? null : JSON.parse(text); } catch (e) { body = null; }
      const env = decideEnv(origin, body && body.env, deps.config);
      const events = body && Array.isArray(body.events) && body.events.length <= MAX_EVENTS ? body.events : null;
      const meta = { env, ua_family: uaFamily(ua), bot: isBotUa(ua) || !!(body && body.wd === true),
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
