// Visor de solo lectura de las notas de SwiftPen. Todo ocurre en este navegador: la carpeta se
// lee con File API, sin red. Los textos de las notas se ponen siempre con textContent.
import {
  esFicheroDeNota, esFicheroDeCarpeta, leerCarpeta, resumenDeNota, leerNota,
  rutaDeCarpeta, ordenarNotas, filtrarNotas, nombreDeImagen,
} from "./formato.js";
import { prepararNota, cargarBitmaps } from "./pintar.js";
import { crearVista } from "./vista.js";

const TEXTOS = {
  es: {
    cargadas: (n) => `${n} ${n === 1 ? "nota" : "notas"}`,
    sinCarpeta: "Sin carpeta", todas: "Todas las carpetas", sinTitulo: "Sin título",
    ilegibles: (n) => `${n} ${n === 1 ? "fichero no se pudo leer" : "ficheros no se pudieron leer"}.`,
    vacia: "No hay notas de SwiftPen en esa carpeta.", sinResultados: "Ninguna nota coincide.",
    cargando: "Cargando…", notaVacia: "Esta nota está vacía.", pagina: (a, b) => `Página ${a} de ${b}`, paginaPalabra: "Página", deTotal: (b) => `de ${b}`, irAPagina: "Ir a una página",
    bloqueada: "Bloqueada", buscar: "Buscar por título", noSeDibuja: "No se pudo dibujar esta nota.",
  },
  en: {
    cargadas: (n) => `${n} ${n === 1 ? "note" : "notes"}`,
    sinCarpeta: "No folder", todas: "All folders", sinTitulo: "Untitled",
    ilegibles: (n) => `${n} ${n === 1 ? "file could not be read" : "files could not be read"}.`,
    vacia: "There are no SwiftPen notes in that folder.", sinResultados: "No note matches.",
    cargando: "Loading…", notaVacia: "This note is empty.", pagina: (a, b) => `Page ${a} of ${b}`, paginaPalabra: "Page", deTotal: (b) => `of ${b}`, irAPagina: "Go to a page",
    bloqueada: "Locked", buscar: "Search by title", noSeDibuja: "This note could not be drawn.",
  },
  fr: {
    cargadas: (n) => `${n} ${n === 1 ? "note" : "notes"}`,
    sinCarpeta: "Sans dossier", todas: "Tous les dossiers", sinTitulo: "Sans titre",
    ilegibles: (n) => `${n} ${n === 1 ? "fichier illisible" : "fichiers illisibles"}.`,
    vacia: "Aucune note SwiftPen dans ce dossier.", sinResultados: "Aucune note ne correspond.",
    cargando: "Chargement…", notaVacia: "Cette note est vide.", pagina: (a, b) => `Page ${a} sur ${b}`, paginaPalabra: "Page", deTotal: (b) => `sur ${b}`, irAPagina: "Aller à une page",
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
  carpetas: new Map(),   // id -> {id, nombre, padreId}
  ilegibles: 0,
  busqueda: "",
  carpetaId: undefined,
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
  estado.carpetas = new Map();
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
    if (esFicheroDeCarpeta(nombre)) trabajos.push(leer(fichero, leerCarpeta, (c) => estado.carpetas.set(c.id, c)));
    else if (esFicheroDeNota(nombre)) {
      trabajos.push(leer(fichero, resumenDeNota, (n) => estado.notas.push({ ...n, nombreDeFichero: nombre })));
    }
  }
  await Promise.all(trabajos);
  estado.notas = ordenarNotas(estado.notas);
  estado.busqueda = "";
  estado.carpetaId = undefined;
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

// ---- Lista ----

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
      img.addEventListener("load", () => URL.revokeObjectURL(img.src));
      tarjeta.querySelector(".miniatura").replaceChildren(img);
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
  miniaturas.worker.postMessage({ id, archivo: estado.archivos.get(nota.nombreDeFichero), imagenes, ancho: 320 });
}

