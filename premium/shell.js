/* Gearhead Labs Premium — product shell: navigation, router, views, gating.
   Wraps the F1.12.3 calculator engine (the #app frame) without modifying it.
   Views read and write data only through GHP.services; access is decided only
   by GHP.services.entitlements. */
(function(){
  'use strict';
  const GHP = window.GHP, M = GHP.models, S = GHP.services, E = GHP.engineering;
  const R = S.repos;

  /* ---------- helpers ---------- */
  const esc = v => String(v==null?'':v).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const opt = (values, sel, blank) => (blank!==undefined?`<option value="">${esc(blank)}</option>`:'')+values.map(v=>{ const [val,lab]=Array.isArray(v)?v:[v,v]; return `<option value="${esc(val)}"${String(val)===String(sel??'')?' selected':''}>${esc(lab)}</option>`; }).join('');
  const date = d => d ? new Date(d).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}) : '';
  const vehicleName = v => v ? [v.year,v.make,v.model,v.trim].filter(Boolean).join(' ') : '';
  const analyzerMeta = id => M.ENGINEERING_CATALOG.find(a=>a.id===id);
  const ICON = {
    home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    calculators:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h2M12 18h4"/>',
    lab:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/>',
    garage:'<path d="M3 21V9l9-6 9 6v12"/><path d="M7 21v-7h10v7M7 17h10"/>',
    projects:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/>',
    profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
  };
  const icon = (n,cls='') => `<svg class="ghp-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
  const NAV = [
    { id:'home', label:'Home', short:'Home' },
    { id:'calculators', label:'Calculators', short:'Calcs' },
    { id:'lab', label:'Engineering Lab', short:'Lab', feature:'engineering_lab' },
    { id:'garage', label:'My Garage', short:'Garage', feature:'garage' },
    { id:'projects', label:'Projects', short:'Projects', feature:'projects' },
    { id:'profile', label:'Profile', short:'Profile' }
  ];
  const VIEWS = ['home','calculators','lab','run','garage','projects','profile'];

  /* ---------- DOM scaffold ---------- */
  const nav = document.createElement('nav'); nav.id='ghp-nav'; nav.setAttribute('aria-label','Gearhead Labs');
  const runbar = document.createElement('div'); runbar.id='ghp-runbar'; runbar.hidden=true;
  const view = document.createElement('main'); view.id='ghp-view'; view.hidden=true; view.tabIndex=-1;
  const sheet = document.createElement('div'); sheet.id='ghp-sheet'; sheet.hidden=true; sheet.setAttribute('role','dialog'); sheet.setAttribute('aria-modal','true');
  const toast = document.createElement('div'); toast.id='ghp-toast'; toast.setAttribute('role','status'); toast.setAttribute('aria-live','polite');
  document.body.append(nav, runbar, view, sheet, toast);
  let toastTimer;
  const say = (msg, bad=false) => { toast.textContent=msg; toast.className=bad?'show bad':'show'; clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.className='',3200); };

  /* ---------- router ---------- */
  let state = { view:'calculators' };
  function parse(){
    const p=new URLSearchParams(location.search), calc=p.get('calc');
    let v=p.get('view');
    if(!v && calc && M.ANALYZER_IDS.has(calc)) v='run'; // deep link to a Premium analyzer
    if(!VIEWS.includes(v)) v='calculators';
    return { view:v, vehicle:p.get('vehicle'), project:p.get('project'), edit:p.get('edit'), build:p.get('build'),
      analyzer:p.get('analyzer')||(M.ANALYZER_IDS.has(calc)?calc:null), analysis:p.get('analysis') };
  }
  function go(v, params={}, replace=false){
    const q=new URLSearchParams();
    if(v!=='calculators') q.set('view',v);
    Object.entries(params).forEach(([k,val])=>{ if(val) q.set(k,val); });
    if(v==='run' && params.analyzer) q.set('calc',params.analyzer); // keeps app-shell's frame sync on the analyzer
    history[replace?'replaceState':'pushState'](null,'',location.pathname+(q.toString()?'?'+q:''));
    route();
  }
  window.addEventListener('popstate', route);

  function setMode(mode){
    document.body.classList.toggle('ghp-mode-premium', mode==='premium');
    document.body.classList.toggle('ghp-mode-run', mode==='run');
    document.body.classList.toggle('ghp-mode-calculators', mode==='calculators');
    view.hidden = mode!=='premium'; runbar.hidden = mode!=='run';
    if(mode!=='run') closeSheet();
  }

  async function route(){
    const prev=state.view; state=parse();
    renderNav();
    if(state.view==='calculators'){ setMode('calculators'); return; }
    if(state.view==='run'){
      if(!S.entitlements.has('engineering_lab')){ setMode('premium'); return paint(teaser('lab'), prev!==state.view); }
      setMode('run'); return renderRun();
    }
    setMode('premium');
    paint('<div class="ghp-loading">Loading…</div>', prev!==state.view);
    try { paint(await VIEW_RENDER[state.view](), false); }
    catch(e){ console.error(e); paint(`<section class="ghp-page"><div class="ghp-card ghp-error">${esc(e.message)}</div></section>`, false); }
  }
  function paint(html, toTop){ view.innerHTML=html; if(toTop) view.scrollTop=0; }

  /* ---------- navigation ---------- */
  function renderNav(){
    const ent=S.entitlements.state, active=state.view==='run'?'lab':state.view;
    const plan=ent.plan==='PREMIUM_TRIAL'?'TRIAL':ent.plan;
    nav.innerHTML=`<button class="ghp-brand" data-go="home" aria-label="Gearhead Labs home"><b>GEARHEAD</b> LABS</button>
      <div class="ghp-nav-items">${NAV.map(n=>{ const locked=n.feature && !S.entitlements.has(n.feature);
        return `<button class="ghp-nav-item${active===n.id?' active':''}" data-go="${n.id}"${active===n.id?' aria-current="page"':''}>${icon(n.id)}<span class="ghp-nav-long">${n.label}</span><span class="ghp-nav-short">${n.short}</span>${locked?icon('lock','ghp-nav-lock'):''}</button>`; }).join('')}</div>
      <div class="ghp-nav-status">${S.mode==='development'?'<span class="ghp-dev-pill" title="Development adapter: mock data and mock entitlement in this browser only">DEV</span>':''}<span class="ghp-plan-pill ${ent.isPremium?'premium':''}">${esc(plan)}</span></div>`;
  }
  nav.addEventListener('click', e=>{ const b=e.target.closest('[data-go]'); if(b) go(b.dataset.go); });

  /* ---------- shared fragments ---------- */
  const page = (title, kicker, body, actions='') => `<section class="ghp-page"><header class="ghp-page-head"><div><div class="ghp-kicker">${kicker}</div><h1>${title}</h1></div>${actions}</header>${body}</section>`;
  function upgradeCTA(){
    const signedIn=!!S.auth.user;
    if(S.mode==='development') return signedIn
      ? `<div class="ghp-cta-row"><button class="ghp-btn gold" data-action="dev-plan" data-plan="PREMIUM_TRIAL">Start development trial (mock)</button><button class="ghp-btn" data-action="dev-plan" data-plan="PREMIUM">Enable development Premium (mock)</button></div><p class="ghp-fine">Development mode: this is a mock entitlement stored in this browser, not a subscription.</p>`
      : `<div class="ghp-cta-row"><button class="ghp-btn gold" data-go="profile">Sign in to try Premium (development)</button></div>`;
    return `<div class="ghp-cta-row"><button class="ghp-btn gold" disabled>Premium is coming soon</button></div><p class="ghp-fine">Premium subscriptions are not open yet. All 606 calculators remain free.</p>`;
  }
  function teaser(kind){
    const T={ lab:['Engineering Lab','Fourteen professional analyzers for turbo matching, two-stroke porting, valvetrain dynamics, chassis, driveline and thermal systems — with saved analyses tied to your vehicles and builds.'],
      garage:['My Garage','Keep every vehicle and build in one place, with build goals and notes, and link engineering analyses to the exact build they belong to.'],
      projects:['Projects','Organise engineering work into projects for a vehicle or build, and keep analyses, decisions and notes together.'] }[kind];
    const list = kind==='lab' ? `<div class="ghp-teaser-list">${M.ENGINEERING_CATEGORIES.map(c=>`<div><h3>${c}</h3>${M.ENGINEERING_CATALOG.filter(a=>a.category===c).map(a=>`<p>${icon('lock','ghp-inline-lock')} <b>${a.code}</b> ${esc(a.name)}</p>`).join('')}</div>`).join('')}</div>` : '';
    return page(T[0],'PREMIUM',`<div class="ghp-card ghp-teaser"><span class="ghp-badge gold">PREMIUM</span><p class="ghp-lede">${T[1]}</p>${list}${upgradeCTA()}<p class="ghp-fine">The 606 free calculators stay free, with no account required. <button class="ghp-link" data-go="calculators">Open calculators →</button></p></div>`);
  }
  function signInCard(){
    if(S.mode==='no-backend') return `<div class="ghp-card"><h2>Accounts are coming soon</h2><p>Gearhead Labs accounts are not available yet. Every calculator works without an account.</p><button class="ghp-btn" data-go="calculators">Open calculators</button></div>`;
    const dev=S.mode==='development';
    return `<div class="ghp-card"><h2>Sign in</h2>${dev?'<p class="ghp-fine ghp-warn">Development mode: mock sign-in, no password. Data stays in this browser.</p>':'<p>We\'ll email you a secure sign-in link.</p>'}
      <form data-form="signin" class="ghp-form" novalidate><label>Email<input name="email" type="email" autocomplete="email" inputmode="email" required></label><button class="ghp-btn gold" type="submit">${dev?'Sign in (development)':'Email me a sign-in link'}</button></form></div>`;
  }
  const field = (label, html, hint='') => `<label>${label}${html}${hint?`<small>${hint}</small>`:''}</label>`;
  const formErrors = () => '<div class="ghp-form-error" hidden></div>';

  /* ---------- views ---------- */
  const VIEW_RENDER = {
    async home(){
      const ent=S.entitlements.state, u=S.auth.user, prem=ent.isPremium;
      let counts={ vehicles:0, projects:0, analyses:0 }, recent=[];
      if(prem){ const [v,p,a]=await Promise.all([R.vehicles.list(),R.projects.list(),R.analyses.list()]); counts={ vehicles:v.length, projects:p.length, analyses:a.length }; recent=a.slice(0,4); }
      const free=freeCount();
      const tile=(id,title,stat,desc,feature)=>{ const locked=feature&&!S.entitlements.has(feature);
        return `<button class="ghp-tile${locked?' locked':''}" data-go="${id}"><div class="ghp-tile-top"><span>${locked?icon('lock','ghp-inline-lock')+' PREMIUM':feature?'PREMIUM':'FREE'}</span><b>${stat}</b></div><h3>${title}</h3><p>${desc}</p></button>`; };
      return `<section class="ghp-page"><div class="ghp-hero"><div class="ghp-kicker">GEARHEAD LABS / THE SCIENCE OF SPEED</div><h1>${u?`Welcome back, ${esc(u.display_name||u.email)}`:'The Automotive Math Encyclopedia'}</h1>
        <p class="ghp-lede">${prem?'Your Premium workshop: garage, builds, engineering analyses and projects.':'606 free calculators, no account needed. Premium adds the Engineering Lab, My Garage and saved projects.'}</p>
        <div class="ghp-plan-line"><span class="ghp-plan-pill ${prem?'premium':''}">${esc(ent.plan.replace('_',' '))}</span>${ent.source==='development'?'<span class="ghp-dev-pill">DEVELOPMENT ENTITLEMENT</span>':''}${u?`<span class="ghp-muted">${esc(u.email)}</span>`:`<button class="ghp-link" data-go="profile">${S.mode==='no-backend'?'About accounts':'Sign in'}</button>`}</div></div>
        <div class="ghp-tiles">${tile('calculators','Free Calculators',free,'Every free automotive calculator, ready to use.')}${tile('lab','Engineering Lab','14','Turbo, two-stroke, valvetrain, chassis, driveline and thermal analyzers.','engineering_lab')}${tile('garage','My Garage',prem?counts.vehicles:'—','Vehicles, builds and components.','garage')}${tile('projects','Projects',prem?counts.projects:'—','Engineering work organised by vehicle and build.','projects')}</div>
        ${prem?`<div class="ghp-card"><h2>Recent analyses <span class="ghp-muted">(${counts.analyses})</span></h2>${recent.length?recent.map(a=>analysisRow(a)).join(''):'<p class="ghp-muted">No saved analyses yet. Open the Engineering Lab to run one.</p>'}</div>`:`<div class="ghp-card ghp-teaser"><h2>Go Premium</h2><p>Unlock the Engineering Lab, My Garage and saved engineering projects.</p>${upgradeCTA()}</div>`}
      </section>`;
    },

    async profile(){
      const u=S.auth.user;
      if(!u) return page('Profile','ACCOUNT',signInCard());
      const p=await R.profiles.getMine()||{}, ent=S.entitlements.state, garage=S.entitlements.has('garage');
      const vs=garage?await R.vehicles.list():[], bs=garage?await R.builds.list():[];
      const initials=(p.display_name||u.email).split(/[\s@._-]+/).filter(Boolean).slice(0,2).map(s=>s[0].toUpperCase()).join('');
      const avatar=p.avatar_url?`<img class="ghp-avatar" src="${esc(p.avatar_url)}" alt="" referrerpolicy="no-referrer">`:`<div class="ghp-avatar">${esc(initials)}</div>`;
      const dev=S.dev?`<div class="ghp-card ghp-devpanel"><h2>Development tools</h2><p class="ghp-fine ghp-warn">Mock entitlement for testing the Premium UI. It is not a subscription and is never used in production.</p>
          <div class="ghp-cta-row">${['FREE','PREMIUM_TRIAL','PREMIUM'].map(pl=>`<button class="ghp-btn${ent.plan===pl?' gold':''}" data-action="dev-plan" data-plan="${pl}">${pl.replace('_',' ')}</button>`).join('')}</div>
          <button class="ghp-btn danger" data-action="dev-reset">Reset development data</button></div>`:'';
      return page('Profile','ACCOUNT',`<div class="ghp-card ghp-profile-head">${avatar}<div><h2>${esc(p.display_name||u.email)}</h2><p class="ghp-muted">${esc(u.email)} · Member since ${date(u.created_at)}</p></div></div>
        <form data-form="profile" class="ghp-card ghp-form" novalidate><h2>Your details</h2>${formErrors()}
          ${field('Display name',`<input name="display_name" maxlength="80" value="${esc(p.display_name)}" autocomplete="nickname">`)}
          ${field('Email',`<input value="${esc(u.email)}" disabled>`,'Managed by your sign-in.')}
          ${field('Avatar image URL',`<input name="avatar_url" type="url" inputmode="url" placeholder="https://" value="${esc(p.avatar_url)}">`,'Optional. https:// links only.')}
          ${field('Location',`<input name="location" maxlength="80" placeholder="City or region (optional)" value="${esc(p.location)}">`)}
          ${field('Experience level',`<select name="experience_level">${opt(M.EXPERIENCE_LEVELS,p.experience_level,'Not set')}</select>`)}
          ${field('Preferred unit system',`<select name="preferred_unit_system">${opt([['imperial','Imperial'],['metric','Metric']],p.preferred_unit_system||'imperial')}</select>`,'Saved to your profile. Calculators currently follow the calculator unit setting.')}
          ${garage?field('Favorite vehicle',`<select name="favorite_vehicle_id">${opt(vs.map(v=>[v.id,vehicleName(v)]),p.favorite_vehicle_id,'None')}</select>`)+field('Favorite build',`<select name="favorite_build_id">${opt(bs.map(b=>[b.id,b.name+' — '+vehicleName(vs.find(v=>v.id===b.vehicle_id))]),p.favorite_build_id,'None')}</select>`):'<p class="ghp-fine">Favorite vehicle and build are available with My Garage (Premium).</p>'}
          <button class="ghp-btn gold" type="submit">Save profile</button></form>
        <div class="ghp-card"><h2>Plan</h2><dl class="ghp-dl"><dt>Plan</dt><dd>${esc(ent.plan.replace('_',' '))}</dd><dt>Status</dt><dd>${esc(ent.status)}</dd><dt>Source</dt><dd>${esc(ent.source)}</dd>${ent.expires_at?`<dt>Expires</dt><dd>${date(ent.expires_at)}</dd>`:''}</dl>${ent.isPremium?'':upgradeCTA()}</div>
        ${dev}<button class="ghp-btn wide" data-action="signout">Sign out</button>`);
    },

    async garage(){
      if(!S.entitlements.has('garage')) return teaser('garage');
      if(state.edit) return vehicleForm(state.edit==='new'?null:await R.vehicles.get(state.edit));
      if(state.vehicle) return vehicleDetail(state.vehicle);
      const vs=await R.vehicles.list();
      vs.sort((a,b)=>(b.is_primary-a.is_primary));
      return page('My Garage','PREMIUM',vs.length?`<div class="ghp-list">${vs.map(v=>`<article class="ghp-card ghp-vehicle"><div class="ghp-row-top"><h2>${esc(vehicleName(v))}</h2>${v.is_primary?'<span class="ghp-badge gold">PRIMARY</span>':''}</div>
          <p class="ghp-chips">${[v.vehicle_type,v.engine,v.fuel_type,v.drivetrain,v.transmission].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('')}</p>
          <div class="ghp-actions"><button class="ghp-btn" data-go-vehicle="${esc(v.id)}">View</button><button class="ghp-btn" data-edit-vehicle="${esc(v.id)}">Edit</button>${v.is_primary?'':`<button class="ghp-btn" data-action="primary" data-id="${esc(v.id)}">Make primary</button>`}<button class="ghp-btn danger" data-action="delete-vehicle" data-id="${esc(v.id)}">Delete</button></div></article>`).join('')}</div>`
        :`<div class="ghp-card ghp-empty"><h2>Your garage is empty</h2><p>Add your first vehicle to start tracking builds and engineering analyses.</p></div>`,
        `<button class="ghp-btn gold" data-edit-vehicle="new">+ Add vehicle</button>`);
    },

    async lab(){
      if(!S.entitlements.has('engineering_lab')) return teaser('lab');
      const [saved, vs, bs, ps]=await Promise.all([R.analyses.list(),R.vehicles.list(),R.builds.list(),R.projects.list()]);
      const names={ v:Object.fromEntries(vs.map(v=>[v.id,vehicleName(v)])), b:Object.fromEntries(bs.map(b=>[b.id,b.name])), p:Object.fromEntries(ps.map(p=>[p.id,p.name])) };
      return page('Engineering Lab','PREMIUM · 14 ANALYZERS',`
        <div class="ghp-card ghp-lab-tools"><input id="ghp-lab-search" type="search" placeholder="Search analyzers" aria-label="Search analyzers" autocomplete="off">
          <div class="ghp-filter" role="group" aria-label="Category">${['All',...M.ENGINEERING_CATEGORIES].map((c,i)=>`<button class="ghp-chip${i?'':' active'}" data-cat="${c}">${c}</button>`).join('')}</div>
          <p class="ghp-fine">Analyzers use the calculator's current unit setting (${E.unitSystem()==='metric'?'Metric':'Imperial'}).</p></div>
        <div class="ghp-analyzers" id="ghp-analyzers">${M.ENGINEERING_CATALOG.map(a=>`<button class="ghp-card ghp-analyzer" data-analyzer="${a.id}" data-category="${a.category}" data-search="${esc((a.code+' '+a.name+' '+a.category).toLowerCase())}"><span class="ghp-code">${a.code}</span><span class="ghp-aname">${esc(a.name)}</span><span class="ghp-acat">${a.category}</span></button>`).join('')}</div>
        <p class="ghp-muted ghp-noresults" id="ghp-lab-empty" hidden>No analyzers match.</p>
        <div class="ghp-card"><h2>Saved analyses <span class="ghp-muted">(${saved.length})</span></h2>${saved.length?saved.map(a=>analysisRow(a,names,true)).join(''):'<p class="ghp-muted">Run an analyzer and tap “Save analysis” to keep its inputs and results.</p>'}</div>`);
    },

    async projects(){
      if(!S.entitlements.has('projects')) return teaser('projects');
      if(state.edit) return projectForm(state.edit==='new'?null:await R.projects.get(state.edit));
      if(state.project) return projectDetail(state.project);
      const [ps,vs,bs]=await Promise.all([R.projects.list(),R.vehicles.list(),R.builds.list()]);
      return page('Projects','PREMIUM',ps.length?`<div class="ghp-list">${ps.map(p=>`<article class="ghp-card"><div class="ghp-row-top"><h2>${esc(p.name)}</h2><span class="ghp-badge">${esc(p.status)}</span></div>
          <p class="ghp-muted">${esc([vehicleName(vs.find(v=>v.id===p.vehicle_id)), (bs.find(b=>b.id===p.build_id)||{}).name].filter(Boolean).join(' · ')||'No vehicle linked')}</p>${p.description?`<p>${esc(p.description)}</p>`:''}
          <div class="ghp-actions"><button class="ghp-btn" data-go-project="${esc(p.id)}">Open</button><button class="ghp-btn" data-edit-project="${esc(p.id)}">Edit</button><button class="ghp-btn danger" data-action="delete-project" data-id="${esc(p.id)}">Delete</button></div></article>`).join('')}</div>`
        :`<div class="ghp-card ghp-empty"><h2>No projects yet</h2><p>Create a project to organise engineering work for a vehicle or build.</p></div>`,
        `<button class="ghp-btn gold" data-edit-project="new">+ New project</button>`);
    }
  };

  function freeCount(){ try { const w=window.GHShell.frame.contentWindow; const n=w.eval("CALCS.filter(c=>c.id!=='dashboard'&&c.layer!=='engineering').length"); return n||606; } catch(e){ return 606; } }

  function analysisRow(a, names, actions){
    const m=analyzerMeta(a.analyzer_id)||{ code:'?', name:a.analyzer_id };
    const links=names?[names.v[a.vehicle_id],names.b[a.build_id],names.p[a.project_id]].filter(Boolean).join(' · '):'';
    return `<div class="ghp-analysis"><div><b>${esc(a.name)}</b><small><span class="ghp-code">${m.code}</span> ${esc(m.name)}${links?' · '+esc(links):''} · ${date(a.updated_at)}</small></div>
      <div class="ghp-actions"><button class="ghp-btn" data-load-analysis="${esc(a.id)}">Load</button>${actions?`<button class="ghp-btn danger" data-action="delete-analysis" data-id="${esc(a.id)}">Delete</button>`:''}</div></div>`;
  }

  function vehicleForm(v){
    const x=v||{ vehicle_type:'Car', fuel_type:'Gasoline' };
    return page(v?'Edit vehicle':'Add vehicle','MY GARAGE',`<form data-form="vehicle" class="ghp-card ghp-form" data-id="${esc(v?v.id:'')}" novalidate>${formErrors()}
      <div class="ghp-grid2">${field('Year *',`<input name="year" inputmode="numeric" maxlength="4" value="${esc(x.year)}" required>`)}${field('Vehicle type *',`<select name="vehicle_type">${opt(M.VEHICLE_TYPES,x.vehicle_type)}</select>`)}</div>
      <div class="ghp-grid2">${field('Make *',`<input name="make" maxlength="60" value="${esc(x.make)}" required>`)}${field('Model *',`<input name="model" maxlength="60" value="${esc(x.model)}" required>`)}</div>
      <div class="ghp-grid2">${field('Trim',`<input name="trim" maxlength="60" value="${esc(x.trim)}">`)}${field('Engine',`<input name="engine" maxlength="80" placeholder="e.g. 5.0L Coyote V8" value="${esc(x.engine)}">`)}</div>
      <div class="ghp-grid3">${field('Fuel',`<select name="fuel_type">${opt(M.FUEL_TYPES,x.fuel_type,'—')}</select>`)}${field('Transmission',`<select name="transmission">${opt(M.TRANSMISSIONS,x.transmission,'—')}</select>`)}${field('Drivetrain',`<select name="drivetrain">${opt(M.DRIVETRAINS,x.drivetrain,'—')}</select>`)}</div>
      ${field('Notes',`<textarea name="notes" rows="4" maxlength="2000">${esc(x.notes)}</textarea>`)}
      <label class="ghp-check"><input type="checkbox" name="is_primary"${x.is_primary?' checked':''}> Primary vehicle</label>
      <div class="ghp-actions"><button class="ghp-btn gold" type="submit">${v?'Save changes':'Add vehicle'}</button><button class="ghp-btn" type="button" data-cancel>Cancel</button></div></form>`);
  }

  async function vehicleDetail(id){
    const v=await R.vehicles.get(id);
    const [bs,an,ps]=await Promise.all([R.builds.list(id),R.analyses.list({ vehicle_id:id }),R.projects.list()]);
    const editing=state.build;
    const buildForm=b=>{ const x=b||{ status:'Stock' }; return `<form data-form="build" class="ghp-card ghp-form ghp-inset" data-id="${esc(b?b.id:'')}" novalidate><h3>${b?'Edit build':'New build'}</h3>${formErrors()}
        <input type="hidden" name="vehicle_id" value="${esc(id)}">
        <div class="ghp-grid2">${field('Build name *',`<input name="name" maxlength="80" value="${esc(x.name)}" required>`)}${field('Status *',`<select name="status">${opt(M.BUILD_STATUSES,x.status)}</select>`)}</div>
        ${field('Description',`<input name="description" maxlength="500" value="${esc(x.description)}">`)}${field('Goals',`<textarea name="goals" rows="3" maxlength="1000">${esc(x.goals)}</textarea>`)}${field('Notes',`<textarea name="notes" rows="3" maxlength="2000">${esc(x.notes)}</textarea>`)}
        <div class="ghp-actions"><button class="ghp-btn gold" type="submit">${b?'Save build':'Add build'}</button><button class="ghp-btn" type="button" data-cancel-build>Cancel</button></div></form>`; };
    const specs=[['Type',v.vehicle_type],['Engine',v.engine],['Fuel',v.fuel_type],['Transmission',v.transmission],['Drivetrain',v.drivetrain]].filter(r=>r[1]);
    return page(esc(vehicleName(v)),'MY GARAGE',`<button class="ghp-link ghp-back" data-go="garage">← All vehicles</button>
      <div class="ghp-card"><div class="ghp-row-top"><h2>Vehicle</h2>${v.is_primary?'<span class="ghp-badge gold">PRIMARY</span>':''}</div><dl class="ghp-dl">${specs.map(([k,x])=>`<dt>${k}</dt><dd>${esc(x)}</dd>`).join('')}</dl>${v.notes?`<p class="ghp-notes">${esc(v.notes)}</p>`:''}
        <div class="ghp-actions"><button class="ghp-btn" data-edit-vehicle="${esc(v.id)}">Edit vehicle</button>${v.is_primary?'':`<button class="ghp-btn" data-action="primary" data-id="${esc(v.id)}">Make primary</button>`}</div></div>
      <div class="ghp-card"><div class="ghp-row-top"><h2>Builds <span class="ghp-muted">(${bs.length})</span></h2>${editing?'':'<button class="ghp-btn gold" data-new-build>+ Add build</button>'}</div>
        ${editing==='new'?buildForm(null):''}
        ${bs.map(b=>editing===b.id?buildForm(b):`<article class="ghp-build"><div class="ghp-row-top"><h3>${esc(b.name)}</h3><span class="ghp-badge">${esc(b.status)}</span></div>${b.description?`<p>${esc(b.description)}</p>`:''}${b.goals?`<p class="ghp-muted"><b>Goals:</b> ${esc(b.goals)}</p>`:''}
          <div class="ghp-actions"><button class="ghp-btn" data-edit-build="${esc(b.id)}">Edit</button><button class="ghp-btn danger" data-action="delete-build" data-id="${esc(b.id)}">Delete</button></div></article>`).join('')||(editing?'':'<p class="ghp-muted">No builds yet.</p>')}</div>
      <div class="ghp-card"><h2>Engineering analyses <span class="ghp-muted">(${an.length})</span></h2>${an.length?an.map(a=>analysisRow(a)).join(''):'<p class="ghp-muted">None linked to this vehicle yet.</p>'}</div>
      <div class="ghp-card"><h2>Projects</h2>${ps.filter(p=>p.vehicle_id===id).map(p=>`<p><button class="ghp-link" data-go-project="${esc(p.id)}">${esc(p.name)}</button> <span class="ghp-badge">${esc(p.status)}</span></p>`).join('')||'<p class="ghp-muted">No projects for this vehicle.</p>'}</div>
      <button class="ghp-btn danger wide" data-action="delete-vehicle" data-id="${esc(v.id)}">Delete vehicle</button>`);
  }

  async function projectForm(p){
    const [vs,bs]=await Promise.all([R.vehicles.list(),R.builds.list()]), x=p||{ status:'Planning' };
    return page(p?'Edit project':'New project','PROJECTS',`<form data-form="project" class="ghp-card ghp-form" data-id="${esc(p?p.id:'')}" novalidate>${formErrors()}
      ${field('Project name *',`<input name="name" maxlength="80" value="${esc(x.name)}" required>`)}${field('Description',`<textarea name="description" rows="3" maxlength="1000">${esc(x.description)}</textarea>`)}
      <div class="ghp-grid3">${field('Status *',`<select name="status">${opt(M.PROJECT_STATUSES,x.status)}</select>`)}${field('Vehicle',`<select name="vehicle_id">${opt(vs.map(v=>[v.id,vehicleName(v)]),x.vehicle_id,'None')}</select>`)}${field('Build',`<select name="build_id">${opt(bs.map(b=>[b.id,b.name+' — '+vehicleName(vs.find(v=>v.id===b.vehicle_id))]),x.build_id,'None')}</select>`)}</div>
      <div class="ghp-actions"><button class="ghp-btn gold" type="submit">${p?'Save project':'Create project'}</button><button class="ghp-btn" type="button" data-cancel>Cancel</button></div></form>`);
  }
  async function projectDetail(id){
    const p=await R.projects.get(id);
    const [vs,bs,an]=await Promise.all([R.vehicles.list(),R.builds.list(),R.analyses.list({ project_id:id })]);
    const v=vs.find(x=>x.id===p.vehicle_id), b=bs.find(x=>x.id===p.build_id);
    return page(esc(p.name),'PROJECT',`<button class="ghp-link ghp-back" data-go="projects">← All projects</button>
      <div class="ghp-card"><div class="ghp-row-top"><h2>Overview</h2><span class="ghp-badge">${esc(p.status)}</span></div>${p.description?`<p>${esc(p.description)}</p>`:''}
        <dl class="ghp-dl"><dt>Vehicle</dt><dd>${v?`<button class="ghp-link" data-go-vehicle="${esc(v.id)}">${esc(vehicleName(v))}</button>`:'—'}</dd><dt>Build</dt><dd>${b?esc(b.name):'—'}</dd><dt>Updated</dt><dd>${date(p.updated_at)}</dd></dl>
        <div class="ghp-actions"><button class="ghp-btn" data-edit-project="${esc(p.id)}">Edit</button><button class="ghp-btn" data-go="lab">Open Engineering Lab</button><button class="ghp-btn danger" data-action="delete-project" data-id="${esc(p.id)}">Delete</button></div></div>
      <div class="ghp-card"><h2>Engineering analyses <span class="ghp-muted">(${an.length})</span></h2>${an.length?an.map(a=>analysisRow(a)).join(''):'<p class="ghp-muted">Save an analysis from the Engineering Lab and choose this project to link it here.</p>'}</div>`);
  }

  /* ---------- run mode (analyzer open in the engine frame) ---------- */
  let loaded=null; // analysis currently loaded into the analyzer, if any
  async function renderRun(){
    const m=analyzerMeta(state.analyzer);
    if(!m){ return go('lab',{},true); }
    runbar.innerHTML=`<button class="ghp-btn" data-go="lab">← Lab</button><div class="ghp-run-title"><span class="ghp-code">${m.code}</span> ${esc(m.name)}</div><button class="ghp-btn gold" data-action="save-sheet">Save analysis</button>`;
    try {
      if(state.analysis){ loaded=await R.analyses.get(state.analysis); await E.restore(loaded); say('Loaded “'+loaded.name+'”'); }
      else { loaded=null; await E.open(m.id); }
    } catch(e){ say(e.message,true); }
  }
  runbar.addEventListener('click', e=>{ const b=e.target.closest('[data-go]'); if(b) return go(b.dataset.go); if(e.target.closest('[data-action="save-sheet"]')) openSaveSheet(); });

  async function openSaveSheet(){
    const m=analyzerMeta(E.currentAnalyzer()||state.analyzer);
    const [vs,bs,ps]=await Promise.all([R.vehicles.list(),R.builds.list(),R.projects.list()]);
    const x=loaded||{ name:m.name+' — '+new Date().toLocaleDateString() };
    sheet.innerHTML=`<div class="ghp-sheet-panel"><form data-form="analysis" class="ghp-form" novalidate><div class="ghp-row-top"><h2>Save analysis</h2><button class="ghp-btn" type="button" data-close-sheet aria-label="Close">✕</button></div>
      <p class="ghp-fine">Saves the analyzer inputs as structured data and the current results. <span class="ghp-code">${m.code}</span> ${esc(m.name)}</p>${formErrors()}
      ${field('Name *',`<input name="name" maxlength="120" value="${esc(x.name)}" required>`)}
      ${field('Vehicle',`<select name="vehicle_id">${opt(vs.map(v=>[v.id,vehicleName(v)]),x.vehicle_id,'None')}</select>`)}
      ${field('Build',`<select name="build_id">${opt(bs.map(b=>[b.id,b.name+' — '+vehicleName(vs.find(v=>v.id===b.vehicle_id))]),x.build_id,'None')}</select>`)}
      ${field('Project',`<select name="project_id">${opt(ps.map(p=>[p.id,p.name]),x.project_id,'None')}</select>`)}
      ${field('Notes',`<textarea name="notes" rows="3" maxlength="2000">${esc(x.notes)}</textarea>`)}
      <div class="ghp-actions">${loaded?'<button class="ghp-btn gold" type="submit" name="mode" value="update">Update saved analysis</button><button class="ghp-btn" type="submit" name="mode" value="new">Save as new</button>':'<button class="ghp-btn gold" type="submit" name="mode" value="new">Save analysis</button>'}</div></form></div>`;
    sheet.hidden=false; sheet.querySelector('input[name="name"]').focus();
  }
  function closeSheet(){ sheet.hidden=true; sheet.innerHTML=''; }
  sheet.addEventListener('click', e=>{ if(e.target===sheet || e.target.closest('[data-close-sheet]')) closeSheet(); });

  /* ---------- forms ---------- */
  function formData(form){
    const data={};
    new FormData(form).forEach((v,k)=>{ data[k]=v; });
    form.querySelectorAll('input[type=checkbox][name]').forEach(c=>{ data[c.name]=c.checked; });
    return data;
  }
  function showErrors(form, err){
    const box=form.querySelector('.ghp-form-error');
    if(box){ box.hidden=false; box.textContent=err.errors?Object.values(err.errors).join(' '):err.message; box.scrollIntoView({ block:'nearest' }); }
    else say(err.message,true);
  }
  async function submit(form, submitter){
    const kind=form.dataset.form, id=form.dataset.id, data=formData(form);
    try {
      switch(kind){
        case 'signin': {
          const r=await S.auth.signIn({ email:data.email });
          if(r && r.pendingVerification) return say('Check your email for a sign-in link.');
          say('Signed in.'); return route();
        }
        case 'profile': await R.profiles.saveMine(data); say('Profile saved.'); return route();
        case 'vehicle': {
          const v=id?await R.vehicles.update(id,data):await R.vehicles.create(data);
          say(id?'Vehicle updated.':'Vehicle added.'); return go('garage',{ vehicle:v.id },true);
        }
        case 'build': { id?await R.builds.update(id,data):await R.builds.create(data); say(id?'Build updated.':'Build added.'); return go('garage',{ vehicle:data.vehicle_id },true); }
        case 'project': {
          const p=id?await R.projects.update(id,data):await R.projects.create(data);
          say(id?'Project updated.':'Project created.'); return go('projects',{ project:p.id },true);
        }
        case 'analysis': {
          const snap=E.capture(), row={ ...data, analyzer_id:snap.analyzer_id, input_data:snap.input_data, result_data:snap.result_data };
          const mode=submitter && submitter.value || 'new';
          loaded = mode==='update' && loaded ? await R.analyses.update(loaded.id,row) : await R.analyses.create(row);
          closeSheet(); say(mode==='update'?'Analysis updated.':'Analysis saved.');
          return history.replaceState(null,'',location.pathname+'?view=run&analyzer='+encodeURIComponent(loaded.analyzer_id)+'&analysis='+encodeURIComponent(loaded.id)+'&calc='+encodeURIComponent(loaded.analyzer_id));
        }
      }
    } catch(err){ showErrors(form, err); }
  }
  document.addEventListener('submit', e=>{ const f=e.target.closest('form[data-form]'); if(!f) return; e.preventDefault(); submit(f, e.submitter); });

  /* ---------- actions ---------- */
  function armed(btn){ // two-step confirm for destructive actions
    if(btn.dataset.armed){ return true; }
    btn.dataset.armed='1'; btn.dataset.label=btn.textContent; btn.textContent='Tap again to delete';
    setTimeout(()=>{ if(btn.isConnected){ delete btn.dataset.armed; btn.textContent=btn.dataset.label; } },4000);
    return false;
  }
  view.addEventListener('click', async e=>{
    const t=e.target;
    const goBtn=t.closest('[data-go]'); if(goBtn) return go(goBtn.dataset.go);
    const q=sel=>t.closest(sel);
    let b;
    if((b=q('[data-go-vehicle]'))) return go('garage',{ vehicle:b.dataset.goVehicle });
    if((b=q('[data-edit-vehicle]'))) return go('garage',{ edit:b.dataset.editVehicle });
    if((b=q('[data-go-project]'))) return go('projects',{ project:b.dataset.goProject });
    if((b=q('[data-edit-project]'))) return go('projects',{ edit:b.dataset.editProject });
    if((b=q('[data-new-build]'))) return go('garage',{ vehicle:state.vehicle, build:'new' },true);
    if((b=q('[data-edit-build]'))) return go('garage',{ vehicle:state.vehicle, build:b.dataset.editBuild },true);
    if(q('[data-cancel-build]')) return go('garage',{ vehicle:state.vehicle },true);
    if(q('[data-cancel]')){ const back=state.edit&&state.edit!=='new'?state.edit:null; return state.view==='garage'?go('garage',{ vehicle:back },true):go('projects',{ project:back },true); }
    if((b=q('[data-analyzer]'))) return go('run',{ analyzer:b.dataset.analyzer });
    if((b=q('[data-load-analysis]'))){ const a=await R.analyses.get(b.dataset.loadAnalysis); return go('run',{ analyzer:a.analyzer_id, analysis:a.id }); }
    if((b=q('[data-cat]'))){ view.querySelectorAll('[data-cat]').forEach(c=>c.classList.toggle('active',c===b)); return filterLab(); }
    if(!(b=q('[data-action]'))) return;
    const id=b.dataset.id;
    try {
      switch(b.dataset.action){
        case 'primary': await R.vehicles.setPrimary(id); say('Primary vehicle updated.'); return route();
        case 'delete-vehicle': if(!armed(b)) return; await R.vehicles.remove(id); say('Vehicle deleted.'); return go('garage',{},true);
        case 'delete-build': if(!armed(b)) return; await R.builds.remove(id); say('Build deleted.'); return route();
        case 'delete-project': if(!armed(b)) return; await R.projects.remove(id); say('Project deleted.'); return go('projects',{},true);
        case 'delete-analysis': if(!armed(b)) return; await R.analyses.remove(id); say('Analysis deleted.'); return route();
        case 'signout': await S.auth.signOut(); say('Signed out.'); return go('home',{},true);
        case 'dev-plan': if(!S.dev) return; await S.dev.setPlan(b.dataset.plan); say('Development entitlement: '+b.dataset.plan.replace('_',' ')); return route();
        case 'dev-reset': if(!S.dev || !armed(b)) return; await S.dev.reset(); say('Development data reset.'); return go('home',{},true);
      }
    } catch(err){ say(err.message,true); }
  });
  function filterLab(){
    const q=(document.getElementById('ghp-lab-search')||{}).value||'', cat=(view.querySelector('[data-cat].active')||{}).dataset;
    let shown=0;
    view.querySelectorAll('.ghp-analyzer').forEach(c=>{ const ok=(!cat||cat.cat==='All'||c.dataset.category===cat.cat)&&c.dataset.search.includes(q.trim().toLowerCase()); c.hidden=!ok; if(ok) shown++; });
    const empty=document.getElementById('ghp-lab-empty'); if(empty) empty.hidden=shown>0;
  }
  view.addEventListener('input', e=>{ if(e.target.id==='ghp-lab-search') filterLab(); });

  /* ---------- live updates ---------- */
  S.on('entitlement', ()=>route());
  S.on('auth', ()=>{ if(state.view!=='calculators') route(); else renderNav(); });

  S.ready.then(()=>{ document.body.classList.add('ghp-ready'); route(); });
  setMode('calculators'); renderNav();
  GHP.shell = { go, route, state:()=>({ ...state }) };
})();
