/* Gearhead Labs Premium — services: adapter selection, auth, the entitlement
   service and the repositories. The UI talks only to GHP.services; it never
   touches an adapter, storage or the network directly.

   Adapter selection (exactly one per page load):
     development — localhost, or ?gh_dev=1 while config allows it (mock data/entitlement)
     supabase    — production, when GHP_CONFIG.backend has a URL and anon key
     none        — production with no backend: no accounts, everyone is FREE
   ?gh_dev=0 forces development mode off for the session (also on localhost). */
(function(){
  'use strict';
  const GHP = window.GHP = window.GHP || {};
  const M = GHP.models;
  const cfg = window.GHP_CONFIG || { backend:{}, development:{} };

  /* ---------- event bus ---------- */
  const listeners = {};
  const on = (evt, cb) => { (listeners[evt]=listeners[evt]||new Set()).add(cb); return () => listeners[evt].delete(cb); };
  const emit = (evt, payload) => (listeners[evt]||[]).forEach(cb=>{ try{ cb(payload); }catch(e){ console.error('GHP listener',evt,e); } });

  /* ---------- adapter selection ---------- */
  function developmentRequested(){
    const dev=cfg.development||{}, flag=new URLSearchParams(location.search).get(dev.queryFlag||'gh_dev');
    let session=null; try { session=sessionStorage.getItem('ghp_dev_session'); } catch(e){}
    const remember=v=>{ try { sessionStorage.setItem('ghp_dev_session',v); } catch(e){} };
    if(flag==='0'){ remember('0'); return false; }
    if(flag==='1' && dev.allowQueryFlag){ remember('1'); return true; }
    if(session==='0') return false;
    if(session==='1' && dev.allowQueryFlag) return true;
    const h=location.hostname;
    return !!dev.allowOnLocalhost && (h==='localhost'||h==='127.0.0.1'||h==='[::1]'||h==='');
  }
  function noBackendAdapter(){
    const unavailable=()=>{ throw new Error('Accounts are not available yet: no backend is configured.'); };
    return { kind:'none', isDevelopment:false, capabilities:{ foreignKeyCascade:true, magicLink:false },
      auth:{ getUser:async()=>null, signIn:async()=>unavailable(), signOut:async()=>true, onChange:()=>()=>{} },
      entitlements:{ getForUser:async()=>null },
      db:{ list:unavailable, get:unavailable, insert:unavailable, update:unavailable, remove:unavailable } };
  }
  async function selectAdapter(){
    if(developmentRequested()) return GHP.adapters.development.create();
    const b=cfg.backend||{};
    if(b.provider==='supabase' && b.url && b.anonKey){
      try { return await GHP.adapters.supabase.create(b); }
      catch(e){ console.error('Gearhead Labs: backend unavailable',e); }
    }
    return noBackendAdapter();
  }

  /* ---------- services ---------- */
  const auth = { user:null, async signIn(opts){ return adapter.auth.signIn(opts); }, async signOut(){ return adapter.auth.signOut(); } };

  /* The single entitlement boundary. Nothing else decides Premium access. */
  const entitlements = {
    state: M.evaluateEntitlement(null,'anonymous'),
    has(feature){ return this.state.features.has(feature); },
    isPremium(){ return this.state.isPremium; },
    async refresh(){
      let next;
      if(adapter.kind==='none') next=M.evaluateEntitlement(null,'no-backend');
      else if(!auth.user) next=M.evaluateEntitlement(null,'anonymous');
      else {
        let row=null; try { row=await adapter.entitlements.getForUser(auth.user.id); } catch(e){ console.error('Gearhead Labs entitlement lookup failed',e); }
        next=M.evaluateEntitlement(row, adapter.isDevelopment?'development':'backend');
      }
      const changed=next.plan!==this.state.plan||next.isPremium!==this.state.isPremium||next.status!==this.state.status||next.source!==this.state.source;
      this.state=next; if(changed) emit('entitlement', next); return next;
    }
  };

  /* ---------- repositories ---------- */
  const requireUser = () => { if(!auth.user) throw new Error('Sign in to continue.'); return auth.user; };
  const requireFeature = f => { requireUser(); if(!entitlements.has(f)) throw new Error('This feature requires Gearhead Labs Premium.'); };
  async function owned(table, id){
    const u=requireUser(), row=await adapter.db.get(table,id);
    if(!row || row.user_id!==u.id) throw new Error('Record not found.');
    return row;
  }
  /* Keep vehicle/build references consistent: a build implies its vehicle. */
  async function resolveRefs(clean){
    if(clean.build_id){ const b=await owned('builds',clean.build_id); if(clean.vehicle_id && clean.vehicle_id!==b.vehicle_id) throw new M.ValidationError({build_id:'That build belongs to a different vehicle.'}); clean.vehicle_id=b.vehicle_id; }
    if(clean.vehicle_id) await owned('vehicles',clean.vehicle_id);
    if(clean.project_id) await owned('projects',clean.project_id);
    return clean;
  }
  const changed = (table) => emit('data', { table });
  /* Development store has no foreign keys; emulate ON DELETE CASCADE / SET NULL. */
  async function detach(column, value){
    if(adapter.capabilities.foreignKeyCascade) return;
    const u=requireUser();
    for(const table of ['projects','engineering_analyses']){
      for(const r of await adapter.db.list(table,{ user_id:u.id, [column]:value })) await adapter.db.update(table, r.id, { [column]:null });
    }
    const p=await adapter.db.get('profiles',u.id);
    const fav=column==='vehicle_id'?'favorite_vehicle_id':column==='build_id'?'favorite_build_id':null;
    if(p && fav && p[fav]===value) await adapter.db.update('profiles',u.id,{ [fav]:null });
  }

  const profiles = {
    async getMine(){ const u=requireUser(); return adapter.db.get('profiles',u.id); },
    async saveMine(data){
      const u=requireUser(), clean=M.validate('profiles',data,{partial:true});
      if(clean.favorite_vehicle_id) await owned('vehicles',clean.favorite_vehicle_id);
      if(clean.favorite_build_id) await owned('builds',clean.favorite_build_id);
      const row=await adapter.db.update('profiles',u.id,clean); changed('profiles'); return row;
    }
  };

  const vehicles = {
    async list(){ requireFeature('garage'); return adapter.db.list('vehicles',{ user_id:auth.user.id }); },
    async get(id){ requireFeature('garage'); return owned('vehicles',id); },
    async create(data){
      requireFeature('garage');
      const clean=M.validate('vehicles',data), existing=await this.list();
      if(!existing.length) clean.is_primary=true;
      const row=await adapter.db.insert('vehicles',{ ...clean, is_primary:false, user_id:auth.user.id });
      if(clean.is_primary) await this.setPrimary(row.id); else changed('vehicles');
      return this.get(row.id);
    },
    async update(id,data){
      requireFeature('garage'); await owned('vehicles',id);
      const clean=M.validate('vehicles',data,{partial:true}), makePrimary=clean.is_primary; delete clean.is_primary;
      const row=await adapter.db.update('vehicles',id,clean);
      if(makePrimary) await this.setPrimary(id); else changed('vehicles');
      return makePrimary?this.get(id):row;
    },
    async setPrimary(id){
      requireFeature('garage'); await owned('vehicles',id);
      for(const v of await this.list()) if(v.is_primary && v.id!==id) await adapter.db.update('vehicles',v.id,{ is_primary:false });
      await adapter.db.update('vehicles',id,{ is_primary:true }); changed('vehicles'); return true;
    },
    async remove(id){
      requireFeature('garage'); const v=await owned('vehicles',id);
      if(!adapter.capabilities.foreignKeyCascade){
        for(const b of await adapter.db.list('builds',{ user_id:auth.user.id, vehicle_id:id })){ await detach('build_id',b.id); await adapter.db.remove('builds',b.id); }
        await detach('vehicle_id',id);
      }
      await adapter.db.remove('vehicles',id);
      if(v.is_primary){ const rest=await this.list(); if(rest.length) await adapter.db.update('vehicles',rest[0].id,{ is_primary:true }); }
      changed('vehicles'); return true;
    }
  };

  const builds = {
    async list(vehicleId){ requireFeature('garage'); const f={ user_id:auth.user.id }; if(vehicleId) f.vehicle_id=vehicleId; return adapter.db.list('builds',f); },
    async get(id){ requireFeature('garage'); return owned('builds',id); },
    async create(data){
      requireFeature('garage'); const clean=M.validate('builds',data); await owned('vehicles',clean.vehicle_id);
      const row=await adapter.db.insert('builds',{ ...clean, user_id:auth.user.id }); changed('builds'); return row;
    },
    async update(id,data){
      requireFeature('garage'); await owned('builds',id); const clean=M.validate('builds',data,{partial:true});
      if(clean.vehicle_id) await owned('vehicles',clean.vehicle_id);
      const row=await adapter.db.update('builds',id,clean); changed('builds'); return row;
    },
    async remove(id){ requireFeature('garage'); await owned('builds',id); await detach('build_id',id); await adapter.db.remove('builds',id); changed('builds'); return true; }
  };

  const projects = {
    async list(){ requireFeature('projects'); return adapter.db.list('projects',{ user_id:auth.user.id }); },
    async get(id){ requireFeature('projects'); return owned('projects',id); },
    async create(data){
      requireFeature('projects'); const clean=await resolveRefs(M.validate('projects',data));
      const row=await adapter.db.insert('projects',{ ...clean, user_id:auth.user.id }); changed('projects'); return row;
    },
    async update(id,data){
      requireFeature('projects'); await owned('projects',id); const clean=await resolveRefs(M.validate('projects',data,{partial:true}));
      const row=await adapter.db.update('projects',id,clean); changed('projects'); return row;
    },
    async remove(id){ requireFeature('projects'); await owned('projects',id); await detach('project_id',id); await adapter.db.remove('projects',id); changed('projects'); return true; }
  };

  const analyses = {
    async list(filter={}){ requireFeature('saved_analyses'); return adapter.db.list('engineering_analyses',{ ...filter, user_id:auth.user.id }); },
    async get(id){ requireFeature('saved_analyses'); return owned('engineering_analyses',id); },
    async create(data){
      requireFeature('saved_analyses'); const clean=await resolveRefs(M.validate('engineering_analyses',data));
      const row=await adapter.db.insert('engineering_analyses',{ ...clean, user_id:auth.user.id }); changed('engineering_analyses'); return row;
    },
    async update(id,data){
      requireFeature('saved_analyses'); await owned('engineering_analyses',id);
      const clean=await resolveRefs(M.validate('engineering_analyses',data,{partial:true}));
      const row=await adapter.db.update('engineering_analyses',id,clean); changed('engineering_analyses'); return row;
    },
    async remove(id){ requireFeature('saved_analyses'); await owned('engineering_analyses',id); await adapter.db.remove('engineering_analyses',id); changed('engineering_analyses'); return true; }
  };

  /* ---------- boot ---------- */
  let adapter = noBackendAdapter();
  const ready = (async () => {
    adapter = await selectAdapter();
    services.adapter = adapter;
    services.mode = adapter.kind==='development' ? 'development' : adapter.kind==='supabase' ? 'production' : 'no-backend';
    try { auth.user = await adapter.auth.getUser(); } catch(e){ auth.user=null; }
    await entitlements.refresh();
    adapter.auth.onChange(async user => { auth.user=user; emit('auth',user); await entitlements.refresh(); });
    emit('ready', services);
    return services;
  })();

  const services = { ready, adapter, mode:'no-backend', on, auth, entitlements,
    repos:{ profiles, vehicles, builds, projects, analyses },
    /* Development-only: present only when the development adapter is active. */
    get dev(){ return adapter.isDevelopment ? { setPlan:async plan=>{ await adapter.devTools.setPlan(requireUser().id,plan); return entitlements.refresh(); },
      reset:async()=>{ await adapter.devTools.reset(); auth.user=null; await entitlements.refresh(); emit('data',{table:'*'}); } } : null; } };
  GHP.services = services;
})();
