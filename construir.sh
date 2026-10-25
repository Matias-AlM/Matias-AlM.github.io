#!/bin/bash
# Arma en dist/ la web de getswiftpen.com: lo de sitio/ va a la raiz
# (getswiftpen.com/, /privacidad/, /baja/), con assets/ y el favicon al
# lado. Lo que no se publica (_correo/, este script) no entra. Las rutas
# relativas de las paginas ("../img", "privacidad/") y las absolutas
# ("/assets/...") siguen valiendo tal cual con esta estructura.
#
# La barra y el pie son comunes: viven en sitio/_partes/ y cada pagina los
# pide con <!--#barra--> y <!--#pie-->. Para marcar la pagina activa en la
# barra, <!--#barra roadmap--> (el nombre de su data-pagina en barra.html).
set -e
cd "$(dirname "$0")"
rm -rf dist
mkdir -p dist
cp -r sitio/. dist/
cp -r assets dist/assets
cp favicon.png dist/

# Sustituye <!--#barra--> y <!--#pie--> por sitio/_partes/*.html. Falla si falta
# una parte, si queda un marcador sin sustituir o si _partes/ llega a dist/.
python3 - <<'PY'
import pathlib, re, shutil, sys
dist = pathlib.Path("dist")
partes = {n: pathlib.Path(f"sitio/_partes/{n}.html").read_text() for n in ("barra", "pie")}
marcador = re.compile(r"<!--#(barra|pie)(?: ([a-z-]+))?-->")
def sustituir(m):
    html = partes[m[1]]
    if m[2]:
        marcada = html.replace(f'data-pagina="{m[2]}"', f'data-pagina="{m[2]}" aria-current="page"')
        if marcada == html:
            sys.exit(f"construir.sh: la barra no tiene data-pagina=\"{m[2]}\"")
        html = marcada
    return html.rstrip("\n")
for f in dist.rglob("*.html"):
    f.write_text(marcador.sub(sustituir, f.read_text()))
shutil.rmtree(dist / "_partes")
sobrantes = [str(f) for f in dist.rglob("*.html") if "<!--#" in f.read_text()]
if sobrantes or (dist / "_partes").exists():
    sys.exit(f"construir.sh: marcadores sin sustituir en {sobrantes}")
PY
echo "dist/ listo: $(find dist -type f | wc -l) ficheros"
