#!/usr/bin/env python3
"""Raccord du monde 3 et des chaussées avec la dernière image du survol, sans Blender.

  python3 art/outils/test-raccord-monde3.py

1. Silhouette vue de la clairière : cyprès projetés contre la crête mesurée dans la cible, lanterne contre son
   disque. 2. Chaussées : dessus au ras de la terrasse, sans ressaut, emprise d'origine. 3. Fondu du jeu :
   centre, complémentarité lointain / salle, matières réservées, lointain hors collisions.
"""
import math, re, sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RACINE / 'art/blender'))
import raccord_geometrie as g

echecs = []
def verifier(nom, ok, detail=''):
    print(('ok    ' if ok else 'ÉCHEC ') + nom + (f' — {detail}' if detail else ''))
    if not ok: echecs.append(nom)

# ── 1. Silhouette ──────────────────────────────────────────────────────────────────────────────────────
arbres = []
for j, (x, y, h, r) in enumerate(g.cypres_monde3()):
    pied = g.monde_vers_blender((x, y, 0)); px, py = g.projeter(pied)
    sommet = g.projeter((pied[0], pied[1], h + .02))[1]
    demi = r * g.FOCALE / (pied[1] - g.CAMERA[1])
    arbres.append((px, py, sommet, demi, h, r))
visibles = [a for a in arbres if 0 <= a[0] <= 345]
verifier('cyprès dans le cadre, sous l\'arche de gauche', len(visibles) >= 14, f'{len(visibles)} sur {len(arbres)}')
ecarts = []
for x, y in g.PICS_CYPRES:
    # Silhouette réelle : le cyprès couvre l'abscisse x là où son profil est assez large (± 5 px de relevé).
    proches = [a[1] + (a[2] - a[1]) * t / 40 for a in arbres for t in range(41) if abs(a[0] - x) <= a[3] * g.profil_cypres(t / 40) + 5]
    ecarts.append((x, y, round(min(proches)) if proches else None))
pire = max((abs(m - y) if m is not None else 99) for x, y, m in ecarts)
verifier('pointes des cyprès à moins de 4 px de la cible', pire <= 4, f'pire écart {pire:.0f} px ; (x, cible, jeu) = {ecarts}')
pieds = [a[1] for a in visibles]
verifier('pieds des cyprès sur la ligne de sol de la cible', all(abs(p - g.SOL_CIBLE3) <= 6 for p in pieds), f'y de {min(pieds):.0f} à {max(pieds):.0f} px, cible {g.SOL_CIBLE3}')
loin = [math.hypot(x, y) for x, y, h, r in g.cypres_monde3()]
verifier('cyprès sur la couronne des orgues', all(abs(d - g.RAYON_CIRQUE3) < 1e-6 for d in loin))
verifier('cyprès élancés', all(a[4] / (2 * a[5]) >= 2.5 for a in arbres), f'élancement mini {min(a[4] / (2 * a[5]) for a in arbres):.1f}, largeur {min(2 * a[3] for a in visibles):.0f} à {max(2 * a[3] for a in visibles):.0f} px (cible 25 à 32)')
pointe = g.rangees_cypres(0, 0, 5, .6)
verifier('cyprès fermé au pied et à la pointe', all(max(abs(p[0]), abs(p[1])) < 1e-9 for p in pointe[0] + pointe[-1]))

globe = g.lanterne_monde3()
centre = g.monde_vers_blender(globe['centre']); cx, cy = g.projeter(centre)
rayon_px = globe['rayon'] * g.FOCALE / (centre[1] - g.CAMERA[1])
c = g.LANTERNE_CIBLE
verifier('lanterne sur son disque dans la cible', abs(cx - c['x']) <= 6 and abs(cy - c['y']) <= 2 and abs(rayon_px - c['rayon']) <= 1,
         f'jeu ({cx:.0f}, {cy:.0f}) r {rayon_px:.1f} px ; cible ({c["x"]}, {c["y"]}) r {c["rayon"]} px ; globe r {globe["rayon"]:.2f} m à z {globe["centre"][2]:.2f} m')
# Relique « Cœur incandescent » (build.relic, n = 3) : cinq roches à 0,21 m de l'axe, z de 0,86 à 1,14, rayons ≤ 0,42 × 1,21.
verifier('la lanterne enveloppe la relique', globe['centre'][2] - globe['rayon'] < .86 - .42 and globe['centre'][2] + globe['rayon'] > 1.14 + .42 * 1.21 and globe['rayon'] > .21 + .27 * 1.21)
tiges = g.tiges_lanterne()
haut = g.projeter(g.monde_vers_blender(tiges[0][-1]))[1]
verifier('cage de tiges jusqu\'au sommet relevé', abs(haut - c['sommet']) <= 3, f'y {haut:.0f} px, cible {c["sommet"]}')

