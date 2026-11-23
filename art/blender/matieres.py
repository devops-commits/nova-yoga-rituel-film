"""Matières PBR procédurales du centre et des sept entrées (cahier « Direction de production »).

    /Applications/Blender.app/Contents/Resources/5.2/python/bin/python3.13 art/blender/matieres.py

numpy seul (pas de bpy, pas de PIL). Pour chaque famille, quatre cartes séparées et raccordables :
couleur, rugosité, normales, masques (plus l'émission pour la cendre), dans art/blender/surfaces/
(maîtres ≤ 1024², WebP si cwebp est installé, PNG sinon). Les dérivés du jeu — couleur, ORM
(R libre, V rugosité, B métal) et normales en JPEG 512² — vont dans surfaces/jeu/ : ce sont eux que
pbr.py branche dans les matériaux, donc dans le GLB et dans le rendu du survol.
"""
import shutil
import struct
import subprocess
import sys
import zlib
from pathlib import Path

import numpy as np

SORTIE = Path(__file__).resolve().parent / 'surfaces'
TAU = 2 * np.pi


def bruit(n, pente, graine, etire=(1, 1)):
    """Bruit fractal raccordable (spectre en 1/f^pente), ramené à 0..1. etire allonge selon (y, x)."""
    rng = np.random.default_rng(graine)
    fy, fx = np.meshgrid(np.fft.fftfreq(n) * n * etire[0], np.fft.fftfreq(n) * n * etire[1], indexing='ij')
    f = np.hypot(fy, fx); f[0, 0] = 1
    champ = np.fft.ifft2(np.fft.fft2(rng.normal(size=(n, n))) / f ** pente).real
    champ -= champ.min()
    return champ / champ.max()


def grille(n):
    v, u = np.mgrid[:n, :n] / n
    return u, v


def cellules(n, combien, graine):
    """Distances raccordables au plus proche germe et au second (en fraction de tuile)."""
    rng = np.random.default_rng(graine)
    u, v = grille(n)
    f1 = np.full((n, n), 9.0); f2 = f1.copy()
    for cx, cy in rng.random((combien, 2)):
        dx = np.abs(u - cx); dy = np.abs(v - cy)
        d = np.hypot(np.minimum(dx, 1 - dx), np.minimum(dy, 1 - dy))
        f2 = np.minimum(f2, np.maximum(f1, d)); f1 = np.minimum(f1, d)
    return f1, f2


def pores(n, combien, rayons, graine):
    """Creux circulaires raccordables : profondeur 0..1. rayons en pixels (min, max)."""
    rng = np.random.default_rng(graine)
    creux = np.zeros((n, n))
    for _ in range(combien):
        r = rng.uniform(*rayons); k = int(r) + 2
        cx, cy = rng.integers(0, n, 2)
        yy, xx = np.mgrid[-k:k + 1, -k:k + 1]
        tache = np.clip(1 - np.hypot(xx, yy) / r, 0, 1) ** .6 * rng.uniform(.5, 1)
        iy, ix = (cy + yy) % n, (cx + xx) % n
        creux[iy, ix] = np.maximum(creux[iy, ix], tache)
    return creux


def normales(hauteur, force):
    """Carte de normales tangentes (OpenGL, +Y vers le haut de l'image) depuis une hauteur raccordable."""
    dx = (np.roll(hauteur, -1, 1) - np.roll(hauteur, 1, 1)) * force
    dy = (np.roll(hauteur, -1, 0) - np.roll(hauteur, 1, 0)) * force
    n = np.dstack((-dx, dy, np.ones_like(dx)))
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * .5 + .5


def entre(valeur, bas, haut):
    return bas + (haut - bas) * np.clip(valeur, 0, 1)


def teinte(gris, rgb):
    return np.dstack([gris * c for c in rgb])


def ecrire_png(chemin, image):
    a = np.ascontiguousarray((np.clip(image, 0, 1) * 255 + .5).astype(np.uint8))
    if a.ndim == 2: a = a[:, :, None]
    h, w, c = a.shape
    brut = np.concatenate([np.zeros((h, 1), np.uint8), a.reshape(h, w * c)], axis=1).tobytes()
    def bloc(nom, corps):
        return struct.pack('>I', len(corps)) + nom + corps + struct.pack('>I', zlib.crc32(nom + corps))
    chemin.write_bytes(b'\x89PNG\r\n\x1a\n' + bloc(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 0 if c == 1 else 2, 0, 0, 0))
                       + bloc(b'IDAT', zlib.compress(brut, 9)) + bloc(b'IEND', b''))


