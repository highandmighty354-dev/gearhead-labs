const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const w=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:new VirtualConsole(),beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});w.scrollTo=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;}}).window;
setTimeout(()=>{const ids=['distance_converter','volume_converter','pressure_converter','power_converter','injector_flow','wind_et','max_rpm','fuse_sizing','ring_gap','bearing_life'];const out={};
 for(const id of ids){const d=w.document;d.getElementById('calc-container').innerHTML='';w.renderCalc(id,false);
  const fields=[...d.querySelectorAll('#calc-container input,#calc-container select')].filter(e=>e.id&&e.type!=='radio'&&e.type!=='checkbox').map(e=>{const b=e.closest('.field');const l=b&&b.querySelector('.field-label');return {id:e.id,tag:e.tagName,label:l?l.textContent.trim():'',value:e.value,options:e.tagName==='SELECT'?[...e.options].map(o=>({value:o.value,label:o.textContent.trim()})):undefined}});
  const R=w.eval('({GH_E1_FORMULAS,GH_E101_FORMULAS,GH_LEGACY_FORMULAS,GH_BACKFILL_FORMULAS})');let reg=null;for(const r of ['GH_E1_FORMULAS','GH_E101_FORMULAS','GH_BACKFILL_FORMULAS','GH_LEGACY_FORMULAS'])if(R[r][id]){reg={registry:r,spec:JSON.parse(JSON.stringify(R[r][id]))};break;}
  out[id]={fields,reg,results:[...d.querySelectorAll('#calc-container .mini-result .label,#calc-container .result-label')].map(x=>x.textContent.trim())};}
 fs.writeFileSync('d009/livefacts.json',JSON.stringify(out,null,1));
 for(const [id,o] of Object.entries(out)){console.log('##',id,'| registry',o.reg.registry,'vars',o.reg.spec.vars.join(','),'| live results:',o.results.join(' / '));o.fields.forEach(f=>console.log('   ',f.tag,f.id,JSON.stringify(f.label),f.options?f.options.map(x=>x.value+'='+x.label).join(' | '):'value '+f.value));}
 process.exit(0)},300);
