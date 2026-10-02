#!/bin/bash
# Arma en dist/ la web de getswiftpen.com: lo de sitio/ va a la raiz
# (getswiftpen.com/, /privacidad/, /baja/), con assets/ y el favicon al
# lado. Lo que no se publica (_correo/, este script) no entra. Las rutas
# relativas de las paginas ("../img", "privacidad/") y las absolutas
# ("/assets/...") siguen valiendo tal cual con esta estructura.
set -e
cd "$(dirname "$0")"
rm -rf dist
mkdir -p dist
cp -r sitio/. dist/
cp -r assets dist/assets
cp favicon.png dist/
echo "dist/ listo: $(find dist -type f | wc -l) ficheros"
