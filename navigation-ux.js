/* Gearhead Labs — Navigation / UX layer
   Deterministic calculator search + mobile-safe calculator routing.
   Search is rendered from the authoritative CALCS registry instead of trying
   to hide/rebuild the existing accordion DOM while the user types.
*/
(function(){
  function install(w){
    try{
      const d=w.document;
      if(!d || d.__GH_NAV_UX_INSTALLED) return;
      d.__GH_NAV_UX_INSTALLED=true;

      const style=d.createElement('style');
      style.id='GH_NAV_UX_SEARCH_CSS';
      style.textContent=`
        .gh-nav-search-results{margin:0;border-top:1px solid #21242c;background:#0f1013;max-height:55vh;overflow:auto}
        .gh-nav-search-results[hidden]{display:none!important}
        .gh-nav-search-result{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:13px 14px;border:0;border-bottom:1px solid #21242c;background:transparent;color:#c3c8d1;text-align:left;font:600 13px/1.3 Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;cursor:pointer}
        .gh-nav-search-result:hover,.gh-nav-search-result:active{background:rgba(217,154,22,.12);color:#f5f6f8}
        .gh-nav-search-result strong{display:block;color:#f5f6f8;font-weight:650}
        .gh-nav-search-result small{display:block;margin-top:3px;color:#8c96a5;font-size:10px;font-weight:500}
        .gh-nav-search-result b{color:#d99a16;font-size:18px;line-height:1}
        .gh-nav-search-empty{padding:18px 14px;color:#8c96a5;font-size:12px;line-height:1.5}
      `;
      d.head.appendChild(style);

      const input=d.querySelector('#search-input,.search-input,input[type="search"]');
      const sidebar=d.querySelector('.sidebar');
      if(!input || !sidebar) return;

      let results=d.querySelector('.gh-nav-search-results');
      if(!results){
        results=d.createElement('div');
        results.className='gh-nav-search-results';
        results.hidden=true;
        const wrap=input.closest('.search-wrap')||input.parentElement;
        wrap.appendChild(results);
      }

      const storageKey='gh-nav-open-v1';
      const text=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
      const getCalcs=()=>Array.isArray(w.CALCS)?w.CALCS.filter(c=>c&&c.id&&c.id!=='dashboard'&&(c.name||c.label)):[];

      function save(){
        try{
          localStorage.setItem(storageKey,JSON.stringify(
            Array.from(d.querySelectorAll('.gh-cat-head,.cat-header-toggle')).map((h,i)=>({
              i,
              open:h.getAttribute('aria-expanded')==='true'||!!h.closest('.gh-cat-block.open')
            }))
          ));
        }catch(e){}
      }

      function restore(){
        try{
          const state=JSON.parse(localStorage.getItem(storageKey)||'null');
          if(!Array.isArray(state))return;
          Array.from(d.querySelectorAll('.gh-cat-head,.cat-header-toggle')).forEach((h,i)=>{
            const x=state[i]; if(!x)return;
            const open=!!x.open;
            h.setAttribute('aria-expanded',String(open));
            const b=h.closest('.gh-cat-block');
            const p=b&&b.querySelector('.gh-cat-items');
            if(b&&p){b.classList.toggle('open',open);p.hidden=!open;if(open)p.style.removeProperty('display');else p.style.setProperty('display','none','important')}
          });
        }catch(e){}
      }

      function closeSearch(){
        results.hidden=true;
        results.innerHTML='';
        sidebar.classList.remove('gh-searching');
        Array.from(sidebar.children).forEach(el=>{
          if(el!==input.closest('.search-wrap')) el.style.removeProperty('display');
        });
      }

      function openSearch(){
        sidebar.classList.add('gh-searching');
        const wrap=input.closest('.search-wrap');
        Array.from(sidebar.children).forEach(el=>{
          if(el!==wrap) el.style.setProperty('display','none','important');
        });
        results.hidden=false;
      }

      function renderSearch(value){
        const q=text(value);
        if(!q){closeSearch();return;}
        const matches=getCalcs().filter(c=>{
          const name=text(c.name||c.label);
          const cat=text(c.cat||c.category||c.lab);
          const desc=text(c.description||c.desc||'');
          return name.includes(q)||cat.includes(q)||desc.includes(q);
        }).slice(0,60);

        openSearch();
        if(!matches.length){
          results.innerHTML='<div class="gh-nav-search-empty">No calculators found for <strong>'+String(value).replace(/[&<>]/g,'')+'</strong>.</div>';
          return;
        }

        results.innerHTML='';
        matches.forEach(c=>{
          const b=d.createElement('button');
          b.type='button';
          b.className='gh-nav-search-result';
          const name=d.createElement('span');
          const strong=d.createElement('strong');
          strong.textContent=c.name||c.label;
          const small=d.createElement('small');
          small.textContent=c.cat||c.category||c.lab||'Calculator';
          name.appendChild(strong);name.appendChild(small);
          const arrow=d.createElement('b');arrow.textContent='›';
          b.appendChild(name);b.appendChild(arrow);
          b.addEventListener('click',function(ev){
            ev.preventDefault();ev.stopPropagation();
            openCalculator(c.id);
          });
          results.appendChild(b);
        });
      }

      function openCalculator(id){
        try{localStorage.setItem('gh-nav-pending-calc-v3',id)}catch(e){}
        try{
          if(typeof w.renderCalc!=='function') throw new Error('renderCalc unavailable');
          w.renderCalc(id);
          const url=new URL(w.location.href);
          url.searchParams.set('calc',id);
          w.history.replaceState(null,'',url.pathname+'?'+url.searchParams.toString()+url.hash);
          input.value='';
          closeSearch();
          if(w.innerWidth<=640)d.getElementById('sidebar')?.classList.remove('open');
          setTimeout(()=>{
            try{if(w.currentCalc!==id)w.renderCalc(id)}catch(e){console.error('GH calculator restore failed',id,e)}
            try{localStorage.removeItem('gh-nav-pending-calc-v3')}catch(e){}
          },250);
        }catch(err){
          console.error('Gearhead Labs calculator search routing failed',id,err);
          try{w.location.href='?calc='+encodeURIComponent(id)}catch(e){}
        }
      }

      // Capture the input before any legacy search handler can rebuild the nav;
      // render our authoritative result list on the next turn.
      input.addEventListener('input',function(){
        const value=input.value;
        setTimeout(()=>renderSearch(value),0);
      },true);
      input.addEventListener('search',function(){renderSearch(input.value)},true);
      input.addEventListener('keydown',function(e){
        if(e.key==='Escape'){input.value='';closeSearch();input.blur();}
      },true);

      // Keep category accordions usable when search is not active.
      d.addEventListener('click',function(ev){
        const h=ev.target&&ev.target.closest?ev.target.closest('.gh-cat-head,.cat-header-toggle'):null;
        if(h)setTimeout(save,0);
      },true);

      restore();
      if(input.value)renderSearch(input.value);

      // Restore a calculator only when explicitly left pending by a search tap.
      let pending=null;
      try{pending=localStorage.getItem('gh-nav-pending-calc-v3')}catch(e){}
      if(pending && getCalcs().some(c=>c.id===pending)){
        setTimeout(()=>{
          try{if(w.currentCalc!==pending)w.renderCalc(pending)}catch(e){}
          try{localStorage.removeItem('gh-nav-pending-calc-v3')}catch(e){}
        },500);
      }

      w.__GH_NAV_UX={search:renderSearch,restore,save,count:getCalcs().length};
    }catch(e){console.error('Gearhead Labs navigation UX failed',e)}
  }

  function wait(){
    try{
      const f=document.getElementById('app');
      if(f&&f.contentWindow){
        install(f.contentWindow);
        setTimeout(()=>install(f.contentWindow),300);
        setTimeout(()=>install(f.contentWindow),1000);
      }
    }catch(e){}
  }
  window.addEventListener('load',wait);
  wait();
})();
