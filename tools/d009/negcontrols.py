import json,glob,subprocess,os,re
SRC=open(glob.glob('F1_12_0_*.html')[0],encoding='utf8').read()
def span(text,rid):
    i=text.find('"%s":{'%rid); b=text.find('{',i); d=0; k=b; st=esc=False
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
def mutate(rid,fn):
    s=SRC; R0=s.find('const GH_BACKFILL_FORMULAS'); R1=s.find('\n',R0); seg=s[R0:R1]
    a,b=span(seg,rid); spec=json.loads(seg[a:b]); fn(spec)
    return s[:R0]+seg[:a]+json.dumps(spec,ensure_ascii=False,separators=(',',':'))+seg[b:]+s[R1:]
def c1(sp):
    for c in sp['options']['pres_from']['choices']:
        if c['value']=='bar': c['bind']['k_psi']=round(c['bind']['k_psi']*1.01,10)
def c2(sp): sp['options']['d_from']['choices'].append({'value':'furlong','label':'Furlongs','bind':{'k_mi':0.125,'k_km':0.201168,'k_ft':660,'k_m':201.168}})
def c3(sp): sp['options']['d_from']['choices']=[c for c in sp['options']['d_from']['choices'] if c['value']!='yd']
def c4(sp):
    for c in sp['options']['d_from']['choices']:
        if c['value']=='km': c['value']='KM'
def c5(sp):
    for c in sp['options']['d_from']['choices']:
        if c['value']=='km': c['value']='km '
def c6(sp):
    for i,c in enumerate(sp['options']['wind_dir']['choices']): c['value']=i+1
def c7(sp): sp['outputs'][0]['expr']="+(et_wnd+(wind_spd*(wind_dir==='head'?0.01:-0.01)*0.1)).toFixed(3)"
controls=[('1% change to one bound constant (pressure bar)','pressure_converter',mutate('pressure_converter',c1)),
 ('add an undeclared option (distance furlong)','distance_converter',mutate('distance_converter',c2)),
 ('remove a live option (distance yd)','distance_converter',mutate('distance_converter',c3)),
 ('change option case (km -> KM)','distance_converter',mutate('distance_converter',c4)),
 ('add whitespace (km -> "km ")','distance_converter',mutate('distance_converter',c5)),
 ('numeric code instead of declared string (wind head/tail -> 1/2)','wind_et',mutate('wind_et',c6)),
 ('string comparison inside formula (wind_et)','wind_et',mutate('wind_et',c7))]
hide=SRC.replace("Object.keys(d.params).forEach(p => {","Object.keys(d.params).filter(p => p !== 'p').forEach(p => {",1)
assert hide!=SRC; controls.append(('hide a bound constant from the legend (bearing p)','bearing_life',hide))
res=[]
for name,rid,page in controls:
    open('ctl.html','w',encoding='utf8').write(page)
    r=subprocess.run(['node','--max-old-space-size=6000','gh-verify-engine.js','ctl.html','--ids',rid],capture_output=True,text=True)
    fails=[l.strip() for l in r.stdout.splitlines() if l.startswith('[FAIL]')]
    detail=[l.strip() for l in r.stdout.splitlines() if l.startswith('        ')][:1]
    res.append({'control':name,'calculator':rid,'exit':r.returncode,'caught':r.returncode!=0,'failing_suites':fails,'first_detail':detail})
    print(('CAUGHT ' if r.returncode else 'MISSED ')+name); [print('    ',f) for f in fails]; [print('    ',d[:170]) for d in detail]
os.remove('ctl.html'); json.dump(res,open('d009/negative-controls.json','w'),indent=1)
print('\n%d/%d controls caught'%(sum(x['caught'] for x in res),len(res)))
