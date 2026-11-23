"""Tests de la trajectoire du survol, sans Blender :  python3 -B art/outils/test-survol.py"""
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'blender'))
import survol_trajet as s

echecs = []
def verifier(nom, condition, detail=''):
    print(('ok    ' if condition else 'ÉCHEC ') + nom + (f' · {detail}' if detail else ''))
    if not condition: echecs.append(nom)

def etat(t):
    p = s.pose(t)
    return (*p['position'], p['cap'], p['inclinaison'], p['focale'])

# 1. Continuité de position et de vitesse (position, cap, inclinaison, focale), y compris aux clés.
PAS = 1 / 2400
N = round(s.DUREE / PAS)
etats = [etat(k * PAS) for k in range(N + 1)]
vitesses = [[(b[i] - a[i]) / PAS for i in range(6)] for a, b in zip(etats, etats[1:])]
pas_max = max(math.dist(a[:3], b[:3]) for a, b in zip(etats, etats[1:]))
v_max = max(math.hypot(*v[:3]) for v in vitesses)
verifier('position continue', pas_max <= v_max * PAS * 1.001 and pas_max < .12, f'pas max {pas_max*100:.1f} cm à 2400 Hz, vitesse max {v_max:.0f} m/s')
# Une cassure de vitesse serait un saut entre deux pas voisins ; une courbe lisse donne un saut en a·dt.
saut = max(math.dist(u[:3], v[:3]) for u, v in zip(vitesses, vitesses[1:]))
acc = saut / PAS
verifier('vitesse continue (position)', saut < .012 * v_max, f'saut max {saut:.3f} m/s entre deux pas (accélération max {acc:.0f} m/s²)')
saut_angle = max(max(abs(u[3] - v[3]), abs(u[4] - v[4])) for u, v in zip(vitesses, vitesses[1:]))
verifier('vitesse continue (cap, inclinaison)', saut_angle < 1.5, f'saut max {saut_angle:.2f} °/s')
for cle in s.BATTEMENTS[1:-1] + [52 / 24, 64 / 24, 242 / 24, 252 / 24]:
    e = 1e-5
    gauche = [(a - b) / e for a, b in zip(etat(cle), etat(cle - e))]
    droite = [(a - b) / e for a, b in zip(etat(cle + e), etat(cle))]
    ecart = math.dist(gauche[:3], droite[:3]); ecart_angle = max(abs(gauche[i] - droite[i]) for i in (3, 4, 5))
    verifier(f'pas de cassure à {cle:.2f} s', ecart < .02 + .002 * math.hypot(*gauche[:3]) and ecart_angle < .05,
             f'Δv {ecart:.4f} m/s, Δω {ecart_angle:.4f} °/s, vitesse {math.hypot(*gauche[:3]):.1f} m/s')

# 2. Pose finale exacte et arrêt de 12 images.
fin = [s.pose_image(n) for n in range(253, 265)]
verifier('12 dernières images identiques', all(p == fin[0] for p in fin))
verifier('pose finale = départ du jeu', fin[0]['position'] == (0.0, -1.8, 1.62) and fin[0]['cap'] % 360 == 0 and fin[0]['inclinaison'] == 0,
         f"Blender {fin[0]['position']} → Three.js ({fin[0]['position'][0]}, {fin[0]['position'][2]}, {-fin[0]['position'][1]}), regard −Z")
champ = 2 * math.degrees(math.atan(s.CAPTEUR_H / 2 / fin[0]['focale']))
verifier('champ vertical 63°', abs(champ - 63) < 1e-9, f'{champ:.6f}° (focale {fin[0]["focale"]:.4f} mm, capteur vertical {s.CAPTEUR_H} mm)')
avant = etat(252 / 24 - 1e-6)
verifier('arrivée sans à-coup', math.dist(avant[:3], fin[0]['position']) < 1e-6 and abs(avant[4]) < 1e-4 and abs(avant[3] - 720) < 1e-4)
rx, _, rz = s.euler_blender(fin[0])
verifier('euler Blender de la pose finale', abs(rx - math.pi / 2) < 1e-12 and abs(rz % math.tau) < 1e-9, f'rotation_euler ({math.degrees(rx):.1f}°, 0, {math.degrees(rz):.0f}°)')
for t in (0, 1.2, 2.2, 4.25, 6.45, 8.75):   # l'euler XYZ (regard −Z) redonne bien le vecteur avant
    p = s.pose(t); x, _, z = s.euler_blender(p)
    v = (0, math.sin(x) * -1 * -1 * 0 + math.sin(x), -math.cos(x))                      # Rx appliqué à (0, 0, −1)
    v = (math.cos(z) * v[0] - math.sin(z) * v[1], math.sin(z) * v[0] + math.cos(z) * v[1], v[2])   # puis Rz
    if math.dist(v, s.base(p['cap'], p['inclinaison'])[0]) > 1e-9: echecs.append(f'euler {t}'); print('ÉCHEC euler', t)
