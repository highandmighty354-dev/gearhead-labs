# Build a damaged copy for control N and run all three harnesses on it. Usage: python3 m13/negctl.py N
import glob,subprocess,sys,json,os,re
N=int(sys.argv[1]); src=open(glob.glob('F1_12_1_*.html')[0],encoding='utf8').read()
KUS_R="((wt_ug*ug_fpct/100)/cf_stiff)-((wt_ug*(100-ug_fpct)/100)/cr_stiff)".replace('wt_ug','ug_vw')
REG_E="(((ug_vw*ug_fpct/100)/cf_stiff)-((ug_vw*(100-ug_fpct)/100)/cr_stiff))"
def rep(s,a,b,n):
    assert s.count(a)==n,(a[:60],s.count(a)); return s.replace(a,b)
s=src
if N==1:  # restore the old index formula
    s=rep(s,"const kus = valid ? "+KUS_R+" : NaN;","const kus = valid ? ((ug_fpct/cf_stiff)-((100-ug_fpct)/cr_stiff))*1000 : NaN;",2)
    s=rep(s,") ? "+REG_E+" : NaN",") ? (((ug_fpct/cf_stiff)-((100-ug_fpct)/cr_stiff))*1000) : NaN",1); name='restore old index formula'
elif N==2:  # swap Wf and Wr
    sw="((ug_vw*(100-ug_fpct)/100)/cf_stiff)-((ug_vw*ug_fpct/100)/cr_stiff)"
    s=rep(s,"const kus = valid ? "+KUS_R+" : NaN;","const kus = valid ? "+sw+" : NaN;",2); s=rep(s,") ? "+REG_E+" : NaN",") ? ("+sw+") : NaN",1); name='swap Wf and Wr'
elif N==3:  # remove the validation guard
    g="const valid=[cf_stiff,cr_stiff,ug_fpct,ug_vw].every(n=>Number.isFinite(n))&&cf_stiff>0&&cr_stiff>0&&ug_fpct>0&&ug_fpct<100&&ug_vw>0;"
    s=rep(s,g,"const valid=true;",2)
    s=rep(s,'"expr":"([cf_stiff,cr_stiff,ug_fpct,ug_vw].every(n=>Number.isFinite(n))&&cf_stiff>0&&cr_stiff>0&&ug_fpct>0&&ug_fpct<100&&ug_vw>0) ? '+REG_E+' : NaN"','"expr":"'+REG_E+'"',1); name='remove validation guard'
elif N==4:  # rename ug_fpct back to wt_f
    n=len(re.findall(r'\bug_fpct\b',s)); s=re.sub(r'\bug_fpct\b','wt_f',s); name=f'rename ug_fpct back to wt_f ({n} occurrences)'
elif N==5:  # revert the example
    s=rep(s,"A 3,420 lb car with 48% front weight carries 1,641.6 lb on the front axle and 1,778.4 lb on the rear. With 180 lbs/deg front and 210 lbs/deg rear axle cornering stiffness, Kus = 1,641.6/180 − 1,778.4/210 ≈ 0.651 deg/g — positive, so the car understeers.",
          "A 180 lbs/deg front and 210 lbs/deg rear cornering stiffness, with 48% front weight distribution, calculates a specific Kus value — positive indicating understeer tendency, negative indicating oversteer, zero indicating neutral handling balance.",1); name='revert example to old wording'
elif N==6:  # EXTRA: rename ug_vw back to the rejected wt_ug
    n=len(re.findall(r'\bug_vw\b',s)); s=re.sub(r'\bug_vw\b','wt_ug',s); name=f'EXTRA: rename ug_vw back to wt_ug ({n} occurrences)'
assert s!=src
fn=f'ctl{N}.html'; open(fn,'w',encoding='utf8').write(s)
res={}
r=subprocess.run(['timeout','150','node','--max-old-space-size=6000','gh-verify-live.js',fn],capture_output=True,text=True); res['live']=(r.returncode,[l.strip() for l in r.stdout.splitlines() if l.startswith('[FAIL]')],[l.strip() for l in r.stdout.splitlines() if l.startswith('        ')][:1])
r=subprocess.run(['timeout','150','node','--max-old-space-size=6000','gh-verify-engine.js',fn,'--ids','understeer_gradient'],capture_output=True,text=True); res['engine']=(r.returncode,[l.strip() for l in r.stdout.splitlines() if l.startswith('[FAIL]')],[l.strip() for l in r.stdout.splitlines() if l.startswith('        ')][:2])
r=subprocess.run(['node','engine.test.js',fn],capture_output=True,text=True); res['node']=(r.returncode,[l.strip() for l in r.stdout.splitlines() if l.startswith('FAIL')][:2],[r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr[-200:]])
os.remove(fn)
caught=any(v[0]!=0 for v in res.values())
print(('CAUGHT  ' if caught else 'MISSED  ')+f'control {N}: {name}')
for k,(code,fails,det) in res.items(): print(f'   {k:6} exit {code}: {"; ".join(fails) if fails else "no failing suite"}' + (f' | {det[0][:150]}' if det and det[0] else ''))
json.dump({'control':N,'name':name,'caught':caught,'results':{k:{'exit':v[0],'fails':v[1],'detail':v[2]} for k,v in res.items()}},open(f'm13/negctl-{N}.json','w'),indent=1)
