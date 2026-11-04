// Pruebas del zoom anclado (issue #100) sobre una vista real (crearVista en el DOM del visor): el
// punto de la nota bajo el cursor no se mueve en pantalla durante una rafaga de Ctrl+rueda (con la
// escala CSS del gesto aun puesta) ni tras el redibujo nitido.
import { leerNota } from "/sitio/visor/formato.js";
import { prepararNota } from "/sitio/visor/pintar.js";
import { crearVista } from "/sitio/visor/vista.js";
import { capturarZoom } from "/sitio/visor/captura-zoom.js";

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const fotograma = () => new Promise((r) => requestAnimationFrame(() => r()));
const rueda = (x, y, deltaY) => document.dispatchEvent(new WheelEvent("wheel", { ctrlKey: true, deltaY, clientX: x, clientY: y, bubbles: true, cancelable: true }));

function montar({ paginas, infinito }) {
  const escenario = document.createElement("div");
  escenario.className = "visor-escenario";
  escenario.style.cssText = "position:fixed;left:50px;top:40px;width:800px;height:600px";
  escenario.innerHTML = '<div class="visor-desplazador"><div class="visor-pliego"><canvas class="visor-lienzo" tabindex="0"></canvas></div></div>';
  document.body.append(escenario);
  const nota = leerNota(JSON.stringify({
    id: "z", title: "z", dpi: 320, pageCount: paginas, lienzoInfinito: infinito,
    strokes: [[{ x1: 300, y1: 300, x2: 900, y2: 900, halfWidth: 40, color: -65536 }]],
  }));
  const lienzo = escenario.querySelector("canvas");
  const vista = crearVista(lienzo, prepararNota(nota), new Map());
  const quitar = capturarZoom(document, { hayNota: () => true, alZoom: vista.zoomEnPantalla, alTecla: () => {} });
  return { vista, desplazador: escenario.querySelector(".visor-desplazador"), limpiar: () => { quitar(); vista.destruir(); escenario.remove(); } };
}

export function registrar(prueba, igual) {
  const casos = [["1 pagina", { paginas: 1 }], ["3 paginas", { paginas: 3 }], ["12 paginas", { paginas: 12 }], ["lienzo infinito", { infinito: true }]];
  for (const [nombre, cfg] of casos) for (const [sentido, deltaY] of [["in", -30], ["out", 30]]) {
    prueba(`zoom ${sentido} con Ctrl+rueda en rafaga (${nombre}): el punto bajo el cursor no salta (<= 1 px)`, async () => {
      const e = montar(cfg);
      await espera(200);
      if (sentido === "out") { for (let i = 0; i < 4; i++) { rueda(450, 340, -60); await fotograma(); } await espera(300); }
      for (const c of [[450, 340], [200, 150], [700, 500]]) {
        const r = e.desplazador.getBoundingClientRect();
        const bajoCursor = () => { const v = e.vista.estado(); return [v.izquierda + (c[0] - r.left) / v.zoom, v.arriba + (c[1] - r.top) / v.zoom, v.zoom]; };
        const u0 = bajoCursor();
        for (let i = 0; i < 4; i++) { rueda(c[0], c[1], deltaY); await fotograma(); }
        const u1 = bajoCursor();
        await espera(300);   // redibujo nitido
        const u2 = bajoCursor();
        const salto = (u) => Math.hypot(u[0] - u0[0], u[1] - u0[1]) * u[2];
        if (salto(u1) > 1 || salto(u2) > 1) { e.limpiar(); throw new Error(`cursor ${c}: salto ${salto(u1).toFixed(1)} px en la rafaga y ${salto(u2).toFixed(1)} px tras el redibujo`); }
      }
      e.limpiar();
    });
  }
}
