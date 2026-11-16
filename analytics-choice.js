/* Gearhead Labs — the visitor's analytics choice (docs/ANALYTICS-IMPLEMENTATION.md, "Opt-out").
   Loaded on every page BEFORE analytics.js, whether analytics is switched on or not. It decides, synchronously and before
   analytics.js can create any identifier, listener or request, whether this browser may be measured:

     browser-signal  the browser sends Global Privacy Control or Do Not Track  -> nothing is collected
     opted-out       the visitor turned analytics off on the Privacy page       -> nothing is collected
     no-storage      the browser blocks site storage (the choice could not be remembered) -> nothing is collected
     allowed         none of the above                                          -> analytics.js may run (if it is enabled)

   The only thing it stores is the visitor's own choice ("gh_a_optout" = "1" in localStorage). Turning analytics off also
   deletes any analytics identifiers and unsent events already in this browser and stops a running analytics.js at once,
   in this tab AND in every other open tab of the site (each tab clears its own sessionStorage when it hears of the
   change). Turning it back on takes effect from the next page load, always with new identifiers. A browser signal
   always wins and is changed in the browser.

   The Privacy page shows the control wherever it contains <div data-gh-analytics-choice></div> (in this document or in
   the calculator frame), with a status line read out by screen readers and a plain button. */
(function () {
  'use strict';
  var OPT_KEY = 'gh_a_optout';
  var IDS = ['gh_a_vid', 'gh_a_s', 'gh_a_q', 'gh_a_cr'];

  function signal() {
    try {
      return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1';
    } catch (e) { return false; }
  }
  function storageOk() {
    try { var k = 'gh_a_probe'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k); return true; } catch (e) { return false; }
  }
  function optedOut() { try { return window.localStorage.getItem(OPT_KEY) === '1'; } catch (e) { return false; } }
  function forget() {
    ['localStorage', 'sessionStorage'].forEach(function (s) {
      IDS.forEach(function (k) { try { window[s].removeItem(k); } catch (e) { /* ignore */ } });
    });
  }
  function state() {
    if (signal()) return 'browser-signal';
    if (!storageOk()) return 'no-storage';
    return optedOut() ? 'opted-out' : 'allowed';
  }
  function optOut() {
    try { window.localStorage.setItem(OPT_KEY, '1'); } catch (e) { /* no storage: analytics cannot run anyway */ }
    forget();
    try { window.dispatchEvent(new Event('gh:analytics-optout')); } catch (e) { /* ignore */ }
    render();
    return state();
  }
  function optIn() {
    try { window.localStorage.removeItem(OPT_KEY); } catch (e) { /* ignore */ }
    render(true);
    return state();
  }

  /* ---------- the control on the Privacy page ---------- */
  var TEXT = {
    'allowed': ['Analytics is on for this browser. It records which pages and calculators are used, never what you type.', 'Turn analytics off for this browser'],
    'opted-out': ['Analytics is off for this browser. Nothing is collected and no analytics identifier is kept.', 'Turn analytics back on for this browser'],
    'browser-signal': ['Your browser sends Global Privacy Control or Do Not Track, so analytics is off and nothing is collected. To change this, change the setting in your browser.', null],
    'no-storage': ['Your browser blocks site storage, so analytics is off and nothing is collected.', null]
  };
  function paint(box, resumed) {
    var st = state(), t = TEXT[st], doc = box.ownerDocument;
    var p = box.querySelector('[data-gh-analytics-status]'), b = box.querySelector('[data-gh-analytics-toggle]');
    if (!p) { p = doc.createElement('p'); p.setAttribute('data-gh-analytics-status', ''); p.setAttribute('role', 'status'); p.setAttribute('aria-live', 'polite'); box.appendChild(p); }
    if (!b) { b = doc.createElement('button'); b.type = 'button'; b.setAttribute('data-gh-analytics-toggle', ''); box.appendChild(b); }
    p.textContent = t[0] + (resumed && st === 'allowed' ? ' Measurement resumes from your next page load.' : '');
    box.setAttribute('data-state', st);
    if (t[1]) { b.hidden = false; b.textContent = t[1]; b.setAttribute('data-next', st === 'allowed' ? 'off' : 'on'); }
    else { b.hidden = true; b.removeAttribute('data-next'); }
  }
  function boxes() {
    var out = [], docs = [document];
    try { var f = document.getElementById('app'); if (f && f.contentWindow && f.contentWindow.document) docs.push(f.contentWindow.document); } catch (e) { /* cross-origin: none */ }
    docs.forEach(function (d) { var l = d.querySelectorAll('[data-gh-analytics-choice]'); for (var i = 0; i < l.length; i++) out.push(l[i]); });
    return out;
  }
  function render(resumed) { boxes().forEach(function (b) { try { paint(b, resumed); } catch (e) { /* ignore */ } }); }
  function onClick(e) {
    var b = e.target && e.target.closest && e.target.closest('[data-gh-analytics-toggle]');
    if (!b) return;
    if (b.getAttribute('data-next') === 'off') optOut(); else if (b.getAttribute('data-next') === 'on') optIn();
  }
  function bind(doc) {
    if (!doc || doc.__ghChoice) return;
    doc.__ghChoice = true;
    doc.addEventListener('click', onClick, true);
    if (typeof MutationObserver === 'function' && doc.documentElement) {
      new MutationObserver(function () {
        var l = doc.querySelectorAll('[data-gh-analytics-choice]:not([data-state])');
        for (var i = 0; i < l.length; i++) { try { paint(l[i]); } catch (e) { /* ignore */ } }
      }).observe(doc.documentElement, { childList: true, subtree: true });
    }
    render();
  }
  function bindFrame() { try { var f = document.getElementById('app'); if (f && f.contentWindow) bind(f.contentWindow.document); } catch (e) { /* ignore */ } }

  /* Another tab changed the choice (localStorage is shared; sessionStorage is not). If this browser may no longer be
     measured, THIS tab deletes its own identifiers and unsent queue (its sessionStorage can only be cleared from here),
     stops analytics.js at once and updates the control. Opting back in elsewhere only updates the control text: a
     stopped tab never resumes; measuring starts again, with new identifiers, on its next page load. */
  function onStorage(e) {
    if (e && e.key !== null && e.key !== OPT_KEY) return;        // null key = storage cleared
    if (state() === 'allowed') { render(true); return; }
    forget();
    try { window.dispatchEvent(new Event('gh:analytics-optout')); } catch (x) { /* ignore */ }
    render();
  }
  window.addEventListener('storage', onStorage);

  window.GH_ANALYTICS_CHOICE = { state: state, optOut: optOut, optIn: optIn, forget: forget };
  if (state() !== 'allowed') forget();                 // identifiers left from before a choice or a browser signal are removed
  window.addEventListener('gh:frameready', bindFrame);
  var start = function () { bind(document); bindFrame(); var f = document.getElementById('app'); if (f) f.addEventListener('load', bindFrame); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
