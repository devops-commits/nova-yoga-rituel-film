"""Branche les matières de matieres.py (surfaces/jeu/) dans les matériaux Blender.

Appelé par build.py (donc exporté dans le GLB : ORM → rugosité/métal, normales, KHR_texture_transform
pour l'échelle) et par survol.py (rendu EEVEE). Idempotent : un matériau déjà traité est laissé tel quel.
La couleur reste multipliée par la teinte de la palette, comme le grain d'origine.
"""
from pathlib import Path

import bpy

JEU = Path(__file__).resolve().parent / 'surfaces' / 'jeu'

# clé de palette → famille, répétitions par unité d'UV (les sols valent 2,63 m par unité), force du relief.
# Rugosités du cahier : calcaire 0,65–0,85 · laiton 0,28–0,40 · basalte 0,75 · fil 0,32–0,48 ·
# cendre 0,9 · ocre 0,82–0,95 · eau 0,02–0,06 (indice 1,333).
BRANCHEMENTS = {
    'chalk':  dict(famille='calcaire', couleur=True, echelle=(3, 3), relief=.55),
    'brass':  dict(famille='laiton', echelle=(1, 12), relief=.30),
    'copper': dict(famille='laiton', echelle=(1, 12), relief=.30),
    'brass4': dict(famille='laiton', echelle=(1, 12), relief=.22),
    'basalt': dict(famille='basalte', echelle=(2, 2), relief=.60),
    'gold':   dict(famille='fil', echelle=(1, 10), relief=.50),
    'ash':    dict(famille='cendre', couleur=True, echelle=(3, 1.5), relief=.70, emission=1.8),
    'rose':   dict(famille='ocre', couleur=True, echelle=(2, 2), relief=.55),
    'water':  dict(famille='eau', echelle=(1.5, 1.5), relief=.35, ior=1.333),
    # Voile du monde 4 : UV (4·s, t) sur 21 m × 5 m environ, soit un motif de tissage tous les 0,5 m
    # (carte agrandie cinq fois : à 33 m de la clairière, la tuile réelle de 0,1 m ne donnerait que du moiré).
    'veil':   dict(famille='voile', couleur=True, echelle=(10, 10), relief=.35),
}


def image(famille, carte, donnees=True):
    chemin = JEU / f'{famille}-{carte}.jpg'
    if not chemin.exists():
        raise FileNotFoundError(f'{chemin} manque : lancer art/blender/matieres.py')
    im = bpy.data.images.load(str(chemin), check_existing=True)
    if donnees: im.colorspace_settings.name = 'Non-Color'
    im.pack()
    return im


def _amont(prise, genre):
    """Premier nœud d'un type donné en remontant depuis une prise d'entrée."""
    for lien in prise.links:
        noeud = lien.from_node
        if noeud.type == genre: return noeud
        for entree in noeud.inputs:
            trouve = _amont(entree, genre)
            if trouve: return trouve
    return None


def appliquer(mat, cle=None, branchement=None):
    """Remplace grain et relief génériques par la famille PBR du cahier. Rend True si le matériau change."""
    spec = branchement or BRANCHEMENTS.get(cle or mat.name)
    if not spec or mat.get('matiere'): return False
    nodes, lier = mat.node_tree.nodes, mat.node_tree.links.new
    shader = nodes.get('Principled BSDF')
    coord, plan = nodes.new('ShaderNodeTexCoord'), nodes.new('ShaderNodeMapping')
    plan.inputs['Scale'].default_value = (*spec['echelle'], 1)
    lier(coord.outputs['UV'], plan.inputs['Vector'])
    famille = spec['famille']

    def texture(carte, donnees=True):
        noeud = nodes.new('ShaderNodeTexImage'); noeud.image = image(famille, carte, donnees)
        lier(plan.outputs['Vector'], noeud.inputs['Vector'])
        return noeud

    if spec.get('couleur'):
        teinte = _amont(shader.inputs['Base Color'], 'TEX_IMAGE')
        if teinte:
            teinte.image = image(famille, 'couleur', False); lier(plan.outputs['Vector'], teinte.inputs['Vector'])
        else:
            lier(texture('couleur', False).outputs['Color'], shader.inputs['Base Color'])
    bosse = _amont(shader.inputs['Normal'], 'NORMAL_MAP')
    if not bosse:
        bosse = nodes.new('ShaderNodeNormalMap'); lier(bosse.outputs[0], shader.inputs['Normal'])
    relief = _amont(bosse.inputs['Color'], 'TEX_IMAGE') or nodes.new('ShaderNodeTexImage')
    relief.image = image(famille, 'normales')
    lier(plan.outputs['Vector'], relief.inputs['Vector']); lier(relief.outputs['Color'], bosse.inputs['Color'])
    bosse.inputs['Strength'].default_value = spec['relief']
    voies = nodes.new('ShaderNodeSeparateColor')
    lier(texture('orm').outputs['Color'], voies.inputs[0])
    lier(voies.outputs['Green'], shader.inputs['Roughness'])
    lier(voies.outputs['Blue'], shader.inputs['Metallic'])
    if spec.get('emission'):
        lier(texture('emission', False).outputs['Color'], shader.inputs['Emission Color'])
        shader.inputs['Emission Strength'].default_value = spec['emission']
    if spec.get('ior'):
        shader.inputs['IOR'].default_value = spec['ior']
    mat['matiere'] = famille
    return True


def appliquer_tout(materiaux=None):
    """Traite tous les matériaux connus du fichier ouvert. Rend la liste des clés absentes."""
    absents = []
    for cle in BRANCHEMENTS:
        mat = (materiaux or bpy.data.materials).get(cle)
        if mat is None: absents.append(cle)
        else: appliquer(mat, cle)
    return absents
