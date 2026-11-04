// Vista de una nota: un lienzo con todas las hojas en vertical, una tras otra. Solo se dibuja lo que
// cae en el lienzo (las hojas fuera de la pantalla no cuestan nada ni guardan memoria), y el zoom
// se anima con una escala CSS que se afina con un redibujo al acabar el gesto.
//
// El desplazamiento es el del navegador: el lienzo (sticky) vive en un contenedor con overflow cuyo
// "pliego" mide lo que mide la nota al zoom actual; la rueda, los dos dedos del trackpad (con su
// inercia) y la barra los resuelve el navegador y aqui solo se lee el scroll para saber que se ve.
//
// Gestos: rueda = desplazar (dos dedos en un trackpad); Ctrl+rueda o pellizco de trackpad = zoom
// hacia el cursor (los captura captura-zoom.js en todo el documento); arrastrar con raton o dedo = mano;
// pellizco tactil; doble clic o doble toque = ajustar al ancho / acercar. Teclas: flechas,
// Re Pag / Av Pag (hoja anterior / siguiente), Home / End, + - 0.
import { dibujarRegion } from "./pintar.js";
import {
  cajaDeHojas, zoomDeAjuste, zoomHaciaPunto, acotarVista, paginaActual, vistaDePagina,
  porcentajeDeZoom, paginasALaVista,
} from "./gestos.js";

const ESPERA_REDIBUJO_MS = 140;
const entre = (v, min, max) => Math.min(Math.max(v, min), max);
const MARGEN_PX = 48;   // el mismo margen de nota a la vista que acotarVista
const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)");
// Los saltos (pagina, teclas) se animan con el suavizado del navegador, salvo si se pide menos movimiento.
const saltoSuave = () => (sinMovimiento.matches ? "auto" : "smooth");

