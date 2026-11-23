"""Run with blender --background --python-exit-code 1 --python art/blender/build.py."""
from pathlib import Path
import base64
import json
import math
import sys
import struct
import shutil
import subprocess
import os
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE=Path(__file__).resolve().parent
sys.dont_write_bytecode=True
sys.path.insert(0,str(HERE))
from sculpt import Set, TAU
from landscape import ANGLES, landscape, passage
from canopies import gallery
from interiors import enclosure
from photographic_sets import chamber, woven_passage
from bowl import vessel
from approach import approach
from chambers import world1, world2, world3
from gardens import world4, world5, world6, world7
import pbr

PUBLIC=HERE.parents[1]/'public'
OUT=PUBLIC/'worlds'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0

def grain():
    n=384
    y,x=np.mgrid[:n,:n]/n*TAU
    rng=np.random.default_rng(183)
    f=np.zeros_like(x)
    for k in range(1,7):
        for i in range(6):
            a,b=rng.integers(1,2**k+1,2)
            f+=np.sin(a*x+b*y+rng.uniform(0,TAU))*.17/(k**1.4)
    veins=np.abs(np.sin(2*y+1.65*np.sin(x)+3*f))
    grey=np.clip(.79+.24*f-.085*np.exp(-45*veins)+rng.normal(0,.027,f.shape),.42,1)
    def image(name,rgb):
        im=bpy.data.images.new(name,width=n,height=n,alpha=False)
        rgba=np.dstack((rgb,np.ones_like(x))).astype(np.float32)
        im.pixels.foreach_set(rgba.ravel())
        im.pack()
        return im
    height=(grey+.20*f)
    dx=(np.roll(height,-1,1)-np.roll(height,1,1))*1.5
    dy=(np.roll(height,-1,0)-np.roll(height,1,0))*1.5
    normal=image('Grain de pierre • relief',np.stack([.5-dx,.5-dy,.99+dx*0],axis=-1).clip(0,1))
    normal.colorspace_settings.name='Non-Color'
    return image('Marbrure minérale • albédo',np.stack([grey,grey*.989,grey*.96],axis=-1)),normal

