/* Gearhead Labs Premium — product shell: navigation, router, views, gating.
   Wraps the calculator engine (the #app frame) without modifying it.
   Views read and write data only through GHP.services. What the UI shows as available follows
   GHP.services.entitlements (from pf_my_entitlement); the database decides what is actually allowed. */
(function(){
  'use strict';
  const GHP = window.GHP, M = GHP.models, S = GHP.services, E = GHP.engineering;
  const R = S.repos;

  /* ---------- helpers ---------- */
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const opt = (values, sel, blank) => (blank !== undefined ? `<option value="">${esc(blank)}</option>` : '') + values.map(v => { const [val, lab] = Array.isArray(v) ? v : [v, v]; return `<option value="${esc(val)}"${String(val) === String(sel == null ? '' : sel) ? ' selected' : ''}>${esc(lab)}</option>`; }).join('');
  const enumOpts = name => M.ENUMS[name].map(e => [e.value, e.label]);
  const date = d => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  const machineName = m => m ? (m.details && m.details.nickname) || m.name : '';
  const analyzerMeta = id => M.ENGINEERING_CATALOG.find(a => a.id === id);
  const SOURCE_LABEL = { stripe: 'Subscription', manual: 'Granted by Gearhead Labs', trial: 'Trial', promo: 'Promotion' };
  const ICON = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    calculators: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h2M12 18h4"/>',
    lab: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/>',
    garage: '<path d="M3 21V9l9-6 9 6v12"/><path d="M7 21v-7h10v7M7 17h10"/>',
    saved: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
  };
  const icon = (n, cls = '') => `<svg class="ghp-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
  const NAV = [
    { id: 'home', label: 'Home', short: 'Home' },
    { id: 'calculators', label: 'Calculators', short: 'Calcs' },
    { id: 'lab', label: 'Engineering Lab', short: 'Lab', feature: 'engineering_lab' },
    { id: 'garage', label: 'My Garage', short: 'Garage', feature: 'garage' },
    { id: 'saved', label: 'Saved', short: 'Saved', feature: 'saved_calculations' },
    { id: 'profile', label: 'Profile', short: 'Profile' }
  ];
  const VIEWS = ['home', 'calculators', 'lab', 'run', 'garage', 'saved', 'profile'];

  /* ---------- DOM scaffold ---------- */
  const nav = document.createElement('nav'); nav.id = 'ghp-nav'; nav.setAttribute('aria-label', 'Gearhead Labs');
  const runbar = document.createElement('div'); runbar.id = 'ghp-runbar'; runbar.hidden = true;
  const view = document.createElement('main'); view.id = 'ghp-view'; view.hidden = true; view.tabIndex = -1;
  const sheet = document.createElement('div'); sheet.id = 'ghp-sheet'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
  const toast = document.createElement('div'); toast.id = 'ghp-toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
  document.body.append(nav, runbar, view, sheet, toast);
  let toastTimer;
  const say = (msg, bad = false) => { toast.textContent = msg; toast.className = bad ? 'show bad' : 'show'; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.className = '', 3600); };

  /* ---------- router ---------- */
  let state = { view: 'calculators' };
  function parse() {
    const p = new URLSearchParams(location.search), calc = p.get('calc');
    let v = p.get('view');
    if (!v && calc && M.ANALYZER_IDS.has(calc)) v = 'run';   // deep link to a Premium analyzer
    if (!VIEWS.includes(v)) v = 'calculators';
    return { view: v, machine: p.get('machine'), edit: p.get('edit'), setup: p.get('setup'), item: p.get('item'),
      analyzer: p.get('analyzer') || (M.ANALYZER_IDS.has(calc) ? calc : null), analysis: p.get('analysis') };
  }
  function go(v, params = {}, replace = false) {
    const q = new URLSearchParams();
    if (v !== 'calculators') q.set('view', v);
    Object.entries(params).forEach(([k, val]) => { if (val) q.set(k, val); });
    if (v === 'run' && params.analyzer) q.set('calc', params.analyzer);   // keeps app-shell's frame sync on the analyzer
    history[replace ? 'replaceState' : 'pushState'](null, '', location.pathname + (q.toString() ? '?' + q : ''));
    route();
  }
  window.addEventListener('popstate', route);

  function setMode(mode) {
    document.body.classList.toggle('ghp-mode-premium', mode === 'premium');
    document.body.classList.toggle('ghp-mode-run', mode === 'run');
    document.body.classList.toggle('ghp-mode-calculators', mode === 'calculators');
    view.hidden = mode !== 'premium'; runbar.hidden = mode !== 'run';
    if (mode !== 'run') closeSheet();
  }
  async function route() {
    const prev = state.view; state = parse();
    renderNav();
    if (state.view === 'calculators') { setMode('calculators'); return; }
    if (state.view === 'run') {
      if (!S.entitlements.has('engineering_lab')) { setMode('premium'); return paint(teaser('lab'), prev !== state.view); }
      setMode('run'); return renderRun();
    }
    setMode('premium');
    paint('<div class="ghp-loading">Loading…</div>', prev !== state.view);
    try { paint(await VIEW_RENDER[state.view](), false); }
    catch (e) { console.error(e); paint(`<section class="ghp-page"><div class="ghp-card ghp-error">${esc(e.message)}</div></section>`, false); }
  }
  function paint(html, toTop) { view.innerHTML = html; if (toTop) view.scrollTop = 0; }

  /* ---------- navigation ---------- */
  function renderNav() {
    const ent = S.entitlements.state, active = state.view === 'run' ? 'lab' : state.view;
    nav.innerHTML = `<button class="ghp-brand" data-go="home" aria-label="Gearhead Labs home"><b>GEARHEAD</b> LABS</button>
      <div class="ghp-nav-items">${NAV.map(n => { const locked = n.feature && !S.entitlements.has(n.feature);
        return `<button class="ghp-nav-item${active === n.id ? ' active' : ''}" data-go="${n.id}"${active === n.id ? ' aria-current="page"' : ''}>${icon(n.id)}<span class="ghp-nav-long">${n.label}</span><span class="ghp-nav-short">${n.short}</span>${locked ? icon('lock', 'ghp-nav-lock') : ''}</button>`; }).join('')}</div>
      <div class="ghp-nav-status">${S.mode === 'development' ? '<span class="ghp-dev-pill" title="Development adapter: local data and local entitlement in this browser only">DEV</span>' : ''}<span class="ghp-plan-pill ${ent.isPremium ? 'premium' : ''}">${esc(M.planLabel(ent).toUpperCase())}</span></div>`;
  }
  nav.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });

  /* ---------- shared fragments ---------- */
  const page = (title, kicker, body, actions = '') => `<section class="ghp-page"><header class="ghp-page-head"><div><div class="ghp-kicker">${kicker}</div><h1>${title}</h1></div>${actions}</header>${body}</section>`;
  const field = (label, html, hint = '') => `<label>${label}${html}${hint ? `<small>${hint}</small>` : ''}</label>`;
  const formErrors = () => '<div class="ghp-form-error" hidden></div>';
  function upgradeCTA() {
    const price = `<div class="ghp-price"><b>Gearhead Labs Premium</b> · ${esc(M.PREMIUM_PRICE_TEXT)}</div>
      <p class="ghp-fine">Premium includes My Garage, Test Setups, saved calculations and the Engineering Lab. Online checkout is not open yet, so Premium can’t be purchased here today. Every free calculator stays free.</p>`;
    if (S.mode !== 'development') return price;
    return price + (S.auth.user
      ? `<div class="ghp-cta-row"><button class="ghp-btn gold" data-action="dev-plan" data-plan="trial">Start development trial</button><button class="ghp-btn" data-action="dev-plan" data-plan="premium">Enable development Premium</button></div><p class="ghp-fine ghp-warn">Development only: a local stand-in for a server-side grant.</p>`
      : `<div class="ghp-cta-row"><button class="ghp-btn gold" data-go="profile">Sign in to try Premium (development)</button></div>`);
  }
  function teaser(kind) {
    const T = { lab: ['Engineering Lab', 'Fourteen professional analyzers for turbo matching, two-stroke porting, valvetrain dynamics, chassis, driveline and thermal systems, with saved analyses linked to your vehicles and Test Setups.'],
      saved: ['Saved calculations', 'Keep calculations with your vehicles and Test Setups, pin the important ones and add notes.'],
      garage: ['My Garage', 'Your vehicle profiles with year, make, model, engine and transmission, unlimited Test Setups (builds) for each one, and your saved calculations and engineering analyses linked to them.'] }[kind];
    const list = kind === 'lab' ? `<div class="ghp-teaser-list">${M.ENGINEERING_CATEGORIES.map(c => `<div><h3>${c}</h3>${M.ENGINEERING_CATALOG.filter(a => a.category === c).map(a => `<p>${icon('lock', 'ghp-inline-lock')} <b>${a.code}</b> ${esc(a.name)}</p>`).join('')}</div>`).join('')}</div>` : '';
    return page(T[0], 'PREMIUM', `<div class="ghp-card ghp-teaser"><span class="ghp-badge gold">PREMIUM</span><p class="ghp-lede">${T[1]}</p>${list}${upgradeCTA()}<p class="ghp-fine">The free calculators stay free, with no account needed.</p></div>`);
  }
  function signInCard() {
    if (S.mode === 'no-backend') return `<div class="ghp-card"><h2>Accounts are unavailable right now</h2><p>Gearhead Labs accounts can’t be reached at the moment. Every calculator still works without an account.</p><button class="ghp-btn" data-go="calculators">Open the calculators</button></div>`;
    const dev = S.mode === 'development';
    return `<div class="ghp-card"><h2>Sign in</h2>${dev ? '<p class="ghp-fine ghp-warn">Development mode: local sign-in, no password, no email. Data stays in this browser.</p>' : '<p>We’ll email you a secure sign-in link.</p>'}
      <form data-form="signin" class="ghp-form" novalidate>${formErrors()}<label>Email<input name="email" type="email" autocomplete="email" inputmode="email" required></label><button class="ghp-btn gold" type="submit">${dev ? 'Sign in (development)' : 'Email me a sign-in link'}</button></form></div>`;
  }
  const needAccount = (title, kicker) => page(title, kicker, signInCard());
  function freeCount() { try { const w = window.GHShell.frame.contentWindow; const n = w.eval("CALCS.filter(c=>c.id!=='dashboard'&&c.layer!=='engineering').length"); return n || 606; } catch (e) { return 606; } }
  async function linkNames() {
    const [ms, ts] = await Promise.all([R.machines.list(), R.testSetups.list()]);
    return { machines: ms, setups: ts, m: Object.fromEntries(ms.map(m => [m.id, machineName(m)])), t: Object.fromEntries(ts.map(t => [t.id, t.name])) };
  }
  const linkText = (row, names) => [names.m[row.machine_id], names.t[row.test_setup_id]].filter(Boolean).join(' · ');
  function linkSelects(x, names) {
    return `<div class="ghp-grid2">${field('Vehicle', `<select name="machine_id">${opt(names.machines.map(m => [m.id, machineName(m)]), x.machine_id, 'None')}</select>`)}
      ${field('Test Setup', `<select name="test_setup_id">${opt(names.setups.map(t => [t.id, t.name + ' — ' + (names.m[t.machine_id] || '')]), x.test_setup_id, 'None')}</select>`, 'A Test Setup implies its vehicle.')}</div>`;
  }

  /* ---------- views ---------- */
  const VIEW_RENDER = {
    async home() {
      const ent = S.entitlements.state, u = S.auth.user, prem = ent.isPremium;
      let recent = [], vehicles = null;
      if (u) {
        try { vehicles = (await R.machines.list()).length; } catch (e) { vehicles = null; }
        try { recent = (await R.analyses.list()).slice(0, 4); } catch (e) { recent = []; }
      }
      const tile = (id, title, stat, desc, feature) => { const locked = feature && !S.entitlements.has(feature);
        return `<button class="ghp-tile${locked ? ' locked' : ''}" data-go="${id}"><div class="ghp-tile-top"><span>${locked ? icon('lock', 'ghp-inline-lock') + ' PREMIUM' : feature ? 'PREMIUM' : 'FREE'}</span><b>${stat}</b></div><h3>${title}</h3><p>${desc}</p></button>`; };
      const garageStat = vehicles == null || !S.entitlements.has('garage') ? '' : String(vehicles);
      return `<section class="ghp-page"><div class="ghp-hero"><div class="ghp-kicker">GEARHEAD LABS / THE SCIENCE OF SPEED</div><h1>${u ? `Welcome back, ${esc(u.email)}` : 'The Automotive Math Encyclopedia'}</h1>
        <p class="ghp-lede">${prem ? 'Your Premium workshop: garage, Test Setups, engineering analyses and saved calculations.' : `${freeCount()} free calculators, no account needed. Gearhead Labs Premium (${esc(M.PREMIUM_PRICE_TEXT)}) adds My Garage with your vehicles and Test Setups, saved calculations and the Engineering Lab.`}</p>
        <div class="ghp-plan-line"><span class="ghp-plan-pill ${prem ? 'premium' : ''}">${esc(M.planLabel(ent))}</span>${S.mode === 'development' ? '<span class="ghp-dev-pill">DEVELOPMENT</span>' : ''}${u ? '' : '<button class="ghp-link" data-go="profile">Sign in</button>'}</div></div>
        <div class="ghp-tiles">${tile('calculators', 'Free Calculators', freeCount(), 'Every free automotive calculator, ready to use.')}${tile('garage', 'My Garage', garageStat, 'Your vehicles, their Test Setups and everything you saved for them.', 'garage')}${tile('lab', 'Engineering Lab', '14', 'Turbo, two-stroke, valvetrain, chassis, driveline and thermal analyzers.', 'engineering_lab')}${tile('saved', 'Saved', '★', 'Saved calculations with your vehicles and setups.', 'saved_calculations')}</div>
        ${recent.length ? `<div class="ghp-card"><h2>Recent analyses</h2>${recent.map(a => analysisRow(a, null, false)).join('')}</div>` : ''}
      </section>`;
    },

    async lab() {
      const entitled = S.entitlements.has('engineering_lab');
      if (!entitled) {
        let kept = [];
        if (S.auth.user) { try { kept = await R.analyses.list(); } catch (e) { kept = []; } }
        if (!kept.length) return teaser('lab');
        const names = await linkNames();
        return teaser('lab').replace('</section>', `<div class="ghp-card"><h2>Your saved analyses <span class="ghp-muted">(${kept.length})</span></h2><p class="ghp-fine">Your plan no longer includes the Engineering Lab. Your saved analyses stay available to review and delete.</p>${kept.map(a => analysisRow(a, names, true, false)).join('')}</div></section>`);
      }
      const [saved, names] = await Promise.all([R.analyses.list(), linkNames()]);
      return page('Engineering Lab', 'PREMIUM · 14 ANALYZERS', `
        <div class="ghp-card ghp-lab-tools"><input id="ghp-lab-search" type="search" placeholder="Search analyzers" aria-label="Search analyzers" autocomplete="off">
          <div class="ghp-filter" role="group" aria-label="Category">${['All', ...M.ENGINEERING_CATEGORIES].map((c, i) => `<button class="ghp-chip${i ? '' : ' active'}" data-cat="${c}">${c}</button>`).join('')}</div>
          <p class="ghp-fine">Analyzers use the calculator's current unit setting (${E.unitSystem() === 'metric' ? 'Metric' : 'Imperial'}). Results are labelled client-reported: they are recomputed from the saved inputs when you load an analysis.</p></div>
        <div class="ghp-analyzers" id="ghp-analyzers">${M.ENGINEERING_CATALOG.map(a => `<button class="ghp-card ghp-analyzer" data-analyzer="${a.id}" data-category="${a.category}" data-search="${esc((a.code + ' ' + a.name + ' ' + a.category).toLowerCase())}"><span class="ghp-code">${a.code}</span><span class="ghp-aname">${esc(a.name)}</span><span class="ghp-acat">${a.category}</span></button>`).join('')}</div>
        <p class="ghp-muted ghp-noresults" id="ghp-lab-empty" hidden>No analyzers match.</p>
        <div class="ghp-card"><h2>Saved analyses <span class="ghp-muted">(${saved.length})</span></h2>${saved.length ? saved.map(a => analysisRow(a, names, true, true)).join('') : '<p class="ghp-muted">Run an analyzer and tap “Save analysis” to keep its inputs and results.</p>'}</div>`);
    },

    async garage() {
      if (!S.auth.user) return needAccount('My Garage', 'PREMIUM');
      const canEdit = S.entitlements.has('garage');
      if (state.edit) return canEdit ? machineForm(state.edit === 'new' ? null : await R.machines.get(state.edit)) : teaser('garage');
      if (state.machine) return machineDetail(state.machine);
      const [ms, g] = await Promise.all([R.machines.list(), R.garage.get()]);
      if (!canEdit && !ms.length) return teaser('garage');
      const add = canEdit ? `<button class="ghp-btn gold" data-edit-machine="new">+ Add vehicle</button>` : '';
      const lapsed = canEdit ? '' : `<div class="ghp-card"><p class="ghp-fine">Your plan no longer includes My Garage. Your vehicles and Test Setups stay available to review and delete.</p>${upgradeCTA()}</div>`;
      return page(esc((g && g.name) || 'My Garage'), canEdit ? 'PREMIUM' : 'READ ONLY', `${lapsed}
        ${ms.length ? `<div class="ghp-list">${ms.map(m => `<article class="ghp-card ghp-vehicle"><div class="ghp-row-top"><h2>${esc(machineName(m))}</h2>${m.is_primary ? '<span class="ghp-badge gold">PRIMARY</span>' : ''}</div>
            <p class="ghp-chips">${[M.labelFor('machine_type', m.machine_type), m.power_source && M.labelFor('power_source', m.power_source), m.engine && m.engine.label, m.transmission && m.transmission.label, m.drivetrain, m.is_hypothetical && 'Planned'].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</p>
            <div class="ghp-actions"><button class="ghp-btn" data-go-machine="${esc(m.id)}">Open</button>${canEdit ? `<button class="ghp-btn" data-edit-machine="${esc(m.id)}">Edit</button>${m.is_primary ? '' : `<button class="ghp-btn" data-action="primary" data-id="${esc(m.id)}">Make primary</button>`}` : ''}</div></article>`).join('')}</div>`
          : `<div class="ghp-card ghp-empty"><h2>Your garage is empty</h2><p>Add your vehicle to start Test Setups for it.</p></div>`}`, add);
    },

    async saved() {
      if (!S.auth.user) return needAccount('Saved calculations', 'PREMIUM');
      const canEdit = S.entitlements.has('saved_calculations');
      const [rows, names] = await Promise.all([R.savedCalculations.list(), linkNames()]);
      if (!rows.length && !canEdit) return teaser('saved');
      const unavailable = `<div class="ghp-card"><p class="ghp-fine">${esc(R.savedCalculations.createUnavailableReason)} Until then there is no “Save” button on the calculators; calculations saved through the service will appear here.</p>${canEdit ? '' : '<p class="ghp-fine">Your plan no longer includes saved calculations: you can review and delete them, but not edit or pin.</p>'}</div>`;
      const editing = state.item;
      const sorted = rows.slice().sort((a, b) => (b.pinned - a.pinned) || String(b.created_at).localeCompare(String(a.created_at)));
      const row = s => editing === s.id && canEdit ? savedForm(s, names) : `<article class="ghp-card"><div class="ghp-row-top"><h2>${esc(s.title)}</h2>${s.pinned ? '<span class="ghp-badge gold">PINNED</span>' : ''}</div>
          <p class="ghp-muted">${esc(linkText(s, names) || 'Not linked to a vehicle')} · ${date(s.created_at)}</p>${s.notes ? `<p class="ghp-notes">${esc(s.notes)}</p>` : ''}
          <div class="ghp-actions">${canEdit ? `<button class="ghp-btn" data-action="pin" data-id="${esc(s.id)}" data-pinned="${s.pinned ? '0' : '1'}">${s.pinned ? 'Unpin' : 'Pin'}</button><button class="ghp-btn" data-edit-saved="${esc(s.id)}">Edit</button>` : ''}<button class="ghp-btn danger" data-action="delete-saved" data-id="${esc(s.id)}">Delete</button></div></article>`;
      return page('Saved calculations', canEdit ? 'PREMIUM' : 'READ ONLY', unavailable + (sorted.length ? `<div class="ghp-list">${sorted.map(row).join('')}</div>` : '<div class="ghp-card ghp-empty"><h2>No saved calculations yet</h2></div>'));
    },

    async profile() {
      const u = S.auth.user;
      if (!u) return needAccount('Profile', 'ACCOUNT');
      const [p, subs] = await Promise.all([R.profile.getMine(), R.billing.subscriptions().catch(() => [])]);
      const ent = S.entitlements.state, prof = p || {};
      const initials = (prof.display_name || u.email).split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
      const avatar = prof.avatar_url ? `<img class="ghp-avatar" src="${esc(prof.avatar_url)}" alt="" referrerpolicy="no-referrer">` : `<div class="ghp-avatar">${esc(initials)}</div>`;
      const sub = subs.find(x => x.status !== 'canceled') || subs[0] || null;
      const planRows = [['Plan', M.planLabel(ent, sub)], ent.isPremium && ent.source ? ['Source', SOURCE_LABEL[ent.source]] : null,
        ent.endsAt ? ['Access until', date(ent.endsAt)] : null, sub ? ['Subscription', sub.status.replace(/_/g, ' ')] : null,
        sub && sub.periodEnd ? [sub.cancelAtPeriodEnd ? 'Ends' : 'Renews', date(sub.periodEnd)] : null].filter(Boolean);
      const dev = S.dev ? `<div class="ghp-card ghp-devpanel"><h2>Development tools</h2><p class="ghp-fine ghp-warn">Local stand-ins for server-side actions. They are not subscriptions and never exist in production.</p>
          <div class="ghp-cta-row">${[['free', 'Free / lapsed'], ['trial', 'Trial'], ['premium', 'Premium']].map(([pl, lab]) => `<button class="ghp-btn" data-action="dev-plan" data-plan="${pl}">${lab}</button>`).join('')}</div>
          <div class="ghp-cta-row"><button class="ghp-btn" data-action="dev-saved">Simulate a server-filed saved calculation</button></div>
          <button class="ghp-btn danger" data-action="dev-reset">Reset development data</button></div>` : '';
      return page('Profile', 'ACCOUNT', `<div class="ghp-card ghp-profile-head">${avatar}<div><h2>${esc(prof.display_name || u.email)}</h2><p class="ghp-muted">${esc(u.email)}${prof.created_at ? ' · Member since ' + date(prof.created_at) : ''}</p></div></div>
        <form data-form="profile" class="ghp-card ghp-form" novalidate><h2>Your details</h2>${formErrors()}
          ${field('Display name', `<input name="display_name" maxlength="80" value="${esc(prof.display_name)}" autocomplete="nickname">`)}
          ${field('Email', `<input value="${esc(u.email)}" disabled>`, 'Managed by your sign-in.')}
          ${field('Avatar image URL', `<input name="avatar_url" type="url" inputmode="url" placeholder="https://" value="${esc(prof.avatar_url)}">`, 'Optional. https:// links only.')}
          ${field('Location', `<input name="location" maxlength="80" placeholder="City or region (optional)" value="${esc(prof.location)}">`)}
          ${field('Experience level', `<select name="experience_level">${opt(enumOpts('experience_level'), prof.experience_level, 'Not set')}</select>`)}
          ${field('Preferred unit system', `<select name="preferred_unit_system">${opt(enumOpts('unit_system'), prof.preferred_unit_system || 'imperial')}</select>`, 'Saved to your profile. Calculators currently follow the calculator’s own unit setting.')}
          <button class="ghp-btn gold" type="submit">Save profile</button></form>
        <div class="ghp-card"><h2>Plan</h2><dl class="ghp-dl">${planRows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl><p class="ghp-fine">Your plan comes from your Gearhead Labs account and can’t be changed here.</p>${ent.isPremium ? '' : upgradeCTA()}</div>
        ${dev}<button class="ghp-btn wide" data-action="signout">Sign out</button>`);
    }
  };

  function analysisRow(a, names, actions, canLoad = true) {
    const m = analyzerMeta(a.analyzer_id) || { code: '?', name: a.analyzer_id };
    const links = names ? linkText(a, names) : '';
    return `<div class="ghp-analysis"><div><b>${esc(a.title)}</b><small><span class="ghp-code">${m.code}</span> ${esc(m.name)}${links ? ' · ' + esc(links) : ''} · ${date(a.updated_at)}</small></div>
      <div class="ghp-actions">${canLoad && S.entitlements.has('engineering_lab') ? `<button class="ghp-btn" data-load-analysis="${esc(a.id)}">Load</button>` : ''}${actions ? `<button class="ghp-btn danger" data-action="delete-analysis" data-id="${esc(a.id)}">Delete</button>` : ''}</div></div>`;
  }

  function machineForm(m) {
    const d = (m && m.details) || {}, x = m || { machine_type: 'automotive' };
    return page(m ? 'Edit vehicle' : 'Add vehicle', 'MY GARAGE', `<form data-form="machine" class="ghp-card ghp-form" data-id="${esc(m ? m.id : '')}" novalidate>${formErrors()}
      <div class="ghp-grid3">${field('Year', `<input name="model_year" inputmode="numeric" maxlength="4" value="${esc(d.model_year)}">`)}${field('Make', `<input name="make" maxlength="60" value="${esc(d.make)}">`)}${field('Model', `<input name="model" maxlength="60" value="${esc(d.model)}">`)}</div>
      <div class="ghp-grid2">${field('Trim', `<input name="trim_level" maxlength="60" value="${esc(d.trim_level)}">`)}${field('Nickname', `<input name="nickname" maxlength="60" value="${esc(d.nickname)}">`, 'Shown instead of year / make / model.')}</div>
      <div class="ghp-grid2">${field('Vehicle type *', `<select name="machine_type">${opt(enumOpts('machine_type'), x.machine_type)}</select>`)}${field('Power source', `<select name="power_source">${opt(enumOpts('power_source'), x.power_source, 'Unknown')}</select>`)}</div>
      <div class="ghp-grid3">${field('Engine', `<input name="engine" maxlength="120" placeholder="e.g. 5.0L Coyote V8" value="${esc(m && m.engine ? m.engine.label : '')}">`)}${field('Transmission', `<input name="transmission" maxlength="120" placeholder="e.g. 6-speed manual" value="${esc(m && m.transmission ? m.transmission.label : '')}">`)}${field('Drivetrain', `<select name="drivetrain">${opt(M.DRIVETRAIN_OPTIONS, m && m.drivetrain, '—')}</select>`, 'Kept in the vehicle notes.')}</div>
      ${field('Notes', `<textarea name="notes" rows="4" maxlength="1980">${esc(d.notes)}</textarea>`)}
      <label class="ghp-check"><input type="checkbox" name="is_hypothetical"${x.is_hypothetical ? ' checked' : ''}> Planned / hypothetical vehicle</label>
      <label class="ghp-check"><input type="checkbox" name="is_primary"${m && m.is_primary ? ' checked' : ''}> Primary vehicle</label>
      <div class="ghp-actions"><button class="ghp-btn gold" type="submit">${m ? 'Save changes' : 'Add vehicle'}</button><button class="ghp-btn" type="button" data-cancel>Cancel</button></div></form>`);
  }

  async function machineDetail(id) {
    const m = await R.machines.get(id);
    const [setups, an, saved] = await Promise.all([R.testSetups.list(id), R.analyses.list({ machine_id: id }), R.savedCalculations.list({ machine_id: id })]);
    const canEdit = S.entitlements.has('garage'), d = m.details || {}, editing = canEdit ? state.setup : null;
    const setupForm = t => { const x = t || {}; return `<form data-form="setup" class="ghp-card ghp-form ghp-inset" data-id="${esc(t ? t.id : '')}" novalidate><h3>${t ? 'Edit Test Setup' : 'New Test Setup'}</h3>${formErrors()}
        <input type="hidden" name="machine_id" value="${esc(id)}">
        ${field('Name *', `<input name="name" maxlength="120" value="${esc(x.name)}" required>`)}
        ${field('Description', `<textarea name="description" rows="2">${esc(x.description)}</textarea>`, 'What this setup is for, including your goals.')}
        ${field('Notes', `<textarea name="notes" rows="3">${esc(x.notes)}</textarea>`)}
        <div class="ghp-actions"><button class="ghp-btn gold" type="submit">${t ? 'Save Test Setup' : 'Add Test Setup'}</button><button class="ghp-btn" type="button" data-cancel-setup>Cancel</button></div></form>`; };
    const specs = [['Type', M.labelFor('machine_type', m.machine_type)], ['Power source', m.power_source && M.labelFor('power_source', m.power_source)], ['Engine', m.engine && m.engine.label],
      ['Transmission', m.transmission && m.transmission.label], ['Drivetrain', m.drivetrain], ['Year', d.model_year], ['Make', d.make], ['Model', d.model], ['Trim', d.trim_level],
      ['Status', m.is_hypothetical ? 'Planned / hypothetical' : null]].filter(r => r[1]);
    return page(esc(machineName(m)), 'MY GARAGE', `<button class="ghp-link ghp-back" data-go="garage">← All vehicles</button>
      <div class="ghp-card"><div class="ghp-row-top"><h2>Vehicle</h2>${m.is_primary ? '<span class="ghp-badge gold">PRIMARY</span>' : ''}</div><dl class="ghp-dl">${specs.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${d.notes ? `<p class="ghp-notes">${esc(d.notes)}</p>` : ''}
        ${canEdit ? `<div class="ghp-actions"><button class="ghp-btn" data-edit-machine="${esc(m.id)}">Edit vehicle</button>${m.is_primary ? '' : `<button class="ghp-btn" data-action="primary" data-id="${esc(m.id)}">Make primary</button>`}</div>` : ''}</div>
      <div class="ghp-card"><div class="ghp-row-top"><h2>Test Setups <span class="ghp-muted">(${setups.length})</span></h2>${editing || !canEdit ? '' : '<button class="ghp-btn gold" data-new-setup>+ Add Test Setup</button>'}</div>
        <p class="ghp-fine">A Test Setup (build) is a named configuration of this vehicle with a pinned baseline. Unlimited with Premium.</p>
        ${editing === 'new' ? setupForm(null) : ''}
        ${setups.map(t => editing === t.id ? setupForm(t) : `<article class="ghp-build"><div class="ghp-row-top"><h3>${esc(t.name)}</h3><span class="ghp-badge" title="Baseline pinned">● ${date(t.baseline_pinned_at)}</span></div>${t.description ? `<p>${esc(t.description)}</p>` : ''}${t.notes ? `<p class="ghp-notes">${esc(t.notes)}</p>` : ''}
          <div class="ghp-actions">${canEdit ? `<button class="ghp-btn" data-edit-setup="${esc(t.id)}">Edit</button><button class="ghp-btn" data-action="repin-setup" data-id="${esc(t.id)}">Re-pin baseline</button>` : ''}<button class="ghp-btn danger" data-action="delete-setup" data-id="${esc(t.id)}">Delete</button></div></article>`).join('') || (editing ? '' : '<p class="ghp-muted">No Test Setups yet.</p>')}</div>
      ${an.length ? `<div class="ghp-card"><h2>Engineering analyses <span class="ghp-muted">(${an.length})</span></h2>${an.map(a => analysisRow(a, null, false)).join('')}</div>` : ''}
      ${saved.length ? `<div class="ghp-card"><h2>Saved calculations <span class="ghp-muted">(${saved.length})</span></h2>${saved.map(s => `<p>${esc(s.title)}${s.pinned ? ' <span class="ghp-badge gold">PINNED</span>' : ''}</p>`).join('')}<button class="ghp-link" data-go="saved">Open saved calculations</button></div>` : ''}
      <button class="ghp-btn danger wide" data-action="delete-machine" data-id="${esc(m.id)}">Delete vehicle</button>`);
  }

  function savedForm(s, names) {
    return `<form data-form="saved" class="ghp-card ghp-form" data-id="${esc(s.id)}" novalidate><h3>Edit saved calculation</h3>${formErrors()}
      ${field('Title *', `<input name="title" maxlength="120" value="${esc(s.title)}" required>`)}
      ${linkSelects(s, names)}
      ${field('Notes', `<textarea name="notes" rows="3" maxlength="2000">${esc(s.notes)}</textarea>`)}
      <div class="ghp-actions"><button class="ghp-btn gold" type="submit">Save</button><button class="ghp-btn" type="button" data-cancel-saved>Cancel</button></div></form>`;
  }

  /* ---------- run mode (analyzer open in the engine frame) ---------- */
  let loaded = null;   // analysis currently loaded into the analyzer, if any
  async function renderRun() {
    const m = analyzerMeta(state.analyzer);
    if (!m) return go('lab', {}, true);
    runbar.innerHTML = `<button class="ghp-btn" data-go="lab">← Lab</button><div class="ghp-run-title"><span class="ghp-code">${m.code}</span> ${esc(m.name)}</div><button class="ghp-btn gold" data-action="save-sheet">Save analysis</button>`;
    try {
      if (state.analysis) {
        loaded = await R.analyses.get(state.analysis);
        await E.restore({ analyzer_id: loaded.analyzer_id, input_data: loaded.inputs });
        say('Loaded “' + loaded.title + '”');
      } else { loaded = null; await E.open(m.id); }
    } catch (e) { say(e.message, true); }
  }
  runbar.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) return go(b.dataset.go); if (e.target.closest('[data-action="save-sheet"]')) openSaveSheet(); });

  async function openSaveSheet() {
    const m = analyzerMeta(E.currentAnalyzer() || state.analyzer);
    if (!S.entitlements.has('engineering_lab')) return say('Saving analyses requires Gearhead Labs Premium.', true);
    let names;
    try { names = await linkNames(); } catch (e) { return say(e.message, true); }
    const x = loaded || { title: m.name + ' — ' + new Date().toLocaleDateString() };
    sheet.innerHTML = `<div class="ghp-sheet-panel"><form data-form="analysis" class="ghp-form" novalidate><div class="ghp-row-top"><h2>Save analysis</h2><button class="ghp-btn" type="button" data-close-sheet aria-label="Close">✕</button></div>
      <p class="ghp-fine">Saves the analyzer inputs (up to 64 KB) and the current results, labelled client-reported. <span class="ghp-code">${m.code}</span> ${esc(m.name)}</p>${formErrors()}
      ${field('Title *', `<input name="title" maxlength="120" value="${esc(x.title)}" required>`)}
      ${linkSelects(x, names)}
      ${field('Notes', `<textarea name="notes" rows="3" maxlength="2000">${esc(x.notes)}</textarea>`)}
      <div class="ghp-actions">${loaded ? '<button class="ghp-btn gold" type="submit" name="mode" value="update">Update saved analysis</button><button class="ghp-btn" type="submit" name="mode" value="new">Save as new</button>' : '<button class="ghp-btn gold" type="submit" name="mode" value="new">Save analysis</button>'}</div></form></div>`;
    sheet.hidden = false; sheet.querySelector('input[name="title"]').focus();
  }
  function closeSheet() { sheet.hidden = true; sheet.innerHTML = ''; }
  sheet.addEventListener('click', e => { if (e.target === sheet || e.target.closest('[data-close-sheet]')) closeSheet(); });

  /* ---------- forms ---------- */
  function formData(form) {
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = v; });
    form.querySelectorAll('input[type=checkbox][name]').forEach(c => { data[c.name] = c.checked; });
    return data;
  }
  const blankToNull = (data, keys) => { keys.forEach(k => { if (data[k] === '') data[k] = null; }); return data; };
  function showErrors(form, err) {
    const box = form.querySelector('.ghp-form-error');
    if (box) { box.hidden = false; box.textContent = err.errors ? Object.values(err.errors).join(' ') : err.message; box.scrollIntoView({ block: 'nearest' }); }
    else say(err.message, true);
  }
  async function submit(form, submitter) {
    const kind = form.dataset.form, id = form.dataset.id, data = formData(form);
    try {
      switch (kind) {
        case 'signin': {
          const r = await S.auth.signIn({ email: data.email });
          if (r && r.pendingVerification) return say('Check your email for a sign-in link.');
          say('Signed in.'); return route();
        }
        case 'profile':
          await R.profile.saveMine(blankToNull(data, ['display_name', 'avatar_url', 'location', 'experience_level'])); say('Profile saved.'); return route();
        case 'machine': {
          const input = blankToNull(data, ['model_year', 'make', 'model', 'trim_level', 'nickname', 'power_source', 'notes', 'drivetrain', 'engine', 'transmission']);
          const m = id ? await R.machines.update(id, input) : await R.machines.create(input);
          say(id ? 'Vehicle updated.' : 'Vehicle added.'); return go('garage', { machine: m.id }, true);
        }
        case 'setup': {
          const input = blankToNull(data, ['description', 'notes']);
          if (id) await R.testSetups.update(id, input); else await R.testSetups.create(input);
          say(id ? 'Test Setup updated.' : 'Test Setup added.'); return go('garage', { machine: data.machine_id }, true);
        }
        case 'saved':
          await R.savedCalculations.update(id, blankToNull(data, ['notes', 'machine_id', 'test_setup_id'])); say('Saved calculation updated.'); return go('saved', {}, true);
        case 'analysis': {
          const snap = E.capture(), meta = blankToNull(data, ['notes', 'machine_id', 'test_setup_id']);
          delete meta.mode;
          const mode = submitter && submitter.value || 'new';
          loaded = mode === 'update' && loaded ? await R.analyses.saveExisting(loaded.id, snap, meta) : await R.analyses.saveNew(snap, meta);
          closeSheet(); say(mode === 'update' ? 'Analysis updated.' : 'Analysis saved.');
          return history.replaceState(null, '', location.pathname + '?view=run&analyzer=' + encodeURIComponent(loaded.analyzer_id) + '&analysis=' + encodeURIComponent(loaded.id) + '&calc=' + encodeURIComponent(loaded.analyzer_id));
        }
      }
    } catch (err) { showErrors(form, err); }
  }
  document.addEventListener('submit', e => { const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault(); submit(f, e.submitter); });

  /* ---------- actions ---------- */
  function armed(btn) {   // two-step confirm for destructive actions
    if (btn.dataset.armed) return true;
    btn.dataset.armed = '1'; btn.dataset.label = btn.textContent; btn.textContent = 'Tap again to confirm';
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = btn.dataset.label; } }, 4000);
    return false;
  }
  view.addEventListener('click', async e => {
    const t = e.target;
    const goBtn = t.closest('[data-go]'); if (goBtn) return go(goBtn.dataset.go);
    const q = sel => t.closest(sel);
    let b;
    if ((b = q('[data-go-machine]'))) return go('garage', { machine: b.dataset.goMachine });
    if ((b = q('[data-edit-machine]'))) return go('garage', { edit: b.dataset.editMachine });
    if (q('[data-new-setup]')) return go('garage', { machine: state.machine, setup: 'new' }, true);
    if ((b = q('[data-edit-setup]'))) return go('garage', { machine: state.machine, setup: b.dataset.editSetup }, true);
    if (q('[data-cancel-setup]')) return go('garage', { machine: state.machine }, true);
    if ((b = q('[data-edit-saved]'))) return go('saved', { item: b.dataset.editSaved }, true);
    if (q('[data-cancel-saved]')) return go('saved', {}, true);
    if (q('[data-cancel]')) { const back = state.edit && state.edit !== 'new' ? state.edit : null; return go('garage', { machine: back }, true); }
    if ((b = q('[data-analyzer]'))) return go('run', { analyzer: b.dataset.analyzer });
    if ((b = q('[data-load-analysis]'))) { try { const a = await R.analyses.get(b.dataset.loadAnalysis); return go('run', { analyzer: a.analyzer_id, analysis: a.id }); } catch (err) { return say(err.message, true); } }
    if ((b = q('[data-cat]'))) { view.querySelectorAll('[data-cat]').forEach(c => c.classList.toggle('active', c === b)); return filterLab(); }
    if (!(b = q('[data-action]'))) return;
    const id = b.dataset.id;
    try {
      switch (b.dataset.action) {
        case 'primary': await R.machines.setPrimary(id); say('Primary vehicle updated.'); return route();
        case 'delete-machine': if (!armed(b)) return; await R.machines.remove(id); say('Vehicle deleted.'); return go('garage', {}, true);
        case 'delete-setup': if (!armed(b)) return; await R.testSetups.remove(id); say('Test Setup deleted.'); return route();
        case 'repin-setup': if (!armed(b)) return; await R.testSetups.repin(id); say('Baseline re-pinned.'); return route();
        case 'delete-analysis': if (!armed(b)) return; await R.analyses.remove(id); say('Analysis deleted.'); return route();
        case 'pin': await R.savedCalculations.pin(id, b.dataset.pinned === '1'); say(b.dataset.pinned === '1' ? 'Pinned.' : 'Unpinned.'); return route();
        case 'delete-saved': if (!armed(b)) return; await R.savedCalculations.remove(id); say('Saved calculation deleted.'); return route();
        case 'signout': await S.auth.signOut(); say('Signed out.'); return go('home', {}, true);
        case 'dev-plan': if (!S.dev) return; await S.dev.setPlan(b.dataset.plan); say('Development plan: ' + b.textContent.trim()); return route();
        case 'dev-saved': if (!S.dev) return; await S.dev.simulateSavedCalculation({}); say('Simulated a server-filed saved calculation.'); return route();
        case 'dev-reset': if (!S.dev || !armed(b)) return; await S.dev.reset(); say('Development data reset.'); return go('home', {}, true);
      }
    } catch (err) { say(err.message, true); }
  });
  function filterLab() {
    const q = (document.getElementById('ghp-lab-search') || {}).value || '', cat = (view.querySelector('[data-cat].active') || {}).dataset;
    let shown = 0;
    view.querySelectorAll('.ghp-analyzer').forEach(c => { const ok = (!cat || cat.cat === 'All' || c.dataset.category === cat.cat) && c.dataset.search.includes(q.trim().toLowerCase()); c.hidden = !ok; if (ok) shown++; });
    const empty = document.getElementById('ghp-lab-empty'); if (empty) empty.hidden = shown > 0;
  }
  view.addEventListener('input', e => { if (e.target.id === 'ghp-lab-search') filterLab(); });

  /* ---------- live updates ---------- */
  S.on('entitlement', () => route());
  S.on('auth', () => { if (state.view !== 'calculators') route(); else renderNav(); });
  S.on('mode', () => route());

  S.ready.then(() => { document.body.classList.add('ghp-ready'); route(); });
  setMode('calculators'); renderNav();
  GHP.shell = { go, route, state: () => ({ ...state }) };
})();
