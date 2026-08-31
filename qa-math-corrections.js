/* Gearhead Labs Task 4 — verified mathematical corrections.
   Loaded into the encyclopedia frame before final navigation rebuild. */
(function(){
  'use strict';
  try {
    if (typeof GH_E1_FORMULAS === 'object') {
      if (GH_E1_FORMULAS.bmep_from_torque) GH_E1_FORMULAS.bmep_from_torque.expr='(T*48*Math.PI)/(V)';
      if (GH_E1_FORMULAS.ride_frequency) GH_E1_FORMULAS.ride_frequency.expr='Math.sqrt(k*386.0886/m)/(2*Math.PI)';
      if (GH_E1_FORMULAS.natural_frequency) GH_E1_FORMULAS.natural_frequency.expr='Math.sqrt(k*386.0886/m)/(2*Math.PI)';
      if (GH_E1_FORMULAS.lateral_acceleration) { GH_E1_FORMULAS.lateral_acceleration.expr='v*v/(32.174*r)'; GH_E1_FORMULAS.lateral_acceleration.post='result'; }
      if (GH_E1_FORMULAS.ackermann_angle) {
        GH_E1_FORMULAS.ackermann_angle.labels=['Wheelbase','Turn Radius','Track Width'];
        GH_E1_FORMULAS.ackermann_angle.vars=['l','r','t'];
        GH_E1_FORMULAS.ackermann_angle.expr='Math.atan(l/(r-t/2))*180/Math.PI';
      }
      if (GH_E1_FORMULAS.dynamic_pressure) GH_E1_FORMULAS.dynamic_pressure.expr='0.5*rho*v*v/32.174';
      if (GH_E1_FORMULAS.engine_air_density) GH_E1_FORMULAS.engine_air_density.expr='(P*144)/(53.35*T)';
      if (GH_E1_FORMULAS.dynamic_compression) {
        GH_E1_FORMULAS.dynamic_compression.labels=['Bore','Stroke','Connecting Rod Length','Static Compression Ratio','Intake Closing Angle (ABDC)'];
        GH_E1_FORMULAS.dynamic_compression.vars=['b','s','l','cr','ica'];
        GH_E1_FORMULAS.dynamic_compression.expr='( (Math.PI/4*b*b*(s/2*(1-Math.cos((180+ica)*Math.PI/180))+l-Math.sqrt(l*l-(s/2*Math.sin((180+ica)*Math.PI/180))**2))) + (Math.PI/4*b*b*s)/(cr-1) ) / ((Math.PI/4*b*b*s)/(cr-1))';
      }
      if (GH_E1_FORMULAS.otto_efficiency) {
        GH_E1_FORMULAS.otto_efficiency.labels=['Compression Ratio','Specific Heat Ratio (γ)'];
        GH_E1_FORMULAS.otto_efficiency.vars=['r','gamma'];
        GH_E1_FORMULAS.otto_efficiency.expr='1-1/(r**(gamma-1))';
        GH_E1_FORMULAS.otto_efficiency.out='Otto Cycle Thermal Efficiency';
        GH_E1_FORMULAS.otto_efficiency.unit='%';
        GH_E1_FORMULAS.otto_efficiency.post='result*100';
      }
    }
    if (typeof GH_E101_FORMULAS === 'object') {
      if (GH_E101_FORMULAS.fraction_simplify) GH_E101_FORMULAS.fraction_simplify.expr='n/d';
      if (GH_E101_FORMULAS.decimal_to_mixed_number) GH_E101_FORMULAS.decimal_to_mixed_number.expr='x';
      if (GH_E101_FORMULAS.nmm_to_lbft) {
        GH_E101_FORMULAS.nmm_to_lbft.out='lb-in'; GH_E101_FORMULAS.nmm_to_lbft.unit='lb-in'; GH_E101_FORMULAS.nmm_to_lbft.expr='x*8.85074579';
      }
    }
    if (typeof ghLabForCalc==='function') {
      const originalTowing=new Set(['tongue_weight','gcwr_payload','trailer_sway','brake_controller_gain','towing_squat','trailer_tire_load']);
      const e1LabSets={gasoline:new Set(),diesel:new Set(),ev:new Set(),towing:new Set()};
      if(Array.isArray(GH_E1_CALCS)) GH_E1_CALCS.forEach(c=>{
        const cat=String(c.cat||'');
        if(cat.startsWith('GASOLINE /')) e1LabSets.gasoline.add(c.id);
        else if(cat.startsWith('DIESEL /')) e1LabSets.diesel.add(c.id);
        else if(cat.startsWith('EV /')) e1LabSets.ev.add(c.id);
        else if(cat.startsWith('TOWING /')) e1LabSets.towing.add(c.id);
      });
      const dieselSet=new Set(Array.isArray(DIESEL_CALCS)?DIESEL_CALCS.map(c=>c.id):[]);
      const e101Set=new Set(Array.isArray(GH_E101_CALCS)?GH_E101_CALCS.map(c=>c.id):[]);
      ghLabForCalc=function(c){
        if(!c) return 'universal'; const id=String(c.id||'');
        if(dieselSet.has(id)||e1LabSets.diesel.has(id)) return 'diesel';
        if(e1LabSets.ev.has(id)) return 'ev';
        if(e1LabSets.towing.has(id)||originalTowing.has(id)) return 'towing';
        if(e1LabSets.gasoline.has(id)) return 'gasoline';
        if(e101Set.has(id)) return 'universal';
        return 'universal';
      };
    }
    if (typeof RENDERS === 'object') {
      if (typeof GH_E1_FORMULAS === 'object' && typeof ghE1Render==='function') Object.keys(GH_E1_FORMULAS).forEach(id=>RENDERS[id]=()=>ghE1Render(id));
      if (typeof GH_E1_FORMULAS === 'object' && GH_E1_FORMULAS.otto_efficiency) {
        RENDERS.otto_efficiency=()=>{
          const r=vd('otto_efficiency_r',10);
          const gamma=vd('otto_efficiency_gamma',1.4);
          const valid=r>1&&gamma>1;
          const eta=valid?(1-1/Math.pow(r,gamma-1))*100:NaN;
          return `${headerHTML('Otto Cycle Thermal Efficiency','General Otto-cycle thermal efficiency. Enter compression ratio and specific-heat ratio (γ). The common gasoline-air reference uses γ ≈ 1.4.')}`+
            `<div class="calc-body">${field('Compression Ratio','otto_efficiency_r',10,'')}${field('Specific Heat Ratio (γ)','otto_efficiency_gamma',1.4,'')}${resultHTML('Thermal Efficiency',valid?+eta.toFixed(4):0,'%')}`+
            `<div class="calc-note"><strong>Formula:</strong> η = 1 − 1 / r^(γ−1)<br>For the fixed γ=1.4 reference case, use Air-Standard Otto Cycle.</div></div>${calcFooter('Otto Cycle Efficiency')}`;
        };
      }
      RENDERS.cog_height=()=>{
        const wt=vd('wt8',3420), wb=vd('wb5',108), df=vd('rf',1720), ang=vd('ta5',6);
        const valid=wt>0&&wb>0&&df>0&&ang>0&&ang<90;
        const h=valid?df*wb/(wt*Math.tan(ang*Math.PI/180)):NaN;
        return `${headerHTML('Center of Gravity Height','Tilt-test CG height from front axle load change. The load input must be the change in front axle load produced by the tilt test.')}<div class="calc-body">${field('Vehicle Weight','wt8',3420,getU('weight'))}${field('Wheelbase','wb5',108,'in')}${field('Front Axle Load Change','rf',1720,getU('weight'))}${field('Tilt Angle','ta5',6,'°')}${resultHTML('CG Height',valid?+h.toFixed(2):0,'in')}</div>${calcFooter('CG Height')}`;
      };
      RENDERS.master_cylinder=()=>{
        const p=vd('cp',1800), bore=vd('bore4',1.0); const area=Math.PI*Math.pow(bore/2,2); const force=p*area;
        return `${headerHTML('Caliper Clamp Force','Calculate caliper clamp force from hydraulic line pressure and caliper piston bore.')}<div class="calc-body">${field('Brake Line Pressure','cp',1800,'psi')}${field('Caliper Piston Bore Diameter','bore4',1.0,'in')}${resultHTML('Caliper Clamp Force',+force.toFixed(0),'lbf')}</div>${calcFooter('Caliper Clamp Force')}`;
      };
      if (typeof GH_E101_FORMULAS === 'object') Object.keys(GH_E101_FORMULAS).forEach(id=>{
        const s=GH_E101_FORMULAS[id], safe=id.replace(/[^a-zA-Z0-9_]/g,'_');
        RENDERS[id]=()=>{const fields=s.labels.map((label,i)=>field(label,`${safe}_${s.vars[i]}`,label.includes('Denominator')||label.includes('Maximum')?8:1,'')).join('');let val;try{val=Function(...s.vars,`return ${s.expr};`)(...s.vars.map(v=>vd(`${safe}_${v}`,1)));}catch(e){val=NaN;}const shown=Number.isFinite(val)?Number(val).toLocaleString(undefined,{maximumFractionDigits:8}):'—';return `${headerHTML(s.out,'E1.0.1 — researched unit conversion / shop math tool.')}<div class="calc-body"><div class="gh-e1-fields">${fields}</div><button class="calc-btn" onclick="renderCalc('${id}',false)">CONVERT</button><div class="result-box"><div class="result-label">${s.out}</div><div class="result-value">${shown}<span class="result-unit">${s.unit}</span></div></div><div class="calc-note"><strong>Formula:</strong> <code>${escapeHtml(s.expr)}</code><br>Conversion factors follow NIST guidance; carry full precision internally and round the final displayed result.</div></div>${calcFooter('E1.0.1')}`;};
      });
    }
    if (typeof RENDERS === 'object' && !window.__GH_SAFE_RENDER_WRAPPED__) {
      window.__GH_SAFE_RENDER_WRAPPED__=true;
      Object.keys(RENDERS).forEach(function(id){
        const original=RENDERS[id];
        if(typeof original!=='function') return;
        RENDERS[id]=function(){
          try{
            const html=String(original.apply(this,arguments));
            if(/\b(?:NaN|Infinity|-Infinity|undefined)\b/.test(html)) throw new Error('nonfinite-render');
            return html;
          }catch(e){
            return `${headerHTML('Invalid Input','The supplied values are outside the valid mathematical or physical domain for this calculator.')}<div class="calc-body"><div class="result-box"><div class="result-label">Invalid input</div><div class="result-value">Check the entered values</div><div class="help-note">Use non-zero denominators and physically meaningful ranges.</div></div></div>${calcFooter('Invalid Input')}`;
          }
        };
      });
    }
    window.__GH_QA_CORRECTIONS__={
      bmep_from_torque:'four-stroke BMEP = 48πT/V', ride_frequency:'correct lb/in natural-frequency conversion', natural_frequency:'correct lb/in natural-frequency conversion',
      lateral_acceleration:'v²/(g·r), already in g', ackermann_angle:'requires track width', dynamic_pressure:'q = 0.5·rho·v²/g_c', engine_air_density:'ideal-gas R=53.35',
      dynamic_compression:'crank-slider piston position at IVC', nmm_to_lbft:'corrected N·m to lb-in', cog_height:'correct tilt-test load-change equation', master_cylinder:'actual caliper clamp-force calculation',
      otto_efficiency:'generalized Otto-cycle efficiency with explicit specific-heat ratio γ; Air-Standard Otto remains fixed at γ=1.4',
      lab_registry:'provenance-driven 44/42/24/25/439 distribution', render_safety:'invalid numeric output blocked at render boundary'
    };
  } catch(e) { console.error('Gearhead Labs QA correction load failed',e); }
})();

