#!/bin/zsh
# Régénère le GLB seul (art/blender/build.py → public/worlds/sous-la-peau.glb, marche.json, Sous-la-peau.blend),
# sans rendre le survol. À lancer depuis un terminal ordinaire : Blender ne démarre pas dans le bac à sable.
#
#   NOVA_GLTFPACK=/chemin/gltfpack art/outils/reconstruire-glb.sh
#
# Contrôles : gltfpack présent (0.22), cartes du jeu présentes, croissance du GLB ≤ PLAFOND_KO (défaut 3000),
# marche.json identique ou seulement plus ouvert (aucune case jouable fermée ; le détail par zone est affiché),
# matériaux attendus présents dans le GLB.
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
else
  # Cases ouvertes ou fermées, par zone. Une carte qui ne fait que s'ouvrir (aucune case fermée) est SIGNALÉE
  # sans échec. Une case fermée reste un échec, sauf NOVA_MARCHE_LIBRE=1. Les grands voiles de fond du monde 4
  # descendent sous 2,08 m : interiors.VOILES_DE_FOND_4 ouvre (False) ou referme (True) des cases du monde 4 ;
  # avec True, marche.json doit redevenir celui de main (git diff --quiet HEAD -- public/worlds/marche.json).
  FERMEES=$(node -e '
const fs=require("fs"),[a,b]=process.argv.slice(1).map(f=>JSON.parse(fs.readFileSync(f)));
if(["step","x0","y0","nx","ny"].some(k=>a[k]!==b[k])){console.error("grille de marche.json redimensionnée");console.log(-1);process.exit(0);}
const bits=d=>{const o=Buffer.from(d.cells,"base64");return i=>o[i>>3]>>(i&7)&1;},A=bits(a),B=bits(b);
const zones={},rad=Math.PI/180;let fermees=0,ouvertes=0;
for(let j=0;j<a.ny;j++)for(let i=0;i<a.nx;i++){
  const k=j*a.nx+i,d=B(k)-A(k);if(!d)continue;
  const x=a.x0+i*a.step,y=a.y0+j*a.step;let zone="chemin ou clairière";
  a.angles.forEach((deg,n)=>{const sx=Math.sin(deg*rad),sy=Math.cos(deg*rad),l=x*sx+y*sy,t=x*sy-y*sx;
    if((l-33)**2+t*t<81)zone="monde "+(n+1);else if(l>10.85&&l<26.6&&Math.abs(t)<2.38)zone="passage "+(n+1);});
  zones[zone]=zones[zone]||[0,0];zones[zone][d>0?0:1]++;d>0?ouvertes++:fermees++;}
console.error("marche.json MODIFIÉ : "+ouvertes+" case(s) ouverte(s), "+fermees+" fermée(s)");
for(const z of Object.keys(zones).sort())console.error("  "+z+" : +"+zones[z][0]+" / −"+zones[z][1]);
console.log(fermees);' "$GARDE/${MARCHE:t}" "$MARCHE")
  if [[ "$FERMEES" == 0 ]]; then
    echo "marche.json MODIFIÉ, accepté : la surface jouable ne diminue nulle part (cases ouvertes seulement)"
  elif [[ "${NOVA_MARCHE_LIBRE:-0}" == 1 ]]; then
    echo "marche.json MODIFIÉ avec des cases fermées (accepté par NOVA_MARCHE_LIBRE=1) : vérifier les collisions"
  else
    restaurer; echo "ÉCHEC : marche.json ferme des cases jouables (NOVA_MARCHE_LIBRE=1 pour l'accepter)"; exit 1
  fi
fi

echo "— matériaux du raccord dans le GLB"
node art/outils/audit-glb.mjs "$GLB" chalk brass brass4 copper ink veil
node -e '
const fs=require("fs"),raw=fs.readFileSync(process.argv[1]),doc=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)).toString());
const mats=Object.fromEntries(doc.materials.map(m=>[m.name,m.pbrMetallicRoughness?.baseColorFactor?.slice(0,3).map(v=>+v.toFixed(3))]));
const manque=["chalk","brass","brass4","copper","ink","veil","film0","silk"].filter(n=>!(n in mats));
console.log("chalk",mats.chalk,"(attendu ≈ 0.658, 0.451, 0.429) · copper",mats.copper,"· brass4",mats.brass4,"(attendu ≈ 0.871, 0.578, 0.279)");
const cercles=doc.meshes.filter(m=>/Cercles grav/.test(m.name||"")).length, noeuds=doc.nodes.filter(n=>/Cercles grav/.test(n.name||"")).length;
console.log("Cercles gravés :",Math.max(cercles,noeuds),"maillage(s) nommé(s) (0 si gltfpack a fusionné les noms)");
if(manque.length){console.error("ÉCHEC : matériaux absents du GLB : "+manque.join(", "));process.exit(1);}
' "$GLB" || { restaurer; exit 1; }
echo "GLB reconstruit. Contrôle visuel : node art/outils/raccord-plateforme.mjs public apres"
