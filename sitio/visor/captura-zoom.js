// Ctrl+rueda, pellizco de trackpad y Ctrl/Cmd + + - 0 nunca llegan al zoom del navegador dentro del visor.
// Se escucha en `document` en captura y con passive:false (en window/document Chrome los trata como
// pasivos por defecto y preventDefault no valdria), asi cubre toda la pagina y no solo el lienzo.
// Con nota abierta el gesto es el zoom del visor; sin nota (biblioteca) solo se cancela la rueda: el
// zoom del navegador sigue disponible por menu y por teclado (WCAG 1.4.4).
import { factorDeRueda } from "./gestos.js";

const ACCION_DE_TECLA = { "+": "acercar", "=": "acercar", "-": "alejar", "_": "alejar", "0": "encajar" };

export function capturarZoom(doc, { hayNota, alZoom, alTecla }) {
  const opciones = { capture: true, passive: false };
  const alRueda = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    if (hayNota()) alZoom(factorDeRueda(e.deltaY, e.deltaMode), e.clientX, e.clientY);
  };
  const alTeclear = (e) => {
    const accion = ACCION_DE_TECLA[e.key];
    if (!accion || !(e.ctrlKey || e.metaKey) || e.altKey || !hayNota()) return;
    e.preventDefault();
    alTecla(accion);
  };
  // Safari de escritorio: el pellizco llega como gesturestart/gesturechange con `scale` acumulada.
  let escalaPrevia = 1;
  const alGesto = (e) => {
    e.preventDefault();
    if (e.type === "gesturestart") escalaPrevia = 1;
    else if (e.type === "gesturechange" && hayNota()) { alZoom(e.scale / escalaPrevia, e.clientX, e.clientY); escalaPrevia = e.scale; }
  };
  doc.addEventListener("wheel", alRueda, opciones);
  doc.addEventListener("keydown", alTeclear, opciones);
  for (const tipo of ["gesturestart", "gesturechange", "gestureend"]) doc.addEventListener(tipo, alGesto, opciones);
  return () => {
    doc.removeEventListener("wheel", alRueda, opciones);
    doc.removeEventListener("keydown", alTeclear, opciones);
    for (const tipo of ["gesturestart", "gesturechange", "gestureend"]) doc.removeEventListener(tipo, alGesto, opciones);
  };
}
