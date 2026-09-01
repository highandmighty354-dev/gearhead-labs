/* Gearhead Labs — authoritative navigation/search layer
   Search uses the complete repaired calculator registry, not just visible DOM.
   Includes common automotive aliases so searches such as MPG find the actual
   calculators even when their displayed names do not contain the abbreviation.
*/
(function(){
  function install(w){
    try{
      const d=w.document;
      if(!d||d.__GH_NAV_UX_INSTALLED)return;
      d.__GH_NAV_UX_INSTALLED=true;
      const clean=s=>String(s==null?'':s).replace(/[›→]/g,'').replace(/\s+/g,' ').trim();
      const nameOf=c=>clean(c&&(c.name||c.label||c.title||c.id));
      const catOf=c=>clean(c&&(c.cat||c.category||c.lab||''));
      const registry=()=>Array.isArray(w.CALCS)?w.CALCS.filter(c=>c&&typeof c.id==='string'&&nameOf(c)):[];
      const textOf=c=>{
        const vals=[];
        try{Object.keys(c||{}).forEach(k=>{let v;try{v=c[k]}catch(e){return};if(typeof v==='function')vals.push(String(v));else if(v&&typeof v==='object'){try{vals.push(JSON.stringify(v))}catch(e){}}else vals.push(String(v==null?'':v))})}catch(e){}
        return clean(vals.join(' ')).toLowerCase();
      };
      const aliases={
        mpg:['mpg','miles per gallon','fuel economy','fuel efficiency','fuel consumption','mileage'],
        hp:['hp','horsepower'],
        torque:['torque','lb-ft','lb ft','nm'],
        rpm:['rpm','revolutions per minute'],
        boost:['boost','psi','manifold pressure'],
        displacement:['displacement','cubic inch','ci','litre','liter'],
        compression:['compression ratio','compression'],
        afr:['afr','air fuel ratio','air/fuel ratio'],
        fuel:['fuel','gasoline','diesel','petrol']
      };
      const style=d.createElement('style');
      style.textContent=`
        .gh-nav-hidden{display:none!important}
        .gh-search-results{margin:0;border-top:1px solid rgba(255,255,255,.06);background:#0d0e12}
        .gh-search-result{display:flex;align-items:center;justify-content:space-between;width:100%;box-sizing:border-box;padding:15px 22px;border:0;border-bottom:1px solid rgba(255,255,255,.06);background:transparent;color:#d7dbe2;font:600 16px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left;cursor:pointer}
        .gh-search-result:active{background:rgba(215,161,31,.12)}
        .gh-search-result small{display:block;margin-top:3px;color:#7f8995;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
        .gh-search-result .arrow{color:#d7a11f;font-size:21px;margin-left:16px}
        .gh-search-empty{padding:18px 22px;color:#8994a3;font:500 15px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      `;
      d.head.appendChild(style);
      const input=d.querySelector('#search-input,.search-input,input[type="search"]');
      let host=null;
      function ensureHost(){
        if(host&&host.isConnected)return host;
        if(!input)return null;
        host=d.createElement('div');host.className='gh-search-results';host.hidden=true;
        const anchor=input.closest('.search-wrap,.search-container,.search-box')||input.parentElement;
        if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(host,anchor.nextSibling);
        return host;
      }
      function openCalculator(id){
        if(!id)return false;
        const route='?calc='+encodeURIComponent(id);
        try{if(typeof w.__GH_OPEN_CALCULATOR==='function')return w.__GH_OPEN_CALCULATOR(id,true)}catch(e){}
        try{w.history.pushState(null,'',route);if(typeof w.ghRoute==='function'){w.ghRoute();if(w.innerWidth<=640)d.getElementById('sidebar')?.classList.remove('open');return true}}catch(e){console.error('Gearhead Labs calculator route failed',id,e)}
        try{if(typeof w.renderCalc==='function'){w.renderCalc(id,false);return true}}catch(e){console.error('Gearhead Labs calculator renderer failed',id,e)}
        return false;
      }
      function search(value){
        const q=clean(value).toLowerCase();
        const h=ensureHost();if(!h)return;
        h.innerHTML='';
        if(!q){h.hidden=true;return}
        const terms=aliases[q]||[q];
        const matches=[];const seen=new Set();
        registry().forEach(c=>{
          const text=textOf(c);
          if(terms.some(t=>text.includes(t))&&!seen.has(c.id)){seen.add(c.id);matches.push(c)}
        });
        matches.sort((a,b)=>{
          const an=nameOf(a).toLowerCase(),bn=nameOf(b).toLowerCase();
          const rank=n=>n===q?0:n.startsWith(q)?1:2;
          return rank(an)-rank(bn)||an.localeCompare(bn);
        });
        h.hidden=false;
        if(!matches.length){const e=d.createElement('div');e.className='gh-search-empty';e.textContent='No calculators found for '+clean(value)+'.';h.appendChild(e);return}
        matches.forEach(c=>{
          const b=d.createElement('button');b.type='button';b.className='gh-search-result';b.dataset.calcId=c.id;
          const left=d.createElement('span');left.textContent=nameOf(c);
          const small=d.createElement('small');small.textContent=catOf(c);left.appendChild(small);
          const arrow=d.createElement('span');arrow.className='arrow';arrow.textContent='›';b.append(left,arrow);h.appendChild(b);
        });
      }
      if(input){
        input.setAttribute('autocomplete','off');
        input.oninput=null;
        input.addEventListener('input',e=>{e.stopImmediatePropagation();search(input.value)},true);
        input.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopImmediatePropagation();input.value='';search('');input.blur()}},true);
      }
      d.addEventListener('click',e=>{
        const result=e.target.closest&&e.target.closest('.gh-search-result');
        if(result){e.preventDefault();e.stopImmediatePropagation();openCalculator(result.dataset.calcId);return}
      },true);
      w.__GH_NAV_UX={search,restore:function(){},save:function(){},count:()=>registry().length,openCalculator};
      if(input&&input.value)search(input.value);
    }catch(e){console.error('Gearhead Labs navigation UX failed',e)}
  }
  function wait(){try{const f=document.getElementById('app');if(!f||!f.contentWindow){setTimeout(wait,100);return}const w=f.contentWindow;if(w.document&&w.document.readyState!=='loading'&&w.document.querySelector('#search-input,.search-input,input[type="search"]'))install(w);else setTimeout(wait,100)}catch(e){setTimeout(wait,100)}}
  window.addEventListener('load',wait);wait();
})();
