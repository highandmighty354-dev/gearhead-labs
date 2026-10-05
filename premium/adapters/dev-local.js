/* Gearhead Labs Premium — DEVELOPMENT adapter.
   Mock auth, mock entitlement and a local table store for building and testing
   the Premium UI without a backend. Everything lives in this browser only.
   This is the only Premium file that touches browser storage. It is never
   selected in production; see services.js for adapter selection. */
(function(){
  'use strict';
  const GHP = window.GHP = window.GHP || {};
  const KEY = 'ghp_dev_store_v1';
  const TABLES = ['profiles','vehicles','builds','projects','engineering_analyses'];

  function emptyStore(){ return { users:{}, session:null, entitlements:{}, tables:Object.fromEntries(TABLES.map(t=>[t,[]])) }; }
  let memory = null; // fallback when storage is unavailable (private mode, blocked site data)
  function load(){
    try { const raw=localStorage.getItem(KEY); if(raw){ const s=JSON.parse(raw); TABLES.forEach(t=>{ s.tables[t]=s.tables[t]||[]; }); return s; } }
    catch(e){ if(memory) return memory; }
    return memory || emptyStore();
  }
  function save(s){ memory=s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e){} }
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'dev-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));
  const now = () => new Date().toISOString();
  const tick = v => new Promise(r=>setTimeout(()=>r(v),0)); // async like a real backend
  const clone = v => JSON.parse(JSON.stringify(v));

  function create(){
    const listeners = new Set();
    const emit = () => { const u=currentUser(); listeners.forEach(cb=>{ try{cb(u);}catch(e){console.error(e);} }); };
    function currentUser(){ const s=load(); return s.session && s.users[s.session] ? clone(s.users[s.session]) : null; }

    const auth = {
      async getUser(){ return tick(currentUser()); },
      /* Mock sign-in: email only, no password. Creates the user, a profile and a
         FREE entitlement on first sign-in — mirroring the backend signup trigger. */
      async signIn({email}){
        email=String(email||'').trim().toLowerCase();
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
        const s=load();
        let user=Object.values(s.users).find(u=>u.email===email);
        if(!user){
          const t=now();
          user={ id:uuid(), email, display_name:email.split('@')[0], avatar_url:null, created_at:t, updated_at:t };
          s.users[user.id]=user;
          s.tables.profiles.push({ id:user.id, user_id:user.id, email, display_name:user.display_name, avatar_url:null, location:null,
            experience_level:null, preferred_unit_system:'imperial', favorite_vehicle_id:null, favorite_build_id:null, created_at:t, updated_at:t });
          s.entitlements[user.id]={ user_id:user.id, plan:'FREE', status:'active', started_at:t, expires_at:null, provider:'development', provider_customer_id:null };
        }
        s.session=user.id; save(s); emit(); return tick(clone(user));
      },
      async signOut(){ const s=load(); s.session=null; save(s); emit(); return tick(true); },
      onChange(cb){ listeners.add(cb); return () => listeners.delete(cb); }
    };

    const entitlements = {
      async getForUser(userId){ const s=load(); return tick(s.entitlements[userId] ? clone(s.entitlements[userId]) : null); }
    };

    /* Development-only controls. Not part of the production adapter contract. */
    const devTools = {
      async setPlan(userId, plan){
        const s=load(); if(!s.users[userId]) throw new Error('Sign in first.');
        const t=now();
        s.entitlements[userId]={ user_id:userId, plan, status:plan==='PREMIUM_TRIAL'?'trialing':'active', started_at:t,
          expires_at:plan==='PREMIUM_TRIAL'?new Date(Date.now()+14*864e5).toISOString():null, provider:'development', provider_customer_id:null };
        save(s); return tick(true);
      },
      async reset(){ save(emptyStore()); emit(); return tick(true); }
    };

    function rows(table){ if(!TABLES.includes(table)) throw new Error('Unknown table '+table); return load().tables[table]; }
    const db = {
      async list(table, filter={}){
        const out=rows(table).filter(r=>Object.entries(filter).every(([k,v])=>r[k]===v));
        return tick(clone(out).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))));
      },
      async get(table, id){ const r=rows(table).find(r=>r.id===id); return tick(r?clone(r):null); },
      async insert(table, row){
        const s=load(), t=now(), rec={ id:uuid(), ...row, created_at:t, updated_at:t };
        s.tables[table].push(rec); save(s); return tick(clone(rec));
      },
      async update(table, id, patch){
        const s=load(), i=s.tables[table].findIndex(r=>r.id===id); if(i<0) throw new Error('Record not found.');
        s.tables[table][i]={ ...s.tables[table][i], ...patch, id, updated_at:now() }; save(s); return tick(clone(s.tables[table][i]));
      },
      async remove(table, id){ const s=load(); s.tables[table]=s.tables[table].filter(r=>r.id!==id); save(s); return tick(true); }
    };

    return { kind:'development', isDevelopment:true, capabilities:{ foreignKeyCascade:false, magicLink:false }, auth, entitlements, devTools, db };
  }

  GHP.adapters = GHP.adapters || {};
  GHP.adapters.development = { create };
})();
