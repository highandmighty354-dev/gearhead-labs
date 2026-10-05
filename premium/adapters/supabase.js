/* Gearhead Labs Premium — PRODUCTION adapter (Supabase Auth + PostgreSQL + RLS).
   Same contract as the development adapter. Uses only the public anon key;
   every query is constrained server-side by the Row Level Security policies in
   supabase/migrations/0001_premium_schema.sql. The client can READ its own
   entitlement but can never write one — entitlements are written by the
   backend (e.g. a future Stripe webhook running with the service role).
   Not exercised yet: it activates only once GHP_CONFIG.backend is filled in. */
(function(){
  'use strict';
  const GHP = window.GHP = window.GHP || {};
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

  function loadSdk(){
    if(window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
    return new Promise((ok,fail)=>{
      const s=document.createElement('script'); s.src=SDK_URL; s.async=true;
      s.onload=()=>window.supabase?ok(window.supabase):fail(new Error('Supabase SDK failed to initialise.'));
      s.onerror=()=>fail(new Error('Could not load the Supabase SDK.'));
      document.head.appendChild(s);
    });
  }
  function toUser(u){
    if(!u) return null;
    const m=u.user_metadata||{};
    return { id:u.id, email:u.email, display_name:m.display_name||m.full_name||null, avatar_url:m.avatar_url||null,
      created_at:u.created_at, updated_at:u.updated_at||u.created_at };
  }
  function check({data,error}){ if(error) throw new Error(error.message||'Backend request failed.'); return data; }

  async function create(config){
    const sdk=await loadSdk();
    const client=sdk.createClient(config.url, config.anonKey, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });

    const auth = {
      async getUser(){ const {data}=await client.auth.getSession(); return toUser(data.session&&data.session.user); },
      /* Passwordless email sign-in (magic link). Returns {pendingVerification:true}. */
      async signIn({email}){
        check(await client.auth.signInWithOtp({ email, options:{ emailRedirectTo: location.origin+location.pathname } }));
        return { pendingVerification:true };
      },
      async signOut(){ check(await client.auth.signOut()); return true; },
      onChange(cb){ const {data}=client.auth.onAuthStateChange((_e,session)=>cb(toUser(session&&session.user))); return ()=>data.subscription.unsubscribe(); }
    };

    const entitlements = {
      async getForUser(userId){ return check(await client.from('entitlements').select('*').eq('user_id',userId).maybeSingle()); }
    };

    const db = {
      async list(table, filter={}){ return check(await client.from(table).select('*').match(filter).order('updated_at',{ascending:false})); },
      async get(table, id){ return check(await client.from(table).select('*').eq('id',id).maybeSingle()); },
      async insert(table, row){ return check(await client.from(table).insert(row).select().single()); },
      async update(table, id, patch){ return check(await client.from(table).update(patch).eq('id',id).select().single()); },
      async remove(table, id){ check(await client.from(table).delete().eq('id',id)); return true; }
    };

    return { kind:'supabase', isDevelopment:false, capabilities:{ foreignKeyCascade:true, magicLink:true }, auth, entitlements, db };
  }

  GHP.adapters = GHP.adapters || {};
  GHP.adapters.supabase = { create };
})();
