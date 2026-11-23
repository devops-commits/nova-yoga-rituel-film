import math, random
from folds import folds
from photographic_sets import palm_relief


def approach(g):
    random.seed(11)
    YS = [-48, -43, -38, -33, -28, -23, -18, -13]
    FILMS = ["film0", "film1", "film2", "film3", "film4", "film5", "film6", "film7"]

    def sheet(name, y, side, mat, w=7.0, h=2.6, lift=0.45, phase=0.0):
        nu, nv = 18, 9
        rows = []
        for iv in range(nv + 1):
            v = iv / nv
            b = math.sin(math.pi * v)
            row = []
            for iu in range(nu + 1):
                u = iu / nu
                x = side * (3.65 + 0.65 * b + 0.7 * math.sin(2.2 * math.pi * u + phase) * b)
                yy = y + w * (1.0 + 0.22 * math.sin(math.pi * v)) * (u - 0.5) + side * 1.3 * b * math.sin(math.pi * u)
                z = lift + h * v + 0.75 * math.sin(math.pi * u) * (0.35 + 0.65 * v) + 0.22 * math.sin(4 * math.pi * u + phase) * v
                row.append((x, yy, z))
            rows.append(row)
        g.surface(name, rows, mat)

    # station films: large curved film-mapped meshes, alternating sides
    for i, y in enumerate(YS):
        if i in (0,1,2,4,6): continue
        side = 1 if i % 2 == 0 else -1
        sheet("film_sheet_%d" % i, y, side, FILMS[i], w=7.4 + 0.9 * math.sin(i), h=1.35 + 0.38 * math.cos(i * 1.3),
              lift=0.42 + 0.08 * i, phase=i * 0.9)

    # stage 0: lake sheet below walking floor
    rows = []
    for j in range(14):
        yy = -53.0 + 10.5 * j / 13.0
        row = []
        for i in range(20):
            xx = -6.6 + 13.2 * i / 19.0
            z = -0.07 + 0.035 * math.sin(1.3 * xx + 0.7 * yy) + 0.02 * math.sin(2.6 * yy)
            row.append((xx, yy, z))
        rows.append(row)
    g.surface("lake_sheet", rows, "film0")
    # A cupped palm, with raised thenar pad, five articulated digits and papillary ridges.
    def palm(r,t):
        x=r*math.cos(t);y=r*math.sin(t)
        z=.33+1.44*r*r+.35*math.exp(-9*((x+.60)**2+(y+.12)**2))
        return (-4.5+2.7*x, -43.3+4.6*y,z+.17*math.sin(3*t)*r)
    g.surface("peau_de_paume",[[palm(max(.002,j/17),math.tau*k/72) for k in range(73)] for j in range(18)],"film1")
    for i in range(9):
        g.tube("empreinte_digitale",[palm(.22+.030*i+.017*math.sin(t*.13),.36+t*.066) for t in range(76)],.009,"skin")
    for j in range(5):
        theta=.32+(j*.44)
        bx,by,bz=palm(.87,theta)
        rows=[]
        for k in range(25):
            t=k/24;rr=(.50 if j else .66)*(1-.23*t)*max(.01,math.sin(math.pi*min(1,(1-t)*4)/2))
            xx=bx+(1.05-j*.38)*t+.38*math.sin(math.pi*t)
            yy=by+(1.2 if not j else 2.7+.6*math.sin(j))*t
            zz=bz+1.7*t+.54*t*t+.13*math.sin(3*math.pi*t)
            rows.append([(xx+rr*math.cos(math.tau*i/24),yy-.27*rr*math.sin(math.tau*i/24),
                          zz+.78*rr*math.sin(math.tau*i/24)) for i in range(25)])
        g.surface("phalange_"+str(j),rows,"skin")
    # stage 2: translucent jewel droplet
    folds(g)
    # The drop rests on a convex pad with a flat contact patch, then a rolled meniscus.
    palm_relief(g)
    contour=[(.01,.64),(.65,.64),(.84,.65),(.98,.72),(1.09,.89),(1.11,1.07),(1.04,1.27),(.91,1.43),(.72,1.56),(.45,1.65),(.16,1.69),(0,1.70)]
    # Round the contact shoulder while retaining the flat seat and crown.
    for _ in range(2):
        rounded=[contour[0]]
        for (r0,z0),(r1,z1) in zip(contour,contour[1:]):
            rounded.extend(((r0*.75+r1*.25,z0*.75+z1*.25),(r0*.25+r1*.75,z0*.25+z1*.75)))
        contour=rounded+[contour[-1]]
    rows=[]
    for radius,height in contour:
        row=[]
        rise=(height-.64)/1.06
        for i in range(97):
            theta=math.tau*i/96
            # Unequal wetting on the two sides subtly tips the reflected horizon.
            wet=radius*(1+.020*math.cos(3*theta+.5)*(1-rise))
            x=3.72+wet*math.cos(theta)+.044*rise;y=-38.45+.90*wet*math.sin(theta)
            # Follow the pad sculpted by palm_relief (z=.656+.015r²), 2 mm inside it.
            # A level base at .64 cut 16 to 21 mm into the palm and buried the meniscus.
            pad=.654+.015*min(1,math.hypot((x-3.72)/.93,(y+38.45)/.83))**2
            row.append((x,y,max(height,pad)))
        rows.append(row)
    g.surface("Lentille d’eau",rows,"waterdrop")
    # Fine moving seam, sampled from the original film, set into the interior wall.
    g.surface("Nervure vivante",[[(-3.05+.115*i,-29+.22*j,1.1+.11*i+.16*math.sin(j*.22)) for i in range(3)] for j in range(27)],"film4")
    g.bowl("Bronze du palier", (2.95, -18.3, .081), 1.08, .63, "bronze")
    g.bowl("Patine animée", (2.95, -18.3, .091), 1.02, .60, "film6")
    g.box("landing_slab", (0.0, -10.6, -0.10), (6.2, 3.2, 0.20), "chalk")
    g.ell("landing_lamp_a", (-3.4, -9.2, 0.9), (0.24, 0.24, 0.24), "gold")
    g.ell("landing_lamp_b", (3.4, -9.2, 0.9), (0.24, 0.24, 0.24), "gold")
    g.rock("landing_stone", (-5.0, -8.4, 0.6), (1.4, 1.7, 1.5), "basalt", seed=31)
    g.rock("landing_stone_b", (5.0, -8.0, 0.55), (1.3, 1.6, 1.4), "basalt", seed=32)