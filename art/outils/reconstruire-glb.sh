#!/bin/zsh
# Régénère le GLB seul (art/blender/build.py → public/worlds/sous-la-peau.glb, marche.json, Sous-la-peau.blend),
# sans rendre le survol. À lancer depuis un terminal ordinaire : Blender ne démarre pas dans le bac à sable.
#
#   NOVA_GLTFPACK=/chemin/gltfpack art/outils/reconstruire-glb.sh
#
# Contrôles : gltfpack présent (0.22), cartes du jeu présentes, croissance du GLB ≤ PLAFOND_KO (défaut 3000),
# marche.json identique (collisions et parcours inchangés), matériaux attendus présents dans le GLB.
# En cas d'échec d'un contrôle, l'état d'avant est RESTAURÉ depuis $SORTIE/avant-reconstruction/.
# variables : NOVA_BLENDER, NOVA_GLTFPACK, NOVA_PYTHON, SORTIE, PLAFOND_KO, NOVA_MARCHE_LIBRE=1 (accepte un marche.json modifié).
set -euo pipefail
cd "$(dirname "$0")/../.."
BLENDER=${NOVA_BLENDER:-$(command -v blender || echo /Applications/Blender.app/Contents/MacOS/Blender)}
PYTHON_BLENDER=${NOVA_PYTHON:-/Applications/Blender.app/Contents/Resources/5.2/python/bin/python3.13}
SORTIE=${SORTIE:-$HOME/Documents/corpus-rb/pxpipe/Nova-Yoga/plateforme-2026-11-23}
PLAFOND_KO=${PLAFOND_KO:-3000}
GLB=public/worlds/sous-la-peau.glb; MARCHE=public/worlds/marche.json; BLEND=art/blender/Sous-la-peau.blend
GARDE="$SORTIE/avant-reconstruction"

command -v "${NOVA_GLTFPACK:-gltfpack}" >/dev/null || { echo "gltfpack introuvable : exporter NOVA_GLTFPACK=/chemin/gltfpack (0.22)"; exit 1; }
[[ -f art/blender/surfaces/jeu/calcaire-orm.jpg ]] || "$PYTHON_BLENDER" -B art/blender/matieres.py

mkdir -p "$GARDE"
cp -p "$GLB" "$MARCHE" "$BLEND" "$GARDE/"
AVANT=$(stat -f %z "$GLB")
restaurer() { cp -p "$GARDE/${GLB:t}" "$GLB"; cp -p "$GARDE/${MARCHE:t}" "$MARCHE"; cp -p "$GARDE/${BLEND:t}" "$BLEND"; echo "état d'avant restauré depuis $GARDE"; }

echo "— build.py (Blender)"
if ! "$BLENDER" --background --python-exit-code 1 --python art/blender/build.py > "$SORTIE/reconstruction.log" 2>&1; then
  grep -E "NOVA_|Error|Traceback" "$SORTIE/reconstruction.log" | tail -20 || true
  restaurer; echo "ÉCHEC : build.py (journal : $SORTIE/reconstruction.log)"; exit 1
fi
grep NOVA_ "$SORTIE/reconstruction.log" || true
if grep -q NOVA_BUILD_WARNING "$SORTIE/reconstruction.log"; then restaurer; echo "ÉCHEC : export sans gltfpack"; exit 1; fi

APRES=$(stat -f %z "$GLB")
echo "GLB : $AVANT → $APRES octets (croissance $(( (APRES - AVANT) / 1000 )) ko, plafond $PLAFOND_KO ko)"
if (( APRES - AVANT > PLAFOND_KO * 1000 )); then restaurer; echo "ÉCHEC : le GLB grossit de plus de $PLAFOND_KO ko"; exit 1; fi

if cmp -s "$GARDE/${MARCHE:t}" "$MARCHE"; then
  echo "marche.json identique : collisions et parcours inchangés"
elif [[ "${NOVA_MARCHE_LIBRE:-0}" == 1 ]]; then
  echo "marche.json MODIFIÉ (accepté par NOVA_MARCHE_LIBRE=1) : vérifier les collisions"
else
  restaurer; echo "ÉCHEC : marche.json a changé (NOVA_MARCHE_LIBRE=1 pour l'accepter)"; exit 1
fi

echo "— matériaux du raccord dans le GLB"
node art/outils/audit-glb.mjs "$GLB" chalk brass copper ink
node -e '
const fs=require("fs"),raw=fs.readFileSync(process.argv[1]),doc=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)).toString());
const mats=Object.fromEntries(doc.materials.map(m=>[m.name,m.pbrMetallicRoughness?.baseColorFactor?.slice(0,3).map(v=>+v.toFixed(3))]));
const manque=["chalk","brass","copper","ink"].filter(n=>!(n in mats));
console.log("chalk",mats.chalk,"(attendu ≈ 0.658, 0.451, 0.429) · copper",mats.copper);
const cercles=doc.meshes.filter(m=>/Cercles grav/.test(m.name||"")).length, noeuds=doc.nodes.filter(n=>/Cercles grav/.test(n.name||"")).length;
console.log("Cercles gravés :",Math.max(cercles,noeuds),"maillage(s) nommé(s) (0 si gltfpack a fusionné les noms)");
if(manque.length){console.error("ÉCHEC : matériaux absents du GLB : "+manque.join(", "));process.exit(1);}
' "$GLB" || { restaurer; exit 1; }
echo "GLB reconstruit. Contrôle visuel : node art/outils/raccord-plateforme.mjs public apres"
