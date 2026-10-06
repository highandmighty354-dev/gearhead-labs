/* Gearhead Labs Premium — services: adapter selection, auth, the entitlement service and the repositories.
   The UI talks only to GHP.services; it never touches an adapter, storage or the network directly.

   Adapter selection (exactly one per page load):
     development — localhost, or ?gh_dev=1 while config allows it (in-browser store emulating the database rules)
     foundation  — production: premium/adapters/foundation.js on the bootstrap client (window.GH_SUPABASE)
     none        — no bootstrap client, or the database is not provisioned: no accounts, everyone is Free
   ?gh_dev=0 forces development mode off for the session (also on localhost).
   If the backend reports itself unavailable later (schema missing), the services fall back to "none".

   Access is decided by the database (RLS, grants, triggers). The entitlement state here only shapes the UI and
   comes from pf_my_entitlement(); nothing in the browser can grant access. */
(function(){
  'use strict';
  const GHP = window.GHP = window.GHP || {};
  const M = GHP.models;
  const cfg = window.GHP_CONFIG || { development: {} };

  /* ---------------------------------------------------------------- event bus */
  const listeners = {};
  const on = (evt, cb) => { (listeners[evt] = listeners[evt] || new Set()).add(cb); return () => listeners[evt].delete(cb); };
  const emit = (evt, payload) => (listeners[evt] || []).forEach(cb => { try { cb(payload); } catch (e) { console.error('GHP listener', evt, e); } });

  /* ---------------------------------------------------------------- adapter selection */
  function developmentRequested() {
    const dev = cfg.development || {}, flag = new URLSearchParams(location.search).get(dev.queryFlag || 'gh_dev');
    let session = null; try { session = sessionStorage.getItem('ghp_dev_session'); } catch (e) {}
    const remember = v => { try { sessionStorage.setItem('ghp_dev_session', v); } catch (e) {} };
    if (flag === '0') { remember('0'); return false; }
    if (flag === '1' && dev.allowQueryFlag) { remember('1'); return true; }
    if (session === '0') return false;
    if (session === '1' && dev.allowQueryFlag) return true;
    const h = location.hostname;
    return !!dev.allowOnLocalhost && (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '');
  }
  const unavailable = () => new M.GHPError('not_provisioned', M.MESSAGES.not_provisioned, { noBackend: true });
  function noBackendAdapter() {
    return Object.freeze({
      kind: 'none', isDevelopment: false, status: 'not_provisioned',
      capabilities: Object.freeze({ magicLink: false, softDelete: false, savedCalculationCreate: false }),
      onUnavailable() { return () => {}; },
      auth: Object.freeze({ getUser: async () => null, signIn: async () => { throw unavailable(); }, signOut: async () => true, onChange: () => () => {} }),
      entitlement: Object.freeze({ mine: async () => M.ANONYMOUS_ENTITLEMENT, subscriptions: async () => [] })
    });
  }
  async function selectAdapter() {
    const A = GHP.adapters || {};
    if (developmentRequested() && A.development) return A.development.create();
    if (A.foundation) {
      try { return await A.foundation.create(); }
      catch (e) { if (!e || !e.noBackend) console.warn('Gearhead Labs: accounts unavailable', e && e.kind || e); }
    }
    return noBackendAdapter();
  }

  /* ---------------------------------------------------------------- state */
  let adapter = noBackendAdapter(), mode = 'no-backend';
  const auth = {
    user: null,
    async signIn(opts) { return adapter.auth.signIn(opts); },
    async signOut() { return adapter.auth.signOut(); }
  };

  /* The single entitlement boundary for the UI. Display only: the database enforces. */
  let refreshTimer = null, lastRefresh = 0;
  const entitlements = {
    state: M.ANONYMOUS_ENTITLEMENT,
    has(feature) { return M.hasFeature(this.state, feature); },
    isPremium() { return this.state.isPremium; },
    async refresh() {
      let next;
      if (!auth.user) next = M.ANONYMOUS_ENTITLEMENT;
      else {
        try { next = await adapter.entitlement.mine(); }
        catch (e) { console.error('Gearhead Labs entitlement lookup failed', e); next = M.entitlementFromRpc(null); }   // fails closed: Free
      }
      lastRefresh = Date.now();
      clearTimeout(refreshTimer);
      if (next.endsAt) { const ms = Date.parse(next.endsAt) - Date.now(); if (ms > 0) refreshTimer = setTimeout(() => entitlements.refresh(), Math.min(ms + 1000, 2147483000)); }
      const changed = JSON.stringify(next) !== JSON.stringify(this.state);
      this.state = next; if (changed) emit('entitlement', next);
      return next;
    }
  };
  if (typeof document !== 'undefined' && document.addEventListener)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 60000) entitlements.refresh(); });

  /* ---------------------------------------------------------------- guards */
  const requireBackend = () => { if (mode === 'no-backend') throw unavailable(); return adapter; };
  const requireUser = () => {
    requireBackend();
    if (!auth.user) throw new M.GHPError('forbidden', 'Sign in to continue.', { signIn: true });
    return auth.user;
  };
  const requireFeature = (feature, message) => {
    requireUser();
    if (!entitlements.has(feature)) throw new M.GHPError('forbidden', message || 'This requires Gearhead Labs Premium.', { upgrade: true });
  };
  /* Run a repository call; an expired session signs the user out locally. */
  async function call(fn) {
    try { return await fn(); }
    catch (e) {
      if (e && e.sessionExpired && auth.user) { auth.user = null; emit('auth', null); entitlements.refresh(); }
      throw e;
    }
  }
  const changed = table => emit('data', { table });
  const T = () => requireBackend().tables;
  const PLACEHOLDER = '00000000-0000-4000-8000-000000000000';   // validation only; never sent
  const pick = (o, keys) => Object.fromEntries(keys.filter(k => o && k in o).map(k => [k, o[k]]));

  /* ---------------------------------------------------------------- profile */
  const profile = {
    async getMine() {
      const u = requireUser();
      return call(async () => { const p = await T().profiles.get(u.id); return p ? Object.assign({}, p, { email: u.email }) : null; });
    },
    async saveMine(data) {
      const u = requireUser();
      return call(async () => { const p = await T().profiles.update(u.id, pick(data, M.TABLES.profiles.update)); changed('profiles'); return p; });
    }
  };

  /* ---------------------------------------------------------------- My Garage: part of Premium (0407)
     Creating or editing garage data needs the 'garage' feature. Reading and deleting stay open to the owner, so a lapsed
     or former Premium member can still review and remove what they saved. The database enforces the same rule. */
  const GARAGE_MSG = M.MESSAGES.premium_garage;
  const requireGarage = () => requireFeature('garage', GARAGE_MSG);
  const garage = {
    async get() { requireUser(); return call(async () => (await T().garages.list())[0] || null); },
    async rename(name) {
      requireGarage();
      return call(async () => { const g = await adapter.garage.ensure(); const r = await T().garages.update(g.id, { name }); changed('garages'); return r; });
    }
  };

  /* ---------------------------------------------------------------- machines (+ details, engine/transmission components) */
  const MACHINE_FIELDS = ['name', 'machine_type', 'power_source', 'is_hypothetical'];
  const DETAIL_FIELDS = ['model_year', 'make', 'model', 'trim_level', 'nickname', 'notes', 'is_primary'];
  const SPEC_KINDS = ['engine', 'transmission'];
  const displayName = i => [i.model_year, i.make, i.model, i.trim_level].filter(x => x != null && String(x).trim()).join(' ') || (i.nickname && String(i.nickname).trim()) || '';
  function detailRow(input) {
    const d = pick(input, DETAIL_FIELDS);
    if ('notes' in input || 'drivetrain' in input) d.notes = M.withDrivetrain(input.notes == null ? null : String(input.notes), input.drivetrain);
    return d;
  }
  function view(m, d, comps) {
    const split = M.splitDrivetrain(d && d.notes);
    const spec = kind => { const c = comps.find(x => x.machine_id === m.id && x.kind === kind); return c ? { id: c.id, label: c.label } : null; };
    return Object.assign({}, m, {
      details: d ? Object.assign({}, d, { notes: split.notes }) : null, drivetrain: split.drivetrain,
      is_primary: !!(d && d.is_primary), engine: spec('engine'), transmission: spec('transmission')
    });
  }
  const machines = {
    async list() {
      requireUser();
      return call(async () => {
        const [ms, ds, cs] = await Promise.all([T().machines.list(), T().machine_details.list(), T().components.list()]);
        return ms.map(m => view(m, ds.find(d => d.machine_id === m.id), cs))
          .sort((a, b) => (b.is_primary - a.is_primary) || String(a.created_at).localeCompare(String(b.created_at)));
      });
    },
    async get(id) { const v = (await this.list()).find(m => m.id === id); if (!v) throw M.notFound(); return v; },
    /* input: machine fields + detail fields + drivetrain + engine/transmission labels. Everything is validated before
       the first write; the database enforces Premium (the check here only gives the answer early). */
    async create(input) {
      requireGarage();
      input = input || {};
      const machineRow = pick(input, MACHINE_FIELDS);
      if (!machineRow.name || !String(machineRow.name).trim()) machineRow.name = displayName(input) || 'My vehicle';
      const details = detailRow(input);
      const specs = SPEC_KINDS.filter(k => input[k] && String(input[k]).trim()).map(k => ({ kind: k, label: String(input[k]).trim() }));
      M.prepareInsert('machines', Object.assign({ garage_id: PLACEHOLDER }, machineRow));
      M.prepareInsert('machine_details', Object.assign({ machine_id: PLACEHOLDER }, details));
      specs.forEach(c => M.prepareInsert('components', Object.assign({ machine_id: PLACEHOLDER }, c)));
      return call(async () => {
        const existing = await this.list();
        if (!existing.some(m => m.is_primary)) details.is_primary = true;   // with no primary yet, the new vehicle becomes primary
        const g = await adapter.garage.ensure();
        const m = await T().machines.insert(Object.assign({ garage_id: g.id }, machineRow));
        try {
          await T().machine_details.insert(Object.assign({ machine_id: m.id }, details));
          for (const c of specs) await T().components.insert(Object.assign({ machine_id: m.id }, c));
        } catch (e) {
          try { await T().machines.softDelete(m.id); } catch (x) { /* best effort: a half-created machine is removed */ }
          throw e;
        }
        changed('machines');
        return this.get(m.id);
      });
    },
    async update(id, input) {
      requireGarage();
      input = input || {};
      const machinePatch = pick(input, MACHINE_FIELDS);
      const details = detailRow(input);
      if (Object.keys(machinePatch).length) M.prepareUpdate('machines', machinePatch);
      if (Object.keys(details).length) M.prepareUpdate('machine_details', details);
      return call(async () => {
        const current = await this.get(id);
        if ('notes' in input || 'drivetrain' in input)   // merge with what is stored: changing one never erases the other
          details.notes = M.withDrivetrain('notes' in input ? input.notes : (current.details && current.details.notes),
            'drivetrain' in input ? input.drivetrain : current.drivetrain);
        if (Object.keys(machinePatch).length) await T().machines.update(id, machinePatch);
        if (Object.keys(details).length) {
          if (current.details) await T().machine_details.update(id, details);
          else await T().machine_details.insert(Object.assign({ machine_id: id }, details));
        }
        for (const kind of SPEC_KINDS) {
          if (!(kind in input)) continue;
          const label = input[kind] == null ? '' : String(input[kind]).trim(), have = current[kind];
          if (!have && label) await T().components.insert({ machine_id: id, kind, label });
          else if (have && !label) await T().components.softDelete(have.id);
          else if (have && label !== have.label) await T().components.update(have.id, { label });
        }
        changed('machines');
        return this.get(id);
      });
    },
    /* One write; the database moves the flag (no client-side clearing). */
    async setPrimary(id) { requireGarage(); return call(async () => { const r = await adapter.machines.setPrimary(id); changed('machines'); return r; }); },
    /* Soft delete (permanent). Its details, setups and links are hidden with it. */
    async remove(id) { requireUser(); return call(async () => { await T().machines.softDelete(id); changed('machines'); return true; }); }
  };

  /* ---------------------------------------------------------------- Test Setups (Builds): part of Premium, unlimited */
  const SETUP_FIELDS = ['name', 'description', 'notes'];
  const testSetups = {
    async list(machineId) { requireUser(); return call(() => T().test_setups.list(machineId ? { machine_id: machineId } : undefined)); },
    async get(id) { requireUser(); return call(async () => { const r = await T().test_setups.get(id); if (!r) throw M.notFound(); return r; }); },
    async create(data) {
      requireGarage();
      return call(async () => { const r = await T().test_setups.insert(Object.assign({ machine_id: data && data.machine_id }, pick(data, SETUP_FIELDS))); changed('test_setups'); return r; });
    },
    async update(id, data) { requireGarage(); return call(async () => { const r = await T().test_setups.update(id, pick(data, SETUP_FIELDS)); changed('test_setups'); return r; }); },
    async remove(id) { requireUser(); return call(async () => { await T().test_setups.softDelete(id); changed('test_setups'); return true; }); },
    async repin(id) { requireGarage(); return call(async () => { await adapter.testSetups.repinBaseline(id); changed('test_setups'); return true; }); }
  };

  /* ---------------------------------------------------------------- engineering analyses (Premium; lapsed: read + delete) */
  const LINKS = ['title', 'notes', 'machine_id', 'test_setup_id'];
  const analyses = {
    async list(filter) { requireUser(); return call(() => T().engineering_analyses.list(filter)); },
    async get(id) { requireUser(); return call(async () => { const r = await T().engineering_analyses.get(id); if (!r) throw M.notFound(); return r; }); },
    /* snap: GHP.engineering.capture(); meta: title / notes / machine_id / test_setup_id. */
    async saveNew(snap, meta) {
      requireFeature('engineering_lab', 'Saving analyses requires Gearhead Labs Premium.');
      const row = Object.assign(M.analysisFromCapture(snap), pick(meta, LINKS));
      M.prepareInsert('engineering_analyses', Object.assign({ analyzer_version: 'pending' }, row));   // size and field checks before any request
      return call(async () => { const r = await adapter.analyses.create(row); changed('engineering_analyses'); return r; });
    },
    async saveExisting(id, snap, meta) {
      requireFeature('engineering_lab', 'Editing analyses requires Gearhead Labs Premium.');
      const a = M.analysisFromCapture(snap);
      const patch = Object.assign(pick(a, ['inputs', 'inputs_unit_system', 'result_snapshot']), pick(meta, LINKS));
      return call(async () => { const r = await T().engineering_analyses.update(id, patch); changed('engineering_analyses'); return r; });
    },
    async remove(id) { requireUser(); return call(async () => { await T().engineering_analyses.softDelete(id); changed('engineering_analyses'); return true; }); }
  };

  /* ---------------------------------------------------------------- saved calculations: read / edit / pin / delete. NO create. */
  const savedCalculations = {
    canCreate: false,
    createUnavailableReason: 'Saving a calculation needs the Gearhead Labs calculation service, which is not available yet.',
    async list(filter) { requireUser(); return call(() => T().saved_calculations.list(filter)); },
    async get(id) { requireUser(); return call(async () => { const r = await T().saved_calculations.get(id); if (!r) throw M.notFound(); return r; }); },
    async calculation(calculationId) { requireUser(); return call(() => T().calculation_records.get(calculationId)); },
    async update(id, data) {
      requireFeature('saved_calculations', 'Editing saved calculations requires Gearhead Labs Premium.');
      return call(async () => { const r = await T().saved_calculations.update(id, pick(data, LINKS)); changed('saved_calculations'); return r; });
    },
    async pin(id, pinned) {
      requireFeature('saved_calculations', 'Pinning requires Gearhead Labs Premium.');
      return call(async () => { const r = await T().saved_calculations.update(id, { pinned: !!pinned }); changed('saved_calculations'); return r; });
    },
    async remove(id) { requireUser(); return call(async () => { await T().saved_calculations.softDelete(id); changed('saved_calculations'); return true; }); }
  };

  /* ---------------------------------------------------------------- billing / plan status (read-only) */
  const billing = {
    async subscriptions() { requireUser(); return call(() => adapter.entitlement.subscriptions()); },
    async grants() { requireUser(); return call(() => T().entitlement_grants.list()); }
  };

  /* ---------------------------------------------------------------- analyzer catalog */
  let catalogCache = null;
  const analyzers = {
    async catalog() {
      requireUser();
      if (!catalogCache) catalogCache = await call(() => T().engineering_analyzers.list());
      return catalogCache;
    }
  };

  /* ---------------------------------------------------------------- boot */
  async function fallBackToNoBackend() {
    if (mode === 'no-backend') return;
    adapter = noBackendAdapter(); mode = 'no-backend'; catalogCache = null;
    auth.user = null; emit('auth', null);
    await entitlements.refresh();
    emit('mode', mode);
  }
  const ready = (async () => {
    adapter = await selectAdapter();
    mode = adapter.kind === 'development' ? 'development' : adapter.kind === 'foundation' ? 'production' : 'no-backend';
    adapter.onUnavailable(() => { fallBackToNoBackend(); });
    try { auth.user = await adapter.auth.getUser(); } catch (e) { auth.user = null; }
    await entitlements.refresh();
    adapter.auth.onChange(async user => { auth.user = user; catalogCache = null; emit('auth', user); await entitlements.refresh(); });
    emit('ready', services);
    return services;
  })();

  const services = {
    ready, on, auth, entitlements,
    get adapter() { return adapter; },
    get mode() { return mode; },
    pricing: Object.freeze({ offers: M.PREMIUM_OFFERS, text: M.PREMIUM_PRICE_TEXT }),
    repos: Object.freeze({ profile, garage, machines, testSetups, analyses, savedCalculations, billing, analyzers }),
    /* Development-only: present only when the development adapter is active. */
    get dev() {
      if (!adapter.isDevelopment) return null;
      return Object.freeze({
        setPlan: async plan => { await adapter.devTools.setPlan(plan); return entitlements.refresh(); },
        simulateSavedCalculation: async opts => { await adapter.devTools.simulateServerSavedCalculation(opts); changed('saved_calculations'); },
        reset: async () => { await adapter.devTools.reset(); auth.user = null; await entitlements.refresh(); emit('data', { table: '*' }); }
      });
    }
  };
  GHP.services = services;
})();
