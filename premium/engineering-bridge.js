/* Gearhead Labs Premium — Engineering Lab bridge to the calculator engine.
   The 14 analyzers run inside the F1.12.3 frame (engineering-expansion-v1.js);
   this bridge only loads that module for entitled users, opens analyzers, and
   captures/restores analyzer state as structured JSON. It never computes. */
(function(){
  'use strict';
  const GHP = window.GHP = window.GHP || {};
  const M = GHP.models, S = GHP.services;

  const frameWin = () => { try { return window.GHShell && window.GHShell.frame.contentWindow; } catch(e){ return null; } };
  const frameReady = () => window.GHShell && window.GHShell.isReady() ? Promise.resolve()
    : new Promise(r=>window.addEventListener('gh:frameready',()=>r(),{ once:true }));
  const settle = (ms=60) => new Promise(r=>setTimeout(r,ms));

  /* Load the module only for users the entitlement service grants engineering_lab. */
  async function ensureLoaded(){
    await S.ready;
    if(!S.entitlements.has('engineering_lab')) return false;
    await frameReady();
    const ok = await window.GHShell.loadEngineering();
    if(ok) window.GHShell.sync();
    return ok;
  }
  /* The manifest in models.js must match the live module exactly. */
  function catalogCheck(){
    const w=frameWin(), live=(w && w.GH_ENGINEERING_CALCS || []).map(c=>c.id);
    const manifest=M.ENGINEERING_CATALOG.map(a=>a.id);
    return { loaded:live.length>0, count:live.length, missing:manifest.filter(id=>!live.includes(id)), extra:live.filter(id=>!M.ANALYZER_IDS.has(id)) };
  }
  function currentAnalyzer(){ const w=frameWin(); try { const id=w.eval('typeof currentCalc!=="undefined"?currentCalc:null'); return M.ANALYZER_IDS.has(id)?id:null; } catch(e){ return null; } }
  function unitSystem(){ const w=frameWin(); try { return w.getU('length')==='mm'?'metric':'imperial'; } catch(e){ return 'imperial'; } }

  async function open(id){
    if(!M.ANALYZER_IDS.has(id)) throw new Error('Unknown engineering analyzer.');
    if(!await ensureLoaded()) throw new Error('The Engineering Lab requires Gearhead Labs Premium.');
    const w=frameWin();
    w.history.replaceState(null,'','?calc='+encodeURIComponent(id));
    w.ghRoute();
    for(let i=0;i<20 && currentAnalyzer()!==id;i++) await settle(50);
    return currentAnalyzer()===id;
  }

  const ownText = n => [...n.childNodes].filter(t=>t.nodeType===3).map(t=>t.textContent).join('').trim();
  /* Structured snapshot of the open analyzer: inputs (with canonical values for
     unit-converted fields) and the rendered results as label/value/unit rows. */
  function capture(){
    const id=currentAnalyzer(); if(!id) throw new Error('Open an analyzer first.');
    const w=frameWin(), box=w.document.getElementById('calc-container'), fields={};
    box.querySelectorAll('input[id],select[id],textarea[id]').forEach(el=>{
      if(el.type==='button'||el.type==='submit') return;
      const unit=el.dataset && el.dataset.ghmUnit || '';
      let canonical=null;
      if(unit && el.value.trim()!==''){ const n=parseFloat(el.value); if(Number.isFinite(n)) { try { canonical=w.convertFromDisplay(n,unit); } catch(e){} } }
      fields[el.id]={ value:el.value, unit, canonical };
    });
    const results=[];
    box.querySelectorAll('.mini-result').forEach(r=>results.push({ label:(r.querySelector('.label')||{}).textContent||'', value:ownText(r.querySelector('.value')||r), unit:((r.querySelector('.unit')||{}).textContent||'').trim() }));
    box.querySelectorAll('.result-box').forEach(r=>{ const v=r.querySelector('.result-value'); results.push({ label:((r.querySelector('.result-label')||{}).textContent||'').trim(), value:v?ownText(v)||v.textContent.trim():'', unit:((r.querySelector('.result-unit')||{}).textContent||'').trim() }); });
    return { analyzer_id:id, input_data:{ schema:1, analyzer_id:id, unit_system:unitSystem(), fields }, result_data:{ schema:1, results, captured_at:new Date().toISOString() } };
  }

  /* Re-open an analysis and re-run it from its saved inputs (results are recomputed, not replayed). */
  async function restore(analysis){
    if(!await open(analysis.analyzer_id)) throw new Error('Could not open the analyzer.');
    const w=frameWin(), doc=w.document, saved=analysis.input_data||{}, same=saved.unit_system===unitSystem();
    Object.entries(saved.fields||{}).forEach(([fid,f])=>{
      const el=doc.getElementById(fid); if(!el) return;
      el.value = (!same && f.unit && Number.isFinite(f.canonical)) ? w.fieldDisplayValue(f.canonical,f.unit) : f.value;
    });
    w.renderCalc(analysis.analyzer_id,false);
    await settle();
    return capture();
  }

  /* Keep the frame in step with the entitlement: load for Premium, unload on downgrade. */
  window.addEventListener('gh:frameready', () => { if(S.entitlements.has('engineering_lab')) ensureLoaded(); });
  S.on('entitlement', () => {
    const w=frameWin();
    if(S.entitlements.has('engineering_lab')) ensureLoaded();
    else if(w && w.GH_ENGINEERING_CALCS) window.GHShell.reloadFrame();
  });

  GHP.engineering = { catalog:M.ENGINEERING_CATALOG, categories:M.ENGINEERING_CATEGORIES, ensureLoaded, catalogCheck, open, capture, restore, currentAnalyzer, unitSystem };
})();
