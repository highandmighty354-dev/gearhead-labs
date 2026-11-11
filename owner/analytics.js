/* Gearhead Labs owner analytics dashboard. Reads ONLY aggregates through owner-checked database functions
   (analytics_is_owner, analytics_refresh, analytics_dashboard); the raw event tables are not readable by any client.
   No charting library: small inline SVG and CSS bars. */
(function () {
  'use strict';
  var TZ = 'America/New_York';
  var main = document.getElementById('oa-main'), who = document.getElementById('oa-who');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var num = function (n) { return (+n || 0).toLocaleString('en-US'); };
  var pct = function (a, b) { return b ? (100 * a / b).toFixed(1) + '%' : '—'; };
  function dur(ms) { ms = Math.round(+ms || 0); var s = Math.round(ms / 1000); if (s < 60) return s + 's'; var m = Math.floor(s / 60); if (m < 60) return m + 'm ' + String(s % 60).padStart(2, '0') + 's'; return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm'; }
  function card(id, title, sub, body) { return '<section class="oa-card" id="' + id + '"><h2>' + esc(title) + '</h2>' + (sub ? '<p class="oa-sub">' + sub + '</p>' : '') + body + '</section>'; }
  function message(title, html) { main.innerHTML = '<section class="oa-card oa-center" data-state="' + esc(title.toLowerCase().replace(/\W+/g, '-')) + '"><h2>' + esc(title) + '</h2>' + html + '</section>'; }

  /* ---------- dates (the reporting day is America/New_York, as in the database) ---------- */
  var fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  var today = function () { return fmtDay.format(new Date()); };
  function addDays(d, n) { var t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
  var PRESETS = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 };

  /* ---------- catalogue: calculator names, labs, free/premium ---------- */
  var CAT = { byId: {}, free: [], loaded: false };
  var LAB_NAMES = { gasoline: 'GASOLINE LAB', diesel: 'DIESEL LAB', ev: 'EV LAB', towing: 'TOWING LAB', universal: 'UNIVERSAL LAB' };
  function loadCatalog() {
    return fetch('../catalog/gearhead-catalog.json', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      (j && j.tools || []).forEach(function (t) { CAT.byId[t.id] = t; if (t.tier !== 'premium') CAT.free.push(t.id); });
      CAT.loaded = !!j;
    }).catch(function () { /* names fall back to ids */ });
  }
  function pageLabel(p) {
    if (p === 'home') return 'Home (all calculators)';
    var m = /^(calc|lab|page|view):(.+)$/.exec(p || ''); if (!m) return p;
    if (m[1] === 'calc') return (CAT.byId[m[2]] ? CAT.byId[m[2]].name : m[2]);
    if (m[1] === 'lab') return LAB_NAMES[m[2]] || m[2].toUpperCase() + ' LAB';
    if (m[1] === 'view') return 'Premium · ' + m[2];
    return m[2].charAt(0).toUpperCase() + m[2].slice(1) + ' page';
  }

  /* ---------- small charts ---------- */
  var tip = document.createElement('div'); tip.className = 'oa-tip'; document.body.appendChild(tip);
  function showTip(e, text) { tip.textContent = text; tip.style.display = 'block'; tip.style.left = Math.min(e.clientX + 12, innerWidth - 180) + 'px'; tip.style.top = (e.clientY + 12) + 'px'; }
  document.addEventListener('pointerover', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(e, t.getAttribute('data-tip')); });
  document.addEventListener('pointermove', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(e, t.getAttribute('data-tip')); else tip.style.display = 'none'; });
  document.addEventListener('pointerleave', function () { tip.style.display = 'none'; });

  function lineChart(rows, key, label) {
    var W = 640, H = 180, L = 36, R = 8, T = 10, B = 24, n = rows.length;
    if (!n) return '<p class="oa-empty">No days in range.</p>';
    var max = Math.max(1, Math.max.apply(null, rows.map(function (r) { return +r[key] || 0; })));
    var nice = Math.pow(10, Math.floor(Math.log10(max))); max = Math.ceil(max / nice) * nice;
    var x = function (i) { return L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1)); }, y = function (v) { return T + (H - T - B) * (1 - v / max); };
    var pts = rows.map(function (r, i) { return x(i).toFixed(1) + ',' + y(+r[key] || 0).toFixed(1); });
    var s = '<svg class="oa-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + ' per day">';
    [0, 0.5, 1].forEach(function (f) { var v = max * f; s += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + num(v) + '</text>'; });
    s += '<polygon class="area" points="' + x(0) + ',' + y(0) + ' ' + pts.join(' ') + ' ' + x(n - 1) + ',' + y(0) + '"/><polyline class="line" points="' + pts.join(' ') + '"/>';
    var step = Math.max(1, Math.ceil(n / 6));
    rows.forEach(function (r, i) { if (i % step === 0 || i === n - 1) s += '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(String(r.day).slice(5)) + '</text>'; });
    var bw = (W - L - R) / Math.max(1, n);
    rows.forEach(function (r, i) { s += '<rect class="hit" x="' + (x(i) - bw / 2) + '" y="' + T + '" width="' + bw + '" height="' + (H - T - B) + '" data-tip="' + esc(r.day + ': ' + num(r[key]) + ' ' + label.toLowerCase()) + '"/><circle class="dot" cx="' + x(i) + '" cy="' + y(+r[key] || 0) + '" r="4"/>'; });
    return s + '</svg>';
  }
  function hbars(rows, opts) {
    opts = opts || {};
    if (!rows.length) return '<p class="oa-empty">' + (opts.empty || 'No data in this period.') + '</p>';
    var max = Math.max.apply(null, rows.map(function (r) { return +r.v || 0; })) || 1;
    return '<div class="oa-hbars">' + rows.map(function (r) {
      return '<div class="oa-hbar" data-tip="' + esc(r.k + ': ' + (r.tip || num(r.v))) + '"><span class="k">' + esc(r.k) + '</span><span class="t"><span class="f" style="width:' + (100 * (+r.v || 0) / max).toFixed(1) + '%"></span></span><span class="val">' + esc(r.label || num(r.v)) + '</span></div>';
    }).join('') + '</div>';
  }
  function table(cols, rows, empty) {
    if (!rows.length) return '<p class="oa-empty">' + (empty || 'No data in this period.') + '</p>';
    return '<div class="oa-tablewrap"><table><thead><tr>' + cols.map(function (c) { return '<th scope="col">' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (v, i) { return '<td' + (i && (v === 0 || v === '0' || v === '—') ? ' class="n0"' : '') + '>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function kpi(label, cur, prev, fmt) {
    fmt = fmt || num;
    var d = '', cls = '';
    if (prev == null) d = '';
    else if (+prev === 0) d = +cur > 0 ? 'new this period' : 'no change';
    else { var ch = (cur - prev) / prev * 100; cls = ch > 0.05 ? 'up' : ch < -0.05 ? 'down' : ''; d = (ch > 0 ? '▲ ' : ch < 0 ? '▼ ' : '') + Math.abs(ch).toFixed(1) + '% vs previous (' + fmt(prev) + ')'; }
    return '<div class="oa-kpi"><div class="l">' + esc(label) + '</div><div class="v">' + esc(fmt(cur)) + '</div><div class="d ' + cls + '">' + esc(d) + '</div></div>';
  }

  /* ---------- report sections ---------- */
  var FUNNEL = [['premium_gate_view', 'Locked Premium calculator seen'], ['premium_offer_view', 'Premium offer seen'], ['signin_request', 'Sign-in link requested'],
    ['signin_complete', 'Signed in'], ['trial_click', 'Trial button clicked'], ['checkout_redirect', 'Sent to Stripe checkout'],
    ['checkout_return:success', 'Back from checkout: success'], ['checkout_return:cancelled', 'Back from checkout: cancelled'], ['portal_open', 'Billing portal opened']];

  function render(r, st) {
    var k = r.kpis, p = r.kpis_previous, h = r.health || {}, tot = h.totals || {};
    var out = '';
    if (st.env !== 'live') out += '<div class="oa-banner test" data-banner="test"><b>' + esc(st.env.toUpperCase()) + ' DATA.</b> Synthetic or trial traffic, kept apart from real visitors. Switch to “Live” for the real site.</div>';
    else if (!h.last_event_at) out += '<div class="oa-banner" data-banner="no-live"><b>No live visitor data yet.</b> Tracking is switched off on the website until the owner decisions in docs/ANALYTICS-IMPLEMENTATION.md are made. Until real traffic arrives, nothing on this page has been validated against real visitors.</div>';

    out += card('overview', 'Overview', esc(r.range.from + ' to ' + r.range.to) + ' · compared with ' + esc(r.range.previous_from + ' to ' + r.range.previous_to) + ' · days in ' + esc(r.range.timezone),
      '<div class="oa-kpis">' + kpi('Visitors', k.visitors, p.visitors) + kpi('Sessions', k.sessions, p.sessions) + kpi('Page views', k.page_views, p.page_views) +
      kpi('Engaged sessions', k.engaged_sessions, p.engaged_sessions) + kpi('Avg engaged time / session', k.avg_engaged_ms, p.avg_engaged_ms, dur) + '</div>' +
      '<h3>Visitors per day</h3>' + lineChart(r.trend, 'visitors', 'Visitors') +
      '<details><summary class="oa-sub">Table</summary>' + table(['Day', 'Visitors', 'Sessions', 'Page views'], r.trend.map(function (t) { return [t.day, num(t.visitors), num(t.sessions), num(t.page_views)]; })) + '</details>');

    var pages = r.pages || [];
    var prow = function (x) { return [pageLabel(x.page), num(x.views), num(x.entrances), num(x.exits), pct(x.exits, x.views), x.leaves ? dur(x.engaged_ms / x.leaves) : '—']; };
    var cols = ['Page', 'Views', 'Landings', 'Exits', 'Exit rate', 'Avg engaged'];
    out += card('pages', 'Pages', 'Engaged time counts only while the tab is visible, focused and in use (capped at 30 minutes per view).',
      '<h3>Most visited</h3>' + table(cols, pages.slice(0, 15).map(prow)) +
      '<div class="oa-grid2"><div><h3>Top landing pages</h3>' + table(['Page', 'Landings'], pages.filter(function (x) { return x.entrances > 0; }).sort(function (a, b) { return b.entrances - a.entrances; }).slice(0, 10).map(function (x) { return [pageLabel(x.page), num(x.entrances)]; })) + '</div>' +
      '<div><h3>Top exit pages</h3>' + table(['Page', 'Exits', 'Exit rate'], pages.filter(function (x) { return x.exits > 0; }).sort(function (a, b) { return b.exits - a.exits; }).slice(0, 10).map(function (x) { return [pageLabel(x.page), num(x.exits), pct(x.exits, x.views)]; })) + '</div></div>' +
      '<h3>Least visited (of pages with any visit)</h3>' + table(cols, pages.slice().reverse().slice(0, 10).map(prow)));

    var ch = r.channels || [], CH = { organic: 'Organic search', direct: 'Direct / unknown', referral: 'Referral', social: 'Social', campaign: 'Campaign (UTM)', ai_assistant: 'AI assistants' };
    out += card('traffic', 'Traffic sources', 'Organic search is measured from the referring site (search engines send no keywords). Search Console holds the queries.',
      hbars(ch.map(function (c) { return { k: CH[c.channel] || c.channel, v: c.sessions, label: num(c.sessions) + ' · ' + pct(c.engaged, c.sessions) + ' engaged' }; })) +
      '<div class="oa-grid2"><div><h3>Referring sites</h3>' + table(['Site', 'Sessions'], (r.referrers || []).slice(0, 15).map(function (x) { return [x.host, num(x.sessions)]; })) + '</div>' +
      '<div><h3>Campaigns</h3>' + table(['Source / medium / campaign', 'Sessions', 'Engaged'], (r.campaigns || []).map(function (x) { return [[x.source || '—', x.medium || '—', x.campaign || '—'].join(' / '), num(x.sessions), num(x.engaged)]; }), 'No tagged campaign links used in this period.') + '</div></div>');

    var calcs = (r.calculators || []).slice(), used = {};
    calcs.forEach(function (c) { used[c.calc_id] = 1; });
    var crow = function (c) { return [pageLabel('calc:' + c.calc_id), num(c.views), num(c.starts), num(c.completes), num(c.abandons), pct(c.completes, c.starts), c.completes ? dur(c.ms_to_complete / c.completes) : '—']; };
    var ccols = ['Calculator', 'Views', 'Starts', 'Completions', 'Abandoned', 'Completion rate', 'Avg time to result'];
    var byStarts = calcs.slice().sort(function (a, b) { return b.starts - a.starts || b.views - a.views; });
    var labs = {}; calcs.forEach(function (c) { var l = (CAT.byId[c.calc_id] || {}).lab || 'unknown'; var o = labs[l] = labs[l] || { views: 0, starts: 0, completes: 0 }; o.views += +c.views; o.starts += +c.starts; o.completes += +c.completes; });
    var zero = CAT.free.filter(function (id) { return !used[id]; });
    var gated = calcs.filter(function (c) { return c.premium_gate_views > 0; }).sort(function (a, b) { return b.premium_gate_views - a.premium_gate_views; });
    out += card('calculators', 'Calculators', 'Start = first input. Completion = a valid result still showing 2 seconds after the last input. Abandoned = started, no completion on that page view. Inputs are never recorded.',
      '<h3>Most used (by starts)</h3>' + table(ccols, byStarts.slice(0, 15).map(crow)) +
      '<h3>LAB comparison</h3>' + hbars(Object.keys(labs).sort(function (a, b) { return labs[b].starts - labs[a].starts; }).map(function (l) { var o = labs[l]; return { k: LAB_NAMES[l] || l, v: o.starts, label: num(o.starts) + ' starts · ' + pct(o.completes, o.starts) + ' complete', tip: num(o.views) + ' views, ' + num(o.starts) + ' starts, ' + num(o.completes) + ' completions' }; })) +
      '<h3>Least used (of calculators with any view)</h3>' + table(ccols, byStarts.slice().reverse().slice(0, 10).map(crow)) +
      '<p class="oa-note">' + (CAT.loaded ? num(zero.length) + ' of ' + num(CAT.free.length) + ' free calculators had no views in this period' + (zero.length ? ' (for example: ' + esc(zero.slice(0, 6).map(function (id) { return pageLabel('calc:' + id); }).join(', ')) + ')' : '') + '.' : 'Catalogue unavailable: names shown as ids.') + '</p>' +
      (gated.length ? '<h3>Locked Premium calculators opened</h3>' + table(['Calculator', 'Times seen'], gated.slice(0, 10).map(function (c) { return [pageLabel('calc:' + c.calc_id), num(c.premium_gate_views)]; })) : ''));

    var nav = r.navigation || {}, el = nav.by_element || {}, EL = { lab_tile: 'LAB directory tiles', related: 'Related links', nav: 'Menus / calculator list', encyclopedia: 'Encyclopedia', premium_cta: 'Premium buttons', search_result: 'Search results', footer: 'Footer', other: 'Other links' };
    var sr = r.search || {};
    out += card('engagement', 'Engagement', '',
      '<div class="oa-kpis">' + kpi('Avg engaged time / session', k.avg_engaged_ms, p.avg_engaged_ms, dur) + kpi('Pages per session', k.pages_per_session, p.pages_per_session, function (v) { return (+v).toFixed(2); }) +
      kpi('Returning visitors', k.returning_visitors, p.returning_visitors) + kpi('New visitors', k.new_visitors, p.new_visitors) + kpi('Engaged-session rate', k.sessions ? k.engaged_sessions / k.sessions * 100 : 0, null, function (v) { return (+v).toFixed(1) + '%'; }) + '</div>' +
      '<p class="oa-note">New = the browser\'s random id was first recorded during this period. Returning = first recorded before this period and active in it. New + returning = visitors. A browser that cleared its storage, blocks storage, or sends Global Privacy Control / Do Not Track (session-only id) counts as a new visitor each time; ids unseen for 13 months are forgotten.</p>' +
      '<div class="oa-grid2"><div><h3>Internal clicks by kind</h3>' + hbars(Object.keys(el).sort(function (a, b) { return el[b] - el[a]; }).map(function (x) { return { k: EL[x] || x, v: el[x] }; })) + '</div>' +
      '<div><h3>Top click paths</h3>' + table(['From → to', 'Clicks'], (nav.top_paths || []).slice(0, 12).map(function (x) { var a = String(x.path).split('>'); return [pageLabel(a[0]) + ' → ' + pageLabel(a[1]), num(x.n)]; })) + '</div></div>' +
      '<h3>Site search</h3><div class="oa-kpis">' + kpi('Searches', sr.searches, null) + kpi('No results', sr.zero_results, null) + kpi('Result clicked', sr.result_clicks, null) + '</div>');

    var f = r.funnel || [], top = Math.max.apply(null, f.map(function (x) { return +x.sessions; }).concat([0]));
    out += card('funnel', 'Premium funnel', 'Sessions in which each step happened. Steps are counted independently (a session can skip steps). Revenue below comes from Stripe billing records, not from these events.',
      '<div class="oa-funnel">' + hbars(FUNNEL.map(function (s) { var x = f.find(function (y) { return y.step === s[0]; }) || { sessions: 0, events: 0 }; return { k: s[1], v: x.sessions, label: num(x.sessions) + (top ? ' · ' + pct(x.sessions, top) : ''), tip: num(x.sessions) + ' sessions, ' + num(x.events) + ' times' }; })) + '</div>');

    var b = r.billing || {};
    out += card('revenue', 'Subscriptions & revenue', 'From the billing tables (Stripe webhooks). Test-mode Stripe data is never counted.',
      b.status !== 'live' ? '<div class="oa-pending" data-billing="pending"><span aria-hidden="true">⏳</span><div><b>Pending — Stripe is not connected to live billing yet.</b><br>' + esc(b.reason || '') + ' Trials, paid subscriptions, active subscribers, MRR / ARR, renewals, failed payments, cancellations and churn will appear here once live payments exist.</div></div>'
        : '<div class="oa-kpis" data-billing="live">' + kpi('Trials started', b.trials_started) + kpi('Trialing now', b.trialing_now) + kpi('New paid', b.paid_conversions) + kpi('Active paying', b.active_paying) +
          kpi('MRR', b.mrr_cents / 100, null, function (v) { return '$' + (+v).toFixed(2); }) + kpi('ARR', b.arr_cents / 100, null, function (v) { return '$' + (+v).toFixed(2); }) +
          kpi('Renewals', b.renewals) + kpi('Failed payments', b.failed_payments) + kpi('Cancellations', b.cancellations) + kpi('Scheduled to cancel', b.scheduled_cancellations) +
          kpi('Churn (period)', b.churn_rate == null ? '—' : (b.churn_rate * 100).toFixed(1) + '%', null, String) + '</div>');

    var rej = {}; (h.by_day || []).forEach(function (x) { if (x.outcome === 'rejected') rej[x.reason] = (rej[x.reason] || 0) + +x.n; });
    var perDay = {}; (h.by_day || []).forEach(function (x) { if (x.outcome === 'accepted') perDay[x.day] = (perDay[x.day] || 0) + +x.n; });
    out += card('health', 'Data health', 'Ingestion for the selected environment and period.',
      '<div class="oa-kpis">' + kpi('Accepted events', tot.accepted || 0) + kpi('Rejected', tot.rejected || 0) + kpi('Duplicates', tot.duplicate || 0) + kpi('Over session cap', tot.capped || 0) +
      kpi('Bot events', tot.bot || 0) + kpi('Client tracking errors', tot.client_error || 0) + kpi('Dropped in browser', tot.client_dropped || 0) + kpi('Bot sessions excluded', h.bot_sessions || 0) + '</div>' +
      '<p class="oa-note">Last event received: <b>' + esc(h.last_event_at ? new Date(h.last_event_at).toLocaleString() : 'never') + '</b> · Last rollup: <b>' + esc(h.last_rollup_at ? new Date(h.last_rollup_at).toLocaleString() : 'never') + '</b> · Raw events kept ' + esc(h.raw_retention_days) + ' days.</p>' +
      '<div class="oa-grid2"><div><h3>Accepted events per day</h3>' + lineChart(r.trend.map(function (t) { return { day: t.day, n: perDay[t.day] || 0 }; }), 'n', 'Events') + '</div>' +
      '<div><h3>Rejections by reason</h3>' + table(['Reason', 'Events'], Object.keys(rej).sort(function (a, b) { return rej[b] - rej[a]; }).map(function (x) { return [x, num(rej[x])]; }), 'No rejected events.') + '</div></div>');
    return out;
  }

  /* ---------- controls and loading ---------- */
  var sb, state = { preset: '30d', env: 'live', from: null, to: null };
  function controls() {
    return '<div class="oa-bar" role="toolbar" aria-label="Report period">' +
      Object.keys(PRESETS).concat(['custom']).map(function (k) { return '<button class="oa-btn" data-preset="' + k + '" aria-pressed="' + (state.preset === k) + '">' + { '7d': '7 days', '30d': '30 days', '90d': '90 days', '12m': '12 months', custom: 'Custom' }[k] + '</button>'; }).join('') +
      '<span class="oa-custom' + (state.preset === 'custom' ? ' on' : '') + '"><input type="date" id="oa-from" aria-label="From" value="' + esc(state.from || '') + '"><input type="date" id="oa-to" aria-label="To" value="' + esc(state.to || '') + '"><button class="oa-btn" data-apply>Apply</button></span>' +
      '<span class="oa-grow"></span><label class="oa-sub" style="margin:0">Data <select id="oa-env"><option value="live">Live</option><option value="test">Test</option><option value="dev">Dev</option></select></label>' +
      '<button class="oa-btn" data-refresh>Refresh</button></div>' +
      '<nav class="oa-nav" aria-label="Sections">' + [['overview', 'Overview'], ['pages', 'Pages'], ['traffic', 'Traffic'], ['calculators', 'Calculators'], ['engagement', 'Engagement'], ['funnel', 'Premium funnel'], ['revenue', 'Revenue'], ['health', 'Data health']].map(function (s) { return '<a href="#' + s[0] + '">' + s[1] + '</a>'; }).join('') + '</nav>' +
      '<div id="oa-report"><section class="oa-card"><p>Loading…</p></section></div>';
  }
  function range() {
    if (state.preset === 'custom') return { from: state.from, to: state.to };
    var t = today(); return { from: addDays(t, 1 - PRESETS[state.preset]), to: t };
  }
  var seq = 0;
  function load(refresh) {
    var rg = range(), me = ++seq, rep = document.getElementById('oa-report');
    if (!rg.from || !rg.to || rg.from > rg.to) { rep.innerHTML = '<section class="oa-card"><p class="oa-err">Choose a start date on or before the end date.</p></section>'; return; }
    rep.setAttribute('aria-busy', 'true');
    (refresh ? sb.rpc('analytics_refresh') : Promise.resolve({})).then(function () {
      return sb.rpc('analytics_dashboard', { p_from: rg.from, p_to: rg.to, p_env: state.env });
    }).then(function (res) {
      if (me !== seq) return;
      rep.removeAttribute('aria-busy');
      if (res.error) { rep.innerHTML = '<section class="oa-card" data-state="error"><p class="oa-err">' + esc(res.error.code === '42501' ? 'Not authorised.' : res.error.code === '22023' ? 'That period is not allowed (at most about 13 months).' : 'The report could not be loaded.') + '</p></section>'; return; }
      rep.innerHTML = render(res.data, state);
    }).catch(function () { if (me === seq) rep.innerHTML = '<section class="oa-card" data-state="error"><p class="oa-err">The report could not be loaded (network).</p></section>'; });
  }
  function dashboard() {
    main.innerHTML = controls();
    document.getElementById('oa-env').value = state.env;
    main.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.preset) {
        state.preset = b.dataset.preset;
        main.querySelectorAll('[data-preset]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        main.querySelector('.oa-custom').classList.toggle('on', state.preset === 'custom');
        if (state.preset === 'custom') { if (!state.from) { state.to = today(); state.from = addDays(state.to, -29); document.getElementById('oa-from').value = state.from; document.getElementById('oa-to').value = state.to; } return; }
        load(false);
      } else if (b.hasAttribute('data-apply')) { state.from = document.getElementById('oa-from').value; state.to = document.getElementById('oa-to').value; load(false); }
      else if (b.hasAttribute('data-refresh')) load(true);
    });
    document.getElementById('oa-env').addEventListener('change', function (e) { state.env = e.target.value; load(false); });
    load(true);
  }

  /* ---------- sign-in and the owner check ---------- */
  function signInForm(note) {
    message('Owner sign-in', '<p class="oa-sub">' + (note || 'Sign in with the owner account. A one-time link is emailed; no password is used.') + '</p>' +
      '<form id="oa-signin"><input type="email" name="email" autocomplete="email" required placeholder="owner email" aria-label="Email"><button class="oa-btn gold" type="submit">Email me a sign-in link</button></form><p class="oa-sub" id="oa-signin-msg"></p>');
    document.getElementById('oa-signin').addEventListener('submit', function (e) {
      e.preventDefault();
      var email = e.target.email.value.trim(), msg = document.getElementById('oa-signin-msg');
      msg.textContent = 'Sending…';
      sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } }).then(function (r) {
        msg.textContent = r.error ? 'Could not send the link. Check the address and try again.' : 'Check your email for the sign-in link.';
      });
    });
  }
  function signOutButton(email) {
    who.innerHTML = '<span>' + esc(email || '') + '</span><button class="oa-btn" id="oa-out">Sign out</button>';
    document.getElementById('oa-out').onclick = function () { sb.auth.signOut().then(function () { location.reload(); }); };
  }
  function start() {
    sb = window.GH_SUPABASE;                         // the site's one client, created by supabase-boot.js (same rules as the site)
    if (!sb || !sb.auth) { message('Unavailable', '<p class="oa-sub">The sign-in library or the Supabase configuration could not be loaded.</p>'); return; }
    sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) return signInForm();
      signOutButton(s.user && s.user.email);
      return sb.rpc('analytics_is_owner').then(function (o) {
        if (o.error) return message('Unavailable', '<p class="oa-sub">The owner check could not be completed' + (o.error.code ? ' (' + esc(o.error.code) + ')' : '') + '. Analytics may not be installed on this database yet.</p>');
        if (o.data !== true) return message('Not authorised', '<p class="oa-sub">This account is not the Gearhead Labs owner account. Nothing is shown.</p>');
        return loadCatalog().then(dashboard);
      });
    }).catch(function () { message('Unavailable', '<p class="oa-sub">Could not reach the sign-in service.</p>'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); }); else start();
})();
