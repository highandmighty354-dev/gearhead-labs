// Per content entry: CONTENT JSON, rendered calculator text on a fresh open, formula block HTML.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const w=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:new VirtualConsole(),beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});w.scrollTo=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;}}).window;
setTimeout(()=>{const d=w.document,c=d.getElementById('calc-container');const out={};const C=w.eval('GH_CALC_CONTENT');
 for(const id of Object.keys(C)){const S=w.eval('CALC_PERSISTENT_STATE');for(const k of Object.keys(S))delete S[k];c.innerHTML='';let rendered;try{w.renderCalc(id,false);rendered=c.innerHTML}catch(e){rendered='THROWS '+e.message}
  out[id]={content:JSON.stringify(C[id]),rendered,formula:(typeof w.ghFormulaBlockHTML==='function'&&w.ghFormulaBlockHTML(id))||''}}
 fs.writeFileSync(process.argv[3],JSON.stringify(out));console.log('content snapshot',Object.keys(out).length,'entries');process.exit(0)},300);
