(function(){'use strict';
  const cfg=window.GH_SUPABASE_CONFIG;
  if(!cfg||!cfg.url||!cfg.publishableKey){console.warn('Gearhead Labs: Supabase configuration not present yet.');return;}
  function start(){
    try{
      if(!window.supabase||typeof window.supabase.createClient!=='function'){
        console.warn('Gearhead Labs: Supabase client library unavailable.');return;
      }
      window.GH_SUPABASE=window.supabase.createClient(cfg.url,cfg.publishableKey,{
        auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}
      });
      window.GH_SUPABASE_READY=true;
      window.GH_SUPABASE.auth.getSession().then(function(r){
        if(r.error) console.warn('Gearhead Labs: Supabase auth check:',r.error.message);
        else console.info('Gearhead Labs: Supabase connected.');
      }).catch(function(e){console.warn('Gearhead Labs: Supabase connection check failed:',e);});
    }catch(e){console.error('Gearhead Labs: Supabase initialization failed.',e);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();