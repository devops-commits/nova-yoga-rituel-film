"""Enclosures frame each experience from inside, with an open passage to the clearing."""
from math import sin,cos,pi,tau,exp
from random import Random
from canopies import gallery
from raccord_geometrie import cypres_monde3,rangees_cypres,lanterne_monde3,tiges_lanterne

VOILES_DE_FOND_4=True

def enclosure(g,n):
    rng=Random(100+n)
    if n==1:
        # Woven clay alcove rising behind the central bowl.
        for j in range(21):
            a=.13+pi*.92*j/20
            x,y=7.6*cos(a),6.2*sin(a)
            g.tube('Montant de la chambre',[(x,y,.05),(x*1.02,y,2.9),(x*.89,y+.4,4.4+.36*cos(a*3))],.083,'brass')
        g.bowl('Bol de réception',(0,2,.01),1.45,.77,'basalt')
    if n==2:
        # An acoustic shell with broad resonating wooden ribs, open towards the entrance.
        gallery(g,0,2,7.6,8.2,6.2,'brass','ink')
        for j in range(27):
            x=-6.6+13.2*j/26
            y=4.2+.095*x*x;top=4.5+.85*cos(x*.48)
            for dx in [-.032,.032]:
                g.tube('Cordes de fond',[(x+dx,y,.30),(x+dx,y+.17,top)],.016,'gold')
        g.box('Chevalet de résonance',(0,2,.24),(2.3,.74,.48),'ink')
    if n==3:
        # Charred volcanic cirque, perforated by fine incandescent fault lines.
        for j in range(29):
            a=-.42+(pi+.84)*j/28;r=7.9+rng.uniform(-.65,.45)
            x,y=r*cos(a),r*sin(a)
            h=rng.uniform(2.8,6.6)
            g.rock('Orgue basaltique',(x,y,h*.38),(.8+rng.random()*.6,1.2,h*.65),'orgue',j+40)
            if j%2==0:
                g.tube('Suture de feu',[(x*.86+.064*sin(i),y*.86,.16+i*h/19) for i in range(15)],.022,'gold')
        g.rock('Foyer de schiste',(0,2,.13),(1.2,.90,.36),'ink',14)
        # Raccord : de la clairière, la cible lit ce cirque comme une rangée de cyprès et la relique comme une
        # lanterne dans sa cage de tiges (cotes : raccord_geometrie.py). 'orgue' (= 'ink', salle) et 'cypres',
        # 'lanterne', 'jonc' (lointain) sont fondus l'un dans l'autre par le jeu selon la distance caméra → salle
        # (atmosphere.js, FONDU_MONDE3). Le lointain est hors collisions et hors ombres au sol (build.navigation).
        for j,(x,y,h,r) in enumerate(cypres_monde3()):
            g.surface('Cyprès du lointain',rangees_cypres(x,y,h,r,j),'cypres')
        globe=lanterne_monde3()
        g.ell('Lanterne du lointain',globe['centre'],(globe['rayon'],)*3,'lanterne')
        for points in tiges_lanterne():
            g.tube('Tige de la lanterne',points,.024,'jonc')
    if n==4:
        # Fond de la salle : trois grands voiles opaques, dont l'écran film0 (géométrie et matières d'origine).
        # Raccord : depuis la clairière la cible ne montre que le voile tendu de gardens.world4 devant les
        # montagnes ; le jeu les fond donc selon la position de la caméra (atmosphere.js, FONDU_MONDE4),
        # ils restent construits. VOILES_DE_FOND_4 = False les retire du GLB.
        for j in range(3 if VOILES_DE_FOND_4 else 0):
            rows=[]
            for k in range(17):
                t=k/16
                rows.append([(-7.6+i*.75,4.2+j*1.4+.9*sin(i*.33+t*2.),
                             2.0+j*.89+t*(1.7+.65*sin(i*.26))+1.4*cos(i*.21+j)) for i in range(21)])
            g.surface('Grand voile de lin',rows,'silk' if j!=1 else 'film0')
        g.ell('Îlot du souffle',(0,2,.04),(1.45,.85,.11),'chalk')
    if n==5:
        for j in range(4):
            rows=[]
            for k in range(15):
                t=k/14
                rows.append([(-8.1+i*.77,5.4+.32*j+.73*sin(i*.34+j*.37+t),
                             -.15+t*(2.8+j*.61+.61*cos(i*.42+j))) for i in range(22)])
            g.surface('Strates de terre tinctoriale',rows,['rose','clay','brass','ink'][j])
        g.box('Table de l’empreinte',(0,2,.31),(2.7,1.2,.58),'basalt')
    if n==6:
        for j in range(18):
            a=-.45+(pi+.9)*j/17;r=8.15+.32*sin(j)
            h=3.4+.90*cos(a*4)
            g.rock('Rive submergée',(r*cos(a),r*sin(a),h*.24),(1.45,1.25,h*.68),'jade',30+j)
        for k in range(5):
            pts=[((1.2+k*.17)*cos(tau*j/64),2+(.81+k*.12)*sin(tau*j/64),.12-k*.017) for j in range(65)]
            g.tube('Cercle de surface',pts,.018,'silk')
        g.ell('Miroir d’eau',(0,2,.026),(1.95,1.42,.052),'water')
    if n==7:
        for j in range(37):
            u=j/36;points=[]
            for i in range(47):
                t=i/46
                a=-.30+(pi+.60)*t
                r=7.6+.80*sin(t*tau*2+u*tau)
                points.append((r*cos(a),r*sin(a),.16+u*5.5+.76*sin(t*tau*2+u*tau)))
            g.tube('Trame de la chambre',points,.026 if j%5 else .051,'gold' if j%5==0 else 'brass')
        g.box('Métier de lumière',(0,2,.22),(2.55,.84,.40),'ink')

