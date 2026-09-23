# D-009: rewrite the 10 approved registry entries with declared options.
# Every value/label/constant is transcribed from the live calculator (see d009/livefacts.json
# and the live sources quoted in D009-RESULTS.md). Run on a copy of F1.11.1 + engine 1.1.0.
import json,glob,copy
F=glob.glob('F1_12_0_*.html')[0]; s=open(F,encoding='utf8').read()
LF=json.load(open('d009/livefacts.json'))
def span(text,rid):
    i=text.find('"%s":{'%rid); assert i>=0,rid
    b=text.find('{',i); d=0; k=b; st=esc=False
    while True:
        c=text[k]
        if st:
            if esc: esc=False
            elif c=='\\': esc=True
            elif c=='"': st=False
        elif c=='"': st=True
        elif c=='{': d+=1
        elif c=='}':
            d-=1
            if d==0: return b,k+1
        k+=1
def live_opts(rid,var):
    f=[x for x in LF[rid]['fields'] if x['id']==var][0]; return f['label'],f['options']
def choices(rid,var,table,disp=None,numeric=False):
    label,opts=live_opts(rid,var); out=[]
    assert set(o['value'] for o in opts)==set(table), (rid,'live options != table keys',[o['value'] for o in opts],list(table))
    for o in opts:
        val=float(o['value']) if numeric else o['value']
        c={'value':(int(val) if numeric and val==int(val) else val),'label':o['label'],'bind':table[o['value']]}
        if disp and o['value'] in disp: c['bind_display']=disp[o['value']]
        out.append(c)
    return label,out
LOG={}
def put(rid,fn):
    global s
    R0=s.find('const GH_BACKFILL_FORMULAS'); R1=s.find('\n',R0); seg=s[R0:R1]
    a,b=span(seg,rid); spec=json.loads(seg[a:b]); before=copy.deepcopy(spec)
    new=fn(spec)
    s=s[:R0]+seg[:a]+json.dumps(new,ensure_ascii=False,separators=(',',':'))+seg[b:]+s[R1:]
    LOG[rid]={'before':before,'after':new}
def entry(spec,var,label,params,chs,outputs):
    return {'labels':spec['labels']+[label],'vars':spec['vars']+[var],'options':{var:{'params':params,'choices':chs}},'outputs':outputs}
# distance: live conv rows [mi,km,ft,m,(yd unused by outputs)]
D={'mi':[1,1.60934,5280,1609.34],'km':[0.621371,1,3280.84,1000],'ft':[1/5280,0.0003048,1,0.3048],'m':[0.000621371,0.001,3.28084,1],'yd':[1/1760,0.000914,3,0.9144]}
names=['k_mi','k_km','k_ft','k_m']
lab,ch=choices('distance_converter','d_from',{k:dict(zip(names,v)) for k,v in D.items()},disp={'ft':{'k_mi':'1/5280'},'yd':{'k_mi':'1/1760'}})
put('distance_converter',lambda sp:entry(sp,'d_from',lab,{'k_mi':'miles per selected unit','k_km':'kilometers per selected unit','k_ft':'feet per selected unit','k_m':'meters per selected unit'},ch,
 [{'expr':'+(d_in*k_mi).toFixed(4)','out':'Miles','unit':'mi'},{'expr':'+(d_in*k_km).toFixed(4)','out':'Kilometers','unit':'km'},{'expr':'+(d_in*k_ft).toFixed(2)','out':'Feet','unit':'ft'},{'expr':'+(d_in*k_m).toFixed(3)','out':'Meters','unit':'m'}]))
# volume: live to_gal (cc_v is not selectable -> not declared)
V={'gal':1,'qt':0.25,'pt':0.125,'oz':1/128,'L':0.264172,'mL':0.000264172}
lab,ch=choices('volume_converter','vf',{k:{'k_gal':v} for k,v in V.items()},disp={'oz':{'k_gal':'1/128'}})
put('volume_converter',lambda sp:entry(sp,'vf',lab,{'k_gal':'US gallons per selected unit'},ch,
 [{'expr':'+(vol3*k_gal).toFixed(4)','out':'Gallons','unit':'gal'},{'expr':'+((vol3*k_gal)*3.78541).toFixed(4)','out':'Liters','unit':'L'},{'expr':'+((vol3*k_gal)*4).toFixed(3)','out':'Quarts','unit':'qt'},{'expr':'+((vol3*k_gal)*128).toFixed(2)','out':'Fluid oz','unit':'oz'}]))
# pressure: live to_psi
P={'psi':1,'bar':14.5038,'kpa':0.145038,'atm':14.6959,'mmhg':0.0193368,'inhg':0.491154}
lab,ch=choices('pressure_converter','pres_from',{k:{'k_psi':v} for k,v in P.items()})
put('pressure_converter',lambda sp:entry(sp,'pres_from',lab,{'k_psi':'psi per selected unit'},ch,
 [{'expr':'+(pres_in*k_psi).toFixed(4)','out':'PSI','unit':'psi'},{'expr':'+((pres_in*k_psi)/14.5038).toFixed(4)','out':'bar','unit':'bar'},{'expr':'+((pres_in*k_psi)/0.145038).toFixed(3)','out':'kPa','unit':'kPa'},{'expr':'+((pres_in*k_psi)/14.6959).toFixed(5)','out':'atm','unit':'atm'}]))
