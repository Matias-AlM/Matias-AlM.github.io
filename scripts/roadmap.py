#!/usr/bin/env python3
"""Genera la hoja de ruta de la web (sitio/roadmap/index.html) desde los issues de GitHub.

Solo se publican los issues con una etiqueta de estado (roadmap:en-desarrollo,
roadmap:planeado, roadmap:considerando). Un issue cerrado con una de ellas sale como
«hecho» (con ✓) durante DIAS_HECHO dias y despues desaparece. Del issue solo se lee el
titulo, el estado, la fecha de cierre y el bloque <!-- roadmap ... --> del cuerpo:
nunca el resto del cuerpo, comentarios, autores ni enlaces. Mapeo completo en docs/roadmap.md.

Uso:
  python3 scripts/roadmap.py                      # reescribe sitio/roadmap/index.html
  python3 scripts/roadmap.py --dry-run            # imprime el bloque generado, sin escribir
  python3 scripts/roadmap.py --ejemplo scripts/roadmap_ejemplo.json --dry-run
  python3 scripts/roadmap.py --hoy 2026-10-25     # fija la fecha (por defecto, hoy en UTC)

Tokens: ROADMAP_TOKEN para los repos de otra cuenta o privados; para el repo donde corre la
Action basta GITHUB_TOKEN. En local, sin ninguno, usa `gh auth token`.
"""
import argparse
import datetime
import html
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PAGINA = RAIZ / "sitio" / "roadmap" / "index.html"
MARCA_INICIO = "<!--roadmap:inicio-->"
MARCA_FIN = "<!--roadmap:fin-->"

FUENTES = ["Matias-AlM/swiftpen", "Matias-AlM/Matias-AlM.github.io"]
DIAS_HECHO = 30
IDIOMAS = ("es", "en", "fr")
MAX_TITULO = 160
MAX_DESCRIPCION = 300

# Orden de las secciones; el primero que casa gana si un issue lleva varias etiquetas.
ESTADOS = ("en-desarrollo", "planeado", "considerando")
ETIQUETA_DE_ESTADO = {f"roadmap:{e}": e for e in ESTADOS}

# Seccion de la pagina: id, clase de la etiqueta de color y textos por idioma.
SECCIONES = {
    "en-desarrollo": {
        "id": "en-desarrollo", "clase": "nov",
        "titulo": {"es": "En desarrollo", "en": "In development", "fr": "En développement"},
        "etiqueta": {"es": "Para la próxima actualización", "en": "For the next update", "fr": "Pour la prochaine mise à jour"},
    },
    "planeado": {
        "id": "planeado", "clase": "mej",
        "titulo": {"es": "Planeado", "en": "Planned", "fr": "Prévu"},
        "etiqueta": {"es": "Para más adelante", "en": "Further ahead", "fr": "Pour plus tard"},
    },
    "considerando": {
        "id": "bajo-consideracion", "clase": "cor",
        "titulo": {"es": "Bajo consideración", "en": "Under consideration", "fr": "À l'étude"},
        "etiqueta": {"es": "Todavía en estudio, sin decisión tomada", "en": "Still under review, no decision yet", "fr": "Encore à l'étude, aucune décision prise"},
    },
}

BLOQUE = re.compile(r"<!--\s*roadmap\b(.*?)-->", re.DOTALL | re.IGNORECASE)
CLAVE = re.compile(r"^\s*(titulo|desc)(?:-(en|fr))?\s*:\s*(.*?)\s*$")


class ErrorRoadmap(Exception):
    pass


def limpiar(texto, maximo):
    """Una linea, sin caracteres de control y acotada. El escape de HTML se hace al pintar."""
    texto = re.sub(r"[\x00-\x1f\x7f]+", " ", texto or "")
    texto = re.sub(r"\s+", " ", texto).strip()
    return texto[:maximo].rstrip()


