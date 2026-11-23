"""Géométrie du raccord avec la dernière image du survol (plateforme-libre.jpg), sans dépendance à Blender.

Deux objets vus depuis la pose de départ du jeu (caméra Blender (0, −1,8, 1,62), regard +Y, champ vertical
63°, image 1280×720) : l'arche centrale (passage 4) et le voile tendu du monde 4. landscape.py et gardens.py
construisent leurs maillages à partir d'ici ; art/outils/test-raccord-arche.py vérifie la projection.
"""
import math

# Pose de départ de la clairière, en repère Blender (Three.js (0, 1,62, 1,8), regard −Z).
CAMERA = (0.0, -1.8, 1.62)
LARGEUR, HAUTEUR, CHAMP_VERTICAL = 1280, 720, 63.0
FOCALE = HAUTEUR / 2 / math.tan(math.radians(CHAMP_VERTICAL / 2))      # 587,5 px

DISTANCE_ARCHE = 14.4      # le long du passage, depuis le centre de la clairière
CENTRE_MONDE = 33.0        # centre du socle d'un monde, même axe

# Arc d'un passage : demi-portée, flèche de la fibre moyenne au-dessus de la base (z = 0,09), rayon du tube,
# galbe (1 = demi-ellipse ; < 1 = jambes plus droites, sommet inchangé).
ARC = dict(portee=2.8, fleche=4.9, rayon=.165, galbe=1.0)
# Arche centrale relevée sur la cible à 16,2 m de la caméra (0,02757 m par pixel) : pieds x = 520 et 757,5
# (demi-portée 118,7 px), fibre moyenne du sommet y = 215 (tube de 207 à 223), épaisseur 15 à 16 px.
ARC_CENTRE = dict(portee=3.27, fleche=5.53, rayon=.21, galbe=.80)
BASE_ARC = .09


def arc(spec, recul=0.0, pas=64):
    """Fibre moyenne d'un arc en repère du passage : (x, y le long du passage, z)."""
    points = []
    for i in range(pas + 1):
        t = math.pi * i / pas
        c = math.cos(t)
        exposant = 1 - (1 - spec['galbe']) * c * c       # ellipse pure au sommet, galbe aux pieds
        x = spec['portee'] * math.copysign(abs(c) ** exposant, c)
        points.append((x, DISTANCE_ARCHE + recul, BASE_ARC + spec['fleche'] * math.sin(t)))
    return points


def projeter(point, camera=CAMERA):
    """Point Blender → pixel (x, y) de l'image de départ."""
    x, y, z = point
    profondeur = y - camera[1]
    return (LARGEUR / 2 + FOCALE * (x - camera[0]) / profondeur, HAUTEUR / 2 - FOCALE * (z - camera[2]) / profondeur)


# ── Voile du monde 4 ────────────────────────────────────────────────────────────────────────────────────
# Lisières relevées sur la cible, en pixels : (x, y bord haut, y bord bas). Les deux pointes dépassent de
# l'arche ; le pincement du milieu est la torsion du tissu.
LISIERES = [(445, 270, 270), (500, 279, 308), (550, 286, 336), (600, 295, 349), (650, 297, 341),
            (683, 287, 349), (733, 277, 344), (767, 273, 327), (800, 269, 292), (828, 261, 261)]
RECUL_VOILE = -1.5         # devant le centre du socle : 33,3 m de la caméra
TORSION = .9               # m : le bord haut vient vers la clairière à gauche, s'en éloigne à droite
GARDE_BASSE = 2.30         # m : au-dessus des rayons de marche.json (2,08 m), le voile ne ferme aucun passage
COLONNES, RANGS = 56, 10
LARGEUR_OURLET = .09       # m, ourlet doublé (deuxième épaisseur du même tissu)


def _lisse(x):
    """Lisières interpolées (Catmull-Rom) à l'abscisse écran x."""
    pts = LISIERES
    k = max(i for i in range(len(pts) - 1) if pts[i][0] <= x) if x > pts[0][0] else 0
    a, b = pts[k], pts[k + 1]
    avant, apres = pts[max(k - 1, 0)], pts[min(k + 2, len(pts) - 1)]
    u = (x - a[0]) / (b[0] - a[0])

    def courbe(n):
        ta = (b[n] - avant[n]) / (b[0] - avant[0]) * (b[0] - a[0])
        tb = (apres[n] - a[n]) / (apres[0] - a[0]) * (b[0] - a[0])
        return ((2 * u ** 3 - 3 * u * u + 1) * a[n] + (u ** 3 - 2 * u * u + u) * ta
                + (-2 * u ** 3 + 3 * u * u) * b[n] + (u ** 3 - u * u) * tb)
    haut, bas = courbe(1), courbe(2)
    return haut, max(bas, haut)


