#!/bin/zsh
# Régénère le GLB, le contrôle, puis capture AVANT (sauvegarde) et APRÈS aux mêmes angles.
# À lancer depuis un terminal ordinaire (Blender et Chrome ne démarrent pas dans le bac à sable de Claude Code).
# usage : art/outils/verifier-3d.sh [--sans-blender]
set -euo pipefail
cd "$(dirname "$0")/../.."
SAUVEGARDE=${SAUVEGARDE:-$HOME/Documents/corpus-rb/pxpipe/Nova-Yoga/sauvegarde-avant-audit-2026-11-23/etat.tgz}
SORTIE=${SORTIE:-$HOME/Documents/corpus-rb/pxpipe/Nova-Yoga/captures-2026-11-23}
export NOVA_PLAYWRIGHT=${NOVA_PLAYWRIGHT:-$(npm root -g)/dev-browser/node_modules/playwright-core}
TMP=$(mktemp -d)
mkdir -p "$TMP/sauvegarde" "$TMP/avant"
tar -xzf "$SAUVEGARDE" -C "$TMP/sauvegarde"
rsync -a --exclude .claude public/ "$TMP/avant/"          # fichiers absents de la sauvegarde (vendor, images…)
rsync -a "$TMP/sauvegarde/public/" "$TMP/avant/"           # puis l'état d'avant par-dessus, GLB compris
if [[ "${1:-}" != "--sans-blender" ]]; then
  command -v "${NOVA_GLTFPACK:-gltfpack}" >/dev/null || { echo "gltfpack introuvable : exporter NOVA_GLTFPACK=/chemin/gltfpack"; exit 1; }
  blender --background --python-exit-code 1 --python art/blender/build.py | grep NOVA_
  echo "— export avant / après"
  ls -l "$TMP/sauvegarde/public/worlds/sous-la-peau.glb" public/worlds/sous-la-peau.glb
  cmp -s "$TMP/sauvegarde/public/worlds/marche.json" public/worlds/marche.json && echo "marche.json identique" || echo "marche.json MODIFIÉ : vérifier les collisions"
  node art/outils/audit-glb.mjs "$TMP/sauvegarde/public/worlds/sous-la-peau.glb" bronze waterdrop skin
  node art/outils/audit-glb.mjs public/worlds/sous-la-peau.glb bronze waterdrop skin
fi
node art/outils/capture-3d.mjs "$TMP/avant" avant "$SORTIE" 8875 --injecter-crochet
node art/outils/capture-3d.mjs public apres "$SORTIE" 8876 --verif
echo "Captures et rapports : $SORTIE"
