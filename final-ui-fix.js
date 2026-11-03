/* Gearhead Labs — final UI correction layer
   Two unit systems only: IMPERIAL and METRIC (hides the engine's legacy unit selector) and removes the obstructing mobile FAB.
   Calculator search is NOT handled here: the engine's ghBuildNav is the one authoritative search (GH-DEF-038). */
(function(){
  'use strict';
  function install(w){
    try{
      if(!w||!w.document||w.__GH_FINAL_UI_FIX)return;
      w.__GH_FINAL_UI_FIX=true;
      const d=w.document;
      /* GH-DEF-038 (2026-10-17): this layer no longer installs a calculator search. Its search read window.CALCS, which is
         always undefined (the engine declares CALCS with const), and it took the search box away from the engine's own
         ghBuildNav whenever this script ran after the calculator frame had loaded, so every query then answered "No calculators
         found". The engine's ghBuildNav is the one authoritative search. Only the three hiding rules the unit and FAB
         hiders below rely on are kept from the old search stylesheet. */
      if(!d.getElementById('GH_FINAL_UI_STYLE')){
        const style=d.createElement('style');
        style.id='GH_FINAL_UI_STYLE';
        style.textContent='.gh-final-hide-unit{display:none!important}.gh-final-legacy-unit-hidden{display:none!important}.gh-final-obscuring-fab-hidden{display:none!important}';
        d.head.appendChild(style);
      }

      /* ---------- UNITS: remove every legacy large selector ---------- */
      const cleanText=s=>String(s||'').replace(/\s+/g,' ').trim();
      function hideLegacyUnits(){
        d.querySelectorAll('.gh-units-button,.gh-units-menu,.unit-switcher,.unit-toggle,.unit-selector,.units-toggle,.unit-btn').forEach(el=>el.classList.add('gh-final-hide-unit'));
        const els=Array.from(d.querySelectorAll('button,a,div,span,label'));
        const imperial=els.find(e=>cleanText(e.textContent)==='Imperial');
        const metric=els.find(e=>cleanText(e.textContent)==='Metric');
        if(imperial&&metric){
          let a=imperial;
          for(let i=0;i<8&&a;i++,a=a.parentElement){
            if(a.contains(metric)){
              const r=a.getBoundingClientRect();
              if(r.width>=150&&r.width<=550&&r.height>=25&&r.height<=140){a.classList.add('gh-final-legacy-unit-hidden');break}
            }
          }
        }
      }
      hideLegacyUnits();setTimeout(hideLegacyUnits,300);setTimeout(hideLegacyUnits,1000);setTimeout(hideLegacyUnits,2000);

      /* ---------- MOBILE: remove the obstructing fixed gold FAB ---------- */
      function hideObscuringFab(){
        Array.from(d.querySelectorAll('button,a,[role="button"]')).forEach(el=>{
          const r=el.getBoundingClientRect(),cs=w.getComputedStyle(el),txt=cleanText(el.textContent);
          if(r.width>=45&&r.width<=105&&r.height>=45&&r.height<=105&&r.left<140&&r.bottom>w.innerHeight-190&&cs.position==='fixed'){
            const bg=cs.backgroundColor||'';
            if(txt==='='||txt==='≡'||txt==='☰'||txt===''||/rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/i.test(bg))el.classList.add('gh-final-obscuring-fab-hidden');
          }
        });
      }
      hideObscuringFab();setTimeout(hideObscuringFab,500);setTimeout(hideObscuringFab,1500);
    }catch(e){console.error('Gearhead Labs final UI fix failed',e)}
  }
  function wait(){try{const f=document.getElementById('app'),w=f&&f.contentWindow;if(w&&w.document&&w.document.body){install(w);if(!w.__GH_FINAL_UI_FIX)setTimeout(wait,150)}else setTimeout(wait,150)}catch(e){setTimeout(wait,150)}}
  window.addEventListener('load',wait);wait();
})();