def _point_voile(s, t):
    """s le long du voile (0 pointe gauche → 1 pointe droite), t en travers (0 bord bas libre → 1 bord haut)."""
    x_ecran = LISIERES[0][0] + s * (LISIERES[-1][0] - LISIERES[0][0])
    haut, bas = _lisse(x_ecran)
    y_ecran = bas + (haut - bas) * t
    tendu = math.sin(math.pi * s)                                 # les pointes restent tenues
    pli = (.22 * math.sin(math.tau * (4.5 * s + .8 * t)) + .11 * math.sin(math.tau * (9 * s - 1.3 * t))) * tendu
    recul = RECUL_VOILE + TORSION * math.sin(math.tau * s) * (2 * t - 1) + pli
    profondeur = CENTRE_MONDE + recul - CAMERA[1]
    x = (x_ecran - LARGEUR / 2) / FOCALE * profondeur
    z = max(CAMERA[2] + (HAUTEUR / 2 - y_ecran) / FOCALE * profondeur, GARDE_BASSE)
    return (x, recul, z)


def voile():
    """Nappe du voile en repère du monde 4 (origine au centre du socle) : (rangées, UV).

    Une rangée par section en travers, de pointe à pointe : les deux pointes sont des pôles que sculpt.py soude.
    UV : u = 4·s (la carte du voile se répète tous les 0,5 m avec l'échelle de pbr.py), v = t. Le jeu lit
    ces UV bruts pour n'animer que le bord libre (v Blender = 0), pointes tenues.
    """
    rows, uvs = [], []
    for c in range(COLONNES + 1):
        s = c / COLONNES
        rows.append([_point_voile(s, r / RANGS) for r in range(RANGS + 1)])
        uvs.append([(4 * s, r / RANGS) for r in range(RANGS + 1)])
    return rows, uvs


def ourlets():
    """Deux bandes de même tissu posées sur les lisières : (nom, rangées, UV). La double épaisseur fait l'ourlet."""
    bandes = []
    for nom, bord, vers in (('haut', 1.0, -1), ('bas', 0.0, 1)):
        rows, uvs = [], []
        for c in range(COLONNES + 1):
            s = c / COLONNES
            a, b = _point_voile(s, bord), _point_voile(s, bord + vers * .5)
            travers = math.dist(a, b)
            part = min(1.0, LARGEUR_OURLET / travers) if travers > 1e-6 else 0.0
            interieur = tuple(p + (q - p) * part for p, q in zip(a, b))
            rows.append([(p[0], p[1] - .004, p[2]) for p in (a, interieur)])      # 4 mm devant la nappe
            uvs.append([(4 * s, bord), (4 * s, bord)])
        bandes.append((nom, rows, uvs))
    return bandes


# ── Monde 3 vu de la clairière : cyprès, lanterne, tiges ────────────────────────────────────────────────
# Dans la cible, sous l'arche sombre de gauche (passage 3, −45°), la rangée de massifs du cirque se lit comme
# une rangée de cyprès élancés vert sombre, et la relique comme une lanterne ronde posée au sol dans une cage
# de tiges dorées. Ces éléments « lointains » occupent la place des orgues basaltiques (interiors.py) et de la
# relique (build.py) ; le jeu les fond selon la distance caméra → salle (atmosphere.js, FONDU_MONDE3), les
# orgues et la salle restent intacts de près.
ANGLE_MONDE3 = -45.0
RAYON_CIRQUE3 = 7.9                    # couronne des orgues basaltiques, repère de la salle
RELIQUE3 = (0.0, 2.0)                  # relique et foyer de schiste, repère de la salle (y = 35 − 33)
SOL_CIBLE3 = 389                       # pied des cyprès dans la cible (y px)
# Pointes des cyprès relevées dans la cible, (x px, y px du sommet). De 222 à 292 l'arche passe devant la
# rangée : pointes interpolées au même pas. 312 : le cyprès isolé à droite du pied de l'arche.
PICS_CYPRES = [(3, 286), (24, 296), (54, 278), (68, 285), (86, 300), (114, 296), (132, 283), (144, 251),
               (162, 277), (180, 271), (198, 264), (222, 278), (246, 280), (270, 284), (292, 281), (312, 261)]
# Lanterne : disque clair (244, 221, 182) centré en (97, 366), rayon 22 px ; cage de tiges jusqu'à y = 287.
LANTERNE_CIBLE = dict(x=97, y=366, rayon=22, sommet=287)
TEINTE_CYPRES_CIBLE = (46, 43, 36)


def monde_vers_blender(point, angle=ANGLE_MONDE3, centre=CENTRE_MONDE):
    """Repère d'une salle (sculpt.Set(angle, centre)) → repère Blender de la scène."""
    x, y, z = point
    a = math.radians(angle); y += centre
    return (math.cos(a) * x + math.sin(a) * y, -math.sin(a) * x + math.cos(a) * y, z)


