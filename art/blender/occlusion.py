"""Bake ground contact from the actual obstacles into a shared world-space map."""
import math
import struct
import zlib
import numpy as np

def bake(tree,out):
    width,height=400,480
    shade=np.ones((height,width),np.float32)
    rays=[((0,0,1),1.7)]
    for k in range(8):
        angle=k*math.tau/8+.17
        rays.append(((.71*math.cos(angle),.71*math.sin(angle),.70),3.0))
    for j in range(height):
        y=-68+(j+.5)*116/height
        for i in range(width):
            x=-48+(i+.5)*96/width
            if x*x+y*y>44**2 and (abs(x)>9 or y>0):continue
            total=0
            for direction,maximum in rays:
                hit,_,_,dist=tree.ray_cast((x,y,.075),direction,maximum)
                if hit is not None:total+=(1-dist/maximum)**.7
            shade[j,i]=max(.23,1-total/len(rays)*1.75)
    smooth=(shade*4+np.roll(shade,1,0)+np.roll(shade,-1,0)+np.roll(shade,1,1)+np.roll(shade,-1,1))/8
    def chunk(kind,data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data))
    # File top is north (positive Blender Y). Browser TextureLoader flips PNG for GL.
    pixels=np.rint(smooth[::-1]*255).astype(np.uint8)
    raw=b''.join(b'\x00'+row.tobytes() for row in pixels)
    out.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,0,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))

