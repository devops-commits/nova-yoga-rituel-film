"""Exerce sculpt.Set.grid (soudure, pôles, UV) avec un faux bpy : aucune dépendance à Blender.
usage : python3 art/outils/test-grille.py [dossier art/blender]"""
import math, sys, types
from pathlib import Path
SRC = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'blender').resolve()
sys.dont_write_bytecode = True
sys.path.insert(0, str(SRC))

class Vector(tuple):
    def __new__(cls, p): return super().__new__(cls, (float(v) for v in p))
    def __add__(s, o): return Vector(a + b for a, b in zip(s, o))
    def __sub__(s, o): return Vector(a - b for a, b in zip(s, o))
    def __mul__(s, k): return Vector(a * k for a in s)
    __rmul__ = __mul__
    def dot(s, o): return sum(a * b for a, b in zip(s, o))
    def cross(s, o): return Vector((s[1]*o[2]-s[2]*o[1], s[2]*o[0]-s[0]*o[2], s[0]*o[1]-s[1]*o[0]))
    def normalized(s): n = math.sqrt(s.dot(s)) or 1; return s * (1 / n)
    x = property(lambda s: s[0]); y = property(lambda s: s[1]); z = property(lambda s: s[2])

class Mesh:
    def __init__(self, name): self.name = name; self.materials = []
    def from_pydata(self, verts, edges, faces):
        self.verts, self.faces = [Vector(v) for v in verts], [list(f) for f in faces]
        self.loops, self.polygons, at = [], [], 0
        for f in self.faces:
            a, b, c = (self.verts[k] for k in f[:3])
            self.polygons.append(types.SimpleNamespace(loop_indices=range(at, at + len(f)), normal=(b - a).cross(c - a).normalized(), use_smooth=False))
            self.loops += [types.SimpleNamespace(vertex_index=k) for k in f]; at += len(f)
        self.uv = types.SimpleNamespace(data=[types.SimpleNamespace(uv=None) for _ in self.loops])
    uv_layers = property(lambda s: types.SimpleNamespace(new=lambda name: s.uv))
    def update(self): pass

made = []
def new_object(name, mesh):
    made.append(mesh); return types.SimpleNamespace(name=name, data=mesh, location=None, rotation_euler=types.SimpleNamespace(z=0))
link = types.SimpleNamespace(link=lambda o: None)
sys.modules['bpy'] = types.SimpleNamespace(
    data=types.SimpleNamespace(meshes=types.SimpleNamespace(new=Mesh), objects=types.SimpleNamespace(new=new_object),
                               collections=types.SimpleNamespace(new=lambda n: types.SimpleNamespace(objects=link))),
    context=types.SimpleNamespace(scene=types.SimpleNamespace(collection=types.SimpleNamespace(children=link))))
sys.modules['mathutils'] = types.SimpleNamespace(Vector=Vector, noise=types.SimpleNamespace(noise=lambda v: math.sin(v[0] * 3 + v[1] * 5 + v[2] * 7) * .5))
import sculpt, bowl, approach, photographic_sets as sets

class Materials(dict):
    __missing__ = lambda self, key: key
mats = Materials()
g = sculpt.Set('essai', mats, math.radians(-135), 33)
bowl.vessel(g); sets.chamber(g); sets.woven_passage(g)
approach.folds = lambda _g: None
approach.approach(g)
g.ell('ellipsoïde', (0, 0, 1), (.4, .4, .6), 'film2'); g.ring('anneau', (0, 0, 1), 1, .05, 'gold')
problems = 0
for mesh in made:
    used = {k for f in mesh.faces for k in f}
    keys = [tuple(round(c, 6) for c in mesh.verts[k]) for k in sorted(used)]
    checks = {
        'face dégénérée': any(len(set(f)) != len(f) or len(f) < 3 for f in mesh.faces),
        'sommet inutilisé': len(used) != len(mesh.verts),
        'UV manquante': any(l.uv is None or len(tuple(l.uv)) != 2 for l in mesh.uv.data),
        'UV non finie': any(l.uv is not None and not all(math.isfinite(c) for c in l.uv) for l in mesh.uv.data),
    }
    for label, bad in checks.items():
        if bad: problems += 1; print('ÉCHEC', mesh.name, label)
    mesh.duplicates = len(keys) - len(set(keys))
closed = [m for m in made if m.name in ('vessel_hammered_bronze', 'Bronze du palier', 'Lentille d’eau', 'ellipsoïde', 'landing_slab')]
for m in closed:
    v = [l.uv[1] for l in m.uv.data]
    print(f'{m.name}: {len(m.verts)} sommets, {len(m.faces)} faces dont {sum(len(f) == 3 for f in m.faces)} triangles de pôle, doublons de position {m.duplicates}, v ∈ [{min(v):.3f}, {max(v):.3f}]')
    # Une couture non soudée laisserait une colonne entière de doublons (des dizaines) ; le bol garde deux
    # points de lèvre confondus par l'écrêtage de son profil, sans rapport avec la couture.
    problems += m.duplicates > 8
plates = [m for m in made if m.name in ('Coque de lin · voûte et fond', 'Sol tissé · projection rasante', 'Galbe intérieur du pli', 'Sol intérieur de la trame', 'Pulpe et éminences de la paume')]
for m in plates:
    u = [l.uv for l in m.uv.data]
    print(f'{m.name}: {len(m.faces)} faces, u ∈ [{min(p[0] for p in u):.3f}, {max(p[0] for p in u):.3f}], v ∈ [{min(p[1] for p in u):.3f}, {max(p[1] for p in u):.3f}]')
print(f'{len(made)} maillages construits, {problems} problème(s)')
sys.exit(1 if problems else 0)
