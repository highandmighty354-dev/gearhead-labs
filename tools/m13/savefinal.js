// Evidence: the REAL shared save on the ACTUAL F1.12.1 file (no in-memory patching). Fresh page per case.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const html=fs.readFileSync(process.argv[2],'utf8');
const page=()=>new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:new VirtualConsole(),beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});w.scrollTo=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;}}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function run(name,vals){const w=page();await sleep(250);const d=w.document;const P=()=>w.eval('getActiveProfile()');
 const before=P().weight,who=P().name;w.eval("currentCalc='understeer_gradient'");d.getElementById('calc-container').innerHTML='';w.renderCalc('understeer_gradient',false);
 if(vals){for(const[k,v]of Object.entries(vals))d.getElementById(k).value=String(v);w.renderCalc('understeer_gradient',false);}
 const shown=d.querySelector('#calc-container .result-value').textContent.trim();w.eval('ghmSaveCurrentToVehicle()');const p=P();const sv=p.savedCalculatorInputs.understeer_gradient.fields;
 console.log(`${name.padEnd(38)} ${who.slice(0,24)}: weight ${before} -> ${p.weight} ${p.weight===before?'UNCHANGED':'OVERWRITTEN'} | result ${shown} | calc state saved: ug_vw=${sv.ug_vw.value}, ug_fpct=${sv.ug_fpct.value}`);}
(async()=>{await run('A: untouched, save');await run('B: only Front Weight % -> 55, save',{ug_fpct:55});await run('C: Vehicle Weight -> 7600, save',{ug_vw:7600});process.exit(0)})();
