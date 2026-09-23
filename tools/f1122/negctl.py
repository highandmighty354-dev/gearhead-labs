import glob,subprocess,sys,json,os
N=int(sys.argv[1]); src=open(glob.glob('F1_12_2_*.html')[0],encoding='utf8').read()
FPS="    else if(s_from==='fps'){ mph=+(s_in/1.46667).toFixed(2); kph=+(s_in/0.91134).toFixed(2); mps=+(s_in/3.28084).toFixed(3); }\n"
def reg(fn):
    s=src; R0=s.find('const GH_BACKFILL_FORMULAS'); R1=s.find('\n',R0); seg=s[R0:R1]; key='"speed_converter":'; i=seg.find(key+'{'); b=i+len(key); d=0;k=b;st=esc=False
    while True:
        c=seg[k]
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
    spec=json.loads(seg[b:k+1]); fn(spec); return s[:R0]+seg[:b]+json.dumps(spec,ensure_ascii=False,separators=(',',':'))+seg[k+1:]+s[R1:]
def ch(spec,v): return [c for c in spec['options']['s_from']['choices'] if c['value']==v][0]
if N==1: name='remove the ft/s branch (live)'; s=src.replace(FPS,'',1)
elif N==2: name='1% change to one bound constant (fps mph_div 1.46667)'; s=reg(lambda sp: ch(sp,'fps')['bind'].__setitem__('mph_div',round(1.46667*1.01,8)))
elif N==3: name='multiply swapped for divide (kph source: mph)'; s=reg(lambda sp: ch(sp,'kph')['bind'].update({'mph_mul':1.60934,'mph_div':1}))
elif N==4: name='drop ft/s from the declaration'; s=reg(lambda sp: sp['options']['s_from'].__setitem__('choices',[c for c in sp['options']['s_from']['choices'] if c['value']!='fps']))
elif N==5: name='ft/s branch writes to the wrong outputs (mph/km/h swapped)'; s=src.replace(FPS,"    else if(s_from==='fps'){ mph=+(s_in/0.91134).toFixed(2); kph=+(s_in/1.46667).toFixed(2); mps=+(s_in/3.28084).toFixed(3); }\n",1)
assert s!=src; fn=f'ctl{N}.html'; open(fn,'w',encoding='utf8').write(s); res={}
r=subprocess.run(['timeout','200','node','--max-old-space-size=6000','gh-verify-engine.js',fn,'--ids','speed_converter'],capture_output=True,text=True)
res['engine']=(r.returncode,[l.strip() for l in r.stdout.splitlines() if l.startswith('[FAIL]')],[l.strip() for l in r.stdout.splitlines() if l.startswith('        ')][:1])
r=subprocess.run(['node','engine.test.js',fn],capture_output=True,text=True); res['node']=(r.returncode,[l.strip()[:90] for l in r.stdout.splitlines() if l.startswith('FAIL')][:1],[r.stdout.strip().splitlines()[-1]])
os.remove(fn); caught=any(v[0]!=0 for v in res.values())
print(('CAUGHT  ' if caught else 'MISSED  ')+f'control {N}: {name}')
for k,(code,fails,det) in res.items(): print(f'   {k:6} exit {code}: {"; ".join(fails) if fails else "no failing suite"}'+(f' | {det[0][:140]}' if det and det[0] else ''))
json.dump({'control':N,'name':name,'caught':caught,'results':{k:{'exit':v[0],'fails':v[1],'detail':v[2]} for k,v in res.items()}},open(f'sc/negctl-{N}.json','w'),indent=1)
