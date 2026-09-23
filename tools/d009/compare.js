// Compare two snapshots. For every entry WITHOUT an options block in the AFTER
// page: fingerprint, result JSON (engine version fields normalised), formula
// HTML and formula strip must be byte-identical.
const A=require(require('path').resolve(process.argv[2])),B=require(require('path').resolve(process.argv[3]));
const norm=r=>JSON.stringify(r).split('"engine_version":"'+A.engine+'"').join('"engine_version":"X"').split('gh-engine@'+A.engine).join('gh-engine@X');
const normB=r=>JSON.stringify(r).split('"engine_version":"'+B.engine+'"').join('"engine_version":"X"').split('gh-engine@'+B.engine).join('gh-engine@X');
const withOptions=new Set(Object.entries(B.entries).filter(([,e])=>e.describe.inputs.some(i=>i.kind==='categorical')||/INVALID_OPTION_DECLARATION/.test(JSON.stringify(e.results))).map(x=>x[0]));
const c={checked:0,fp:0,results:0,html:0,strip:0,units:0,validity:0},diffs=[];
for(const id of Object.keys(A.entries)){ if(withOptions.has(id)) continue; const a=A.entries[id],b=B.entries[id]; if(!b){diffs.push(id+': missing');continue;} c.checked++;
 if(a.fingerprint!==b.fingerprint){c.fp++;diffs.push(id+': fingerprint')}
 if(norm(a.results)!==normB(b.results)){c.results++;diffs.push(id+': results')}
 if(a.formula_html!==b.formula_html){c.html++;diffs.push(id+': formula html')}
 if(a.formula_strip!==b.formula_strip){c.strip++;diffs.push(id+': formula strip')}
 for(const k of Object.keys(a.results)){const ua=a.results[k].outputs.map(o=>o.unit).join('|'),ub=b.results[k].outputs.map(o=>o.unit).join('|');if(ua!==ub)c.units++;const va=a.results[k].state+a.results[k].outputs.map(o=>o.state).join(),vb=b.results[k].state+b.results[k].outputs.map(o=>o.state).join();if(va!==vb)c.validity++;}}
console.log(`engine ${A.engine} -> ${B.engine} | entries with options (excluded, compared separately): ${withOptions.size} [${[...withOptions].join(' ')}]`);
console.log(`WITHOUT options: ${c.checked} checked | fingerprint diffs ${c.fp} | result-JSON diffs ${c.results} | formula-HTML diffs ${c.html} | strip diffs ${c.strip} | unit diffs ${c.units} | validity diffs ${c.validity}`);
diffs.slice(0,10).forEach(d=>console.log('  x',d));process.exit(diffs.length?1:0);
