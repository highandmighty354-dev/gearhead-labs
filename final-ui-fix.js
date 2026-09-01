/* Gearhead Labs — final UI/search correction layer
   Two unit systems only: IMPERIAL and METRIC.
   Search is registry-backed and searches calculator metadata, IDs, and
   calculation-function source so aliases such as MPG are discoverable. */
(function(){
  'use strict';
  function install(w){
    try{
      if(!w||!w.document||w.__GH_FINAL_UI_FIX)return;
      w.__GH_FINAL_UI_FIX=true;
      const d=w.document;
      const clean=s=>String(s==null?'':s).replace(/[›→]/g,'').replace(/\s+/g,' ').trim();
      const nameOf=c=>clean(c&&(c.name||c.label||c.title||c.id));
      const catOf=c=>clean(c&&(c.cat||c.category||c.lab||''));

      /* ---------- SEARCH: complete registry + function-source search ---------- */
      const input=d.querySelector('#search-input,.search-input,input[type="search"]');
      if(input){
        d.querySelectorAll('.gh-search-results').forEach(x=>x.remove());
        const style=d.createElement('style');
        style.id='GH_FINAL_UI_STYLE';
        style.textContent=`
          .gh-final-search-results{margin:0;border-top:1px solid rgba(255,255,255,.08);background:#0d0e12}
          .gh-final-search-result{display:flex;align-items:center;justify-content:space-between;gap:18px;width:100%;box-sizing:border-box;padding:15px 22px;border:0;border-bottom:1px solid rgba(255,255,255,.07);background:transparent;color:#e4e7ec;font:600 16px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left;cursor:pointer}
          .gh-final-search-result:active{background:rgba(215,161,31,.14)}
          .gh-final-search-result small{display:block;margin-top:3px;color:#7f8995;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
          .gh-final-search-result .arrow{color:#d7a11f;font-size:21px;flex:0 0 auto}
          .gh-final-search-empty{padding:18px 22px;color:#8994a3;font:500 15px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
          .gh-final-hide-unit{display:none!important}
          .gh-final-legacy-unit-hidden{display:none!important}
          .gh-final-obscuring-fab-hidden{display:none!important}
        `;
        d.head.appendChild(style);
        const host=d.createElement('div');
        host.className='gh-final-search-results';host.hidden=true;
        const anchor=input.closest('.search-wrap,.search-container,.search-box')||input.parentElement;
        if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(host,anchor.nextSibling);

        const searchText=c=>{
          const vals=[];
          if(c&&typeof c==='object')Object.keys(c).forEach(k=>{
            let v;try{v=c[k]}catch(e){return}
            if(typeof v==='function'){vals.push(String(v));return}
            if(v!==null&&typeof v==='object'){try{vals.push(JSON.stringify(v))}catch(e){}}
            else vals.push(String(v==null?'':v));
          });
          return clean(vals.join(' ')).toLowerCase();
        };
        const registry=()=>Array.isArray(w.CALCS)?w.CALCS.filter(c=>c&&typeof c.id==='string'&&nameOf(c)):[];
        const open=id=>{
          if(!id)return;
          try{if(typeof w.__GH_OPEN_CALCULATOR==='function'){w.__GH_OPEN_CALCULATOR(id,true);return}}catch(e){}
          try{if(typeof w.ghRoute==='function'){w.history.pushState(null,'','?calc='+encodeURIComponent(id));w.ghRoute();return}}catch(e){}
          try{if(typeof w.renderCalc==='function')w.renderCalc(id,false)}catch(e){console.error('Gearhead Labs search open failed',id,e)}
        };
        const clearOldNav=()=>{
          d.querySelectorAll('.gh-search-results').forEach(x=>{if(x!==host)x.remove()});
          d.querySelectorAll('.gh-nav-hidden').forEach(x=>x.classList.remove('gh-nav-hidden'));
        };
        const search=q0=>{
          const q=clean(q0).toLowerCase();clearOldNav();host.innerHTML='';
          if(!q){host.hidden=true;return}
          const matches=[];const seen=new Set();
          const aliases=q==='mpg'?['mpg','miles per gallon','fuel economy','fuel efficiency','fuel consumption','mileage']:[];
          registry().forEach(c=>{
            const text=searchText(c);
            const hit=aliases.length?aliases.some(a=>text.includes(a)):text.includes(q);
            if(hit&&!seen.has(c.id)){seen.add(c.id);matches.push(c)}
          });
          matches.sort((a,b)=>{
            const an=nameOf(a).toLowerCase(),bn=nameOf(b).toLowerCase();
            const ae=an===q?0:an.startsWith(q)?1:2,be=bn===q?0:bn.startsWith(q)?1:2;
            return ae-be||an.localeCompare(bn);
          });
          host.hidden=false;
          if(!matches.length){const empty=d.createElement('div');empty.className='gh-final-search-empty';empty.textContent='No calculators found for '+clean(q0)+'.';host.appendChild(empty);return}
          matches.forEach(c=>{
            const b=d.createElement('button');b.type='button';b.className='gh-final-search-result';b.dataset.calcId=c.id;
            const left=d.createElement('span');left.textContent=nameOf(c);
            const cat=d.createElement('small');cat.textContent=catOf(c);left.appendChild(cat);
            const arrow=d.createElement('span');arrow.className='arrow';arrow.textContent='›';b.append(left,arrow);host.appendChild(b);
          });
        };
        input.setAttribute('autocomplete','off');input.oninput=null;
        input.addEventListener('input',e=>{e.stopImmediatePropagation();search(input.value)},true);
        input.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopImmediatePropagation();input.value='';search('');input.blur()}},true);
        d.addEventListener('click',e=>{const r=e.target.closest&&e.target.closest('.gh-final-search-result');if(!r)return;e.preventDefault();e.stopImmediatePropagation();open(r.dataset.calcId)},true);
        w.__GH_FINAL_SEARCH={search,count:()=>registry().length};
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
