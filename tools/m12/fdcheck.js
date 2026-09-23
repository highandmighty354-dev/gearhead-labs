const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const w=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:new VirtualConsole(),beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});w.scrollTo=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;}}).window;
setTimeout(()=>{const ids=require(process.argv[3]||'./engine-migrated.json').calculators;const bad=[];
 for(const id of ids){const d=w.document.createElement('div');d.innerHTML=w.ghFormulaBlockHTML(id)||'';d.querySelectorAll('details,pre,code').forEach(n=>{if(/JS Implementation/.test(n.textContent))n.remove()});
  const t=d.textContent.replace(/\s+/g,' ');const i=t.indexOf('JS Implementation');const typeset=i<0?t:t.slice(0,i);
  const art=typeset.match(/===|!==|\|\||&&|\bNaN\b|\?|Number\.isFinite|\.every\(|=>/g);if(art)bad.push([id,[...new Set(art)].join(' '),typeset.slice(0,140)])}
 console.log('migrated checked',ids.length,'with code artifacts in typeset formula:',bad.length);bad.slice(0,12).forEach(b=>console.log('  ',b[0],'|',b[1],'|',b[2]));process.exit(0)},300);
