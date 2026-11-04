#!/usr/bin/env python3
"""Ejecuta scripts/visor-test/ (pruebas del visor de notas) en Chromium headless.

Sirve la raiz del repo por HTTP local (los modulos ES no cargan desde file://) y recibe el
resultado de la pagina por POST. Uso: python3 scripts/test_visor.py
"""
import functools, http.server, pathlib, shutil, subprocess, sys, tempfile, threading, time

RAIZ = pathlib.Path(__file__).resolve().parent.parent


def main():
    chromium = shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("google-chrome")
    if not chromium:
        sys.exit("test_visor.py: no hay Chromium en el PATH")
    resultado = {}

    class Servidor(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_POST(self):  # la pagina entrega aqui el resultado (tiempo real: los tests usan rAF y temporizadores)
            resultado["texto"] = self.rfile.read(int(self.headers["Content-Length"])).decode()
            self.send_response(200)
            self.end_headers()

    servidor = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Servidor, directory=str(RAIZ)))
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{servidor.server_port}/scripts/visor-test/index.html"
    with tempfile.TemporaryDirectory() as perfil:
        navegador = subprocess.Popen(
            [chromium, "--headless=new", "--disable-gpu", "--no-sandbox", "--window-size=1000,800", f"--user-data-dir={perfil}", url],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        try:
            limite = time.time() + 90
            while "texto" not in resultado and time.time() < limite:
                time.sleep(0.1)
        finally:
            navegador.kill()
            servidor.shutdown()
    if "texto" not in resultado:
        sys.exit("test_visor.py: la pagina no dio resultado en 90 s")
    print(resultado["texto"])
    sys.exit(0 if "RESULTADO: OK" in resultado["texto"] else 1)


if __name__ == "__main__":
    main()