def materials():
    tex,bump=grain()
    palette={'chalk':('d4b3af',.03,.78),'basalt':('525d62',.15,.70),'clay':('ba826e',.05,.59),'brass':('c79a65',.61,.34),'gold':('ffd18b',.38,.32),'silk':('e4cfc3',.12,.42),'jade':('73968e',.28,.46),'water':('739b9f',.35,.26),'ink':('444451',.17,.68),'rose':('c78e91',.06,.68)}
    palette.update(skin=('b18973',.02,.54),bronze=('a78355',.78,.39),waterdrop=('f8faf9',0,.045))
    # Croûte de cendre du sentier des lueurs : la carte de couleur porte cendre, charbon et fentes.
    palette.update(ash=('d6d0c8',0,.9))
    # Raccord avec la dernière image du survol Flow (plateforme-libre.jpg) : la pierre 'chalk' passe du beige jaune
    # ceb99e au gris-beige rosé d4b3af (rapport linéaire ×1,07 / ×0,93 / ×1,25 mesuré sol centre + milieu + bas),
    # et l'arche de droite reçoit un cuivre rosé métallique (carte ORM du laiton).
    palette.update(copper=('cf9079',.72,.36))
    # Arche centrale seule : laiton doré clair et satiné (cible 136,116,108 ; 'brass' c79a65 y donnait 90,73,58).
    # Même carte ORM que le laiton ; le reflet du ciel est réglé dans atmosphere.js par le nom 'brass4'.
    palette.update(brass4=('f0c890',.61,.30))
    # Voile tendu du monde 4 (raccord) : blanc à peine chaud, non métallique, translucide (alpha plus bas).
    palette.update(veil=('faf0e4',0,.80))
    # Monde 3 vu de la clairière (raccord) : 'orgue' = 'ink' à l'identique, réservé aux orgues basaltiques pour
    # que le jeu puisse les fondre ; cyprès vert sombre mat, globe chaud de la lanterne, tiges dorées.
    palette.update(orgue=palette['ink'],cypres=('4b5338',0,.92),lanterne=('ffe2b0',0,.55),jonc=('d8c49a',.25,.50))
    def load_photo(name,normal=False):
        image=bpy.data.images.load(str(HERE/'surfaces'/name),check_existing=True)
        if normal:image.colorspace_settings.name='Non-Color'
        image.pack()
        return image
    result={}
    for key,(hexcode,metal,rough) in palette.items():
        values=[int(hexcode[j:j+2],16)/255 for j in (0,2,4)]
        color=tuple(((v+.055)/1.055)**2.4 for v in values)+(1,)
        mat=bpy.data.materials.new(key);mat.diffuse_color=color
        mat.use_nodes=True
        nodes=mat.node_tree.nodes; link=mat.node_tree.links.new
        shader=nodes.get('Principled BSDF')
        shader.inputs['Metallic'].default_value=metal
        shader.inputs['Roughness'].default_value=rough
        shader.inputs['Base Color'].default_value=color
        n=nodes.new('ShaderNodeTexImage'); n.image=load_photo('dermis.jpg') if key=='skin' else load_photo('weave.jpg') if key=='silk' else tex
        # glTF represents multiplication directly as texture + baseColorFactor.
        mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
        link(n.outputs['Color'],mix.inputs[1]);mix.inputs[2].default_value=color
        link(mix.outputs[0],shader.inputs['Base Color'])
        relief=nodes.new('ShaderNodeTexImage');relief.image=load_photo('dermis-normal.png',True) if key=='skin' else load_photo('weave-normal.png',True) if key=='silk' else bump
        normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.25
        link(relief.outputs[0],normal.inputs['Color']);link(normal.outputs[0],shader.inputs['Normal'])
        if key=='bronze':
            n.image=load_photo('bronze-color.jpg')
            relief.image=load_photo('bronze-normal.png',True)
            normal.inputs['Strength'].default_value=.65
            orm=nodes.new('ShaderNodeTexImage')
            orm.image=load_photo('bronze-orm.png',True)
            channels=nodes.new('ShaderNodeSeparateColor')
            link(orm.outputs['Color'],channels.inputs[0])
            link(channels.outputs['Green'],shader.inputs['Roughness'])
            link(channels.outputs['Blue'],shader.inputs['Metallic'])
        if key=='gold':
            shader.inputs['Emission Color'].default_value=color;shader.inputs['Emission Strength'].default_value=.85
        if key in ('lanterne','jonc'):
            shader.inputs['Emission Color'].default_value=color;shader.inputs['Emission Strength'].default_value=1.0 if key=='lanterne' else .45
        if key=='waterdrop':
            shader.inputs['IOR'].default_value=1.333
            shader.inputs['Transmission Weight'].default_value=.96
        if key=='veil':
            # Tissu fin lu en transparence, double face : glTF alphaMode BLEND, doubleSided. Le jeu refixe
            # opacité et profondeur par le nom du matériau (atmosphere.js), l'export ne décide donc pas seul.
            shader.inputs['Alpha'].default_value=.56
            mat.use_backface_culling=False
            if hasattr(mat,'surface_render_method'):mat.surface_render_method='BLENDED'
            elif hasattr(mat,'blend_method'):mat.blend_method='BLEND'
        # Matières du cahier (couleur, rugosité, métal, normales) : surfaces/jeu/, voir matieres.py.
        pbr.appliquer(mat,key)
        result[key]=mat
    for i in range(8):
        mat=bpy.data.materials.new('film'+str(i));mat.use_nodes=True
        nodes=mat.node_tree.nodes
        im=nodes.new('ShaderNodeTexImage');im.name='Film source';im.image=bpy.data.images.load(str(HERE/'frames'/f'shot{i}.jpg'));im.image.pack()
        shader=nodes.get('Principled BSDF')
        mat.node_tree.links.new(im.outputs['Color'],shader.inputs['Base Color'])
        shader.inputs['Roughness'].default_value=.52
        mat.node_tree.links.new(im.outputs['Color'],shader.inputs['Emission Color'])
        shader.inputs['Emission Strength'].default_value=.17
        result['film'+str(i)]=mat
    for key,file in [('lakeplate','lake.jpg'),('lakereflection','lake.jpg'),('chamberplate','chamber.jpg'),('palmplate','palm.png'),('foldplate','fold.jpg')]:
        mat=bpy.data.materials.new(key);mat.use_nodes=True
        nodes=mat.node_tree.nodes
        n=nodes.new('ShaderNodeTexImage');n.name='Photographie';n.image=load_photo(file);n.extension='EXTEND'
        bs=nodes.get('Principled BSDF')
        mat.node_tree.links.new(n.outputs[0],bs.inputs['Base Color'])
        mat.node_tree.links.new(n.outputs[0],bs.inputs['Emission Color'])
        bs.inputs['Emission Strength'].default_value=.78
        bs.inputs['Roughness'].default_value=.88
        if key=='palmplate':
            mat.node_tree.links.new(n.outputs['Alpha'],bs.inputs['Alpha'])
        result[key]=mat
    return result

