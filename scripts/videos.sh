#!/bin/sh
# Regenera sitio/video/{es,en,fr}/ (MP4 H.264 sin audio + póster WebP) a partir
# de los clips originales de la app SwiftPen.
#
# Origen por idioma: $SWIFTPEN_RES/raw-<idioma>/ si existe; si no, raw/ (es).
# Uso: scripts/videos.sh   (SWIFTPEN_RES=<ruta a app/src/main/res> para otra copia)
set -eu

RES="${SWIFTPEN_RES:-$HOME/swiftpen/app/src/main/res}"
DESTINO="$(cd "$(dirname "$0")/.." && pwd)/sitio/video"
CLIPS="forma_perfecta garabatear linea_recta objeto_completo alcance_goma lazo_seleccionar audio"

for idioma in es en fr; do
  origen="$RES/raw-$idioma"
  [ -d "$origen" ] || origen="$RES/raw"
  mkdir -p "$DESTINO/$idioma"
  for clip in $CLIPS; do
    entrada="$origen/tutorial_$clip.mp4"
    [ -f "$entrada" ] || { echo "falta $entrada" >&2; exit 1; }
    ancho=960
    [ "$clip" = audio ] && ancho=800
    salida="$DESTINO/$idioma/$clip"
    ffmpeg -v error -y -i "$entrada" -an -r 30 -vf "scale=min($ancho\,iw):-2" \
      -c:v libx264 -crf 30 -preset slow -pix_fmt yuv420p -movflags +faststart "$salida.mp4"
    # Póster: fotograma al 40 % de la duración, ya recomprimido
    duracion="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$salida.mp4")"
    instante="$(awk "BEGIN { print $duracion * 0.4 }")"
    ffmpeg -v error -y -ss "$instante" -i "$salida.mp4" -frames:v 1 -c:v libwebp -quality 75 "$salida.webp"
  done
done
