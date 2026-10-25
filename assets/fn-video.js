// Páginas de función: vídeo en bucle en la cabecera.
//
// <figure class="cabecera-imagen fn-video" data-video="carrusel-audio"> usa
// /video/<idioma>/carrusel-audio.mp4 (carrusel-audio-oscuro.mp4 en tema oscuro) y el <picture>
// de dentro (su .webp) como póster. Solo se descarga y suena con la figura en pantalla; con
// prefers-reduced-motion o sin JS se queda el póster. Cargar después de idioma.js.
(function () {
  var raiz = document.documentElement;
  var sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)");
  var oscuro = window.matchMedia("(prefers-color-scheme: dark)");

  function idioma() { return raiz.dataset.lang || "es"; }
  function esOscuro() { return raiz.dataset.tema ? raiz.dataset.tema === "oscuro" : oscuro.matches; }

  function iniciar(caja) {
    var clip = caja.dataset.video;
    var video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "none";
    video.setAttribute("aria-hidden", "true");
    caja.appendChild(video);

    var visible = false;
    function ruta(extension) { return "/video/" + idioma() + "/" + clip + (esOscuro() ? "-oscuro" : "") + "." + extension; }
    function reproducir() {
      var origen = ruta("mp4");
      if (video.getAttribute("src") !== origen) video.src = origen;
      video.play().catch(function () {});
    }
    function aplicar() {
      video.poster = ruta("webp");
      if (!video.getAttribute("src")) return;
      if (visible && !sinMovimiento.matches) reproducir();
      else { video.removeAttribute("src"); video.load(); }
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entradas) {
        visible = entradas[0].isIntersecting;
        if (!visible) video.pause();
        else if (!sinMovimiento.matches) reproducir();
      }, { threshold: 0.4 }).observe(caja);
    }

    aplicar();
    new MutationObserver(aplicar).observe(raiz, { attributes: true, attributeFilter: ["data-lang"] });
    document.addEventListener("cambiotema", aplicar);
  }

  document.querySelectorAll(".fn-video[data-video]").forEach(iniciar);
})();
