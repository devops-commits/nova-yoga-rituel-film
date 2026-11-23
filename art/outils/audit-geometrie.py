"""Audit numérique de la géométrie « Sous la peau », sans Blender ni GPU.

Rejoue les fonctions de art/blender avec un faux `Set` qui enregistre les grilles,
puis mesure coutures de normales, contacts et étirement des UV projetées.
usage : python3 art/outils/audit-geometrie.py [dossier art/blender]   (NumPy requis ;
        le Python embarqué de Blender convient : Blender.app/Contents/Resources/*/python/bin/python3*)
"""
import math, sys, types
from pathlib import Path
import numpy as np

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'blender').resolve()
sys.dont_write_bytecode = True
sys.path.insert(0, str(SRC))
for name in ('bpy', 'mathutils'):
    sys.modules[name] = types.SimpleNamespace(Vector=tuple, noise=None)
import sculpt, bowl, approach, photographic_sets as sets


class Recorder:
    """Même interface que sculpt.Set ; garde les grilles au lieu de créer des maillages."""
    weld = getattr(sculpt, 'weld_seams', None)

    def __init__(self):
        self.grids = {}
        self.uvs = {}

    def grid(self, name, rows, mat, smooth=True, uv_coords=None):
        self.grids.setdefault(name, []).append((np.array(rows, float), mat))
        return self

    def surface(self, name, rows, mat, uv_coords=None):
        return self.grid(name, rows, mat)
    ell, box, bowl = sculpt.Set.ell, sculpt.Set.box, sculpt.Set.bowl
    def tube(self, *a, **k): pass
    def rock(self, *a, **k): pass
    ring = tube


def uv_mesh(g, name, rows, coords, material):
    g.grid(name, rows, material)
    g.uvs.setdefault(name, []).append(np.array(coords, float))
sets.uv_mesh = uv_mesh


def normals(p, closed):
    """Normales lissées par sommet d'une grille, comme Blender (moyenne pondérée par l'aire).
    `closed` : la première et la dernière colonne sont soudées avant le calcul."""
    n, m = p.shape[:2]
    a, b, c, d = p[:-1, :-1], p[:-1, 1:], p[1:, 1:], p[1:, :-1]
    face = np.cross(c - a, d - b)
    out = np.zeros_like(p)
    for sl in ((slice(0, -1), slice(0, -1)), (slice(0, -1), slice(1, None)), (slice(1, None), slice(1, None)), (slice(1, None), slice(0, -1))):
        out[sl] += face
    if closed:
        out[:, 0] += out[:, -1]; out[:, -1] = out[:, 0]
    return out / np.maximum(np.linalg.norm(out, axis=2, keepdims=True), 1e-12)


def seam(name, p):
    gap = np.linalg.norm(p[:, 0] - p[:, -1], axis=1).max()
    if gap > 1e-6:
        return print(f'  {name}: grille ouverte (écart {gap:.3f} m)')
    welded = bool(Recorder.weld) and gap < 1e-6
    nn = normals(p, welded)
    ok = np.linalg.norm(p[:, 0] - p[:, 1], axis=1) > 1e-6  # hors pôles
    ang = np.degrees(np.arccos(np.clip((nn[:, 0] * nn[:, -1]).sum(1), -1, 1)))[ok]
    print(f'  {name}: {p.shape[1]} colonnes, rupture de normale à la couture  max {ang.max():.2f}°  médiane {np.median(ang):.2f}°'
          + ('  (couture soudée)' if welded else '  (colonnes 0 et N dupliquées, non soudées)'))


def uv_report(name, p, uv, size, fades=True):
    """Densité de texels (px/m) le long des deux axes de la grille, et part de surface à UV dégénérées."""
    w, h = size
    du = np.linalg.norm((uv[:, 1:] - uv[:, :-1]) * (w, h), axis=2) / np.maximum(np.linalg.norm(p[:, 1:] - p[:, :-1], axis=2), 1e-9)
    dv = np.linalg.norm((uv[1:] - uv[:-1]) * (w, h), axis=2) / np.maximum(np.linalg.norm(p[1:] - p[:-1], axis=2), 1e-9)
    a, b, c, d = p[:-1, :-1], p[:-1, 1:], p[1:, 1:], p[1:, :-1]
    area = .5 * np.linalg.norm(np.cross(c - a, d - b), axis=2)
    ua, ub, uc, ud = uv[:-1, :-1], uv[:-1, 1:], uv[1:, 1:], uv[1:, :-1]
    e1, e2 = (uc - ua) * (w, h), (ud - ub) * (w, h)
    texels = .5 * np.abs(e1[..., 0] * e2[..., 1] - e1[..., 1] * e2[..., 0])
    density = texels / np.maximum(area, 1e-12)  # px² par m²
    # Fondu vers la trame du monde, comme photographic.js (beyondFrame) : v de plaque par face.
    v = (ua + ub + uc + ud)[..., 1] / 4
    step = lambda lo, hi, x: (lambda t: t * t * (3 - 2 * t))(np.clip((x - lo) / (hi - lo), 0, 1))
    fade = np.maximum(step(.80, 1.02, v), 1 - step(-.02, .20, v)) if fades else np.zeros_like(v)
    seen = area * (1 - fade)  # part de la plaque encore visible
    dead = seen[density < 4].sum() / area.sum()  # moins de 2 px par mètre ET encore visible : traînée
    half = (fade > .02) & (fade < .98)
    edge = np.sqrt(area[half].sum()) if half.any() else 0
    q = lambda x: ' / '.join(f'{v:.0f}' for v in np.percentile(x, [5, 50, 95]))
    print(f'  {name}: {area.sum():.1f} m², px/m le long des colonnes {q(du)}, des rangées {q(dv)} (p5/p50/p95) ; '
          f'surface en traînée encore visible (UV écrasées × part de plaque) {100 * dead:.2f} %')
    if fades: print(f'    hors cadre : {100 * area[fade >= .98].sum() / area.sum():.1f} % en trame pure, {100 * area[half].sum() / area.sum():.1f} % en fondu '
          f'(≈{edge:.1f} m de côté équivalent)\n'
          f'      plaque visible à plus de 2 % là où v sort de 0..1 : '
          f'{100 * area[(fade < .98) & ((v > 1) | (v < 0))].sum() / area.sum():.2f} % ; v ∈ [{uv[..., 1].min():.2f}, {uv[..., 1].max():.2f}]')


