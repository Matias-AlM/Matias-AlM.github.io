// Dibuja las miniaturas fuera del hilo principal. Recibe {id, archivo, imagenes: {nombre: File}, ancho}
// y contesta {id, blob, ancho, alto} o {id, error}. Las bloqueadas no llegan aqui (la pagina no las
// manda) y, por si acaso, tampoco se dibujan.
import { leerNota, nombreDeImagen } from "./formato.js";
import { prepararNota, dibujarMiniatura, alturaDeMiniatura, cargarBitmaps } from "./pintar.js";

self.onmessage = async ({ data: { id, archivo, imagenes, ancho } }) => {
  try {
    const nota = leerNota(await archivo.text());
    if (nota.bloqueada) throw new Error("bloqueada");
    const preparada = prepararNota(nota);
    const bitmaps = await cargarBitmaps(nota, (idImagen) => imagenes[nombreDeImagen(nota.id, idImagen)]);
    const lienzo = new OffscreenCanvas(ancho, alturaDeMiniatura(preparada, ancho));
    const alto = dibujarMiniatura(lienzo.getContext("2d"), preparada, bitmaps, ancho);
    for (const b of bitmaps.values()) b.close();
    const blob = await lienzo.convertToBlob({ type: "image/webp", quality: 0.85 });
    self.postMessage({ id, blob, ancho, alto });
  } catch (e) {
    self.postMessage({ id, error: String(e && e.message || e) });
  }
};
