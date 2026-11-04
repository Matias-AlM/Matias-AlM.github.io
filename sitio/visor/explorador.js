// El explorador de la biblioteca de SwiftPen: carpetas y subcarpetas, migas de pan, recuentos y el
// color de cada carpeta. Traduccion de ExploradorDeCarpetas.kt, OrdenDeCarpetas.kt y FolderTint.kt de
// la app. Sin DOM, para poder probarlo.

export const COLOR_DE_CARPETA_POR_DEFECTO = 0xFF8E8E8E;   // Folder.COLOR_POR_DEFECTO
export const ALPHA_TINTE_CARPETA_CLARO = 0.12;
export const ALPHA_TINTE_CARPETA_OSCURO = 0.10;
const OSCURECIMIENTO_PESTANA = 0.15;
const DIFERENCIA_MINIMA_PESTANA = 1.12;

// Una carpeta cuyo padre ya no existe (o una nota cuya carpeta ya no existe) sale en la raiz en vez
// de perderse, como en la app. `carpetas`: lista de {id, nombre, padreId, posicion}.
const idsDe = (carpetas) => new Set(carpetas.map((c) => c.id));

export function ordenarCarpetas(hermanas) {
  const porNombre = (a, b) => a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase()) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return [...hermanas].sort(porNombre);   // OrdenDeCarpetas.NOMBRE_ASC, el de la app por defecto
}

// {carpetas, notas} de una carpeta (null = la raiz). Las notas: vivas, de mas a menos recientes.
export function contenidoDeCarpeta(carpetas, notas, carpetaId) {
  const presentes = idsDe(carpetas);
  const enLaRaiz = (id) => id === null || id === undefined || !presentes.has(id);
  return {
    carpetas: ordenarCarpetas(carpetas.filter((c) => (carpetaId === null ? enLaRaiz(c.padreId) : c.padreId === carpetaId))),
    notas: notas
      .filter((n) => !n.borrada && (carpetaId === null ? enLaRaiz(n.carpetaId) : n.carpetaId === carpetaId))
      .sort((a, b) => b.fecha - a.fecha),
  };
}

// De la carpeta de primer nivel a `carpetaId` (la ultima). Corta ciclos y padres que no existen.
export function rutaDeCarpeta(carpetas, carpetaId) {
  const porId = new Map(carpetas.map((c) => [c.id, c]));
  const ruta = [];
  const vistas = new Set();
  for (let c = porId.get(carpetaId); c && !vistas.has(c.id); c = porId.get(c.padreId)) {
    vistas.add(c.id);
    ruta.unshift(c);
  }
  return ruta;
}

export function subcarpetasPorCarpeta(carpetas) {
  const cuenta = new Map();
  for (const c of carpetas) if (c.padreId) cuenta.set(c.padreId, (cuenta.get(c.padreId) ?? 0) + 1);
  return cuenta;
}

export function notasPorCarpeta(notas) {
  const cuenta = new Map();
  for (const n of notas) if (!n.borrada) cuenta.set(n.carpetaId, (cuenta.get(n.carpetaId) ?? 0) + 1);
  return cuenta;
}

// Con mas de tres eslabones, la primera, "..." y la ultima.
export function migasAMostrar(ruta) {
  if (ruta.length <= 3) return ruta.map((carpeta) => ({ carpeta }));
  return [{ carpeta: ruta[0] }, { colapso: ruta.slice(1, -1) }, { carpeta: ruta[ruta.length - 1] }];
}

// Cuantas columnas caben y lo que mide cada una: la cuenta de GridCells.Adaptive.
export function ladoDeTarjetaDeCarpeta(anchoDeLaRejilla, minimoDeTarjeta, separacion) {
  const columnas = Math.max(1, Math.floor((anchoDeLaRejilla + separacion) / (minimoDeTarjeta + separacion)));
  return Math.floor((anchoDeLaRejilla - separacion * (columnas - 1)) / columnas);
}

// Ancho minimo de tarjeta de NotesGrid: 128 en movil muy estrecho, 150 en movil, 180 en tableta.
export const minimoDeTarjeta = (anchoPx) => (anchoPx < 600 ? (anchoPx < 340 ? 128 : 150) : 180);

// ---- Color de la carpeta ----

const canal = (argb, desplazamiento) => Math.floor(argb / 2 ** desplazamiento) % 256;
export const rgbCss = (argb) => `rgb(${canal(argb, 16)} ${canal(argb, 8)} ${canal(argb, 0)})`;

function luminanciaRelativa(argb) {
  const lineal = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lineal(canal(argb, 16)) + 0.7152 * lineal(canal(argb, 8)) + 0.0722 * lineal(canal(argb, 0));
}
export function contrasteWCAG(a, b) {
  const la = luminanciaRelativa(a), lb = luminanciaRelativa(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// La pestana: el cuerpo con 15 % menos de luminosidad HSL; si apenas se distingue, mas clara.
export function colorPestanaDeCarpeta(cuerpoArgb) {
  const r = canal(cuerpoArgb, 16) / 255, g = canal(cuerpoArgb, 8) / 255, b = canal(cuerpoArgb, 0) / 255;
  const maximo = Math.max(r, g, b), minimo = Math.min(r, g, b);
  const luminosidad = (maximo + minimo) / 2, delta = maximo - minimo;
  const saturacion = delta === 0 ? 0 : delta / (1 - Math.abs(2 * luminosidad - 1));
  const tono = delta === 0 ? 0 : maximo === r ? 60 * (((g - b) / delta + 6) % 6) : maximo === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);
  const conLuminosidad = (l) => {
    const c = (1 - Math.abs(2 * l - 1)) * saturacion;
    const x = c * (1 - Math.abs(((tono / 60) % 2) - 1));
    const m = l - c / 2;
    const [r1, g1, b1] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(tono / 60) % 6];
    const byte = (v) => Math.min(255, Math.max(0, Math.round((v + m) * 255)));
    return 0xFF000000 + byte(r1) * 65536 + byte(g1) * 256 + byte(b1);
  };
  const masOscuro = conLuminosidad(Math.max(luminosidad - OSCURECIMIENTO_PESTANA, 0));
  if (contrasteWCAG(cuerpoArgb, masOscuro) >= DIFERENCIA_MINIMA_PESTANA) return masOscuro;
  return conLuminosidad(Math.min(luminosidad + OSCURECIMIENTO_PESTANA, 1));
}
