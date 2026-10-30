// Visor de solo lectura de las notas de SwiftPen. Todo ocurre en este navegador: la carpeta se
// lee con File API, sin red. Los textos de las notas se ponen siempre con textContent.
import {
  esFicheroDeNota, esFicheroDeCarpeta, leerCarpeta, resumenDeNota, leerNota,
  filtrarNotas, nombreDeImagen,
} from "./formato.js";
import {
  contenidoDeCarpeta, rutaDeCarpeta, subcarpetasPorCarpeta, notasPorCarpeta, migasAMostrar, ladoDeTarjetaDeCarpeta,
  minimoDeTarjeta, colorPestanaDeCarpeta, rgbCss,
} from "./explorador.js";
import { prepararNota, cargarBitmaps, colorDe, papelVisible } from "./pintar.js";
import { crearVista } from "./vista.js";
import { estadoDePastilla } from "./gestos.js";

const TEXTOS = {
  es: {
    cargadas: (n) => `${n} ${n === 1 ? "nota" : "notas"}`,
    sinCarpeta: "Sin carpeta", todas: "Todas las carpetas", sinTitulo: "Sin título",
    ilegibles: (n) => `${n} ${n === 1 ? "fichero no se pudo leer" : "ficheros no se pudieron leer"}.`,
    vacia: "No hay notas de SwiftPen en esa carpeta.", sinResultados: "Ninguna nota coincide.",
    cargando: "Cargando…", notaVacia: "Esta nota está vacía.", cdContador: "Página actual. Toca para ir a otra", cdAnterior: "Página anterior", cdSiguiente: "Página siguiente", zoomRapido: "Zoom rápido", rango: (n) => `Del 1 al ${n}`,
    carpetas: "Carpetas", subir: "Subir un nivel", migasOcultas: "Mostrar las carpetas intermedias", carpetaVacia: "Esta carpeta está vacía.", nSub: (n) => `${n} ${n === 1 ? "subcarpeta" : "subcarpetas"}`, horizontal: "Horizontal", infinito: "Lienzo infinito", notaBloqueada: "Nota bloqueada",
    bloqueada: "Bloqueada", buscar: "Buscar por título", noSeDibuja: "No se pudo dibujar esta nota.",
  },
  en: {
    cargadas: (n) => `${n} ${n === 1 ? "note" : "notes"}`,
    sinCarpeta: "No folder", todas: "All folders", sinTitulo: "Untitled",
    ilegibles: (n) => `${n} ${n === 1 ? "file could not be read" : "files could not be read"}.`,
    vacia: "There are no SwiftPen notes in that folder.", sinResultados: "No note matches.",
    cargando: "Loading…", notaVacia: "This note is empty.", cdContador: "Current page. Tap to go to another", cdAnterior: "Previous page", cdSiguiente: "Next page", zoomRapido: "Quick zoom", rango: (n) => `1 to ${n}`,
    carpetas: "Folders", subir: "Up one level", migasOcultas: "Show the folders in between", carpetaVacia: "This folder is empty.", nSub: (n) => `${n} ${n === 1 ? "subfolder" : "subfolders"}`, horizontal: "Landscape", infinito: "Infinite canvas", notaBloqueada: "Locked note",
    bloqueada: "Locked", buscar: "Search by title", noSeDibuja: "This note could not be drawn.",
  },
  fr: {
    cargadas: (n) => `${n} ${n === 1 ? "note" : "notes"}`,
    sinCarpeta: "Sans dossier", todas: "Tous les dossiers", sinTitulo: "Sans titre",
    ilegibles: (n) => `${n} ${n === 1 ? "fichier illisible" : "fichiers illisibles"}.`,
    vacia: "Aucune note SwiftPen dans ce dossier.", sinResultados: "Aucune note ne correspond.",
    cargando: "Chargement…", notaVacia: "Cette note est vide.", cdContador: "Page actuelle. Touchez pour aller à une autre", cdAnterior: "Page précédente", cdSiguiente: "Page suivante", zoomRapido: "Zoom rapide", rango: (n) => `1 à ${n}`,
    carpetas: "Dossiers", subir: "Remonter d'un niveau", migasOcultas: "Afficher les dossiers intermédiaires", carpetaVacia: "Ce dossier est vide.", nSub: (n) => `${n} ${n === 1 ? "sous-dossier" : "sous-dossiers"}`, horizontal: "Paysage", infinito: "Canevas infini", notaBloqueada: "Note verrouillée",
    bloqueada: "Verrouillée", buscar: "Rechercher par titre", noSeDibuja: "Impossible de dessiner cette note.",
  },
};
const idioma = () => (TEXTOS[document.documentElement.dataset.lang] ? document.documentElement.dataset.lang : "es");
const t = () => TEXTOS[idioma()];

