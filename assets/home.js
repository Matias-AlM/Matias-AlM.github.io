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
  // .h-carrusel > .h-pestanas (botones, hidden sin JS) + .h-pista > .h-diapo
  // (captura + texto). Sin JS la pista es un scroll horizontal con scroll-snap.
  // Con JS (clase .listo), al estilo de notability.com: la diapositiva actual centrada y las
  // vecinas asomando a los lados, mas pequenas (ESCALA) y atenuadas; se mueven con transform.
  // Se cambia tocando una vecina, deslizando o con las pestanas (y sus flechas del teclado).
  // Avanza solo cada AVANCE ms mientras esta en pantalla (cambiar a mano reinicia la cuenta),
  // salvo con prefers-reduced-motion o con el foco del teclado dentro; el boton de la fila lo pausa y reanuda.
  var AVANCE = 6000;
  var ESCALA = 0.72;
  var HUECO = 20;
  var TEXTOS_CARRUSEL = {
    region: { es: "Funciones", en: "Features", fr: "Fonctions" },
    diapo: { es: "diapositiva", en: "slide", fr: "diapositive" },
    de: { es: "de", en: "of", fr: "sur" },
    pausa: { es: "Detener el paso automático", en: "Stop automatic rotation", fr: "Arrêter le défilement automatique" },
    play: { es: "Pasar solas las funciones", en: "Rotate features automatically", fr: "Faire défiler automatiquement" }
  };

  function iniciarCarrusel(carrusel) {
    var pista = carrusel.querySelector(".h-pista");
    var fila = carrusel.querySelector(".h-pestanas");
    var diapos = Array.prototype.slice.call(pista.querySelectorAll(".h-diapo"));
    var pestanas = Array.prototype.slice.call(fila.querySelectorAll(".h-pestana"));
    var total = diapos.length;
    var actual = 0, enVista = false, conFoco = false, detenido = sinMovimiento.matches, temporizador;

    function boton(clase, d) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = clase;
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"></path></svg>';
      return b;
    }
    var pausa = boton("h-pausa", "");
    fila.appendChild(pausa);
    fila.hidden = false;
    pista.removeAttribute("tabindex");
    carrusel.classList.add("listo");

    function textos() {
      var l = idioma();
      carrusel.setAttribute("role", "region");
      carrusel.setAttribute("aria-roledescription", "carrusel");
      carrusel.setAttribute("aria-label", TEXTOS_CARRUSEL.region[l]);
      diapos.forEach(function (d, i) {
        d.setAttribute("role", "group");
        d.setAttribute("aria-roledescription", TEXTOS_CARRUSEL.diapo[l]);
        d.setAttribute("aria-label", (i + 1) + " " + TEXTOS_CARRUSEL.de[l] + " " + total);
      });
      pintarPausa();
    }

    function pintarPausa() {
      var estado = detenido ? "play" : "pausa";
      pausa.setAttribute("aria-label", TEXTOS_CARRUSEL[estado][idioma()]);
      pausa.querySelector("path").setAttribute("d", ICONOS[estado]);
    }

    // Distancia circular de la diapositiva i a la actual: de -3 a 3 con 7 diapositivas.
    function distancia(i) {
      var d = ((i - actual) % total + total) % total;
      return d > total / 2 ? d - total : d;
    }

    // Coloca cada diapositiva. Las vecinas se centran en vertical sobre la captura de la actual;
    // las que quedan a 2 o mas no se ven (asi, al dar la vuelta, el salto no se nota).
    function colocar() {
      var ancho = diapos[0].offsetWidth;
      var captura = diapos[actual].querySelector(".h-captura, .captura-pendiente").offsetHeight;
      var paso = ancho * (1 + ESCALA) / 2 + HUECO;
      diapos.forEach(function (d, i) {
        var k = distancia(i);
        var escala = k === 0 ? 1 : ESCALA;
        var y = k === 0 ? 0 : captura * (1 - ESCALA) / 2;
        d.style.transform = "translate(" + (k * paso) + "px, " + y + "px) scale(" + escala + ")";
        d.classList.toggle("actual", k === 0);
        d.classList.toggle("vecina", Math.abs(k) === 1);
        // Las demas se ocultan a lectores y su texto (lo unico enfocable) queda inert; la
        // captura de las vecinas sigue recibiendo el raton, para el cursor y el toque.
        d.setAttribute("aria-hidden", String(k !== 0));
        d.querySelector(".h-diapo-texto").inert = k !== 0;
      });
      pista.style.height = diapos[actual].offsetHeight + "px";
    }

    function ir(n) {
      actual = (n + total) % total;
      colocar();
      pestanas.forEach(function (p, i) { p.setAttribute("aria-current", String(i === actual)); });
      var p = pestanas[actual];
      fila.scrollTo({ left: p.offsetLeft - (fila.clientWidth - p.offsetWidth) / 2, behavior: "smooth" });
    }

    function programar() {
      clearInterval(temporizador);
      if (!detenido && enVista && !conFoco) temporizador = setInterval(function () { ir(actual + 1); }, AVANCE);
    }
    function mover(n) { ir(n); programar(); }

    pestanas.forEach(function (p, i) { p.addEventListener("click", function () { mover(i); }); });
    pausa.addEventListener("click", function () { detenido = !detenido; pintarPausa(); programar(); });
    carrusel.addEventListener("keydown", function (e) {
      if (e.target.closest(".h-pestanas") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        mover(actual + (e.key === "ArrowRight" ? 1 : -1));
        pestanas[actual].focus();
      }
    });

    // Deslizar con el dedo o el raton, o tocar una vecina para ir a ella. Se escucha en la
    // seccion porque las vecinas asoman fuera de la pista; vale si cae a la altura de la pista.
    var zona = carrusel.closest("section") || carrusel;
    var inicioX = null, inicioY = 0;
    zona.addEventListener("pointerdown", function (e) {
      var caja = pista.getBoundingClientRect();
      inicioX = e.clientY >= caja.top && e.clientY <= caja.bottom ? e.clientX : null;
      inicioY = e.clientY;
    });
    zona.addEventListener("pointerup", function (e) {
      if (inicioX === null) return;
      var dx = e.clientX - inicioX, dy = e.clientY - inicioY;
      inicioX = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { mover(actual + (dx < 0 ? 1 : -1)); return; }
      var vecina = Math.abs(dx) <= 8 && e.target.closest(".h-diapo.vecina");
      if (vecina) mover(diapos.indexOf(vecina));
    });
    zona.addEventListener("pointercancel", function () { inicioX = null; });
    pista.querySelectorAll("img").forEach(function (img) { img.draggable = false; });

    carrusel.addEventListener("focusin", function (e) { conFoco = e.target.matches(":focus-visible"); programar(); });
    carrusel.addEventListener("focusout", function (e) { if (!carrusel.contains(e.relatedTarget)) { conFoco = false; programar(); } });

    window.addEventListener("resize", colocar);
    // Las capturas son lazy: al cargar puede cambiar la altura.
    diapos.forEach(function (d) { d.querySelectorAll("img").forEach(function (img) { img.addEventListener("load", colocar); }); });
    new IntersectionObserver(function (e) { enVista = e[0].isIntersecting; programar(); }, { threshold: 0.5 }).observe(pista);
    textos();
    alCambiarIdioma(function () { textos(); colocar(); });
    ir(0);
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
