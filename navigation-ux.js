/* Gearhead Labs — Navigation / UX layer
   Mobile-safe calculator search and routing.
   Search uses both the authoritative registry and the live calculator DOM,
   because the registry may be populated after this script initializes.
*/
(function(){
  function install(w){
    try{
      const d=w&&w.document;
      if(!d||d.__GH_NAV_UX_INSTALLED)return false;
      const input=d.querySelector('#search-input,.search-input,input[type="search"]');
      const sidebar=d.querySelector('.sidebar');
      if(!input||!sidebar)return false;
      d.__GH_NAV_UX_INSTALLED=true;
      if(!d.getElementById('GH_NAV_UX_SEARCH_CSS')){
        const style=d.createElement('style');style.id='GH_NAV_UX_SEARCH_CSS';
        style.textContent='.gh-nav-search-results{margin:0;border-top:1px solid #21242c;background:#0f1013;max-height:55vh;overflow:auto}.gh-nav-search-results[hidden]{display:none!important}.gh-nav-search-result{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:14px;border:0;border-bottom:1px solid #21242c;background:transparent;color:#c3c8d1;text-align:left;font:600 14px/1.3 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}.gh-nav-search-result:active{background:rgba(217,154,22,.14);color:#fff}.gh-nav-search-result strong{display:block;color:#f5f6f8}.gh-nav-search-result small{display:block;margin-top:3px;color:#8c96a5;font-size:10px;font-weight:500}.gh-nav-search-result b{color:#d99a16;font-size:20px}.gh-nav-search-empty{padding:18px 14px;color:#8c96a5;font-size:12px}';
        d.head.appendChild(style);
      }
      let results=d.querySelector('.gh-nav-search-results');
      if(!results){results=d.createElement('div');results.className='gh-nav-search-results';results.hidden=true;(input.closest('.search-wrap')||input.parentElement).appendChild(results)}
      const clean=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
      const registry=()=>Array.isArray(w.CALCS)?w.CALCS.filter(c=>c&&c.id&&c.id!=='dashboard'&&(c.name||c.label)):[];
      function closeSearch(){results.hidden=true;results.innerHTML=''}
      function getLiveItems(q){
        const out=[];
        d.querySelectorAll('.calc-item').forEach(el=>{
          const name=clean(el.querySelector('.calc-item-name')?.textContent||el.textContent);
          if(!name||!name.includes(q))return;
          let id=el.getAttribute('data-calc-id')||el.getAttribute('data-id')||'';
          const href=el.getAttribute('href')||'';
          if(!id&&href){const m=href.match(/[?&]calc=([^&#]+)/);if(m)id=decodeURIComponent(m[1])}
          if(!id){const oc=el.getAttribute('onclick')||'';const m=oc.match(/renderCalc\(['"]([^'"]+)['"]|renderCalc\(([^,)]+)/);if(m)id=m[1]||m[2]||''}
          out.push({id,name,el});
        });
        return out;
      }
      function openCalculator(id,el){
        try{if(el)el.click();else if(id&&typeof w.renderCalc==='function')w.renderCalc(id);if(id){const url=new URL(w.location.href);url.searchParams.set('calc',id);w.history.replaceState(null,'',url.pathname+'?'+url.searchParams.toString()+url.hash)}closeSearch();input.value='';if(w.innerWidth<=640)(d.getElementById('sidebar')||sidebar).classList.remove('open')}catch(e){if(id)try{w.location.href='?calc='+encodeURIComponent(id)}catch(x){}}}
      function renderSearch(value){
        const q=clean(value);if(!q){closeSearch();return}
        const merged=[],seen=new Set();
        getLiveItems(q).forEach(x=>{if(!seen.has(x.name)){seen.add(x.name);merged.push({name:x.name,id:x.id,el:x.el,cat:'Calculator'})}});
        registry().filter(c=>[c.name,c.label,c.category,c.cat,c.lab,c.description,c.desc].map(clean).join(' ').includes(q)).slice(0,60).forEach(c=>{const name=clean(c.name||c.label);if(!seen.has(name)){seen.add(name);merged.push({name:c.name||c.label,id:c.id,cat:c.category||c.cat||c.lab||'Calculator'})}});
        results.hidden=false;results.innerHTML='';
        if(!merged.length){const empty=d.createElement('div');empty.className='gh-nav-search-empty';empty.textContent='No calculators found for '+String(value);results.appendChild(empty);return}
        merged.slice(0,60).forEach(c=>{const b=d.createElement('button');b.type='button';b.className='gh-nav-search-result';const s=d.createElement('span'),strong=d.createElement('strong'),small=d.createElement('small'),a=d.createElement('b');strong.textContent=c.name;small.textContent=c.cat;a.textContent='›';s.append(strong,small);b.append(s,a);b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openCalculator(c.id,c.el)});results.appendChild(b)})
      }
      input.addEventListener('input',()=>renderSearch(input.value),true);
      input.addEventListener('search',()=>renderSearch(input.value),true);
      input.addEventListener('keydown',e=>{if(e.key==='Escape'){input.value='';closeSearch();input.blur()}},true);
      w.__GH_NAV_UX={search:renderSearch,count:()=>registry().length};
      return true;
    }catch(e){console.error('Gearhead Labs navigation UX failed',e);return false}
  }
  function wait(){try{const f=document.getElementById('app');if(!f)return;if(install(f.contentWindow))return;setTimeout(wait,100)}catch(e){setTimeout(wait,250)}}
  window.addEventListener('load',wait);wait();
})();