verifier('euler ↔ vecteur avant', not any(e.startswith('euler') for e in echecs))
verifier('translation finie avant le redressement', s.pose(242 / 24)['position'] == s.pose(10.4)['position'][:3] or
         (math.dist(s.pose(242 / 24)['position'], (0, -1.8, 1.62)) < 1e-9 and s.pose(242 / 24)['inclinaison'] > 2), f"à 10,08 s : inclinaison {s.pose(242/24)['inclinaison']:.1f}°")

# 3. Plan d'ensemble : tenu 12 images, sept extrémités dans les 80 % centraux à 2,2 s.
palier = [s.pose_image(n) for n in range(53, 66)]
verifier('plan d’ensemble tenu (images 53 à 65)', all(p == palier[0] for p in palier), f"{len(palier)} images, inclinaison {palier[0]['inclinaison']}°, {palier[0]['focale']} mm")
p22 = s.pose(2.2)
ext = [s.projeter(p22, e) for e in s.EXTREMITES]
verifier('7 extrémités dans les 80 % centraux à 2,2 s', all(max(abs(u), abs(v)) <= .8 + 1e-9 and z > 0 for u, v, z in ext),
         'max ' + ' '.join(f'{max(abs(u), abs(v)):.2f}' for u, v, _ in ext) + f" · caméra {tuple(round(c, 1) for c in p22['position'])}")
bords = [s.projeter(p22, (x + s.RAYON_MONDE * math.cos(a), y + s.RAYON_MONDE * math.sin(a), 0))
         for (x, y, _) in [s.monde(n) for n in range(1, 8)] for a in [k * math.tau / 24 for k in range(24)]]
verifier('les sept mondes entiers dans le cadre', all(max(abs(u), abs(v)) <= 1 for u, v, _ in bords), f'max {max(max(abs(u), abs(v)) for u, v, _ in bords):.2f}')
chemin, centre = s.projeter(p22, (0, -40, 0)), s.projeter(p22, (0, 0, 0))
verifier('chemin d’arrivée en bas, double cercle au centre', chemin[1] < -.5 and abs(chemin[0]) < .01 and abs(centre[0]) < .01 and abs(centre[1]) < .2,
         f'chemin y={chemin[1]:.2f}, centre y={centre[1]:.2f}')

# 4. Départ : composition de la fin du film.
p0, p12 = s.pose(0), s.pose(1.2)
bol, galet = s.projeter(p0, s.monde(1, 0, 2, .6)), s.projeter(p0, s.monde(1, 1.55, 2.16, .2))
verifier('bol au centre, galet à droite, caméra à hauteur d’objet', abs(bol[0]) < .01 and abs(bol[1]) < .3 and .4 < galet[0] < .95 and .7 < p0['position'][2] < 1.3,
         f"bol ({bol[0]:.2f}, {bol[1]:.2f}), galet ({galet[0]:.2f}, {galet[1]:.2f}), œil à {p0['position'][2]} m, 65 mm")
galet12 = s.projeter(p12, s.monde(1, 1.55, 2.16, .2))
levres = [s.projeter(p12, s.monde(1, s.BOL['rayon'] * math.sin(a), 2 - s.BOL['rayon'] * math.cos(a), s.BOL['levre'])) for a in (-.9, 0, .9)]
verifier('à 1,2 s le galet est sorti à droite, la lèvre remplit l’image', galet12[0] > 1 and abs(levres[1][1]) < .15 and levres[0][0] < -1 and levres[2][0] > 1,
         f'galet x={galet12[0]:.2f}, lèvre de x={levres[0][0]:.2f} à x={levres[2][0]:.2f}')
verifier('65 mm jusqu’à 1,2 s, 34 mm au plan d’ensemble', all(abs(s.pose(t)['focale'] - 65) < 1e-9 for t in (0, .4, .8, 1.2)) and p22['focale'] == 34)