# ───────────────────────────── familles ─────────────────────────────
# Chaque fonction rend dict(couleur, rugosite, normales, masques[, emission]) + la plage de rugosité visée.

def calcaire(n=1024):
    """Centre. Tuile de 1 m : 1 px ≈ 1 mm, pores de 1 à 4 mm, usure le long du passage."""
    u, v = grille(n)
    masse, grain = bruit(n, 1.7, 11), bruit(n, .7, 12)
    trous = np.maximum(pores(n, 5200, (.6, 1.3), 13), pores(n, 900, (1.3, 2.1), 14))   # Ø 1–4 mm
    usure = np.exp(-((v - .5) / .17) ** 2) * (.55 + .45 * bruit(n, 1.4, 15))             # bande du passage
    hauteur = .55 * masse + .05 * grain * (1 - .7 * usure) - .42 * trous * (1 - .55 * usure)
    clair = .80 + .13 * (masse - .5) + .04 * (grain - .5) - .30 * trous + .035 * usure
    return dict(couleur=teinte(clair, (1.0, .975, .93)),
                rugosite=entre(.5 + .9 * (grain - .5) + .5 * trous - .75 * usure, .65, .85),
                normales=normales(hauteur, 5.5), masques=np.dstack((usure, trous, masse)), plage=(.65, .85))


def laiton(n=512):
    """Filets du centre. Métal poli sur les arêtes, 0,28–0,40 ; brossage fin le long du filet."""
    brosse = bruit(n, 1.0, 21, etire=(1, 22))
    patine = np.clip((bruit(n, 1.8, 22) - .58) * 5, 0, 1)
    return dict(couleur=teinte(.93 - .16 * patine + .04 * (brosse - .5), (1, .97, .9)),
                rugosite=entre(.25 * (brosse - .2) + .85 * patine, .28, .40),
                normales=normales(.3 * brosse - .2 * patine, 2.2), masques=np.dstack((patine, brosse, 1 - patine)), plage=(.28, .40))


def basalte(n=1024):
    """Galerie des échos et galet. Rainures en relief, mat à 0,75, patine autour des fixations."""
    u, v = grille(n)
    ondule = bruit(n, 1.6, 31)
    rainure = .5 + .5 * np.cos(TAU * (9 * u + 1.4 * (ondule - .5)))          # rainures verticales, ~11 cm
    rainure = rainure ** 1.8
    bulles = pores(n, 2600, (.7, 2.4), 32)
    f1, _ = cellules(n, 7, 33)
    patine = np.exp(-(f1 / .055) ** 2)                                        # auréoles autour des attaches
    attache = np.exp(-(f1 / .012) ** 2)
    grain = bruit(n, .8, 34)
    hauteur = .5 * rainure + .22 * ondule + .05 * grain - .2 * bulles - .6 * attache
    clair = .74 + .16 * (ondule - .5) - .10 * (1 - rainure) - .22 * bulles + .05 * (grain - .5)
    couleur = teinte(clair, (.97, .99, 1.0)) * (1 - patine[..., None] * .35) + patine[..., None] * np.array([.10, .17, .13])
    return dict(couleur=couleur, rugosite=entre(.5 + .6 * (grain - .5) + .3 * bulles - .5 * patine, .70, .80),
                normales=normales(hauteur, 6.0), masques=np.dstack((patine, rainure, attache)), plage=(.70, .80))


def fil(n=512):
    """Cordes et fils d'or. Torons vrillés (pas de 2–4 mm sur un fil réel), 0,32–0,48."""
    u, v = grille(n)
    toron = .5 + .5 * np.cos(TAU * (3 * u + 16 * v))
    brin = .5 + .5 * np.cos(TAU * (9 * u - 64 * v))
    creux = (1 - toron) ** 2
    return dict(couleur=teinte(.95 - .17 * creux + .03 * brin, (1, .96, .88)),
                rugosite=entre(.15 + .75 * creux + .12 * (bruit(n, 1.2, 41) - .5), .32, .48),
                normales=normales(.8 * toron + .12 * brin, 3.4), masques=np.dstack((creux, toron, brin)), plage=(.32, .48))


