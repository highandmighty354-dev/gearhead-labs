const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
function load(f){return new JSDOM(fs.readFileSync(f,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:new VirtualConsole(),beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});w.scrollTo=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;}}).window}
const A=load(process.argv[2]),B=load(process.argv[3]);
const txt=(w,h)=>{const d=w.document.createElement('div');d.innerHTML=h||'';return d.textContent.replace(/\s+/g,' ').trim()};
setTimeout(()=>{const ids=require('./engine-migrated.json').history[1].ids;const rep={};
 for(const id of ids){const a=txt(A,A.ghFormulaBlockHTML(id)),b=txt(B,B.ghFormulaBlockHTML(id));const fa=A.ghE110Formula(id),fb=B.ghE110Formula(id);
  rep[id]={block_changed:a!==b,strip_changed:fa!==fb,before:a,after:b,strip_before:fa,strip_after:fb};}
 const ch=Object.entries(rep).filter(([,r])=>r.block_changed||r.strip_changed);
 console.log('formula display changed for',ch.length,'of',ids.length);
 for(const [id,r] of ch.slice(0,3)) console.log('--',id,'\n BEFORE:',r.before.slice(0,260),'\n AFTER :',r.after.slice(0,260));
 fs.writeFileSync('formula-display-diff.json',JSON.stringify(rep,null,1));process.exit(0)},300);
