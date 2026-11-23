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