def leer_bloque(cuerpo):
    """Claves titulo/desc (+ -en/-fr) del primer bloque <!-- roadmap ... --> del cuerpo."""
    m = BLOQUE.search(cuerpo or "")
    campos = {}
    if not m:
        return campos
    for linea in m[1].splitlines():
        c = CLAVE.match(linea)
        if c and c[3]:
            campos[(c[1], c[2] or "es")] = c[3]
    return campos


def estado_de(issue):
    nombres = {e["name"] if isinstance(e, dict) else e for e in issue.get("labels", [])}
    for etiqueta, estado in ETIQUETA_DE_ESTADO.items():
        if etiqueta in nombres:
            return estado
    return None


def a_elemento(issue, hoy, avisos):
    """Issue de la API -> elemento publicable, o None si no toca publicarlo."""
    if "pull_request" in issue:
        return None
    estado = estado_de(issue)
    if estado is None:
        return None
    hecho = issue.get("state") == "closed"
    if hecho:
        cerrado = (issue.get("closed_at") or "")[:10]
        try:
            dias = (hoy - datetime.date.fromisoformat(cerrado)).days
        except ValueError:
            raise ErrorRoadmap(f"issue #{issue.get('number')} cerrado sin fecha de cierre valida")
        if dias > DIAS_HECHO:
            return None
    campos = leer_bloque(issue.get("body"))
    titulos = {i: limpiar(campos.get(("titulo", i), ""), MAX_TITULO) for i in IDIOMAS}
    descripciones = {i: limpiar(campos.get(("desc", i), ""), MAX_DESCRIPCION) for i in IDIOMAS}
    titulos["es"] = titulos["es"] or limpiar(issue.get("title"), MAX_TITULO)
    if not titulos["es"]:
        raise ErrorRoadmap(f"issue #{issue.get('number')} sin titulo")
    sin_traducir = [i for i in ("en", "fr") if not titulos[i]]
    for idioma in sin_traducir:
        # Sin titulo traducido sale todo el texto en español: no se mezclan idiomas.
        titulos[idioma], descripciones[idioma] = titulos["es"], descripciones["es"]
    if sin_traducir:
        avisos.append(f"#{issue.get('number')} sin traduccion al {'/'.join(sin_traducir)}: sale el texto en español")
    return {
        "numero": issue.get("number", 0), "repo": issue.get("_repo", ""), "estado": estado,
        "hecho": hecho, "titulo": titulos, "descripcion": descripciones,
    }


def elementos(issues, hoy):
    avisos = []
    lista = [e for e in (a_elemento(i, hoy, avisos) for i in issues) if e]
    # Abiertos antes que hechos; dentro de cada grupo, por repo y numero (estable).
    lista.sort(key=lambda e: (e["hecho"], e["repo"], e["numero"]))
    return lista, avisos


def pintar_elemento(e, idioma):
    t = html.escape(e["titulo"][idioma], quote=True)
    d = html.escape(e["descripcion"][idioma], quote=True)
    cuerpo = f"<strong>{t}</strong>" + (f" — {d}" if d else "")
    return f'      <li class="hecho"><s>{cuerpo}</s></li>' if e["hecho"] else f"      <li>{cuerpo}</li>"


def pintar(lista):
    partes = []
    for idioma in IDIOMAS:
        partes.append(f'<article lang="{idioma}">')
        for estado in ESTADOS:
            propios = [e for e in lista if e["estado"] == estado]
            if not propios:
                continue
            s = SECCIONES[estado]
            partes.append(f'''<section class="novedad" id="{s["id"]}">
  <div class="novedad-cuerpo">
    <div class="version-titulo"><h2>{html.escape(s["titulo"][idioma])}</h2></div>
    <h3 class="etiqueta {s["clase"]}">{html.escape(s["etiqueta"][idioma])}</h3>
    <ul>
''' + "\n".join(pintar_elemento(e, idioma) for e in propios) + '''
    </ul>
  </div>
</section>''')
        partes.append("</article>")
        partes.append("")
    return "\n".join(partes).rstrip("\n")


