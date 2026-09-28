"""Проверка контраста пар токенов (WCAG 2.x). Текст < 18 px — не ниже 4.5:1, графика — не ниже 3:1."""
import sys
def lum(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def cr(a,b):
    la,lb=sorted([lum(a),lum(b)],reverse=True); return (la+0.05)/(lb+0.05)
T={
 'light':{
  'surface':'#FFFFFF','surface-2':'#F6F7F9','surface-3':'#EEF0F3','border':'#DDE1E7','border-strong':'#7A8391',
  'text-1':'#14171C','text-2':'#434A55','text-3':'#59616E','accent':'#1D4ED8','accent-soft':'#E8EEFD','on-accent':'#FFFFFF',
  'bar-closed':'#1A7F4B','bar-progress':'#7D8C06','bar-action':'#A86E00','bar-overdue':'#C92A32','bar-future':'#78818E',
  'b-closed-bg':'#E3F4EA','b-closed-fg':'#0F6B38','b-progress-bg':'#EDF6E1','b-progress-fg':'#3A6912',
  'b-action-bg':'#FFF0DD','b-action-fg':'#8A4700','b-overdue-bg':'#FDE8E9','b-overdue-fg':'#AE1C25','b-future-bg':'#EEF0F3','b-future-fg':'#454C57',
 },
 'dark':{
  'surface':'#111318','surface-2':'#171A21','surface-3':'#1F232C','border':'#2B303B','border-strong':'#6B7482',
  'text-1':'#E9ECF1','text-2':'#B7BECA','text-3':'#9AA2AF','accent':'#86A6FF','accent-soft':'#1C2849','on-accent':'#0B1020',
  'bar-closed':'#2E9F60','bar-progress':'#B9CC45','bar-action':'#E8A33A','bar-overdue':'#F0616A','bar-future':'#788190',
  'b-closed-bg':'#12301F','b-closed-fg':'#86DDA9','b-progress-bg':'#1D2B12','b-progress-fg':'#B8DE8F',
  'b-action-bg':'#3A2410','b-action-fg':'#FFC27A','b-overdue-bg':'#3D171A','b-overdue-fg':'#FFA0A6','b-future-bg':'#242833','b-future-fg':'#BAC1CC',
 }}
fail=0
for mode,t in T.items():
    checks=[]
    for s in ('surface','surface-2','surface-3'):
        for x in ('text-1','text-2','text-3','accent'): checks.append((x,s,4.5))
        for x in ('bar-closed','bar-progress','bar-action','bar-overdue','bar-future','border-strong'): checks.append((x,s,3.0))
    for k in ('closed','progress','action','overdue','future'): checks.append((f'b-{k}-fg',f'b-{k}-bg',4.5))
    checks += [('on-accent','accent',4.5),('accent','accent-soft',4.5),('text-1','accent-soft',4.5)]
    for a,b,need in checks:
        c=cr(t[a],t[b]); ok=c>=need; fail+= not ok
        if not ok or '-v' in sys.argv: print(f'{mode:5} {a:15} on {b:12} {c:5.2f} {"OK" if ok else "FAIL"} (>= {need})')
print('FAIL' if fail else 'ALL PASS', fail)
