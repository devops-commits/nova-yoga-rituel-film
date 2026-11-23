"""Trajectoire du survol des sept entrées. Python pur : ni bpy ni numpy.

Repère Blender (mètres, Z vers le haut). Azimuts en degrés de boussole : 0 = +Y (nord,
l'horizon respirant), sens horaire vers +X, comme landscape.ANGLES.

La caméra est décrite par six canaux, chacun interpolé par une cubique monotone (PCHIP) :
vitesse continue partout, aucun dépassement, et un palier reste exactement immobile.
  phi   azimut de la caméra autour du centre         R  distance au centre (sol)
  H     hauteur de l'œil                             delta  écart du cap par rapport au centre
  theta inclinaison sous l'horizon                   f  focale (capteur 36 × 20,25 mm)
Le cap vaut phi + 180 − delta : delta = 0 vise le centre, delta = 180 regarde vers l'extérieur.
Tout le film tourne dans le même sens (horaire), du bol jusqu'à l'axe de l'arche nord.
"""
import math

FPS = 24
IMAGES = 264
DUREE = IMAGES / FPS
CAPTEUR_H = 20.25                       # 36 mm de large en 16:9, mise au point verticale
FORMAT = 16 / 9
ANGLES = [-135, -90, -45, 0, 45, 90, 135]   # landscape.ANGLES
RAYON_MONDE, CENTRE_MONDE = 9.25, 33.0      # landscape.passage : Set(…, a, 33) et ground(…, 9.25)
EXTREMITES = [((CENTRE_MONDE + RAYON_MONDE) * math.sin(math.radians(a)),
               (CENTRE_MONDE + RAYON_MONDE) * math.cos(math.radians(a)), 0.0) for a in ANGLES]
DOUBLE_CERCLE = (3.8, 4.0)                  # landscape.round_inlay
BOL = dict(azimut=225.0, distance=35.0, rayon=1.18, levre=0.799)   # bowl.vessel : center_y 2 + monde 33
GALET_LOCAL = (1.55, 35.16, 0.205)          # build.relic(1) dans le repère du monde 1

# Pose de départ du jeu (engine.place) : Three.js (0, 1.62, 1.8), regard −Z, champ vertical 63°.
ARRIVEE = dict(position=(0.0, -1.8, 1.62), cap=0.0, inclinaison=0.0,
               focale=CAPTEUR_H / 2 / math.tan(math.radians(63 / 2)))
PALIER_ENSEMBLE = (52, 64)   # images 53 à 65 identiques (0-indexé : 52..64), couvre t = 2,2 s
PALIER_FINAL = 252           # images 253 à 264 identiques
IMAGES_CLES = [0, 1.2, 2.2, 3.2, 4.25, 5.3, 6.45, 7.6, 8.75, 9.9, 11]


def base(cap, inclinaison):
    """Avant, droite, haut pour un cap de boussole et une inclinaison sous l'horizon (degrés)."""
    c, i = math.radians(cap), math.radians(inclinaison)
    avant = (math.sin(c) * math.cos(i), math.cos(c) * math.cos(i), -math.sin(i))
    droite = (math.cos(c), -math.sin(c), 0.0)
    haut = (math.sin(c) * math.sin(i), math.cos(c) * math.sin(i), math.cos(i))
    return avant, droite, haut


def projeter(pose, point, format_image=FORMAT):
    """Coordonnées normalisées (−1..1 = bords du cadre) et profondeur d'un point du monde."""
    avant, droite, haut = base(pose['cap'], pose['inclinaison'])
    d = [point[k] - pose['position'][k] for k in range(3)]
    z = sum(a * b for a, b in zip(d, avant))
    if z <= 1e-9:
        return (math.inf, math.inf, z)
    demi = CAPTEUR_H / 2 / pose['focale']
    return (sum(a * b for a, b in zip(d, droite)) / z / (demi * format_image),
            sum(a * b for a, b in zip(d, haut)) / z / demi, z)


def _plan_ensemble(focale=34.0, inclinaison=80.0, marge=0.8):
    """Hauteur minimale et recul pour tenir les sept extrémités dans les 80 % centraux, nord en haut."""
    def debord(y, h):
        pose = dict(position=(0.0, y, h), cap=0.0, inclinaison=inclinaison, focale=focale)
        return max(max(abs(u), abs(v)) for u, v, _ in (projeter(pose, p) for p in EXTREMITES))
    meilleur = None
    for pas in range(0, 801):
        y = -60 + pas * 0.1
        bas, haut = 40.0, 400.0
        if debord(y, haut) > marge:
            continue
        for _ in range(40):
            milieu = (bas + haut) / 2
            if debord(y, milieu) > marge: bas = milieu
            else: haut = milieu
        if meilleur is None or haut < meilleur[1]:
            meilleur = (y, haut)
    y, h = meilleur
    return round(-y, 2), math.ceil(h * 10) / 10 + 0.5     # demi-mètre de garde

R_ENSEMBLE, H_ENSEMBLE = _plan_ensemble()
_INCL_BOL = math.degrees(math.atan2(0.95 - 0.72, 7.5))
_INCL_LEVRE = math.degrees(math.atan2(1.12 - BOL['levre'], 2.6 - BOL['rayon']))

