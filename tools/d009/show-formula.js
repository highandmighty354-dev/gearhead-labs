const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const w=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:new VirtualConsole(),beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});w.scrollTo=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;}}).window;
setTimeout(()=>{for(const id of process.argv[3].split(',')){const d=w.document.createElement('div');d.innerHTML=w.ghFormulaBlockHTML(id);
 console.log('=== '+id);d.querySelectorAll('.gh-formula-eq-wrap > *').forEach(e=>console.log('  EQ    ',e.textContent.replace(/\s+/g,' ').trim()));d.querySelectorAll('.gh-var-legend li').forEach(e=>console.log('  LEGEND',e.textContent.replace(/\s+/g,' ').trim()));
 const E=w.GH_ENGINE;if(id==='bearing_life'){for(const t of [3,3.33]){const r=E.calculate(id,{load_br:2000,rated_load:5000,rpm_br:3000,life_exp:t});const inp=r.inputs.find(i=>i.var==='life_exp');console.log(`  ENGINE life_exp=${t} -> p=${inp.bound.p} (===10/3: ${inp.bound.p===10/3}) option "${inp.option_label}" L10=${r.outputs[0].value}`)}}}
 process.exit(0)},300);
