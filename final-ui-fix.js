/* Gearhead Labs — final UI/search correction layer
   Two unit systems only: IMPERIAL and METRIC.
   Search is registry-backed so every calculator is searchable, including
   calculators that are not currently represented by visible navigation DOM. */
(function(){
  'use strict';

  function install(w){
    try{
      if(!w||!w.document||w.__GH_FINAL_UI_FIX)return;
      w.__GH_FINAL_UI_FIX=true;
      const d=w.document;

      /* ---------- SEARCH: search the complete repaired calculator registry ---------- */
      const input=d.querySelector('#search-input,.search-input,input[type="search"]');
      if(input){
        const oldHost=d.querySelector('.gh-search-results');
        if(oldHost)oldHost.remove();

        const style=d.createElement('style');
        style.id='GH_FINAL_UI_STYLE';
        style.textContent=`
          .gh-final-search-results{margin:0;border-top:1px solid rgba(255,255,255,.08);background:#0d0e12}
          .gh-final-search-result{display:flex;align-items:center;justify-content:space-between;gap:18px;width:100%;box-sizing:border-box;padding:15px 22px;border:0;border-bottom:1px solid rgba(255,255,255,.07);background:transparent;color:#e4e7ec;font:600 16px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left;cursor:pointer}
          .gh-final-search-result:active{background:rgba(215,161,31,.14)}
          .gh-final-search-result small{display:block;margin-top:3px;color:#7f8995;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
          .gh-final-search-result .arrow{color:#d7a11f;font-size:21px;flex:0 0 auto}
          .gh-final-search-empty{padding:18px 22px;color:#8994a3;font:500 15px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}

          /* Compact unit control. The old large selector is hidden completely. */
          .gh-final-unit-button{appearance:none;border:1px solid rgba(215,161,31,.45);background:rgba(13,14,18,.94);color:#f1f3f6;border-radius:7px;padding:6px 9px;min-height:30px;font:800 10px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.08em;cursor:pointer;white-space:nowrap}
          .gh-final-unit-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:99999;display:none;min-width:132px;padding:5px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:#111319;box-shadow:0 10px 28px rgba(0,0,0,.45)}
          .gh-final-unit-menu.open{display:block}
          .gh-final-unit-option{display:block;width:100%;border:0;border-radius:5px;background:transparent;color:#dfe3e9;padding:9px 10px;text-align:left;font:800 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.07em;cursor:pointer}
          .gh-final-unit-option:active,.gh-final-unit-option:hover{background:rgba(215,161,31,.12);color:#fff}
          .gh-final-unit-wrap{position:relative;display:inline-flex;align-items:center}
          .gh-final-hide-unit{display:none!important}
        `;
        d.head.appendChild(style);

        const host=d.createElement('div');
        host.className='gh-final-search-results';
        host.hidden=true;
        const anchor=input.closest('.search-wrap,.search-container,.search-box')||input.parentElement;
        if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(host,anchor.nextSibling);

        const clean=s=>String(s==null?'':s).replace(/[›→]/g,'').replace(/\s+/g,' ').trim();
        const haystack=c=>{
          const vals=[];
          if(c&&typeof c==='object')Object.keys(c).forEach(k=>{const v=c[k];if(['function','object'].includes(typeof v)&&v!==null)return;vals.push(String(v==null?'':v))});
          return clean(vals.join(' ')).toLowerCase();
        };
        const nameOf=c=>clean(c&&(c.name||c.label||c.title||c.id));
        const catOf=c=>clean(c&&(c.cat||c.category||c.lab||''));
        const registry=()=>Array.isArray(w.CALCS)?w.CALCS.filter(c=>c&&typeof c.id==='string'&&nameOf(c)):[];
        const open=id=>{
          if(!id)return;
          try{if(typeof w.__GH_OPEN_CALCULATOR==='function'){w.__GH_OPEN_CALCULATOR(id,true);return}}catch(e){}
          try{if(typeof w.ghRoute==='function'){w.history.pushState(null,'','?calc='+encodeURIComponent(id));w.ghRoute();return}}catch(e){}
          try{if(typeof w.renderCalc==='function')w.renderCalc(id,false)}catch(e){console.error('Gearhead Labs search open failed',e)}
        };
        const clearOldNav=()=>{
          d.querySelectorAll('.gh-search-results').forEach(x=>{if(x!==host)x.remove()});
          d.querySelectorAll('.gh-nav-hidden').forEach(x=>x.classList.remove('gh-nav-hidden'));
        };
        const search=q0=>{
          const q=clean(q0).toLowerCase();
          clearOldNav();
          host.innerHTML='';
          if(!q){host.hidden=true;return}
          const matches=[];const seen=new Set();
          registry().forEach(c=>{
            if(haystack(c).includes(q)){
              const key=c.id;if(!seen.has(key)){seen.add(key);matches.push(c)}
            }
          });
          matches.sort((a,b)=>{
            const an=nameOf(a).toLowerCase(),bn=nameOf(b).toLowerCase();
            const ae=an===q?0:an.startsWith(q)?1:2,be=bn===q?0:bn.startsWith(q)?1:2;
            return ae-be||an.localeCompare(bn);
          });
          host.hidden=false;
          if(!matches.length){
            const empty=d.createElement('div');empty.className='gh-final-search-empty';empty.textContent='No calculators found for '+clean(q0)+'.';host.appendChild(empty);return;
          }
          matches.forEach(c=>{
            const b=d.createElement('button');b.type='button';b.className='gh-final-search-result';b.dataset.calcId=c.id;
            const left=d.createElement('span');left.textContent=nameOf(c);
            const cat=d.createElement('small');cat.textContent=catOf(c);left.appendChild(cat);
            const arrow=d.createElement('span');arrow.className='arrow';arrow.textContent='›';b.append(left,arrow);host.appendChild(b);
          });
        };
        input.setAttribute('autocomplete','off');
        input.oninput=null;
        input.addEventListener('input',e=>{e.stopImmediatePropagation();search(input.value)},true);
        input.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopImmediatePropagation();input.value='';search('');input.blur()}},true);
        d.addEventListener('click',e=>{
          const r=e.target.closest&&e.target.closest('.gh-final-search-result');
          if(!r)return;
          e.preventDefault();e.stopImmediatePropagation();open(r.dataset.calcId);
        },true);
        w.__GH_FINAL_SEARCH={search,count:()=>registry().length};
      }

      /* ---------- UNITS: exactly two choices ---------- */
      function findNative(mode){
        const buttons=Array.from(d.querySelectorAll('.unit-btn'));
        return buttons.find(b=>{
          const dm=String(b.dataset.mode||'').toLowerCase();
          const txt=cleanText(b.textContent).toLowerCase();
          if(mode==='metric')return dm==='metric'||txt==='metric';
          return dm==='imperial'||txt.includes('imperial')||dm==='us'||txt==='us';
        });
      }
      function cleanText(s){return String(s||'').replace(/\s+/g,' ').trim()}
      function currentMode(){
        try{if(w.UNIT&&w.UNIT.system==='metric')return 'metric'}catch(e){}
        return 'imperial';
      }
      function activate(mode){
        const native=findNative(mode);
        try{
          if(native){native.click();return}
        }catch(e){}
        try{
          if(w.UNIT){w.UNIT.system=mode==='metric'?'metric':'imperial';}
          if(typeof w.setUnitSystem==='function')w.setUnitSystem(mode==='metric'?'metric':'imperial');
          else if(typeof w.renderCalc==='function'){
            const p=new URLSearchParams(w.location.search);const id=p.get('calc');if(id)w.renderCalc(id,false);else if(typeof w.ghRoute==='function')w.ghRoute();
          }
        }catch(e){console.error('Gearhead Labs unit switch failed',e)}
      }

      /* Hide every legacy large unit control/menu. */
      d.querySelectorAll('.gh-units-button,.gh-units-menu').forEach(el=>el.classList.add('gh-final-hide-unit'));
      d.querySelectorAll('.unit-switcher,.unit-toggle,.unit-selector,.units-toggle').forEach(el=>el.classList.add('gh-final-hide-unit'));
      d.querySelectorAll('.unit-btn').forEach(el=>el.classList.add('gh-final-hide-unit'));

      let wrap=d.querySelector('.gh-final-unit-wrap');
      if(!wrap){
        wrap=d.createElement('div');wrap.className='gh-final-unit-wrap';
        const legacy=d.querySelector('.gh-units-button');
        const parent=legacy&&legacy.parentElement;
        if(parent){parent.appendChild(wrap)}else{
          const header=d.querySelector('header,.topbar,.top-bar,.nav,.navbar,.app-header')||d.body;
          wrap.style.position='fixed';wrap.style.top='10px';wrap.style.right='10px';wrap.style.zIndex='100000';header.appendChild(wrap);
        }
      }
      let btn=wrap.querySelector('.gh-final-unit-button');
      if(!btn){
        btn=d.createElement('button');btn.type='button';btn.className='gh-final-unit-button';btn.setAttribute('aria-label','Units');wrap.appendChild(btn);
      }
      let menu=wrap.querySelector('.gh-final-unit-menu');
      if(!menu){
        menu=d.createElement('div');menu.className='gh-final-unit-menu';
        const imp=d.createElement('button');imp.type='button';imp.className='gh-final-unit-option';imp.dataset.mode='imperial';imp.textContent='IMPERIAL';
        const met=d.createElement('button');met.type='button';met.className='gh-final-unit-option';met.dataset.mode='metric';met.textContent='METRIC';
        menu.append(imp,met);wrap.appendChild(menu);
      }
      const update=()=>{btn.textContent=currentMode()==='metric'?'METRIC':'IMPERIAL'};
      btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();menu.classList.toggle('open')},true);
      menu.addEventListener('click',e=>{const b=e.target.closest('.gh-final-unit-option');if(!b)return;e.preventDefault();e.stopImmediatePropagation();activate(b.dataset.mode);menu.classList.remove('open');setTimeout(update,0)},true);
      d.addEventListener('click',e=>{if(!wrap.contains(e.target))menu.classList.remove('open')},true);
      update();
      w.__GH_FINAL_UNITS={set:activate,current:currentMode};

    }catch(e){console.error('Gearhead Labs final UI fix failed',e)}
  }

  function wait(){
    try{
      const f=document.getElementById('app');const w=f&&f.contentWindow;
      if(w&&w.document&&w.document.body){install(w);if(!w.__GH_FINAL_UI_FIX)setTimeout(wait,150)}
      else setTimeout(wait,150);
    }catch(e){setTimeout(wait,150)}
  }
  window.addEventListener('load',wait);wait();
})();
