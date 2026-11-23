"""Mesh tools for the editable Nova Yoga sets. Units are metres, Z is up."""
import math
import random
import bpy
from mathutils import Vector, noise

TAU = math.tau


def weld_seams(rows, tolerance=1e-6):
    """Vertex index for every grid corner, merging a closed grid's seam column and its poles.

    Lathed grids repeat their first column to close the loop. Left as separate vertices,
    each side of the seam averaged its normals alone and the join showed under a highlight.
    """
    m = len(rows[0])
    same = lambda a, b: max(abs(a[k] - b[k]) for k in range(3)) <= tolerance
    closed = m > 2 and all(same(row[0], row[-1]) for row in rows)
    index = {}
    for i, row in enumerate(rows):
        pole = all(same(row[0], p) for p in row)
        for j in range(m):
            index[i, j] = i * m if pole or (closed and j == m - 1) else i * m + j
    return index


def profile_lengths(rows):
    """Normalised distance travelled along the first column, row by row."""
    total = [0.0]
    for a, b in zip(rows, rows[1:]):
        total.append(total[-1] + math.dist(tuple(a[0]), tuple(b[0])))
    return [t / (total[-1] or 1.0) for t in total]

class Set:
    def __init__(self, name, materials, angle=0, center=0):
        self.name, self.materials = name, materials
        self.sin, self.cos = math.sin(angle), math.cos(angle)
        self.center = center
        self.collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(self.collection)

    def point(self, p):
        x, y, z = p
        y += self.center
        return (self.cos*x+self.sin*y, -self.sin*x+self.cos*y, z)

    def grid(self, name, rows, mat, smooth=True, uv_coords=None):
        n, m = len(rows), len(rows[0])
        pts = [v for row in rows for v in row]
        index = weld_seams(rows)
        faces, corners = [], []
        for i in range(n-1):
            for j in range(m-1):
                face, kept = [], []
                for corner in ((i, j), (i, j+1), (i+1, j+1), (i+1, j)):
                    if index[corner] not in face:
                        face.append(index[corner]); kept.append(corner)
                if len(face) > 2:
                    faces.append(face); corners.append(kept)
        used = sorted({k for face in faces for k in face})
        slot = {k: s for s, k in enumerate(used)}
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([pts[k] for k in used], [], [[slot[k] for k in face] for face in faces])
        mesh.materials.append(self.materials[mat])
        uv = mesh.uv_layers.new(name="SurfaceUV")
        crops={
            'peau_de_paume':(.62,.08,.24,.36),
            'droplet_body':(.28,.34,.17,.16),
            'Goutte en équilibre':(.28,.34,.17,.16),
            'suspended_serpentine_stream':(.27,.38,.20,.14),
            'Patine animée':(.40,.28,.14,.07),
            'lake_sheet':(.03,.015,.93,.26),
            'Grande voile':(.12,.50,.78,.25),
            'Grand voile de lin':(.14,.50,.70,.25),
            'curved_inner_film':(.28,.21,.53,.43),
        }
        region=crops.get(name)
        if name.startswith('diaphanous_film_'):region=(.48,.40,.39,.46)
        # Texel density follows the surface: rows are far from evenly spaced along a lathed profile.
        along = profile_lengths(rows) if mat == 'bronze' else None
        for face, kept in zip(mesh.polygons, corners):
            face.use_smooth = smooth
            for li, (i, j) in zip(face.loop_indices, kept):
                coord=(j/(m-1), along[i] if along else i/(n-1))
                if uv_coords:
                    uv.data[li].uv = uv_coords[i][j]
                    continue
                if not mat.startswith('film') and mat != 'bronze' and abs(face.normal.z)>.68:
                    px,py,_=pts[i*m+j];coord=(px*.38,py*.38)
                if mat=='skin':
                    px,py,pz=pts[i*m+j];coord=(px*.67+pz*.18,py*.69+pz*.37)
                if region and mat.startswith('film'):
                    u,v,du,dv=region;coord=(u+du*coord[0],v+dv*coord[1])
                uv.data[li].uv = coord
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        self.collection.objects.link(obj)
        obj.location = self.point((0,0,0))
        obj.rotation_euler.z = -math.atan2(self.sin, self.cos)
        return obj

    def surface(self, name, rows, mat, uv_coords=None):
        return self.grid(name, rows, mat, uv_coords=uv_coords)

    def ell(self, name, loc, radii, mat, segments=28, bands=14):
        x,y,z = loc
        rx,ry,rz = radii
        rows = []
        for i in range(bands+1):
            lat = (i/bands-.5)*math.pi
            rows.append([(x+rx*math.cos(lat)*math.cos(TAU*j/segments),
                          y+ry*math.cos(lat)*math.sin(TAU*j/segments), z+rz*math.sin(lat))
                         for j in range(segments+1)])
        return self.grid(name, rows, mat)

    def rock(self, name, loc, radii, mat, seed=1):
        x,y,z = loc
        rows = []
        for i in range(13):
            lat = (i/12-.5)*math.pi
            row = []
            for j in range(25):
                v = Vector((math.cos(lat)*math.cos(TAU*j/24),math.cos(lat)*math.sin(TAU*j/24),math.sin(lat)))
                n = 1 + .21*noise.noise(v*2.3+Vector((float(seed)%79,1,3)))
                row.append((x+v.x*radii[0]*n, y+v.y*radii[1]*n, z+v.z*radii[2]*n))
            rows.append(row)
        return self.grid(name,rows,mat)

    def tube(self, name, points, radius, mat):
        pts = [Vector(p) for p in points]
        rows = []
        if len(pts)<2: return
        prev = None
        for i, p in enumerate(pts):
            t = (pts[min(i+1,len(pts)-1)] - pts[max(i-1,0)]).normalized()
            ref = prev if prev is not None else Vector((0,0,1)) if abs(t.z)<.85 else Vector((1,0,0))
            u = (ref - t*ref.dot(t)).normalized()
            v = t.cross(u)
            prev = u
            rows.append([p+radius*(u*math.cos(TAU*j/8)+v*math.sin(TAU*j/8)) for j in range(9)])
        return self.grid(name,rows,mat)

    def ring(self, name, loc, radius, thickness, mat):
        x,y,z=loc
        return self.tube(name,[(x+radius*math.cos(TAU*j/64), y,z+radius*math.sin(TAU*j/64)) for j in range(65)],thickness,mat)

    def box(self, name, loc, dims, mat):
        x,y,z=loc
        a,b,c=[max(.004,d/2) for d in dims]
        bevel=min(a,b,c,.14)*.40
        rows=[]
        for h,k in [(-c,.001),(-c,1-bevel/max(a,b)),(-c+bevel,1),(c-bevel,1),(c,1-bevel/max(a,b)),(c,.001)]:
            row=[]
            for j in range(33):
                u,v=math.cos(TAU*j/32),math.sin(TAU*j/32)
                row.append((x+a*k*math.copysign(abs(u)**.18,u),y+b*k*math.copysign(abs(v)**.18,v),z+h))
            rows.append(row)
        return self.grid(name,rows,mat)

    def bowl(self,name,loc,radius,height,mat):
        x,y,z=loc
        profile=[(.03,0),(.31,0),(.34,.065),(.31,.1),(.5,.2),(.76,.42),(.92,.71),(1,.96),(.994,1),(.959,.99),(.91,.76),(.72,.48),(.46,.27),(.03,.19)]
        return self.grid(name,[[(x+radius*r*math.cos(TAU*j/64),y+radius*r*math.sin(TAU*j/64),z+height*h) for j in range(65)] for r,h in profile],mat)