def cendre(n=1024):
    """Sentier des lueurs. Tuile de 0,8 m : croûte friable, fissures de 1 à 6 mm, cœur chaud au fond."""
    f1, f2 = cellules(n, 46, 51)
    bord = f2 - f1                                             # 0 sur la fissure
    large = (.0012 + .0048 * bruit(n, 1.5, 52))                # demi-largeur : 1 à 6 mm sur 0,8 m
    fente = np.clip(1 - bord / (2 * large), 0, 1)
    levre = np.clip(1 - bord / (7 * large), 0, 1) - fente      # charbon à nu au bord des plaques
    poudre = bruit(n, .9, 53); amas = bruit(n, 1.9, 54)
    cendre_m = np.clip((amas - .32) * 3, 0, 1) * (1 - fente) * (1 - .7 * levre)
    charbon = np.clip(1 - cendre_m - fente, 0, 1)
    chaud = fente ** 2.2 * np.clip((bruit(n, 2.0, 55) - .52) * 6, 0, 1)   # limité au fond de quelques fentes
    hauteur = .45 * np.clip(bord * 9, 0, 1) + .14 * amas + .10 * poudre * cendre_m - .5 * fente
    couleur = (cendre_m[..., None] * teinte(.72 + .14 * (poudre - .5), (1, .98, .95))
               + charbon[..., None] * teinte(.13 + .06 * poudre, (1, .97, .95))
               + fente[..., None] * np.array([.06, .045, .04]))
    return dict(couleur=couleur, rugosite=entre(.9 * cendre_m + .8 * charbon + .62 * fente + .04 * (poudre - .5), .62, .92),
                normales=normales(hauteur, 6.5), masques=np.dstack((cendre_m, charbon, chaud)),
                emission=chaud[..., None] * np.array([1.0, .33, .07]), plage=(.62, .92))


def ocre(n=1024):
    """Atelier des traces. Tuile de 0,5 m : sillon large comme un doigt, bourrelet de 1 à 3 mm, 0,82–0,95."""
    u, v = grille(n)
    axe = .5 + .07 * np.sin(TAU * u) + .012 * np.sin(TAU * 3 * u + 1.1)
    d = (v - axe) / .019                                        # demi-largeur 9,5 mm : un doigt
    fond = np.exp(-d ** 4)
    bourrelet = np.exp(-((np.abs(d) - 1.28) / .22) ** 2) * (.6 + .4 * bruit(n, 1.2, 61))
    grains = pores(n, 1500, (.8, 2.6), 62) * np.exp(-((np.abs(d) - 1.9) / .9) ** 2)   # grains libres au bord du geste
    poudre = bruit(n, .6, 63); nappe = bruit(n, 1.8, 64)
    stries = .5 + .5 * np.cos(TAU * 46 * (v - axe) + 3 * nappe)                         # compression au fond
    hauteur = .25 * nappe + .08 * poudre * (1 - fond) - .5 * fond + .05 * stries * fond + .32 * bourrelet + .2 * grains
    clair = .80 + .10 * (nappe - .5) + .07 * (poudre - .5) * (1 - fond) - .09 * fond + .05 * bourrelet + .06 * grains
    return dict(couleur=teinte(clair, (1.0, .93, .88)),
                rugosite=entre(.75 + .35 * (poudre - .5) - .8 * fond + .2 * bourrelet + .2 * grains, .82, .95),
                normales=normales(hauteur, 7.0), masques=np.dstack((fond, bourrelet, grains)), plage=(.82, .95))


def eau(n=512):
    """Courant suspendu. Indice 1,333, rugosité 0,02–0,06, caustique douce et localisée."""
    houle = bruit(n, 2.4, 71, etire=(1, 3)); ride = bruit(n, 1.9, 72, etire=(1, 6))
    crete = 1 - np.abs(2 * bruit(n, 2.1, 73) - 1)
    caustique = np.clip((crete - .86) * 7, 0, 1) * np.clip((bruit(n, 2.2, 74) - .4) * 3, 0, 1)
    return dict(couleur=teinte(.93 + .05 * (houle - .5), (.96, 1.0, .985)),
                rugosite=entre(.2 + .9 * (ride - .5) + .3 * caustique, .02, .06),
                normales=normales(.75 * houle + .25 * ride, 9.0), masques=np.dstack((caustique, houle, ride)), plage=(.02, .06))


