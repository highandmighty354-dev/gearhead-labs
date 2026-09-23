import json,glob,sys,copy
F=glob.glob('F1_11_1_*.html')[0]; s=open(F,encoding='utf8').read()
REGS=['GH_E1_FORMULAS','GH_E101_FORMULAS','GH_LEGACY_FORMULAS','GH_BACKFILL_FORMULAS']
def entry_span(text,start,rid):
    key='"%s":{'%rid; i=text.find(key,start)
    if i<0: return None
    b=i+len(key)-1; d=0; k=b; st=False; esc=False
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
            if d==0: break
        k+=1
    return (b,k+1)
def reg_bounds(name):
    i=s.find('const '+name); j=s.find('\n',i); return i,j
LOG={}
def edit(rid, fn, note):
    global s
    hits=0; before=None; after=None
    for name in REGS:
        i,j=reg_bounds(name); seg=s[i:j]
        sp=entry_span(seg,0,rid)
        if not sp: continue
        spec=json.loads(seg[sp[0]:sp[1]])
        b=copy.deepcopy(spec); fn(spec)
        if before is None: before,after=b,spec
        else: assert json.dumps(b)==json.dumps(before), 'duplicate registry entries were not identical: '+rid
        new=json.dumps(spec,ensure_ascii=False,separators=(',',':'))
        s=s[:i]+seg[:sp[0]]+new+seg[sp[1]:]+s[j:]; hits+=1
    assert hits, rid
    LOG[rid]={'registries':hits,'note':note,'before':before,'after':after}
def guard_all(G, which=None):
    def f(spec):
        outs=spec['outputs'] if 'outputs' in spec else None
        if outs is None: spec['expr']='(%s) ? (%s) : NaN'%(G,spec['expr']); return
        for n,o in enumerate(outs):
            if which is None or n in which: o['expr']='(%s) ? (%s) : NaN'%(G,o['expr'])
    return f
E=edit
E('weight_reduction',guard_all('[hp3,wt3,red].every(Number.isFinite)&&(wt3-red)>0'),'live: gain = (finite && newWt>0) ? ... : NaN')
E('static_compression',guard_all('bore2>0&&stroke2>0&&chamber>=0&&gasket>=0&&(chamber+gasket-piston)>0'),'live: invalid box for all outputs unless valid')
E('tire_size',guard_all('tw>0 && ar>0 && wr>0'),'live: invalid box unless valid (registry returned 0)')
E('air_density',guard_all('Number.isFinite(tempF)&&Number.isFinite(presInHg)&&Number.isFinite(rh)&&presInHg>0&&rh>=0&&rh<=100'),'live: invalid box unless valid (registry returned 0)')
E('dyno_correction',guard_all('hp_raw>0&&Number.isFinite(da3)&&Number.isFinite(temp5)'),'live: invalid box unless valid (registry returned 0)')
E('valve_lash',guard_all('base_lift>=0 && rocker_r>0 && target_lash>=0'),'live: invalid box unless valid (registry returned 0)')
E('valve_spring_rate',guard_all('d>0 && n>0 && D>d && seat>=0 && lift>=0'),'live: invalid box unless valid (registry returned 0)')
E('breakover_angle',guard_all('wb>0 && ground>=0'),'live: invalid box unless valid (registry returned 0)')
E('rc_downforce',guard_all('cl>=0 && area>0 && speed>=0 && cd>=0'),'live: main result invalid box unless valid (registry returned 0)')
E('dynamic_compression',guard_all('[bore,stroke3,rod,scr,ica].every(Number.isFinite)&&bore>0&&stroke3>0&&rod>stroke3/2&&scr>1&&ica>=0&&ica<180'),'live (captured object method via oldDCR wrapper): validation box unless guard holds; registry had no guard')
def revdisp(spec):
    o=spec['outputs']; b0,b1=o[0]['expr'],o[1]['expr']
    o[0]['expr']='(ts>0 && (%s)!==0) ? (%s) : NaN'%(b0,b0); o[1]['expr']='(tb>0 && (%s)!==0) ? (%s) : NaN'%(b1,b1)
