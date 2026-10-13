// Idioma de la web: espanol, ingles o frances, con el desplegable de idioma de la barra.
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
    document.querySelectorAll(".idioma-lista button").forEach(function (b) {
      b.setAttribute("aria-current", String(b.dataset.idioma === idioma));
    });
    document.querySelectorAll(".idioma-actual").forEach(function (t) {
      t.textContent = idioma.toUpperCase();
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

  // Menu de la barra: panel en movil y desplegable de idioma. Escape cierra y devuelve el foco al boton.
  function iniciarMenu() {
    var menu = document.getElementById("menu");
    var botonMenu = document.querySelector(".menu-boton");
    var selector = document.querySelector(".idioma-sel");
    if (!menu || !botonMenu || !selector) return;
    var botonIdioma = selector.querySelector(".idioma-boton");
    var enMovil = window.matchMedia("(max-width: 759px)");

    function abrirIdioma(abrir) {
      selector.classList.toggle("abierto", abrir);
      botonIdioma.setAttribute("aria-expanded", String(abrir));
    }
    function abrirMenu(abrir) {
      menu.classList.toggle("abierto", abrir);
      botonMenu.setAttribute("aria-expanded", String(abrir));
      raiz.classList.toggle("menu-abierto", abrir);
      document.querySelectorAll("main, footer").forEach(function (el) { el.inert = abrir; });
      if (!abrir) abrirIdioma(false);
    }
    // En movil el panel cerrado esta oculto: sus enlaces no reciben foco ni lectores.
    function ajustarPanel() {
      if (!enMovil.matches && menu.classList.contains("abierto")) abrirMenu(false);
    }

    botonMenu.addEventListener("click", function () { abrirMenu(!menu.classList.contains("abierto")); });
    botonIdioma.addEventListener("click", function () { abrirIdioma(!selector.classList.contains("abierto")); });
    selector.querySelectorAll(".idioma-lista button").forEach(function (b) {
      b.addEventListener("click", function () { abrirIdioma(false); botonIdioma.focus(); });
    });
    menu.querySelectorAll(".navegacion a").forEach(function (a) {
      a.addEventListener("click", function () { abrirMenu(false); });
    });
    document.addEventListener("click", function (e) {
      if (!selector.contains(e.target)) abrirIdioma(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (selector.classList.contains("abierto")) {
        abrirIdioma(false);
        botonIdioma.focus();
      } else if (menu.classList.contains("abierto")) {
        abrirMenu(false);
        botonMenu.focus();
      }
    });
    enMovil.addEventListener("change", ajustarPanel);
  }

  document.addEventListener("DOMContentLoaded", function () {
    aplicar(raiz.getAttribute("data-lang"));
    document.querySelectorAll(".idioma button, .idioma-lista button").forEach(function (b) {
      b.addEventListener("click", function () {
        aplicar(b.dataset.idioma);
        try { localStorage.setItem(CLAVE, b.dataset.idioma); } catch (e) { /* sin almacenamiento: vale igual */ }
      });
    });

    iniciarMenu();

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
