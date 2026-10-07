/* Gearhead Labs — Premium calculator gating (Free -> Premium migration, 2026-10-06)
   Loaded into the encyclopedia frame by app-shell.js, alongside qa-math-corrections.js
   and navigation-ux.js. Gates the 21 calculators approved for migration from Free to
   Premium (see premium/models.js PREMIUM_CALCULATORS — the single source of truth this
   script reads at runtime from the parent frame, so the id list and the promotion copy
   can never drift from catalog/build-catalog.js's) behind an active Premium entitlement,
   while keeping every one of them visible and discoverable in the calculator navigation —
   unlike the Engineering Lab, which stays hidden entirely until entitled. An anonymous or
   Free visitor who opens one of the 21 sees an upgrade card with the audit-approved
   Free-companion promotion copy instead of the real calculator; a Premium account sees the
   real calculator exactly as before, unchanged.

   This script never grants access and never talks to Supabase: it only decides what the
   UI shows, exactly like the Engineering Lab gating in premium/engineering-bridge.js. The
   database remains the only place access is actually enforced for anything that touches
   it (saved calculations, engineering analyses). These 21 calculators compute entirely
   client-side, same as every other Free calculator in this engine, so there is nothing
   here for RLS to enforce — the real calculator's code still ships to every browser, same
   as the Engineering Lab's; gating only controls who sees it run.

   IMPORTANT (why this isn't window.CALCS / window.RENDERS): CALCS, RENDERS, GH_CALC_ALIASES
   and currentCalc are declared with const/let at the top level of the engine's own classic
   scripts. That creates bindings in the realm's shared global lexical scope, which every
   later classic <script> in the same document (this file, injected the same way as
   navigation-ux.js) can read and write as bare identifiers — but const/let globals are
   deliberately NOT exposed as properties on the window object, so `window.CALCS` or
   `window.RENDERS` from here would always read as undefined. headerHTML, renderCalc,
   ghBuildNav and ghCalcItem are ordinary `function` declarations, which (unlike const/let)
   do attach to window, so either form works for those; this file uses bare identifiers
   throughout for consistency with CALCS/RENDERS/currentCalc. */
