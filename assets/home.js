// Video del hero de la home: la parte .video-caja de interaccion.js (rama
// feat/home-bento-en-funciones), sin las pestanas.
//
// <div class="video-caja" data-video="hero" data-video-oscuro> usa
// /video/<idioma>/hero.mp4 (o hero-oscuro.mp4 en tema oscuro) y su .webp de poster.
// El video no se descarga hasta que la caja entra en pantalla; con
// prefers-reduced-motion no arranca solo, pero el boton deja reproducirlo.
// Sin JS (o sin IntersectionObserver) se queda el poster. Cargar despues de idioma.js.
(function () {
  var raiz = document.documentElement;
  var sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)");
  var TEXTOS = {
    pausa: { es: "Pausar el vídeo", en: "Pause the video", fr: "Mettre la vidéo en pause" },
    play: { es: "Reproducir el vídeo", en: "Play the video", fr: "Lire la vidéo" }
  };
  var ICONOS = {
    pausa: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
    play: "M8 5v14l11-7z"
  };

  function idioma() { return raiz.dataset.lang || "es"; }

  function alCambiarIdioma(fn) {
    new MutationObserver(fn).observe(raiz, { attributes: true, attributeFilter: ["data-lang"] });
  }

  function iniciarVideo(caja, observador) {
    var clip = caja.dataset.video;
    var video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "none";
    video.setAttribute("aria-hidden", "true");
    caja.appendChild(video);

    var boton = document.createElement("button");
    boton.type = "button";
    boton.className = "video-pausa";
    boton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path></path></svg>';
    caja.appendChild(boton);
    var pausadoPorUsuario = false;

    // Con data-video-oscuro hay una variante «<clip>-oscuro» para el tema oscuro.
    var oscuro = window.matchMedia("(prefers-color-scheme: dark)");
    function nombreClip() { return clip + (caja.hasAttribute("data-video-oscuro") && oscuro.matches ? "-oscuro" : ""); }
    function ruta(extension) { return "/video/" + idioma() + "/" + nombreClip() + "." + extension; }

    function pintarBoton() {
      var estado = video.paused ? "play" : "pausa";
      boton.setAttribute("aria-label", TEXTOS[estado][idioma()]);
      boton.querySelector("path").setAttribute("d", ICONOS[estado]);
    }

    function reproducir() {
      var origen = ruta("mp4");
      if (video.getAttribute("src") !== origen) video.src = origen;
      // Si el navegador la rechaza (ahorro de datos...) el boton sigue mostrando play.
      video.play().catch(function () {});
    }

    function aplicarIdioma() {
      video.poster = ruta("webp");
      if (video.getAttribute("src")) {
        var sonaba = !video.paused;
        video.src = ruta("mp4");
        if (sonaba) reproducir();
      }
      pintarBoton();
    }

    boton.addEventListener("click", function () {
      pausadoPorUsuario = !video.paused;
      if (video.paused) reproducir(); else video.pause();
    });
    video.addEventListener("play", pintarBoton);
    video.addEventListener("pause", pintarBoton);

    // Lo llama el observador al entrar o salir de vista.
    caja.cambioDeVista = function (enVista) {
      if (!enVista) video.pause();
      else if (!sinMovimiento.matches && !pausadoPorUsuario) reproducir();
    };

    aplicarIdioma();
    alCambiarIdioma(aplicarIdioma);
    if (caja.hasAttribute("data-video-oscuro")) {
      if (oscuro.addEventListener) oscuro.addEventListener("change", aplicarIdioma); else if (oscuro.addListener) oscuro.addListener(aplicarIdioma);
    }
    observador.observe(caja);
  }

  function iniciar() {
    var videos = document.querySelectorAll(".video-caja[data-video]");
    if (!videos.length || !("IntersectionObserver" in window)) return;
    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) { e.target.cambioDeVista(e.isIntersecting); });
    }, { threshold: 0.4 });
    videos.forEach(function (caja) { iniciarVideo(caja, observador); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
