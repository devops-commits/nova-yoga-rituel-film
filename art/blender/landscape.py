"""Continuous lake, eight-shot causeway, clearing and seven radial passages."""
import math
from sculpt import Set, TAU

ANGLES = [-135,-90,-45,0,45,90,135]
PALETTE = ['clay','brass','ink','chalk','rose','jade','brass']

def ground(g,name,radius,material,height=0):
    rows=[]
    for r,z in [(radius*.005,height),(radius*.6,height),(radius*.98,height),(radius,height-.13),(radius*.98,height-.6)]:
        rows.append([(r*math.cos(-TAU*i/96),r*math.sin(-TAU*i/96),z) for i in range(97)])
    return g.surface(name,rows,material)

def round_inlay(g,name,r,mat,z=.025,start=0,end=TAU):
    g.tube(name,[(r*math.cos(start+(end-start)*i/110),r*math.sin(start+(end-start)*i/110),z) for i in range(111)],.025,mat)

def landscape(materials):
    g=Set('01 • Le lac et ses reliefs',materials)
    from photographic_sets import lake
    lake(g)
    deck=Set('02 • Le chemin des huit plans',materials)
    # Basalt promontory before the first shot. The first view opens over the lake.
    for i in range(12,51):
        y=-55.5+i*.92
        deck.box('Dalle de travertin',(0,y,-.17),(5.9+.23*math.sin(i/3),.90,.34),'chalk')
    # Side promontories let the visitor circle each film projection and return to the path.
    for i,(y,side) in enumerate(zip(range(-48,-12,5),[-1,-1,1,-1,1,-1,1,-1])):
        rows=[]
        for rr,zz in [(0.001,-.06),(.91,-.06),(1,-.14),(.96,-.62)]:
            rows.append([(side*3.65+rr*3.65*math.cos(-TAU*j/64),y+rr*3.00*math.sin(-TAU*j/64),zz) for j in range(65)])
        deck.surface('Promontoire du plan '+str(i+1),rows,'basalt' if i<3 else 'clay')
    for side in [-1,1]:
        deck.tube('Filet de cuivre',[(side*2.45,-42.4+.45*i,.02) for i in range(76)],.019,'brass')
    hub=Set('04 • La clairière des entrées',materials)
    ground(hub,'Terrasse centrale',11,'chalk')
    for r in [3.8,4.0,8.7,9.0,10.65]:
        round_inlay(hub,'Cercles gravés',r,'brass')
    for i in range(84):
        a=TAU*i/84
        hub.tube('Trait de boussole',[(r*math.cos(a),r*math.sin(a),.029) for r in (8.78,8.97 if i%3 else 9.24)],.013,'ink')
    return deck

def passage(materials,n):
    a=math.radians(ANGLES[n-1])
    g=Set(f'Passage {n:02}',materials,a)
    for i in range(17):
        g.box('Dalle de seuil',(0,10+i*.94,-.17),(5.0,.92,.34),'chalk')
    for x in [-2.17,2.17]:
        g.tube('Ligne de passage',[(x,10,.025),(x,26,.025)],.026,'brass')
    for j in range(2):
        points=[]
        for i in range(65):
            t=math.pi*i/64
            points.append((2.8*math.cos(t),14.4+j*.47, .09+4.9*math.sin(t)))
        g.tube('Arc sculpté',points,.165 if j==0 else .052,PALETTE[n-1] if not j else 'gold')
    # Traces leading to a large basin, physically connected to the passage.
    room=Set(f'Monde {n:02}',materials,a,33)
    if n==1:return room
    ground(room,'Socle du monde',9.25,'chalk' if n in (1,4,7) else PALETTE[n-1])
    round_inlay(room,'Liseré',8.72,'brass')
    for j in range(12):
        start=-.40+j*.31
        rows=[]
        for k in range(6):
            row=[]
            for i in range(13):
                theta=start+.306*i/12
                top=1.25+.8*math.sin(theta*2+n)**2
                r=9.22+.18*math.sin(k*.71+i/12)
                row.append((r*math.cos(theta),r*math.sin(theta),-.25+k/5*top))
            rows.append(row)
        room.surface('Mur de rive',rows,'basalt' if n in (3,6) else 'clay')
    return room