# 5. Arcs : même sens, 40°, centre au second plan, ordre des mondes.
caps = [e[3] for e in etats]
verifier('rotation toujours dans le même sens', all(b >= a - 1e-9 for a, b in zip(caps, caps[1:])), f'cap {caps[0]:.0f}° → {caps[-1]:.0f}°')
incl = [s.pose(5.3 + k * .05)['inclinaison'] for k in range(47)]
verifier('40° sous l’horizon de 5,3 à 7,6 s', max(abs(i - 40) for i in incl) < .5)
def azimut(t): return math.degrees(math.atan2(s.pose(t)['position'][0], s.pose(t)['position'][1])) % 360
ordre = [(n, next(k * .01 for k in range(320, 1000) if (azimut(k * .01) - s.ANGLES[n - 1]) % 360 < 4)) for n in range(1, 8)]
verifier('mondes survolés dans l’ordre 1 → 7', [n for n, _ in sorted(ordre, key=lambda o: o[1])] == list(range(1, 8)),
         ' '.join(f'{n}:{t:.2f}s' for n, t in ordre))
verifier('arc 3,2–5,3 s : chambre des appuis → sentier des lueurs', ordre[0][1] < 4.6 and 3.2 < ordre[1][1] < 5.3 and ordre[2][1] > 5.3 and ordre[3][1] < 7.6 and ordre[4][1] <= 7.61)
visibles = [max(abs(c) for c in s.projeter(s.pose(4.25 + k * .05), (0, 0, 0))[:2]) for k in range(114)]
verifier('double cercle dans le cadre de 4,25 à 9,9 s', max(visibles) < 1, f'excentrement max {max(visibles):.2f}')
decentre = [abs(s.projeter(s.pose(5.3 + k * .1), (0, 0, 0))[0]) for k in range(24)]
verifier('sujet décentré pendant les arcs', min(decentre) > .3, f'centre à {min(decentre):.2f}–{max(decentre):.2f} du milieu')

# 6. Garde au sol et ralentissement final.
hauteurs = [(k * PAS, e[2], math.hypot(e[0], e[1])) for k, e in enumerate(etats)]
verifier('jamais sous 0,9 m', min(h for _, h, _ in hauteurs) >= .9)
def dans_une_arche(e):   # landscape.passage : arc de 2,8 m de rayon à 14,4 m, plus la chaussée et ses voiles de film (3,6 m)
    for a in s.ANGLES:
        sx, sy = math.sin(math.radians(a)), math.cos(math.radians(a))
        if 13.4 < e[0] * sx + e[1] * sy < 15.6 and abs(e[0] * sy - e[1] * sx) < 3.3 and e[2] < 5.4: return True
    return e[1] < -8.5 and abs(e[0]) < 7.5 and e[2] < 3.9 and math.hypot(e[0], e[1]) > 11
apres = [e for k, e in enumerate(etats) if k * PAS > 2]
verifier('aucune arche ni voile de la chaussée traversé après la montée', not any(dans_une_arche(e) for e in apres),
         f"hauteur min hors de la clairière {min(e[2] for e in apres if math.hypot(e[0], e[1]) > 11.5):.1f} m")
def vitesse(t): return math.dist(s.pose(t + 1e-3)['position'], s.pose(t - 1e-3)['position']) / 2e-3
verifier('la translation ralentit avant le redressement', vitesse(8.75) > vitesse(9.4) > vitesse(9.9) > vitesse(10.0) and s.pose(9.9)['inclinaison'] > 4,
         f'{vitesse(8.75):.1f} → {vitesse(9.4):.1f} → {vitesse(9.9):.1f} → {vitesse(10.0):.1f} m/s, regard encore à {s.pose(9.9)["inclinaison"]:.1f}° à 9,9 s')

# 7. Portrait mobile : la vidéo reste en 16:9 (cadre entier) ; au clic l'écran passe en 4:5 et recadre les côtés.
arches = [s.projeter(fin[0], (14.4 * math.sin(math.radians(a)), 14.4 * math.cos(math.radians(a)), 3.3)) for a in s.ANGLES]
en_169 = sum(1 for u, v, z in arches if z > 0 and abs(u) <= 1 and abs(v) <= 1)
en_45 = sum(1 for u, v, z in arches if z > 0 and abs(u) * s.FORMAT / .8 <= 1 and abs(v) <= 1)
verifier('entrées visibles à l’arrivée', en_169 >= 3, f'{en_169} arches en 16:9, {en_45} en 4:5 (les autres sont derrière soi : on tourne pour les voir)')

print('\nimages clés :')
for t in s.IMAGES_CLES:
    p = s.pose(min(t, 263 / 24))
    print(f"  {t:5.2f} s  image {min(264, round(t * 24) + 1):3d}  œil ({p['position'][0]:7.2f}, {p['position'][1]:7.2f}, {p['position'][2]:6.2f})  cap {p['cap'] % 360:5.1f}°  inclinaison {p['inclinaison']:4.1f}°  {p['focale']:4.1f} mm")
print(f'\n{len(echecs)} échec(s)' if echecs else '\nTOUT EST VERT')
sys.exit(1 if echecs else 0)
