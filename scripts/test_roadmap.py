import datetime
import json
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import roadmap

HOY = datetime.date(2026, 10, 25)


def issue(numero, etiquetas, titulo="Titulo", estado="open", cerrado=None, cuerpo=""):
    return {"number": numero, "state": estado, "closed_at": cerrado, "title": titulo,
            "labels": [{"name": e} for e in etiquetas], "body": cuerpo}


def elementos(*issues):
    return roadmap.elementos(list(issues), HOY)


class MapeoDeEtiquetas(unittest.TestCase):
    def test_cada_etiqueta_de_estado_va_a_su_seccion(self):
        lista, _ = elementos(
            issue(1, ["roadmap:en-desarrollo"]), issue(2, ["roadmap:planeado"]), issue(3, ["roadmap:considerando"]))
        self.assertEqual([e["estado"] for e in lista], ["en-desarrollo", "planeado", "considerando"])

    def test_sin_etiqueta_de_roadmap_no_se_publica(self):
        lista, _ = elementos(issue(1, ["bug", "feedback"]), issue(2, ["roadmap"]))
        self.assertEqual(lista, [])

    def test_los_pull_requests_no_se_publican(self):
        pr = issue(1, ["roadmap:planeado"])
        pr["pull_request"] = {}
        self.assertEqual(elementos(pr)[0], [])

    def test_con_varias_etiquetas_de_estado_gana_la_mas_avanzada(self):
        lista, _ = elementos(issue(1, ["roadmap:considerando", "roadmap:en-desarrollo"]))
        self.assertEqual(lista[0]["estado"], "en-desarrollo")


class Cerrados(unittest.TestCase):
    def test_cerrado_reciente_sale_como_hecho(self):
        lista, _ = elementos(issue(1, ["roadmap:planeado"], estado="closed", cerrado="2026-10-20T10:00:00Z"))
        self.assertTrue(lista[0]["hecho"])
        self.assertIn('class="hecho"', roadmap.pintar(lista))

    def test_cerrado_hace_mas_de_la_ventana_desaparece(self):
        viejo = (HOY - datetime.timedelta(days=roadmap.DIAS_HECHO + 1)).isoformat() + "T00:00:00Z"
        self.assertEqual(elementos(issue(1, ["roadmap:planeado"], estado="closed", cerrado=viejo))[0], [])

    def test_el_ultimo_dia_de_la_ventana_todavia_sale(self):
        limite = (HOY - datetime.timedelta(days=roadmap.DIAS_HECHO)).isoformat() + "T00:00:00Z"
        self.assertEqual(len(elementos(issue(1, ["roadmap:planeado"], estado="closed", cerrado=limite))[0]), 1)

    def test_los_abiertos_van_antes_que_los_hechos(self):
        lista, _ = elementos(
            issue(1, ["roadmap:planeado"], estado="closed", cerrado="2026-10-24T00:00:00Z"), issue(2, ["roadmap:planeado"]))
        self.assertEqual([e["numero"] for e in lista], [2, 1])


class Idiomas(unittest.TestCase):
    def test_titulos_y_descripciones_por_idioma_desde_el_bloque(self):
        cuerpo = "interno\n<!-- roadmap\ntitulo-en: Text boxes\ntitulo-fr: Zones de texte\ndesc: Hola\ndesc-en: Hello\ndesc-fr: Salut\n-->"
        e = elementos(issue(1, ["roadmap:planeado"], titulo="Cajas de texto", cuerpo=cuerpo))[0][0]
        self.assertEqual(e["titulo"], {"es": "Cajas de texto", "en": "Text boxes", "fr": "Zones de texte"})
        self.assertEqual(e["descripcion"], {"es": "Hola", "en": "Hello", "fr": "Salut"})

    def test_el_titulo_es_puede_sobrescribirse_en_el_bloque(self):
        e = elementos(issue(1, ["roadmap:planeado"], titulo="Interno", cuerpo="<!-- roadmap\ntitulo: Público\n-->"))[0][0]
        self.assertEqual(e["titulo"]["es"], "Público")

    def test_sin_traduccion_sale_el_español_y_avisa(self):
        lista, avisos = elementos(issue(7, ["roadmap:planeado"], titulo="Solo español", cuerpo="<!-- roadmap\ntitulo-en: Only en\n-->"))
        self.assertEqual(lista[0]["titulo"], {"es": "Solo español", "en": "Only en", "fr": "Solo español"})
        self.assertEqual(len(avisos), 1)
        self.assertIn("#7", avisos[0])
        self.assertIn("fr", avisos[0])

    def test_el_resto_del_cuerpo_no_se_publica(self):
        pagina = roadmap.pintar(elementos(issue(1, ["roadmap:planeado"], cuerpo="Secreto interno\n<!-- roadmap\ndesc: Publico\n-->"))[0])
        self.assertNotIn("Secreto", pagina)
        self.assertIn("Publico", pagina)


