"""Raccord de la clairière avec la fin du survol, sans Blender :  python3 -B art/outils/test-raccord-arche.py

Projette l'arche centrale et le voile du monde 4 avec la caméra de départ du jeu (Three.js (0, 1,62, 1,8),
regard −Z, champ vertical 63°, 1280×720) et compare aux pixels relevés sur plateforme-libre.jpg. Vérifie
aussi que la largeur jouable sous l'arche (grille de build.navigation) ne diminue pas.
"""
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'blender'))
import raccord_geometrie as r

echecs = []
def verifier(nom, condition, detail=''):
    print(('ok    ' if condition else 'ÉCHEC ') + nom + (f' · {detail}' if detail else ''))
    if not condition: echecs.append(nom)

# ── Arche centrale : pixels relevés sur la cible (fibre moyenne du tube) ────────────────────────────────
SOMMET = (638.7, 215.0)                    # tube de y = 207 à 223
PIEDS = (520.0, 757.5)                     # centres des pieds, base du tube vers y = 412
CENTRE_CIBLE = sum(PIEDS) / 2              # 638,75 : la cible est décalée de −1,25 px par rapport au jeu
FLANCS = [(225, 38.0), (255, 73.5), (285, 92.5), (320, 108.5), (350, 114.0)]   # (y, demi-écart des fibres en px)

pts = r.arc(r.ARC_CENTRE)
px = [r.projeter(p) for p in pts]
sommet = min(px, key=lambda p: p[1])
verifier('sommet de l’arche centrale', abs(sommet[1] - SOMMET[1]) <= 2 and abs(sommet[0] - 640) <= .5,
         f'jeu ({sommet[0]:.1f}, {sommet[1]:.1f}) px · cible ({SOMMET[0]}, {SOMMET[1]})')
haut_tube = r.projeter((0, r.DISTANCE_ARCHE, r.BASE_ARC + r.ARC_CENTRE['fleche'] + r.ARC_CENTRE['rayon']))[1]
verifier('dessus du tube au sommet', abs(haut_tube - 207) <= 2.5, f'jeu y = {haut_tube:.1f} · cible 207')
gauche, droite = px[-1], px[0]
demi = (PIEDS[1] - PIEDS[0]) / 2
verifier('pieds de l’arche centrale', abs((droite[0] - gauche[0]) / 2 - demi) <= 2,
         f'jeu x = {gauche[0]:.1f} et {droite[0]:.1f} (demi-portée {(droite[0] - gauche[0]) / 2:.1f} px) · '
         f'cible {PIEDS[0]} et {PIEDS[1]} (demi-portée {demi:.2f} px)')
