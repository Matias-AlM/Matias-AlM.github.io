// Calculos puros de la vista de una nota (sin DOM): zoom, limites, pagina actual y salto de pagina.
// "vista" = {zoom, izquierda, arriba}: zoom en px CSS por unidad de la nota, y la esquina superior
// izquierda del lienzo en unidades de la nota. "ajuste" = el zoom que encaja el ancho de la nota.

export const ZOOM_MIN_RELATIVO = 0.5;
export const ZOOM_MAX_RELATIVO = 8;
const MARGEN_PX = 12;

const entre = (v, min, max) => Math.min(Math.max(v, min), max);

// Caja que abarca todas las hojas.
export function cajaDeHojas(hojas) {
  const ultima = hojas[hojas.length - 1];
  return {
    x0: Math.min(...hojas.map((h) => h.izquierda)), y0: hojas[0].arriba,
    x1: Math.max(...hojas.map((h) => h.izquierda + h.ancho)), y1: ultima.arriba + ultima.alto,
  };
}

export const zoomDeAjuste = (caja, anchoPx) => Math.max((anchoPx - 2 * MARGEN_PX) / (caja.x1 - caja.x0), 0.001);

export const limitarZoom = (zoom, ajuste) => entre(zoom, ajuste * ZOOM_MIN_RELATIVO, ajuste * ZOOM_MAX_RELATIVO);

// Cambia el zoom por `factor` dejando fijo el punto (px, py) del lienzo, en px.
export function zoomHaciaPunto(vista, factor, px, py, ajuste) {
  const zoom = limitarZoom(vista.zoom * factor, ajuste);
  const ux = vista.izquierda + px / vista.zoom, uy = vista.arriba + py / vista.zoom;
  return { zoom, izquierda: ux - px / zoom, arriba: uy - py / zoom };
}

// Deja siempre a la vista al menos 48 px de nota a la vista: no se puede perder el contenido.
export function acotarVista(vista, caja, anchoPx, altoPx) {
  const margen = 48 / vista.zoom;
  return {
    zoom: vista.zoom,
    izquierda: entre(vista.izquierda, caja.x0 - anchoPx / vista.zoom + margen, caja.x1 - margen),
    arriba: entre(vista.arriba, caja.y0 - altoPx / vista.zoom + margen, caja.y1 - margen),
  };
}

// Pagina (0..n-1) bajo la linea central de la vista; en el hueco entre hojas, la de arriba.
export function paginaActual(hojas, vista, altoPx) {
  const centro = vista.arriba + altoPx / vista.zoom / 2;
  let actual = 0;
  for (let i = 0; i < hojas.length; i++) if (hojas[i].arriba <= centro) actual = i;
  return actual;
}

// Vista que pone la hoja `i` arriba, centrada en horizontal, al zoom dado. El aire de arriba cabe en
// el hueco entre hojas (60): la hoja de encima no asoma y el contador no la cuenta.
export function vistaDePagina(hojas, i, anchoPx, zoom) {
  const h = hojas[entre(i, 0, hojas.length - 1)];
  return { zoom, izquierda: h.izquierda + h.ancho / 2 - anchoPx / zoom / 2, arriba: h.arriba - Math.min(MARGEN_PX / zoom, 30) };
}

// Factor de zoom de un evento wheel con Ctrl (o de un pellizco de trackpad, que llega asi): los
// pellizcos traen deltas pequenos y la rueda de un raton, de 100; se acota para que un clic de
// rueda no multiplique el zoom por 2,7.
export function factorDeRueda(deltaY, deltaMode = 0) {
  const px = deltaMode === 1 ? deltaY * 16 : deltaY;
  return Math.exp(-entre(px, -60, 60) * 0.01);
}

// Zoom como lo muestra la app: 100 % = la hoja ajustada al ancho.
export const porcentajeDeZoom = (zoom, ajuste) => Math.round((zoom / ajuste) * 100);

// Primera y ultima pagina (0..n-1) que asoman en el lienzo, como el contador de la app
// (FastRenderer.onPaginasALaVista). Si solo se ve un hueco entre hojas, la mas cercana de arriba.
export function paginasALaVista(hojas, vista, altoPx) {
  const abajo = vista.arriba + altoPx / vista.zoom;
  let primera = -1, ultima = -1;
  hojas.forEach((h, i) => {
    if (h.arriba + h.alto > vista.arriba && h.arriba < abajo) { if (primera < 0) primera = i; ultima = i; }
  });
  if (primera >= 0) return { primera, ultima };
  const actual = paginaActual(hojas, vista, altoPx);
  return { primera: actual, ultima: actual };
}

// Lo que muestra la pastilla de zoom y pagina para una vista {porcentaje, primera, ultima, total}.
// Es igual con una sola hoja, con el lienzo infinito (que cuenta como una pagina) y con varias:
// el contador siempre dice la pagina, y las flechas se atenuan donde no hay adonde ir.
export function estadoDePastilla({ porcentaje, primera, ultima, total }) {
  return {
    zoom: `${porcentaje}%`,
    arriba: String(primera),
    abajo: primera !== ultima ? String(ultima) : null,
    anteriorActiva: primera > 1,
    siguienteActiva: ultima < total,
  };
}