class Escape(unittest.TestCase):
    def test_titulos_y_descripciones_se_escapan(self):
        malo = '<script>alert(1)</script> & "x"'
        cuerpo = f"<!-- roadmap\ntitulo-en: {malo}\ndesc-fr: <img src=x onerror=1>\n-->"
        pagina = roadmap.pintar(elementos(issue(1, ["roadmap:planeado"], titulo=malo, cuerpo=cuerpo))[0])
        self.assertNotIn("<script>", pagina)
        self.assertNotIn("<img", pagina)
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;", pagina)

    def test_los_saltos_de_linea_del_titulo_no_rompen_el_html(self):
        e = elementos(issue(1, ["roadmap:planeado"], titulo="uno\ntwo\x00"))[0][0]
        self.assertEqual(e["titulo"]["es"], "uno two")


class Generacion(unittest.TestCase):
    def test_es_determinista_aunque_cambie_el_orden_de_entrada(self):
        a, b = issue(1, ["roadmap:planeado"], titulo="A"), issue(2, ["roadmap:planeado"], titulo="B")
        self.assertEqual(roadmap.pintar(elementos(a, b)[0]), roadmap.pintar(elementos(b, a)[0]))

    def test_las_secciones_vacias_no_se_pintan(self):
        pagina = roadmap.pintar(elementos(issue(1, ["roadmap:planeado"]))[0])
        self.assertIn('id="planeado"', pagina)
        self.assertNotIn('id="en-desarrollo"', pagina)
        self.assertEqual(pagina.count("<article"), 3)

    def test_insertar_reemplaza_solo_entre_marcadores(self):
        base = f"antes\n{roadmap.MARCA_INICIO}\nviejo\n{roadmap.MARCA_FIN}\ndespues"
        self.assertEqual(roadmap.insertar(base, "nuevo"), f"antes\n{roadmap.MARCA_INICIO}\nnuevo\n{roadmap.MARCA_FIN}\ndespues")

    def test_insertar_sin_marcadores_falla(self):
        with self.assertRaises(roadmap.ErrorRoadmap):
            roadmap.insertar("sin marcas", "x")


class Programa(unittest.TestCase):
    def pagina_temporal(self):
        d = pathlib.Path(tempfile.mkdtemp())
        p = d / "index.html"
        p.write_text(f"a\n{roadmap.MARCA_INICIO}\nVIEJO\n{roadmap.MARCA_FIN}\nb")
        return p

    def ejemplo(self, issues):
        f = pathlib.Path(tempfile.mkdtemp()) / "issues.json"
        f.write_text(json.dumps(issues))
        return str(f)

    def test_sin_issues_publicables_conserva_la_pagina(self):
        p = self.pagina_temporal()
        codigo = roadmap.main(["--ejemplo", self.ejemplo([issue(1, ["bug"])]), "--pagina", str(p), "--hoy", "2026-10-25"])
        self.assertEqual(codigo, 0)
        self.assertIn("VIEJO", p.read_text())

    def test_dry_run_no_escribe(self):
        p = self.pagina_temporal()
        roadmap.main(["--ejemplo", self.ejemplo([issue(1, ["roadmap:planeado"])]), "--pagina", str(p), "--dry-run", "--hoy", "2026-10-25"])
        self.assertIn("VIEJO", p.read_text())

    def test_escribe_la_pagina_y_es_idempotente(self):
        p = self.pagina_temporal()
        args = ["--ejemplo", self.ejemplo([issue(1, ["roadmap:planeado"], titulo="Nuevo")]), "--pagina", str(p), "--hoy", "2026-10-25"]
        self.assertEqual(roadmap.main(args), 0)
        primera = p.read_text()
        self.assertIn("Nuevo", primera)
        self.assertNotIn("VIEJO", primera)
        roadmap.main(args)
        self.assertEqual(p.read_text(), primera)

    def test_el_ejemplo_del_repo_genera_sin_errores(self):
        ejemplo = pathlib.Path(__file__).with_name("roadmap_ejemplo.json")
        issues = json.loads(ejemplo.read_text())
        lista, _ = roadmap.elementos(issues, HOY)
        self.assertEqual([e["numero"] for e in lista], [1, 2, 3, 4])


if __name__ == "__main__":
    unittest.main()