/* Gearhead Labs — Unified UX + volume-unit correction layer */
(function(){
  'use strict';
  function install(w){
    try{
      if(!w||!w.document||w.__GH_UNIFIED_UX_INSTALLED)return;
      w.__GH_UNIFIED_UX_INSTALLED=true;
      const d=w.document;
      const IMP_L=4.54609;
      const IMP_PER_US=IMP_L/3.785411784;
      const volFactor={us:1,imperial:IMP_PER_US};
      const norm=u=>String(u||'').trim().toLowerCase().replace(/\s+/g,' ');
      const isVol=u=>{const x=norm(u);return x==='gal'||x==='gallons'||x==='qt'||x==='pt'||x==='oz'||x==='gpm'||x==='gph'||x==='$ / gal'||x==='$/gal'||x==='us gal'||x==='imp gal'||x==='imp qt'||x==='imp pt'||x==='imp fl oz'||x==='us qt'||x==='us pt'||x==='us fl oz'};
      const volKind=u=>{const x=norm(u);if(x.includes('gpm'))return 'gpm';if(x.includes('gph'))return 'gph';if(x.includes('$/gal'))return '$/gal';if(x.includes('gal'))return 'gal';if(x.includes('qt'))return 'qt';if(x.includes('pt'))return 'pt';if(x==='oz'||x.includes('fl oz'))return 'oz';return null};
      const baseSystem=()=>w.UNIT&&w.UNIT.system||'imperial';
      if(w.UNIT&&!w.UNIT.volumeSystem)w.UNIT.volumeSystem=localStorage.getItem('gh-volume-system-v1')||'us';
      const volSystem=()=>w.UNIT&&w.UNIT.volumeSystem||'us';
      const setVolSystem=s=>{if(w.UNIT)w.UNIT.volumeSystem=s;try{localStorage.setItem('gh-volume-system-v1',s)}catch(e){}};
      const oldGetU=typeof w.getU==='function'?w.getU:null;
      const oldMetricUnit=typeof w.metricUnit==='function'?w.metricUnit:null;
      const oldUnitToCanonical=typeof w.unitToCanonical==='function'?w.unitToCanonical:null;
      const oldCanonicalToUnit=typeof w.canonicalToUnit==='function'?w.canonicalToUnit:null;
      const oldConvertForDisplay=typeof w.convertForDisplay==='function'?w.convertForDisplay:null;
      const oldConvertFromDisplay=typeof w.convertFromDisplay==='function'?w.convertFromDisplay:null;
      function labelFor(u){
        const k=volKind(u), s=volSystem();
        if(baseSystem()==='metric')return null;
        if(k==='gal')return s==='imperial'?'Imp gal':'US gal';
        if(k==='qt')return s==='imperial'?'Imp qt':'US qt';
        if(k==='pt')return s==='imperial'?'Imp pt':'US pt';
        if(k==='oz')return s==='imperial'?'Imp fl oz':'US fl oz';
        if(k==='$ / gal'||k==='$/gal')return s==='imperial'?'$/Imp gal':'$/US gal';
        if(k==='gpm')return s==='imperial'?'Imp gal/min':'US gal/min';
        if(k==='gph')return s==='imperial'?'Imp gal/h':'US gal/h';
        return null;
      }
      function factorForUnit(u,s){
        const k=volKind(u); if(!k)return 1; const f=volFactor[s||volSystem()]||1;
        if(k==='gal')return f; if(k==='qt')return f/4; if(k==='pt')return f/8; if(k==='oz')return f/128;
        if(k==='gpm'||k==='gph')return f; if(k==='$ / gal'||k==='$/gal')return 1/f; return 1;
      }
      function toCanonical(v,u,s){
        if(!isFinite(v)||!isVol(u)||baseSystem()==='metric')return oldUnitToCanonical?oldUnitToCanonical(v,u,s):v;
        return v*factorForUnit(u,s);
      }
      function fromCanonical(v,u,s){
        if(!isFinite(v)||!isVol(u)||baseSystem()==='metric')return oldCanonicalToUnit?oldCanonicalToUnit(v,u,s):v;
        return v/factorForUnit(u,s);
      }
      if(oldGetU)w.getU=function(label){if(label==='volume'&&baseSystem()!=='metric')return volSystem()==='imperial'?'Imp gal':'US gal';return oldGetU(label)};
      if(oldMetricUnit)w.metricUnit=function(unit){const l=labelFor(unit);if(l)return l;return oldMetricUnit(unit)};
      if(oldUnitToCanonical)w.unitToCanonical=function(v,u,s){return toCanonical(v,u,s)};
      if(oldCanonicalToUnit)w.canonicalToUnit=function(v,u,s){return fromCanonical(v,u,s)};
      if(oldConvertForDisplay)w.convertForDisplay=function(v,u){if(isVol(u)&&baseSystem()!=='metric')return fromCanonical(v,u,volSystem());return oldConvertForDisplay(v,u)};
      if(oldConvertFromDisplay)w.convertFromDisplay=function(v,u){if(isVol(u)&&baseSystem()!=='metric')return toCanonical(v,u,volSystem());return oldConvertFromDisplay(v,u)};
      function rerender(){try{const p=new URLSearchParams(w.location.search);const id=p.get('calc');if(id&&typeof w.renderCalc==='function')w.renderCalc(id,false);else if(typeof w.ghRoute==='function')w.ghRoute()}catch(e){}}
      function convertVisibleVolume(oldS,newS){
        if(oldS===newS)return;
        d.querySelectorAll('.field-input[data-ghm-unit]').forEach(el=>{
          const u=el.dataset.ghmUnit||''; const k=volKind(u); if(!k)return;
          const raw=parseFloat(el.value); if(!isFinite(raw))return;
          const canonical=raw*factorForUnit(u,oldS); el.value=String(canonical/factorForUnit(u,newS));
        });
      }
      function switchVolumeSystem(s){const old=volSystem();if(old===s)return;convertVisibleVolume(old,s);setVolSystem(s);rerender();updateUnitsButton()}
      let unitsBtn,unitsMenu;
      function closeMenu(){if(unitsMenu)unitsMenu.hidden=true}
      function chooseBase(system){
        const wanted=system==='metric'?'metric':'imperial';
        if(w.UNIT&&w.UNIT.system!==wanted){const btn=Array.from(d.querySelectorAll('.unit-btn')).find(b=>norm(b.textContent)===wanted);if(btn)btn.click()}
      }
      function selectMode(mode){
        if(mode==='metric'){setVolSystem('us');chooseBase('metric')}
        else if(mode==='imperial'){setVolSystem('imperial');chooseBase('imperial')}
        else {setVolSystem('us');chooseBase('imperial')}
        rerender();updateUnitsButton();closeMenu();
      }
      function updateUnitsButton(){if(!unitsBtn)return;const label=baseSystem()==='metric'?'MET':(volSystem()==='imperial'?'IMP':'US');unitsBtn.textContent='UNITS · '+label}
      function installUnits(){
        const existing=d.querySelector('.unit-toggle');if(!existing)return;existing.style.display='none';if(unitsBtn&&unitsBtn.isConnected)return;
        unitsBtn=d.createElement('button');unitsBtn.type='button';unitsBtn.className='gh-units-button';unitsBtn.setAttribute('aria-haspopup','menu');unitsBtn.setAttribute('aria-expanded','false');
        const host=existing.parentElement;host.insertBefore(unitsBtn,existing);
        unitsMenu=d.createElement('div');unitsMenu.className='gh-units-menu';unitsMenu.hidden=true;
        unitsMenu.innerHTML='<div class="gh-units-title">UNIT SYSTEM</div><button data-mode="us">U.S. CUSTOMARY</button><button data-mode="imperial">IMPERIAL</button><button data-mode="metric">METRIC</button><div class="gh-units-note">Liquid volume uses distinct U.S. and Imperial measures.</div>';
        host.appendChild(unitsMenu);
        unitsBtn.addEventListener('click',e=>{e.stopPropagation();unitsMenu.hidden=!unitsMenu.hidden;unitsBtn.setAttribute('aria-expanded',String(!unitsMenu.hidden))});
        unitsMenu.addEventListener('click',e=>{const b=e.target.closest('button[data-mode]');if(b)selectMode(b.dataset.mode)});
        d.addEventListener('click',e=>{if(unitsMenu&&!unitsMenu.hidden&&!e.target.closest('.gh-units-menu,.gh-units-button'))closeMenu()});
        updateUnitsButton();
      }
      function goBack(){
        try{
          if(w.parent&&w.parent!==w){
            const p=w.parent;
            if(p.location.search.includes('calc=')){if(p.history.length>1){p.history.back();return}p.history.pushState({},'',p.location.pathname);p.dispatchEvent(new PopStateEvent('popstate'));return}
          }
        }catch(e){}
        try{const input=d.querySelector('#search-input,.search-input,input[type="search"]');if(input){input.focus();return}}catch(e){}
      }
      function installBack(){
        if(d.querySelector('.gh-inapp-back'))return;
        const card=d.querySelector('.calc-card');const head=card&&card.querySelector('.calc-header');if(!head)return;
        const b=d.createElement('button');b.type='button';b.className='gh-inapp-back';b.innerHTML='← <span>BACK</span>';b.title='Back to calculator list';b.addEventListener('click',goBack);head.insertBefore(b,head.firstChild);
      }
      const style=d.createElement('style');style.textContent=`
        .gh-units-button{position:relative;z-index:110;background:rgba(255,255,255,.035);border:1px solid var(--border,#2a2e38);color:var(--text,#f5f6f8);border-radius:18px;padding:7px 11px;font:700 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.04em;white-space:nowrap;cursor:pointer}
        .gh-units-button:hover{border-color:var(--red,#d99a16);color:var(--red-bright,#ffc52e)}
        .gh-units-menu{position:absolute;right:0;top:calc(100% + 8px);width:210px;padding:8px;background:var(--card,#1a1d24);border:1px solid var(--border,#2a2e38);border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.45);z-index:300}
        .gh-units-menu[hidden]{display:none}.gh-units-title{padding:6px 9px 7px;color:var(--muted,#8c96a5);font-size:10px;font-weight:800;letter-spacing:.12em}
        .gh-units-menu button{display:block;width:100%;padding:10px 9px;border:0;border-radius:8px;background:transparent;color:var(--text-secondary,#c3c8d1);text-align:left;font:600 12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}
        .gh-units-menu button:hover{background:var(--red-wash,rgba(217,154,22,.12));color:var(--text,#f5f6f8)}.gh-units-note{padding:8px 9px 5px;color:var(--muted,#8c96a5);font-size:9.5px;line-height:1.35}
        .gh-inapp-back{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;margin-right:10px;padding:7px 9px;border:1px solid var(--border,#2a2e38);border-radius:9px;background:var(--surface,#15171d);color:var(--muted,#8c96a5);font:800 10px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.08em;cursor:pointer}
        .gh-inapp-back:hover{border-color:var(--red,#d99a16);color:var(--red-bright,#ffc52e)}@media(max-width:560px){.gh-units-button{padding:7px 8px;font-size:10px}.gh-inapp-back{padding:6px 8px;margin-right:7px}.gh-inapp-back span{display:none}}
      `;d.head.appendChild(style);installUnits();installBack();
      if(typeof w.RENDERS==='object'&&!w.__GH_VOLUME_RENDER_PATCHED){
        w.__GH_VOLUME_RENDER_PATCHED=true;
        w.RENDERS.volume_converter=function(){
          const val=typeof w.vd==='function'?w.vd('vol3',1):1;
          const from=typeof w.sv==='function'?(w.sv('vf')||'us_gal'):'us_gal';
          const factors={us_gal:1,imp_gal:IMP_PER_US,L:1/3.785411784,us_qt:.25,imp_qt:IMP_PER_US/4,us_pt:.125,imp_pt:IMP_PER_US/8,us_oz:1/128,imp_oz:IMP_PER_US/160};
          const labels={us_gal:'U.S. Gallons',imp_gal:'Imperial Gallons',L:'Liters',us_qt:'U.S. Quarts',imp_qt:'Imperial Quarts',us_pt:'U.S. Pints',imp_pt:'Imperial Pints',us_oz:'U.S. Fluid Ounces',imp_oz:'Imperial Fluid Ounces'};
          const base=val*(factors[from]||1);const out=(u,n)=>({label:n,value:+(base/(factors[u]||1)).toFixed(6),unit:u});
          const fields=typeof w.field==='function'?w.field('Volume','vol3',val,''):'';
          const select=typeof w.selectField==='function'?w.selectField('From','vf',Object.keys(labels).map(v=>({v:v,l:labels[v]})),from):'';
          return `${w.headerHTML('Liquid Volume Converter','Separate U.S. customary and British Imperial liquid-volume units. Conversion factors follow NIST definitions.')}`+`<div class="calc-body">${fields}${select}${w.multiResult([out('us_gal','U.S. Gallons'),out('imp_gal','Imperial Gallons'),out('L','Liters'),out('us_qt','U.S. Quarts'),out('imp_qt','Imperial Quarts'),out('us_pt','U.S. Pints'),out('imp_pt','Imperial Pints'),out('us_oz','U.S. Fluid Ounces'),out('imp_oz','Imperial Fluid Ounces')])}<div class="calc-note"><strong>Definitions:</strong> 1 U.S. gal = 3.785411784 L; 1 Imperial gal = 4.54609 L.</div></div>${w.calcFooter('Liquid Volume')}`;
        };
      }
      const mo=new MutationObserver(()=>{installUnits();installBack()});mo.observe(d.body,{childList:true,subtree:true});updateUnitsButton();
    }catch(e){console.error('Gearhead Labs unified UX patch failed',e)}
  }
  function wait(){try{const f=document.getElementById('app');const w=f&&f.contentWindow;if(w&&w.document&&w.document.body){install(w);if(!w.__GH_UNIFIED_UX_INSTALLED)setTimeout(wait,150)}}catch(e){setTimeout(wait,150)}}
  window.addEventListener('load',wait);wait();
})();