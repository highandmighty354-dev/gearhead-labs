/* Gearhead Labs Engineering Expansion V1 — qualified analyzer/workbench layer. */
(function(){
'use strict';
if(!window.CALCS||!window.RENDERS)return;
const E=[], add=(cat,id,name,fn)=>{E.push({cat,id,name});window.RENDERS[id]=fn;};
const V=id=>+(document.getElementById(id)?.value||0);
const F=(l,id,v,u)=>field(l,id,v,u);
const H=(t,h)=>headerHTML(t,h);
const R=(a,b,u)=>resultHTML(a,b,u);
const M=a=>multiResult(a);
const N=s=>'<div class="calc-note" style="margin-top:14px;line-height:1.5">'+s+'</div>';
const T=t=>calcFooter(t);

add('ENGINEERING / TURBO SYSTEMS','e01_turbo_compressor_map','Turbo Compressor Map Builder',()=>{
 const q=V('e01_q'),pr=V('e01_pr'),raw=document.getElementById('e01_map')?.value||'';
 const p=raw.split(/\n|;/).map(x=>x.trim()).filter(Boolean).map(x=>x.split(/[,\s]+/).map(Number)).filter(x=>x.length>=2&&x.every(Number.isFinite));
 let n=null,d=1e9;p.forEach(x=>{let z=Math.hypot((x[0]-q)/Math.max(q,1),x[1]-pr);if(z<d){d=z;n=x;}});
 return H('Turbo Compressor Map Builder','Uses supplied compressor-map points only; it never invents surge, choke or speed limits.')+'<div class="calc-body">'+F('Corrected Flow','e01_q',36,'lb/min')+F('Pressure Ratio','e01_pr',2.2,':1')+'<div class="field"><label class="field-label">Map points: flow, PR, efficiency %</label><textarea id="e01_map" class="field-input" style="min-height:130px"></textarea></div><button class="calc-btn" onclick="renderCalc(\'e01_turbo_compressor_map\',false)">ANALYZE</button>'+R('Nearest supplied point',n?n[0].toFixed(2)+' lb/min @ PR '+n[1].toFixed(3)+(n[2]?' · '+n[2].toFixed(1)+'%':''):'No valid point','')+N('<strong>Engineering rule:</strong> real map boundaries remain authoritative. Corrected-flow and pressure-ratio conventions must match the source map.')+'</div>'+T('Turbo Compressor Map Builder');
});

add('ENGINEERING / TURBO SYSTEMS','e02_turbo_surge_choke_margin','Turbo Surge / Choke Margin Analyzer',()=>{
 const q=V('e02_q'),pr=V('e02_pr');
 const parse=id=>(document.getElementById(id)?.value||'').split(/\n|;/).map(x=>x.trim()).filter(Boolean).map(x=>x.split(/[,\s]+/).map(Number)).filter(x=>x.length>=2&&x.every(Number.isFinite)).sort((a,b)=>a[1]-b[1]);
 const ip=(a,x)=>{if(!a.length)return NaN;if(x<=a[0][1])return a[0][0];if(x>=a[a.length-1][1])return a[a.length-1][0];for(let i=1;i<a.length;i++)if(x<=a[i][1]){let z=(x-a[i-1][1])/(a[i][1]-a[i-1][1]);return a[i-1][0]+z*(a[i][0]-a[i-1][0]);}return NaN;};
 const s=ip(parse('e02_s'),pr),c=ip(parse('e02_c'),pr),m=c-s,pos=(q-s)/m;
 const st=!isFinite(s)||!isFinite(c)?'SUPPLY BOTH BOUNDARIES':q<s?'LEFT OF SUPPLIED SURGE LINE':q>c?'RIGHT OF SUPPLIED CHOKE LINE':'WITHIN SUPPLIED MAP WINDOW';
 return H('Turbo Surge / Choke Margin Analyzer','Boundary-based analysis. There is no universal safe percentage; use the actual compressor map.')+'<div class="calc-body">'+F('Corrected Flow','e02_q',36,'lb/min')+F('Pressure Ratio','e02_pr',2.2,':1')+'<div class="field"><label class="field-label">Surge line: flow, PR</label><textarea id="e02_s" class="field-input"></textarea></div><div class="field"><label class="field-label">Choke line: flow, PR</label><textarea id="e02_c" class="field-input"></textarea></div><button class="calc-btn" onclick="renderCalc(\'e02_turbo_surge_choke_margin\',false)">CHECK</button>'+M([{label:'Surge Flow',value:isFinite(s)?s.toFixed(2):'—',unit:'lb/min'},{label:'Choke Flow',value:isFinite(c)?c.toFixed(2):'—',unit:'lb/min'},{label:'Position',value:st,unit:''}])+N('The output describes position relative to supplied map boundaries; it is not a manufacturer safety guarantee.')+'</div>'+T('Turbo Surge / Choke Margin Analyzer');
});

add('ENGINEERING / TURBO SYSTEMS','e03_turbo_turbine_matching','Turbo Turbine Matching Analyzer',()=>{
 const ma=V('e03_ma'),Tc=V('e03_Tc')+273.15,Tt=V('e03_T')+273.15,pc=V('e03_pc'),ec=Math.max(V('e03_ec'),.01),me=V('e03_me'),pt=Math.max(V('e03_pt'),1.001),et=V('e03_et');
 const cp=1005,g=1.4,wc=ma*.00045359237*cp*Tc*(Math.pow(pc,(g-1)/g)-1)/ec,wt=me*.00045359237*cp*Tt*(1-Math.pow(1/pt,(g-1)/g))*et;
 return H('Turbo Turbine Matching Analyzer','First-order shaft-power balance; measured turbine/compressor maps remain the higher-fidelity source.')+'<div class="calc-body">'+F('Compressor Airflow','e03_ma',40,'lb/min')+F('Compressor Inlet Temperature','e03_Tc',25,'°C')+F('Turbine Inlet Temperature','e03_T',900,'°C')+F('Compressor PR','e03_pc',2.2,':1')+F('Compressor Efficiency','e03_ec',.72,'fraction')+F('Exhaust Flow','e03_me',42,'lb/min')+F('Turbine PR','e03_pt',2,':1')+F('Turbine Efficiency','e03_et',.70,'fraction')+M([{label:'Compressor Power',value:(wc/1000).toFixed(2),unit:'kW'},{label:'Turbine Power',value:(wt/1000).toFixed(2),unit:'kW'},{label:'Power Balance',value:(wt/wc).toFixed(3),unit:'available / required'}])+N('Screening only: shaft speed, maps, mechanical losses, exhaust temperature and system operating conditions matter.')+'</div>'+T('Turbo Turbine Matching Analyzer');
});

add('ENGINEERING / TURBO SYSTEMS','e04_turbo_pressure_ratio_stack','Turbo Pressure-Ratio Stack Analyzer',()=>{
 const amb=V('e04_amb'),boost=V('e04_boost'),inlet=V('e04_in'),ic=V('e04_ic'),pipe=V('e04_pipe'),th=V('e04_th'),pin=amb-inlet,pout=amb+boost+ic+pipe+th;
 return H('Turbo Pressure-Ratio Stack Analyzer','Tracks absolute pressure through inlet, compressor, intercooler, piping and final losses.')+'<div class="calc-body">'+F('Ambient','e04_amb',14.7,'psia')+F('Boost Target','e04_boost',15,'psig')+F('Inlet Loss','e04_in',1,'psi')+F('Intercooler Loss','e04_ic',1.5,'psi')+F('Piping Loss','e04_pipe',1,'psi')+F('Final Loss','e04_th',.5,'psi')+M([{label:'Compressor Inlet',value:pin.toFixed(2),unit:'psia'},{label:'Required Outlet',value:pout.toFixed(2),unit:'psia'},{label:'Pressure Ratio',value:(pout/pin).toFixed(3),unit:':1'}])+N('Pressure ratio is based on absolute pressure, consistent with compressor-map practice.')+'</div>'+T('Turbo Pressure-Ratio Stack Analyzer');
});

add('ENGINEERING / TWO-STROKE','e05_two_stroke_time_area','2-Stroke Port Time-Area Analyzer',()=>{
 const a=V('e05_a'),deg=Math.max(0,V('e05_deg')),rpm=V('e05_rpm'),cc=V('e05_cc'),sec=deg/(6*rpm),ta=a*sec;
 return H('2-Stroke Port Time-Area Analyzer','Constant-area screening model; time per crank degree is 1/(6·RPM) seconds.')+'<div class="calc-body">'+F('Effective Port Area','e05_a',900,'mm²')+F('Open-to-Close Angle','e05_deg',120,'crank °')+F('RPM','e05_rpm',8000,'RPM')+F('Displacement','e05_cc',250,'cc')+M([{label:'Port Time',value:(sec*1000).toFixed(3),unit:'ms'},{label:'Time-Area',value:ta.toFixed(3),unit:'mm²·s'},{label:'Specific Time-Area',value:(ta/(cc/1000)).toFixed(3),unit:'mm²·s/L'}])+N('Real port area varies with crank angle and discharge coefficient; measured/geometric area curves enable a higher-fidelity model.')+'</div>'+T('2-Stroke Port Time-Area Analyzer');
});

add('ENGINEERING / TWO-STROKE','e06_two_stroke_blowdown','2-Stroke Blowdown Analyzer',()=>{
 const p=V('e06_p'),e=V('e06_e'),a=V('e06_a'),rpm=V('e06_rpm'),deg=V('e06_deg'),tm=deg/(6*rpm);
 return H('2-Stroke Blowdown Analyzer','Engineering indicator for pressure release between exhaust opening and transfer opening; not a power prediction.')+'<div class="calc-body">'+F('Cylinder Pressure','e06_p',120,'psi abs')+F('Exhaust Pressure','e06_e',30,'psi abs')+F('Effective Exhaust Area','e06_a',1000,'mm²')+F('RPM','e06_rpm',9000,'RPM')+F('Blowdown Angle','e06_deg',30,'°')+M([{label:'Pressure Ratio',value:(e/p).toFixed(3),unit:'exhaust / cylinder'},{label:'Blowdown Time',value:(tm*1000).toFixed(3),unit:'ms'},{label:'Pressure-Area-Time',value:((p-e)*a*tm).toFixed(2),unit:'psi·mm²·s'}])+N('Actual blowdown requires changing cylinder pressure, exhaust pressure, port geometry and discharge coefficient.')+'</div>'+T('2-Stroke Blowdown Analyzer');
});

add('ENGINEERING / TWO-STROKE','e07_expansion_chamber_reverse','2-Stroke Expansion-Chamber Reverse Analyzer',()=>{
 const rpm=V('e07_rpm'),c=V('e07_c'),deg=V('e07_deg'),dist=V('e07_d'),tm=deg/(6*rpm),target=c*12*tm;
 return H('2-Stroke Expansion-Chamber Reverse Analyzer','Acoustic first-pass model with explicit wave-speed and timing assumptions.')+'<div class="calc-body">'+F('Target RPM','e07_rpm',9000,'RPM')+F('Assumed Wave Speed','e07_c',1700,'ft/s')+F('Timing Window','e07_deg',190,'°')+F('Measured Wave Path','e07_d',24,'in')+M([{label:'Timing',value:(tm*1000).toFixed(3),unit:'ms'},{label:'Model Wave Distance',value:target.toFixed(2),unit:'in'},{label:'Measured / Model',value:(dist/target).toFixed(3),unit:'x'}])+N('A real chamber model needs temperature-dependent wave speed, reflection timing, port timing and gas dynamics.')+'</div>'+T('2-Stroke Expansion-Chamber Reverse Analyzer');
});

add('ENGINEERING / VALVETRAIN','e08_valvetrain_dynamic_control','Valvetrain Dynamic Control Analyzer',()=>{
 const lift=V('e08_lift')*.0254/2,rpm=V('e08_rpm'),mass=V('e08_m'),k=V('e08_k')*1000,w=Math.PI*rpm/30,a=lift*w*w;
 return H('Valvetrain Dynamic Control Analyzer','Equivalent-harmonic screening model; measured cam lift-versus-angle data is required for higher fidelity.')+'<div class="calc-body">'+F('Peak Lift','e08_lift',.55,'in')+F('RPM','e08_rpm',7000,'RPM')+F('Moving Mass','e08_m',.12,'kg')+F('Spring Rate','e08_k',300,'N/mm')+M([{label:'Peak Acceleration',value:(a/9.80665).toFixed(1),unit:'g'},{label:'Inertial Force',value:(mass*a).toFixed(1),unit:'N'},{label:'Natural Frequency',value:((1/(2*Math.PI))*Math.sqrt(k/mass)).toFixed(1),unit:'Hz'}])+N('Use actual cam profile, preload, installed height, retainer mass, damping and measured spring data for production decisions.')+'</div>'+T('Valvetrain Dynamic Control Analyzer');
});

add('ENGINEERING / VALVETRAIN','e09_valve_spring_surge','Valve Spring Natural-Frequency / Surge Analyzer',()=>{
 const k=V('e09_k')*1000,m=V('e09_m'),rpm=V('e09_rpm'),harm=V('e09_h'),fn=(1/(2*Math.PI))*Math.sqrt(k/m),exc=rpm/60*harm;
 return H('Valve Spring Natural-Frequency / Surge Analyzer','Lumped-mass screening index; real spring surge is a distributed-parameter phenomenon.')+'<div class="calc-body">'+F('Spring Rate','e09_k',350,'N/mm')+F('Equivalent Mass','e09_m',.15,'kg')+F('RPM','e09_rpm',7500,'RPM')+F('Excitation Harmonic','e09_h',1,'x')+M([{label:'Natural Frequency',value:fn.toFixed(1),unit:'Hz'},{label:'Excitation Frequency',value:exc.toFixed(1),unit:'Hz'},{label:'Separation',value:((fn-exc)/fn*100).toFixed(1),unit:'%'}])+N('Geometry, damping, coil contact, installed stress and nonlinear stiffness must be considered in a true spring model.')+'</div>'+T('Valve Spring Natural-Frequency / Surge Analyzer');
});

add('ENGINEERING / CHASSIS','e10_suspension_kinematics','Suspension Kinematics Lab',()=>{
 const uw=V('e10_uw'),lw=V('e10_lw'),ui=V('e10_ui'),li=V('e10_li'),mr=V('e10_mr');
 const den=(li-lw); const ic=Math.abs(den)>1e-9?(uw*li-lw*ui)/den:NaN;
 return H('Suspension Kinematics Lab','Unified front-view screening architecture; intended to grow into a full hardpoint/3D solver.')+'<div class="calc-body">'+F('Upper Wheel-Side X','e10_uw',12,'in')+F('Lower Wheel-Side X','e10_lw',16,'in')+F('Upper Inner X','e10_ui',8,'in')+F('Lower Inner X','e10_li',10,'in')+F('Motion Ratio','e10_mr',.8,'wheel/spring')+M([{label:'Instant-Center X Screen',value:isFinite(ic)?ic.toFixed(2):'Parallel / undefined',unit:'in'},{label:'Wheel/Spring Rate Factor',value:(mr*mr).toFixed(3),unit:'x²'}])+N('The production architecture should add vertical/3D hardpoints, camber, toe, roll center, steering axis and bump-steer curves rather than spawning duplicate mini-calculators.')+'</div>'+T('Suspension Kinematics Lab');
});

add('ENGINEERING / DRIVELINE','e11_driveline_dynamics','Driveline Dynamics Lab',()=>{
 const rpm=V('e11_rpm'),ratio=V('e11_ratio'),od=V('e11_od')*.0254,wall=V('e11_wall')*.0254,L=V('e11_L')*.0254,a=V('e11_a'),b=V('e11_b'),E=V('e11_E')*1e9,rho=V('e11_rho');
 const id=Math.max(0,od-2*wall),A=Math.PI/4*(od*od-id*id),I=Math.PI/64*(Math.pow(od,4)-Math.pow(id,4));
 const fn=L>0&&A>0&&I>0&&E>0&&rho>0?Math.PI/(2*L*L)*Math.sqrt(E*I/(rho*A)):NaN,crit=fn*60;
 return H('Driveline Dynamics Lab','Operating-angle and first-bending critical-speed screening using a simply supported uniform tube model.')+'<div class="calc-body">'+F('Input Shaft RPM','e11_rpm',6000,'RPM')+F('Axle Ratio','e11_ratio',3.73,':1')+F('Tube OD','e11_od',3.5,'in')+F('Wall Thickness','e11_wall',.083,'in')+F('Unsupported Length','e11_L',50,'in')+F('Elastic Modulus','e11_E',200,'GPa')+F('Material Density','e11_rho',7850,'kg/m³')+F('Front Angle','e11_a',3,'°')+F('Rear Angle','e11_b',3,'°')+M([{label:'Driveshaft RPM',value:(rpm/ratio).toFixed(0),unit:'RPM'},{label:'Angle Difference',value:Math.abs(a-b).toFixed(2),unit:'°'},{label:'First Critical Speed',value:isFinite(crit)?crit.toFixed(0):'Invalid',unit:'RPM'},{label:'75% Operating Limit',value:isFinite(crit)?(crit*.75).toFixed(0):'—',unit:'RPM'}])+N('Critical speed is an ideal beam-model screen. Joint support, balance, geometry, material, runout and manufacturer data must be checked before a safety-critical decision.')+'</div>'+T('Driveline Dynamics Lab');
});

add('ENGINEERING / THERMAL','e12_radiator_heat_rejection','Radiator Heat-Rejection Analyzer',()=>{
 const m=V('e12_m'),cp=V('e12_cp'),tin=V('e12_in'),tout=V('e12_out'),fac=V('e12_f'),q=m*cp*(tin-tout)*fac;
 return H('Radiator Heat-Rejection Analyzer','Coolant-side energy balance with explicit effectiveness assumptions.')+'<div class="calc-body">'+F('Coolant Flow','e12_m',35,'lb/min')+F('Specific Heat','e12_cp',3.9,'Btu/lb·°F')+F('Inlet Temp','e12_in',220,'°F')+F('Outlet Temp','e12_out',190,'°F')+F('Effective Factor','e12_f',.85,'fraction')+M([{label:'Ideal Heat Removal',value:(q/fac).toFixed(0),unit:'Btu/min'},{label:'Adjusted Heat Rejection',value:q.toFixed(0),unit:'Btu/min'},{label:'Thermal HP Equivalent',value:(q*60/2544.43).toFixed(1),unit:'HP'}])+N('A real radiator model should add air-side flow, inlet/outlet air temperature, UA and pressure drop.')+'</div>'+T('Radiator Heat-Rejection Analyzer');
});

add('ENGINEERING / THERMAL','e13_intercooler_thermal','Intercooler Thermal / Pressure-Drop Analyzer',()=>{
 const i=V('e13_i'),o=V('e13_o'),a=V('e13_a'),drop=V('e13_drop'),p=V('e13_p');
 return H('Intercooler Thermal / Pressure-Drop Analyzer','Reports thermal effectiveness and pressure loss together.')+'<div class="calc-body">'+F('Compressor Outlet Temp','e13_i',300,'°F')+F('Charge-Air Outlet Temp','e13_o',150,'°F')+F('Cooling-Air Temp','e13_a',80,'°F')+F('Pressure Drop','e13_drop',1.5,'psi')+F('Pressure Before Drop','e13_p',30,'psi')+M([{label:'Effectiveness',value:((i-o)/(i-a)*100).toFixed(1),unit:'%'},{label:'Pressure After Core',value:(p-drop).toFixed(1),unit:'psi'},{label:'Temperature Drop',value:(i-o).toFixed(1),unit:'°F'}])+N('Pressure drop should come from measured or manufacturer data; effectiveness uses the stated temperatures.')+'</div>'+T('Intercooler Thermal / Pressure-Drop Analyzer');
});

add('ENGINEERING / THERMAL','e14_heat_exchanger_matching','Heat-Exchanger Matching Workbench',()=>{
 const U=V('e14_u'),A=V('e14_A'),hi=V('e14_hi'),ho=V('e14_ho'),ci=V('e14_ci'),co=V('e14_co'),d1=hi-co,d2=ho-ci,lm=Math.abs(d1-d2)<1e-9?d1:(d1*d2>0?(d1-d2)/Math.log(Math.abs(d1/d2)):NaN);
 return H('Heat-Exchanger Matching Workbench','LMTD-based workbench with explicit counterflow endpoint temperatures.')+'<div class="calc-body">'+F('Overall U','e14_u',40,'Btu/hr·ft²·°F')+F('Area','e14_A',8,'ft²')+F('Hot Inlet','e14_hi',250,'°F')+F('Hot Outlet','e14_ho',120,'°F')+F('Cold Inlet','e14_ci',180,'°F')+F('Cold Outlet','e14_co',170,'°F')+M([{label:'ΔT1',value:d1.toFixed(2),unit:'°F'},{label:'ΔT2',value:d2.toFixed(2),unit:'°F'},{label:'LMTD',value:isFinite(lm)?lm.toFixed(2):'Invalid',unit:'°F'},{label:'Heat Transfer',value:isFinite(lm)?(U*A*lm).toFixed(0):'—',unit:'Btu/hr'}])+N('LMTD is the temperature-difference basis; actual performance also depends on flow arrangement, fouling, properties and pressure drop.')+'</div>'+T('Heat-Exchanger Matching Workbench');
});

add('ENGINEERING / MARINE','e15_marine_prop_operating_point','Marine Propeller Operating-Point Analyzer',()=>{
 const D=V('e15_D'),rpm=V('e15_rpm'),mph=V('e15_v'),kt=V('e15_kt'),kq=V('e15_kq'),J=mph*.44704/(rpm/60*D*.0254),eta=J*kt/(2*Math.PI*kq);
 return H('Marine Propeller Operating-Point Analyzer','Requires supplied propeller-series coefficients; no B-series or manufacturer coefficients are fabricated.')+'<div class="calc-body">'+F('Diameter','e15_D',14,'in')+F('RPM','e15_rpm',5500,'RPM')+F('Boat Speed','e15_v',45,'mph')+F('KT','e15_kt',.11,'supplied')+F('KQ','e15_kq',.018,'supplied')+M([{label:'Advance Ratio J',value:J.toFixed(3),unit:''},{label:'Open-Water Efficiency',value:(eta*100).toFixed(1),unit:'%'},{label:'Coefficient Source',value:'USER / MAP DATA',unit:''}])+N('A real propeller operating point also depends on diameter, pitch/geometry, advance ratio, loading and cavitation constraints.')+'</div>'+T('Marine Propeller Operating-Point Analyzer');
});

add('ENGINEERING / MARINE','e16_marine_cavitation_margin','Marine Propeller Cavitation Margin Analyzer',()=>{
 const rho=V('e16_rho'),n=V('e16_n'),D=V('e16_D'),p=V('e16_p'),pv=V('e16_pv'),lim=V('e16_lim'),sig=((p-pv)*144)/(rho*n*n*D*D);
 return H('Marine Propeller Cavitation Margin Analyzer','Dimensionless cavitation-index screen; acceptance threshold is user/source supplied.')+'<div class="calc-body">'+F('Water Density','e16_rho',1.94,'slug/ft³')+F('Propeller Speed','e16_n',91.7,'rev/s')+F('Diameter','e16_D',1.17,'ft')+F('Local Absolute Pressure','e16_p',14.7,'psi')+F('Vapor Pressure','e16_pv',.45,'psi')+F('Acceptance Index','e16_lim',.8,'minimum')+M([{label:'Cavitation Index σ',value:sig.toFixed(3),unit:''},{label:'Screen',value:sig>=lim?'ABOVE USER THRESHOLD':'BELOW USER THRESHOLD',unit:''}])+N('Blade loading, section pressure distribution, advance ratio and ventilation must be evaluated for a true cavitation design.')+'</div>'+T('Marine Propeller Cavitation Margin Analyzer');
});

add('ENGINEERING / MARINE','e17_marine_prop_optimization','Marine Propeller Optimization Workbench',()=>{
 const j=V('e17_j'),w=V('e17_w'),raw=document.getElementById('e17_map')?.value||'',p=raw.split(/\n|;/).map(x=>x.trim()).filter(Boolean).map(x=>x.split(/[,\s]+/).map(Number)).filter(x=>x.length>=3&&x.every(Number.isFinite));
 let b=null;p.forEach(x=>{let e=x[0]*x[1]/(2*Math.PI*x[2]);if(Math.abs(x[0]-j)<=w&&(!b||e>b.e))b={x,e};});
 return H('Marine Propeller Optimization Workbench','Ranks supplied propeller-series data near a target advance ratio. No coefficients are invented.')+'<div class="calc-body">'+F('Target J','e17_j',.65,'J')+F('Search Half-Width','e17_w',.01,'J')+'<div class="field"><label class="field-label">Map data: J, KT, KQ</label><textarea id="e17_map" class="field-input" style="min-height:120px"></textarea></div><button class="calc-btn" onclick="renderCalc(\'e17_marine_prop_optimization\',false)">SEARCH MAP</button>'+(b?M([{label:'Best J',value:b.x[0].toFixed(3),unit:''},{label:'KT',value:b.x[1].toFixed(4),unit:''},{label:'KQ',value:b.x[2].toFixed(4),unit:''},{label:'Efficiency',value:(b.e*100).toFixed(1),unit:'%'}]):R('Result','No valid point in search window',''))+N('A production optimizer should add diameter, RPM, speed, thrust/torque constraints and cavitation criteria.')+'</div>'+T('Marine Propeller Optimization Workbench');
});

const seen=new Set(CALCS.map(x=>x&&x.id));E.forEach(x=>{if(!seen.has(x.id)){CALCS.push(x);seen.add(x.id);}});
window.GH_ENGINEERING_CALCS=E;
window.GH_ENGINEERING_EXPANSION_VERSION='E1';
})();