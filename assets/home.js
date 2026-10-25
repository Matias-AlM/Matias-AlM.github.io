// Home: video del hero (la parte .video-caja de interaccion.js, rama
// feat/home-bento-en-funciones) y carrusel de funciones.
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
    function esOscuro() { return raiz.dataset.tema ? raiz.dataset.tema === "oscuro" : oscuro.matches; }
    function nombreClip() { return clip + (caja.hasAttribute("data-video-oscuro") && esOscuro() ? "-oscuro" : ""); }
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
    if (caja.hasAttribute("data-video-oscuro")) document.addEventListener("cambiotema", aplicarIdioma);
    observador.observe(caja);
  }

  // ---------- Carrusel de funciones ----------
  // .h-carrusel > .h-pestanas (botones, hidden sin JS) + .h-carrusel-marco > .h-pista > .h-diapo.
  // La pista es un scroll horizontal con scroll-snap: sin JS se desliza a mano. Con JS se
  // anaden flechas y pausa, y avanza solo cada AVANCE ms mientras esta en pantalla, salvo con
  // prefers-reduced-motion, con el raton o el foco encima, o en cuanto alguien lo toca.
  var AVANCE = 6000;
  var TEXTOS_CARRUSEL = {
    region: { es: "Funciones", en: "Features", fr: "Fonctions" },
    diapo: { es: "diapositiva", en: "slide", fr: "diapositive" },
    de: { es: "de", en: "of", fr: "sur" },
    anterior: { es: "Función anterior", en: "Previous feature", fr: "Fonction précédente" },
    siguiente: { es: "Función siguiente", en: "Next feature", fr: "Fonction suivante" },
    pausa: { es: "Detener el paso automático", en: "Stop automatic rotation", fr: "Arrêter le défilement automatique" },
    play: { es: "Pasar solas las funciones", en: "Rotate features automatically", fr: "Faire défiler automatiquement" }
  };
  var FLECHAS = { anterior: "M15 5l-7 7 7 7", siguiente: "M9 5l7 7-7 7" };

  function iniciarCarrusel(carrusel) {
    var pista = carrusel.querySelector(".h-pista");
    var marco = carrusel.querySelector(".h-carrusel-marco");
    var fila = carrusel.querySelector(".h-pestanas");
    var diapos = Array.prototype.slice.call(pista.querySelectorAll(".h-diapo"));
    var pestanas = Array.prototype.slice.call(fila.querySelectorAll(".h-pestana"));
    var actual = 0, enVista = false, encima = false, detenido = sinMovimiento.matches, temporizador;

    function boton(clase, d) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = clase;
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"></path></svg>';
      return b;
    }
    var atras = boton("h-flecha h-flecha-atras", FLECHAS.anterior);
    var alante = boton("h-flecha h-flecha-alante", FLECHAS.siguiente);
    var pausa = boton("h-pausa", "");
    marco.appendChild(atras);
    marco.appendChild(alante);
    fila.appendChild(pausa);
    fila.hidden = false;

    function textos() {
      var l = idioma();
      carrusel.setAttribute("role", "region");
      carrusel.setAttribute("aria-roledescription", "carrusel");
      carrusel.setAttribute("aria-label", TEXTOS_CARRUSEL.region[l]);
      diapos.forEach(function (d, i) {
        d.setAttribute("role", "group");
        d.setAttribute("aria-roledescription", TEXTOS_CARRUSEL.diapo[l]);
        d.setAttribute("aria-label", (i + 1) + " " + TEXTOS_CARRUSEL.de[l] + " " + diapos.length);
      });
      atras.setAttribute("aria-label", TEXTOS_CARRUSEL.anterior[l]);
      alante.setAttribute("aria-label", TEXTOS_CARRUSEL.siguiente[l]);
      pintarPausa();
    }

    function pintarPausa() {
      var estado = detenido ? "play" : "pausa";
      pausa.setAttribute("aria-label", TEXTOS_CARRUSEL[estado][idioma()]);
      pausa.querySelector("path").setAttribute("d", ICONOS[estado]);
    }

    // Marca la diapositiva visible; las demas quedan inert para que el tabulador no se vaya fuera de vista.
    function marcar(n) {
      actual = n;
      diapos.forEach(function (d, i) { d.inert = i !== n; });
      pestanas.forEach(function (p, i) { p.setAttribute("aria-current", String(i === n)); });
      var p = pestanas[n];
      fila.scrollTo({ left: p.offsetLeft - (fila.clientWidth - p.offsetWidth) / 2, behavior: "smooth" });
    }

    function ir(n) {
      n = (n + diapos.length) % diapos.length;
      pista.scrollTo({ left: n * pista.clientWidth, behavior: sinMovimiento.matches ? "auto" : "smooth" });
      marcar(n);
    }

    function programar() {
      clearInterval(temporizador);
      if (!detenido && enVista && !encima) temporizador = setInterval(function () { ir(actual + 1); }, AVANCE);
    }
    function detener() { detenido = true; pintarPausa(); programar(); }

    atras.addEventListener("click", function () { detener(); ir(actual - 1); });
    alante.addEventListener("click", function () { detener(); ir(actual + 1); });
    pestanas.forEach(function (p, i) { p.addEventListener("click", function () { detener(); ir(i); }); });
    pausa.addEventListener("click", function () { detenido = !detenido; pintarPausa(); programar(); });
    pista.addEventListener("pointerdown", detener);
    pista.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); detener(); ir(actual + (e.key === "ArrowRight" ? 1 : -1)); }
    });
    carrusel.addEventListener("mouseenter", function () { encima = true; programar(); });
    carrusel.addEventListener("mouseleave", function () { encima = false; programar(); });
    carrusel.addEventListener("focusin", function () { encima = true; programar(); });
    carrusel.addEventListener("focusout", function (e) { if (!carrusel.contains(e.relatedTarget)) { encima = false; programar(); } });

    // Al deslizar a mano, la diapositiva que queda encajada pasa a ser la actual.
    var espera;
    pista.addEventListener("scroll", function () {
      clearTimeout(espera);
      espera = setTimeout(function () {
        var n = Math.round(pista.scrollLeft / pista.clientWidth);
        if (n !== actual) marcar(n);
      }, 100);
    });
    window.addEventListener("resize", function () { pista.scrollLeft = actual * pista.clientWidth; });

    new IntersectionObserver(function (e) { enVista = e[0].isIntersecting; programar(); }, { threshold: 0.5 }).observe(pista);
    textos();
    alCambiarIdioma(textos);
    marcar(0);
  }

  function iniciar() {
    document.querySelectorAll(".h-carrusel").forEach(iniciarCarrusel);
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
