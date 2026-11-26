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
 * Kill switch (ANALYTICS_INGEST_ENABLED not "true"): every request is answered 204 before the body is read or the database is
 * touched, so a flood writes nothing; each request is still one Edge Function invocation (counted against the plan's quota).
 * Database failure: 204, nothing retried, only the error code logged.
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

/* ---------------------------------------------------------------- sender address: TRUST MODEL
   The address is used for one thing only: the database's per-network rate limits. It is hashed there with a random value
   that changes daily and is never stored or logged. It is NEVER read from a place the caller controls:
     - The first (left-most) X-Forwarded-For entry is whatever the caller typed: it is never used.
     - Which header is trustworthy depends on the hosting platform and is a DEPLOYMENT SETTING (ANALYTICS_ADDRESS_SOURCE),
       chosen only after it has been demonstrated on the separate TEST project:
         none               (default) no address is trusted; every request counts against the small shared "unknown" limit
         cf-connecting-ip   the single address the platform's edge sets in CF-Connecting-IP
         xff-right-1..3     the Nth entry from the RIGHT of X-Forwarded-For (the hop appended by the platform's own proxy)
     - Anything that is not one exact, valid IPv4 or IPv6 address (a list, a port, a zone id, a host name, shorthand IPv4
       such as "1.2.3", leading zeros, junk) is treated as missing, so malformed values cannot create new identities.
     - IPv4-mapped IPv6 (::ffff:a.b.c.d) is reduced to the IPv4 address; the database groups IPv6 by /56. */
export const ADDRESS_SOURCES = ['none', 'cf-connecting-ip', 'xff-right-1', 'xff-right-2', 'xff-right-3'];
const V4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
export function parseAddress(value) {
  const v = String(value == null ? '' : value).trim();
  if (!v || v.length > 45) return '';
  if (V4.test(v)) return v;
  if (!/^[0-9a-fA-F:.]+$/.test(v) || v.indexOf(':') < 0) return '';
  let h;
  try { h = new URL('http://[' + v + ']/').hostname; } catch (e) { return ''; }
  h = h.replace(/^\[|\]$/g, '').toLowerCase();
  const m = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (m) { const a = parseInt(m[1], 16), b = parseInt(m[2], 16); return [a >> 8, a & 255, b >> 8, b & 255].join('.'); }
  return h;
}
export function senderNetwork(req, source = 'none') {
  if (source === 'cf-connecting-ip') {
    const v = req.headers.get('cf-connecting-ip') || '';
    return v.indexOf(',') < 0 ? parseAddress(v) : '';
  }
  const m = /^xff-right-([1-3])$/.exec(source);
  if (m) {
    const parts = (req.headers.get('x-forwarded-for') || '').split(',').map((x) => x.trim());
    const n = +m[1];
    return parts.length >= n && parts.join('') !== '' ? parseAddress(parts[parts.length - n]) : '';
  }
  return '';
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

/* The sender's Content-Length as a number, or null (absent). Missing, non-numeric and negative values count as absent; a plain
   decimal number counts as declared (as the previous `+header` reading did, so a declared 9000.5 is still refused early).
   It is only ever used to refuse a request EARLY; it never allows a body to be larger than the bytes actually read allow. */
export function declaredLength(value) {
  const v = String(value == null ? '' : value).trim();
  return /^[0-9]{1,15}(\.[0-9]{1,15})?$/.test(v) ? Number(v) : null;
}

/* Reads the request body while counting BYTES, and accepts at most `max` of them (the acceptance limit).
   - Each chunk is checked BEFORE it is copied: if it would take the total past `max`, nothing more is copied, the reader is
     cancelled and { oversize: true } is returned. Only accepted bytes are kept, in one fixed buffer of `max` bytes, so this code
     never holds an oversize body; the runtime's chunk currently being delivered is the only other data in memory here
     (its size is the runtime's choice).
   - The kept bytes are decoded ONCE at the end, so a character split across chunks decodes correctly. The decoder is the same
     UTF-8 decode Request.text() performs (a leading byte-order mark is removed; invalid byte sequences become U+FFFD), so a
     body within the limit yields exactly the text the previous req.text() call produced.
   - A body that errors while being read throws, as req.text() did. */
export async function readBodyLimited(req, max = MAX_BYTES) {
  if (!req.body) return { text: '', oversize: false, bytes: 0 };
  const reader = req.body.getReader();
  const kept = new Uint8Array(max);
  let used = 0;
  const stop = async () => { try { await reader.cancel(); } catch (e) { /* the stream is abandoned either way */ } };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!ArrayBuffer.isView(value)) { await stop(); throw new TypeError('request body chunk is not bytes'); }
    const chunk = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (used + chunk.byteLength > max) { await stop(); return { text: null, oversize: true, bytes: used }; }
    kept.set(chunk, used);
    used += chunk.byteLength;
  }
  return { text: new TextDecoder('utf-8').decode(kept.subarray(0, used)), oversize: false, bytes: used };
}

/* deps: { enabled: bool, rpc(fn, args) -> Promise<{error}>, config: {env: 'live'|'test'|'dev', allowedOrigins[], addressSource},
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
  const SOURCE = ADDRESS_SOURCES.includes(deps.config.addressSource) ? deps.config.addressSource : 'none';   // unknown setting -> trust nothing
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
      const net = senderNetwork(req, SOURCE);
      if (!allow(net || 'unknown')) return done('analytics-ingest: rate limited (this instance)');
      const len = declaredLength(req.headers.get('content-length'));
      if (len !== null && len > MAX_BYTES) return done('analytics-ingest: too large');   // declared too large: refused unread
      const { text, oversize } = await readBodyLimited(req, MAX_BYTES);                 // the real limit: bytes actually sent
      const ua = req.headers.get('user-agent') || '';
      let body;
      try { body = oversize ? null : JSON.parse(text); } catch (e) { body = null; }
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
