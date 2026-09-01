/* Gearhead Labs — final QA correction layer
   Fixes the Decimal Inch converter and removes the legacy oversized unit selector.
*/
(function(){
  'use strict';
  function install(w){
    try{
      if(!w||!w.document)return;
      const d=w.document;
      if(w.__GH_FINAL_QA_FIX)return;
      w.__GH_FINAL_QA_FIX=true;
      const clean=s=>String(s||'').replace(/\s+/g,' ').trim();

      /* Decimal Inch -> nearest common shop fraction (through 1/64). */
      const calcs=Array.isArray(w.CALCS)?w.CALCS:[];
      const target=calcs.find(c=>{
        const n=clean(c&&(c.name||c.label||c.title||'')).toLowerCase();
        return n.includes('decimal inch') && n.includes('fraction');
      });
      if(target&&w.RENDERS&&typeof w.headerHTML==='function'&&typeof w.field==='function'&&typeof w.resultHTML==='function'&&typeof w.calcFooter==='function'){
        const id=target.id;
        w.RENDERS[id]=function(){
          const key='gh_decimal_inch_value';
          const x=Number(typeof w.vd==='function'?w.vd(key,1.536):1.536);
          const valid=Number.isFinite(x);
          let shown='—';
          if(valid){
            const sign=x<0?-1:1, a=Math.abs(x), whole=Math.floor(a), frac=a-whole;
            let bestN=0,bestD=1,bestErr=Infinity;
            [2,4,8,16,32,64].forEach(dn=>{
              const nn=Math.round(frac*dn), err=Math.abs(frac-nn/dn);
              if(err<bestErr){bestErr=err;bestN=nn;bestD=dn;}
            });
            if(bestN===bestD){shown=(sign<0?'-':'')+(whole+1)+' in';}
            else if(bestN===0){shown=(sign<0?'-':'')+whole+' in';}
            else{
              const gcd=(a,b)=>{while(b){const t=a%b;a=b;b=t}return a||1};
              const g=gcd(bestN,bestD), n=bestN/g, den=bestD/g;
              shown=(sign<0?'-':'')+(whole?n===0?String(whole):String(whole)+' ':'')+n+'/'+den+' in';
            }
          }
          return w.headerHTML('Decimal Inch to Nearest Common Fraction','Convert a decimal-inch measurement to the nearest common shop fraction, using common denominators through 1/64 inch.')+
            '<div class="calc-body">'+w.field('Value',key,1.536,'in')+
            '<button class="calc-btn" onclick="renderCalc(\''+id+'\',false)">CONVERT</button>'+w.resultHTML('Nearest Common Fraction',valid?shown:'—','')+
            '<div class="calc-note"><strong>Method:</strong> rounds the fractional inch to the nearest common denominator from 1/2 through 1/64.</div></div>'+w.calcFooter('Decimal Inch to Fraction');
        };
      }

      /* Remove the old large Imperial/Metric segmented control by locating the
         actual two labels, then hiding only their shared control container. */
      function removeLegacyUnitControl(){
        const imperial=Array.from(d.querySelectorAll('button,a,div,span,label')).find(e=>clean(e.textContent)==='Imperial');
        const metric=Array.from(d.querySelectorAll('button,a,div,span,label')).find(e=>clean(e.textContent)==='Metric');
        if(!imperial||!metric)return;
        let a=imperial,b=metric;
        for(let i=0;i<6&&a;i++,a=a.parentElement){
          if(a.contains(metric)){
            const r=a.getBoundingClientRect();
            if(r.width>180&&r.width<500&&r.height<120){a.classList.add('gh-final-legacy-unit-hidden');break;}
          }
        }
      }
      const style=d.createElement('style');
      style.id='GH_FINAL_QA_STYLE';
      style.textContent='.gh-final-legacy-unit-hidden{display:none!important}';
      d.head.appendChild(style);
      removeLegacyUnitControl();
      setTimeout(removeLegacyUnitControl,300);
      setTimeout(removeLegacyUnitControl,1000);

      /* The floating gold equal-sign control obscures calculator content on mobile.
         Hide it only when it is fixed, circular, gold, and positioned at lower-left. */
      function removeObscuringFab(){
        Array.from(d.querySelectorAll('button,a,[role="button"]')).forEach(el=>{
          const r=el.getBoundingClientRect(),cs=w.getComputedStyle(el),txt=clean(el.textContent);
          if(r.width>=45&&r.width<=100&&r.height>=45&&r.height<=100&&r.left<120&&r.bottom>w.innerHeight-180&&cs.position==='fixed'&&/#[d-f][0-9a-f]{3,8}/i.test(cs.backgroundColor||'')){
            if(txt==='='||txt==='≡'||txt==='☰'||txt==='')el.classList.add('gh-final-obscuring-fab-hidden');
          }
        });
      }
      const style2=d.createElement('style');
      style2.textContent='.gh-final-obscuring-fab-hidden{display:none!important}';
      d.head.appendChild(style2);
      removeObscuringFab();
      setTimeout(removeObscuringFab,500);
      setTimeout(removeObscuringFab,1500);
    }catch(e){console.error('Gearhead Labs final QA fix failed',e)}
  }
  function wait(){
    try{const f=document.getElementById('app'),w=f&&f.contentWindow;if(w&&w.document&&w.document.body){install(w);if(!w.__GH_FINAL_QA_FIX)setTimeout(wait,200)}else setTimeout(wait,200)}catch(e){setTimeout(wait,200)}
  }
  wait();
})();