def _toile(n, fils, graine, jour):
    """Armure toile : alternance dessus/dessous, fils irréguliers. Rend (hauteur, jour entre les fils, chaîne)."""
    u, v = grille(n)
    du = .22 * (bruit(n, 1.6, graine, etire=(1, 9)) - .5); dv = .22 * (bruit(n, 1.6, graine + 1, etire=(9, 1)) - .5)
    a, b = fils * u + du, fils * v + dv
    chaine, trame = .5 + .5 * np.cos(TAU * a), .5 + .5 * np.cos(TAU * b)
    dessus = .5 + .5 * np.sign(np.sin(np.pi * a) * np.sin(np.pi * b))      # damier des croisements
    haut_chaine = chaine ** .7 * (.55 + .45 * dessus * trame ** .3)
    haut_trame = trame ** .7 * (.55 + .45 * (1 - dessus) * chaine ** .3)
    hauteur = np.maximum(haut_chaine, haut_trame)
    return hauteur, np.clip((jour - np.maximum(chaine, trame)) / jour, 0, 1), haut_chaine >= haut_trame


def voile(n=1024):
    """Horizon respirant. Tuile de 0,1 m : 250 fils de 0,4 mm, translucidité entre les fils, ourlet doublé."""
    u, v = grille(n)
    hauteur, jour, chaine = _toile(n, 128, 81, .42)            # 4 px par demi-période : lisible sans moiré
    ourlet = np.exp(-((v - .5) / .035) ** 4)                   # bande doublée, raccordable
    fibre = bruit(n, 1.0, 83)
    clair = .78 + .16 * hauteur + .05 * (fibre - .5) - .10 * ourlet
    return dict(couleur=teinte(clair, (.93, .97, .90)), rugosite=entre(.55 + .5 * (fibre - .5) - .3 * hauteur, .72, .88),
                normales=normales(hauteur + .5 * ourlet, 2.6), masques=np.dstack((jour * (1 - ourlet), ourlet, chaine)), plage=(.72, .88))


def tissage(n=1024):
    """Tissage lumineux. Tuile de 6 cm : toile de lin, fil d'or satiné couché par des points de soie."""
    u, v = grille(n)
    hauteur, jour, _ = _toile(n, 40, 91, .30)
    axe = .5 + .085 * np.sin(TAU * u)
    d = (v - axe) / .034
    corps = np.clip(1 - d * d, 0, 1) ** .5                      # cordon d'or, Ø 4 mm
    lame = .5 + .5 * np.cos(TAU * 58 * u + 5.5 * d)             # lame enroulée : l'éclat suit le sens du fil
    point = np.exp(-((((u * 4) % 1) - .5) / .11) ** 2) * np.clip(1 - (d / 1.5) ** 4, 0, 1)   # quatre points de soie
    fibres = np.clip((bruit(n, 1.1, 93, etire=(14, 1)) - .78) * 9, 0, 1) * (1 - corps)        # fibres libres
    orm = (corps > 0) * (1 - np.clip(point * 1.6, 0, 1))
    relief = np.where(corps > 0, .9 + .9 * corps + .09 * lame, hauteur * .8) + .5 * point * (1.2 + corps) + .25 * fibres
    lin = teinte(.80 + .14 * hauteur - .2 * jour, (1.0, .965, .88))
    dore = teinte(.80 + .2 * lame * corps, (1.0, .80, .40))
    soie = teinte(.93 + 0 * u, (1.0, .985, .95))
    couleur = lin * (1 - orm[..., None]) + dore * orm[..., None]
    couleur = couleur * (1 - np.clip(point, 0, 1)[..., None]) + soie * np.clip(point, 0, 1)[..., None]
    rug = np.where(orm > 0, entre(.9 - .9 * lame, .35, .48), entre(.6 + .3 * (1 - hauteur), .78, .9))
    return dict(couleur=couleur, rugosite=rug, normales=normales(relief, 2.4),
                masques=np.dstack((orm, np.clip(point, 0, 1), fibres)), plage=(.35, .90))


