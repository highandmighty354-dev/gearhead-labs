/* Gearhead Labs first-party analytics client (docs/ANALYTICS-BLUEPRINT.md; implementation notes in
   docs/ANALYTICS-IMPLEMENTATION.md).

   OFF unless window.GH_ANALYTICS_CONFIG.enabled === true (analytics-config.js ships with enabled: false). When off it
   returns immediately: no storage, no listeners, no timers, no network.

   When on, it only observes. It never calls, wraps or replaces any calculator function, never reads what a visitor types,
   and every handler is wrapped so an exception here can never reach the page (exceptions are only counted). Sending is
   asynchronous (sendBeacon / fetch keepalive, no-cors, no cookies), batched, and capped.

   Collected per event: a random event id, the event name, a random visitor id (13 months in localStorage; session-only
   when the browser sends Global Privacy Control or Do Not Track), a random session id, a page key such as
   "calc:hp_from_et" (never the full URL), a viewport size class (s/m/l) and a few allow-listed properties. Never
   collected: calculator inputs or results, search text, email, account id, IP address, full user agent, full URL. */
(function () {
  'use strict';
  var CFG = window.GH_ANALYTICS_CONFIG || {};
  var EP = typeof CFG.endpoint === 'string' ? CFG.endpoint : '';
  if (CFG.enabled !== true || !(/^https:\/\/[^\s]+$/.test(EP) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(EP))) {
    window.GH_ANALYTICS = { status: 'off' };
    return;
  }
  var ENV = CFG.env === 'test' || CFG.env === 'dev' ? CFG.env : 'live';
  var SESSION_IDLE = 30 * 60 * 1000, ACTIVE_WINDOW = 30000, PING_EVERY = 5 * 60 * 1000, PAGE_CAP = 30 * 60 * 1000;
  var COMPLETE_AFTER = 2000, SEARCH_IDLE = 1500, SEARCH_HOLD = 20000, NAV_WINDOW = 3000, REDIRECT_WINDOW = 15000;
  var MAX_QUEUE = 50, MAX_BATCH = 20, MAX_BODY = 7800;

  var errors = 0, dropped = 0;
  function safe(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { errors++; } }; }
  var now = function () { return Date.now(); };

  /* ---------- storage (every access guarded: private windows and blocked storage just mean less continuity) ---------- */
  function sget(store, k) { try { return JSON.parse(window[store].getItem(k)); } catch (e) { return null; } }
  function sset(store, k, v) { try { window[store].setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  function uuid() {
    try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* fall through */ }
    var b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  /* ---------- visitor and session ---------- */
  var PRIVATE = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  var VSTORE = PRIVATE ? 'sessionStorage' : 'localStorage';
  var visitor = sget(VSTORE, 'gh_a_vid'), newVisitor = false;
  if (!visitor || typeof visitor.id !== 'string' || !(visitor.exp > now())) {
    visitor = { id: uuid(), exp: now() + 396 * 864e5 }; newVisitor = true; sset(VSTORE, 'gh_a_vid', visitor);
  }
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  function token(v) {
    v = String(v || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
    return v || null;
  }
  var landing = new URLSearchParams(location.search), utm = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) { var t = token(landing.get(k)); if (t) utm[k] = t; });
  var campaign = utm.utm_source || utm.utm_medium ? [utm.utm_source, utm.utm_medium, utm.utm_campaign].join('|') : null;
  var refHost = null;
  try {
    if (document.referrer) {
      var rh = new URL(document.referrer).hostname.toLowerCase();
      if (rh && rh !== location.hostname && /^[a-z0-9.-]{1,100}$/.test(rh)) refHost = rh;
    }
  } catch (e) { /* ignore */ }

  var S = sget(VSTORE, 'gh_a_s');
  var sessionIsNew = false;
  function ensureSession() {
    var t = now();
    if (!S || typeof S.id !== 'string' || t - S.last > SESSION_IDLE || S.day !== today() || (campaign && S.camp !== campaign)) {
      S = { id: uuid(), last: t, day: today(), camp: campaign };
      sessionIsNew = true;
      sset(VSTORE, 'gh_a_s', S);
      return true;
    }
    S.last = t; sset(VSTORE, 'gh_a_s', S);
    return false;
  }
  var lastTouchSaved = 0;
  function touch(t) {                    // activity keeps the session alive (stored at most every 15 s)
    if (!S) return;
    S.last = t;
    if (t - lastTouchSaved > 15000) { lastTouchSaved = t; sset(VSTORE, 'gh_a_s', S); }
  }

  /* ---------- queue and delivery ---------- */
  var Q = sget('sessionStorage', 'gh_a_q');
  if (!Array.isArray(Q)) Q = [];
  var seq = 0, inflight = false, failures = 0, retryAt = 0;
  var save = function () { sset('sessionStorage', 'gh_a_q', Q); };
  var vp = function () { var w = window.innerWidth || 1024; return w < 600 ? 's' : w < 1024 ? 'm' : 'l'; };
  var cur = { page: null, pv: null, start: 0, unreported: 0, reported: 0, lastPing: 0, calc: null, gate: false, offer: false };

  function emit(name, props, page, pv) {
    var e = { event_id: uuid(), name: name, ts_client: new Date().toISOString(), vid: visitor.id, sid: S.id, seq: seq++,
      page: page || cur.page || 'home', pv_id: pv || cur.pv || null, viewport: vp(), props: props || {} };
    Q.push(e);
    while (Q.length > MAX_QUEUE) { Q.shift(); dropped++; }
    save();
    if (Q.length >= 10) flush(false);
  }
  function body(batch) {
    return JSON.stringify({ env: ENV, events: batch, client_errors: errors, client_dropped: dropped, wd: navigator.webdriver === true });
  }
  function take() {
    var n = Math.min(Q.length, MAX_BATCH);
    while (n > 1 && body(Q.slice(0, n)).length > MAX_BODY) n = Math.floor(n / 2);
    if (body(Q.slice(0, n)).length > MAX_BODY) { Q.shift(); dropped++; save(); return null; }   // one event over the limit cannot be sent
    var batch = Q.splice(0, n); save();
    return { batch: batch, text: body(batch) };
  }
  function requeue(batch) {
    Q = batch.concat(Q);
    while (Q.length > MAX_QUEUE) { Q.pop(); dropped++; }
    save();
  }
  function flush(onHide) {
    if (!Q.length) return;
    if (onHide) {                       // page is going away: hand everything to the browser, no waiting
      for (var guard = 0; Q.length && guard < 5; guard++) {
        var p = take(); if (!p) continue;
        errors = 0; dropped = 0;
        var sent = false;
        try { sent = !!(navigator.sendBeacon && navigator.sendBeacon(EP, new Blob([p.text], { type: 'text/plain' }))); } catch (e) { sent = false; }
        if (!sent) { try { fetch(EP, { method: 'POST', body: p.text, keepalive: true, mode: 'no-cors', credentials: 'omit', headers: { 'content-type': 'text/plain' } }).catch(function () {}); } catch (e) { /* lost */ } }
      }
      return;
    }
    if (inflight || now() < retryAt) return;
    var q = take(); if (!q) return;
    inflight = true;
    var counted = [errors, dropped]; errors = 0; dropped = 0;
    var fail = function () { inflight = false; failures++; retryAt = now() + Math.min(300000, 15000 * failures); errors += counted[0]; dropped += counted[1]; requeue(q.batch); };
    try {
      fetch(EP, { method: 'POST', body: q.text, keepalive: true, mode: 'no-cors', credentials: 'omit', headers: { 'content-type': 'text/plain' } })
        .then(function () { inflight = false; failures = 0; retryAt = 0; if (Q.length) setTimeout(safe(function () { flush(false); }), 0); }, fail);
    } catch (e) { fail(); }
  }

  /* ---------- page keys ---------- */
  var frameEl = function () { return document.getElementById('app'); };
  function frameWin() { try { var f = frameEl(); var w = f && f.contentWindow; return w && w.document ? w : null; } catch (e) { return null; } }
  var key = function (s) { return /^[a-z0-9_]{1,64}$/.test(s) ? s : null; };
  function pageKey() {
    var top = new URLSearchParams(location.search), v = top.get('view');
    if (v && v !== 'calculators' && /^[a-z]{1,20}$/.test(v)) return 'view:' + v;
    var w = frameWin(), p = new URLSearchParams(w ? w.location.search : location.search);
    var pg = p.get('page') || top.get('page');
    if (pg && /^[a-z]{1,20}$/.test(pg)) return 'page:' + pg;
    var calc = p.get('calc') || top.get('calc');
    if (calc) {
      calc = String(calc).toLowerCase();
      try { var al = w && w.GH_CALC_ALIASES; if (al && al[calc]) calc = al[calc]; } catch (e) { /* ignore */ }
      return calc === 'dashboard' ? 'home' : key(calc) ? 'calc:' + calc : 'calc:unknown';
    }
    var lab = p.get('lab') || top.get('lab');
    if (lab && /^[a-z]{1,20}$/.test(lab)) return 'lab:' + lab;
    return 'home';
  }
  var calcId = function (page) { return page && page.indexOf('calc:') === 0 && page !== 'calc:unknown' ? page.slice(5) : null; };

  /* ---------- page views and engagement ---------- */
  var pendingNav = null, firstView = true;
  function leave() {
    if (!cur.pv) return;
    var ms = Math.min(cur.unreported, Math.max(0, PAGE_CAP - cur.reported));
    emit('page_leave', { engaged_ms: Math.round(ms) });
    cur.reported += ms; cur.unreported = 0;
    if (cur.calc && cur.calc.timer) clearTimeout(cur.calc.timer);
    if (pendingSearch) finishSearch(null);
  }
  function view(page) {
    var from = cur.page, fromPv = cur.pv;
    if (cur.pv) leave();
    var started = ensureSession();
    cur = { page: page, pv: uuid(), start: now(), unreported: 0, reported: 0, lastPing: now(), calc: null, gate: false, offer: false };
    lastActivity = now();
    if (pendingNav && now() - pendingNav.at <= NAV_WINDOW && from && from !== page && !started)
      emit('nav_click', { to_page: page, element: pendingNav.element }, from, fromPv);
    pendingNav = null;
    var props = {};
    if (started) {
      props.is_session_start = true;
      if (!PRIVATE) props.is_new_visitor = newVisitor;
      if (firstView) { if (refHost) props.ref_host = refHost; for (var k in utm) props[k] = utm[k]; }
    }
    firstView = false; newVisitor = false;
    emit('page_view', props);
    var id = calcId(page);
    if (id) { cur.calc = { id: id, started: false, at: 0, fields: {}, done: false, timer: null, lastInput: 0, changedAt: 0 }; emit('calc_view', { calc_id: id }); }
    flush(false);
  }

  var lastActivity = now(), lastTick = now();
  var active = function () { lastActivity = now(); };
  function tick() {
    var t = now(), dt = Math.min(t - lastTick, 2000); lastTick = t;
    var visible = document.visibilityState === 'visible', focused = true;
    try { focused = document.hasFocus(); } catch (e) { /* assume focused */ }
    var engaged = visible && focused && t - lastActivity < ACTIVE_WINDOW;
    if (engaged) touch(t);
    if (cur.pv && engaged && cur.reported + cur.unreported < PAGE_CAP) cur.unreported += dt;
    if (cur.pv && t - cur.lastPing >= PING_EVERY) ping();
  }
  function ping() {
    cur.lastPing = now();
    var ms = Math.min(cur.unreported, 330000, Math.max(0, PAGE_CAP - cur.reported));
    if (ms < 1000) return;
    emit('page_ping', { engaged_ms_delta: Math.round(ms) });
    cur.reported += ms; cur.unreported -= ms;
  }

  /* ---------- calculators ----------
     start    = the first TRUSTED input/change inside the calculator on this page view (scripted fills are ignored)
     complete = 2 s after the visitor's last input, the calculator has re-rendered since that input AND shows at least one
                finite numeric result and no NaN / Infinity / error value. Once per page view. If the result appears later
                (still within 30 s of the last input), it is checked again shortly after it appears.
     The result text is only classified here (number / empty / text / bad); it is never stored or sent. */
  var RESULT_SEL = '#calc-container .result-value, #calc-container .mini-result .value';
  var BAD_RESULT = /nan|infinity|∞|undefined|null|error|invalid|overflow|divide by zero/i;
  var NUM_RESULT = /^[~≈<>≤≥±]?\s*[$€£]?\s*([+\-−]?)(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)(?:\s*(?:[eE]|[×x]\s*10\^?)\s*([+\-−]?\d+))?/;
  function classifyResult(text) {
    var t = String(text || '').replace(/[   ]/g, ' ').trim();
    if (!t || /^[—–\-\s]+$/.test(t) || /^(enter|select|choose|awaiting)\b/i.test(t)) return 'empty';
    if (BAD_RESULT.test(t)) return 'bad';
    var m = NUM_RESULT.exec(t);
    if (!m) return 'text';
    var n = parseFloat((m[1] === '−' ? '-' : m[1]) + m[2].replace(/,/g, '') + (m[3] ? 'e' + m[3].replace('−', '-') : ''));
    return isFinite(n) ? 'number' : 'bad';
  }
  function valueText(el) {                       // the value without its unit span
    var c = el.cloneNode(true), u = c.querySelectorAll('.unit');
    for (var i = 0; i < u.length; i++) u[i].parentNode.removeChild(u[i]);
    return c.textContent;
  }
  function resultState(doc) {
    var els = doc ? doc.querySelectorAll(RESULT_SEL) : [], n = 0, bad = 0;
    for (var i = 0; i < els.length; i++) { var k = classifyResult(valueText(els[i])); if (k === 'number') n++; else if (k === 'bad') bad++; }
    return !els.length ? 'none' : bad ? 'invalid' : n ? 'valid' : 'invalid';
  }
  var resultsObs = null, observed = null;
  function observeResults() {
    var w = frameWin(), cont = w && w.document.getElementById('calc-container');
    if (!cont || cont === observed || typeof MutationObserver !== 'function') return;
    if (resultsObs) resultsObs.disconnect();
    observed = cont;
    resultsObs = new MutationObserver(safe(function () {
      var c = cur.calc; if (!c || !c.started || c.done) return;
      var t = now(); c.changedAt = t;
      if (t - c.lastInput <= 30000) schedule(c, Math.max(c.lastInput + COMPLETE_AFTER - t, 250));
    }));
    resultsObs.observe(cont, { childList: true, subtree: true, characterData: true });
  }
  function schedule(c, ms) {
    if (c.timer) clearTimeout(c.timer);
    var pv = cur.pv;
    c.timer = setTimeout(safe(function () { checkComplete(pv); }), ms);
  }
  function onCalcInput(t) {
    var c = cur.calc; if (!c) return;
    var cont = t.closest('#calc-container'); if (!cont) return;
    observeResults();
    var fk = t.id || t.name || ('i' + Array.prototype.indexOf.call(cont.querySelectorAll('input,select,textarea'), t));
    c.fields[fk] = 1;                                     // the field's identity only, to count fields; never its value
    if (!c.started) { c.started = true; c.at = now(); emit('calc_start', { calc_id: c.id }); }
    if (c.done) return;
    c.lastInput = now(); c.changedAt = 0;
    schedule(c, COMPLETE_AFTER);
  }
  function checkComplete(pv) {
    var c = cur.calc; if (!c || c.done || cur.pv !== pv) return;
    if (now() - c.lastInput < COMPLETE_AFTER - 50) return schedule(c, c.lastInput + COMPLETE_AFTER - now());
    var w = frameWin(); if (!w) return;
    var replaced = w.document.getElementById('calc-container') !== observed;   // the whole card was re-created: that is a re-render too
    if (!(c.changedAt >= c.lastInput) && !replaced) return;                       // no re-render since the visitor's last input
    if (resultState(w.document) !== 'valid') return;
    c.done = true;
    emit('calc_complete', { calc_id: c.id, fields_touched: Math.min(100, Object.keys(c.fields).length), ms_to_complete: Math.min(86400000, now() - c.at) });
  }

  /* ---------- search: result count after 1.5 s idle; the click rank if a result is chosen. The text is never read out. ---------- */
  var pendingSearch = null, searchTimer = null;
  function finishSearch(rank) {
    var s = pendingSearch; pendingSearch = null; if (!s) return;
    clearTimeout(s.hold);
    var props = { result_count: s.count }; if (rank) props.clicked_rank = rank;
    emit('search', props, s.page, s.pv);
  }
  function onSearchInput(t) {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(safe(function () {
      if (!String(t.value || '').trim()) { if (pendingSearch) finishSearch(null); return; }
      if (pendingSearch) finishSearch(null);
      var w = frameWin(), h = w && w.document.querySelector('#calc-nav .gh-nav-search-title, #calc-nav .cat-header'), m = h && /^(\d+)\s+RESULTS?/.exec((h.textContent || '').trim());
      if (!m) return;
      pendingSearch = { count: Math.min(10000, +m[1]), page: cur.page, pv: cur.pv, hold: setTimeout(safe(function () { finishSearch(null); }), SEARCH_HOLD) };
    }), SEARCH_IDLE);
  }

  /* ---------- clicks: navigation context, Premium funnel buttons ---------- */
  var trial = null;
  function classify(el) {
    if (el.closest('.gh-premium-cta,[data-premium-offer] a')) return 'premium_cta';
    if (el.closest('#calc-nav')) {                         // a search result when the search box is not empty (emptiness only)
      var box = el.ownerDocument.getElementById('search-input');
      return box && String(box.value || '').trim() ? 'search_result' : 'nav';
    }
    if (el.closest('.gh-directory,.gh-landing')) return 'lab_tile';
    if (el.closest('.gh-e110-footer,footer')) return 'footer';
    if (el.closest('#ghp-nav,.jump-menu,nav')) return 'nav';
    if (el.closest('[class*="encyclop"],[id*="encyclop"]')) return 'encyclopedia';
    if (el.closest('[class*="related"],.gh-premium-companion-link')) return 'related';
    return 'other';
  }
  function onClick(e) {
    var t = e.target; if (!t || !t.closest) return;
    var act = t.closest('[data-action]');
    if (act) {
      var a = act.getAttribute('data-action');
      if (a === 'checkout') {
        var iv = act.getAttribute('data-interval');
        if (iv === 'month' || iv === 'year') { trial = { interval: iv, at: now() }; emit('trial_click', { interval: iv, trial: /trial/i.test(act.textContent || '') }); flush(false); }
      } else if (a === 'portal') { emit('portal_open', {}); flush(false); }
    }
    var el = t.closest('a,button,.calc-item,[onclick]'); if (!el) return;
    var kind = classify(el);
    if (kind === 'search_result' && pendingSearch) {
      var items = Array.prototype.slice.call(el.ownerDocument.querySelectorAll('#calc-nav .gh-nav-item, #calc-nav .calc-item'));
      var r = items.indexOf(el.closest('.gh-nav-item, .calc-item')) + 1;
      finishSearch(r > 0 ? r : null);
    }
    pendingNav = { element: kind, at: now() };
  }
  function onSubmit(e) {
    var f = e.target;
    if (f && f.matches && f.matches('form[data-form="signin"]')) { emit('signin_request', {}); flush(false); }
  }
  function onInput(e) {
    if (!e.isTrusted) return;
    var t = e.target; if (!t || !t.closest) return;
    if (t.id === 'search-input') return onSearchInput(t);
    active();
    onCalcInput(t);
  }

  /* ---------- attach listeners (top document once; the frame document whenever it is new) ---------- */
  var opts = { capture: true, passive: true };
  function listenActivity(target) {
    ['pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel', 'mousemove'].forEach(function (ev) { target.addEventListener(ev, safe(active), opts); });
  }
  function attachFrame() {
    var w = frameWin(); if (!w) return;
    var d = w.document; if (d.__ghAnalytics) return;
    d.__ghAnalytics = true;
    listenActivity(d);
    d.addEventListener('input', safe(onInput), opts);
    d.addEventListener('change', safe(onInput), opts);
    d.addEventListener('click', safe(onClick), opts);
  }

  /* ---------- Premium funnel detection ---------- */
  /* signin_complete: a Supabase session appears in this browser. Only the presence of the auth-token KEY NAME is
     checked (never its value, never the client, never the user id): no visitor-to-account link is made. A session that
     already existed when the page loaded is a restored one, not a sign-in, unless the page was opened from a magic link. */
  var hadSession = null, signinSent = false;
  var urlSignin = /access_token=|type=magiclink/.test(location.hash) || landing.has('code');   // read before Supabase cleans the URL
  function hasSession() {
    try { for (var i = 0; i < localStorage.length; i++) if (/^sb-[a-z0-9]+-auth-token$/.test(localStorage.key(i) || '')) return true; } catch (e) { /* ignore */ }
    return false;
  }
  function watchSignin() {
    var now_ = hasSession();
    if (hadSession === null) { hadSession = now_; if (now_ && urlSignin && !signinSent) { signinSent = true; emit('signin_complete', {}); } return; }
    if (now_ && !hadSession && !signinSent) { signinSent = true; emit('signin_complete', {}); }
    hadSession = now_;
  }
  function watchFunnel() {
    var id = calcId(cur.page);
    if (id && !cur.gate) {
      var w = frameWin(), g = w && w.document.querySelector('#calc-container .gh-premium-upsell');
      if (g) { cur.gate = true; emit('premium_gate_view', { calc_id: id }); }
    }
    if (!cur.offer) {
      var o = document.querySelector('[data-premium-offer]');
      if (o && o.offsetParent !== null) { cur.offer = true; emit('premium_offer_view', { signed_in: !!document.querySelector('[data-action="signout"]') }); }
    }
  }

  /* ---------- main loop ---------- */
  var poll = safe(function () {
    attachFrame();
    watchSignin();
    var k = pageKey();
    if (k !== cur.page) view(k);
    else if (now() - S.last > SESSION_IDLE || S.day !== today()) view(k);     // the session expired while the page stayed open
    tick();
    watchFunnel();
    if (now() - lastFlush > 15000) { lastFlush = now(); flush(false); }
  });
  var lastFlush = now();

  safe(function () {
    listenActivity(document);
    document.addEventListener('click', safe(onClick), opts);
    document.addEventListener('submit', safe(onSubmit), opts);
    document.addEventListener('input', safe(onInput), opts);
    window.addEventListener('gh:frameready', function () { poll(); });      // app-shell: the calculator frame is ready
    document.addEventListener('visibilitychange', safe(function () { if (document.visibilityState === 'hidden') { ping(); flush(true); } }));
    window.addEventListener('pagehide', safe(function () {
      leave();
      if (trial && now() - trial.at <= REDIRECT_WINDOW) { emit('checkout_redirect', { interval: trial.interval }); trial = null; }
      flush(true);
    }));
    var start = function () {
      poll();
      var c = landing.get('checkout');
      if ((c === 'success' || c === 'cancelled') && sget('sessionStorage', 'gh_a_cr') !== S.id + c) {
        sset('sessionStorage', 'gh_a_cr', S.id + c);
        emit('checkout_return', { outcome: c });
      }
      setInterval(poll, 500);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safe(start)); else start();
  })();

  // read-only helpers for the test suites: classifyResult/resultState return only a category, never a value
  window.GH_ANALYTICS = { status: 'on', flush: safe(function () { flush(false); }), _queue: function () { return Q.slice(); },
    classifyResult: classifyResult, resultState: function (doc) { return resultState(doc); } };
})();