# power: live to_kw (ftlbs is not selectable -> not declared)
W={'hp':0.745699,'kw':1,'ps':0.735499,'watts':0.001}
lab,ch=choices('power_converter','pow_from',{k:{'k_kw':v} for k,v in W.items()})
put('power_converter',lambda sp:entry(sp,'pow_from',lab,{'k_kw':'kW per selected unit'},ch,
 [{'expr':'+((pow_in*k_kw)/0.745699).toFixed(2)','out':'HP (SAE)','unit':'hp'},{'expr':'+(pow_in*k_kw).toFixed(2)','out':'kW','unit':'kW'},{'expr':'+((pow_in*k_kw)/0.735499).toFixed(2)','out':'PS / CV','unit':'PS'}]))
# injector: live lbhr -> cc = flow*10.5042 ; ccmin -> lb = flow/10.5042 (division preserved via mul/div pair)
I={'lbhr':{'lb_mul':1,'lb_div':1,'cc_mul':10.5042,'cc_div':1},'ccmin':{'lb_mul':1,'lb_div':10.5042,'cc_mul':1,'cc_div':1}}
lab,ch=choices('injector_flow','flow_from',I)
put('injector_flow',lambda sp:entry(sp,'flow_from',lab,{'lb_mul':'lb/hr multiplier','lb_div':'lb/hr divisor','cc_mul':'cc/min multiplier','cc_div':'cc/min divisor'},ch,
 [{'expr':'flow1*lb_mul/lb_div','out':'lb/hr','unit':'lb/hr'},{'expr':'flow1*cc_mul/cc_div','out':'cc/min','unit':'cc/min'}]))
# wind: live factor = head 0.01 / tail -0.01 ; new_et = +(et + wind*factor*0.1).toFixed(3)
lab,ch=choices('wind_et','wind_dir',{'head':{'wind_factor':0.01},'tail':{'wind_factor':-0.01}})
put('wind_et',lambda sp:entry(sp,'wind_dir',lab,{'wind_factor':'wind direction factor'},ch,[{'expr':'+(et_wnd+(wind_spd*wind_factor*0.1)).toFixed(3)','out':'Corrected ET','unit':'sec'}]))
# max_rpm: live limits
lab,ch=choices('max_rpm','type_mr',{'street':{'mps_limit':4000},'perf':{'mps_limit':4500},'race':{'mps_limit':5000}})
put('max_rpm',lambda sp:entry(sp,'type_mr',lab,{'mps_limit':'mean piston speed limit (ft/min)'},ch,[{'expr':'Math.round((mps_limit*12)/(str_mr*2))','out':'Max Safe RPM','unit':'RPM'}]))
# fuse: live factor table
lab,ch=choices('fuse_sizing','type_fs',{'continuous':{'k_fuse':1.25},'intermittent':{'k_fuse':1.0},'inrush':{'k_fuse':1.5}})
put('fuse_sizing',lambda sp:entry(sp,'type_fs',lab,{'k_fuse':'fuse sizing multiplier'},ch,[{'expr':'+(amps_fs*k_fuse).toFixed(0)','out':'Min Fuse Rating','unit':'A'}]))
# ring gap: live factors
G={'street':[0.0045,0.0048],'na_race':[0.0045,0.0050],'nitrous_street':[0.0050,0.0055],'nitrous_race':[0.0070,0.0075],'boost':[0.0070,0.0075]}
lab,ch=choices('ring_gap','app_rg',{k:{'k_top':v[0],'k_second':v[1]} for k,v in G.items()})
put('ring_gap',lambda sp:entry(sp,'app_rg',lab,{'k_top':'top ring gap per inch of bore','k_second':'second ring gap per inch of bore'},ch,
 [{'expr':'bore_rg*k_top','out':'Top Ring Gap','unit':'in'},{'expr':'bore_rg*k_second','out':'Second Ring Gap','unit':'in'}]))
# bearing: live p = life_exp===3 ? 3 : (life_exp===3.33 ? 10/3 : NaN); valid = load>0 && C>0 && rpm>0 && finite p
lab,ch=choices('bearing_life','life_exp',{'3':{'p':3},'3.33':{'p':10/3}},disp={'3.33':{'p':'10/3'}},numeric=True)
G_b='load_br>0 && rated_load>0 && rpm_br>0'
put('bearing_life',lambda sp:entry(sp,'life_exp',lab,{'p':'load-life exponent'},ch,
 [{'expr':'(%s) ? Math.pow(rated_load/load_br,p) : NaN'%G_b,'out':'L10 Life','unit':'million rev'},
  {'expr':'(%s) ? Math.pow(rated_load/load_br,p)*1000000/(rpm_br*60) : NaN'%G_b,'out':'L10 Life (hours)','unit':'hours'}]))
open(F,'w',encoding='utf8').write(s)
json.dump(LOG,open('d009/registry-edits.json','w'),indent=1,ensure_ascii=False)
print('rewrote',len(LOG),'entries:',' '.join(LOG))
