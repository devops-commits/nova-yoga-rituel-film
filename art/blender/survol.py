"""Survol des sept entrées : 264 images, 24 i/s, EEVEE, matériaux éclairés.

    blender --background art/blender/Sous-la-peau.blend --python-exit-code 1 --python art/blender/survol.py

Variables d'environnement
  NOVA_FRAMES     dossier de sortie (obligatoire)
  NOVA_IMAGES     instants en secondes séparés par des virgules (aperçu) ; vide = les 264 images
  NOVA_LARGEUR / NOVA_HAUTEUR   1920 × 1080 par défaut
  NOVA_ECHANTILLONS             64 par défaut
  NOVA_FLOU=0     sans flou de mouvement          NOVA_RELIEF=0   sans le relief entre les alcôves
  NOVA_SOLEIL_ELEVATION         hauteur du soleil en degrés (34 : lumière rasante ; le jeu est à 52,6)
  NOVA_MASQUER    préfixes de collections à cacher, séparés par des virgules

La trajectoire vient de survol_trajet.py (testée hors Blender par art/outils/test-survol.py).
Lumière : même azimut que le soleil du jeu (nord-ouest : à gauche sur le plan d'ensemble nord en haut
et à gauche du regard à l'arrivée), plus bas pour raser le relief. Le plan du bol reçoit une lampe
d'appoint à gauche de la caméra, comme dans la dernière image du film, éteinte pendant la montée.
"""
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector, noise

ICI = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(ICI))
import pbr
import survol_trajet as trajet

env = os.environ.get
scene = bpy.context.scene


def regler(cible, **valeurs):
    """Pose les réglages qui existent dans cette version de Blender, signale les autres."""
    for nom, valeur in valeurs.items():
        try:
            if not hasattr(cible, nom): raise AttributeError(nom)
            setattr(cible, nom, valeur)
        except (AttributeError, TypeError) as erreur:
            print('NOVA_SURVOL_REGLAGE_IGNORE', type(cible).__name__, nom, erreur)


def premier_valable(cible, nom, candidats):
    for candidat in candidats:
        try:
            setattr(cible, nom, candidat)
            return candidat
        except TypeError:
            continue
    raise RuntimeError(f'aucune valeur acceptée pour {nom} parmi {candidats}')