# ── 2. Chaussées ───────────────────────────────────────────────────────────────────────────────────────
def controle(nom, fin, largeur, seuil, attendu):
    rows, uvs = g.chaussee(fin, largeur, seuil)
    dessus = [k for k, (x, s, z) in enumerate(rows[2]) if z == 0 or (seuil and abs(z) < 1e-9)]
    plat = [(s, z) for row in rows[1:-4] for k in dessus for (x, s, z) in [row[k]]]
    zmax, zmin = max(z for s, z in plat), min(z for s, z in plat)
    verifier(f'{nom} : dessus au ras de la terrasse', zmin == 0 and zmax <= g.LEVER_SEUIL + 1e-9, f'z de {zmin * 1000:.1f} à {zmax * 1000:.1f} mm')
    ressaut = max(abs(a[k][2] - b[k][2]) for a, b in zip(rows[1:-4], rows[2:-3]) for k in dessus)
    verifier(f'{nom} : pas de ressaut', ressaut <= .004 + 1e-9, f'plus grand écart entre deux rangées {ressaut * 1000:.1f} mm')
    depart = [math.hypot(x, s) for k in dessus for (x, s, z) in [rows[1][k]]]
    verifier(f'{nom} : départ sur la rive de la terrasse', all(g.RIVE_TERRASSE < r <= g.RIVE_TERRASSE + .011 for r in depart) and all(z < 0 for x, s, z in rows[0]),
             f'rayon {min(depart):.3f} à {max(depart):.3f} m (dessus plan de la terrasse jusqu\'à {g.RIVE_TERRASSE:.2f}), première rangée glissée dessous')
    largeurs = [row[-1][0] - row[0][0] for row in rows[1:-1]]
    verifier(f'{nom} : emprise d\'origine', attendu[0] - 1e-6 <= min(largeurs) and max(largeurs) <= attendu[1] + 1e-6 and abs(max(s for x, s, z in rows[-2]) - fin) < 1e-6,
             f'largeur {min(largeurs):.2f} à {max(largeurs):.2f} m, bout à {fin} m')
    haut = True
    for a, b in zip(rows[1:-4], rows[2:-3]):
        for k in dessus[:-1]:
            u = [a[k + 1][i] - a[k][i] for i in range(3)]; v = [b[k + 1][i] - a[k + 1][i] for i in range(3)]
            haut &= u[0] * v[1] - u[1] * v[0] > 0
    verifier(f'{nom} : faces vers le haut, UV complets', haut and all(len(r) == len(u) for r, u in zip(rows, uvs)))
    arete = rows[5][:4]
    verifier(f'{nom} : arêtes adoucies', arete[1][2] == -g.ARRONDI and arete[3][2] == 0 and 0 < arete[3][0] - arete[1][0] <= g.ARRONDI + 1e-9, f'arrondi de {g.ARRONDI * 1000:.0f} mm')

controle('seuil des passages', 25.51, lambda s: 2.5, g.RIVE_SOCLE, (5.0, 5.0))
controle('chemin d\'arrivée', 44.91, g.largeur_arrivee, None, (5.67, 6.13))
verifier('largeur jouable inchangée (build.navigation : |latéral| < 2,38 sur 9 < d < 26,6)', 2.5 - g.ARRONDI - .06 > 2.38)

# ── 3. Sources du jeu et de la scène ───────────────────────────────────────────────────────────────────
js = (RACINE / 'public/experience/exploration/atmosphere.js').read_text()
m = re.search(r'FONDU_MONDE3=\{centre:\[([-\d.]+),([-\d.]+)\],plein:([\d.]+),nul:([\d.]+)\}', js)
salle = g.monde_vers_blender((0, 0, 0))
verifier('FONDU_MONDE3 centré sur la salle', bool(m) and abs(float(m[1]) - salle[0]) < .02 and abs(float(m[2]) + salle[1]) < .02, m and m[0])
m4 = re.search(r'FONDU_MONDE4=\{centre:\[0,-33\],plein:([\d.]+),nul:([\d.]+)\}', js)
verifier('mêmes distances que FONDU_MONDE4', bool(m and m4) and (m[3], m[4]) == (m4[1], m4[2]))
verifier('fondu complémentaire, même trame', "'if(fond3>trame3)discard;':'if(fond3<.999&&fond3<=trame3)discard;'" in js and js.count('52.9829189') == 2)
verifier('matières du fondu', "LOINTAIN_3=['cypres','lanterne','jonc'],SALLE_3=['orgue']" in js and "'ink','orgue','silk'" in js)
interieurs = (RACINE / 'art/blender/interiors.py').read_text(); scene = (RACINE / 'art/blender/build.py').read_text()
verifier('orgues en matière réservée, identique à ink', "'orgue',j+40)" in interieurs and "orgue=palette['ink']" in scene)
verifier('foyer de schiste, sutures et relique conservés', "g.rock('Foyer de schiste',(0,2,.13),(1.2,.90,.36),'ink',14)" in interieurs and "g.tube('Suture de feu'" in interieurs and "g.rock('Cœur incandescent'" in scene)
verifier('lointain hors collisions et hors ombres au sol', "SANS_COLLISION={'cypres','lanterne','jonc'}" in scene and 'in SANS_COLLISION: continue' in scene)

print('\n' + (f'{len(echecs)} échec(s)' if echecs else 'Tout est conforme.'))
sys.exit(1 if echecs else 0)
