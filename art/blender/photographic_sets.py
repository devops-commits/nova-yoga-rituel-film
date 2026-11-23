"""Camera-calibrated scenery. Blender coordinates are metres, with Y forward."""
from math import sin,cos,pi,tau,atan2,tan,hypot,exp
import numpy as np

def uv_mesh(g,name,rows,coords,material):
    return g.surface(name,rows,material,coords)

def beyond_frame(v,reach=.6):
    """Height in the plate for a ray that may leave the photograph.

    The value is deliberately left outside 0..1 (bounded to ±reach past the frame). The
    plate sampler clamps, and photographic.js reads the overshoot to dissolve the plate
    into a world-space linen weave over a wide band that starts inside the frame. Clamping
    here dragged one row of pixels up to the zenith above the lens (radial star), and
    mirroring it folded the picture back on itself (visible crease).
    """
    return max(-reach,min(1+reach,v))

def lake(g):
    image=g.materials['lakeplate'].node_tree.nodes['Photographie'].image
    w,h=image.size;pixels=np.empty(w*h*4,np.float32);image.pixels.foreach_get(pixels)
    brightness=pixels.reshape(h,w,4)[::-1,:,:3].mean(axis=2)
    knots=[(0,.33),(.04,.36),(.14,.29),(.24,.35),(.36,.43),(.44,.41),(.57,.49),(.66,.48),(.8,.53),(.9,.51),(1,.44)]
    def edge(u):
        pos=int(np.interp(u,*zip(*knots))*h);x=min(w-1,round(u*(w-1)))
        lo=pos-int(h*.035);hi=pos+int(h*.035)
        return (lo+np.argmax(brightness[lo-1:hi-1,x]-brightness[lo+1:hi+1,x]))/h
    for sector in range(4):
        angle=sector*pi/2
        def strip(name,levels,material):
            rows=[];uvs=[]
            for k in levels:
                row=[];uv=[]
                for j in range(121):
                    a=j/120;u=a if sector%2==0 else 1-a
                    v,depth=levels[k](u)
                    sideways=(a*2-1)*depth
                    z=1.62+(.688-v)*1.18*depth
                    row.append((sideways*cos(angle)+depth*sin(angle),-62+depth*cos(angle)-sideways*sin(angle),z))
                    tex_v=v if v<=1 else 1-.195*(1-exp(-3*(v-1)))
                    uv.append((u,1-min(1,max(0,tex_v))))
                rows.append(row);uvs.append(uv)
            uv_mesh(g,name,rows,uvs,material)
        # Sky, ridge and reflection meet along the observed pixel contours.
        shore=.702
        def profile(v,u):
            rel=np.clip((v-edge(u))/(shore-edge(u)),0,1)
            return 136-34*rel+5*sin(u*tau*2)*sin(rel*pi)
        levels={}
        for k in range(25):
            t=k/24
            def landscape_v(u,t=t):
                v=edge(u)*(1-t)+shore*t
                return v,profile(v,u)
            levels[k]=landscape_v
        strip('Relief des Alpes',levels,'lakeplate')
        sky={k:(lambda u,t=t:(edge(u)-(t**1.7)*3.3,136)) for k,t in enumerate(np.linspace(0,1,27))}
        strip('Ciel de la rive',sky,'lakeplate')
        water={}
        # Match the distal coastline exactly. Progressively flatten the near water.
        for k in range(81):
            t=k/80
            def reflected(u,t=t):
                d=102*(1-t)**2+.06*t
                z=-.065-.01*cos(9*u*pi)*sin(t*pi)
                near_v=.688+(1.62-z)/(1.18*d)
                v=near_v+(shore-(.688+1.685/(1.18*102)))*(1-t)**8
                return v,d
            water[k]=reflected
        strip('Eau et reflet du massif',water,'lakereflection')

def chamber(g):
    def project(p):
        x,y,z=p
        angle=atan2(x,y+5)
        sector=int(np.floor((angle+pi/4)/(pi/2)))
        local=angle-sector*pi/2
        u=.5+(-1 if sector%2 else 1)*.5*tan(local)
        distance=max(.04,hypot(x,y+5)*cos(local))
        return (u,beyond_frame(.5+(z-1.62)/(1.225*distance)))
    def mesh(name,rows):
        return uv_mesh(g,name,rows,[[project(p) for p in row] for row in rows],'chamberplate')
    # Vault sections buckle and converge into a real domed end, with an open entrance.
    rows=[]
    for j in range(67):
        t=j/66;y=-8.7+t*17.3
        cap=max(.008,1-((max(y-3.1,0)/5.4)**2))**.5
        row=[]
        for i in range(91):
            a=pi*i/90
            fluting=.30*sin(a*5.4+t*5)+.16*sin(a*10-t*8)+.09*cos(a*18+t*5)
            r=(7.35+fluting+.40*sin(t*4.1))*cap
            z=.045+(4.9+fluting*1.4+.70*sin(t*3+a))*cap*sin(a)
            row.append((r*cos(a)+.36*sin(t*7)*sin(a),y,z))
        rows.append(row)
    mesh('Coque de lin · voûte et fond',rows)
    mesh('Fond de l’alcôve',[[(i*.22-3.3,8.55,.02+j*.21) for i in range(31)] for j in range(18)])
    floor=[[(x*.25,y*.25,.041+.009*sin(x*.26)*cos(y*.16)) for x in range(-34,35)] for y in range(-34,35)]
    mesh('Sol tissé · projection rasante',floor)
    # Pleated load-bearing curtains give photographic folds physical parallax.
    for side in [-1,1]:
        for n in range(3):
            rows=[]
            for j in range(23):
                v=j/22
                row=[]
                for i in range(19):
                    u=i/18
                    root=side*(4.7+.38*n)
                    x=root+side*(.32*cos(u*2*pi+v*2.7)+.65*u-.76*v*v)
                    y=1+n*1.7+(u-.5)*(1.10+1.7*v)+.82*v*v
                    z=.06+v*(4.15+.40*sin(u*pi))
                    row.append((x,y,z))
                rows.append(row)
            mesh('Contrefort de fibres',rows)


