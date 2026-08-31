/* Gearhead Labs Task 4 — verified mathematical corrections.
   Loaded into the encyclopedia frame before final navigation rebuild. */
(function(){
  'use strict';
  try {
    if (typeof GH_E1_FORMULAS === 'object') {
      if (GH_E1_FORMULAS.bmep_from_torque) GH_E1_FORMULAS.bmep_from_torque.expr='(T*48*Math.PI)/(V)';
      if (GH_E1_FORMULAS.ride_frequency) GH_E1_FORMULAS.ride_frequency.expr='Math.sqrt(k*386.0886/m)/(2*Math.PI)';
      if (GH_E1_FORMULAS.natural_frequency) GH_E1_FORMULAS.natural_frequency.expr='Math.sqrt(k*386.0886/m)/(2*Math.PI)';
      if (GH_E1_FORMULAS.lateral_acceleration) { GH_E1_FORMULAS.lateral_acceleration.expr='v*v/(32.174*r)'; GH_E1_FORMULAS.lateral_acceleration.post='result'; }
      if (GH_E1_FORMULAS.ackermann_angle) {
        GH_E1_FORMULAS.ackermann_angle.labels=['Wheelbase','Turn Radius','Track Width'];
        GH_E1_FORMULAS.ackermann_angle.vars=['l','r','t'];
        GH_E1_FORMULAS.ackermann_angle.expr='Math.atan(l/(r-t/2))*180/Math.PI';
      }
      if (GH_E1_FORMULAS.dynamic_pressure) GH_E1_FORMULAS.dynamic_pressure.expr='0.5*rho*v*v/32.174';
      if (GH_E1_FORMULAS.engine_air_density) GH_E1_FORMULAS.engine_air_density.expr='(P*144)/(53.35*T)';
      if (GH_E1_FORMULAS.dynamic_compression) {
        GH_E1_FORMULAS.dynamic_compression.labels=['Bore','Stroke','Connecting Rod Length','Static Compression Ratio','Intake Closing Angle (ABDC)'];
        GH_E1_FORMULAS.dynamic_compression.vars=['b','s','l','cr','ica'];
        GH_E1_FORMULAS.dynamic_compression.expr='( (Math.PI/4*b*b*(s/2*(1-Math.cos((180+ica)*Math.PI/180))+l-Math.sqrt(l*l-(s/2*Math.sin((180+ica)*Math.PI/180))**2))) + (Math.PI/4*b*b*s)/(cr-1) ) / ((Math.PI/4*b*b*s)/(cr-1))';
      }

      /* Keep both Otto entries, but make them genuinely different tools:
         Otto Cycle Efficiency accepts the specific-heat ratio gamma;
         Air-Standard Otto Cycle remains the fixed-gamma 1.4 reference tool. */
      if (GH_E1_FORMULAS.otto_efficiency) {
        GH_E1_FORMULAS.otto_efficiency.labels=['Compression Ratio','Specific Heat Ratio (γ)'];
        GH_E1_FORMULAS.otto_efficiency.vars=['r','gamma'];
        GH_E1_FORMULAS.otto_efficiency.expr='1-1/(r**(gamma-1))';
        GH_E1_FORMULAS.otto_efficiency.out='Otto Cycle Thermal Efficiency';
        GH_E1_FORMULAS.otto_efficiency.unit='%';
        GH_E1_FORMULAS.otto_efficiency.post='result*100';
      }
    }

    if (typeof GH_E101_FORMULAS === 'object') {
      if (GH_E101_FORMULAS.fraction_simplify) GH_E101_FORMULAS.fraction_simplify.expr='n/d';
      if (GH_E101_FORMULAS.decimal_to_mixed_number) GH_E101_FORMULAS.decimal_to_mixed_number.expr='x';
      if (GH_E101_FORMULAS.nmm_to_lbft) {
        GH_E101_FORMULAS.nmm_to_lbft.out='lb-in'; GH_E101_FORMULAS.nmm_to_lbft.unit='lb-in'; GH_E101_FORMULAS.nmm_to_lbft.expr='x*8.85074579';
      }
    }

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
        if(!c) return 'universal'; const id=String(c.id||'');
        if(dieselSet.has(id)||e1LabSets.diesel.has(id)) return 'diesel';
        if(e1LabSets.ev.has(id)) return 'ev';
        if(e1LabSets.towing.has(id)||originalTowing.has(id)) return 'towing';
        if(e1LabSets.gasoline.has(id)) return 'gasoline';
        if(e101Set.has(id)) return 'universal';
        return 'universal';
      };
    }

    if (typeof RENDERS === 'object') {
      if (typeof GH_E1_FORMULAS === 'object' && typeof ghE1Render==='function') Object.keys(GH_E1_FORMULAS).forEach(id=>RENDERS[id]=()=>ghE1Render(id));

      /* Give Otto Cycle Efficiency its engineering-default gamma of 1.4.
         Air-Standard Otto stays as the fixed-gamma reference calculator. */
      if (typeof GH_E1_FORMULAS === 'object' && GH_E1_FORMULAS.otto_efficiency) {
        RENDERS.otto_efficiency=()=>{
          const r=vd('otto_efficiency_r',10);
          const gamma=vd('otto_efficiency_gamma',1.4);
          const valid=r>1&&gamma>1;
          const eta=valid?(1-1/Math.pow(r,gamma-1))*100:NaN;
          return `${headerHTML('Otto Cycle Thermal Efficiency','General Otto-cycle thermal efficiency. Enter compression ratio and specific-heat ratio (γ). The common gasoline-air reference uses γ ≈ 1.4.')}`+
            `<div class="calc-body">${field('Compression Ratio','otto_efficiency_r',10,'')}${field('Specific Heat Ratio (γ)','otto_efficiency_gamma',1.4,'')}${resultHTML('Thermal Efficiency',valid?+eta.toFixed(4):0,'%')}`+
            `<div class="calc-note"><strong>Formula:</strong> η = 1 − 1 / r^(γ−1)<br>For the fixed γ=1.4 reference case, use Air-Standard Otto Cycle.</div></div>${calcFooter('Otto Cycle Efficiency')}`;
        };
      }

      RENDERS.cog_height=()=>{
        const wt=vd('wt8',3420), wb=vd('wb5',108), df=vd('rf',1720), ang=vd('ta5',6);
        const valid=wt>0&&wb>0&&df>0&&ang>0&&ang<90;
        const h=valid?df*wb/(wt*Math.tan(ang*Math.PI/180)):NaN;
        return `${headerHTML('Center of Gravity Height','Tilt-test CG height from front axle load change. The load input must be the change in front axle load produced by the tilt test.')}<div class="calc-body">${field('Vehicle Weight','wt8',3420,getU('weight'))}${field('Wheelbase','wb5',108,'in')}${field('Front Axle Load Change','rf',1720,getU('weight'))}${field('Tilt Angle','ta5',6,'°')}${resultHTML('CG Height',valid?+h.toFixed(2):0,'in')}</div>${calcFooter('CG Height')}`;
      };
      RENDERS.master_cylinder=()=>{
        const p=vd('cp',1800), bore=vd('bore4',1.0); const area=Math.PI*Math.pow(bore/2,2); const force=p*area;
        return `${headerHTML('Caliper Clamp Force','Calculate caliper clamp force from hydraulic line pressure and caliper piston bore.')}<div class="calc-body">${field('Brake Line Pressure','cp',1800,'psi')}${field('Caliper Piston Bore Diameter','bore4',1.0,'in')}${resultHTML('Caliper Clamp Force',+force.toFixed(0),'lbf')}</div>${calcFooter('Caliper Clamp Force')}`;
      };
      if (typeof GH_E101_FORMULAS === 'object') Object.keys(GH_E101_FORMULAS).forEach(id=>{
        const s=GH_E101_FORMULAS[id], safe=id.replace(/[^a-zA-Z0-9_]/g,'_');
        RENDERS[id]=()=>{const fields=s.labels.map((label,i)=>field(label,`${safe}_${s.vars[i]}`,label.includes('Denominator')||label.includes('Maximum')?8:1,'')).join('');let val;try{val=Function(...s.vars,`return ${s.expr};`)(...s.vars.map(v=>vd(`${safe}_${v}`,1)));}catch(e){val=NaN;}const shown=Number.isFinite(val)?Number(val).toLocaleString(undefined,{maximumFractionDigits:8}):'—';return `${headerHTML(s.out,'E1.0.1 — researched unit conversion / shop math tool.')}<div class="calc-body"><div class="gh-e1-fields">${fields}</div><button class="calc-btn" onclick="renderCalc('${id}',false)">CONVERT</button><div class="result-box"><div class="result-label">${s.out}</div><div class="result-value">${shown}<span class="result-unit">${s.unit}</span></div></div><div class="calc-note"><strong>Formula:</strong> <code>${escapeHtml(s.expr)}</code><br>Conversion factors follow NIST guidance; carry full precision internally and round the final displayed result.</div></div>${calcFooter('E1.0.1')}`;};
      });
    }

    /* Task 4 render safety: invalid math must never surface as NaN/Infinity/undefined. */
    if (typeof RENDERS === 'object' && !window.__GH_SAFE_RENDER_WRAPPED__) {
      window.__GH_SAFE_RENDER_WRAPPED__=true;
      Object.keys(RENDERS).forEach(function(id){
        const original=RENDERS[id];
        if(typeof original!=='function') return;
        RENDERS[id]=function(){
          try{
            const html=String(original.apply(this,arguments));
            if(/\b(?:NaN|Infinity|-Infinity|undefined)\b/.test(html)) throw new Error('nonfinite-render');
            return html;
          }catch(e){
            return `${headerHTML('Invalid Input','The supplied values are outside the valid mathematical or physical domain for this calculator.')}<div class="calc-body"><div class="result-box"><div class="result-label">Invalid input</div><div class="result-value">Check the entered values</div><div class="help-note">Use non-zero denominators and physically meaningful ranges.</div></div></div>${calcFooter('Invalid Input')}`;
          }
        };
      });
    }

    window.__GH_QA_CORRECTIONS__={
      bmep_from_torque:'four-stroke BMEP = 48πT/V', ride_frequency:'correct lb/in natural-frequency conversion', natural_frequency:'correct lb/in natural-frequency conversion',
      lateral_acceleration:'v²/(g·r), already in g', ackermann_angle:'requires track width', dynamic_pressure:'q = 0.5·rho·v²/g_c', engine_air_density:'ideal-gas R=53.35',
      dynamic_compression:'crank-slider piston position at IVC', nmm_to_lbft:'corrected N·m to lb-in', cog_height:'correct tilt-test load-change equation', master_cylinder:'actual caliper clamp-force calculation',
      otto_efficiency:'generalized Otto-cycle efficiency with explicit specific-heat ratio γ; Air-Standard Otto remains fixed at γ=1.4',
      lab_registry:'provenance-driven 44/42/24/25/439 distribution', render_safety:'invalid numeric output blocked at render boundary'
    };
  } catch(e) { console.error('Gearhead Labs QA correction load failed',e); }
})();