(function () {
  'use strict';

  function parentModels() { try { return window.parent && window.parent.GHP && window.parent.GHP.models; } catch (e) { return null; } }
  function parentServices() { try { return window.parent && window.parent.GHP && window.parent.GHP.services; } catch (e) { return null; } }
  function premiumCalcs() { var M = parentModels(); return (M && M.PREMIUM_CALCULATORS) || []; }
  function premiumIds() {
    var M = parentModels();
    return (M && M.PREMIUM_CALC_IDS) || { has: function () { return false; }, values: function () { return []; } };
  }
  function isPremium() {
    var S = parentServices();
    try { return !!(S && S.entitlements && S.entitlements.isPremium()); } catch (e) { return false; }
  }
  function promoFor(id) {
    var list = premiumCalcs();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function priceText() {
    var M = parentModels();
    return (M && M.PREMIUM_PRICE_TEXT) || '$5.99/month or $59.99/year';
  }
  function upgradeHref() {
    try { return window.parent.location.pathname + '?view=profile'; } catch (e) { return '?view=profile'; }
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function findCalc(id) {
    try {
      if (typeof CALCS === 'undefined' || !Array.isArray(CALCS)) return null;
      for (var i = 0; i < CALCS.length; i++) if (CALCS[i].id === id) return CALCS[i];
    } catch (e) { /* CALCS not yet defined */ }
    return null;
  }

  function companionLink(companionId) {
    if (!companionId) return '';
    var c = findCalc(companionId);
    if (!c) return '';
    return '<a href="?calc=' + encodeURIComponent(companionId) + '" class="gh-premium-companion-link" ' +
      'onclick="event.preventDefault();renderCalc(\'' + companionId + '\');history.pushState(null,\'\',\'?calc=' + companionId + '\')">' +
      esc(c.name) + ' →</a>';
  }

  function upsellHTML(id) {
    var meta = findCalc(id) || { name: id };
    var promo = promoFor(id) || {};
    var title;
    try {
      title = (typeof headerHTML === 'function')
        ? headerHTML(meta.name, '')
        : ('<div class="calc-header"><div class="calc-title">' + esc(meta.name) + '</div></div>');
    } catch (e) { title = '<div class="calc-header"><div class="calc-title">' + esc(meta.name) + '</div></div>'; }
    return title +
      '<div class="calc-body gh-premium-upsell">' +
      '<span class="gh-premium-badge">PREMIUM</span>' +
      '<p class="gh-premium-lede">' + esc(promo.promo || ('Gearhead Labs Premium unlocks ' + meta.name + '.')) + '</p>' +
      (promo.free_companion ? ('<p class="gh-premium-companion">' + companionLink(promo.free_companion) + '</p>') : '') +
      '<p class="gh-premium-fine">Gearhead Labs Premium is ' + esc(priceText()) + '. Every other calculator on this page stays free, no account needed.</p>' +
      '<a class="gh-premium-cta" href="' + esc(upgradeHref()) + '">Upgrade to Premium →</a>' +
      '</div>';
  }

  function ensureStyle() {
    if (document.getElementById('gh-premium-gate-style')) return;
    var s = document.createElement('style');
    s.id = 'gh-premium-gate-style';
    s.textContent =
      '.gh-premium-upsell{text-align:left}' +
      '.gh-premium-badge{display:inline-block;font:800 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.08em;color:var(--bg,#0d0e12);background:var(--gold,#e0b855);border-radius:999px;padding:4px 10px;margin-bottom:10px}' +
      '.gh-premium-lede{font-size:15px;line-height:1.5;color:var(--text,#f5f6f8);margin:4px 0 14px}' +
      '.gh-premium-companion{margin:0 0 14px}' +
      '.gh-premium-companion-link{color:var(--gold,#e0b855);text-decoration:none;font-weight:700}' +
      '.gh-premium-companion-link:hover{text-decoration:underline}' +
      '.gh-premium-fine{font-size:12px;color:var(--muted,#8c96a5);margin:0 0 16px}' +
      '.gh-premium-cta{display:inline-block;background:var(--gold,#e0b855);color:var(--bg,#0d0e12);font-weight:800;font-size:13px;letter-spacing:.02em;border-radius:10px;padding:11px 18px;text-decoration:none}' +
      '.gh-premium-cta:hover{opacity:.9}' +
      '.gh-nav-item.gh-nav-premium small.gh-premium-tag{color:var(--gold,#e0b855);font-weight:800;font-size:9px;letter-spacing:.06em;margin-left:6px;display:inline-flex;align-items:center;gap:3px}' +
      '.gh-premium-lock{display:inline-block;vertical-align:middle;opacity:.9}';
    document.head.appendChild(s);
  }

  /* Wrap RENDERS[id], not renderCalc itself: renderCalc's focus/scroll/snapshot handling
     around fn() stays completely untouched, and the frozen engine file is never edited.
     RENDERS is declared `const` at the engine's top level: it is reachable here as a bare
     identifier (this script shares the document's global scope), but never as window.RENDERS. */
  function wrapRenders() {
    if (typeof RENDERS === 'undefined' || typeof RENDERS !== 'object') return false;
    premiumIds().values().forEach(function (id) {
      var current = RENDERS[id];
      if (!current || current.__ghPremiumGated) return;   // not loaded yet, or already wrapped
      var original = current;
      var wrapped = function () { return isPremium() ? original.apply(this, arguments) : upsellHTML(id); };
      wrapped.__ghPremiumGated = true;
      RENDERS[id] = wrapped;
    });
    return true;
  }

  /* Every calculator-nav link (category lists and search results) renders through
     ghCalcItem (a `function` declaration, so window.ghCalcItem works); wrapping it once
     covers every place the 21 appear in navigation. */
  function wrapNavItem() {
    if (typeof window.ghCalcItem !== 'function' || window.ghCalcItem.__ghPremiumGated) return false;
    var original = window.ghCalcItem;
    var ids = premiumIds();
    var wrapped = function (c) {
      var html = original(c);
      if (!c || !ids.has(c.id)) return html;
      var lock = isPremium() ? '' :
        ' <svg class="gh-premium-lock" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6">' +
        '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
      return html
        .replace('class="gh-nav-item"', 'class="gh-nav-item gh-nav-premium"')
        .replace('</span><small>›</small>', '</span><small class="gh-premium-tag">PREMIUM' + lock + '</small><small>›</small>');
    };
    wrapped.__ghPremiumGated = true;
    window.ghCalcItem = wrapped;
    return true;
  }

  function reRenderIfCurrentIsGated() {
    try {
      if (typeof currentCalc !== 'undefined' && currentCalc && premiumIds().has(currentCalc) && typeof renderCalc === 'function') renderCalc(currentCalc, false);
    } catch (e) { /* best effort */ }
  }

  function apply() {
    try {
      ensureStyle();
      wrapRenders();
      wrapNavItem();
      if (typeof ghBuildNav === 'function') ghBuildNav('');
    } catch (e) { console.error('Gearhead Labs premium calculator gating failed', e); }
  }

  apply();
  /* Entitlement can change without a frame reload (upgrading mid-session, or the
     Premium shell's development plan switcher); react immediately instead of waiting
     for the next keystroke-triggered re-render. */
  try {
    var S = parentServices();
    if (S && typeof S.on === 'function') S.on('entitlement', function () { apply(); reRenderIfCurrentIsGated(); });
  } catch (e) { /* best effort */ }
  window.__GH_PREMIUM_GATE_APPLY = apply;
})();
