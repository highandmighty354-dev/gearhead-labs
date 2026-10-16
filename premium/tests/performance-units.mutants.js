/* Mutants for premium/tests/performance-units.test.js (GH-IMP-019): each entry is [name, text found exactly once in the engine, replacement]. The suite is run (short form) against the engine with
   that one fault put back and must FAIL on every one of them; a mutant that passes is a hole in the tests. They are the ways this feature can go wrong:
     - the Auto unit follows the measurement system, or the vehicle, instead of the application
     - pressing Metric / Imperial changes the preferences
     - a wrong conversion factor, a factor applied twice, a result whose number and label disagree
     - a row dropped from the table (it silently keeps its old behaviour), an EV default of hp, a retained row that starts following a preference
     - the saved-setup loader forgetting what the box shows now, or reading a legacy native kW text as hp
     - a box read through the unit its caller names instead of the unit it shows (lsd_t was read as 'lb-ft' while showing N·m)
     - the remembered text not carried through a preference change
     - the profile editor, and the hybrid shortcut label, ignoring the preference
   Run by performance-units.test.js (MUTANTS=0 skips them). */
'use strict';
module.exports = [
  ['Auto follows Metric / Imperial', "const p=PERF_PREF[c.fam]; return p==='auto'?c.auto:p;",
    "const p=PERF_PREF[c.fam]; return p==='auto'?(UNIT.system==='metric'?(c.fam==='power'?'kW':'N·m'):c.auto):p;"],
  ['Auto follows the selected vehicle', "const p=PERF_PREF[c.fam]; return p==='auto'?c.auto:p;",
    "const p=PERF_PREF[c.fam]; return p==='auto'?((getActiveProfile()||{}).vehicleType==='EV'&&c.fam==='power'?'kW':(((getActiveProfile()||{}).hp||0)===0?'kW':c.auto)):p;"],
  ['pressing Metric overwrites the preferences', "  UNIT.system = s;\n  GHM_STORAGE.set('ghm_unit', s);",
    "  UNIT.system = s;\n  GHM_STORAGE.set('ghm_unit', s); PERF_PREF.power='auto'; PERF_PREF.torque='auto'; GHM_STORAGE.set('ghm_perf_power','auto'); GHM_STORAGE.set('ghm_perf_torque','auto'); perfSyncControls();"],
  ['hp to kW factor wrong', "const PERF_K = { kW_per_hp: UNIT_DEFS.HP.toMetric(1),", "const PERF_K = { kW_per_hp: 0.746,"],
  ['lb-ft to N·m factor wrong', "Nm_per_lbft: UNIT_DEFS['lb-ft'].toMetric(1) };", "Nm_per_lbft: 1.36 };"],
  ['double conversion (shown unit to calculator unit applied twice)', "function perfToSrc(v,tok){ const p=perfParse(tok); return perfConv(v,p.shownBase,p.src); }",
    "function perfToSrc(v,tok){ const p=perfParse(tok); return perfConv(perfConv(v,p.shownBase,p.src),p.shownBase,p.src); }"],
  ['the token conversion depends on the measurement system', "if(isPerfToken(unit)) return perfFromSrc(value,unit);", "if(isPerfToken(unit)) return system==='metric'?perfFromSrc(value,unit)*1.1:perfFromSrc(value,unit);"],
  ['result number and unit label disagree', "shownUnit=perfTok?metricUnit(perfTok):(raw?unit:metricUnit(unit));", "shownUnit=(raw?unit:metricUnit(unit));"],
  ['a row dropped from the table (Wheel HP)', "'OUT|Wheel HP|WHP':'WHEEL_POWER', ", ""],
  ['EV power defaults to hp', "EV_POWER:{fam:'power',auto:'kW'}, HYBRID_SYSTEM_POWER", "EV_POWER:{fam:'power',auto:'hp'}, HYBRID_SYSTEM_POWER"],
  ['the hp companion row starts following Power', "'OUT|Motor Power|HP':'RETAIN-ALT'", "'OUT|Motor Power|HP':'EV_POWER'"],
  ['a box is read through the unit its caller names', "else { const du=declaredFieldUnit(id); if(isPerfToken(du)) unit=du; }", ""],
  ['remembered text not carried through a preference change', "const cur=perfRetoken(m.unit); if(cur===m.unit) continue;", "const cur=perfRetoken(m.unit); continue;"],
  ['a legacy native kW text is read as hp', "base=PERF_BASE[lp.declared]; } }", "base='hp'; } }"],
  ['the saved setup ignores the box that is on screen now', "else if(isPerfToken(el.dataset?.ghmUnit)){", "else if(false){"],
  ['the profile editor ignores the Power preference', "${profileEditorField('Horsepower','profile_hp',p.hp,perfProfileToken('profile_hp')||'HP')}", "${profileEditorField('Horsepower','profile_hp',p.hp,'HP')}"],
  ['the profile list ignores the Power preference', "${fmtUnitValue(p.hp,perfProfileToken('profile_hp')||\"HP\")} ${metricUnit(perfProfileToken('profile_hp')||\"HP\")}", "${fmtUnitValue(p.hp,\"HP\")} ${metricUnit(\"HP\")}"],
  ['the hybrid shortcut names the wrong unit', "${profileMatch.converted?' '+(perfTok?metricUnit(perfTok):profileMatch.boxUnit):''}</span>", "${profileMatch.converted?' '+profileMatch.boxUnit:''}</span>"],
  ['the simulator cells keep the Imperial unit', "function simPerfCell(label,value,unit,digits){\n  const tok=perfTokenFor('OUT',label,unit,false);", "function simPerfCell(label,value,unit,digits){\n  const tok=null;"],
  ['the preference is not stored', "PERF_PREF[kind]=value; GHM_STORAGE.set('ghm_perf_'+kind,value);", "PERF_PREF[kind]=value;"],
];
