# M1.3 (F1.12.1): understeer_gradient correction. Edits exactly four things in the page.
import glob,json,re
F=glob.glob('F1_12_1_*.html')[0]; s=open(F,encoding='utf8').read()
BODY=r"""
    const cf_stiff=vd('cf_stiff',180), cr_stiff=vd('cr_stiff',210), ug_fpct=vd('ug_fpct',48), ug_vw=vd('ug_vw',3420);
    /* M1.3 (F1.12.1): Gillespie understeer gradient, deg/g. Axle cornering stiffness
       pairs with AXLE load: Kus = Wf/Cf - Wr/Cr, Wf = W*f/100, Wr = W*(100-f)/100.
       The % field is ug_fpct (was wt_f, which matched the vehicle-weight profile pattern). */
    const valid=[cf_stiff,cr_stiff,ug_fpct,ug_vw].every(n=>Number.isFinite(n))&&cf_stiff>0&&cr_stiff>0&&ug_fpct>0&&ug_fpct<100&&ug_vw>0;
    const kus = valid ? ((ug_vw*ug_fpct/100)/cf_stiff)-((ug_vw*(100-ug_fpct)/100)/cr_stiff) : NaN;
    /* Verdict: the pre-M1.3 +/-0.5 index threshold carried over EXACTLY (same expression and
       rounding as before), which is |Kus| <= 0.5*W/100000 deg/g. Every valid input keeps its verdict. */
    const idx = valid ? +((+((ug_fpct/cf_stiff)-((100-ug_fpct)/cr_stiff)).toFixed(5))*1000).toFixed(2) : NaN;
    const balance_u = idx>0.5?'Understeer (push) \u2014 front reaches limit first':idx<-0.5?'Oversteer (loose) \u2014 rear reaches limit first':'Neutral balance';
    const color_u = idx>0.5?'var(--amber)':idx<-0.5?'var(--red)':'var(--green)';
    const shown = valid ? (Object.is(+kus.toFixed(3),-0)?0:kus).toFixed(3) : '';
    return `${headerHTML('Understeer Gradient','Kus = Wf/Cf \u2212 Wr/Cr, in deg/g. Wf = W \u00d7 front %/100 and Wr = W \u00d7 (100 \u2212 front %)/100 are the front and rear AXLE loads (lb); Cf and Cr are the front and rear AXLE cornering stiffnesses (lb/deg). Positive = understeer, negative = oversteer, zero = neutral. Cornering stiffness comes from tire data or estimated from tire construction and pressure.')}
    <div class="calc-body">
      ${field('Front Axle Cornering Stiffness','cf_stiff',180,'lbs/deg')}
      ${field('Rear Axle Cornering Stiffness','cr_stiff',210,'lbs/deg')}
      ${field('Front Weight %','ug_fpct',48,'%')}
      ${field('Vehicle Weight','ug_vw',3420,getU('weight'))}
      ${valid?`<div class="result-box">
        <div class="result-label">Understeer Gradient (Kus)</div>
        <div class="result-value" style="color:${color_u}">${shown}<span class="result-unit">deg/g</span></div>
        <div style="margin-top:8px;font-size:13px;color:${color_u}">${balance_u}</div>
      </div>`:`<div class="result-box"><div class="result-label">Validation required</div><div class="result-value">\u2014</div><div class="help-note">Vehicle weight and both axle cornering stiffnesses must be positive; front weight % must be greater than 0 and less than 100.</div></div>`}
    </div>${calcFooter('Understeer Gradient')}`;
"""
# 1) live late renderer
a=s.find('RENDERS.understeer_gradient = () => {'); b=s.find('\n  };',a); assert a>0 and b>a and s.count('RENDERS.understeer_gradient = () => {')==1
s=s[:a]+'RENDERS.understeer_gradient = () => {'+BODY+'  '+s[b+3:] if False else s[:a]+'RENDERS.understeer_gradient = () => {'+BODY+'  }'+s[b+4:]
# 2) dead object method: identical body
a=s.find('  understeer_gradient(){'); b=s.find('\n  },',a); assert a>0 and s.count('  understeer_gradient(){')==1
s=s[:a]+'  understeer_gradient(){'+BODY+'  }'+s[b+4:]
# 3) registry (GH_E1_FORMULAS)
i=s.find('"understeer_gradient":{"labels"'); j=s.find('}',s.find('"defaults"',i))+1
old=s[i:j]; assert '"unit":"index"' in old
spec={"labels":["Front Axle Cornering Stiffness","Rear Axle Cornering Stiffness","Front Weight %","Vehicle Weight"],"vars":["cf_stiff","cr_stiff","ug_fpct","ug_vw"],
 "expr":"([cf_stiff,cr_stiff,ug_fpct,ug_vw].every(n=>Number.isFinite(n))&&cf_stiff>0&&cr_stiff>0&&ug_fpct>0&&ug_fpct<100&&ug_vw>0) ? (((ug_vw*ug_fpct/100)/cf_stiff)-((ug_vw*(100-ug_fpct)/100)/cr_stiff)) : NaN",
 "out":"Understeer Gradient (Kus)","unit":"deg/g","post":"result","defaults":[180,210,48,3420]}
s=s[:i]+'"understeer_gradient":'+json.dumps(spec,ensure_ascii=False,separators=(',',':'))+s[j:]
# 4) CONTENT example
oldex="A 180 lbs/deg front and 210 lbs/deg rear cornering stiffness, with 48% front weight distribution, calculates a specific Kus value — positive indicating understeer tendency, negative indicating oversteer, zero indicating neutral handling balance."
newex="A 3,420 lb car with 48% front weight carries 1,641.6 lb on the front axle and 1,778.4 lb on the rear. With 180 lbs/deg front and 210 lbs/deg rear axle cornering stiffness, Kus = 1,641.6/180 − 1,778.4/210 ≈ 0.651 deg/g — positive, so the car understeers."
assert s.count(oldex)==1; s=s.replace(oldex,newex)
open(F,'w',encoding='utf8').write(s)
json.dump({'registry_before':old,'registry_after':json.dumps(spec,ensure_ascii=False),'example_before':oldex,'example_after':newex},open('m13/edits.json','w'),indent=1,ensure_ascii=False)
print('edited: live renderer, dead object method, registry, example')
