// F1.12.3 mobile-header verification in a real browser engine (headless Chromium).
//   node verify-mobile-header.js <before.html> <after.html>   (needs @sparticuz/chromium + puppeteer-core)
const chromium=require('@sparticuz/chromium');const puppeteer=require('puppeteer-core');const path=require('path');
const [BEFORE,AFTER]=process.argv.slice(2).map(f=>'file://'+path.resolve(f));
const PHONES=[320,360,375,390,414,430],WIDE=[768,1024,1280];
async function measure(b,url,W,tapTest){const p=await b.newPage();const mobile=W<700;
  await p.setViewport({width:W,height:mobile?844:900,deviceScaleFactor:mobile?3:1,isMobile:mobile,hasTouch:mobile});
  await p.goto(url,{waitUntil:'load',timeout:60000});await new Promise(r=>setTimeout(r,300));
  const g=()=>p.evaluate(()=>{const R=s=>{const r=document.querySelector(s).getBoundingClientRect();return {l:+r.left.toFixed(1),r:+r.right.toFixed(1),t:+r.top.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1)}};
    return {menu:R('.menu-btn'),logo:R('.gh-header-brand img'),toggle:R('.gh-unit-toggle'),imperial:R('#btn-imperial'),metric:R('#btn-metric'),profile:R('.gh-profile-btn'),header:R('header.gh-premium-header'),
      scrollW:document.documentElement.scrollWidth,bodyScrollW:document.body.scrollWidth,vw:innerWidth,font:getComputedStyle(document.querySelector('#btn-imperial')).fontSize}});
  const m=await g();m.overlap=+(m.logo.r-m.toggle.l).toFixed(1);
  if(tapTest){ // real tap on the buttons, then read state
    await p.evaluate(()=>renderCalc('tire_size',false));await new Promise(r=>setTimeout(r,150));
    const unitText=()=>p.evaluate(()=>[...document.querySelectorAll('#calc-container .field-unit')].map(e=>e.textContent.trim()).join(','));
    const st=()=>p.evaluate(()=>({sys:UNIT.system,imp:document.querySelector('#btn-imperial').classList.contains('active'),met:document.querySelector('#btn-metric').classList.contains('active')}));
    const s0={...(await st()),units:await unitText()};
    if(mobile) await p.tap('#btn-metric'); else await p.click('#btn-metric'); await new Promise(r=>setTimeout(r,200));
    const s1={...(await st()),units:await unitText()};
    if(mobile) await p.tap('#btn-imperial'); else await p.click('#btn-imperial'); await new Promise(r=>setTimeout(r,200));
    const s2={...(await st()),units:await unitText()};
    m.tap={s0,s1,s2,ok:s0.sys==='imperial'&&s0.imp&&!s0.met&&s1.sys==='metric'&&!s1.imp&&s1.met&&s1.units!==s0.units&&s2.sys==='imperial'&&s2.imp&&!s2.met&&s2.units===s0.units};}
  await p.close();return m;}
(async()=>{const b=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});const rep={before:{},after:{}};let fails=[];
  for(const W of [...PHONES,...WIDE]){rep.before[W]=await measure(b,BEFORE,W,false);rep.after[W]=await measure(b,AFTER,W,true);}
  const f=x=>`${x.l}-${x.r} (w ${x.w}, h ${x.h})`;
  console.log('PHONES              BEFORE (F1.12.2)                                  AFTER (F1.12.3)');
  for(const W of PHONES){const a=rep.before[W],z=rep.after[W];
    console.log(`${String(W).padStart(4)}px  logo ${f(a.logo)} | toggle ${f(a.toggle)} | overlap ${a.overlap>0?a.overlap:'none'}`);
    console.log(`        logo ${f(z.logo)} | toggle ${f(z.toggle)} | overlap ${z.overlap>0?z.overlap:'none'} | buttons h ${z.imperial.h}/${z.metric.h} | font ${z.font} | page scroll ${z.scrollW}/${z.vw} | tap ${z.tap.ok?'OK':'FAIL'}`);
    if(z.overlap>0)fails.push(W+': overlap');if(z.scrollW>z.vw||z.bodyScrollW>z.vw)fails.push(W+': horizontal overflow');if(Math.min(z.imperial.h,z.metric.h)<32)fails.push(W+': toggle < 32px');if(!z.tap.ok)fails.push(W+': tap test');
    if(JSON.stringify(a.menu)!==JSON.stringify(z.menu)&&Math.abs(a.menu.w-z.menu.w)>0.01)fails.push(W+': hamburger size changed');if(a.profile.w!==z.profile.w||a.profile.h!==z.profile.h)fails.push(W+': profile size changed');}
  for(const W of WIDE){const a=rep.before[W],z=rep.after[W];const same=['menu','logo','toggle','imperial','metric','profile','header'].every(k=>JSON.stringify(a[k])===JSON.stringify(z[k]))&&a.font===z.font;
    console.log(`${String(W).padStart(4)}px  desktop/tablet header geometry identical before/after: ${same} | overlap ${z.overlap>0?z.overlap:'none'} | page scroll ${z.scrollW}/${z.vw} | tap ${z.tap.ok?'OK':'FAIL'}`);
    if(!same)fails.push(W+': desktop/tablet geometry changed');if(!z.tap.ok)fails.push(W+': tap test');}
  const t=rep.after[390].tap;console.log(`tap detail @390: ${JSON.stringify(t.s0)} -> Metric ${JSON.stringify(t.s1)} -> Imperial ${JSON.stringify(t.s2)}`);
  require('fs').writeFileSync(path.join(__dirname,'mobile-header-report.json'),JSON.stringify(rep,null,1));
  console.log(fails.length?'MOBILE HEADER CHECK: FAIL\n  '+fails.join('\n  '):'MOBILE HEADER CHECK: PASS');await b.close();process.exit(fails.length?1:0);})().catch(e=>{console.log('ERROR',e.message);process.exit(2)});