const observador = new IntersectionObserver((entradas) => {
  for (const e of entradas) {
    if (!e.isIntersecting) continue;
    observador.unobserve(e.target);
    miniaturas.cola.push({ tarjeta: e.target, nota: e.target.nota });
  }
  siguienteMiniatura();
}, { rootMargin: "300px" });

const ICONO_CANDADO = "M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z";
function candado() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "candado");
  const camino = document.createElementNS(ns, "path");
  camino.setAttribute("d", ICONO_CANDADO);
  svg.append(camino);
  return svg;
}

function formatoDeFecha(ms) {
  if (!ms) return "";
  return new Intl.DateTimeFormat(idioma(), { dateStyle: "medium" }).format(new Date(ms));
}

function tarjetaDe(nota) {
  const tarjeta = el("button", "tarjeta");
  tarjeta.type = "button";
  tarjeta.nota = nota;
  const marco = el("span", "miniatura");
  if (nota.bloqueada) {
    marco.classList.add("bloqueada");
    marco.append(candado());
  }
  const titulo = el("span", "tarjeta-titulo", nota.titulo || t().sinTitulo);
  const meta = el("span", "tarjeta-meta");
  const carpeta = nota.carpetaId ? rutaDeCarpeta(estado.carpetas, nota.carpetaId) : "";
  if (carpeta) meta.append(el("span", "tarjeta-carpeta", carpeta));
  meta.append(el("span", "tarjeta-fecha", formatoDeFecha(nota.fecha)));
  tarjeta.append(marco, titulo, meta);
  if (nota.bloqueada) {
    tarjeta.append(el("span", "etiqueta-bloqueada", t().bloqueada));
    tarjeta.setAttribute("aria-label", `${nota.titulo || t().sinTitulo} (${t().bloqueada})`);
  }
  tarjeta.addEventListener("click", () => abrirNota(nota));
  if (!nota.bloqueada) observador.observe(tarjeta);
  return tarjeta;
}

function pintarCarpetas() {
  $("busqueda").placeholder = t().buscar;
  const selector = $("carpeta");
  const conCarpeta = new Set(estado.notas.map((n) => n.carpetaId).filter(Boolean));
  const opciones = [["", t().todas]];
  if (estado.notas.some((n) => !n.carpetaId)) opciones.push(["__ninguna", t().sinCarpeta]);
  const rutas = [...conCarpeta].map((id) => [id, rutaDeCarpeta(estado.carpetas, id) || id]);
  rutas.sort((a, b) => a[1].localeCompare(b[1]));
  opciones.push(...rutas);
  const actual = estado.carpetaId === undefined ? "" : estado.carpetaId === null ? "__ninguna" : estado.carpetaId;
  selector.replaceChildren(...opciones.map(([valor, nombre]) => {
    const o = el("option", "", nombre);
    o.value = valor;
    return o;
  }));
  selector.value = actual;
}

function pintarLista() {
  miniaturas.cola = [];
  const visibles = filtrarNotas(estado.notas, { busqueda: estado.busqueda, carpetaId: estado.carpetaId });
  $("cuenta").textContent = t().cargadas(visibles.length);
  $("lista").replaceChildren(...visibles.map(tarjetaDe));
  const aviso = $("aviso");
  const mensajes = [];
  if (estado.ilegibles) mensajes.push(t().ilegibles(estado.ilegibles));
  if (visibles.length === 0) mensajes.push(estado.notas.length === 0 ? t().vacia : t().sinResultados);
  aviso.textContent = mensajes.join(" ");
  aviso.hidden = mensajes.length === 0;
}

function pintarTodo() {
  const hayCarpeta = estado.archivos.size > 0;
  $("inicio").hidden = hayCarpeta;
  $("biblioteca").hidden = !hayCarpeta;
  if (!hayCarpeta) return;
  iniciarWorker();
  pintarCarpetas();
  pintarLista();
}

// ---- Nota abierta ----