sol = r.projeter((r.ARC_CENTRE['portee'], r.DISTANCE_ARCHE, 0))[1]
verifier('pieds posés au sol', abs(sol - 412) <= 8, f'jeu y = {sol:.1f} · cible ≈ 412 (écart de ligne d’horizon, non corrigé)')
epaisseur = 2 * r.ARC_CENTRE['rayon'] * r.FOCALE / (r.DISTANCE_ARCHE - r.CAMERA[1])
verifier('épaisseur du tube', 14 <= epaisseur <= 17, f'{epaisseur:.1f} px · cible 15 à 16')
for y, attendu in FLANCS:
    moitie = [p for p in px[:len(px) // 2 + 1]]
    k = next(i for i in range(len(moitie) - 1) if moitie[i][1] >= y >= moitie[i + 1][1])
    a, b = moitie[k], moitie[k + 1]
    x = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) - 640
    verifier(f'flanc à y = {y}', abs(x - attendu) <= 4, f'demi-écart jeu {x:.1f} px · cible {attendu}')

avant = [r.projeter(p) for p in r.arc(r.ARC)]
print(f'      avant : sommet y = {min(p[1] for p in avant):.1f}, pieds x = {avant[-1][0]:.1f} et {avant[0][0]:.1f}')

# ── Largeur jouable sous l'arche : mêmes règles que build.navigation() pour le passage 4 ─────────────────
def jouables(spec):
    """Abscisses de la grille (pas 0,32 depuis −44) ouvertes à la marche dans le plan de l'arche."""
    fibre = r.arc(spec, pas=256)
    ouvertes = []
    for i in range(277):
        x = -44 + i * .32
        if abs(x) >= 2.38: continue                            # couloir du passage : |latéral| < 2,38
        libre = True
        for cx, _, cz in fibre:                                # tube dans le plan y = 14,4
            # rayon vertical de 0,32 à 2,08 m, puis rayons horizontaux de 0,24 m à 1,14 m de haut
            if abs(cx - x) <= spec['rayon'] and cz - spec['rayon'] <= 2.08: libre = False
            if abs(cz - 1.14) <= spec['rayon'] and abs(cx - x) <= .24 + spec['rayon']: libre = False
        if libre: ouvertes.append(round(x, 2))
    return ouvertes

avant_l, apres_l = jouables(r.ARC), jouables(r.ARC_CENTRE)
verifier('largeur jouable sous l’arche inchangée', apres_l == avant_l and len(apres_l) == 14,
         f'{len(apres_l)} colonnes de {apres_l[0]} à {apres_l[-1]} m (avant : {len(avant_l)})')
nu = lambda spec: min(abs(x) for x, _, z in r.arc(spec, pas=512) if z <= 2.08) - spec['rayon']
verifier('passage libre plus large sous 2,08 m', nu(r.ARC_CENTRE) > nu(r.ARC) > 2.08 + .24,
         f'bord intérieur du tube à {nu(r.ARC_CENTRE):.2f} m de l’axe (avant {nu(r.ARC):.2f}) · dernière colonne 2,08 m + rayon 0,24 m')

# ── Voile du monde 4 ────────────────────────────────────────────────────────────────────────────────────
rows, uvs = r.voile()
monde = lambda p: (p[0], p[1] + r.CENTRE_MONDE, p[2])
ecran = [[r.projeter(monde(p)) for p in row] for row in rows]
pg, pd = ecran[0][0], ecran[-1][0]
verifier('pointes du voile', math.dist(pg, (445, 270)) <= 1.5 and math.dist(pd, (828, 261)) <= 1.5,
         f'jeu ({pg[0]:.0f}, {pg[1]:.0f}) et ({pd[0]:.0f}, {pd[1]:.0f}) · cible (445, 270) et (828, 261)')
verifier('pointes soudées', all(math.dist(p, rows[0][0]) < 1e-6 for p in rows[0]) and all(math.dist(p, rows[-1][0]) < 1e-6 for p in rows[-1]))
pied_g, pied_d = gauche[0], droite[0]
verifier('le voile dépasse de part et d’autre de l’arche', pg[0] < pied_g - 40 and pd[0] > pied_d + 40,
         f'{pied_g - pg[0]:.0f} px à gauche, {pd[0] - pied_d:.0f} px à droite')
pire = 0
for x, haut, bas in r.LISIERES[1:-1]:
    k = min(range(len(ecran)), key=lambda i: abs(ecran[i][-1][0] - x))
    pire = max(pire, abs(ecran[k][-1][1] - haut), abs(ecran[k][0][1] - min(bas, 348.5)))
verifier('lisières du voile', pire <= 4, f'écart maximal {pire:.1f} px (bord bas borné à y ≈ 348 par la garde de 2,30 m)')
zmin = min(p[2] for row in rows for p in row)
for _, bande, _ in r.ourlets(): zmin = min(zmin, min(p[2] for row in bande for p in row))
verifier('le voile reste au-dessus des rayons de marche (2,08 m)', zmin >= r.GARDE_BASSE - 1e-9, f'point le plus bas {zmin:.2f} m')
xs = [p[0] for row in rows for p in row]; ys = [p[1] for row in rows for p in row]; zs = [p[2] for row in rows for p in row]
print(f'      voile : x de {min(xs):.2f} à {max(xs):.2f} m, recul de {min(ys):.2f} à {max(ys):.2f} m, z de {min(zs):.2f} à {max(zs):.2f} m')
verifier('UV du bord libre', all(uv[0][1] == 0 and uv[-1][1] == 1 and 0 <= uv[0][0] <= 4 for uv in uvs))
plis = [abs(rows[i + 1][5][1] - rows[i][5][1]) for i in range(len(rows) - 1)]
verifier('ondulation douce', max(plis) < .35, f'pas de recul maximal entre sections {max(plis):.2f} m')

print('\n' + (f'{len(echecs)} échec(s) : ' + ', '.join(echecs) if echecs else 'raccord arche et voile : tout est vert'))
sys.exit(1 if echecs else 0)