const $ = (id) => document.getElementById(id);
const el = (etiqueta, clase, contenido) => {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (contenido !== undefined) nodo.textContent = contenido;
  return nodo;
};

const estado = {
  archivos: new Map(),   // nombre -> File
  notas: [],             // resumenes
  carpetas: [],          // {id, nombre, padreId, color, posicion}
  ilegibles: 0,
  busqueda: "",
  carpetaActual: null,   // null = la raiz del explorador
};

// ---- Lectura de la carpeta ----

async function recorrerEntrada(entrada, destino) {
  if (entrada.isFile) {
    destino.push(await new Promise((ok, mal) => entrada.file(ok, mal)));
  } else if (entrada.isDirectory) {
    const lector = entrada.createReader();
    for (;;) {
      const lote = await new Promise((ok, mal) => lector.readEntries(ok, mal));
      if (lote.length === 0) break;
      for (const hija of lote) await recorrerEntrada(hija, destino);
    }
  }
}

async function recorrerManejador(manejador, destino) {
  for await (const hija of manejador.values()) {
    if (hija.kind === "file") destino.push(await hija.getFile());
    else await recorrerManejador(hija, destino);
  }
}

async function cargar(ficheros) {
  estado.archivos = new Map(ficheros.map((f) => [f.name, f]));
  estado.carpetas = [];
  estado.notas = [];
  estado.ilegibles = 0;
  const leer = async (fichero, interpretar, guardar) => {
    try {
      guardar(interpretar(await fichero.text()));
    } catch (e) {
      estado.ilegibles++;
    }
  };
  const trabajos = [];
  for (const [nombre, fichero] of estado.archivos) {
    if (esFicheroDeCarpeta(nombre)) trabajos.push(leer(fichero, leerCarpeta, (c) => estado.carpetas.push(c)));
    else if (esFicheroDeNota(nombre)) {
      trabajos.push(leer(fichero, resumenDeNota, (n) => estado.notas.push({ ...n, nombreDeFichero: nombre })));
    }
  }
  await Promise.all(trabajos);
  estado.busqueda = "";
  estado.carpetaActual = null;
  $("busqueda").value = "";
  pintarTodo();
}

async function elegirConManejador() {
  let raiz;
  try {
    raiz = await window.showDirectoryPicker({ mode: "read" });
  } catch (e) {
    if (e.name === "AbortError") return;
    throw e;
  }
  const ficheros = [];
  await recorrerManejador(raiz, ficheros);
  await cargar(ficheros);
}

// ---- Biblioteca: el explorador de la app ----