def relic(materials,n):
    g=Set(f'Relique{n}',materials,math.radians(ANGLES[n-1]),35)
    if n==1:
        g.rock('Le galet à déposer',(1.55,.16,.205),(.25,.22,.16),'basalt',24)
    if n==2:
        for i in range(9): g.tube('Corde sensible',[(i*.13-.52,0,.48),(i*.13-.52,.03,2.15-.14*abs(4-i))],.024,'gold')
    if n==3:
        for i in range(5):
            a=TAU*i/5
            g.rock('Cœur incandescent',(.21*math.cos(a),.21*math.sin(a),.86+.07*i),(.27,.22,.42),'gold',i)
    if n==4:
        g.surface('Voile du souffle',[[(x*.28-.84,.22*math.sin(x*.5+z*.25),.55+z*.22+.1*math.sin(x*.7)) for x in range(7)] for z in range(9)],'silk')
    if n==5:
        g.tube('Trait suspendu',[(-.81+i*.06,.08*math.sin(i*.3),1.04+.30*math.sin(i*.25)) for i in range(28)],.083,'rose')
    if n==6:
        g.ell('Goutte en équilibre',(0,0,1.45),(.39,.39,.57),'film2')
    if n==7:
        for i in range(6):
            g.tube('Fil à relier',[(-.68+j*.055,.10*math.sin(j*.5+i),.76+.145*i+.16*math.sin(j*.22+i*.4)) for j in range(26)],.024,'gold')
    return g

SANS_COLLISION={'cypres','lanterne','jonc'}

def navigation():
    bpy.context.view_layer.update()
    verts=[];faces=[]
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH': continue
        # Lointain du monde 3 : fondu de près par le jeu, donc ni collision ni ombre au sol.
        if obj.data.materials and obj.data.materials[0] and obj.data.materials[0].name in SANS_COLLISION: continue
        corners=[obj.matrix_world@Vector(p) for p in obj.bound_box]
        if max(p.z for p in corners)<.33 or min(p.z for p in corners)>2.08: continue
        off=len(verts);verts.extend(obj.matrix_world@v.co for v in obj.data.vertices)
        faces.extend(tuple(off+i for i in poly.vertices) for poly in obj.data.polygons)
    tree=BVHTree.FromPolygons(verts,faces)
    from occlusion import bake
    bake(tree,OUT/"ombres-sol.png")
    step=.32; x0=-44; y0=-68; nx=277;ny=352
    walk=np.zeros((ny,nx),dtype=np.uint8)
    dirs=[(math.sin(math.radians(a)),math.cos(math.radians(a))) for a in ANGLES]
    for j in range(ny):
        y=y0+j*step
        for i in range(nx):
            x=x0+i*step
            ok=(abs(x)<3.0 and -65.5<y<-8.5) or (x*x+y*y<10.85**2)
            if not ok and -51<y<-10 and abs(x)<7.4:
                for k,side in enumerate([-1,-1,1,-1,1,-1,1,-1]):
                    if ((x-side*3.65)/3.53)**2+((y-(-48+5*k))/2.88)**2<1:
                        ok=True;break
            if not ok:
                for sx,sy in dirs:
                    d=x*sx+y*sy; lateral=x*sy-y*sx
                    if (9<d<26.6 and abs(lateral)<2.38) or ((d-33)**2+lateral**2<9.0**2): ok=True;break
            if ok:
                origin=(x,y,.32)
                if tree.ray_cast(origin,(0,0,1),1.76)[0] is None and all(tree.ray_cast((x,y,1.14),direction,.24)[0] is None for direction in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0)]):
                    walk[j,i]=1
    return {'step':step,'x0':x0,'y0':y0,'nx':nx,'ny':ny,'cells':base64.b64encode(np.packbits(walk,bitorder='little').tobytes()).decode(),'angles':ANGLES}

def camera_and_sun():
    bpy.ops.object.camera_add(location=(0,-62,1.62))
    cam=bpy.context.object;cam.name='Caméra • au bord du lac'
    cam.rotation_euler=(math.radians(90),0,0);cam.data.lens=23
    scene=bpy.context.scene;scene.camera=cam
    bpy.ops.object.light_add(type='SUN',rotation=(.79,-.49,-.67))
    bpy.context.object.data.energy=2.8
    sc_world=bpy.data.worlds.new('Matin sur le lac');sc_world.use_nodes=True
    sc_world.node_tree.nodes.get('Background').inputs[0].default_value=(.48,.58,.65,1)
    scene.world=sc_world