#        t (s)        phi    R            H            delta  theta        f
CLES = [
    (0.0,            225.0, 27.5,        0.95,        180.0, _INCL_BOL,   65.0),   # composition de la fin du film
    (1.2,            225.0, 32.4,        1.12,        180.0, _INCL_LEVRE, 65.0),   # la lèvre remplit l'image
    (52 / FPS,       180.0, R_ENSEMBLE,  H_ENSEMBLE,  0.0,   80.0,        34.0),   # plan d'ensemble
    (64 / FPS,       180.0, R_ENSEMBLE,  H_ENSEMBLE,  0.0,   80.0,        34.0),   # tenu 12 images
    (3.2,            184.0, R_ENSEMBLE + 1.2, H_ENSEMBLE - 7.0, 1.0, 78.4, 34.0),  # l'arc s'amorce
    (4.25,           226.0, 39.0,        47.0,        14.0,  56.0,        31.0),   # chambre des appuis
    (5.3,            285.0, 41.0,        19.0,        25.0,  40.0,        28.0),   # galerie des échos → sentier des lueurs
    (6.45,           345.0, 40.0,        17.0,        25.0,  40.0,        26.0),   # horizon respirant
    (7.6,            405.0, 39.0,        16.0,        25.0,  40.0,        24.0),   # atelier des traces ; courant et tissage au fond
    (8.75,           490.0, 21.0,        8.6,         12.0,  27.0,        20.2),   # sortie, visée du double cercle
    (9.4,            531.0, 8.2,         3.7,         3.0,   15.0,        17.6),   # la translation ralentit
    (9.9,            539.4, 2.7,         1.80,        0.4,   6.0,         16.7),
    (242 / FPS,      540.0, 1.8,         1.62,        0.0,   2.4,         ARRIVEE['focale']),  # translation finie
    (PALIER_FINAL / FPS, 540.0, 1.8,     1.62,        0.0,   0.0,         ARRIVEE['focale']),  # regard redressé
    (DUREE,          540.0, 1.8,         1.62,        0.0,   0.0,         ARRIVEE['focale']),
]
BATTEMENTS = [0, 1.2, 3.2, 5.3, 7.6, 9.9, 11]


def _pentes(ts, ys):
    """Tangentes de Fritsch–Carlson : monotones, nulles sur un palier ou un extremum."""
    n = len(ts)
    h = [ts[i + 1] - ts[i] for i in range(n - 1)]
    s = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [s[0]] + [0.0] * (n - 2) + [s[-1]]
    for i in range(1, n - 1):
        if s[i - 1] * s[i] > 0:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i])
    m[0] = 0.0   # départ et arrivée à vitesse nulle sur chaque canal
    m[-1] = 0.0
    return m

_T = [c[0] for c in CLES]
_Y = [[c[k] for c in CLES] for k in range(1, 7)]
_M = [_pentes(_T, y) for y in _Y]


def canaux(t):
    """(phi, R, H, delta, theta, f) à l'instant t, en secondes."""
    t = min(max(t, 0.0), DUREE)
    i = max(0, min(len(_T) - 2, next((k for k in range(len(_T) - 1) if t < _T[k + 1]), len(_T) - 2)))
    h = _T[i + 1] - _T[i]
    u = (t - _T[i]) / h
    h00, h10, h01, h11 = 2*u**3 - 3*u**2 + 1, u**3 - 2*u**2 + u, -2*u**3 + 3*u**2, u**3 - u**2
    return tuple(h00 * y[i] + h10 * h * m[i] + h01 * y[i + 1] + h11 * h * m[i + 1] for y, m in zip(_Y, _M))


def pose(t):
    """Pose caméra : position Blender, cap (boussole, déroulé), inclinaison sous l'horizon, focale."""
    if t >= PALIER_FINAL / FPS - 1e-9:      # valeurs exactes, sans résidu trigonométrique
        return dict(position=ARRIVEE['position'], cap=720.0, inclinaison=0.0, focale=ARRIVEE['focale'])
    phi, r, h, delta, theta, f = canaux(t)
    a = math.radians(phi)
    return dict(position=(r * math.sin(a), r * math.cos(a), h), cap=phi + 180.0 - delta, inclinaison=theta, focale=f)


def pose_image(n):
    """Pose de l'image n (1 à 264)."""
    return pose((n - 1) / FPS)


def euler_blender(p):
    """rotation_euler XYZ (radians) d'une caméra Blender (regard −Z, haut +Y), roulis nul."""
    return (math.radians(90.0 - p['inclinaison']), 0.0, -math.radians(p['cap']))


def point_devant(t, avant=4.0, droite=0.0, haut=0.0):
    """Point du monde placé dans le repère de la caméra à l'instant t (accessoires de premier plan)."""
    p = pose(t)
    a, d, h = base(p['cap'], p['inclinaison'])
    return tuple(p['position'][k] + avant * a[k] + droite * d[k] + haut * h[k] for k in range(3))


def monde(n, x=0.0, y=0.0, z=0.0, centre=CENTRE_MONDE):
    """Repère local du monde n → Blender, comme sculpt.Set.point."""
    a = math.radians(ANGLES[n - 1])
    y += centre
    return (math.cos(a) * x + math.sin(a) * y, -math.sin(a) * x + math.cos(a) * y, z)
