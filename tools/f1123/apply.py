# F1.12.3-UI-MOBILE-HEADER: add ONE style block (approved CSS, phones <=480px only) before </head>.
import glob
src=glob.glob('F1_12_2_*.html')[0]; s=open(src,encoding='utf8').read()
CSS="""<style id="gh-mobile-header-fit">
/* F1.12.3 UI-only: on phones (<=480px) the header row was wider than the screen, so the fixed 150px logo
   spilled under the Imperial/Metric toggle. Compact the toggle (32px tall for touch) and let the logo scale
   down proportionally only when a screen is too narrow for it. Desktop/tablet unaffected. */
@media(max-width:480px){
  header.gh-premium-header{column-gap:8px}
  .gh-header-left{gap:8px}
  .gh-header-brand{flex:0 1 150px;width:auto;min-width:0}
  .gh-header-brand img{width:100%;max-width:150px;height:auto}
  .gh-header-right{flex-shrink:0;gap:6px}
  .gh-unit-toggle .unit-btn{font-size:10.5px;padding:0 7px;min-height:32px;line-height:1}
}
</style>
"""
assert s.count('</head>')==1 and 'gh-mobile-header-fit' not in s
out=s.replace('</head>',CSS+'</head>',1)
open('F1_12_3_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html','w',encoding='utf8').write(out)
print('added',len(CSS),'bytes')