def main():
    mats=materials()
    landscape(mats)
    approach(Set('03 • Les huit plans sculptés',mats))
    woven_passage(Set('Tissu • le pli du film',mats))
    for n,fn in enumerate([world1,world2,world3,world4,world5,world6,world7],1):
        room=passage(mats,n)
        if n==1:
            chamber(room);vessel(room)
        else:
            fn(room);enclosure(room,n)
        relic(mats,n)
    camera_and_sun()
    nav=navigation();(OUT/'marche.json').write_text(json.dumps(nav,separators=(',',':')))
    # Save the editable original with a native movie material for every UV island.
    movie=bpy.data.images.load(str(OUT/'film-huit-plans-hd.mp4'))
    for i in range(8):
        mat=mats['film'+str(i)]; nodes=mat.node_tree.nodes
        node=nodes['Film source'];node.image=movie
        node.image_user.frame_duration=48;node.image_user.use_auto_refresh=True;node.image_user.use_cyclic=True
        uv=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeMapping')
        mapping.inputs['Scale'].default_value=(.25,.5,1)
        mapping.inputs['Location'].default_value=(.25*(i%4),.5*(1-i//4),0)
        mat.node_tree.links.new(uv.outputs['UV'],mapping.inputs[0]);mat.node_tree.links.new(mapping.outputs[0],node.inputs[0])
    movie.filepath='//../../public/worlds/film-huit-plans-hd.mp4'
    bpy.context.scene.frame_end=48
    bpy.context.scene.frame_set(8)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                space=area.spaces.active
                space.region_3d.view_perspective='CAMERA'
                space.shading.type='MATERIAL'
                space.overlay.show_overlays=False
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'Sous-la-peau.blend'),compress=True,relative_remap=False)
    for i in range(8):
        mat=mats['film'+str(i)];node=mat.node_tree.nodes['Film source']
        mat.node_tree.links.remove(node.inputs[0].links[0])
        node.image=bpy.data.images[f'shot{i}.jpg']
    colors={}
    for name,mat in mats.items():
        if name.startswith('film') or name in ('lakeplate','lakereflection','chamberplate','palmplate','foldplate'):continue
        colors[name]=list(mat.diffuse_color)
        shader=mat.node_tree.nodes.get('Principled BSDF')
        mix=shader.inputs['Base Color'].links[0].from_node
        tex=mix.inputs[1].links[0].from_node
        mat.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
    for coll in list(bpy.data.collections):
        meshes=[o for o in coll.objects if o.type=='MESH']
        if not meshes: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in meshes:o.select_set(True)
        bpy.context.view_layer.objects.active=meshes[0]
        if len(meshes)>1:bpy.ops.object.join()
        bpy.context.object.name=coll.name
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        if o.type=='MESH':o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/'sous-la-peau.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_tangents=False)
    # Some exporter versions drop the color factor on a multiply node.
    path=OUT/'sous-la-peau.glb';raw=path.read_bytes()
    old=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+old])
    for material in doc['materials']:
        if material['name'] in colors:material['pbrMetallicRoughness']['baseColorFactor']=colors[material['name']]
        if material['name']=='veil':
            # Voile translucide double face, quel que soit le choix de l'exporteur.
            material['pbrMetallicRoughness']['baseColorFactor'][3]=.56;material['alphaMode']='BLEND';material['doubleSided']=True
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
    body=struct.pack('<I',len(encoded))+b'JSON'+encoded+raw[old+20:]
    path.write_bytes(raw[:8]+struct.pack('<I',12+len(body))+body)
    packer=os.environ.get('NOVA_GLTFPACK') or shutil.which('gltfpack')
    if packer:
        packed=path.with_name('compact.glb')
        subprocess.run([packer,'-i',str(path),'-o',str(packed),'-cc','-kn','-km','-vtf','-vpf','-vp','16','-si','0.68','-se','0.004','-sv','-slb'],check=True)
        packed.replace(path)
    else:
        print('NOVA_BUILD_WARNING gltfpack introuvable (PATH ou NOVA_GLTFPACK) : sous-la-peau.glb exporté sans compression meshopt ni simplification')
    print('NOVA_BUILD_COMPLETE')

main()

