// Idioma de la web: espanol, ingles o frances, con el boton ES/EN/FR de la barra.
//
// Los dos textos van en el HTML con lang="es" / lang="en" / lang="fr" y el CSS oculta
// el inactivo. El idioma sale de lo elegido antes (si el navegador deja
// guardarlo), o del idioma del navegador. Se aplica en el <head> para que no
// parpadee el otro idioma al cargar.
(function () {
  var CLAVE = "idioma";
  var raiz = document.documentElement;
  raiz.classList.add("js");

  function guardado() {
    try { return localStorage.getItem(CLAVE); } catch (e) { return null; }
  }

  function aplicar(idioma) {
    raiz.setAttribute("data-lang", idioma);
    raiz.setAttribute("lang", idioma);
    var titulo = raiz.getAttribute("data-titulo-" + idioma);
    if (titulo) document.title = titulo;
    document.querySelectorAll(".idioma button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.idioma === idioma));
    });
  }

  var IDIOMAS = ["es", "en", "fr"];
  function delNavegador() {
    var n = (navigator.language || "es").toLowerCase().slice(0, 2);
    return IDIOMAS.indexOf(n) >= 0 ? n : "en";
  }
  function delEnlace() {
    var h = location.hash.slice(1);
    return IDIOMAS.indexOf(h) >= 0 ? h : null;
  }

  var guardadoAntes = guardado();
  var inicial = (IDIOMAS.indexOf(guardadoAntes) >= 0 ? guardadoAntes : null) || delNavegador();
  // Un enlace que termina en #en, #es o #fr (por ejemplo desde la ficha de Play) manda.
  if (delEnlace()) inicial = delEnlace();
  aplicar(inicial);

  document.addEventListener("DOMContentLoaded", function () {
    aplicar(raiz.getAttribute("data-lang"));
    document.querySelectorAll(".idioma button").forEach(function (b) {
      b.addEventListener("click", function () {
        aplicar(b.dataset.idioma);
        try { localStorage.setItem(CLAVE, b.dataset.idioma); } catch (e) { /* sin almacenamiento: vale igual */ }
      });
    });

    window.addEventListener("hashchange", function () {
      if (delEnlace()) aplicar(delEnlace());
    });

    var aparecen = document.querySelectorAll(".aparece");
    if (!("IntersectionObserver" in window)) {
      aparecen.forEach(function (el) { el.classList.add("visible"); });
      return;
    }
    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("visible"); observador.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    aparecen.forEach(function (el) { observador.observe(el); });
  });
})();