# ───────── moteur : EEVEE (identifiant BLENDER_EEVEE en 5.x, BLENDER_EEVEE_NEXT de 4.2 à 4.5) ─────────
moteur = premier_valable(scene.render, 'engine', ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'))
print('NOVA_SURVOL_MOTEUR', moteur, bpy.app.version_string)
regler(scene.eevee, taa_render_samples=int(env('NOVA_ECHANTILLONS', '64')), use_shadows=True, use_raytracing=True,
       use_shadow_jitter_viewport=False, shadow_ray_count=2, shadow_step_count=8, use_fast_gi=True)
regler(getattr(scene.eevee, 'ray_tracing_options', None) or scene.eevee, trace_max_roughness=.5)
flou = env('NOVA_FLOU', '1') != '0'
regler(scene.render, use_motion_blur=flou, motion_blur_shutter=.5)
vue = premier_valable(scene.view_settings, 'view_transform', ('ACES 1.3', 'ACES 2.0', 'Filmic', 'AgX', 'Standard'))
print('NOVA_SURVOL_VUE', vue)   # le jeu est en ACES filmique, exposition 0,91
regler(scene.view_settings, exposure=-.14, gamma=1.0)
scene.render.resolution_x = int(env('NOVA_LARGEUR', '1920'))
scene.render.resolution_y = int(env('NOVA_HAUTEUR', '1080'))
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.render.fps = trajet.FPS
scene.frame_start, scene.frame_end = 1, trajet.IMAGES
scene.render.image_settings.file_format = 'PNG'
regler(scene.render.image_settings, color_mode='RGB', color_depth='8', compression=15)

masques = [p for p in env('NOVA_MASQUER', '').split(',') if p]
for collection in bpy.data.collections:
    collection.hide_render = bool(masques) and collection.name.startswith(tuple(masques))

# ───────── matières du cahier ─────────
absents = pbr.appliquer_tout()
if absents:
    print('NOVA_SURVOL_AVERTISSEMENT matériaux absents du .blend (relancer build.py) :', ', '.join(absents))

# ───────── ciel et lumière ─────────
monde = scene.world or bpy.data.worlds.new('Survol')
scene.world = monde
monde.use_nodes = True
fond = monde.node_tree.nodes.get('Background')
if fond:
    fond.inputs[0].default_value = (.62, .546, .479, 1)   # 0xcfc3b8, le ciel du jeu
    fond.inputs[1].default_value = .85
for objet in scene.objects:
    if objet.type == 'LIGHT': objet.hide_render = True     # le soleil de travail de build.py


def viser(objet, cible):
    objet.rotation_euler = (Vector(cible) - objet.location).to_track_quat('-Z', 'Y').to_euler()


def lampe(nom, genre, position, cible, **reglages):
    donnees = bpy.data.lights.new(nom, genre)
    objet = bpy.data.objects.new(nom, donnees)
    scene.collection.objects.link(objet)
    objet.location = position
    viser(objet, cible)
    regler(donnees, **reglages)
    return objet

# Soleil du jeu : Three.js (−36, 58, −26) → Blender (−36, 26, 58), soit l'azimut −54° (nord-ouest).
AZIMUT_SOLEIL = math.degrees(math.atan2(-36, 26))
elevation = math.radians(float(env('NOVA_SOLEIL_ELEVATION', '34')))
vers_soleil = Vector((math.sin(math.radians(AZIMUT_SOLEIL)) * math.cos(elevation),
                      math.cos(math.radians(AZIMUT_SOLEIL)) * math.cos(elevation), math.sin(elevation)))
lampe('Soleil rasant', 'SUN', vers_soleil * 200, (0, 0, 0), energy=3.4, color=(1, .875, .71), angle=math.radians(1.6),
      use_shadow=True, use_contact_shadow=True, use_shadow_jitter=True, shadow_maximum_resolution=.02)
lampe('Contre-jour froid', 'SUN', (22 * 5, -30 * 5, 14 * 5), (0, 0, 0), energy=.45, color=(.71, .88, .94), use_shadow=False)
# Appoint du bol : à gauche de la caméra de départ (−X local du monde 1), un peu en contre-jour.
appoint = lampe('Lumière du film', 'SPOT', trajet.monde(1, -3.6, 3.2, 3.0), trajet.monde(1, 0, 2, .62), energy=1500,
                color=(1, .86, .68), spot_size=math.radians(42), spot_blend=.6, shadow_soft_size=.35,
                use_shadow=True, use_contact_shadow=True, use_shadow_jitter=True)
for instant, energie in ((0, 1500), (1.2, 1500), (2.0, 0)):
    appoint.data.energy = energie
    appoint.data.keyframe_insert('energy', frame=round(instant * trajet.FPS) + 1)

# ───────── accessoires propres au survol (absents du jeu) ─────────
decor = bpy.data.collections.new('Survol • accessoires')
scene.collection.children.link(decor)


def nappe(nom, rangs, materiau, uv=None):
    n, m = len(rangs), len(rangs[0])
    maillage = bpy.data.meshes.new(nom)
    maillage.from_pydata([p for rang in rangs for p in rang], [],
                         [(i * m + j, i * m + j + 1, (i + 1) * m + j + 1, (i + 1) * m + j) for i in range(n - 1) for j in range(m - 1)])
    couche = maillage.uv_layers.new(name='SurfaceUV')
    for boucle in maillage.loops:
        i, j = divmod(boucle.vertex_index, m)
        couche.data[boucle.index].uv = uv(i, j, rangs[i][j]) if uv else (j / (m - 1), i / (n - 1))
    for face in maillage.polygons: face.use_smooth = True
    maillage.materials.append(materiau)
    maillage.update()
    objet = bpy.data.objects.new(nom, maillage)
    decor.objects.link(objet)
    return objet


def matiere_de_survol(nom, famille, teinte, echelle, relief, transmission=0.0):
    mat = bpy.data.materials.new(nom)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = teinte
    pbr.appliquer(mat, branchement=dict(famille=famille, couleur=True, echelle=echelle, relief=relief))
    regler(shader.inputs['Transmission Weight'], default_value=transmission)
    return mat

# 3,2–5,3 s : un pli de lin traverse le premier plan, plus vite que les arches.
lin = matiere_de_survol('lin du survol', 'voile', (.86, .80, .68, 1), (60, 18), .6, .12)
T_LIN = 4.55
centre_lin = Vector(trajet.point_devant(T_LIN, avant=7.5, droite=-.6, haut=-1.5))   # tiers bas du cadre, 3 à 6 m de l'objectif
avant_lin = Vector(trajet.pose(T_LIN + .05)['position']) - Vector(trajet.pose(T_LIN - .05)['position'])
avant_lin.z = 0
avant_lin.normalize()
travers_lin = avant_lin.cross(Vector((0, 0, 1))).normalized()
nappe('Pli de lin au premier plan', [[tuple(centre_lin + avant_lin * (u * 11 - 5.5) + travers_lin * (v * 3.2 - 1.6 + .5 * math.sin(u * 7))
                                            + Vector((0, 0, .9 * math.sin(u * math.pi) * math.cos(v * 2.4) + .28 * math.sin(v * 15 + u * 9))))
                                      for v in [k / 24 for k in range(25)]] for u in [k / 60 for k in range(61)]], lin)

# 7,6–9,9 s : un fil passe sur le bord du cadre.
# Il longe la trajectoire à 3 m sur sa gauche : vu depuis la caméra il glisse le long du bord gauche puis sort.
or_fil = bpy.data.materials.get('gold') or matiere_de_survol('fil du survol', 'tissage', (1, .82, .52, 1), (1, 40), .5)
points_fil = []
for k in range(33):
    t = 8.2 + 1.15 * k / 32
    ici, devant = Vector(trajet.pose(t)['position']), Vector(trajet.pose(t + .02)['position']) - Vector(trajet.pose(t - .02)['position'])
    gauche = Vector((-devant.y, devant.x, 0)).normalized()
    points_fil.append(ici + 3.0 * gauche + Vector((0, 0, .4 - .35 * math.sin(math.pi * k / 32))))      # flèche du fil
rangs_fil = []
for k, p in enumerate(points_fil):
    axe = (points_fil[min(k + 1, 32)] - points_fil[max(k - 1, 0)]).normalized()
    cote = axe.cross(Vector((0, 0, 1))).normalized(); dessus = cote.cross(axe)
    rangs_fil.append([tuple(p + .018 * (cote * math.cos(math.tau * j / 8) + dessus * math.sin(math.tau * j / 8))) for j in range(9)])
nappe('Fil en bord de cadre', rangs_fil, or_fil)

# Relief entre les alcôves : îlots bas qui relient les sept chemins jusque dans les ombres.
if env('NOVA_RELIEF', '1') != '0':
    axes = [(math.sin(math.radians(a)), math.cos(math.radians(a))) for a in trajet.ANGLES] + [(0.0, -1.0)]   # sept passages et la chaussée

    def lisse(x, a, b):
        t = min(1.0, max(0.0, (x - a) / (b - a)))
        return t * t * (3 - 2 * t)

    def altitude(x, y):
        r = math.hypot(x, y)
        libre = 1.0
        for k, (sx, sy) in enumerate(axes):
            le_long, travers = x * sx + y * sy, abs(x * sy - y * sx)
            if le_long > 0: libre = min(libre, lisse(travers, 3.6 if k < 7 else 7.6, 9.5 if k < 7 else 13.0))
            if k < 7: libre = min(libre, lisse(math.hypot(x - 33 * sx, y - 33 * sy), 10.2, 15.0))
        bosse = .55 + .45 * noise.noise(Vector((x * .09, y * .09, 3.1))) + .12 * noise.noise(Vector((x * .31, y * .31, 7.7)))
        return -.14 + .62 * libre * lisse(r, 12.0, 17.0) * (1 - lisse(r, 43.0, 58.0)) * max(0.0, bosse)

    anneaux = []
    for i in range(72):
        r = 11.2 + 50 * i / 71
        anneaux.append([(r * math.sin(math.tau * j / 288), r * math.cos(math.tau * j / 288)) for j in range(289)])
    sol = bpy.data.materials.get('chalk') or matiere_de_survol('relief du survol', 'calcaire', (.62, .50, .38, 1), (3, 3), .55)
    nappe('Relief entre les alcôves', [[(x, y, altitude(x, y)) for x, y in anneau] for anneau in anneaux], sol,
          uv=lambda i, j, p: (p[0] * .38, p[1] * .38))

# ───────── caméra ─────────
donnees_camera = bpy.data.cameras.new('Caméra • survol')
camera = bpy.data.objects.new('Caméra • survol', donnees_camera)
scene.collection.objects.link(camera)
scene.camera = camera
donnees_camera.type = 'PERSP'
donnees_camera.sensor_fit = 'VERTICAL'
donnees_camera.sensor_height = trajet.CAPTEUR_H
donnees_camera.sensor_width = trajet.CAPTEUR_H * trajet.FORMAT
donnees_camera.clip_start, donnees_camera.clip_end = .05, 1200
camera.rotation_mode = 'XYZ'
donnees_camera.dof.use_dof = True
regler(bpy.context.preferences.edit, keyframe_new_interpolation_type='LINEAR')   # pas d'interpolation parasite
for image in range(1, trajet.IMAGES + 1):
    t = (image - 1) / trajet.FPS
    p = trajet.pose(t)
    camera.location = p['position']
    camera.rotation_euler = trajet.euler_blender(p)
    donnees_camera.lens = p['focale']
    # Une seule zone nette à la fois : le point visé au sol, ou la lèvre du bol au départ.
    sinus = math.sin(math.radians(max(p['inclinaison'], 0)))
    nettete = p['position'][2] / sinus if sinus > .05 else 30.0
    levre = 7.5 - trajet.BOL['rayon'] - 4.9 * min(t, 1.2) / 1.2
    passage = min(1.0, max(0.0, (t - 1.2) / .5))            # de la lèvre au sol, sans saut de mise au point
    nettete = levre + (nettete - levre) * passage
    donnees_camera.dof.focus_distance = min(max(nettete, .9), 400.0)
    donnees_camera.dof.aperture_fstop = 2.8 + 2.8 * passage + 5.4 * min(1.0, max(0.0, (t - 7.6) / 1.4))
    camera.keyframe_insert('location', frame=image)
    camera.keyframe_insert('rotation_euler', frame=image)
    donnees_camera.keyframe_insert('lens', frame=image)
    donnees_camera.dof.keyframe_insert('focus_distance', frame=image)
    donnees_camera.dof.keyframe_insert('aperture_fstop', frame=image)

# ───────── rendu ─────────
sortie = Path(os.environ['NOVA_FRAMES'])
sortie.mkdir(parents=True, exist_ok=True)
instants = [float(v) for v in env('NOVA_IMAGES', '').split(',') if v.strip()]
if instants:
    for t in instants:
        image = min(trajet.IMAGES, round(t * trajet.FPS) + 1)
        scene.frame_set(image)
        scene.render.filepath = str(sortie / f'cle-{t:05.2f}s-image{image:03d}')
        bpy.ops.render.render(write_still=True)
        print('NOVA_SURVOL_IMAGE', t, image, flush=True)
else:
    scene.render.filepath = str(sortie / 'vue-')
    bpy.ops.render.render(animation=True)
print('NOVA_SURVOL_COMPLET')
