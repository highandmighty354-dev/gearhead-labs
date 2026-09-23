// Snapshot every registry entry of a page: fingerprint, calculate() results for
// fixed input sets, published formula HTML. Used before/after D-009 to PROVE
// entries without an options block are unchanged.
//   node d009/snapshot.js <page.html> <out.json>
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const w=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:new VirtualConsole(),beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});w.scrollTo=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;}}).window;
setTimeout(()=>{const E=w.GH_ENGINE;const out={engine:E.version,entries:{}};
 for(const id of E.listCalculators()){const d=E.describe(id);
  const sets={A:{},B:{},Z:{}};d.inputs.forEach((x,i)=>{sets.A[x.var]=1+0.37*(i+1);sets.B[x.var]=10*(i+1)+0.5;sets.Z[x.var]=0;});
  const results={};for(const [k,inp] of Object.entries(sets)) results[k]=E.calculate(id,inp);
  out.entries[id]={fingerprint:d.formula_version,describe:d,results,formula_html:w.ghFormulaBlockHTML(id)||'',formula_strip:w.ghE110Formula(id)};}
 fs.writeFileSync(process.argv[3],JSON.stringify(out));console.log('snapshot',Object.keys(out.entries).length,'entries, engine',out.engine);process.exit(0)},300);
