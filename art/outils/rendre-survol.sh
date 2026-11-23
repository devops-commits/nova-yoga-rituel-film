#!/bin/zsh
# Rend le survol des sept entrées avec EEVEE (art/blender/survol.py).
# À lancer depuis un terminal ordinaire : Blender ne démarre pas dans le bac à sable de Claude Code.
#
#   art/outils/rendre-survol.sh --apercu     11 images clés en 960×540 + planche contact
#   art/outils/rendre-survol.sh              264 images en 1920×1080 → public/videos/survol-sept-entrees.mp4
#                                            (H.264, yuv420p, faststart, ≤ 8 Mo) + public/images/sous-la-peau/survol.jpg
#   options : --reconstruire  relance d'abord build.py (GLB + .blend ; exige gltfpack 0.22 via NOVA_GLTFPACK)
#             --garder        conserve les images PNG du rendu complet dans la sortie
# variables : NOVA_BLENDER, NOVA_GLTFPACK, SORTIE, et celles de survol.py (NOVA_ECHANTILLONS, NOVA_FLOU,
#             NOVA_RELIEF, NOVA_SOLEIL_ELEVATION, NOVA_MASQUER).
set -euo pipefail
cd "$(dirname "$0")/../.."
BLENDER=${NOVA_BLENDER:-$(command -v blender || echo /Applications/Blender.app/Contents/MacOS/Blender)}
PYTHON_BLENDER=${NOVA_PYTHON:-/Applications/Blender.app/Contents/Resources/5.2/python/bin/python3.13}
SORTIE=${SORTIE:-$HOME/Documents/corpus-rb/pxpipe/Nova-Yoga/survol-2026-11-23}
CLES="0,1.2,2.2,3.2,4.25,5.3,6.45,7.6,8.75,9.9,11"
APERCU=0; RECONSTRUIRE=0; GARDER=0
for option in "$@"; do
  case $option in
    --apercu) APERCU=1 ;;
    --reconstruire) RECONSTRUIRE=1 ;;
    --garder) GARDER=1 ;;
    *) echo "option inconnue : $option"; exit 2 ;;
  esac
done
mkdir -p "$SORTIE"

echo "— trajectoire (tests hors Blender)"
python3 -B art/outils/test-survol.py
[[ -f art/blender/surfaces/jeu/calcaire-orm.jpg ]] || "$PYTHON_BLENDER" -B art/blender/matieres.py

if (( RECONSTRUIRE )); then
  command -v "${NOVA_GLTFPACK:-gltfpack}" >/dev/null || { echo "gltfpack introuvable : exporter NOVA_GLTFPACK=/chemin/gltfpack (0.22)"; exit 1; }
  AVANT=$(stat -f %z public/worlds/sous-la-peau.glb)
  cp public/worlds/marche.json "$SORTIE/marche-avant.json"
  "$BLENDER" --background --python-exit-code 1 --python art/blender/build.py | grep NOVA_
  APRES=$(stat -f %z public/worlds/sous-la-peau.glb)
  echo "GLB : $AVANT → $APRES octets (croissance $(( (APRES - AVANT) / 1000 )) ko, plafond 3000 ko)"
  (( APRES - AVANT <= 3000000 )) || { echo "ÉCHEC : le GLB grossit de plus de 3 Mo"; exit 1; }
  cmp -s "$SORTIE/marche-avant.json" public/worlds/marche.json && echo "marche.json identique" || echo "marche.json MODIFIÉ : vérifier les collisions"
  node art/outils/audit-glb.mjs public/worlds/sous-la-peau.glb chalk basalt brass gold rose ash water bronze
fi

if (( APERCU )); then
  IMAGES="$SORTIE/apercu"; mkdir -p "$IMAGES"
  NOVA_FRAMES="$IMAGES" NOVA_IMAGES="$CLES" NOVA_LARGEUR=960 NOVA_HAUTEUR=540 NOVA_ECHANTILLONS=${NOVA_ECHANTILLONS:-32} \
    "$BLENDER" --background art/blender/Sous-la-peau.blend --python-exit-code 1 --python art/blender/survol.py | grep NOVA_
  # Planche contact 4 × 3, dans l'ordre du temps (la douzième case reste vide).
  ffmpeg -loglevel error -y -pattern_type glob -i "$IMAGES/cle-*.png" \
    -vf "scale=640:360,tile=4x3:padding=6:margin=6:color=0x15100e" -frames:v 1 -q:v 3 "$SORTIE/survol-apercu-planche.jpg"
  echo "Aperçu : $SORTIE/survol-apercu-planche.jpg (images clés dans $IMAGES)"
  exit 0
fi

IMAGES=$(mktemp -d)
NOVA_FRAMES="$IMAGES" NOVA_IMAGES="" "$BLENDER" --background art/blender/Sous-la-peau.blend --python-exit-code 1 --python art/blender/survol.py | grep NOVA_
NOMBRE=$(ls "$IMAGES"/vue-*.png | wc -l | tr -d ' ')
(( NOMBRE == 264 )) || { echo "ÉCHEC : $NOMBRE images rendues au lieu de 264 ($IMAGES)"; exit 1; }
cmp -s "$IMAGES/vue-0253.png" "$IMAGES/vue-0264.png" && echo "arrêt final : images 253 et 264 identiques" || echo "ATTENTION : les images 253 et 264 diffèrent (bruit d'échantillonnage ?)"

VIDEO=public/videos/survol-sept-entrees.mp4
encoder() {  # $1 = CRF
  ffmpeg -loglevel error -y -framerate 24 -i "$IMAGES/vue-%04d.png" -c:v libx264 -profile:v high -level 4.1 -preset slow -crf "$1" \
    -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart -an "$VIDEO.tmp.mp4"
}
for CRF in 18 20 22 24 26 28; do
  encoder $CRF
  TAILLE=$(stat -f %z "$VIDEO.tmp.mp4")
  (( TAILLE <= 8000000 )) && break
done
(( TAILLE <= 8000000 )) || { echo "ÉCHEC : $TAILLE octets à CRF 28, plus de 8 Mo"; exit 1; }
mv "$VIDEO.tmp.mp4" "$VIDEO"
# survol.jpg = dernière image du survol, celle sur laquelle l'exploration prend la main.
ffmpeg -loglevel error -y -i "$IMAGES/vue-0264.png" -q:v 2 -pix_fmt yuvj444p public/images/sous-la-peau/survol.jpg
ffmpeg -loglevel error -y -i "$VIDEO" -vf "select='eq(n,0)+eq(n,29)+eq(n,53)+eq(n,77)+eq(n,102)+eq(n,127)+eq(n,155)+eq(n,182)+eq(n,210)+eq(n,238)+eq(n,263)',scale=640:360,tile=4x3:padding=6:margin=6:color=0x15100e" \
  -fps_mode vfr -frames:v 1 -q:v 3 "$SORTIE/survol-planche.jpg"
echo "Vidéo : $VIDEO · $TAILLE octets · CRF $CRF · $(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=codec_name,pix_fmt,width,height,r_frame_rate,nb_read_frames -of csv=p=0 "$VIDEO")"
echo "Image d'arrivée : public/images/sous-la-peau/survol.jpg · planche : $SORTIE/survol-planche.jpg"
if (( GARDER )); then mkdir -p "$SORTIE/images" && cp "$IMAGES"/vue-*.png "$SORTIE/images/"; fi
echo "Images du rendu (temporaires, à supprimer à la main si besoin) : $IMAGES"
