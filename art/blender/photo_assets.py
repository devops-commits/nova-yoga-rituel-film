"""Bake native-resolution photographic material samples from the eight-second master."""
from pathlib import Path
import subprocess
import numpy as np
from PIL import Image, ImageOps, ImageFilter

HERE=Path(__file__).resolve().parent
OUT=HERE/'surfaces'
SRC=HERE.parents[1]/'public/videos/sous-la-peau-web.mp4'

def frame(t,name):
    path=OUT/(name+'.jpg')
    subprocess.run(['ffmpeg','-loglevel','error','-y','-ss',str(t),'-i',str(SRC),'-frames:v','1','-q:v','2',str(path)],check=True)
    return Image.open(path).convert('RGB')

def sample(im,bounds,name):
    x0,y0,x1,y1=bounds
    patch=im.crop((round(x0*im.width),round(y0*im.height),round(x1*im.width),round(y1*im.height))).resize((256,256),Image.Resampling.LANCZOS)
    grey=np.array(patch.convert('L'),float)
    low=np.array(patch.convert('L').filter(ImageFilter.GaussianBlur(14)),float)
    relief=np.clip((grey-low)*2.2+170,50,246).astype('uint8')
    half=Image.fromarray(relief);tile=Image.new('L',(512,512));tile.paste(half);tile.paste(ImageOps.mirror(half),(256,0));tile.paste(ImageOps.flip(tile.crop((0,0,512,256))),(0,256))
    tile.convert('RGB').save(OUT/(name+'.jpg'),quality=92)
    h=np.asarray(tile,dtype=float)/255
    dx=(np.roll(h,-1,1)-np.roll(h,1,1))*.85;dy=(np.roll(h,-1,0)-np.roll(h,1,0))*.85
    normals=np.stack((-dx,dy,np.ones_like(h)),axis=-1);normals/=np.linalg.norm(normals,axis=-1,keepdims=True)
    Image.fromarray(np.uint8(np.clip(normals*.5+.5,0,1)*255)).save(OUT/(name+'-normal.png'))
if __name__=='__main__':
    OUT.mkdir(exist_ok=True)
    frame(.12,'lake')
    room=frame(4.88,'chamber')
    frame(4.65,'fold')
    palm=frame(2.32,'palm')
    # Fill the source lens with adjacent palm detail; the lens is rebuilt as a separate volume.
    data=np.asarray(palm).astype(float);h,w=data.shape[:2]
    yy,xx=np.mgrid[:h,:w];u=xx/w;v=yy/h
    weight=np.clip((1.38-((u-.363)/.180)**2-((v-.603)/.190)**2)*2.25,0,1)[...,None]
    donor=data[np.clip((h*.666+(yy-h*.603)*.39).astype(int),0,h-1),np.clip((w*.686+(xx-w*.363)*.52).astype(int),0,w-1)]
    photo=Image.fromarray(np.uint8(data*(1-weight)+donor*weight))
    warm=data[...,0]-data[...,2]
    alpha=np.uint8(255*np.where(v>.43,1,np.clip((warm+7)/15,0,1)))
    photo.putalpha(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(.75)))
    photo.save(OUT/'palm.png',optimize=True)
    (OUT/'palm.jpg').unlink()
    skin=frame(2.7,'dermis-source')
    sample(skin,(.665,.48,.84,.74),'dermis')
    sample(room,(.794,.028,.947,.23),'weave')
    (OUT/'dermis-source.jpg').unlink()