def blender_vers_monde(point, angle=ANGLE_MONDE3, centre=CENTRE_MONDE):
    """Inverse de monde_vers_blender."""
    x, y, z = point
    a = math.radians(angle)
    return (math.cos(a) * x - math.sin(a) * y, math.sin(a) * x + math.cos(a) * y - centre, z)


def pied_sur_le_cirque(x_pixel):
    """Point du sol, repère Blender, où le rayon de la colonne x_pixel coupe la couronne du cirque (côté fond).

    Si le rayon passe à côté de la couronne (cyprès isolé au bout de la rangée), le point de la couronne le
    plus proche du rayon.
    """
    dx, dy = (x_pixel - LARGEUR / 2) / FOCALE, 1.0
    cx, cy, _ = monde_vers_blender((0, 0, 0))
    ox, oy = CAMERA[0] - cx, CAMERA[1] - cy
    a, b, c = dx * dx + dy * dy, 2 * (ox * dx + oy * dy), ox * ox + oy * oy - RAYON_CIRQUE3 ** 2
    delta = b * b - 4 * a * c
    if delta >= 0:
        t = (-b + math.sqrt(delta)) / (2 * a)
        return (CAMERA[0] + t * dx, CAMERA[1] + t * dy, 0.0)
    t = -b / (2 * a)
    px, py = ox + t * dx, oy + t * dy
    k = RAYON_CIRQUE3 / math.hypot(px, py)
    return (cx + px * k, cy + py * k, 0.0)


def cypres_monde3(nombre=29):
    """Cyprès du lointain, repère de la salle : (x, y, hauteur, rayon).

    Dans le cadre de départ, un cyprès par pointe relevée : le pied est le point de la couronne des orgues vu
    à cette abscisse, la hauteur met la pointe à l'ordonnée relevée. Hors cadre, la rangée continue aux angles
    des orgues (interiors.enclosure), avec une hauteur de rangée ordinaire.
    """
    arbres = []
    for k, (px, py) in enumerate(PICS_CYPRES):
        pied = pied_sur_le_cirque(px)
        hauteur = CAMERA[2] + (HAUTEUR / 2 - py) * (pied[1] - CAMERA[1]) / FOCALE
        x, y, _ = blender_vers_monde(pied)
        arbres.append((x, y, hauteur, .70 + .08 * math.sin(k * 2.3)))
    for j in range(nombre):
        a = -.42 + (math.pi + .84) * j / (nombre - 1)
        x, y = RAYON_CIRQUE3 * math.cos(a), RAYON_CIRQUE3 * math.sin(a)
        if projeter(monde_vers_blender((x, y, 0)))[0] > PICS_CYPRES[0][0] - 20: continue
        arbres.append((x, y, 5.2 + .6 * math.sin(j * 1.7), .70 + .08 * math.sin(j * 2.3)))
    return arbres


def profil_cypres(t):
    """Rayon relatif d'un cyprès à la hauteur relative t : pied étroit, ventre bas, pointe effilée."""
    return math.sin(math.pi * t ** .58) ** .85 if 0 < t < 1 else 0.0


def rangees_cypres(x, y, hauteur, rayon, graine=0, anneaux=11, secteurs=12):
    """Maillage d'un cyprès (rangées du pied à la pointe), feuillage irrégulier sans bruit Blender."""
    rows = []
    for i in range(anneaux + 1):
        t = i / anneaux
        row = []
        for k in range(secteurs + 1):
            phi = -TAU_ * (k % secteurs) / secteurs
            r = rayon * profil_cypres(t) * (1 + .13 * math.sin(5 * phi + 9 * t + graine) + .07 * math.sin(17 * t + 2 * phi + graine * 1.3))
            row.append((x + r * math.cos(phi), y + r * math.sin(phi), .02 + hauteur * t))
        rows.append(row)
    return rows


def lanterne_monde3():
    """Globe de la lanterne, repère de la salle : centre (x, y, z) et rayon, relevés sur la cible."""
    centre = monde_vers_blender((*RELIQUE3, 0))
    metre_par_pixel = (centre[1] - CAMERA[1]) / FOCALE
    return dict(centre=(*RELIQUE3, CAMERA[2] + (HAUTEUR / 2 - LANTERNE_CIBLE['y']) * metre_par_pixel),
                rayon=LANTERNE_CIBLE['rayon'] * metre_par_pixel,
                sommet=CAMERA[2] + (HAUTEUR / 2 - LANTERNE_CIBLE['sommet']) * metre_par_pixel)


