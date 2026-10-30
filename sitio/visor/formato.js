// Formato de las notas de SwiftPen en la carpeta de sync: lectura, orden y filtros. Sin DOM, para
// que lo use tanto la pagina como el Worker de las miniaturas y los tests.
//
// Una nota es el JSON de kotlinx de la app (Note.kt): sin version, evoluciona anadiendo campos, y
// aqui se leen solo los que el visor dibuja. Lo que no conoce se ignora.

const NOTA = /^note-(.+)\.json$/;
const CARPETA = /^folder-(.+)\.json$/;

export const esFicheroDeNota = (nombre) => NOTA.test(nombre);
export const esFicheroDeCarpeta = (nombre) => CARPETA.test(nombre);
export const nombreDeImagen = (idNota, idImagen) => `image-${idNota}_${idImagen}.webp`;

const numero = (v, porDefecto) => (typeof v === "number" && Number.isFinite(v) ? v : porDefecto);
const texto = (v) => (typeof v === "string" ? v : null);
const lista = (v) => (Array.isArray(v) ? v : []);

function leerJson(contenido) {
  let datos;
  try {
    datos = JSON.parse(contenido);
  } catch (e) {
    throw new Error("JSON no valido");
  }
  if (datos === null || typeof datos !== "object" || Array.isArray(datos)) throw new Error("no es un objeto");
  if (typeof datos.id !== "string" || datos.id === "") throw new Error("sin id");
  return datos;
}

// Segmento con los valores por defecto de Segment.kt (color -1 = blanco, ARGB con signo).
function leerSegmento(s) {
  return {
    x1: numero(s.x1, 0), y1: numero(s.y1, 0), x2: numero(s.x2, 0), y2: numero(s.y2, 0),
    halfWidth: numero(s.halfWidth, 2), color: numero(s.color, -1),
  };
}
const leerTrazos = (v) => lista(v).map((trazo) => lista(trazo).map(leerSegmento));

function leerTamano(v) {
  return { corto: numero(v && v.ladoCortoMm, 210), largo: numero(v && v.ladoLargoMm, 297) };
}

// Papel de la nota o de una pagina (PaperSpec): el visor solo usa color, tamano y orientacion.
function leerPapel(v, porDefecto = {}) {
  v = v || {};
  return {
    color: numero(v.color, porDefecto.color ?? 0xFFFCFBF4 | 0),
    horizontal: (texto(v.orientation) ?? (porDefecto.horizontal ? "HORIZONTAL" : "VERTICAL")) === "HORIZONTAL",
    tamano: v.size ? leerTamano(v.size) : porDefecto.tamano || { corto: 210, largo: 297 },
  };
}

function leerImagen(i) {
  return {
    id: texto(i.id) ?? "",
    centroX: numero(i.centroX, 0), centroY: numero(i.centroY, 0),
    ancho: numero(i.ancho, 0), alto: numero(i.alto, 0),
    giro: numero(i.giro, 0), debajoDelTrazo: numero(i.debajoDelTrazo, 0),
    volteadaH: i.volteadaH === true, volteadaV: i.volteadaV === true,
    esCajaDeTexto: i.texto != null,
  };
}

// La nota completa, lista para dibujar. Lanza si no es una nota.
export function leerNota(contenido) {
  const d = leerJson(contenido);
  const papel = leerPapel({
    color: d.paperColor, orientation: d.paperOrientation, size: d.paperSize,
  });
  const papeles = {};
  for (const [pagina, spec] of Object.entries(d.pagePapers && typeof d.pagePapers === "object" ? d.pagePapers : {})) {
    papeles[Number(pagina)] = leerPapel(spec, papel);
  }
  return {
    id: d.id,
    titulo: texto(d.title) ?? "",
    carpetaId: texto(d.folderId),
    fecha: numero(d.lastModifiedAt, 0) || numero(d.updatedAt, 0),
    bloqueada: d.bloqueada === true,
    fijada: d.fijada === true,
    borradaEn: typeof d.deletedAt === "number" ? d.deletedAt : null,
    trazos: leerTrazos(d.strokes),
    borrados: leerTrazos(d.eraseMarks),
    imagenes: lista(d.imagenes).map(leerImagen),
    lienzoInfinito: d.lienzoInfinito === true,
    dpi: numero(d.dpi, 0),
    paginas: numero(d.pageCount, 0),
    papel,
    papeles,
  };
}

// Lo justo para la lista: sin trazos. Una nota bloqueada no lleva nada mas que esto.
export function resumenDeNota(contenido) {
  const d = leerJson(contenido);
  return {
    id: d.id,
    titulo: texto(d.title) ?? "",
    carpetaId: texto(d.folderId),
    fecha: numero(d.lastModifiedAt, 0) || numero(d.updatedAt, 0),
    bloqueada: d.bloqueada === true,
    fijada: d.fijada === true,
    borrada: typeof d.deletedAt === "number",
  };
}

export function leerCarpeta(contenido) {
  const d = leerJson(contenido);
  return { id: d.id, nombre: texto(d.name) ?? "", padreId: texto(d.parentId) };
}

// "Padre / Hija". Corta ciclos por si el sync dejo carpetas mal enlazadas.
export function rutaDeCarpeta(carpetas, id) {
  const partes = [];
  const vistas = new Set();
  for (let c = carpetas.get(id); c && !vistas.has(c.id); c = carpetas.get(c.padreId)) {
    vistas.add(c.id);
    partes.unshift(c.nombre);
  }
  return partes.join(" / ");
}

// Las vivas, ancladas primero y luego de mas a menos reciente; a igual fecha, por titulo.
export function ordenarNotas(notas) {
  return notas.filter((n) => !n.borrada).sort((a, b) =>
    (b.fijada - a.fijada) || (b.fecha - a.fecha) || a.titulo.localeCompare(b.titulo));
}

const sinAcentos = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// carpetaId: undefined = todas, null = sin carpeta, otro = esa carpeta.
export function filtrarNotas(notas, { busqueda = "", carpetaId } = {}) {
  const q = sinAcentos(busqueda.trim());
  return notas.filter((n) =>
    (carpetaId === undefined || n.carpetaId === carpetaId) &&
    (q === "" || sinAcentos(n.titulo).includes(q)));
}
