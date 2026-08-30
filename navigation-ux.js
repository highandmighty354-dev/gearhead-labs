/* Gearhead Labs — Navigation / UX layer
   Strategic task #3: make the complete calculator library easy to browse/search.
*/
(function(){
  function install(w){
    try{
      const d=w.document;
      if(!d || d.__GH_NAV_UX_INSTALLED) return;
      d.__GH_NAV_UX_INSTALLED=true;
      const style=d.createElement('style');
      style.textContent='.gh-nav-match{outline:1px solid rgba(217,154,22,.55);background:rgba(217,154,22,.08)!important}.gh-nav-hidden{display:none!important}.gh-nav-focus{box-shadow:inset 3px 0 0 #d99a16!important;background:rgba(217,154,22,.12)!important}';
      d.head.appendChild(style);

      const input=d.querySelector('#search-input,.search-input,input[type="search"]');
      const storageKey='gh-nav-open-v1';
      const getBlocks=()=>Array.from(d.querySelectorAll('.gh-cat-block'));
      const getHeaders=()=>Array.from(d.querySelectorAll('.gh-cat-head,.cat-header-toggle'));
      const getItems=()=>Array.from(d.querySelectorAll('.calc-item,[data-calc-id]'));
      const text=n=>(n&&n.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();

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
      function clear(){getItems().forEach(n=>n.classList.remove('gh-nav-match','gh-nav-hidden'));getBlocks().forEach(b=>b.classList.remove('gh-nav-match'));}
      function search(value){
        const q=text({textContent:value});
        clear();
        if(!q){return;}
        getItems().forEach(item=>{
          const hit=text(item).includes(q);
          item.classList.toggle('gh-nav-hidden',!hit);
          item.classList.toggle('gh-nav-match',hit);
          if(hit){const b=item.closest('.gh-cat-block');if(b){b.classList.add('open');const p=b.querySelector('.gh-cat-items');const h=b.querySelector('.gh-cat-head');if(p){p.hidden=false;p.style.removeProperty('display')}if(h)h.setAttribute('aria-expanded','true')}}
        });
        // Also support navigation implementations that render calculator links without .calc-item.
        if(!getItems().length){
          d.querySelectorAll('a,button').forEach(el=>{if(text(el).includes(q))el.classList.add('gh-nav-match')});
        }
      }
      if(input){
        input.setAttribute('autocomplete','off');
        input.addEventListener('input',()=>search(input.value));
        input.addEventListener('keydown',e=>{if(e.key==='Escape'){input.value='';search('');input.blur()}});
      }
      d.addEventListener('click',e=>{
        const h=e.target.closest&&e.target.closest('.gh-cat-head,.cat-header-toggle');
        if(h){setTimeout(save,0);}
        const item=e.target.closest&&e.target.closest('.calc-item,[data-calc-id]');
        if(item){getItems().forEach(n=>n.classList.remove('gh-nav-focus'));item.classList.add('gh-nav-focus');}
      },true);
      d.addEventListener('keydown',e=>{
        if(e.key==='/' && !/input|textarea|select/i.test(e.target.tagName||'')){e.preventDefault();input&&input.focus();}
      });
      restore();
      if(input&&input.value)search(input.value);
      w.__GH_NAV_UX={search,restore,save,count:getItems().length};
    }catch(e){console.error('Gearhead Labs navigation UX failed',e)}
  }
  function wait(){try{const f=document.getElementById('app');if(f&&f.contentWindow){install(f.contentWindow);setTimeout(()=>install(f.contentWindow),300);setTimeout(()=>install(f.contentWindow),1000)}}catch(e){}}
  window.addEventListener('load',wait);wait();
})();
