#!/usr/bin/env python3
"""Ejecuta scripts/visor-test/ (pruebas del visor de notas) en Chromium headless.

Sirve la raiz del repo por HTTP local (los modulos ES no cargan desde file://) y lee el
resultado de la pagina. Uso: python3 scripts/test_visor.py
"""
import functools, http.server, pathlib, re, shutil, subprocess, sys, threading

RAIZ = pathlib.Path(__file__).resolve().parent.parent


def main():
    chromium = shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("google-chrome")
    if not chromium:
        sys.exit("test_visor.py: no hay Chromium en el PATH")
    class Silencioso(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    handler = functools.partial(Silencioso, directory=str(RAIZ))
    servidor = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{servidor.server_port}/scripts/visor-test/index.html"
    try:
        dom = subprocess.run(
            [chromium, "--headless=new", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=20000", "--dump-dom", url],
            capture_output=True, text=True, timeout=90, check=True,
        ).stdout
    finally:
        servidor.shutdown()
    m = re.search(r'<pre id="resultado">(.*?)</pre>', dom, re.S)
    if not m:
        sys.exit("test_visor.py: la pagina no dio resultado:\n" + dom[:500])
    import html
    texto = html.unescape(m.group(1))
    print(texto)
    sys.exit(0 if "RESULTADO: OK" in texto else 1)


if __name__ == "__main__":
    main()