# famille : (fonction, taille de la tuile en mètres, métal écrit dans la voie B de l'ORM du jeu)
FAMILLES = {'calcaire': (calcaire, 1.0, .03), 'laiton': (laiton, .25, .61), 'basalte': (basalte, 1.0, .15),
            'fil': (fil, .03, .38), 'cendre': (cendre, .8, 0.0), 'ocre': (ocre, .5, .05), 'eau': (eau, .6, .35),
            'voile': (voile, .1, 0.0), 'tissage': (tissage, .06, 0.0)}
COULEUR_JEU = {'calcaire', 'cendre', 'ocre', 'voile', 'tissage'}


def reduire(image, taille):
    pas = image.shape[0] // taille
    if pas <= 1: return image
    forme = (taille, pas, taille, pas) + image.shape[2:]
    return image.reshape(forme).mean(axis=(1, 3))


def produire(sortie=SORTIE, seulement=None):
    cwebp, ffmpeg = shutil.which('cwebp'), shutil.which('ffmpeg')
    jeu = sortie / 'jeu'; jeu.mkdir(parents=True, exist_ok=True)
    bilan = {}
    for nom, (fonction, tuile, metal) in FAMILLES.items():
        if seulement and nom not in seulement: continue
        cartes = fonction(); plage = cartes.pop('plage')
        r = cartes['rugosite']
        assert plage[0] - 1e-6 <= r.min() and r.max() <= plage[1] + 1e-6, (nom, r.min(), r.max())
        for carte, image in cartes.items():
            for a in range(2):   # raccord : le bord opposé est un voisin comme un autre
                saut = np.abs(np.take(image, 0, axis=a) - np.take(image, -1, axis=a)).mean()
                voisin = np.abs(np.take(image, 1, axis=a) - np.take(image, 0, axis=a)).mean()
                assert saut <= 2.5 * voisin + .02, (nom, carte, a, saut, voisin)
            png = sortie / f'{nom}-{carte}.png'
            ecrire_png(png, image)
            if cwebp:
                qualite = ['-q', '90', '-sharp_yuv'] if carte == 'normales' else ['-q', '82']
                subprocess.run([cwebp, '-quiet', *qualite, '-m', '6', str(png), '-o', str(png.with_suffix('.webp'))], check=True)
                png.unlink()
        # Dérivés du jeu : JPEG 512², l'exporteur glTF les reprend tels quels.
        derives = {'orm': np.dstack((np.ones_like(r), r, np.full_like(r, metal))), 'normales': cartes['normales']}
        if nom in COULEUR_JEU: derives['couleur'] = cartes['couleur']
        if 'emission' in cartes: derives['emission'] = cartes['emission']
        for carte, image in derives.items():
            cible = jeu / f'{nom}-{carte}.jpg'
            if not ffmpeg:
                ecrire_png(cible.with_suffix('.png'), reduire(image, 512)); continue
            temporaire = jeu / f'.{nom}-{carte}.png'
            ecrire_png(temporaire, reduire(image, 512))
            subprocess.run([ffmpeg, '-loglevel', 'error', '-y', '-i', str(temporaire), '-pix_fmt', 'yuvj444p' if carte == 'normales' else 'yuvj420p',
                            '-q:v', '3' if carte == 'normales' else '5', str(cible)], check=True)
            temporaire.unlink()
        bilan[nom] = dict(tuile_m=tuile, rugosite=(round(float(r.min()), 3), round(float(r.max()), 3)), metal=metal)
        print('NOVA_MATIERE', nom, bilan[nom], flush=True)
    return bilan


if __name__ == '__main__':
    produire(seulement=set(sys.argv[1:]) or None)
    maitres = sum(f.stat().st_size for f in SORTIE.glob('*-*.*') if f.stem.split('-')[0] in FAMILLES)
    jeu = sum(f.stat().st_size for f in (SORTIE / 'jeu').glob('*.jpg'))
    print(f'NOVA_MATIERES_COMPLET maîtres {maitres/1e6:.2f} Mo · dérivés du jeu {jeu/1e6:.2f} Mo')
