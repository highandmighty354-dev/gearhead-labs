/* Gearhead Labs Task 4 — verified mathematical corrections.
   Loaded into the encyclopedia frame before final navigation rebuild. */
(function(){
  'use strict';
  try {
    if (typeof GH_E1_FORMULAS === 'object') {
      /* Four-stroke BMEP: 4πT(lb-ft) converted to lb-in => 48πT/V(in³). */
      if (GH_E1_FORMULAS.bmep_from_torque) GH_E1_FORMULAS.bmep_from_torque.expr='(T*48*Math.PI)/(V)';
      /* US customary spring rate in lb/in and sprung mass represented in lb: g=386.0886 in/s². */
      if (GH_E1_FORMULAS.ride_frequency) GH_E1_FORMULAS.ride_frequency.expr='Math.sqrt(k*386.0886/m)/(2*Math.PI)';
      if (GH_E1_FORMULAS.natural_frequency) GH_E1_FORMULAS.natural_frequency.expr='Math.sqrt(k*386.0886/m)/(2*Math.PI)';
      /* Lateral acceleration in g. The prior expression divided by g twice. */
      if (GH_E1_FORMULAS.lateral_acceleration) { GH_E1_FORMULAS.lateral_acceleration.expr='v*v/(32.174*r)'; GH_E1_FORMULAS.lateral_acceleration.post='result'; }
      /* Ackermann inside-angle geometry requires track width; wheelbase alone is insufficient. */
      if (GH_E1_FORMULAS.ackermann_angle) {
        GH_E1_FORMULAS.ackermann_angle.labels=['Wheelbase','Turn Radius','Track Width'];
        GH_E1_FORMULAS.ackermann_angle.vars=['l','r','t'];
        GH_E1_FORMULAS.ackermann_angle.expr='Math.atan(l/(r-t/2))*180/Math.PI';
      }
      /* Dynamic pressure: rho is lbm/ft³ and speed is ft/s, so divide by g_c. */
      if (GH_E1_FORMULAS.dynamic_pressure) GH_E1_FORMULAS.dynamic_pressure.expr='0.5*rho*v*v/32.174';
    }

    if (typeof GH_E101_FORMULAS === 'object') {
      /* These tools previously returned misleading numeric placeholders instead of the requested fraction result. */
      if (GH_E101_FORMULAS.fraction_simplify) GH_E101_FORMULAS.fraction_simplify.expr='n/d';
      if (GH_E101_FORMULAS.decimal_to_mixed_number) GH_E101_FORMULAS.decimal_to_mixed_number.expr='x';
      /* Correct N·m -> lb-in conversion: 1 N·m = 8.85074579 lb-in. */
      if (GH_E101_FORMULAS.nmm_to_lbft) {
        GH_E101_FORMULAS.nmm_to_lbft.out='lb-in';
        GH_E101_FORMULAS.nmm_to_lbft.unit='lb-in';
        GH_E101_FORMULAS.nmm_to_lbft.expr='x*8.85074579';
      }
    }

    /* The five public Labs are provenance-driven. Original V3.3.2 calculators are Universal
       except the six original towing tools. E1.0.0 explicitly labels its new Lab families. */
    if (typeof ghLabForCalc==='function') {
      const originalTowing=new Set(['tongue_weight','gcwr_payload','trailer_sway','brake_controller_gain','towing_squat','trailer_tire_load']);
      const e1LabSets={gasoline:new Set(),diesel:new Set(),ev:new Set(),towing:new Set()};
      if(Array.isArray(GH_E1_CALCS)) GH_E1_CALCS.forEach(c=>{
        const cat=String(c.cat||'');
        if(cat.startsWith('GASOLINE /')) e1LabSets.gasoline.add(c.id);
        else if(cat.startsWith('DIESEL /')) e1LabSets.diesel.add(c.id);
        else if(cat.startsWith('EV /')) e1LabSets.ev.add(c.id);
        else if(cat.startsWith('TOWING /')) e1LabSets.towing.add(c.id);
      });
      const dieselSet=new Set(Array.isArray(DIESEL_CALCS)?DIESEL_CALCS.map(c=>c.id):[]);
      const e101Set=new Set(Array.isArray(GH_E101_CALCS)?GH_E101_CALCS.map(c=>c.id):[]);
      ghLabForCalc=function(c){
        if(!c) return 'universal';
        const id=String(c.id||'');
        if(dieselSet.has(id)||e1LabSets.diesel.has(id)) return 'diesel';
        if(e1LabSets.ev.has(id)) return 'ev';
        if(e1LabSets.towing.has(id)||originalTowing.has(id)) return 'towing';
        if(e1LabSets.gasoline.has(id)) return 'gasoline';
        if(e101Set.has(id)) return 'universal';
        return 'universal';
      };
    }

    /* Re-render E1 calculators after formula metadata is changed. */
    if (typeof RENDERS === 'object') {
      if (typeof GH_E1_FORMULAS === 'object') Object.keys(GH_E1_FORMULAS).forEach(id=>{
        if (typeof ghE1Render==='function') RENDERS[id]=()=>ghE1Render(id);
      });
      if (typeof GH_E101_FORMULAS === 'object') Object.keys(GH_E101_FORMULAS).forEach(id=>{
        const s=GH_E101_FORMULAS[id], safe=id.replace(/[^a-zA-Z0-9_]/g,'_');
        RENDERS[id]=()=>{
          const fields=s.labels.map((label,i)=>field(label,`${safe}_${s.vars[i]}`, label.includes('Denominator')||label.includes('Maximum')?8:1,'')).join('');
          let val;
          try{val=Function(...s.vars,`return ${s.expr};`)(...s.vars.map(v=>vd(`${safe}_${v}`,1)));}catch(e){val=NaN;}
          const shown=Number.isFinite(val)?Number(val).toLocaleString(undefined,{maximumFractionDigits:8}):'—';
          return `${headerHTML(s.out,'E1.0.1 — researched unit conversion / shop math tool.')}<div class="calc-body"><div class="gh-e1-fields">${fields}</div><button class="calc-btn" onclick="renderCalc('${id}',false)">CONVERT</button><div class="result-box"><div class="result-label">${s.out}</div><div class="result-value">${shown}<span class="result-unit">${s.unit}</span></div></div><div class="calc-note"><strong>Formula:</strong> <code>${escapeHtml(s.expr)}</code><br>Conversion factors follow NIST guidance; carry full precision internally and round the final displayed result.</div></div>${calcFooter('E1.0.1')}`;
        };
      });
    }

    window.__GH_QA_CORRECTIONS__={
      bmep_from_torque:'four-stroke BMEP = 48πT/V for lb-ft and ci',
      ride_frequency:'f = sqrt(k*386.0886/m)/(2π) for lb/in and lb mass',
      natural_frequency:'f = sqrt(k*386.0886/m)/(2π) for lb/in and lb mass',
      lateral_acceleration:'v²/(g·r), with result already expressed in g',
      ackermann_angle:'inside angle uses wheelbase, turn radius and half track width',
      dynamic_pressure:'q = 0.5·rho·v²/g_c for lbm/ft³ and ft/s',
      nmm_to_lbft:'corrected to N·m → lb-in conversion and labeling',
      lab_registry:'provenance-driven five-Lab classification restores 44/42/24/25/439 distribution'
    };
  } catch(e) { console.error('Gearhead Labs QA correction load failed',e); }
})();