def insertar(pagina, bloque):
    i, f = pagina.find(MARCA_INICIO), pagina.find(MARCA_FIN)
    if i < 0 or f < i:
        raise ErrorRoadmap(f"faltan los marcadores {MARCA_INICIO} / {MARCA_FIN} en la pagina")
    return pagina[: i + len(MARCA_INICIO)] + "\n" + bloque + "\n" + pagina[f:]


def token_para(repo):
    if os.environ.get("ROADMAP_TOKEN"):
        return os.environ["ROADMAP_TOKEN"]
    if repo == os.environ.get("GITHUB_REPOSITORY") and os.environ.get("GITHUB_TOKEN"):
        return os.environ["GITHUB_TOKEN"]
    if os.environ.get("GITHUB_ACTIONS"):
        raise ErrorRoadmap(
            f"falta el secreto ROADMAP_TOKEN para leer los issues de {repo} "
            "(alta paso a paso en docs/roadmap.md)")
    try:
        return subprocess.run(["gh", "auth", "token"], check=True, capture_output=True, text=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        raise ErrorRoadmap(f"sin token para {repo}: define ROADMAP_TOKEN o haz `gh auth login`")


def peticion(url, token):
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "getswiftpen-roadmap"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r), r.headers.get("Link", "")


def issues_de(repo):
    token = token_para(repo)
    por_numero = {}
    for etiqueta in ETIQUETA_DE_ESTADO:
        url = f"https://api.github.com/repos/{repo}/issues?state=all&per_page=100&labels={urllib.parse.quote(etiqueta)}"
        while url:
            try:
                datos, enlaces = peticion(url, token)
            except urllib.error.HTTPError as e:
                raise ErrorRoadmap(f"GitHub respondio {e.code} al leer los issues de {repo} (¿token sin permiso de lectura de Issues?)")
            except urllib.error.URLError as e:
                raise ErrorRoadmap(f"no se pudo leer {repo}: {e.reason}")
            for issue in datos:
                issue["_repo"] = repo
                por_numero[issue["number"]] = issue
            m = re.search(r'<([^>]+)>;\s*rel="next"', enlaces)
            url = m[1] if m else None
    return list(por_numero.values())


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true", help="imprime el bloque generado y no escribe nada")
    ap.add_argument("--ejemplo", metavar="JSON", help="lee los issues de este fichero en vez de la API")
    ap.add_argument("--hoy", metavar="AAAA-MM-DD", help="fecha de referencia para los «hecho»")
    ap.add_argument("--pagina", default=str(PAGINA), help="pagina a reescribir")
    args = ap.parse_args(argv)

    hoy = datetime.date.fromisoformat(args.hoy) if args.hoy else datetime.datetime.now(datetime.timezone.utc).date()
    try:
        if args.ejemplo:
            issues = json.loads(pathlib.Path(args.ejemplo).read_text())
        else:
            issues = [i for repo in FUENTES for i in issues_de(repo)]
        lista, avisos = elementos(issues, hoy)
    except ErrorRoadmap as e:
        print(f"roadmap: ERROR: {e}", file=sys.stderr)
        return 1
    for a in avisos:
        print(f"roadmap: aviso: {a}", file=sys.stderr)

    if not lista:
        print("roadmap: aviso: ningun issue publicable (etiquetas roadmap:*); se conserva la pagina actual", file=sys.stderr)
        return 0
    bloque = pintar(lista)
    if args.dry_run:
        print(bloque)
        return 0
    ruta = pathlib.Path(args.pagina)
    try:
        actual = ruta.read_text()
        nuevo = insertar(actual, bloque)
    except ErrorRoadmap as e:
        print(f"roadmap: ERROR: {e}", file=sys.stderr)
        return 1
    if nuevo == actual:
        print(f"roadmap: sin cambios ({len(lista)} elementos)")
    else:
        ruta.write_text(nuevo)
        print(f"roadmap: {ruta} actualizada ({len(lista)} elementos)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
