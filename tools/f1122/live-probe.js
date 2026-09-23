const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const w=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:new VirtualConsole(),beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});w.scrollTo=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;}}).window;
setTimeout(()=>{const d=w.document,c=d.getElementById('calc-container');const T=x=>x.textContent.replace(/\s+/g,' ').trim();
 const run=(v,from)=>{const S=w.eval('CALC_PERSISTENT_STATE');for(const k of Object.keys(S))delete S[k];c.innerHTML='';w.renderCalc('speed_converter',false);d.getElementById('s_in').value=String(v);d.getElementById('s_from').value=from;w.renderCalc('speed_converter',false);return [...c.querySelectorAll('.mini-result')].map(m=>T(m)).join(' | ')};
 console.log('CURRENT LIVE OUTPUTS');
 for(const [v,f] of [[60,'fps'],[1,'fps'],[10,'fps'],[100,'fps'],[0,'fps'],[0,'kph'],[0,'mps'],[40.91,'mph'],[65.84,'kph'],[18.29,'mps'],[1,'mph'],[1,'kph'],[1,'mps'],[0,'mph']]) console.log(`  ${String(v).padStart(6)} ${f.padEnd(4)} -> ${run(v,f)}`);
 const fb=d.createElement('div');fb.innerHTML=w.ghFormulaBlockHTML('speed_converter');console.log('\nPUBLISHED FORMULA:',T(fb).slice(0,420));
 const E=w.GH_ENGINE;console.log('\nENGINE (registry, mph-only):',JSON.stringify(E.calculate('speed_converter',{s_in:60}).outputs.map(o=>[o.label,o.value])),'| inputs:',E.describe('speed_converter').inputs.map(i=>i.var).join(','));
 process.exit(0)},300);
