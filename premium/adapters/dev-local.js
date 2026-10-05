/* Gearhead Labs Premium — DEVELOPMENT adapter.
   The same contract as premium/adapters/foundation.js (auth, entitlement, tables, garage, machines, testSetups,
   analyses), backed by an in-browser store that emulates the approved database rules so the UI behaves exactly as
   it will in production:
     - row visibility by owner, hidden after soft delete (and with a deleted machine or garage)
     - one active garage per owner; Free = 1 active machine (the 0404 allowance error); Premium more
     - primary flag moves on write (0404 trigger); unlimited Test Setups; baseline re-pin
     - engineering analyses need engineering_lab, version pinned to the catalog; saved calculations need
       saved_calculations to edit; nobody can create a saved calculation; lapsed users read and delete
     - the same validation (models.prepareInsert / prepareUpdate) and the same error codes, mapped by models.mapError
   Development-only extras live in devTools; they stand in for server-side actions (entitlement grants, a
   server-filed saved calculation) and do not exist in the production adapter.
   This is the only Premium file that touches browser storage. Never selected in production (see services.js). */
(function(){
  'use strict';
  const GHP = window.GHP = window.GHP || {};
  const M = GHP.models;
  const KEY = 'ghp_dev_store_v2';
  const ROW_TABLES = ['profiles', 'garages', 'machines', 'machine_details', 'components', 'test_setups', 'saved_calculations',
    'engineering_analyses', 'calculation_records'];
  const ANALYZER_VERSION = 'E1-AUTO';
  const PLAN_FEATURES = { free: [], premium: ['engineering_lab', 'saved_calculations', 'garage_unlimited'] };
  const LIST_LIMIT = 500;

  const emptyStore = () => ({ v: 2, users: {}, session: null, grants: [], rows: Object.fromEntries(ROW_TABLES.map(t => [t, []])) });
  let memory = null;   // fallback when storage is unavailable (private mode, blocked site data)
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = JSON.parse(raw); if (s && s.v === 2) { ROW_TABLES.forEach(t => { s.rows[t] = s.rows[t] || []; }); return s; } }
    } catch (e) { if (memory) return memory; }
    return memory || emptyStore();
  }
  function save(s) { memory = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    const h = () => Math.floor(Math.random() * 16).toString(16);
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => c === 'x' ? h() : (8 + Math.floor(Math.random() * 4)).toString(16));
  }
  const now = () => new Date().toISOString();
  const tick = v => new Promise(r => setTimeout(() => r(v), 0));   // async like a real backend
  const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
  /* Raise the same error the database would; models.mapError turns it into the same GHPError. */
  const fail = (code, message) => { throw M.mapError({ code, message }); };
  const ALLOWANCE = 'new row violates row-level security policy "pf_machines_free_allowance" for table "machines"';

  function create() {
    const listeners = new Set();
    const uid = () => load().session;
    const currentUser = () => { const s = load(); return s.session && s.users[s.session] ? { id: s.session, email: s.users[s.session].email } : null; };
    const emit = () => { const u = currentUser(); listeners.forEach(cb => { try { cb(u ? Object.freeze(u) : null, u ? 'SIGNED_IN' : 'SIGNED_OUT'); } catch (e) { console.error(e); } }); };
    const requireUid = () => { const id = uid(); if (!id) fail('42501', 'permission denied (signed out)'); return id; };

    /* ---------------------------------------------------------------- entitlement (pf_my_entitlement emulation) */
    function activeGrants(s, account) {
      const t = Date.now();
      return s.grants.filter(g => g.account_id === account && !g.revoked_at && Date.parse(g.starts_at) <= t && (!g.ends_at || Date.parse(g.ends_at) > t));
    }
    function entitlementRow(s, account) {
      const g = activeGrants(s, account).sort((a, b) => (a.ends_at === null) !== (b.ends_at === null) ? (a.ends_at === null ? -1 : 1) : String(b.ends_at).localeCompare(String(a.ends_at)))[0];
      if (!g) return [{ plan_key: 'free', is_premium: false, features: PLAN_FEATURES.free, source: null, ends_at: null }];
      return [{ plan_key: g.plan_key, is_premium: true, features: PLAN_FEATURES[g.plan_key] || [], source: g.source, ends_at: g.ends_at }];
    }
    const hasFeature = (s, account, f) => activeGrants(s, account).some(g => (PLAN_FEATURES[g.plan_key] || []).includes(f));

    /* ---------------------------------------------------------------- RLS emulation */
    const R = s => s.rows;
    const garageActive = (s, id) => R(s).garages.some(g => g.id === id && !g.deleted_at);
    const machineVisible = (s, id, owner) => R(s).machines.some(m => m.id === id && m.owner_id === owner && !m.deleted_at && garageActive(s, m.garage_id));
    function visible(s, table, owner) {
      const rows = R(s)[table];
      switch (table) {
        case 'profiles': return rows.filter(r => r.account_id === owner);
        case 'garages': return rows.filter(r => r.owner_id === owner && !r.deleted_at);
        case 'machines': return rows.filter(r => r.owner_id === owner && !r.deleted_at && garageActive(s, r.garage_id));
        case 'machine_details': return rows.filter(r => r.owner_id === owner && machineVisible(s, r.machine_id, owner));
        case 'components': case 'test_setups': return rows.filter(r => r.owner_id === owner && !r.deleted_at && machineVisible(s, r.machine_id, owner));
        case 'saved_calculations': case 'engineering_analyses': return rows.filter(r => r.owner_id === owner && !r.deleted_at);
        case 'calculation_records': return rows.filter(r => r.owner_id === owner);
        case 'engineering_analyzers': return M.ENGINEERING_CATALOG.map(a => ({ analyzer_id: a.id, code: a.code, name: a.name, category: a.category, analyzer_version: ANALYZER_VERSION }));
        case 'entitlement_grants': return s.grants.filter(g => g.account_id === owner);
        case 'plans': return [{ plan_key: 'free', name: 'Free', is_paid: false, features: [], active: true },
          { plan_key: 'premium', name: 'Premium', is_paid: true, features: PLAN_FEATURES.premium, active: true }];
        default: return [];   // value_records, subscriptions, plan_prices: none in development
      }
    }
    const ownsMachine = (s, id, owner) => R(s).machines.some(m => m.id === id && m.owner_id === owner);   // composite FK (ignores deletion)

    /* Link rules of the 0405/0406 triggers: a test setup implies its machine; a calculation's machine wins. */
    function linkCheck(s, owner, row, calcMachine) {
      if (row.test_setup_id) {
        const ts = R(s).test_setups.find(t => t.id === row.test_setup_id && t.owner_id === owner);
        if (!ts) fail('23503', 'insert or update violates foreign key constraint (test_setup)');
        if (row.machine_id == null) row.machine_id = ts.machine_id;
        else if (row.machine_id !== ts.machine_id) fail('23514', 'PF_LINK: the test setup belongs to a different machine');
      }
      if (calcMachine) {
        if (row.machine_id == null) row.machine_id = calcMachine;
        else if (row.machine_id !== calcMachine) fail('23514', 'PF_LINK: the calculation was recorded for a different machine');
      }
      if (row.machine_id && !ownsMachine(s, row.machine_id, owner)) fail('23503', 'insert or update violates foreign key constraint (machine)');
    }
    function movePrimary(s, owner, machineId) {   // 0404 trigger: one primary per owner, including hidden rows
      R(s).machine_details.forEach(d => { if (d.owner_id === owner && d.machine_id !== machineId && d.is_primary) { d.is_primary = false; d.updated_at = now(); } });
    }

    function insertRow(table, row) {
      const s = load(), owner = requireUid(), t = now();
      const base = { owner_id: owner, created_at: t, updated_at: t, deleted_at: null };
      let rec;
      switch (table) {
        case 'garages':
          if (visible(s, 'garages', owner).length) fail('23505', 'duplicate key value violates unique constraint "garages_one_active_per_owner"');
          rec = { id: uuid(), ...base, name: null, ...row }; break;
        case 'machines': {
          if (!hasFeature(s, owner, 'garage_unlimited') && visible(s, 'machines', owner).length >= M.FREE_MACHINE_LIMIT) fail('42501', ALLOWANCE);
          if (!R(s).garages.some(g => g.id === row.garage_id && g.owner_id === owner)) fail('23503', 'insert or update violates foreign key constraint (garage)');
          rec = { id: uuid(), ...base, power_source: null, is_hypothetical: false, ...row }; break;
        }
        case 'machine_details': {
          if (!machineVisible(s, row.machine_id, owner)) fail('42501', 'new row violates row-level security policy for table "machine_details"');
          if (R(s).machine_details.some(d => d.machine_id === row.machine_id)) fail('23505', 'duplicate key value violates unique constraint "machine_details_pkey"');
          rec = { owner_id: owner, created_at: t, updated_at: t, model_year: null, make: null, model: null, trim_level: null, nickname: null, notes: null, is_primary: false, ...row };
          if (rec.is_primary) movePrimary(s, owner, rec.machine_id);
          break;
        }
        case 'components':
          if (!ownsMachine(s, row.machine_id, owner)) fail('23503', 'insert or update violates foreign key constraint (machine)');
          if (row.parent_component_id && !R(s).components.some(c => c.id === row.parent_component_id && c.owner_id === owner && c.machine_id === row.machine_id))
            fail('23503', 'insert or update violates foreign key constraint (parent component)');
          rec = { id: uuid(), ...base, parent_component_id: null, manufacturer: null, model: null, part_number: null, label: null, ...row }; break;
        case 'test_setups':
          if (!ownsMachine(s, row.machine_id, owner)) fail('23503', 'insert or update violates foreign key constraint (machine)');
          rec = { id: uuid(), ...base, description: null, notes: null, baseline_pinned_at: t, ...row }; break;
        case 'engineering_analyses': {
          if (!hasFeature(s, owner, 'engineering_lab')) fail('42501', 'new row violates row-level security policy for table "engineering_analyses"');
          if (row.analyzer_version !== ANALYZER_VERSION) fail('23514', `PF_ANALYZER: ${row.analyzer_id} is at version ${ANALYZER_VERSION}`);
          const r2 = { machine_id: null, test_setup_id: null, notes: null, result_snapshot: null, ...row };
          linkCheck(s, owner, r2, null);
          rec = { id: uuid(), ...base, ...r2, result_trust: 'client_reported' }; break;
        }
        default: fail('42501', 'permission denied for table ' + table);
      }
      R(s)[table].push(rec); save(s); return rec;
    }
    function updateRow(table, key, patch) {
      const s = load(), owner = requireUid(), keyCol = M.TABLES[table].key;
      const target = visible(s, table, owner).find(r => r[keyCol] === key);
      if (!target) return null;   // zero rows (RLS hides it, or it is gone)
      if (table === 'saved_calculations' && !hasFeature(s, owner, 'saved_calculations')) fail('42501', 'new row violates row-level security policy for table "saved_calculations"');
      if (table === 'engineering_analyses' && !hasFeature(s, owner, 'engineering_lab')) fail('42501', 'new row violates row-level security policy for table "engineering_analyses"');
      const next = { ...target, ...patch };
      if (table === 'saved_calculations') {
        const calc = R(s).calculation_records.find(c => c.id === next.calculation_id);
        linkCheck(s, owner, next, calc && calc.machine_id);
      }
      if (table === 'engineering_analyses') linkCheck(s, owner, next, null);
      if (table === 'machine_details' && next.is_primary && !target.is_primary) movePrimary(s, owner, next.machine_id);
      Object.assign(target, next, { updated_at: now() });
      save(s); return target;
    }
    function softDeleteRow(table, key) {
      const s = load(), owner = requireUid();
      const r = R(s)[table].find(x => x.id === key && x.owner_id === owner && !x.deleted_at);
      if (!r) fail('P0002', 'not found: no active row owned by the caller');
      r.deleted_at = now(); r.updated_at = r.deleted_at; save(s); return true;
    }

    /* ---------------------------------------------------------------- tables (same surface as foundation.js) */
    const requireUuid = (v, what) => { if (!M.isUuid(v)) throw new M.ValidationError({ [what]: 'Not a valid reference.' }, 'invalid'); return v.toLowerCase(); };
    function tableApi(name) {
      const c = M.TABLES[name];
      const shape = r => r == null ? null : Object.fromEntries(c.select.map(k => [k, r[k] === undefined ? null : clone(r[k])]));
      const t = { name, columns: c.select };
      t.list = async (filters) => {
        const f = M.prepareFilters(name, filters), owner = requireUid();
        let rows = visible(load(), name, owner).filter(r => f.every(([k, v]) => r[k] === v));
        if (c.order) rows = rows.slice().sort((a, b) => String(b[c.order]).localeCompare(String(a[c.order])));
        return tick(rows.slice(0, LIST_LIMIT).map(shape));
      };
      t.get = async (key) => {
        const k = name === 'engineering_analyzers' ? (M.ANALYZER_IDS.has(key) ? key : null)
          : name === 'plans' || name === 'plan_prices' || name === 'subscriptions' ? (typeof key === 'string' && /^[A-Za-z0-9_]+$/.test(key) ? key : null)
          : (M.isUuid(key) ? key.toLowerCase() : null);
        if (k == null) throw new M.ValidationError({ [c.key]: 'Not a valid reference.' }, 'invalid');
        const owner = requireUid();
        return tick(shape(visible(load(), name, owner).find(r => r[c.key] === k)));
      };
      if (c.insert.length) t.insert = async (values) => tick(shape(insertRow(name, M.prepareInsert(name, values))));
      if (c.update.length) {
        t.update = async (key, patch) => {
          const k = requireUuid(key, c.key), row = M.prepareUpdate(name, patch);
          const r = updateRow(name, k, row);
          if (!r) throw M.notFound();
          return tick(shape(r));
        };
      }
      if (c.softDelete) t.softDelete = async (key) => tick(softDeleteRow(name, requireUuid(key, c.key)));
      return Object.freeze(t);
    }
    const tables = {};
    Object.keys(M.TABLES).forEach(n => { tables[n] = tableApi(n); });
    Object.freeze(tables);

    /* ---------------------------------------------------------------- auth (mock: email only, immediate) */
    const auth = Object.freeze({
      async getUser() { const u = currentUser(); return tick(u ? Object.freeze(u) : null); },
      /* Creates the account and profile on first sign-in, as the database's sign-up triggers do. */
      async signIn({ email } = {}) {
        email = String(email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new M.ValidationError({ email: 'Enter a valid email address.' }, 'invalid');
        const s = load();
        let id = Object.keys(s.users).find(k => s.users[k].email === email);
        if (!id) {
          id = uuid(); const t = now();
          s.users[id] = { email };
          s.rows.profiles.push({ account_id: id, display_name: null, avatar_url: null, location: null, experience_level: null,
            preferred_unit_system: 'imperial', favorite_machine_id: null, created_at: t, updated_at: t });
        }
        s.session = id; save(s); emit();
        return tick({ pendingVerification: false });
      },
      async signOut() { const s = load(); s.session = null; save(s); emit(); return tick(true); },
      onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }
    });

    const entitlement = Object.freeze({
      async mine() { const u = currentUser(); return tick(u ? M.entitlementFromRpc(entitlementRow(load(), u.id)) : M.ANONYMOUS_ENTITLEMENT); },
      async subscriptions() { return (await tables.subscriptions.list()).map(M.subscriptionView); }
    });

    /* ---------------------------------------------------------------- composite operations (identical to foundation.js) */
    const garage = Object.freeze({
      async ensure(name) {
        const existing = await tables.garages.list();
        if (existing.length) return existing[0];
        try { return await tables.garages.insert({ name: name == null ? 'My Garage' : name }); }
        catch (e) { if (e.kind !== 'conflict') throw e; const again = await tables.garages.list(); if (again.length) return again[0]; throw e; }
      }
    });
    const machines = Object.freeze({
      async setPrimary(machineId) {
        const id = requireUuid(machineId, 'machine_id');
        try { return await tables.machine_details.update(id, { is_primary: true }); }
        catch (e) { if (e.kind !== 'not_found') throw e; return tables.machine_details.insert({ machine_id: id, is_primary: true }); }
      }
    });
    const testSetups = Object.freeze({
      async repinBaseline(id) {
        const s = load(), owner = requireUid(), k = requireUuid(id, 'id');
        const r = s.rows.test_setups.find(t => t.id === k && t.owner_id === owner && !t.deleted_at);
        if (!r) fail('P0002', 'GF_NOT_FOUND: no active test setup owned by the caller');
        r.baseline_pinned_at = now(); r.updated_at = r.baseline_pinned_at; save(s); return tick(true);
      }
    });
    const analyses = Object.freeze({
      async create(values) {
        const v = Object.assign({}, values);
        if (v.analyzer_version == null) {
          const a = await tables.engineering_analyzers.get(v.analyzer_id);
          if (!a) throw new M.ValidationError({ analyzer_id: 'Unknown engineering analyzer.' }, 'invalid');
          v.analyzer_version = a.analyzer_version;
        }
        return tables.engineering_analyses.insert(v);
      }
    });

    /* ---------------------------------------------------------------- development-only (stand-ins for server actions) */
    const devTools = Object.freeze({
      /* 'free' revokes the current grant (a former Premium user is then "lapsed"); 'premium' = manual grant;
         'trial' = 14-day trial grant. Mirrors pf_grant_manual / pf_revoke_grant on the server. */
      async setPlan(plan) {
        const s = load(), owner = requireUid(), t = now();
        s.grants.forEach(g => { if (g.account_id === owner && !g.revoked_at) g.revoked_at = t; });
        if (plan === 'premium' || plan === 'trial')
          s.grants.push({ id: uuid(), account_id: owner, plan_key: 'premium', source: plan === 'trial' ? 'trial' : 'manual',
            starts_at: t, ends_at: plan === 'trial' ? new Date(Date.now() + 14 * 864e5).toISOString() : null, revoked_at: null, created_at: t, note: 'development' });
        save(s); return tick(true);
      },
      /* What the future trusted calculation endpoint will do: record a calculation and file it as saved. */
      async simulateServerSavedCalculation({ machine_id = null, title = 'Example saved calculation' } = {}) {
        const s = load(), owner = requireUid(), t = now(), calcId = uuid();
        s.rows.calculation_records.push({ id: calcId, owner_id: owner, machine_id, calculator_id: 'engine_displacement', canonical_id: 'engine_displacement',
          engine_version: 'development', formula_version: 'development', result_state: 'valid', inputs: {}, missing: [], warnings: [], outputs: [], created_at: t });
        s.rows.saved_calculations.push({ id: uuid(), owner_id: owner, calculation_id: calcId, machine_id, test_setup_id: null, title, notes: null, pinned: false,
          created_at: t, updated_at: t, deleted_at: null });
        save(s); return tick(true);
      },
      async reset() { save(emptyStore()); emit(); return tick(true); }
    });

    return Object.freeze({
      kind: 'development', isDevelopment: true,
      capabilities: Object.freeze({ magicLink: false, softDelete: true, savedCalculationCreate: false }),
      get status() { return 'ready'; },
      onUnavailable() { return () => {}; },
      async probe() { return true; },
      auth, entitlement, tables, garage, machines, testSetups, analyses, devTools
    });
  }

  GHP.adapters = GHP.adapters || {};
  GHP.adapters.development = Object.freeze({ create: async () => create() });
})();
