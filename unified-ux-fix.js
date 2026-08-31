/* Gearhead Labs — final correction layer for unit-system transitions */
(function(){
  'use strict';
  function install(w){
    try{
      if(!w||!w.document||w.__GH_FINAL_UX_FIX)return;
      w.__GH_FINAL_UX_FIX=true;
      const d=w.document;
      const IMP_PER_US=4.54609/3.785411784;
      const norm=u=>String(u||'').trim().toLowerCase().replace(/\s+/g,' ');
      const kind=u=>{const x=norm(u);if(x.includes('gpm'))return'gpm';if(x.includes('gph'))return'gph';if(x.includes('$/gal'))return'$/gal';if(x.includes('gal'))return'gal';if(x.includes('qt'))return'qt';if(x.includes('pt'))return'pt';if(x==='oz'||x.includes('fl oz'))return'oz';return null};
      const isVol=u=>!!kind(u);
      const base=()=>w.UNIT&&w.UNIT.system||'imperial';
      if(w.UNIT&&!w.UNIT.volumeSystem)w.UNIT.volumeSystem=localStorage.getItem('gh-volume-system-v1')||'us';
      const vs=()=>w.UNIT&&w.UNIT.volumeSystem||'us';
      const setVS=s=>{if(w.UNIT)w.UNIT.volumeSystem=s;try{localStorage.setItem('gh-volume-system-v1',s)}catch(e){}};
      const oldUTC=w.unitToCanonical,oldCTU=w.canonicalToUnit,oldMU=w.metricUnit,oldGU=w.getU;
      const factor=(u,s)=>{const k=kind(u),f=s==='imperial'?IMP_PER_US:1;if(k==='gal'||k==='gpm'||k==='gph')return f;if(k==='qt')return f/4;if(k==='pt')return f/8;if(k==='oz')return f/128;if(k==='$ / gal'||k==='$/gal')return 1/f;return 1};
      w.unitToCanonical=function(v,u,s){if(isVol(u)&&s!=='metric')return isFinite(v)?v*factor(u,s||vs()):v;return oldUTC?oldUTC(v,u,s):v};
      w.canonicalToUnit=function(v,u,s){if(isVol(u)&&s!=='metric')return isFinite(v)?v/factor(u,s||vs()):v;return oldCTU?oldCTU(v,u,s):v};
      w.metricUnit=function(u){const k=kind(u);if(k&&base()!=='metric'){if(k==='gal')return vs()==='imperial'?'Imp gal':'US gal';if(k==='qt')return vs()==='imperial'?'Imp qt':'US qt';if(k==='pt')return vs()==='imperial'?'Imp pt':'US pt';if(k==='oz')return vs()==='imperial'?'Imp fl oz':'US fl oz';if(k==='gpm')return vs()==='imperial'?'Imp gal/min':'US gal/min';if(k==='gph')return vs()==='imperial'?'Imp gal/h':'US gal/h';if(k==='$/gal')return vs()==='imperial'?'$/Imp gal':'$/US gal'}return oldMU?oldMU(u):u};
      w.getU=function(label){if(label==='volume'&&base()!=='metric')return vs()==='imperial'?'Imp gal':'US gal';return oldGU?oldGU(label):label};

      function convertVisible(oldS,newS){
        if(oldS===newS)return;
        d.querySelectorAll('.field-input[data-ghm-unit]').forEach(el=>{
          const u=el.dataset.ghmUnit||'';if(!isVol(u))return;const raw=parseFloat(el.value);if(!isFinite(raw))return;
          const canonical=raw*factor(u,oldS);el.value=String(canonical/factor(u,newS));
        });
      }
      function rerender(){try{const p=new URLSearchParams(w.location.search);if(p.get('calc')&&typeof w.renderCalc==='function')w.renderCalc(p.get('calc'),false);else if(typeof w.ghRoute==='function')w.ghRoute()}catch(e){}}
      function setBase(mode){const b=Array.from(d.querySelectorAll('.unit-btn')).find(x=>norm(x.textContent)===mode);if(b)b.click()}
      function select(mode){
        const currentBase=base(),currentVol=vs();
        if(mode==='metric'){
          setVS('us');
          if(currentBase!=='metric')setBase('metric');else rerender();
        }else{
          const desired=mode==='imperial'?'imperial':'us';
          if(currentBase==='metric'){
            setVS(desired);setBase('imperial');
          }else{
            if(currentVol!==desired)convertVisible(currentVol,desired);
            setVS(desired);rerender();
          }
        }
        updateButton();
      }
      function updateButton(){const b=d.querySelector('.gh-units-button');if(b)b.textContent='UNITS · '+(base()==='metric'?'MET':(vs()==='imperial'?'IMP':'US'))}
      const menu=d.querySelector('.gh-units-menu');
      if(menu&&!menu.__GH_FINAL_CAPTURE){
        menu.__GH_FINAL_CAPTURE=true;
        menu.addEventListener('click',e=>{
          const b=e.target.closest('button[data-mode]');if(!b)return;
          e.preventDefault();e.stopImmediatePropagation();select(b.dataset.mode);menu.hidden=true;
        },true);
      }
      updateButton();
      if(!d.__GH_FINAL_MUTATION){
        d.__GH_FINAL_MUTATION=true;
        const mo=new MutationObserver(()=>updateButton());mo.observe(d.body,{childList:true,subtree:true});
      }
    }catch(e){console.error('Gearhead Labs final UX fix failed',e)}
  }
  function wait(){try{const f=document.getElementById('app'),w=f&&f.contentWindow;if(w&&w.document&&w.document.body){install(w);if(!w.__GH_FINAL_UX_FIX)setTimeout(wait,150)}}catch(e){setTimeout(wait,150)}}
  window.addEventListener('load',wait);wait();
})();