def palm_relief(g):
    # One continuous sculpted palm, photographed from its three-quarter camera.
    direction=.99
    rows=[];uvs=[]
    for j in range(75):
        v=1.48-1.48*j/74
        row=[];uv=[]
        for i in range(123):
            u=-.25+1.41*i/122
            knuckles=.38*sin(14*u+7*v)+.18*cos(24*u-4*v)
            d=4.14+(v-.60)*(-2.7)+1.14*(u-.37)**2+knuckles*min(1,4*((u-.37)**2+(v-.60)**2))
            dx=sin(direction)+cos(direction)*(u-.37)*2.08
            dy=cos(direction)-sin(direction)*(u-.37)*2.08
            slope=(.58-v)*1.20-.20
            # Solve along the source camera ray. Moving only a vertex's height
            # would shear the photographed fingerprint across its neighbours.
            if slope<-.055:
                d=min(d,(1.62-.087)/-slope)
                # Sample the footprint on its contact plane. Re-evaluating the
                # footprint after each displacement folded the grid at its edge.
                flat=(.656-1.62)/slope
                radius=hypot((.30+dx*flat-3.72)/.93,(-40.8+dy*flat+38.45)/.83)
                seat=float(np.clip((1.82-radius)/.94,0,1))
                seat=seat*seat*(3-2*seat)
                target_d=(.656+.015*min(radius,1)**2-1.62)/slope
                d+=seat*(target_d-d)
            x=.30+dx*d;y=-40.8+dy*d;z=1.62+slope*d
            tex_u=abs(u) if u<0 else 2-u if u>1 else u
            row.append((x,y,z));uv.append((tex_u,1-(v if v<=1 else 1-.34*(1-exp(-2*(v-1))))))
        rows.append(row);uvs.append(uv)
    uv_mesh(g,'Pulpe et éminences de la paume',rows,uvs,'palmplate')

def woven_passage(g):
    # Ceiling and side walls form an open, traversable sleeve aligned to the crease.
    rows=[];uvs=[]
    for j in range(75):
        t=j/74;y=-34.4+23.7*t
        row=[];uv=[]
        for i in range(91):
            a=pi*i/90
            aperture=1+.24*cos(t*tau*1.5)
            r=4.45*aperture+.35*sin(3*a+t*4)+.12*sin(9*a-t*5)
            x=r*cos(a)+.34*sin(t*5)*sin(a)
            z=.07+(4.3+.22*sin(t*8)+.54*sin(3*a-t*4))*sin(a)
            # First metres roll out of the palm, so there is no rectangular mouth.
            opening=(1-min(1,t*7))**2
            x*=1+.75*opening
            z*=1+.55*opening
            row.append((x,y,z))
            theta=atan2(x,y+34.7)
            sector=int(np.floor((theta+pi/4)/(pi/2)));q=theta-sector*pi/2
            d=max(.08,hypot(x,y+34.7)*cos(q))
            uv.append((.5+(-1 if sector%2 else 1)*.5*tan(q),beyond_frame(.5+(z-1.62)/(1.225*d))))
        rows.append(row);uvs.append(uv)
    uv_mesh(g,'Galbe intérieur du pli',rows,uvs,'foldplate')


    floor=[];floor_uv=[]
    for j in range(77):
        y=-35.5+25*j/76
        row=[];uv=[]
        for i in range(49):
            x=(i/48-.5)*12;z=.079+.008*cos(x*3+y*.77)
            row.append((x,y,z))
            theta=atan2(x,y+34.7);sector=int(np.floor((theta+pi/4)/(pi/2)));q=theta-sector*pi/2
            d=max(.06,hypot(x,y+34.7)*cos(q))
            uv.append((.5+(-1 if sector%2 else 1)*.5*tan(q),beyond_frame(.5+(z-1.62)/(1.225*d))))
        floor.append(row);floor_uv.append(uv)
    uv_mesh(g,'Sol intérieur de la trame',floor,floor_uv,'foldplate')
