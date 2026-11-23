"""Continuous lake, eight-shot causeway, clearing and seven radial passages."""
import math
from sculpt import Set, TAU
from raccord_geometrie import ARC, ARC_CENTRE, arc

ANGLES = [-135,-90,-45,0,45,90,135]
PALETTE = ['clay','brass','ink','chalk','rose','jade','brass']
# Arches relevées sur la dernière image du survol (plateforme-libre.jpg) : sombre à gauche (−45°),
# laiton clair au centre (0°, 'brass4' : matière réservée à cette arche), cuivre rosé à droite (45°).
# Les mondes gardent PALETTE.
ARCHES = ['clay','brass','ink','brass4','copper','jade','brass']
FILET = .06          # largeur du filet de laiton incrusté (m)
AFFLEUREMENT = .008  # dépassement au-dessus de la pierre (m) : à fleur, sans marche ni ombre portée

def ground(g,name,radius,material,height=0):
    rows=[]
    for r,z in [(radius*.005,height),(radius*.6,height),(radius*.98,height),(radius,height-.13),(radius*.98,height-.6)]:
        rows.append([(r*math.cos(-TAU*i/96),r*math.sin(-TAU*i/96),z) for i in range(97)])
    return g.surface(name,rows,material)

def inlay_rows(r,width=FILET,z=AFFLEUREMENT,start=0,end=TAU):
    """Ruban plat incrusté : deux arêtes vives noyées dans la pierre, un méplat à fleur.

    Rend (rangées, UV). Les rangées vont du bord intérieur au bord extérieur et tournent dans le sens
    de ground() : la face regarde vers le haut. UV : u en travers, v le long (0,5 m de laiton par motif
    avec l'échelle (1, 12) de pbr.py), pour un reflet qui se rompt le long du cercle.
    """
    count=max(110,round(abs(end-start)*r/.42))
    chamfer=min(.006,width/4)
    profile=[(-width/2,-.004),(-width/2+chamfer,z),(width/2-chamfer,z),(width/2,-.004)]
    rows=[];uvs=[]
    for k,(dr,dz) in enumerate(profile):
        row=[];uv=[]
        for i in range(count+1):
            a=-(start+(end-start)*i/count)
            row.append(((r+dr)*math.cos(a),(r+dr)*math.sin(a),dz))
            uv.append((k/(len(profile)-1),abs(end-start)*r*i/count/6))
        rows.append(row);uvs.append(uv)
    return rows,uvs

def round_inlay(g,name,r,mat,z=AFFLEUREMENT,start=0,end=TAU,width=FILET):
    rows,uvs=inlay_rows(r,width,z,start,end)
    return g.surface(name,rows,mat,uvs)

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
    # Raccord : l'arche centrale (n = 4, face à la caméra de départ) est plus haute et plus ouverte dans la
    # dernière image du survol ; cotes relevées dans raccord_geometrie.py. Les six autres gardent ARC.
    spec=ARC_CENTRE if n==4 else ARC
    for j in range(2):
        g.tube('Arc sculpté',arc(spec,j*.47),spec['rayon'] if j==0 else .052*spec['rayon']/ARC['rayon'],ARCHES[n-1] if not j else 'gold')
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

