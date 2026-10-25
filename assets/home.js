// Home: carrusel de funciones, con un video por diapositiva (excepto sincronizacion).
//
// <figure class="video-caja" data-video="carrusel-pdf"> usa /video/<idioma>/carrusel-pdf.mp4
// (o carrusel-pdf-oscuro.mp4 en tema oscuro) y su .webp de poster. Solo se descarga y
// reproduce el video de la diapositiva actual con el carrusel en pantalla; con
// prefers-reduced-motion o sin JS se queda el poster. Cargar despues de idioma.js.
(function () {
  var raiz = document.documentElement;
  var sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)");

  function idioma() { return raiz.dataset.lang || "es"; }

  function alCambiarIdioma(fn) {
    new MutationObserver(fn).observe(raiz, { attributes: true, attributeFilter: ["data-lang"] });
  }

  // Cada .video-caja del carrusel: la reproduce el carrusel (cambioDeVista) solo si es la
  // diapositiva actual y esta en pantalla; el resto queda en poster, sin descargar nada.
  function iniciarVideo(caja) {
    var clip = caja.dataset.video;
    var video = document.createElement("video");
    video.muted = true;
    // Sin loop: el carrusel avanza en "ended" y, si esta parado, vuelve a empezar el.
    video.playsInline = true;
    video.preload = "none";
    video.setAttribute("aria-hidden", "true");
    caja.appendChild(video);
    caja.video = video;

    // Siempre hay una variante «<clip>-oscuro» para el tema oscuro.
    var oscuro = window.matchMedia("(prefers-color-scheme: dark)");
    function esOscuro() { return raiz.dataset.tema ? raiz.dataset.tema === "oscuro" : oscuro.matches; }
    function ruta(extension) { return "/video/" + idioma() + "/" + clip + (esOscuro() ? "-oscuro" : "") + "." + extension; }

    function reproducir() {
      var origen = ruta("mp4");
      if (video.getAttribute("src") !== origen) video.src = origen;
      // Si el navegador la rechaza (ahorro de datos...) se queda en el poster.
      video.play().catch(function () {});
    }

    // Idioma o tema cambiados: el poster se actualiza; el video solo se recarga si esta sonando
    // (los demas pierden el src, para no bajar la otra variante hasta que les toque).
    function aplicarVariante() {
      video.poster = ruta("webp");
      if (!video.getAttribute("src")) return;
      if (video.paused) { video.removeAttribute("src"); video.load(); }
      else reproducir();
    }

    caja.cambioDeVista = function (activa) {
      if (!activa) video.pause();
      else if (!sinMovimiento.matches) reproducir();
    };

    aplicarVariante();
    alCambiarIdioma(aplicarVariante);
    document.addEventListener("cambiotema", aplicarVariante);
  }

  // ---------- Carrusel de funciones ----------
  // .h-carrusel > .h-pista > .h-diapo (captura + texto); Sin JS la pista es un scroll horizontal con scroll-snap.
  // Con JS (clase .listo), al estilo de notability.com: la diapositiva actual centrada y las
  // vecinas asomando a los lados, mas pequenas (ESCALA) y atenuadas; se mueven con transform.
  // Se cambia tocando una vecina, deslizando o con las flechas del teclado con el foco dentro.
  // Avanza solo cada AVANCE ms mientras esta en pantalla (cambiar a mano reinicia la cuenta);
  // en las diapositivas con video, cuando el video acaba una vuelta (todos duran 8-10 s, asi se ve
  // entero), salvo con prefers-reduced-motion o con el foco del teclado dentro; sin boton de pausa (WCAG 2.2.2), se para con el raton encima o con el dedo puesto.
  var AVANCE = 6000;
  var ESCALA = 0.72;
  var HUECO = 20;
  var TEXTOS_CARRUSEL = {
    region: { es: "Funciones", en: "Features", fr: "Fonctions" },
    diapo: { es: "diapositiva", en: "slide", fr: "diapositive" },
    de: { es: "de", en: "of", fr: "sur" }
  };

  function iniciarCarrusel(carrusel) {
    var pista = carrusel.querySelector(".h-pista");
    var diapos = Array.prototype.slice.call(pista.querySelectorAll(".h-diapo"));
    var total = diapos.length;
    var actual = 0, enVista = false, conFoco = false, encima = false, detenido = sinMovimiento.matches, temporizador;

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
        // Las demas se ocultan a lectores y lo enfocable (el texto) queda inert;
        // la captura de las vecinas sigue recibiendo el raton, para el cursor y el toque.
        d.setAttribute("aria-hidden", String(k !== 0));
        d.querySelectorAll(".h-diapo-texto").forEach(function (el) { el.inert = k !== 0; });
      });
      pista.style.height = diapos[actual].offsetHeight + "px";
    }

    function ir(n) {
      actual = (n + total) % total;
      colocar();
      var video = diapos[actual].querySelector("video");
      if (video) video.currentTime = 0;
      sincronizarVideos();
    }

    // Solo suena el video de la diapositiva actual y con el carrusel en pantalla.
    function sincronizarVideos() {
      diapos.forEach(function (d, i) {
        var caja = d.querySelector(".video-caja");
        if (caja) caja.cambioDeVista(i === actual && enVista);
      });
    }

    function programar() {
      clearTimeout(temporizador);
      if (detenido || !enVista || conFoco || encima) return;
      // Con el video en marcha se espera a que acabe ("ended"); parado, cuenta como una captura.
      var video = diapos[actual].querySelector("video");
      if (video && !video.paused) return;
      temporizador = setTimeout(function () { mover(actual + 1); }, AVANCE);
    }
    function mover(n) { ir(n); programar(); }

    diapos.forEach(function (d, i) {
      var video = d.querySelector("video");
      if (!video) return;
      video.addEventListener("ended", function () {
        if (i !== actual) return;
        if (!detenido && enVista && !conFoco && !encima) mover(actual + 1);
        else { video.currentTime = 0; video.play().catch(function () {}); }
      });
      video.addEventListener("play", function () { if (i === actual) programar(); });
      video.addEventListener("pause", function () { if (i === actual) programar(); });
    });
    carrusel.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        mover(actual + (e.key === "ArrowRight" ? 1 : -1));
      }
    });
    // Pausa con el raton encima o el dedo puesto; al soltar vuelve a contar.
    carrusel.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { encima = true; programar(); } });
    carrusel.addEventListener("pointerleave", function () { encima = false; programar(); });

    // Deslizar con el dedo o el raton, o tocar una vecina para ir a ella. Se escucha en la
    // seccion porque las vecinas asoman fuera de la pista; vale si cae a la altura de la pista.
    var zona = carrusel.closest("section") || carrusel;
    var inicioX = null, inicioY = 0;
    zona.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse") { encima = true; programar(); }
      var caja = pista.getBoundingClientRect();
      inicioX = e.clientY >= caja.top && e.clientY <= caja.bottom ? e.clientX : null;
      inicioY = e.clientY;
    });
    zona.addEventListener("pointerup", function (e) {
      if (e.pointerType !== "mouse") { encima = false; programar(); }
      if (inicioX === null) return;
      var dx = e.clientX - inicioX, dy = e.clientY - inicioY;
      inicioX = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { mover(actual + (dx < 0 ? 1 : -1)); return; }
      var vecina = Math.abs(dx) <= 8 && e.target.closest(".h-diapo.vecina");
      if (vecina) mover(diapos.indexOf(vecina));
    });
    zona.addEventListener("pointercancel", function () { inicioX = null; encima = false; programar(); });
    pista.querySelectorAll("img").forEach(function (img) { img.draggable = false; });

    carrusel.addEventListener("focusin", function (e) { conFoco = e.target.matches(":focus-visible"); programar(); });
    carrusel.addEventListener("focusout", function (e) { if (!carrusel.contains(e.relatedTarget)) { conFoco = false; programar(); } });

    window.addEventListener("resize", colocar);
    // Las capturas son lazy: al cargar puede cambiar la altura.
    diapos.forEach(function (d) { d.querySelectorAll("img").forEach(function (img) { img.addEventListener("load", colocar); }); });
    new IntersectionObserver(function (e) { enVista = e[0].isIntersecting; sincronizarVideos(); programar(); }, { threshold: 0.5 }).observe(pista);
    textos();
    alCambiarIdioma(function () { textos(); colocar(); });
    ir(0);
    // Ya colocadas sin animar; desde el siguiente fotograma, los cambios se animan.
    requestAnimationFrame(function () { requestAnimationFrame(function () { carrusel.classList.add("anima"); }); });
  }

  // Primero los videos: el carrusel los arranca al colocarse.
  function iniciar() {
    document.querySelectorAll(".video-caja[data-video]").forEach(iniciarVideo);
    document.querySelectorAll(".h-carrusel").forEach(iniciarCarrusel);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
