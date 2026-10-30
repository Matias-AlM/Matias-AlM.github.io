// Vista de una nota: un lienzo con todas las hojas en vertical, una tras otra. Solo se dibuja lo que
// cae en el lienzo (las hojas fuera de la pantalla no cuestan nada ni guardan memoria), y el zoom
// se anima con una escala CSS que se afina con un redibujo al acabar el gesto.
//
// Gestos: rueda = desplazar (dos dedos en un trackpad); Ctrl+rueda o pellizco de trackpad = zoom
// hacia el cursor; Safari manda gesturestart/gesturechange; arrastrar con raton o dedo = mano;
// pellizco tactil; doble clic o doble toque = ajustar al ancho / acercar. Teclas: flechas,
// Re Pag / Av Pag (hoja anterior / siguiente), Home / End, + - 0.
import { dibujarRegion } from "./pintar.js";
import {
  cajaDeHojas, zoomDeAjuste, limitarZoom, zoomHaciaPunto, acotarVista, paginaActual, vistaDePagina, factorDeRueda,
  porcentajeDeZoom, paginasALaVista,
} from "./gestos.js";

const ESPERA_REDIBUJO_MS = 140;

export function crearVista(lienzo, preparada, bitmaps, { alCambiarVista = () => {} } = {}) {
  const ctx = lienzo.getContext("2d");
  const hojas = preparada.hojas;
  const caja = cajaDeHojas(hojas);
  let vista = { zoom: 1, izquierda: 0, arriba: 0 };
  let dibujada = { ...vista };   // la vista con la que se pinto el lienzo por ultima vez
  let pendiente = false, temporizador = 0;

  const ancho = () => lienzo.clientWidth, alto = () => lienzo.clientHeight;
  const ajuste = () => zoomDeAjuste(caja, ancho());
  const estilo = () => getComputedStyle(lienzo);

  function pintar() {
    pendiente = false;
    clearTimeout(temporizador);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(ancho() * dpr)), h = Math.max(1, Math.round(alto() * dpr));
    if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; }
    lienzo.style.transform = "";
    ctx.clearRect(0, 0, w, h);
    const escala = vista.zoom * dpr;
    // Sombra de cada hoja visible, antes que el papel (que la tapa por dentro).
    const css = estilo();
    ctx.save();
    ctx.shadowColor = css.getPropertyValue("--hoja-sombra").trim() || "rgba(0,0,0,.25)";
    ctx.shadowBlur = 18 * dpr;
    ctx.shadowOffsetY = 4 * dpr;
    ctx.fillStyle = "#fff";
    for (const hoja of hojas) {
      const y = (hoja.arriba - vista.arriba) * escala;
      if (y > h || y + hoja.alto * escala < 0) continue;
      ctx.fillRect((hoja.izquierda - vista.izquierda) * escala, y, hoja.ancho * escala, hoja.alto * escala);
    }
    ctx.restore();
    dibujarRegion(ctx, preparada, bitmaps, vista.izquierda, vista.arriba, escala, w, h);
    ctx.strokeStyle = css.getPropertyValue("--hoja-borde").trim() || "rgba(0,0,0,.12)";
    ctx.lineWidth = dpr;
    for (const hoja of hojas) {
      ctx.strokeRect((hoja.izquierda - vista.izquierda) * escala + dpr / 2, (hoja.arriba - vista.arriba) * escala + dpr / 2,
        hoja.ancho * escala - dpr, hoja.alto * escala - dpr);
    }
    dibujada = { ...vista };
  }

  // Avisa de la vista nueva (porcentaje de zoom y paginas visibles) en cada cambio: la pildora de
  // la app aparece con cualquier movimiento y se esconde sola al rato.
  function avisarVista() {
    const { primera, ultima } = paginasALaVista(hojas, vista, alto());
    alCambiarVista({
      porcentaje: porcentajeDeZoom(vista.zoom, ajuste()), primera: primera + 1, ultima: ultima + 1, total: hojas.length,
    });
  }

  // Aplica `vista`: si solo se desplazo, se redibuja ya (en el siguiente fotograma); si cambio el zoom,
  // se escala el lienzo ya dibujado con CSS y el redibujo nitido llega al acabar el gesto.
  function aplicar(nueva) {
    vista = acotarVista(nueva, caja, ancho(), alto());
    avisarVista();
    if (vista.zoom === dibujada.zoom) {
      if (!pendiente) { pendiente = true; requestAnimationFrame(pintar); }
      return;
    }
    const s = vista.zoom / dibujada.zoom;
    const tx = (dibujada.izquierda - vista.izquierda) * vista.zoom, ty = (dibujada.arriba - vista.arriba) * vista.zoom;
    lienzo.style.transformOrigin = "0 0";
    lienzo.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    clearTimeout(temporizador);
    temporizador = setTimeout(pintar, ESPERA_REDIBUJO_MS);
  }

  const zoomEn = (factor, px = ancho() / 2, py = alto() / 2) => aplicar(zoomHaciaPunto(vista, factor, px, py, ajuste()));
  const desplazar = (dx, dy) => aplicar({ ...vista, izquierda: vista.izquierda + dx / vista.zoom, arriba: vista.arriba + dy / vista.zoom });

  function encajar() {
    const zoom = ajuste();
    aplicar({ zoom, izquierda: (caja.x0 + caja.x1) / 2 - ancho() / zoom / 2, arriba: caja.y0 - 12 / zoom });
  }
  function irAPagina(numero) {
    aplicar(vistaDePagina(hojas, numero - 1, ancho(), vista.zoom));
  }
  const paginaDeLaVista = () => paginaActual(hojas, vista, alto()) + 1;
  // Doble clic o toque: ajusta al ancho; si ya esta ajustado, acerca 3x al punto tocado.
  function alternarAjuste(px, py) {
    if (Math.abs(vista.zoom - ajuste()) / ajuste() < 0.05) zoomEn(3, px, py);
    else encajar();
  }

  const punto = (e) => { const r = lienzo.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  // Rueda: Ctrl (o el pellizco del trackpad) hace zoom; sin Ctrl, desplaza (dos dedos).
  lienzo.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { const [x, y] = punto(e); zoomEn(factorDeRueda(e.deltaY, e.deltaMode), x, y); return; }
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? alto() : 1;
    desplazar(e.deltaX * k, e.deltaY * k);
  }, { passive: false });

  // Safari de escritorio: el pellizco llega como gesturestart/gesturechange con `scale` acumulada.
  let zoomAlEmpezar = 1;
  lienzo.addEventListener("gesturestart", (e) => { e.preventDefault(); zoomAlEmpezar = vista.zoom; });
  lienzo.addEventListener("gesturechange", (e) => {
    e.preventDefault();
    const [x, y] = punto(e);
    zoomEn(limitarZoom(zoomAlEmpezar * e.scale, ajuste()) / vista.zoom, x, y);
  });
  lienzo.addEventListener("gestureend", (e) => e.preventDefault());

  // Un puntero = mano; dos = pellizco (y desplazamiento con el punto medio).
  const punteros = new Map();
  let distancia = 0, medio = [0, 0], toque = null, ultimoToque = null;
  const medioDe = () => { const [a, b] = [...punteros.values()]; return [(a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(a.x - b.x, a.y - b.y)]; };
  lienzo.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    lienzo.setPointerCapture(e.pointerId);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    toque = punteros.size === 1 ? { x: e.clientX, y: e.clientY, t: e.timeStamp, movido: false } : null;
    if (punteros.size === 2) { const [mx, my, d] = medioDe(); medio = [mx, my]; distancia = d; }
    lienzo.classList.add("agarrando");
  });
  lienzo.addEventListener("pointermove", (e) => {
    const antes = punteros.get(e.pointerId);
    if (!antes) return;
    const ahora = { x: e.clientX, y: e.clientY };
    punteros.set(e.pointerId, ahora);
    if (toque && Math.hypot(ahora.x - toque.x, ahora.y - toque.y) > 8) toque.movido = true;
    if (punteros.size === 1) {
      desplazar(antes.x - ahora.x, antes.y - ahora.y);
    } else if (punteros.size === 2) {
      const [mx, my, d] = medioDe();
      const r = lienzo.getBoundingClientRect();
      if (distancia > 0) zoomEn(d / distancia, mx - r.left, my - r.top);
      desplazar(medio[0] - mx, medio[1] - my);
      medio = [mx, my]; distancia = d;
    }
  });
  const soltar = (e) => {
    const eraUno = punteros.size === 1;
    punteros.delete(e.pointerId);
    distancia = 0;
    if (punteros.size === 0) lienzo.classList.remove("agarrando");
    if (e.type === "pointerup" && eraUno && toque && !toque.movido && e.timeStamp - toque.t < 300) {
      const [x, y] = punto(e);
      if (ultimoToque && e.timeStamp - ultimoToque.t < 350 && Math.hypot(x - ultimoToque.x, y - ultimoToque.y) < 30) {
        ultimoToque = null;
        alternarAjuste(x, y);
      } else ultimoToque = { x, y, t: e.timeStamp };
    }
    toque = null;
  };
  lienzo.addEventListener("pointerup", soltar);
  lienzo.addEventListener("pointercancel", soltar);

  lienzo.addEventListener("keydown", (e) => {
    const paso = 80;
    const acciones = {
      "+": () => zoomEn(1.25), "=": () => zoomEn(1.25), "-": () => zoomEn(1 / 1.25), "0": encajar,
      ArrowLeft: () => desplazar(-paso, 0), ArrowRight: () => desplazar(paso, 0),
      ArrowUp: () => desplazar(0, -paso), ArrowDown: () => desplazar(0, paso),
      PageDown: () => irAPagina(Math.min(paginaDeLaVista() + 1, hojas.length)),
      PageUp: () => irAPagina(Math.max(paginaDeLaVista() - 1, 1)),
      Home: () => irAPagina(1), End: () => irAPagina(hojas.length),
    };
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (acciones[e.key]) { e.preventDefault(); acciones[e.key](); }
  });

  const observador = new ResizeObserver(() => { pendiente = true; requestAnimationFrame(pintar); avisarVista(); });
  observador.observe(lienzo);
  encajar();

  return {
    acercar: () => zoomEn(1.25), alejar: () => zoomEn(1 / 1.25), encajar, irAPagina,
    total: hojas.length, pagina: paginaDeLaVista,
    estado: () => ({ ...vista, ajuste: ajuste() }),
    destruir: () => { observador.disconnect(); clearTimeout(temporizador); lienzo.style.transform = ""; },
  };
}
