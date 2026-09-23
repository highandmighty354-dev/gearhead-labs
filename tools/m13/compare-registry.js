// Compare two registry snapshots entry by entry, excluding only the ids given.
const A=require(require('path').resolve(process.argv[2])),B=require(require('path').resolve(process.argv[3]));const EX=new Set((process.argv[4]||'').split(',').filter(Boolean));
const c={checked:0,fp:0,res:0,html:0,strip:0,units:0,valid:0};const diffs=[];
for(const id of Object.keys(A.entries)){if(EX.has(id))continue;const a=A.entries[id],b=B.entries[id];if(!b){diffs.push(id+' missing');continue}c.checked++;
 if(a.fingerprint!==b.fingerprint){c.fp++;diffs.push(id+' fingerprint')} if(JSON.stringify(a.results)!==JSON.stringify(b.results)){c.res++;diffs.push(id+' results')}
 if(a.formula_html!==b.formula_html){c.html++;diffs.push(id+' html')} if(a.formula_strip!==b.formula_strip){c.strip++;diffs.push(id+' strip')}
 for(const k of Object.keys(a.results)){if(a.results[k].outputs.map(o=>o.unit).join()!==b.results[k].outputs.map(o=>o.unit).join())c.units++;if(a.results[k].state!==b.results[k].state)c.valid++}}
console.log(`registry entries compared (excluding ${[...EX].join(',')}): ${c.checked} | fingerprint ${c.fp} | result JSON ${c.res} | formula HTML ${c.html} | strip ${c.strip} | units ${c.units} | validity ${c.valid}`);
diffs.slice(0,10).forEach(d=>console.log('  x',d));process.exit(diffs.length?1:0);
