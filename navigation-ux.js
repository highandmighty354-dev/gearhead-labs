/* Gearhead Labs — Navigation / UX layer
   Search is intentionally simple: typing filters the visible calculator
   library to matching calculators only, then exposes those matches as clean
   standalone results. Selecting a result uses the normal calculator router.
*/
(function(){
  function install(w){
    try{
      const d=w.document;
      if(!d || d.__GH_NAV_UX_INSTALLED) return;
      d.__GH_NAV_UX_INSTALLED=true;

      const style=d.createElement('style');
      style.textContent=`
        .gh-nav-hidden{display:none!important}
        .gh-search-results{margin:0;border-top:1px solid rgba(255,255,255,.06);background:#0d0e12}
        .gh-search-result{display:flex;align-items:center;justify-content:space-between;width:100%;box-sizing:border-box;padding:18px 28px;border:0;border-bottom:1px solid rgba(255,255,255,.06);background:transparent;color:#d7dbe2;font:500 18px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left;cursor:pointer}
        .gh-search-result:active{background:rgba(215,161,31,.12)}
        .gh-search-result .arrow{color:#7f8995;font-size:22px;margin-left:16px}
        .gh-search-empty{padding:22px 28px;color:#8994a3;font:500 17px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      `;
      d.head.appendChild(style);

      const input=d.querySelector('#search-input,.search-input,input[type="search"]');
      const storageKey='gh-nav-open-v1';
      const getBlocks=()=>Array.from(d.querySelectorAll('.gh-cat-block'));
      const getHeaders=()=>Array.from(d.querySelectorAll('.gh-cat-head,.cat-header-toggle'));
      const getItems=()=>Array.from(d.querySelectorAll('.calc-item,[data-calc-id],.gh-nav-item,a[href*="?calc="]'));
      const cleanText=s=>String(s||'').replace(/[›→]/g,'').replace(/\s+/g,' ').trim();
      const lower=s=>cleanText(s).toLowerCase();

      let resultsHost=null;
      function ensureHost(){
        if(resultsHost && resultsHost.isConnected)return resultsHost;
        if(!input)return null;
        resultsHost=d.createElement('div');
        resultsHost.className='gh-search-results gh-nav-hidden';
        resultsHost.setAttribute('aria-live','polite');
        const anchor=input.closest('.search-wrap,.search-container,.search-box')||input.parentElement;
        if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(resultsHost,anchor.nextSibling);
        return resultsHost;
      }

      function getId(item){
        let id=item.getAttribute('data-calc-id')||item.getAttribute('data-id')||'';
        const href=item.getAttribute('href')||'';
        if(!id&&href){
          const m=href.match(/[?&]calc=([^&#]+)/);
          if(m)try{id=decodeURIComponent(m[1])}catch(e){id=m[1]}
        }
        if(!id){
          const oc=item.getAttribute('onclick')||'';
          const m=oc.match(/renderCalc\s*\(\s*['"]([^'"]+)['"]/);
          if(m)id=m[1];
        }
        return id;
      }

      function openCalculator(id){
        if(!id)return false;
        const route='?calc='+encodeURIComponent(id);
        try{
          if(typeof w.ghRoute==='function'){
            w.history.pushState(null,'',route);
            w.ghRoute();
            if(w.innerWidth<=640)d.getElementById('sidebar')?.classList.remove('open');
            return true;
          }
        }catch(err){console.error('Gearhead Labs calculator route failed',id,err)}
        try{
          if(typeof w.renderCalc==='function'){
            w.renderCalc(id,false);
            if(w.innerWidth<=640)d.getElementById('sidebar')?.classList.remove('open');
            return true;
          }
        }catch(err){console.error('Gearhead Labs calculator renderer failed',id,err)}
        try{
          w.location.search=route;
          return true;
        }catch(err){console.error('Gearhead Labs calculator location fallback failed',id,err)}
        return false;
      }

      function save(){
        try{localStorage.setItem(storageKey,JSON.stringify(getHeaders().map((h,i)=>({i,open:h.getAttribute('aria-expanded')==='true'||!!h.closest('.gh-cat-block.open')}))))}catch(e){}
      }
      function restore(){
        try{
          const state=JSON.parse(localStorage.getItem(storageKey)||'null');
          if(!Array.isArray(state))return;
          getHeaders().forEach((h,i)=>{const x=state[i];if(!x)return;const open=!!x.open;h.setAttribute('aria-expanded',String(open));const b=h.closest('.gh-cat-block');const p=b&&b.querySelector('.gh-cat-items');if(b&&p){b.classList.toggle('open',open);p.hidden=!open;if(open)p.style.removeProperty('display');else p.style.setProperty('display','none','important')}});
        }catch(e){}
      }

      function clearSearch(){
        getItems().forEach(n=>n.classList.remove('gh-nav-hidden','gh-nav-match','gh-nav-focus'));
        getBlocks().forEach(b=>b.classList.remove('gh-nav-hidden','gh-nav-match'));
        if(resultsHost){resultsHost.innerHTML='';resultsHost.classList.add('gh-nav-hidden')}
      }

      function search(value){
        clearSearch();
        const q=lower(value);
        if(!q)return;

        const matches=[];
        const seen=new Set();
        getItems().forEach(item=>{
          const name=cleanText(item.textContent);
          if(!name)return;
          if(lower(name).includes(q)){
            const id=getId(item);
            const key=id||name.toLowerCase();
            if(!seen.has(key)){seen.add(key);matches.push({id,name,item})}
          }
          item.classList.add('gh-nav-hidden');
        });

        getBlocks().forEach(b=>b.classList.add('gh-nav-hidden'));

        const host=ensureHost();
        if(!host)return;
        host.innerHTML='';
        host.classList.remove('gh-nav-hidden');

        if(!matches.length){
          const empty=d.createElement('div');
          empty.className='gh-search-empty';
          empty.textContent='No calculators found for '+cleanText(value)+'.';
          host.appendChild(empty);
          return;
        }

        matches.forEach(match=>{
          const button=d.createElement('button');
          button.type='button';
          button.className='gh-search-result';
          button.dataset.calcId=match.id||'';
          button.dataset.calcName=match.name;
          const label=d.createElement('span');
          label.textContent=match.name;
          const arrow=d.createElement('span');
          arrow.className='arrow';
          arrow.textContent='›';
          button.append(label,arrow);
          host.appendChild(button);
        });
      }

      if(input){
        input.setAttribute('autocomplete','off');
        input.addEventListener('input',()=>search(input.value));
        input.addEventListener('keydown',e=>{if(e.key==='Escape'){input.value='';search('');input.blur()}});
      }

      d.addEventListener('click',e=>{
        const header=e.target.closest&&e.target.closest('.gh-cat-head,.cat-header-toggle');
        if(header)setTimeout(save,0);

        const result=e.target.closest&&e.target.closest('.gh-search-result');
        if(result){
          e.preventDefault();
          e.stopImmediatePropagation();
          let id=result.dataset.calcId||'';
          if(!id){
            const wanted=lower(result.dataset.calcName);
            const found=getItems().find(item=>lower(item.textContent)===wanted);
            id=found&&getId(found)||'';
          }
          openCalculator(id);
          return;
        }

        const item=e.target.closest&&e.target.closest('.calc-item,[data-calc-id],.gh-nav-item,a[href*="?calc="]');
        if(item)item.classList.add('gh-nav-focus');
      },true);

      d.addEventListener('keydown',e=>{
        if(e.key==='/'&&!/input|textarea|select/i.test(e.target.tagName||'')){e.preventDefault();input&&input.focus()}
      });

      restore();
      if(input&&input.value)search(input.value);
      w.__GH_NAV_UX={search,restore,save,count:getItems().length,openCalculator};
    }catch(e){console.error('Gearhead Labs navigation UX failed',e)}
  }

  function wait(){
    try{
      const f=document.getElementById('app');
      if(!f||!f.contentWindow)return;
      const w=f.contentWindow;
      if(w.document&&w.document.readyState!=='loading'&&w.document.querySelector('#search-input,.search-input,input[type="search"]')){
        install(w);
      }else{
        setTimeout(wait,100);
      }
    }catch(e){setTimeout(wait,100)}
  }
  window.addEventListener('load',wait);
  wait();
})();