def tiges_lanterne(nombre=9, pas=14):
    """Cage en flamme autour du globe : fibres moyennes des tiges dorées, repère de la salle."""
    globe = lanterne_monde3()
    cx, cy, _ = globe['centre']
    tiges = []
    for k in range(nombre):
        points = []
        for i in range(pas + 1):
            t = i / pas
            phi = TAU_ * k / nombre + .55 * t
            r = 1.30 * globe['rayon'] * math.sin(math.pi * t ** .55) ** .9 + .04
            points.append((cx + r * math.cos(phi), cy + r * math.sin(phi), .10 + (globe['sommet'] - .10) * t))
        tiges.append(points)
    return tiges


TAU_ = math.tau


# ── Chaussées : seuils des passages et chemin d'arrivée au ras de la terrasse ──────────────────────────
# La cible montre un sol continu, de la même pierre que la terrasse, sans marche ni dalles bombées. Chaque
# chaussée est une seule nappe : dessus plan à z = 0, rives arrondies, départ glissé sous la terrasse le long
# du cercle où celle-ci commence à plonger. Emprise au sol inchangée (collisions : build.navigation, analytique).
RIVE_TERRASSE = 11 * .98               # fin du dessus plan de 'Terrasse centrale' (ground(hub, …, 11))
RIVE_SOCLE = CENTRE_MONDE - 9.25 * .98 # début du dessus plan d'un 'Socle du monde', sur l'axe du passage
ARRONDI = .035                         # rayon de l'arête adoucie (m)
EPAISSEUR = .34                        # épaisseur d'origine des dalles
LEVER_SEUIL = .004                     # la chaussée passe 4 mm au-dessus du socle : ni marche ni scintillement
PAS_JOINT = 2.82                       # joints fins tracés par le jeu (atmosphere.js), un toutes les 3 dalles


def chaussee(fin, demi_largeur=lambda s: 2.5, seuil=None, pas=.94, colonnes=12):
    """Nappe d'une chaussée : (rangées, UV). s court depuis le centre de la clairière, x en travers.

    Rangées de la terrasse vers `fin` (repère (x, s, z)) ; colonnes de −x à +x : la face regarde vers le haut.
    `seuil` : abscisse où commence le socle d'un monde ; la chaussée s'y lève de LEVER_SEUIL.
    """
    def lever(s):
        if seuil is None: return 0.0
        u = max(0.0, min(1.0, (s - (seuil - .60)) / .50))
        return LEVER_SEUIL * u * u * (3 - 2 * u)

    def profil(w):
        bord = [(-w, -EPAISSEUR), (-w, -ARRONDI), (-w + ARRONDI * .293, -ARRONDI * .293), (-w + ARRONDI, 0.0)]
        plat = w - ARRONDI - .06
        dessus = [(-plat + 2 * plat * k / colonnes, 0.0) for k in range(colonnes + 1)]
        return bord + dessus + [(-x, z) for x, z in reversed(bord)]

    def developpe(w, x, z):
        return math.copysign(abs(x) + (0.0 if z == 0 else -z), x) if abs(x) < w - ARRONDI else math.copysign(w - z, x)

    rows, uvs = [], []
    def rangee(points):
        rows.append([(x, s, z) for x, s, z, _ in points]); uvs.append([(u * .38, s * .38) for x, s, z, u in points])

    # Départ : sous la terrasse (−2 cm), puis à fleur juste au-delà du cercle où son dessus plan s'arrête.
    w = demi_largeur(RIVE_TERRASSE)
    for rayon, dz in [(RIVE_TERRASSE - .18, -.02), (RIVE_TERRASSE + .01, 0.0)]:
        rangee([(x, math.sqrt(rayon * rayon - x * x), z + dz, developpe(w, x, z)) for x, z in profil(w)])
    stations = []
    s = RIVE_TERRASSE + .30
    while s < fin - .30: stations.append(s); s += pas
    if seuil is not None: stations += [seuil - .60, seuil - .10]
    for s in sorted(stations) + [fin - ARRONDI]:
        w = demi_largeur(s)
        rangee([(x, s, z + lever(s), developpe(w, x, z)) for x, z in profil(w)])
    # Bout arrondi, puis chant vertical.
    w = demi_largeur(fin); haut = lever(fin)
    for ds, dz in [(ARRONDI * .707, ARRONDI * .293), (ARRONDI, ARRONDI)]:
        rangee([(x, fin - ARRONDI + ds, min(z, -dz) + haut, developpe(w, x, z)) for x, z in profil(w)])
    rangee([(x * .998, fin - .004, -EPAISSEUR, developpe(w, x, z)) for x, z in profil(w)])
    return rows, uvs


def largeur_arrivee(s):
    """Demi-largeur du chemin d'arrivée : l'enveloppe des anciennes dalles de travertin, lissée."""
    return (5.9 + .23 * math.sin((55.5 - s) / .92 / 3)) / 2
