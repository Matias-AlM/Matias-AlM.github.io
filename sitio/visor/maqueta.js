// Donde cae cada hoja de una nota, en unidades de la nota (DisposicionDePaginas.kt): hojas en
// una columna, centradas, separadas por PAGE_GAP. Las coordenadas de la tinta estan en pixeles a
// los dpi de la nota; sin dpi (notas antiguas) se supone DPI_SUPUESTO.

export const DPI_SUPUESTO = 320;
const HUECO = 60;
const A4_ANCHO_PULGADAS = 210 / 25.4;
const A4_ALTO_PULGADAS = 297 / 25.4;
const MARGEN_LIENZO = 60;

function formaDe(papel, dpi) {
  const corto = A4_ANCHO_PULGADAS * dpi * (papel.tamano.corto / 210);
  const largo = A4_ALTO_PULGADAS * dpi * (papel.tamano.largo / 297);
  return papel.horizontal ? { ancho: largo, alto: corto } : { ancho: corto, alto: largo };
}

function limitesDelContenido(nota) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const abarcar = (x, y, r) => {
    x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r);
    x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r);
  };
  for (const trazo of nota.trazos) {
    for (const s of trazo) { abarcar(s.x1, s.y1, s.halfWidth); abarcar(s.x2, s.y2, s.halfWidth); }
  }
  for (const i of nota.imagenes) abarcar(i.centroX, i.centroY, Math.hypot(i.ancho, i.alto) / 2);
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

// Lista de hojas {izquierda, arriba, ancho, alto, papel}. El lienzo infinito es una sola hoja
// que abarca el contenido (sin su desplazamiento ni zoom propios).
export function calcularHojas(nota) {
  const dpi = nota.dpi > 0 ? nota.dpi : DPI_SUPUESTO;
  if (nota.lienzoInfinito) {
    const l = limitesDelContenido(nota) ?? { x0: 0, y0: 0, x1: 4 * dpi, y1: 4 * dpi };
    return [{
      izquierda: l.x0 - MARGEN_LIENZO, arriba: l.y0 - MARGEN_LIENZO,
      ancho: l.x1 - l.x0 + 2 * MARGEN_LIENZO, alto: l.y1 - l.y0 + 2 * MARGEN_LIENZO,
      papel: nota.papel,
    }];
  }
  const columna = A4_ANCHO_PULGADAS * dpi;
  const formas = [];
  let masAbajo = 0;
  for (const trazo of nota.trazos) for (const s of trazo) masAbajo = Math.max(masAbajo, s.y1, s.y2);
  for (const i of nota.imagenes) masAbajo = Math.max(masAbajo, i.centroY);
  const papelesMax = Math.max(-1, ...Object.keys(nota.papeles).map(Number)) + 1;
  let arriba = 0;
  for (let i = 0; ; i++) {
    const papel = nota.papeles[i] ?? nota.papel;
    const forma = formaDe(papel, dpi);
    formas.push({ izquierda: (columna - forma.ancho) / 2, arriba, ancho: forma.ancho, alto: forma.alto, papel });
    const hechas = i + 1;
    if (hechas >= Math.max(nota.paginas, papelesMax, 1) && arriba + forma.alto + HUECO > masAbajo) break;
    arriba += forma.alto + HUECO;
  }
  return formas;
}
