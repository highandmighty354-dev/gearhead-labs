# F1.12.2: speed_converter only. (1) live renderer: add the missing ft/s branch (approved text);
# (2) GH_BACKFILL_FORMULAS: D-009 options entry whose bound constants are copied from the live branches.
import glob,json
F=glob.glob('F1_12_2_*.html')[0]; s=open(F,encoding='utf8').read()
old="""    else if(s_from==='mps'){ mph=+(s_in*2.23694).toFixed(2); kph=+(s_in*3.6).toFixed(2); fps=+(s_in*3.28084).toFixed(2); }
"""
new=old+"""    else if(s_from==='fps'){ mph=+(s_in/1.46667).toFixed(2); kph=+(s_in/0.91134).toFixed(2); mps=+(s_in/3.28084).toFixed(3); }
"""
assert s.count(old)==1; s=s.replace(old,new)
R0=s.find('const GH_BACKFILL_FORMULAS'); R1=s.find('\n',R0); seg=s[R0:R1]
key='"speed_converter":'; i=seg.find(key+'{'); b=i+len(key); d=0;k=b;st=esc=False
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
before=json.loads(seg[b:k+1])
# live branch semantics, per source unit, per output: identity (1/1), multiply (k/1) or divide (1/k)
B=lambda m,d:{'mul':m,'div':d}
T={'mph':{'mph':B(1,1),'kph':B(1.60934,1),'mps':B(0.44704,1),'fps':B(1.46667,1)},
   'kph':{'mph':B(1,1.60934),'kph':B(1,1),'mps':B(1,3.6),'fps':B(0.91134,1)},
   'mps':{'mph':B(2.23694,1),'kph':B(3.6,1),'mps':B(1,1),'fps':B(3.28084,1)},
   'fps':{'mph':B(1,1.46667),'kph':B(1,0.91134),'mps':B(1,3.28084),'fps':B(1,1)}}
labels={'mph':'mph','kph':'km/h','mps':'m/s','fps':'ft/s'}
params={}
for o,nm in [('mph','mph'),('kph','km/h'),('mps','m/s'),('fps','ft/s')]:
    params[o+'_mul']=f'{nm} multiplier for the selected unit'; params[o+'_div']=f'{nm} divisor for the selected unit'
choices=[{'value':u,'label':labels[u],'bind':{f'{o}_{p}':T[u][o][p] for o in ['mph','kph','mps','fps'] for p in ['mul','div']}} for u in ['mph','kph','mps','fps']]
after={'labels':['Speed','From Unit'],'vars':['s_in','s_from'],'options':{'s_from':{'params':params,'choices':choices}},
 'outputs':[{'expr':'s_in*mph_mul/mph_div','out':'MPH','unit':'mph'},{'expr':'s_in*kph_mul/kph_div','out':'KM/H','unit':'km/h'},
            {'expr':'s_in*mps_mul/mps_div','out':'M/S','unit':'m/s'},{'expr':'s_in*fps_mul/fps_div','out':'FT/S','unit':'ft/s'}]}
seg=seg[:b]+json.dumps(after,ensure_ascii=False,separators=(',',':'))+seg[k+1:]
s=s[:R0]+seg+s[R1:]
open(F,'w',encoding='utf8').write(s)
json.dump({'live_branch_added':new.splitlines()[-1].strip(),'registry_before':before,'registry_after':after},open('sc/edits.json','w'),indent=1,ensure_ascii=False)
print('edited: live fps branch + registry entry'); print(json.dumps(after['options']['s_from']['choices'][3]))