let vistaActual = null;
let aperturas = 0;                 // para descartar una lectura lenta si ya se abrio otra nota o se cerro
let paginaMostrada = null;         // {actual, total}

function mostrarEstado(clase, texto) {
  const aviso = $("nota-estado");
  aviso.hidden = texto === null;
  aviso.className = `visor-estado ${clase}`;
  aviso.textContent = texto ?? "";
}

function pintarContadorDePagina() {
  const caja = $("nota-pagina");
  caja.hidden = !paginaMostrada || paginaMostrada.total < 2;
  if (caja.hidden) return;
  $("pagina-boton").textContent = t().pagina(paginaMostrada.actual, paginaMostrada.total);
  $("pagina-boton").setAttribute("aria-label", t().irAPagina);
  $("pagina-etiqueta").textContent = t().paginaPalabra;
  $("pagina-total").textContent = t().deTotal(paginaMostrada.total);
  $("pagina-campo").max = String(paginaMostrada.total);
}

function editarPagina(editar) {
  $("pagina-boton").hidden = editar;
  $("pagina-edicion").hidden = !editar;
  if (editar) {
    const campo = $("pagina-campo");
    campo.value = String(paginaMostrada.actual);
    campo.focus();
    campo.select();
  }
}

function saltarAPagina() {
  const campo = $("pagina-campo");
  const n = Math.round(Number(campo.value));
  if (vistaActual && Number.isFinite(n) && n >= 1) vistaActual.irAPagina(Math.min(n, vistaActual.total));
  editarPagina(false);
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
  paginaMostrada = null;
  pintarContadorDePagina();
  editarPagina(false);
  // Una nota bloqueada nunca se lee ni se dibuja: solo se avisa.
  lienzo.hidden = true;
  mostrarEstado("", null);
  $("nota-bloqueada").hidden = !resumen.bloqueada;
  $("nota-zoom").hidden = resumen.bloqueada;
  if (resumen.bloqueada) return;
  mostrarEstado("cargando", t().cargando);
  try {
    const nota = leerNota(await estado.archivos.get(resumen.nombreDeFichero).text());
    const bitmaps = await cargarBitmaps(nota, (idImagen) => estado.archivos.get(nombreDeImagen(nota.id, idImagen)));
    if (apertura !== aperturas) return;
    lienzo.hidden = false;
    const vacia = nota.trazos.every((trazo) => trazo.length === 0) && nota.imagenes.every((i) => i.esCajaDeTexto);
    mostrarEstado("vacia", vacia ? t().notaVacia : null);
    vistaActual = crearVista(lienzo, prepararNota(nota), bitmaps, {
      alCambiarPagina: (actual, total) => { paginaMostrada = { actual, total }; pintarContadorDePagina(); },
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
  paginaMostrada = null;
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
  $("carpeta").addEventListener("change", (e) => {
    const v = e.target.value;
    estado.carpetaId = v === "" ? undefined : v === "__ninguna" ? null : v;
    pintarLista();
  });

  $("nota-volver").addEventListener("click", cerrarNota);
  $("zoom-mas").addEventListener("click", () => vistaActual && vistaActual.acercar());
  $("zoom-menos").addEventListener("click", () => vistaActual && vistaActual.alejar());
  $("zoom-encajar").addEventListener("click", () => vistaActual && vistaActual.encajar());
  $("pagina-boton").addEventListener("click", () => paginaMostrada && editarPagina(true));
  $("pagina-campo").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); saltarAPagina(); }
    else if (ev.key === "Escape") { ev.stopPropagation(); editarPagina(false); $("lienzo").focus(); }
  });
  $("pagina-campo").addEventListener("blur", () => editarPagina(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("nota").hidden) cerrarNota(); });

  // Los textos que genera el JS siguen al selector de idioma de la barra.
  new MutationObserver(() => { if (estado.archivos.size) { pintarCarpetas(); pintarLista(); } pintarContadorDePagina(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });
}

iniciar();
