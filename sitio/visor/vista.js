// Vista de una nota: un lienzo con zoom (rueda con Ctrl, pellizco, botones, + y -) y
// desplazamiento (rueda, arrastre, flechas). Redibuja la region visible en cada cambio.
import { dibujarRegion } from "./pintar.js";

const ZOOM_MIN = 0.05, ZOOM_MAX = 8;

export function crearVista(lienzo, preparada, bitmaps) {
  const ctx = lienzo.getContext("2d");
  const hojas = preparada.hojas;
  const caja = {
    x0: Math.min(...hojas.map((h) => h.izquierda)), y0: hojas[0].arriba,
    x1: Math.max(...hojas.map((h) => h.izquierda + h.ancho)),
    y1: hojas[hojas.length - 1].arriba + hojas[hojas.length - 1].alto,
  };
  // zoom en px CSS por unidad de la nota; (izquierda, arriba) = lo que hay en la esquina del lienzo.
  const vista = { zoom: 1, izquierda: 0, arriba: 0 };
  let pendiente = false;

  const ancho = () => lienzo.clientWidth, alto = () => lienzo.clientHeight;

  function acotar() {
    const margen = 48 / vista.zoom;
    vista.izquierda = Math.min(Math.max(vista.izquierda, caja.x0 - ancho() / vista.zoom + margen), caja.x1 - margen);
    vista.arriba = Math.min(Math.max(vista.arriba, caja.y0 - alto() / vista.zoom + margen), caja.y1 - margen);
  }

  function pintar() {
    pendiente = false;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(ancho() * dpr)), h = Math.max(1, Math.round(alto() * dpr));
    if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; }
    ctx.clearRect(0, 0, w, h);
    dibujarRegion(ctx, preparada, bitmaps, vista.izquierda, vista.arriba, vista.zoom * dpr, w, h);
  }
  function pedirPintado() {
    acotar();
    if (!pendiente) { pendiente = true; requestAnimationFrame(pintar); }
  }

  // Cambia el zoom dejando fijo el punto (px, py) del lienzo.
  function zoomEn(factor, px = ancho() / 2, py = alto() / 2) {
    const nuevo = Math.min(Math.max(vista.zoom * factor, ZOOM_MIN), ZOOM_MAX);
    const ux = vista.izquierda + px / vista.zoom, uy = vista.arriba + py / vista.zoom;
    vista.zoom = nuevo;
    vista.izquierda = ux - px / nuevo;
    vista.arriba = uy - py / nuevo;
    pedirPintado();
  }

  // Encaja el ancho de la hoja mas ancha y empieza arriba.
  function encajar() {
    vista.zoom = Math.min(Math.max((ancho() - 24) / (caja.x1 - caja.x0), ZOOM_MIN), ZOOM_MAX);
    vista.izquierda = (caja.x0 + caja.x1) / 2 - ancho() / vista.zoom / 2;
    vista.arriba = caja.y0 - 12 / vista.zoom;
    pedirPintado();
  }

  lienzo.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = lienzo.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomEn(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
    else { vista.izquierda += e.deltaX / vista.zoom; vista.arriba += e.deltaY / vista.zoom; pedirPintado(); }
  }, { passive: false });

  // Arrastre con 1 puntero; con 2, pellizco.
  const punteros = new Map();
  let distancia = 0;
  lienzo.addEventListener("pointerdown", (e) => {
    lienzo.setPointerCapture(e.pointerId);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size === 2) { const [a, b] = [...punteros.values()]; distancia = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  lienzo.addEventListener("pointermove", (e) => {
    const antes = punteros.get(e.pointerId);
    if (!antes) return;
    const ahora = { x: e.clientX, y: e.clientY };
    punteros.set(e.pointerId, ahora);
    if (punteros.size === 1) {
      vista.izquierda -= (ahora.x - antes.x) / vista.zoom;
      vista.arriba -= (ahora.y - antes.y) / vista.zoom;
      pedirPintado();
    } else if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      const nueva = Math.hypot(a.x - b.x, a.y - b.y);
      const r = lienzo.getBoundingClientRect();
      if (distancia > 0) zoomEn(nueva / distancia, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      distancia = nueva;
    }
  });
  const soltar = (e) => { punteros.delete(e.pointerId); distancia = 0; };
  lienzo.addEventListener("pointerup", soltar);
  lienzo.addEventListener("pointercancel", soltar);

  lienzo.addEventListener("keydown", (e) => {
    const paso = 80 / vista.zoom;
    const acciones = {
      "+": () => zoomEn(1.25), "=": () => zoomEn(1.25), "-": () => zoomEn(1 / 1.25), "0": encajar,
      ArrowLeft: () => { vista.izquierda -= paso; pedirPintado(); }, ArrowRight: () => { vista.izquierda += paso; pedirPintado(); },
      ArrowUp: () => { vista.arriba -= paso; pedirPintado(); }, ArrowDown: () => { vista.arriba += paso; pedirPintado(); },
    };
    if (acciones[e.key]) { e.preventDefault(); acciones[e.key](); }
  });

  const observador = new ResizeObserver(pedirPintado);
  observador.observe(lienzo);
  encajar();

  return {
    acercar: () => zoomEn(1.25), alejar: () => zoomEn(1 / 1.25), encajar,
    destruir: () => observador.disconnect(),
  };
}