const NS = "http://www.w3.org/2000/svg";
const svg = (clase, atributos, ...hijos) => {
  const nodo = document.createElementNS(NS, "svg");
  nodo.setAttribute("viewBox", "0 0 24 24");
  nodo.setAttribute("aria-hidden", "true");
  if (clase) nodo.setAttribute("class", clase);
  for (const [k, v] of Object.entries(atributos ?? {})) nodo.setAttribute(k, v);
  nodo.append(...hijos);
  return nodo;
};
const camino = (d, atributos = {}) => {
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", d);
  for (const [k, v] of Object.entries(atributos)) p.setAttribute(k, v);
  return p;
};
const TRAZO_FINO = { fill: "none", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round" };

// ic_lock, ic_infinite, ic_landscape_page, ic_folder_filled / ic_folder_tab: los vectores de la app.
const D_CANDADO = "M7.25 10.75L17.25 10.75A2 2 0 0 1 19.25 12.75L19.25 18.75A2 2 0 0 1 17.25 20.75L7.25 20.75A2 2 0 0 1 5.25 18.75L5.25 12.75A2 2 0 0 1 7.25 10.75ZM8.25 10.75V7.75A4 4 0 0 1 16.25 7.75V10.75M12.25 14.5V17";
const D_INFINITO = "M12.25 12.25C10.25 9.5 8.75 8.5 7 8.5A3.75 3.75 0 0 0 7 16C8.75 16 10.25 15 12.25 12.25C14.25 9.5 15.75 8.5 17.5 8.5A3.75 3.75 0 0 1 17.5 16C15.75 16 14.25 15 12.25 12.25Z";
const D_HORIZONTAL = "M5.75 6.25L18.75 6.25A2 2 0 0 1 20.75 8.25L20.75 16.25A2 2 0 0 1 18.75 18.25L5.75 18.25A2 2 0 0 1 3.75 16.25L3.75 8.25A2 2 0 0 1 5.75 6.25ZM7.25 10.25H17.25M7.25 14.25H13.25";
const D_CARPETA = "M3.5 7.5A2 2 0 0 1 5.5 5.5H9.25L11.25 7.75H18.5A2 2 0 0 1 20.5 9.75V17.5A2 2 0 0 1 18.5 19.5H5.5A2 2 0 0 1 3.5 17.5Z";

const esOscuro = () => {
  const forzado = document.documentElement.getAttribute("data-tema");
  return forzado ? forzado === "oscuro" : window.matchMedia("(prefers-color-scheme: dark)").matches;
};
const esMovil = () => window.matchMedia("(max-width: 599px)").matches;   // CORTE_COMPACTA_DP = 600

const miniaturas = { worker: null, cola: [], enCurso: new Map(), siguiente: 1, ocupado: false };

function iniciarWorker() {
  if (miniaturas.worker || typeof OffscreenCanvas === "undefined") return;
  miniaturas.worker = new Worker("/visor/miniaturas-worker.js", { type: "module" });
  miniaturas.worker.onmessage = ({ data }) => {
    const tarjeta = miniaturas.enCurso.get(data.id);
    miniaturas.enCurso.delete(data.id);
    miniaturas.ocupado = false;
    if (tarjeta && tarjeta.isConnected && !data.error) {
      const img = el("img", "miniatura-img");
      img.alt = "";
      img.src = URL.createObjectURL(data.blob);
      img.addEventListener("load", () => { URL.revokeObjectURL(img.src); img.classList.add("lista"); });
      const marco = tarjeta.querySelector(".miniatura");
      marco.replaceChildren(img);
      // La insignia "Horizontal" solo va sobre una miniatura ya dibujada, como en la app.
      if (tarjeta.nota.apaisada) marco.append(insigniaHorizontal());
    }
    siguienteMiniatura();
  };
}

function siguienteMiniatura() {
  if (miniaturas.ocupado || miniaturas.cola.length === 0) return;
  const { tarjeta, nota } = miniaturas.cola.shift();
  if (!tarjeta.isConnected) return siguienteMiniatura();
  const id = miniaturas.siguiente++;
  const prefijo = `image-${nota.id}_`;
  const imagenes = {};
  for (const [nombre, fichero] of estado.archivos) if (nombre.startsWith(prefijo)) imagenes[nombre] = fichero;
  miniaturas.ocupado = true;
  miniaturas.enCurso.set(id, tarjeta);
  // ThumbnailStore.anchoPara: 720 px en tableta, 480 en movil.
  miniaturas.worker.postMessage({
    id, archivo: estado.archivos.get(nota.nombreDeFichero), imagenes, ancho: esMovil() ? 480 : 720, oscuro: esOscuro(),
  });
}

const observador = new IntersectionObserver((entradas) => {
  for (const e of entradas) {
    if (!e.isIntersecting) continue;
    observador.unobserve(e.target);
    miniaturas.cola.push({ tarjeta: e.target, nota: e.target.nota });
  }
  siguienteMiniatura();
}, { rootMargin: "300px" });

function insigniaHorizontal() {
  const nodo = el("span", "insignia-horizontal");
  nodo.append(svg("", TRAZO_FINO, camino(D_HORIZONTAL)), el("span", "", t().horizontal));
  return nodo;
}

// TarjetaDeCuaderno: la miniatura con esquinas de 12, y debajo el titulo en negrita y la carpeta.
function tarjetaDeNota(nota) {
  const tarjeta = el("button", "tarjeta");
  tarjeta.type = "button";
  tarjeta.nota = nota;
  const marco = el("span", "miniatura");
  // Mientras no hay miniatura, el papel de la nota (como la app).
  marco.style.background = colorDe(papelVisible(nota.papel, esOscuro())).css;
  if (nota.bloqueada) {
    // La app desenfoca la miniatura de una bloqueada; aqui una bloqueada no se dibuja nunca: papel liso y candado.
    marco.append(el("span", "candado-redondo"));
    marco.firstChild.append(svg("", TRAZO_FINO, camino(D_CANDADO)));
    marco.firstChild.setAttribute("role", "img");
    marco.firstChild.setAttribute("aria-label", t().notaBloqueada);
  }
  const titulo = el("span", "tarjeta-titulo", nota.titulo.trim() === "" ? t().sinTitulo : nota.titulo);
  if (nota.titulo.trim() === "") titulo.classList.add("sin-nombre");
  const fila = el("span", "tarjeta-fila");
  fila.append(titulo);
  if (nota.lienzoInfinito) {
    const icono = svg("tarjeta-infinito", TRAZO_FINO, camino(D_INFINITO));
    icono.setAttribute("role", "img");
    icono.setAttribute("aria-label", t().infinito);
    fila.append(icono);
  }
  const carpeta = estado.carpetas.find((c) => c.id === nota.carpetaId);
  const pie = el("span", "tarjeta-pie", carpeta ? carpeta.nombre : t().sinCarpeta);
  const texto = el("span", "tarjeta-texto");
  texto.append(fila, pie);
  tarjeta.append(marco, texto);
  tarjeta.addEventListener("click", () => abrirNota(nota));
  if (!nota.bloqueada) observador.observe(tarjeta);
  return tarjeta;
}

// TarjetaDeCarpeta: cuadrada, del ancho de una columna; tinte suave del color, franja solida a la
// izquierda, nombre en negrita, la carpeta grande en el centro y el recuento debajo.
function iconoDeCarpeta(color) {
  const pestana = rgbCss(colorPestanaDeCarpeta(color));
  const trazo = { "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round" };
  const cuerpo = camino(D_CARPETA, { fill: rgbCss(color), stroke: rgbCss(color), ...trazo });
  const recorte = document.createElementNS(NS, "clipPath");
  const id = `pestana-${color}`;
  recorte.setAttribute("id", id);
  const rect = document.createElementNS(NS, "rect");
  for (const [k, v] of Object.entries({ x: "0", y: "0", width: "24", height: "8.4" })) rect.setAttribute(k, v);
  recorte.append(rect);
  const arriba = camino(D_CARPETA, { fill: pestana, stroke: pestana, "clip-path": `url(#${id})`, ...trazo });
  return svg("carpeta-icono", {}, recorte, cuerpo, arriba);
}

function tarjetaDeCarpeta(carpeta, subcarpetas, notas) {
  const tarjeta = el("button", "carpeta");
  tarjeta.type = "button";
  tarjeta.style.setProperty("--carpeta", rgbCss(carpeta.color));
  const sinNombre = carpeta.nombre.trim() === "";
  const nombre = el("span", "carpeta-nombre", sinNombre ? t().sinTitulo : carpeta.nombre);
  if (sinNombre) nombre.classList.add("sin-nombre");
  const resumen = subcarpetas > 0 ? `${t().nSub(subcarpetas)} · ${t().cargadas(notas)}` : t().cargadas(notas);
  const centro = el("span", "carpeta-centro");
  centro.append(iconoDeCarpeta(carpeta.color));
  tarjeta.append(nombre, centro, el("span", "carpeta-resumen", resumen));
  tarjeta.addEventListener("click", () => entrarEnCarpeta(carpeta.id));
  return tarjeta;
}

function entrarEnCarpeta(id) {
  estado.carpetaActual = id;
  estado.busqueda = "";
  $("busqueda").value = "";
  pintarLista();
  window.scrollTo({ top: 0 });
}

// FolderBreadcrumb: "Carpetas > A > B"; los ancestros en gris y pulsables, la actual en negro.
function pintarMigas(ruta, buscando) {
  const migas = $("migas");
  const raiz = { id: null, nombre: t().carpetas };
  const eslabones = migasAMostrar([raiz, ...ruta]);
  const ultimo = ruta.length === 0 || buscando ? raiz : ruta[ruta.length - 1];
  const nodos = [];
  eslabones.forEach((eslabon, i) => {
    const esAncestro = eslabon.colapso ? true : (buscando ? true : eslabon.carpeta !== (ruta[ruta.length - 1] ?? raiz));
    let miga;
    if (eslabon.colapso) {
      miga = el("button", "miga ancestro", "…");
      miga.type = "button";
      miga.setAttribute("aria-label", t().migasOcultas);
      miga.addEventListener("click", () => pintarMigasExpandidas(ruta));
    } else {
      const c = eslabon.carpeta;
      const vacio = c !== raiz && c.nombre.trim() === "";
      miga = el(esAncestro ? "button" : "span", `miga ${esAncestro ? "ancestro" : "actual"}`, vacio ? t().sinTitulo : c.nombre);
      if (esAncestro) { miga.type = "button"; miga.addEventListener("click", () => entrarEnCarpeta(c.id)); }
      if (vacio) miga.classList.add("sin-nombre");
      if (!esAncestro) miga.setAttribute("aria-current", "page");
    }
    nodos.push(miga);
    if (esAncestro) nodos.push(svg("miga-chevron", TRAZO_FINO, camino("M9.75 5.75L16.25 12.25L9.75 18.75")));
  });
  void ultimo;
  migas.replaceChildren(...nodos);
  migas.scrollLeft = migas.scrollWidth;
}

function pintarMigasExpandidas(ruta) {
  const migas = $("migas");
  const nodos = [{ id: null, nombre: t().carpetas }, ...ruta].flatMap((c, i, todas) => {
    const ultima = i === todas.length - 1;
    const miga = el(ultima ? "span" : "button", `miga ${ultima ? "actual" : "ancestro"}`, c.nombre);
    if (!ultima) { miga.type = "button"; miga.addEventListener("click", () => entrarEnCarpeta(c.id)); }
    return ultima ? [miga] : [miga, svg("miga-chevron", TRAZO_FINO, camino("M9.75 5.75L16.25 12.25L9.75 18.75"))];
  });
  migas.replaceChildren(...nodos);
  migas.scrollLeft = migas.scrollWidth;
}

// La fila de carpetas se desplaza de lado y se desvanece en los bordes con mas que ver.
function marcarDesvanecidoDeLaFila() {
  const fila = $("carpetas");
  fila.classList.toggle("puede-izquierda", fila.scrollLeft > 1);
  fila.classList.toggle("puede-derecha", fila.scrollLeft + fila.clientWidth < fila.scrollWidth - 1);
}

// El lado de una tarjeta de carpeta es el de una columna de notas (la cuenta de GridCells.Adaptive).
function medirLadoDeCarpeta() {
  const ancho = $("lista").clientWidth || $("biblioteca").clientWidth;
  if (ancho > 0) $("carpetas").style.setProperty("--lado", `${ladoDeTarjetaDeCarpeta(ancho, minimoDeTarjeta(window.innerWidth), 16)}px`);
  marcarDesvanecidoDeLaFila();
}

function pintarLista() {
  miniaturas.cola = [];
  const buscando = estado.busqueda.trim() !== "";
  const vivas = estado.notas.filter((n) => !n.borrada);
  let carpetasAqui = [], notasAqui;
  if (buscando) {
    notasAqui = filtrarNotas(vivas, { busqueda: estado.busqueda }).sort((a, b) => b.fecha - a.fecha);
  } else {
    const contenido = contenidoDeCarpeta(estado.carpetas, vivas, estado.carpetaActual);
    carpetasAqui = contenido.carpetas;
    notasAqui = contenido.notas;
  }
  const ruta = estado.carpetaActual === null ? [] : rutaDeCarpeta(estado.carpetas, estado.carpetaActual);
  pintarMigas(ruta, buscando);
  $("carpeta-subir").hidden = buscando || ruta.length === 0;
  $("carpeta-subir").setAttribute("aria-label", t().subir);
  $("busqueda").placeholder = t().buscar;

  const fila = $("carpetas");
  const subs = subcarpetasPorCarpeta(estado.carpetas), cuantas = notasPorCarpeta(vivas);
  fila.replaceChildren(...carpetasAqui.map((c) => tarjetaDeCarpeta(c, subs.get(c.id) ?? 0, cuantas.get(c.id) ?? 0)));
  fila.hidden = carpetasAqui.length === 0;
  fila.scrollLeft = 0;
  $("lista").replaceChildren(...notasAqui.map(tarjetaDeNota));
  medirLadoDeCarpeta();

  const aviso = $("aviso");
  const mensajes = [];
  if (estado.ilegibles) mensajes.push(t().ilegibles(estado.ilegibles));
  if (carpetasAqui.length === 0 && notasAqui.length === 0) {
    mensajes.push(buscando ? t().sinResultados : estado.notas.length === 0 && estado.carpetas.length === 0 ? t().vacia : t().carpetaVacia);
  }
  aviso.textContent = mensajes.join(" ");
  aviso.hidden = mensajes.length === 0;
}

function pintarTodo() {
  const hayCarpeta = estado.archivos.size > 0;
  $("inicio").hidden = hayCarpeta;
  $("biblioteca").hidden = !hayCarpeta;
  if (!hayCarpeta) return;
  iniciarWorker();
  pintarLista();
}

// ---- Nota abierta ----

let vistaActual = null;
let aperturas = 0;                 // para descartar una lectura lenta si ya se abrio otra nota o se cerro
let vistaMostrada = null;          // ultimo {porcentaje, primera, ultima, total} de la vista

function mostrarEstado(clase, texto) {
  const aviso = $("nota-estado");
  aviso.hidden = texto === null;
  aviso.className = `visor-estado ${clase}`;
  aviso.textContent = texto ?? "";
}

// ---- La pildora de zoom y pagina (la del editor de la app) ----

const RETRASO_DE_LA_PILDORA_MS = 3000;   // RETRASO_DE_LA_ZOOM_MS en la app
let temporizadorDePildora = 0;
const paneles = () => [$("menu-zoom"), $("menu-pagina")];
const hayPanelAbierto = () => paneles().some((p) => !p.hidden);

// Vuelve de golpe con cualquier movimiento y se esconde a los 3 s; con un panel abierto se queda.
function mostrarPildora() {
  const pildora = $("nota-pildora");
  pildora.classList.remove("oculta");
  clearTimeout(temporizadorDePildora);
  temporizadorDePildora = setTimeout(function esconder() {
    if (hayPanelAbierto() || pildora.matches(":hover, :focus-within")) { temporizadorDePildora = setTimeout(esconder, RETRASO_DE_LA_PILDORA_MS); return; }
    pildora.classList.add("oculta");
  }, RETRASO_DE_LA_PILDORA_MS);
}

function cerrarPaneles() {
  for (const p of paneles()) p.hidden = true;
}

function pintarPildora() {
  const v = vistaMostrada;
  if (!v) return;
  const p = estadoDePastilla(v);
  $("zoom-valor").textContent = p.zoom;
  $("zoom-etiqueta").setAttribute("aria-label", t().zoomRapido);
  $("pagina-arriba").textContent = p.arriba;
  $("pagina-abajo").textContent = p.abajo ?? "";
  $("pagina-raya").hidden = $("pagina-abajo").hidden = p.abajo === null;
  $("pagina-contador").classList.toggle("entre-dos", p.abajo !== null);
  $("pagina-contador").setAttribute("aria-label", t().cdContador);
  $("pagina-anterior").setAttribute("aria-label", t().cdAnterior);
  $("pagina-siguiente").setAttribute("aria-label", t().cdSiguiente);
  $("pagina-anterior").disabled = !p.anteriorActiva;
  $("pagina-siguiente").disabled = !p.siguienteActiva;
  $("pagina-campo").placeholder = t().rango(v.total);
  $("pagina-campo").max = String(v.total);
}

function abrirIrAPagina() {
  cerrarPaneles();
  $("menu-pagina").hidden = false;
  $("pagina-campo").value = "";
  $("pagina-campo").focus();
}

// Fuera de rango se va a la mas cercana: pedir la 40 de una nota de 12 es querer ir al final.
function irAPagina() {
  const n = Math.round(Number($("pagina-campo").value));
  if (vistaActual && $("pagina-campo").value !== "" && Number.isFinite(n)) vistaActual.irAPagina(Math.min(Math.max(n, 1), vistaActual.total));
  cerrarPaneles();
  $("lienzo").focus();
}

async function abrirNota(resumen) {
  const apertura = ++aperturas;
  const panel = $("nota");
  $("nota-titulo").textContent = resumen.titulo || t().sinTitulo;
  const lienzo = $("lienzo");
  panel.hidden = false;
  document.body.classList.add("con-nota");
  $("nota-volver").focus();
  vistaMostrada = null;
  cerrarPaneles();
  $("nota-pildora").classList.add("oculta");
  // Una nota bloqueada nunca se lee ni se dibuja: solo se avisa.
  lienzo.hidden = true;
  mostrarEstado("", null);
  $("nota-bloqueada").hidden = !resumen.bloqueada;
  if (resumen.bloqueada) return;
  mostrarEstado("cargando", t().cargando);
  try {
    const nota = leerNota(await estado.archivos.get(resumen.nombreDeFichero).text());
    const bitmaps = await cargarBitmaps(nota, (idImagen) => estado.archivos.get(nombreDeImagen(nota.id, idImagen)));
    if (apertura !== aperturas) return;
    lienzo.hidden = false;
    const vacia = nota.trazos.every((trazo) => trazo.length === 0) && nota.imagenes.every((i) => i.esCajaDeTexto);
    mostrarEstado("vacia", vacia ? t().notaVacia : null);
    vistaActual = crearVista(lienzo, prepararNota(nota, { oscuro: esOscuro() }), bitmaps, {
      alCambiarVista: (v) => { vistaMostrada = v; pintarPildora(); mostrarPildora(); },
    });
    lienzo.focus();
  } catch (e) {
    if (apertura !== aperturas) return;
    mostrarEstado("error", t().noSeDibuja);
    lienzo.hidden = true;
  }
}

function cerrarNota() {
  aperturas++;
  if (vistaActual) vistaActual.destruir();
  vistaActual = null;
  vistaMostrada = null;
  clearTimeout(temporizadorDePildora);
  cerrarPaneles();
  $("nota").hidden = true;
  document.body.classList.remove("con-nota");
}

// ---- Arranque ----

function iniciar() {
  const entrada = $("entrada-carpeta");
  entrada.addEventListener("change", () => {
    const ficheros = [...entrada.files];
    entrada.value = "";
    if (ficheros.length) cargar(ficheros);
  });
  $("elegir").addEventListener("click", () => {
    if (window.showDirectoryPicker) elegirConManejador();
    else entrada.click();
  });

  const zona = document.body;
  zona.addEventListener("dragover", (e) => { e.preventDefault(); zona.classList.add("arrastrando"); });
  zona.addEventListener("dragleave", (e) => { if (!e.relatedTarget) zona.classList.remove("arrastrando"); });
  zona.addEventListener("drop", async (e) => {
    e.preventDefault();
    zona.classList.remove("arrastrando");
    // Las entradas hay que tomarlas ahora: el DataTransfer se vacia al acabar el evento.
    const entradas = [...e.dataTransfer.items].map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    const ficheros = [];
    for (const en of entradas) await recorrerEntrada(en, ficheros);
    if (ficheros.length) cargar(ficheros);
  });

  $("busqueda").addEventListener("input", (e) => { estado.busqueda = e.target.value; pintarLista(); });
  $("carpeta-subir").addEventListener("click", () => {
    const ruta = rutaDeCarpeta(estado.carpetas, estado.carpetaActual);
    entrarEnCarpeta(ruta.length > 1 ? ruta[ruta.length - 2].id : null);
  });
  $("carpetas").addEventListener("scroll", marcarDesvanecidoDeLaFila, { passive: true });
  new ResizeObserver(medirLadoDeCarpeta).observe($("lista"));
  // Los dibujos de las miniaturas siguen al tema, como las de la app.
  const repintarPorTema = () => { if (estado.archivos.size) pintarLista(); };
  document.addEventListener("cambiotema", repintarPorTema);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", repintarPorTema);
  $("nota-volver").addEventListener("click", cerrarNota);
  // Zoom rapido: tocar el porcentaje abre una fila, "Ajustar a la pantalla" (solo con hojas).
  $("zoom-etiqueta").addEventListener("click", () => {
    if (!vistaMostrada) return;
    const abrir = $("menu-zoom").hidden;
    cerrarPaneles();
    $("menu-zoom").hidden = !abrir;
  });
  $("zoom-ajustar").addEventListener("click", () => { cerrarPaneles(); if (vistaActual) vistaActual.encajar(); $("lienzo").focus(); });
  $("pagina-anterior").addEventListener("click", () => vistaActual && vistaActual.irAPagina(vistaActual.pagina() - 1));
  $("pagina-siguiente").addEventListener("click", () => vistaActual && vistaActual.irAPagina(vistaActual.pagina() + 1));
  $("pagina-contador").addEventListener("click", abrirIrAPagina);
  $("pagina-ir").addEventListener("click", irAPagina);
  $("pagina-cancelar").addEventListener("click", () => { cerrarPaneles(); $("lienzo").focus(); });
  $("pagina-campo").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); irAPagina(); }
  });
  // Un toque fuera de un panel lo cierra.
  $("lienzo").addEventListener("pointerdown", cerrarPaneles);
  // Cualquier interaccion con la hoja la trae de vuelta (arrastrar, tocar, teclas), no el ratón suelto.
  $("lienzo").addEventListener("pointerdown", () => vistaMostrada && mostrarPildora());
  $("lienzo").addEventListener("pointermove", (ev) => { if (ev.buttons && vistaMostrada) mostrarPildora(); });
  $("lienzo").addEventListener("keydown", () => vistaMostrada && mostrarPildora());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("nota").hidden) { if (hayPanelAbierto()) { cerrarPaneles(); $("lienzo").focus(); } else cerrarNota(); } });

  // Los textos que genera el JS siguen al selector de idioma de la barra.
  new MutationObserver(() => { if (estado.archivos.size) pintarLista(); pintarPildora(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });
}

iniciar();