E('reverse_displacement',revdisp,"live: v = known>0 ? expr : 0, displayed v||'—' (a 0 result shows unknown)")
E('portal_gear_reduction',guard_all('[pgr_axle,pgr_portal,pgr_drop].every(Number.isFinite)&&pgr_axle>0&&pgr_portal>0&&pgr_drop>=0'),'live: validation box unless ok (both outputs)')
def e85(spec):
    o=spec['outputs']; a=o[0]['expr']; r=o[1]['expr']
    o[0]['expr']='((%s)>0) ? (%s) : NaN'%(a,a)
    o[1]['expr']='(target_e<cur_e && !(e85_pct<target_e) && (%s)>0) ? (%s) : NaN'%(r,r)
E('e85_blend',e85,"live: add solved only in the balance branch, remove only when target<current AND E85 cannot reach it; both display '—' when <= 0; stoich unconditional (unchanged)")
E('curtain_area',guard_all('Number.isFinite(Math.PI*vd*vlift2) && port_ca>0'),'live: error box for both outputs unless finite area && port area > 0')
E('mach_index',guard_all('[mi_q,mi_a,mi_c].every(x=>Number.isFinite(x))&&mi_q>0&&mi_a>0&&mi_c>0',which=[0]),'live: validation box unless valid; output 1 had no guard')
E('rc_watt_link',guard_all('ph_len>(Math.abs(ph_travel)) && ph_len>0 && ph_wb>0'),'live: invalid box unless valid (registry returned 0)')
E('diesel_airflow',guard_all('[da_disp,da_rpm,da_ve,da_air].every(Number.isFinite)&&da_disp>0&&da_rpm>0&&da_ve>0&&da_air>0',which=[0]),'live: error box unless valid; output 1 had no guard')
E('tire_size_comparison',guard_all('tsc_ow>0&&tsc_oa>0&&tsc_od>0&&tsc_nw>0&&tsc_na>0&&tsc_nd>0'),'live: all outputs hidden unless BOTH tires valid')
def bb(spec):
    spec['labels'].append('Static Front Weight'); spec['vars'].append('fpct_bb')
    G='[wt_bb,wb_bb,cg_bb,fpct_bb,dec_bb].every(n=>Number.isFinite(n))&&wt_bb>0&&wb_bb>0&&cg_bb>=0&&fpct_bb>0&&fpct_bb<100&&dec_bb>=0'
    spec['expr']='(%s) ? (%s) : NaN'%(G,spec['expr'])
E('brake_bias',bb,'live validity requires Static Front Weight % in (0,100); input added for the guard only, transfer formula unchanged')
def mc(spec):
    o=spec['outputs']; assert len(o)==4 and o[3]==o[0]; o.pop(3)
    o[0]['expr']='([mc_pedal,mc_ratio,mc_pressure].every(n=>Number.isFinite(n)&&n>0)) ? (%s) : NaN'%o[0]['expr']
E('master_cylinder',mc,'live (bore mode, default): validation box unless all > 0; output 1 had no guard; removed byte-identical duplicate output 4')
E('throttle_body',guard_all('[tb_cid,tb_rpm,tb_ve,tb_vel].every(Number.isFinite)&&tb_cid>0&&tb_rpm>0&&tb_ve>0&&tb_vel>0',which=[0]),'live: validation box unless ok; output 1 had no guard')
def hps(spec):
    spec['labels'].append('Air Density'); spec['vars'].append('air_density_s')
    for o in spec['outputs'][1:]:
        assert o['expr'].count('*0.0765')==1; o['expr']=o['expr'].replace('*0.0765','*air_density_s')
E('hp_from_specs',hps,'live: air mass = CFM x air_density_s (input, default 0.0765); registry hard-coded 0.0765')
# bearing_life: NOT edited. Every faithful registry form of the live p = 3 / 10/3 selection renders as
# misleading code in the visitor-facing formula block (e.g. '^10/3'). Left pending (see M1.2-RESULTS.md).
open(F,'w',encoding='utf8').write(s)
json.dump(LOG,open('m12-registry-edits.json','w'),indent=1,ensure_ascii=False)
print('edited',len(LOG),'calculators;', sum(v['registries'] for v in LOG.values()),'registry entries')