export function crearVista(lienzo, preparada, bitmaps, { alCambiarVista = () => {} } = {}) {
  const ctx = lienzo.getContext("2d");
  const desplazador = lienzo.closest(".visor-desplazador"), pliego = lienzo.parentElement;
  const hojas = preparada.hojas;
  const caja = cajaDeHojas(hojas);
  let vista = { zoom: 1, izquierda: 0, arriba: 0 };
  let dibujada = { ...vista };   // la vista con la que se pinto el lienzo por ultima vez
  let pendiente = false, temporizador = 0;
  let zoomDelPliego = 0, esperado = { x: 0, y: 0 };   // esperado: el scroll que se puso desde aqui

  const ancho = () => desplazador.clientWidth, alto = () => desplazador.clientHeight;
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

  // Scroll del contenedor que corresponde a una vista (y al reves): el pliego deja MARGEN_PX de nota
  // a la vista en cada extremo, igual que acotarVista.
  const scrollDe = (v) => ({ x: (v.izquierda - caja.x0) * v.zoom + ancho() - MARGEN_PX, y: (v.arriba - caja.y0) * v.zoom + alto() - MARGEN_PX });
  function medirPliego() {
    lienzo.style.width = `${ancho()}px`; lienzo.style.height = `${alto()}px`;
    pliego.style.width = `${(caja.x1 - caja.x0) * vista.zoom + 2 * ancho() - 2 * MARGEN_PX}px`;
    pliego.style.height = `${(caja.y1 - caja.y0) * vista.zoom + 2 * alto() - 2 * MARGEN_PX}px`;
    zoomDelPliego = vista.zoom;
  }
  function colocar() {
    const { x, y } = scrollDe(vista);
    desplazador.scrollTo({ left: x, top: y, behavior: "auto" });
    esperado = { x: desplazador.scrollLeft, y: desplazador.scrollTop };
  }

  // Muestra `vista`: si solo se desplazo, se redibuja ya (en el siguiente fotograma); si cambio el zoom,
  // se escala el lienzo ya dibujado con CSS y el redibujo nitido llega al acabar el gesto.
  function presentar() {
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

  // Pone una vista de golpe (zoom, ajuste): redimensiona el pliego si cambio el zoom y mueve el scroll.
  function aplicar(nueva) {
    vista = acotarVista(nueva, caja, ancho(), alto());
    if (vista.zoom !== zoomDelPliego) medirPliego();
    colocar();
    presentar();
  }

  // El scroll lo mueve el navegador (rueda, trackpad, barra, teclas): la vista sale de el.
  desplazador.addEventListener("scroll", () => {
    const x = desplazador.scrollLeft, y = desplazador.scrollTop;
    if (Math.abs(x - esperado.x) < 1 && Math.abs(y - esperado.y) < 1) return;
    esperado = { x, y };
    vista = { zoom: vista.zoom, izquierda: caja.x0 + (x - ancho() + MARGEN_PX) / vista.zoom, arriba: caja.y0 + (y - alto() + MARGEN_PX) / vista.zoom };
    presentar();
  }, { passive: true });

  const zoomEn = (factor, px = ancho() / 2, py = alto() / 2) => aplicar(zoomHaciaPunto(vista, factor, px, py, ajuste()));
  // dx, dy en pixeles de pantalla; con "smooth" el navegador anima el desplazamiento.
  const desplazar = (dx, dy, comportamiento = "auto") => desplazador.scrollBy({ left: dx, top: dy, behavior: comportamiento });
  // Sin cambio de zoom el destino es solo un scroll y se anima; con cambio de zoom se pone de golpe.
  function irA(destino) {
    if (destino.zoom !== vista.zoom) return aplicar(destino);
    const { x, y } = scrollDe(acotarVista(destino, caja, ancho(), alto()));
    desplazador.scrollTo({ left: x, top: y, behavior: saltoSuave() });
  }

  function encajar() {
    const zoom = ajuste();
    irA({ zoom, izquierda: (caja.x0 + caja.x1) / 2 - ancho() / zoom / 2, arriba: caja.y0 - 12 / zoom });
  }
  function irAPagina(numero) {
    irA(vistaDePagina(hojas, numero - 1, ancho(), vista.zoom));
  }
  const paginaDeLaVista = () => paginaActual(hojas, vista, alto()) + 1;
  // Doble clic o toque: ajusta al ancho; si ya esta ajustado, acerca 3x al punto tocado.
  function alternarAjuste(px, py) {
    if (Math.abs(vista.zoom - ajuste()) / ajuste() < 0.05) zoomEn(3, px, py);
    else encajar();
  }

  // Coordenadas de pantalla -> del lienzo. El origen es el del contenedor: el lienzo lleva la escala CSS
  // del gesto en curso y su rectangulo ya no coincide con la vista (anclaria el zoom a un punto falso).
  const origen = () => desplazador.getBoundingClientRect();
  const punto = (e) => { const r = origen(); return [e.clientX - r.left, e.clientY - r.top]; };

  // Ctrl+rueda, pellizco de trackpad y gestos de Safari los captura captura-zoom.js en todo el documento
  // (visor.js) y llegan aqui: el punto del cursor se acota a la zona visible para que el zoom
  // nunca gire en torno a un punto fuera de la hoja (p. ej. con el cursor sobre la pastilla).
  const zoomEnPantalla = (factor, clientX, clientY) => {
    const r = origen();
    zoomEn(factor, entre(clientX, r.left, r.right) - r.left, entre(clientY, r.top, r.bottom) - r.top);
  };

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
      const r = origen();
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
      ArrowLeft: () => desplazar(-paso, 0, saltoSuave()), ArrowRight: () => desplazar(paso, 0, saltoSuave()),
      ArrowUp: () => desplazar(0, -paso, saltoSuave()), ArrowDown: () => desplazar(0, paso, saltoSuave()),
      PageDown: () => irAPagina(Math.min(paginaDeLaVista() + 1, hojas.length)),
      PageUp: () => irAPagina(Math.max(paginaDeLaVista() - 1, 1)),
      Home: () => irAPagina(1), End: () => irAPagina(hojas.length),
    };
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (acciones[e.key]) { e.preventDefault(); acciones[e.key](); }
  });

  // Al cambiar el tamano del contenedor se remide el pliego y se mantiene la misma vista.
  const observador = new ResizeObserver(() => { medirPliego(); colocar(); pendiente = true; requestAnimationFrame(pintar); avisarVista(); });
  observador.observe(desplazador);
  medirPliego();
  aplicar({ zoom: ajuste(), izquierda: (caja.x0 + caja.x1) / 2 - ancho() / ajuste() / 2, arriba: caja.y0 - 12 / ajuste() });

  return {
    zoomEnPantalla, acercar: () => zoomEn(1.25), alejar: () => zoomEn(1 / 1.25), encajar, irAPagina,
    total: hojas.length, pagina: paginaDeLaVista,
    estado: () => ({ ...vista, ajuste: ajuste() }),
    destruir: () => { observador.disconnect(); clearTimeout(temporizador); lienzo.style.transform = ""; pliego.style.width = pliego.style.height = ""; },
  };
}
