// Dibujo de una nota en Canvas 2D: traduccion simplificada de drawNotePage/dibujarTinta de la app
// (FastRenderer.kt). Sirve igual en el hilo principal y en el Worker (OffscreenCanvas).
//
// Que se dibuja: papel liso del color de la hoja, imagenes webp (con giro y volteo), y los trazos
// como un boligrafo: segmentos con extremos redondos, color y grosor halfWidth*2, para todos los
// lapices; el resaltador (color translucido) va debajo de la tinta y compuesto como una capa; la
// goma parcial (eraseMarks) recorta solo su trazo. Se ignoran: plantillas de papel (rayas,
// cuadricula...), cajas de texto, PDF de fondo, grano del lapiz, filo de la pluma de caligrafia,
// relleno de formas y mascara de recorte de las imagenes.

import { calcularHojas } from "./maqueta.js";

// ARGB entero con signo (Android) -> {css, alfa}.
export function colorDe(argb) {
  const n = argb >>> 0;
  return { css: `rgb(${(n >>> 16) & 255} ${(n >>> 8) & 255} ${n & 255})`, alfa: (n >>> 24) / 255 };
}

// Todo lo que se calcula una vez por nota: las hojas y la caja de cada trazo.
export function prepararNota(nota) {
  const cajas = nota.trazos.map((trazo) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of trazo) {
      const r = s.halfWidth;
      x0 = Math.min(x0, s.x1 - r, s.x2 - r); y0 = Math.min(y0, s.y1 - r, s.y2 - r);
      x1 = Math.max(x1, s.x1 + r, s.x2 + r); y1 = Math.max(y1, s.y1 + r, s.y2 + r);
    }
    return { x0, y0, x1, y1 };
  });
  return { nota, hojas: calcularHojas(nota), cajas, orden: ordenDeDibujo(nota) };
}

const nuevaCapa = (ancho, alto) => new OffscreenCanvas(Math.max(1, Math.ceil(ancho)), Math.max(1, Math.ceil(alto)));

function lineas(ctx, segmentos, escala, izquierda, arriba, color) {
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  for (const s of segmentos) {
    ctx.lineWidth = s.halfWidth * 2 * escala;
    ctx.beginPath();
    ctx.moveTo((s.x1 - izquierda) * escala, (s.y1 - arriba) * escala);
    ctx.lineTo((s.x2 - izquierda) * escala, (s.y2 - arriba) * escala);
    ctx.stroke();
  }
}

// Un trazo. Con alfa (resaltador) o con marcas de goma se compone en una capa del tamano de su
// caja: el alfa se aplica a la capa entera, y la goma recorta con destination-out.
function dibujarTrazo(ctx, trazo, marcas, caja, escala, izquierda, arriba) {
  const { css, alfa } = colorDe(trazo[0].color);
  const translucido = alfa < 1;
  if (!translucido && marcas.length === 0) {
    lineas(ctx, trazo, escala, izquierda, arriba, css);
    return;
  }
  const x = (caja.x0 - izquierda) * escala, y = (caja.y0 - arriba) * escala;
  const w = (caja.x1 - caja.x0) * escala, h = (caja.y1 - caja.y0) * escala;
  const capa = nuevaCapa(w, h);
  const c = capa.getContext("2d");
  // La capa empieza en la esquina de la caja: se dibuja con su origen desplazado.
  lineas(c, trazo, escala, caja.x0, caja.y0, css);
  c.globalCompositeOperation = "destination-out";
  lineas(c, marcas, escala, caja.x0, caja.y0, "#000");
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.drawImage(capa, x, y);
  ctx.restore();
}

// Orden de la app: por capas de imagen; dentro de cada tramo de trazos, el resaltador primero.
function ordenDeDibujo(nota) {
  const n = nota.trazos.length;
  const imagenes = nota.imagenes.map((_, i) => i).filter((i) => !nota.imagenes[i].esCajaDeTexto)
    .sort((a, b) => (nota.imagenes[a].debajoDelTrazo - nota.imagenes[b].debajoDelTrazo) || (a - b));
  const orden = [];
  let desde = 0;
  const tramo = (hasta) => {
    const indices = [];
    for (let i = desde; i < hasta; i++) if (nota.trazos[i].length) indices.push(i);
    const alfa = (i) => colorDe(nota.trazos[i][0].color).alfa < 1;
    orden.push(...indices.filter(alfa), ...indices.filter((i) => !alfa(i)));
  };
  for (const i of imagenes) {
    const hasta = Math.min(Math.max(nota.imagenes[i].debajoDelTrazo, 0), n);
    if (hasta > desde) { tramo(hasta); desde = hasta; }
    orden.push(-1 - i);
  }
  tramo(n);
  return orden;
}

