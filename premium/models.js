/* Gearhead Labs Premium — data models, enums, validation and entitlement rules.
   Pure functions only: no storage, no DOM. Shared by every adapter and the UI. */
(function(){
  'use strict';
  const GHP = window.GHP = window.GHP || {};

  const PLANS = { FREE:'FREE', PREMIUM:'PREMIUM', PREMIUM_TRIAL:'PREMIUM_TRIAL' };
  const ENTITLEMENT_STATUSES = ['active','trialing','past_due','canceled','expired'];
  const PREMIUM_FEATURES = ['engineering_lab','garage','projects','saved_analyses'];

  /* Automotive only. */
  const VEHICLE_TYPES = ['Car','Truck','SUV','Van','Motorcycle','Off-Road','Race Car'];
  const FUEL_TYPES = ['Gasoline','Diesel','E85 / Flex Fuel','Methanol','Electric','Hybrid','Plug-in Hybrid','Other'];
  const DRIVETRAINS = ['RWD','FWD','AWD','4WD'];
  const TRANSMISSIONS = ['Manual','Automatic','DCT','CVT','Sequential','Single-speed (EV)'];
  const BUILD_STATUSES = ['Stock','Street','Street/Strip','Race','Project'];
  const PROJECT_STATUSES = ['Planning','Active','On Hold','Complete'];
  const EXPERIENCE_LEVELS = ['Beginner','Enthusiast','Experienced','Professional'];
  const UNIT_SYSTEMS = ['imperial','metric'];

  /* Manifest of the 14 Premium engineering analyzers. Metadata only — the
     mathematics live in engineering-expansion-v1.js and are never duplicated.
     The bridge checks this list against the live module at runtime. */
  const ENGINEERING_CATEGORIES = ['Turbo','Two-Stroke','Valvetrain','Chassis','Driveline','Thermal'];
  const ENGINEERING_CATALOG = [
    ['e01_turbo_compressor_map','E01','Turbo Compressor Map Builder','Turbo'],
    ['e02_turbo_surge_choke_margin','E02','Turbo Surge / Choke Margin Analyzer','Turbo'],
    ['e03_turbo_turbine_matching','E03','Turbo Turbine Matching Analyzer','Turbo'],
    ['e04_turbo_pressure_ratio_stack','E04','Turbo Pressure-Ratio Stack Analyzer','Turbo'],
    ['e05_two_stroke_time_area','E05','2-Stroke Port Time-Area Analyzer','Two-Stroke'],
    ['e06_two_stroke_blowdown','E06','2-Stroke Blowdown Analyzer','Two-Stroke'],
    ['e07_expansion_chamber_reverse','E07','2-Stroke Expansion-Chamber Reverse Analyzer','Two-Stroke'],
    ['e08_valvetrain_dynamic_control','E08','Valvetrain Dynamic Control Analyzer','Valvetrain'],
    ['e09_valve_spring_surge','E09','Valve Spring Natural-Frequency / Surge Analyzer','Valvetrain'],
    ['e10_suspension_kinematics','E10','Suspension Kinematics Lab','Chassis'],
    ['e11_driveline_dynamics','E11','Driveline Dynamics Lab','Driveline'],
    ['e12_radiator_heat_rejection','E12','Radiator Heat-Rejection Analyzer','Thermal'],
    ['e13_intercooler_thermal','E13','Intercooler Thermal / Pressure-Drop Analyzer','Thermal'],
    ['e14_heat_exchanger_matching','E14','Heat-Exchanger Matching Workbench','Thermal']
  ].map(([id,code,name,category])=>({id,code,name,category}));
  const ANALYZER_IDS = new Set(ENGINEERING_CATALOG.map(a=>a.id));

  /* Field definitions per entity: type, required, allowed values. user_id,
     id and timestamps are never accepted from the UI — the service sets them. */
  const SCHEMAS = {
    profiles: {
      display_name:{type:'text',max:80}, avatar_url:{type:'url',max:500}, location:{type:'text',max:80},
      experience_level:{type:'enum',values:EXPERIENCE_LEVELS}, preferred_unit_system:{type:'enum',values:UNIT_SYSTEMS},
      favorite_vehicle_id:{type:'ref'}, favorite_build_id:{type:'ref'}
    },
    vehicles: {
      year:{type:'year',required:true}, make:{type:'text',required:true,max:60}, model:{type:'text',required:true,max:60},
      trim:{type:'text',max:60}, engine:{type:'text',max:80}, fuel_type:{type:'enum',values:FUEL_TYPES},
      transmission:{type:'enum',values:TRANSMISSIONS}, drivetrain:{type:'enum',values:DRIVETRAINS},
      vehicle_type:{type:'enum',values:VEHICLE_TYPES,required:true}, notes:{type:'text',max:2000}, is_primary:{type:'bool'}
    },
    builds: {
      vehicle_id:{type:'ref',required:true}, name:{type:'text',required:true,max:80}, description:{type:'text',max:500},
      status:{type:'enum',values:BUILD_STATUSES,required:true}, goals:{type:'text',max:1000}, notes:{type:'text',max:2000}
    },
    projects: {
      name:{type:'text',required:true,max:80}, description:{type:'text',max:1000}, vehicle_id:{type:'ref'}, build_id:{type:'ref'},
      status:{type:'enum',values:PROJECT_STATUSES,required:true}
    },
    engineering_analyses: {
      analyzer_id:{type:'analyzer',required:true}, name:{type:'text',required:true,max:120}, input_data:{type:'json',required:true},
      result_data:{type:'json'}, notes:{type:'text',max:2000}, vehicle_id:{type:'ref'}, build_id:{type:'ref'}, project_id:{type:'ref'}
    }
  };

  class ValidationError extends Error { constructor(errors){ super(Object.values(errors)[0]||'Invalid data'); this.name='ValidationError'; this.errors=errors; } }

  /* Returns a clean row containing only schema fields. Throws ValidationError. */
  function validate(table, data, {partial=false}={}){
    const schema=SCHEMAS[table]; if(!schema) throw new Error('Unknown table '+table);
    const out={}, errors={};
    for(const [key,def] of Object.entries(schema)){
      if(!(key in data)){ if(def.required && !partial) errors[key]=label(key)+' is required.'; continue; }
      let v=data[key];
      if(typeof v==='string') v=v.trim();
      const empty=v===''||v===null||v===undefined;
      if(empty){ if(def.required) errors[key]=label(key)+' is required.'; else out[key]=def.type==='bool'?false:null; continue; }
      switch(def.type){
        case 'text': if(String(v).length>def.max) errors[key]=label(key)+' is too long.'; else out[key]=String(v); break;
        case 'url': if(!/^https:\/\/[^\s<>"']+$/i.test(v)||String(v).length>def.max) errors[key]='Avatar must be an https:// image URL.'; else out[key]=String(v); break;
        case 'enum': if(!def.values.includes(v)) errors[key]=label(key)+' must be one of: '+def.values.join(', ')+'.'; else out[key]=v; break;
        case 'year': { const y=Number(v), max=new Date().getFullYear()+2; if(!Number.isInteger(y)||y<1886||y>max) errors[key]='Year must be between 1886 and '+max+'.'; else out[key]=y; break; }
        case 'bool': out[key]=!!v; break;
        case 'ref': out[key]=String(v); break;
        case 'analyzer': if(!ANALYZER_IDS.has(v)) errors[key]='Unknown engineering analyzer.'; else out[key]=v; break;
        case 'json': if(typeof v!=='object') errors[key]=label(key)+' must be structured data.'; else out[key]=JSON.parse(JSON.stringify(v)); break;
      }
    }
    if(Object.keys(errors).length) throw new ValidationError(errors);
    return out;
  }
  function label(key){ return key.replace(/_id$/,'').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase()); }

  /* Entitlement evaluation — the ONLY place that decides Premium access.
     row: an entitlements record from the active backend (or null).
     source: 'backend' | 'development' | 'anonymous' | 'no-backend'. */
  function evaluateEntitlement(row, source, now=new Date()){
    const base={ plan:PLANS.FREE, status:'active', isPremium:false, source, features:new Set(['calculators']), expires_at:null, provider:null };
    if(!row) return base;
    const plan=PLANS[row.plan]?row.plan:PLANS.FREE;
    const status=ENTITLEMENT_STATUSES.includes(row.status)?row.status:'expired';
    const expired=row.expires_at && new Date(row.expires_at)<=now;
    const premium=(plan===PLANS.PREMIUM||plan===PLANS.PREMIUM_TRIAL) && (status==='active'||status==='trialing') && !expired;
    return { plan, status:expired?'expired':status, isPremium:premium, source,
      features:new Set(premium?['calculators',...PREMIUM_FEATURES]:['calculators']),
      expires_at:row.expires_at||null, provider:row.provider||null };
  }

  GHP.models = { PLANS, ENTITLEMENT_STATUSES, PREMIUM_FEATURES, VEHICLE_TYPES, FUEL_TYPES, DRIVETRAINS, TRANSMISSIONS,
    BUILD_STATUSES, PROJECT_STATUSES, EXPERIENCE_LEVELS, UNIT_SYSTEMS, ENGINEERING_CATEGORIES, ENGINEERING_CATALOG,
    ANALYZER_IDS, SCHEMAS, ValidationError, validate, evaluateEntitlement };
})();
