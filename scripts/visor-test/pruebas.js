// Pruebas del visor, sin librerias: cada prueba lanza si falla. scripts/test_visor.py las ejecuta
// en Chromium headless y lee el resultado de #resultado.
import {
  esFicheroDeNota, esFicheroDeCarpeta, leerNota, resumenDeNota, leerCarpeta, rutaDeCarpeta,
  ordenarNotas, filtrarNotas, nombreDeImagen,
} from "/sitio/visor/formato.js";
import { calcularHojas } from "/sitio/visor/maqueta.js";
import {
  cajaDeHojas, zoomDeAjuste, limitarZoom, zoomHaciaPunto, acotarVista, paginaActual, vistaDePagina, factorDeRueda,
  ZOOM_MIN_RELATIVO, ZOOM_MAX_RELATIVO,
} from "/sitio/visor/gestos.js";
import { colorDe, prepararNota, dibujarMiniatura, dibujarRegion } from "/sitio/visor/pintar.js";

const pruebas = [];
const prueba = (nombre, fn) => pruebas.push([nombre, fn]);
const igual = (a, b, msg = "") => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} esperado ${JSON.stringify(b)}, salio ${JSON.stringify(a)}`);
};
const lanza = (fn) => { try { fn(); } catch (e) { return; } throw new Error("no lanzo"); };
const nota = (extra = {}) => JSON.stringify({ id: "n1", title: "T", ...extra });
const seg = (x1, y1, x2, y2, extra = {}) => ({ x1, y1, x2, y2, halfWidth: 4, color: -16777216, ...extra });

// ---- nombres de fichero ----
prueba("reconoce ficheros de nota y de carpeta", () => {
  igual(esFicheroDeNota("note-123.json"), true);
  igual(esFicheroDeNota("folder-123.json"), false);
  igual(esFicheroDeNota("note-123.json.tmp"), false);
  igual(esFicheroDeCarpeta("folder-abc.json"), true);
  igual(nombreDeImagen("n", "i"), "image-n_i.webp");
});

// ---- parser ----
prueba("nota minima: valores por defecto", () => {
  const n = leerNota(nota());
  igual(n.titulo, "T"); igual(n.trazos, []); igual(n.bloqueada, false); igual(n.borradaEn, null);
  igual(n.papel.horizontal, false); igual(n.papel.tamano, { corto: 210, largo: 297 });
});
prueba("segmento: color por defecto -1 y grosor por defecto", () => {
  const n = leerNota(nota({ strokes: [[{ x1: 1, y1: 2, x2: 3, y2: 4 }]] }));
  igual(n.trazos[0][0].color, -1); igual(n.trazos[0][0].x2, 3);
});
prueba("ignora campos desconocidos", () => {
  igual(leerNota(nota({ campoNuevo: { a: 1 } })).id, "n1");
});
prueba("JSON roto, sin id o que no es objeto: lanza", () => {
  lanza(() => leerNota("{no"));
  lanza(() => leerNota("[]"));
  lanza(() => leerNota(JSON.stringify({ title: "x" })));
  lanza(() => resumenDeNota("{no"));
});
prueba("fecha: lastModifiedAt, o updatedAt si no hay", () => {
  igual(resumenDeNota(nota({ lastModifiedAt: 5, updatedAt: 9 })).fecha, 5);
  igual(resumenDeNota(nota({ updatedAt: 9 })).fecha, 9);
});
prueba("resumen: bloqueada, fijada y borrada", () => {
  const r = resumenDeNota(nota({ bloqueada: true, fijada: true, deletedAt: 12 }));
  igual([r.bloqueada, r.fijada, r.borrada], [true, true, true]);
  igual(resumenDeNota(nota()).borrada, false);
});
prueba("papeles por pagina: claves como texto", () => {
  const n = leerNota(nota({ paperColor: -1, pagePapers: { "1": { orientation: "HORIZONTAL", size: { ladoCortoMm: 148, ladoLargoMm: 210 } } } }));
  igual(n.papeles[1].horizontal, true); igual(n.papeles[1].tamano, { corto: 148, largo: 210 });
  igual(n.papeles[1].color, -1, "hereda el color de la nota");
});
prueba("cajas de texto se marcan, no se tratan como imagen", () => {
  const n = leerNota(nota({ imagenes: [{ id: "a" }, { id: "b", texto: { tramos: [] } }] }));
  igual(n.imagenes.map((i) => i.esCajaDeTexto), [false, true]);
});
prueba("carpeta y ruta con ciclo", () => {
  const cs = new Map([["a", leerCarpeta(JSON.stringify({ id: "a", name: "A", parentId: "b" }))],
    ["b", leerCarpeta(JSON.stringify({ id: "b", name: "B", parentId: "a" }))]]);
  igual(rutaDeCarpeta(cs, "a"), "B / A");
  const s = new Map([["p", { id: "p", nombre: "Padre", padreId: null }], ["h", { id: "h", nombre: "Hija", padreId: "p" }]]);
  igual(rutaDeCarpeta(s, "h"), "Padre / Hija");
});

// ---- orden y filtros ----
const r = (id, titulo, extra = {}) => ({ id, titulo, carpetaId: null, fecha: 0, bloqueada: false, fijada: false, borrada: false, ...extra });
prueba("orden: oculta borradas, fijadas primero, luego mas recientes", () => {
  const orden = ordenarNotas([r("a", "A", { fecha: 1 }), r("b", "B", { fecha: 3 }), r("c", "C", { borrada: true, fecha: 9 }),
    r("d", "D", { fijada: true, fecha: 0 }), r("e", "E", { fecha: 3 })]);
  igual(orden.map((n) => n.id), ["d", "b", "e", "a"]);
});
prueba("filtros: busqueda sin acentos ni mayusculas, y carpeta", () => {
  const notas = [r("a", "Reunión Álvaro", { carpetaId: "f" }), r("b", "Compra"), r("c", "reunion 2")];
  igual(filtrarNotas(notas, { busqueda: "REUNION" }).map((n) => n.id), ["a", "c"]);
  igual(filtrarNotas(notas, { carpetaId: "f" }).map((n) => n.id), ["a"]);
  igual(filtrarNotas(notas, { carpetaId: null }).map((n) => n.id), ["b", "c"]);
  igual(filtrarNotas(notas).length, 3);
});

// ---- maqueta ----
prueba("hojas: A4 vertical a 320 dpi, una sola vacia", () => {
  const h = calcularHojas(leerNota(nota({ dpi: 320 })));
  igual(h.length, 1);
  igual([Math.round(h[0].ancho), Math.round(h[0].alto)], [2646, 3742]);
});
prueba("hojas: la tinta mas abajo crea mas hojas, con hueco de 60", () => {
  const n = leerNota(nota({ dpi: 320, strokes: [[seg(10, 4000, 20, 4000)]] }));
  const h = calcularHojas(n);
  igual(h.length, 2);
  igual(Math.round(h[1].arriba - (h[0].arriba + h[0].alto)), 60);
});
prueba("hojas: pageCount y orientacion de una pagina", () => {
  const n = leerNota(nota({ dpi: 320, pageCount: 3, pagePapers: { "1": { orientation: "HORIZONTAL" } } }));
  const h = calcularHojas(n);
  igual(h.length, 3);
  igual(h[1].ancho > h[1].alto, true);
});
prueba("hojas: lienzo infinito es una sola hoja que abarca el contenido", () => {
  const n = leerNota(nota({ lienzoInfinito: true, strokes: [[seg(-500, -500, 900, 700)]] }));
  const h = calcularHojas(n);
  igual(h.length, 1);
  igual(h[0].izquierda < -500 && h[0].izquierda + h[0].ancho > 900, true);
});

// ---- dibujo ----
const pixel = (ctx, x, y) => [...ctx.getImageData(x, y, 1, 1).data];
const lienzoDe = (n, ancho = 100) => {
  const prep = prepararNota(leerNota(JSON.stringify(n)));
  const hoja = prep.hojas[0];
  const alto = Math.round(hoja.alto * ancho / hoja.ancho);
  const c = new OffscreenCanvas(ancho, alto);
  const ctx = c.getContext("2d");
  dibujarMiniatura(ctx, prep, new Map(), ancho);
  return { ctx, escala: ancho / hoja.ancho, hoja };
};
prueba("colorDe: ARGB con signo", () => {
  igual(colorDe(-16777216), { css: "rgb(0 0 0)", alfa: 1 });
  igual(colorDe(0xFFFF0000 | 0).css, "rgb(255 0 0)");
  igual(Math.round(colorDe(0x80FF0000 | 0).alfa * 100), 50);
});
prueba("papel liso del color de la nota", () => {
  const { ctx } = lienzoDe({ id: "n", dpi: 320, paperColor: 0xFF102030 | 0 });
  igual(pixel(ctx, 50, 50), [16, 32, 48, 255]);
});
prueba("trazo: color, grosor y extremos redondos", () => {
  const { ctx, escala } = lienzoDe({ id: "n", dpi: 320, paperColor: -1, strokes: [[seg(500, 500, 1500, 500, { halfWidth: 40, color: 0xFFFF0000 | 0 })]] });
  igual(pixel(ctx, Math.round(1000 * escala), Math.round(500 * escala)), [255, 0, 0, 255]);
  igual(pixel(ctx, Math.round(1000 * escala), Math.round(600 * escala)), [255, 255, 255, 255], "fuera del grosor");
  igual(pixel(ctx, Math.round(1530 * escala), Math.round(500 * escala))[0], 255, "el extremo redondo sobresale");
});
prueba("goma parcial borra solo su trazo", () => {
  const trazo = [seg(100, 500, 2000, 500, { halfWidth: 40, color: 0xFF0000FF | 0 })];
  const marca = [seg(1000, 500, 1100, 500, { halfWidth: 80 })];
  const { ctx, escala } = lienzoDe({ id: "n", dpi: 320, paperColor: -1, strokes: [trazo], eraseMarks: [marca] });
  igual(pixel(ctx, Math.round(1050 * escala), Math.round(500 * escala)), [255, 255, 255, 255], "borrado");
  igual(pixel(ctx, Math.round(400 * escala), Math.round(500 * escala)), [0, 0, 255, 255], "intacto");
});
prueba("resaltador (alfa) va debajo de la tinta", () => {
  const tinta = [seg(100, 500, 2000, 500, { halfWidth: 100, color: 0xFF000000 | 0 })];
  const resaltador = [seg(100, 500, 2000, 500, { halfWidth: 300, color: 0x80FFFF00 | 0 })];
  const { ctx, escala } = lienzoDe({ id: "n", dpi: 320, paperColor: -1, strokes: [tinta, resaltador] });
  igual(pixel(ctx, Math.round(1000 * escala), Math.round(500 * escala)), [0, 0, 0, 255], "tinta encima");
  const lado = pixel(ctx, Math.round(1000 * escala), Math.round(700 * escala));
  igual(lado[0] > 200 && lado[2] < 200, true, "amarillo claro al lado: " + lado);
});
prueba("imagen que falta no rompe el dibujo", () => {
  lienzoDe({ id: "n", dpi: 320, imagenes: [{ id: "x", centroX: 500, centroY: 500, ancho: 200, alto: 200 }] });
});
prueba("imagen presente se dibuja con su volteo", async () => {
  const fuente = new OffscreenCanvas(2, 1);
  const fc = fuente.getContext("2d");
  fc.fillStyle = "#f00"; fc.fillRect(0, 0, 1, 1); fc.fillStyle = "#00f"; fc.fillRect(1, 0, 1, 1);
  const bitmap = await createImageBitmap(fuente);
  const prep = prepararNota(leerNota(JSON.stringify({ id: "n", dpi: 320, paperColor: -1, imagenes: [{ id: "i", centroX: 1000, centroY: 1000, ancho: 400, alto: 200, volteadaH: true }] })));
  const c = new OffscreenCanvas(200, 200);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  dibujarRegion(ctx, prep, new Map([["i", bitmap]]), 900, 900, 1, 200, 200);
  igual(pixel(ctx, 50, 100).slice(0, 3), [0, 0, 255], "izquierda: era la derecha (azul)");
  igual(pixel(ctx, 150, 100).slice(0, 3), [255, 0, 0], "derecha: roja");
});

// ---- paginas, zoom y gestos ----
const cerca = (a, b, tol = 1e-6, msg = "") => { if (Math.abs(a - b) > tol) throw new Error(`${msg} esperado ${b}, salio ${a}`); };
const hojasDe = (n, extra = {}) => calcularHojas(leerNota(JSON.stringify({ id: "n", dpi: 320, pageCount: n, ...extra })));
prueba("parser de paginas: 12 hojas en vertical, separadas por 60 y centradas", () => {
  const h = hojasDe(12);
  igual(h.length, 12);
  for (let i = 1; i < 12; i++) cerca(h[i].arriba, h[i - 1].arriba + h[i - 1].alto + 60, 1e-6, `hoja ${i}`);
  igual(h.every((x) => Math.abs(x.izquierda - h[0].izquierda) < 1e-6), true);
});
prueba("paginas: una apaisada en medio se centra sobre la columna y desplaza las siguientes", () => {
  const h = hojasDe(3, { pagePapers: { "1": { orientation: "HORIZONTAL" } } });
  igual(h[1].ancho > h[1].alto, true);
  cerca(h[1].izquierda + h[1].ancho / 2, h[0].izquierda + h[0].ancho / 2, 1e-6, "centro");
  cerca(h[2].arriba, h[1].arriba + h[1].alto + 60);
});
prueba("paginas: el contenido mas abajo que pageCount amplia la nota", () => {
  igual(hojasDe(2, { strokes: [[seg(0, 3802 * 4 + 100, 10, 3802 * 4 + 100)]] }).length, 5);
});
const vista = (extra = {}) => ({ zoom: 0.2, izquierda: 0, arriba: 0, ...extra });
prueba("pagina actual: la que cruza la linea central; en el hueco, la de arriba", () => {
  const h = hojasDe(12);
  igual(paginaActual(h, vista({ arriba: 0 }), 500), 0);
  igual(paginaActual(h, vista({ arriba: h[2].arriba - 100 }), 500), 2);
  const hueco = h[0].arriba + h[0].alto + 30;
  igual(paginaActual(h, vista({ arriba: hueco - 250 / 0.2 * 1 / 1 }), 500), 0, "centro en el hueco");
  igual(paginaActual(h, vista({ arriba: h[11].arriba + 5000 }), 500), 11, "mas alla de la ultima");
  igual(paginaActual(h, vista({ arriba: -5000 }), 500), 0, "antes de la primera");
});
prueba("salto de pagina: la hoja queda arriba y centrada", () => {
  const h = hojasDe(12);
  const v = vistaDePagina(h, 6, 800, 0.2);
  cerca(v.izquierda + 800 / 0.2 / 2, h[6].izquierda + h[6].ancho / 2, 1e-6, "centrada");
  igual(v.arriba <= h[6].arriba && h[6].arriba - v.arriba < 100, true);
  igual(paginaActual(h, v, 600), 6);
  igual(vistaDePagina(h, 99, 800, 0.2).arriba, vistaDePagina(h, 11, 800, 0.2).arriba, "se acota a la ultima");
});
prueba("limites de zoom: relativos al ajuste", () => {
  cerca(limitarZoom(100, 0.2), 0.2 * ZOOM_MAX_RELATIVO);
  cerca(limitarZoom(0.0001, 0.2), 0.2 * ZOOM_MIN_RELATIVO);
  cerca(limitarZoom(0.3, 0.2), 0.3);
});
prueba("zoom hacia el cursor: el punto bajo el cursor no se mueve", () => {
  const v0 = vista({ zoom: 0.2, izquierda: 100, arriba: 400 });
  const v1 = zoomHaciaPunto(v0, 2, 300, 200, 0.2);
  cerca(v1.zoom, 0.4);
  cerca(v1.izquierda + 300 / v1.zoom, v0.izquierda + 300 / v0.zoom, 1e-9, "x");
  cerca(v1.arriba + 200 / v1.zoom, v0.arriba + 200 / v0.zoom, 1e-9, "y");
});
prueba("zoom hacia el cursor: respeta el limite y el punto sigue fijo", () => {
  const v0 = vista({ zoom: 1.5, izquierda: 10, arriba: 20 });
  const v1 = zoomHaciaPunto(v0, 10, 100, 100, 0.2);
  cerca(v1.zoom, 0.2 * ZOOM_MAX_RELATIVO);
  cerca(v1.izquierda + 100 / v1.zoom, v0.izquierda + 100 / v0.zoom, 1e-9);
});
prueba("ajuste al ancho: cabe la caja con margen", () => {
  const caja = cajaDeHojas(hojasDe(2));
  cerca(zoomDeAjuste(caja, 824) * (caja.x1 - caja.x0), 800);
});
prueba("acotar: no se puede perder el contenido por ningun lado", () => {
  const caja = cajaDeHojas(hojasDe(3));
  const lejos = acotarVista(vista({ izquierda: 1e9, arriba: 1e9 }), caja, 800, 600);
  igual(lejos.izquierda < caja.x1 && lejos.arriba < caja.y1, true);
  const antes = acotarVista(vista({ izquierda: -1e9, arriba: -1e9 }), caja, 800, 600);
  igual(antes.izquierda + 800 / 0.2 > caja.x0 && antes.arriba + 600 / 0.2 > caja.y0, true);
  igual(acotarVista(vista({ izquierda: 10, arriba: 10 }), caja, 800, 600).izquierda, 10, "dentro: no cambia");
});
prueba("rueda con Ctrl: pellizco suave y clic de rueda acotado", () => {
  cerca(factorDeRueda(0), 1);
  igual(factorDeRueda(-5) > 1 && factorDeRueda(5) < 1, true);
  igual(factorDeRueda(-100) === factorDeRueda(-60), true, "acotado");
  igual(factorDeRueda(-3, 1) > factorDeRueda(-3, 0), true, "lineas pesan mas que pixeles");
});

// ---- ejecucion ----
const salida = [];
let fallos = 0;
for (const [nombre, fn] of pruebas) {
  try { await fn(); salida.push(`ok   ${nombre}`); } catch (e) { fallos++; salida.push(`FALLA ${nombre}: ${e.message}`); }
}
salida.push(fallos ? `RESULTADO: ${fallos} FALLOS de ${pruebas.length}` : `RESULTADO: OK ${pruebas.length}`);
document.getElementById("resultado").textContent = salida.join("\n");
