/* Gearhead Labs Premium — PRODUCTION adapter for the approved Foundation/Premium schema.

   One client: this adapter never builds or loads a Supabase client. It uses window.GH_SUPABASE, the single
   client owned by the bootstrap layer (supabase-boot.js), and holds no keys or credentials of any kind.

   Every request is explicit:
     - reads name their columns (models TABLES[*].select), never a wildcard;
     - writes go through models.prepareInsert / prepareUpdate (column whitelists, no passthrough);
     - only the approved client RPCs (models RPC) are called;
     - tables without an approved browser write path (value_records, calculation_records, billing and
       entitlement tables) expose no write methods at all, and saved calculations cannot be created.
   The database stays the authority (RLS, grants, triggers); this layer only shapes requests and errors.

   Not loaded by index.html yet: wired in at the separately approved integration step. */
(function(){
  'use strict';
  const GHP = window.GHP = window.GHP || {};
  const M = GHP.models;
  const LIST_LIMIT = 500;

  function domReady() {
    if (typeof document === 'undefined' || document.readyState !== 'loading') return Promise.resolve();
    return new Promise(resolve => document.addEventListener('DOMContentLoaded', () => resolve(), { once: true }));
  }
  const unavailable = reason => new M.GHPError('not_provisioned', M.MESSAGES.not_provisioned, { noBackend: true, code: reason });

  function build(client) {
    const unavailableListeners = new Set();
    let status = 'ready';
    function markUnavailable(err) {
      if (status === 'not_provisioned') return;
      status = 'not_provisioned';
      unavailableListeners.forEach(cb => { try { cb(err); } catch (e) { console.error('Gearhead Labs adapter listener', e); } });
    }
    /* Run one request; map any failure (returned or thrown) to a GHPError. */
    async function run(request) {
      let res;
      try { res = await request; } catch (e) { const m = M.mapError(e); if (m.noBackend) markUnavailable(m); throw m; }
      if (res && res.error) { const m = M.mapError(res.error, { status: res.status }); if (m.noBackend) markUnavailable(m); throw m; }
      return res ? res.data : null;
    }
    const requireUuid = (v, what) => { if (!M.isUuid(v)) throw new M.ValidationError({ [what]: 'Not a valid reference.' }, 'invalid'); return v.toLowerCase(); };

    /* ---------------------------------------------------------------- tables */
    function tableApi(name) {
      const c = M.TABLES[name], cols = c.select.join(',');
      const t = { name, columns: c.select };
      t.list = async (filters) => {
        let q = client.from(name).select(cols);
        for (const [k, v] of M.prepareFilters(name, filters)) q = q.eq(k, v);
        if (c.order) q = q.order(c.order, { ascending: false });
        return (await run(q.limit(LIST_LIMIT))) || [];
      };
      t.get = async (key) => {
        const k = name === 'engineering_analyzers' ? (M.ANALYZER_IDS.has(key) ? key : null)
          : name === 'plans' || name === 'plan_prices' || name === 'subscriptions' ? (typeof key === 'string' && /^[A-Za-z0-9_]+$/.test(key) ? key : null)
          : (M.isUuid(key) ? key.toLowerCase() : null);
        if (k == null) throw new M.ValidationError({ [c.key]: 'Not a valid reference.' }, 'invalid');
        return run(client.from(name).select(cols).eq(c.key, k).maybeSingle());
      };
      if (c.insert.length) {
        t.insert = async (values) => {
          const row = M.prepareInsert(name, values);
          return run(client.from(name).insert(row).select(cols).single());
        };
      }
      if (c.update.length) {
        /* An update that matches no row is not an error in PostgREST (RLS hides the row, or it is gone).
           It is reported as not-found so the UI never treats a silent no-op as success. */
        t.update = async (key, patch) => {
          const k = requireUuid(key, c.key), row = M.prepareUpdate(name, patch);
          const data = await run(client.from(name).update(row).eq(c.key, k).select(cols));
          if (!Array.isArray(data) || data.length !== 1) throw M.notFound();
          return data[0];
        };
      }
      if (c.softDelete) {
        t.softDelete = async (key) => { await run(client.rpc(c.softDelete, { p_id: requireUuid(key, c.key) })); return true; };
      }
      return Object.freeze(t);
    }
    const tables = {};
    Object.keys(M.TABLES).forEach(n => { tables[n] = tableApi(n); });
    Object.freeze(tables);

    /* ---------------------------------------------------------------- auth (Supabase Auth, magic link) */
    const toUser = u => u ? Object.freeze({ id: u.id, email: u.email || null }) : null;
    const auth = Object.freeze({
      async getUser() {
        const { data, error } = await client.auth.getSession();
        if (error) throw M.mapError(error);
        return toUser(data && data.session && data.session.user);
      },
      async signIn({ email } = {}) {
        email = String(email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new M.ValidationError({ email: 'Enter a valid email address.' }, 'invalid');
        const redirect = (typeof location !== 'undefined') ? location.origin + location.pathname : undefined;
        const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
        if (error) throw M.mapError(error, { status: error.status });
        return { pendingVerification: true };
      },
      async signOut() {
        const { error } = await client.auth.signOut();
        if (error) throw M.mapError(error, { status: error.status });
        return true;
      },
      onChange(cb) {
        const { data } = client.auth.onAuthStateChange((event, session) => cb(toUser(session && session.user), event));
        return () => data.subscription.unsubscribe();
      }
    });

    /* ---------------------------------------------------------------- entitlement (display only; the database enforces) */
    const entitlement = Object.freeze({
      async mine() {
        const user = await auth.getUser();
        if (!user) return M.ANONYMOUS_ENTITLEMENT;
        return M.entitlementFromRpc(await run(client.rpc(M.RPC.myEntitlement)));
      },
      async subscriptions() { return (await tables.subscriptions.list()).map(M.subscriptionView); }
    });

    /* ---------------------------------------------------------------- garage: one active garage per owner (frozen rule) */
    const garage = Object.freeze({
      async ensure(name) {
        const existing = await tables.garages.list();
        if (existing.length) return existing[0];
        try { return await tables.garages.insert({ name: name == null ? 'My Garage' : name }); }
        catch (e) {
          if (e.kind !== 'conflict') throw e;            // a concurrent first request created it
          const again = await tables.garages.list();
          if (again.length) return again[0];
          throw e;
        }
      }
    });

    /* ---------------------------------------------------------------- machines */
    const machines = Object.freeze({
      /* Primary: ONE write. The database moves the flag (0404 trigger), clearing it on every other machine of the
         owner, including deleted ones the client cannot see. No client-side clearing. */
      async setPrimary(machineId) {
        const id = requireUuid(machineId, 'machine_id');
        try { return await tables.machine_details.update(id, { is_primary: true }); }
        catch (e) {
          if (e.kind !== 'not_found') throw e;           // no details row yet: create it as primary
          return tables.machine_details.insert({ machine_id: id, is_primary: true });
        }
      }
    });

    /* ---------------------------------------------------------------- test setups (unlimited for every plan) */
    const testSetups = Object.freeze({
      async repinBaseline(id) { await run(client.rpc(M.RPC.repinTestSetupBaseline, { p_id: requireUuid(id, 'id') })); return true; }
    });

    /* ---------------------------------------------------------------- engineering analyses */
    const analyses = Object.freeze({
      /* Pins the analyzer version from the catalog when the caller does not supply it (0406 requires equality). */
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

    /* Is the approved schema present? Signed-out callers get a permission error from a provisioned database, and a
       missing-relation error from an empty one. */
    async function probe() {
      const res = await Promise.resolve(client.from('plans').select('plan_key').limit(1)).catch(e => ({ error: e }));
      if (res && res.error) {
        const m = M.mapError(res.error, { status: res.status });
        if (m.noBackend || m.kind === 'network') { if (m.noBackend) markUnavailable(m); throw m; }
      }
      return true;
    }

    return Object.freeze({
      kind: 'foundation', isDevelopment: false,
      capabilities: Object.freeze({ magicLink: true, softDelete: true, savedCalculationCreate: false }),
      get status() { return status; },
      onUnavailable(cb) { unavailableListeners.add(cb); return () => unavailableListeners.delete(cb); },
      probe, auth, entitlement, tables, garage, machines, testSetups, analyses
    });
  }

  /* Resolves once the bootstrap client exists and the schema is reachable; rejects with a GHPError whose noBackend
     flag tells the caller to fall back to no-backend mode. */
  async function create() {
    await domReady();
    const client = window.GH_SUPABASE;
    if (!client || typeof client.from !== 'function' || typeof client.rpc !== 'function' || !client.auth) throw unavailable('no_client');
    const adapter = build(client);
    await adapter.probe();
    return adapter;
  }

  GHP.adapters = GHP.adapters || {};
  GHP.adapters.foundation = Object.freeze({ create });
})();
