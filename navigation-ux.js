/* Gearhead Labs — Navigation / UX layer
   Mobile-safe calculator search and routing.
   IMPORTANT: do not mark installation complete until the iframe DOM exists.
*/
(function(){
  function install(w){
    try{
      const d=w && w.document;
      if(!d || d.__GH_NAV_UX_INSTALLED) return false;

      const input=d.querySelector('#search-input,.search-input,input[type="search"]');
      const sidebar=d.querySelector('.sidebar');
      if(!input || !sidebar) return false;

      d.__GH_NAV_UX_INSTALLED=true;

      if(!d.getElementById('GH_NAV_UX_SEARCH_CSS')){
        const style=d.createElement('style');
        style.id='GH_NAV_UX_SEARCH_CSS';
        style.textContent='.gh-nav-search-results{margin:0;border-top:1px solid #21242c;background:#0f1013;max-height:55vh;overflow:auto}.gh-nav-search-results[hidden]{display:none!important}.gh-nav-search-result{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:14px;border:0;border-bottom:1px solid #21242c;background:transparent;color:#c3c8d1;text-align:left;font:600 14px/1.3 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}.gh-nav-search-result:active{background:rgba(217,154,22,.14);color:#fff}.gh-nav-search-result strong{display:block;color:#f5f6f8}.gh-nav-search-result small{display:block;margin-top:3px;color:#8c96a5;font-size:10px;font-weight:500}.gh-nav-search-result b{color:#d99a16;font-size:20px}.gh-nav-search-empty{padding:18px 14px;color:#8c96a5;font-size:12px}';
        d.head.appendChild(style);
      }

      let results=d.querySelector('.gh-nav-search-results');
      if(!results){
        results=d.createElement('div');
        results.className='gh-nav-search-results';
        results.hidden=true;
        const wrap=input.closest('.search-wrap') || input.parentElement;
        wrap.appendChild(results);
      }

      const clean=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
      const calcs=()=>Array.isArray(w.CALCS)?w.CALCS.filter(c=>c&&c.id&&c.id!=='dashboard'&&(c.name||c.label)):[];

      function closeSearch(){
        results.hidden=true;
        results.innerHTML='';
      }

      function renderSearch(value){
        const q=clean(value);
        if(!q){closeSearch();return;}
        const matches=calcs().filter(c=>{
          const hay=[c.name,c.label,c.category,c.cat,c.lab,c.description,c.desc].map(clean).join(' ');
          return hay.includes(q);
        }).slice(0,60);
        results.hidden=false;
        results.innerHTML='';
        if(!matches.length){
          const empty=d.createElement('div');
          empty.className='gh-nav-search-empty';
          empty.textContent='No calculators found for '+String(value);
          results.appendChild(empty);
          return;
        }
        matches.forEach(c=>{
          const b=d.createElement('button');
          b.type='button';
          b.className='gh-nav-search-result';
          const span=d.createElement('span');
          const strong=d.createElement('strong');
          strong.textContent=c.name||c.label;
          const small=d.createElement('small');
          small.textContent=c.category||c.cat||c.lab||'Calculator';
          span.append(strong,small);
          const arrow=d.createElement('b');
          arrow.textContent='›';
          b.append(span,arrow);
          b.addEventListener('click',function(e){
            e.preventDefault();
            e.stopPropagation();
            openCalculator(c.id);
          });
          results.appendChild(b);
        });
      }

      function openCalculator(id){
        try{localStorage.setItem('gh-nav-pending-calc-v4',id)}catch(e){}
        try{
          if(typeof w.renderCalc!=='function') throw new Error('renderCalc unavailable');
          w.renderCalc(id);
          const url=new URL(w.location.href);
          url.searchParams.set('calc',id);
          w.history.replaceState(null,'',url.pathname+'?'+url.searchParams.toString()+url.hash);
          closeSearch();
          input.value='';
          if(w.innerWidth<=640){
            const sb=d.getElementById('sidebar')||sidebar;
            sb.classList.remove('open');
          }
          setTimeout(()=>{
            try{
              if(w.currentCalc!==id) w.renderCalc(id);
            }catch(e){console.error('Gearhead Labs calculator restore failed',id,e)}
          },100);
          setTimeout(()=>{try{localStorage.removeItem('gh-nav-pending-calc-v4')}catch(e){}},1500);
        }catch(err){
          console.error('Gearhead Labs calculator routing failed',id,err);
          try{w.location.href='?calc='+encodeURIComponent(id)}catch(e){}
        }
      }

      input.addEventListener('input',function(){
        renderSearch(input.value);
      },true);
      input.addEventListener('search',function(){renderSearch(input.value)},true);
      input.addEventListener('keydown',function(e){
        if(e.key==='Escape'){
          input.value='';
          closeSearch();
          input.blur();
        }
      },true);

      w.__GH_NAV_UX={search:renderSearch,count:calcs().length};
      return true;
    }catch(e){
      console.error('Gearhead Labs navigation UX failed',e);
      return false;
    }
  }

  function wait(){
    try{
      const f=document.getElementById('app');
      if(!f) return;
      if(install(f.contentWindow)) return;
      // The iframe may not have built its DOM yet. Retry without ever
      // setting the installed flag until install() actually succeeds.
      setTimeout(wait,100);
    }catch(e){setTimeout(wait,250)}
  }

  window.addEventListener('load',wait);
  wait();
})();