function dibujarImagen(ctx, imagen, bitmap, escala, izquierda, arriba) {
  const cx = (imagen.centroX - izquierda) * escala, cy = (imagen.centroY - arriba) * escala;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(imagen.giro);
  ctx.scale(imagen.volteadaH ? -1 : 1, imagen.volteadaV ? -1 : 1);
  const w = imagen.ancho * escala, h = imagen.alto * escala;
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// Dibuja en ctx (de ancho x alto px) la parte de la nota que empieza en (izquierda, arriba) en
// unidades de la nota, a `escala` px por unidad. `bitmaps`: Map id de imagen -> ImageBitmap; las
// que faltan se saltan (la miniatura o la vista no esperan a un fichero que no esta).
export function dibujarRegion(ctx, preparada, bitmaps, izquierda, arriba, escala, ancho, alto, fondo) {
  const { nota, hojas, cajas, orden } = preparada;
  if (fondo) { ctx.fillStyle = fondo; ctx.fillRect(0, 0, ancho, alto); }
  const derecha = izquierda + ancho / escala, abajo = arriba + alto / escala;
  for (const hoja of hojas) {
    if (hoja.izquierda > derecha || hoja.izquierda + hoja.ancho < izquierda) continue;
    if (hoja.arriba > abajo || hoja.arriba + hoja.alto < arriba) continue;
    ctx.save();
    const x = (hoja.izquierda - izquierda) * escala, y = (hoja.arriba - arriba) * escala;
    const w = hoja.ancho * escala, h = hoja.alto * escala;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = colorDe(hoja.papel.color).css;
    ctx.fillRect(x, y, w, h);
    for (const indice of orden) {
      if (indice < 0) {
        const imagen = nota.imagenes[-1 - indice];
        const bitmap = bitmaps.get(imagen.id);
        if (bitmap) dibujarImagen(ctx, imagen, bitmap, escala, izquierda, arriba);
        continue;
      }
      const c = cajas[indice];
      if (c.x1 < izquierda || c.x0 > derecha || c.y1 < arriba || c.y0 > abajo) continue;
      // La capa del trazo no pasa de lo que se ve: a mucho zoom la caja entera seria enorme.
      const visible = {
        x0: Math.max(c.x0, izquierda), y0: Math.max(c.y0, arriba),
        x1: Math.min(c.x1, derecha), y1: Math.min(c.y1, abajo),
      };
      dibujarTrazo(ctx, nota.trazos[indice], nota.borrados[indice] ?? [], visible, escala, izquierda, arriba);
    }
    ctx.restore();
  }
}

// Miniatura: la primera hoja entera, a `ancho` px de ancho. Devuelve el alto en px.
export function dibujarMiniatura(ctx, preparada, bitmaps, ancho) {
  const hoja = preparada.hojas[0];
  const escala = ancho / hoja.ancho;
  const alto = Math.round(hoja.alto * escala);
  dibujarRegion(ctx, preparada, bitmaps, hoja.izquierda, hoja.arriba, escala, ancho, alto);
  return alto;
}

export function alturaDeMiniatura(preparada, ancho) {
  const hoja = preparada.hojas[0];
  return Math.round(hoja.alto * ancho / hoja.ancho);
}

// Las imagenes de la nota que estan en la carpeta: Map id -> ImageBitmap. Una que falta o no se
// decodifica se salta; la nota se dibuja igual sin ella.
export async function cargarBitmaps(nota, archivoDe) {
  const bitmaps = new Map();
  await Promise.all(nota.imagenes.filter((i) => !i.esCajaDeTexto).map(async (imagen) => {
    const archivo = archivoDe(imagen.id);
    if (!archivo) return;
    try {
      bitmaps.set(imagen.id, await createImageBitmap(archivo));
    } catch (e) {
      // imagen danada o formato no soportado
    }
  }));
  return bitmaps;
}
