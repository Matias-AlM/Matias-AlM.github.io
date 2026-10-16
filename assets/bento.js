// Bento de herramientas (celdas estáticas): los vídeos de las celdas se reproducen en bucle y mudos solo cuando se
// ven (carga diferida: el src se pone la primera vez), y se quedan en el póster con prefers-reduced-motion.
// También centra la pestaña activa en la fila con scroll horizontal (móvil).
(function () {
  var raiz = document.documentElement;
  var sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)");
  var videos = Array.prototype.slice.call(document.querySelectorAll(".bento-tools video[data-clip]"));

  function idioma() { return raiz.dataset.lang || "es"; }

  function ruta(video, extension) { return "/video/" + idioma() + "/" + video.dataset.clip + "." + extension; }

  function ajustarIdioma(video) {
    video.poster = ruta(video, "webp");
    if (video.getAttribute("src")) {
      var sonaba = !video.paused;
      video.src = ruta(video, "mp4");
      if (sonaba) video.play().catch(function () {});
    }
  }

  function alCambiarVista(video, enVista) {
    if (!enVista || sinMovimiento.matches) { video.pause(); return; }
    if (video.getAttribute("src") !== ruta(video, "mp4")) video.src = ruta(video, "mp4");
    video.play().catch(function () {});
  }

  videos.forEach(ajustarIdioma);
  new MutationObserver(function () { videos.forEach(ajustarIdioma); }).observe(raiz, { attributes: true, attributeFilter: ["data-lang"] });

  if ("IntersectionObserver" in window) {
    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) { alCambiarVista(e.target, e.isIntersecting); });
    }, { threshold: 0.35 });
    videos.forEach(function (v) { observador.observe(v); });
  }

  Array.prototype.forEach.call(document.querySelectorAll(".bento-tabs .tab"), function (tab) {
    tab.addEventListener("click", function () { tab.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); });
  });
})();