g = Recorder()
vessel_rows = np.array(bowl.vessel(g), float)
sets.chamber(g)
approach_set = Recorder()
approach_set.materials = {}
approach.folds = lambda _g: None
approach.approach(approach_set)

print('== 1. Coutures de normales (volumes fermés)')
seam('vessel_hammered_bronze', vessel_rows)
for name in ('Bronze du palier', 'Lentille d’eau', 'peau_de_paume', 'phalange_0'):
    seam(name, approach_set.grids[name][0][0])

print('== 2. UV')
profile = vessel_rows[:, 0]
arc = np.linalg.norm(np.diff(profile, axis=0), axis=1)
lengths = getattr(sculpt, 'profile_lengths', None)  # v du bronze : longueur d'arc si disponible, sinon indice de rangée
v_rows = np.array(lengths(vessel_rows.tolist()) if lengths else np.arange(len(profile)) / (len(profile) - 1))
rows_px = np.abs(np.diff(v_rows)) * 512 / np.maximum(arc, 1e-9)
live = arc > 1e-4
print(f'  bol (bronze 1024×512): px/m le long du profil  min {rows_px[live].min():.0f}  médiane {np.median(rows_px[live]):.0f}  max {rows_px[live].max():.0f}'
      f'  → rapport max/min {rows_px[live].max() / rows_px[live].min():.0f}×')
for name in ('Coque de lin · voûte et fond', 'Fond de l’alcôve', 'Sol tissé · projection rasante', 'Contrefort de fibres'):
    for (p, _), uv in zip(g.grids[name][:1], g.uvs[name][:1]):
        uv_report(name, p, uv, (1280, 720))
p, uv = approach_set.grids['Pulpe et éminences de la paume'][0][0], approach_set.uvs['Pulpe et éminences de la paume'][0]
uv_report('Pulpe et éminences de la paume', p, uv, (1280, 720), fades=False)  # la paume ne se fond pas

print('== 3. Contacts')
floor = g.grids['Sol tissé · projection rasante'][0][0]
ring = vessel_rows[vessel_rows[..., 2] <= vessel_rows[..., 2].min() + 1e-4]
def floor_z(x, y):
    d = np.hypot(floor[..., 0] - x, floor[..., 1] - y); return floor[..., 2].ravel()[d.argmin()]
under = np.array([floor_z(x, y) for x, y, _ in ring[::8]])
print(f'  bol / sol de lin: dessous du pied z={vessel_rows[..., 2].min():.4f} m, sol sous le pied z={under.min():.4f}…{under.max():.4f} m'
      f'  → écart {1000 * (vessel_rows[..., 2].min() - under.max()):+.1f}…{1000 * (vessel_rows[..., 2].min() - under.min()):+.1f} mm (négatif = enfoncé)')
drop = approach_set.grids['Lentille d’eau'][0][0]
palm = approach_set.grids['Pulpe et éminences de la paume'][0][0]
seat = palm[(np.abs(palm[..., 2] - .66) < .12) & (np.hypot(palm[..., 0] - 3.72, palm[..., 1] + 38.45) < 1.6)]
print(f'  goutte / paume: {len(seat)} sommets de paume sous la goutte, z={seat[:, 2].min():.3f}…{seat[:, 2].max():.3f} m')
level = drop[0]
gaps = np.array([z - seat[np.hypot(seat[:, 0] - x, seat[:, 1] - y).argmin(), 2] for x, y, z in level[::4]])
print(f'    assise au centre (z={level[:, 2].mean():.3f}): écart goutte − paume {1000 * gaps.min():+.1f} mm (négatif = goutte enfoncée) ; '
      "l'épaule n'est pas mesurée ici : la paume, paramétrée par rayons, y est trop peu échantillonnée")
landing = approach_set.grids['Bronze du palier'][0][0]
print(f'  bol du palier: pied z={landing[..., 2].min():.3f} m ; sol du pli z≈0,079±0,008 m')
