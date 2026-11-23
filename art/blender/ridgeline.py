"""Rebuild the lake skyline as a contoured ring using the actual opening frame."""
import math
import numpy as np
from sculpt import TAU

def mountains(g):
    im=g.materials['alpes'].node_tree.nodes.get('Film du lac').image
    w,h=im.size
    pixels=np.empty(w*h*4,np.float32);im.pixels.foreach_get(pixels)
    luma=pixels.reshape(h,w,4)[::-1,:,:3].mean(axis=2)
    guides=[(0,.33),(.04,.36),(.09,.33),(.14,.29),(.18,.32),(.24,.35),(.30,.41),(.36,.43),(.44,.41),(.52,.46),(.58,.49),(.63,.48),(.71,.53),(.83,.52),(.88,.52),(1,.44)]
    n=360; rows=[];uvs=[]
    for k in range(13):
        v=k/12; row=[];uvrow=[]
        for j in range(n+1):
            a=TAU*j/n
            # Mirroring every half circumference avoids seams in the ridge silhouette.
            u=abs(((a/TAU*4+.5)%2)-1)
            ix=min(w-1,int(u*(w-1)))
            estimate=float(np.interp(u,[p[0] for p in guides],[p[1] for p in guides]))
            lo,hi=int((estimate-.032)*h),int((estimate+.032)*h)
            edge=int(np.argmax(luma[lo-1:hi-1,ix]-luma[lo+1:hi+1,ix]))+lo
            top=edge/h
            y=.693*(1-v)+top*v
            r=61+v*16+6*math.sin(a*3)+4*math.sin(a*9)*v+2*math.sin(v*math.pi)*math.sin(7*a)
            z=-1+(r*(.692-y)*1.0)
            row.append((r*math.sin(a),r*math.cos(a),z));uvrow.append((u,1-y))
        rows.append(row);uvs.extend(uvrow)
    obj=g.surface('Massifs du lac • projection du plan original',rows,'alpes')
    uv=obj.data.uv_layers.active
    for p in obj.data.polygons:
        for li in p.loop_indices:uv.data[li].uv=uvs[obj.data.loops[li].vertex_index]

