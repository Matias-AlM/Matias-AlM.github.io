// Tema de la web: automatico (sigue al sistema), claro u oscuro, con el boton de la barra.
//
// El tema forzado vive en <html data-tema="claro|oscuro"> (sin atributo = automatico) y se guarda
// en localStorage["tema"]. idioma.js lo pone en el <head> para que no parpadee el otro tema; aqui
// se alterna, se guarda y se reescribe lo que el CSS no alcanza: los media="(prefers-color-scheme)"
// de <source> y <meta theme-color>. Cada cambio emite "cambiotema" en document (lo usa home.js).
(function () {
  var CLAVE = "tema";
  var raiz = document.documentElement;
  var sistema = window.matchMedia("(prefers-color-scheme: dark)");

  var TEXTOS = {
    es: { auto: "Automático", claro: "Claro", oscuro: "Oscuro", aria: "Tema: {0}. Cambiar a {1}" },
    en: { auto: "Automatic", claro: "Light", oscuro: "Dark", aria: "Theme: {0}. Switch to {1}" },
    fr: { auto: "Automatique", claro: "Clair", oscuro: "Sombre", aria: "Thème : {0}. Passer à {1}" }
  };

  function tema() { return raiz.getAttribute("data-tema") || "auto"; }
  function idioma() { return TEXTOS[raiz.dataset.lang] ? raiz.dataset.lang : "es"; }

  // Ciclo: la primera pulsacion desde automatico cambia siempre lo que se ve (va al opuesto del sistema).
  function siguiente(actual) {
    var primero = sistema.matches ? "claro" : "oscuro";
    var segundo = primero === "claro" ? "oscuro" : "claro";
    return actual === "auto" ? primero : actual === primero ? segundo : "auto";
  }

  // Los <source>/<meta> con media de prefers-color-scheme: el original se guarda en data-media-original.
  function reescribirMedia(nodo) {
    var forzado = raiz.getAttribute("data-tema");
    nodo.querySelectorAll('[media*="prefers-color-scheme"], [data-media-original]').forEach(function (el) {
      var original = el.getAttribute("data-media-original");
      if (original === null) { original = el.getAttribute("media"); el.setAttribute("data-media-original", original); }
      if (!forzado) { el.setAttribute("media", original); return; }
      var esOscuro = original.indexOf("dark") >= 0;
      el.setAttribute("media", esOscuro === (forzado === "oscuro") ? "all" : "not all");
    });
  }

  function pintarBotones() {
    var t = TEXTOS[idioma()];
    var actual = tema();
    document.querySelectorAll(".tema-boton").forEach(function (b) {
      b.setAttribute("aria-label", t.aria.replace("{0}", t[actual]).replace("{1}", t[siguiente(actual)]));
      b.querySelector(".tema-texto").textContent = t[actual];
    });
  }

  function aplicar(nuevo, guardar) {
    if (nuevo === "auto") raiz.removeAttribute("data-tema"); else raiz.setAttribute("data-tema", nuevo);
    if (guardar) {
      try {
        if (nuevo === "auto") localStorage.removeItem(CLAVE); else localStorage.setItem(CLAVE, nuevo);
      } catch (e) { /* sin almacenamiento: funciona igual, sin recordar */ }
    }
    reescribirMedia(document);
    pintarBotones();
    document.dispatchEvent(new CustomEvent("cambiotema"));
  }

  // Los <source> llegan con el HTML: se corrigen segun se parsean, antes de que el navegador elija imagen.
  if (raiz.getAttribute("data-tema")) {
    var parseo = new MutationObserver(function (cambios) {
      cambios.forEach(function (c) { c.addedNodes.forEach(function (n) { if (n.nodeType === 1) reescribirMedia(n.parentNode || document); }); });
    });
    parseo.observe(document, { childList: true, subtree: true });
    document.addEventListener("DOMContentLoaded", function () { parseo.disconnect(); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    reescribirMedia(document);
    pintarBotones();
    document.querySelectorAll(".tema-boton").forEach(function (b) {
      b.addEventListener("click", function () {
        raiz.classList.add("tema-anima");
        setTimeout(function () { raiz.classList.remove("tema-anima"); }, 350);
        aplicar(siguiente(tema()), true);
      });
    });
    // El boton lleva el texto en el idioma activo: se repinta cuando idioma.js lo cambia.
    new MutationObserver(pintarBotones).observe(raiz, { attributes: true, attributeFilter: ["data-lang"] });
  });

  // En automatico el sistema manda: el CSS y los <source> ya lo siguen; solo se avisa a quien escuche.
  var avisar = function () { pintarBotones(); if (!raiz.getAttribute("data-tema")) document.dispatchEvent(new CustomEvent("cambiotema")); };
  if (sistema.addEventListener) sistema.addEventListener("change", avisar); else if (sistema.addListener) sistema.addListener(avisar);
})();
