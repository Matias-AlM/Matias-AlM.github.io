// Interaccion del rediseno: pestanas (patron APG) y videos de ayuda.
//
// Sin JS todo el contenido se ve apilado: los paneles no llevan hidden en el HTML, lo
// pone este script. El acordeon es <details> y no necesita JS. Cargar despues de idioma.js.
(function () {
  var raiz = document.documentElement;
  var sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)");
  var TEXTOS = {
    pausa: { es: "Pausar", en: "Pause", fr: "Mettre en pause" },
    play: { es: "Reproducir", en: "Play", fr: "Lire" }
  };
  var ICONOS = {
    pausa: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
    play: "M8 5v14l11-7z"
  };

  function idioma() { return raiz.dataset.lang || "es"; }

  function alCambiarIdioma(fn) {
    new MutationObserver(fn).observe(raiz, { attributes: true, attributeFilter: ["data-lang"] });
  }

  // ---------- Pestanas ----------
  function iniciarPestanas(contenedor) {
    var tabs = Array.prototype.slice.call(contenedor.querySelectorAll("[role=tab]"));
    var paneles = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
    var inicial = tabs.findIndex(function (t) { return t.getAttribute("aria-selected") === "true"; });

    function elegir(i, enfocar) {
      tabs.forEach(function (t, j) {
        t.setAttribute("aria-selected", String(i === j));
        t.tabIndex = i === j ? 0 : -1;
        paneles[j].hidden = i !== j;
      });
      if (enfocar) tabs[i].focus();
    }

    // Todos los paneles miden lo mismo (el mayor) para que la pagina no salte al cambiar.
    function igualarAlturas() {
      contenedor.style.setProperty("--alto-panel", "0px");
      var ocultos = paneles.map(function (p) { return p.hidden; });
      paneles.forEach(function (p) { p.hidden = false; });
      var alto = Math.max.apply(null, paneles.map(function (p) { return p.offsetHeight; }));
      paneles.forEach(function (p, j) { p.hidden = ocultos[j]; });
      contenedor.style.setProperty("--alto-panel", alto + "px");
    }

    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { elegir(i, false); });
      t.addEventListener("keydown", function (e) {
        var destino = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (destino === undefined) return;
        e.preventDefault();
        elegir((destino + tabs.length) % tabs.length, true);
      });
    });

    elegir(Math.max(inicial, 0), false);
    igualarAlturas();
    var pendiente;
    function reprogramar() { clearTimeout(pendiente); pendiente = setTimeout(igualarAlturas, 120); }
    window.addEventListener("resize", reprogramar);
    alCambiarIdioma(reprogramar);
    if (document.fonts) document.fonts.ready.then(igualarAlturas);
  }

  // ---------- Videos ----------
  // <figure class="video-caja" data-video="clip"> usa /video/<idioma>/<clip>.mp4 y .webp (poster).
  function iniciarVideo(caja, observador) {
    var clip = caja.dataset.video;
    var video = caja.querySelector("video");
    if (!video) {
      video = document.createElement("video");
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "none";
      caja.insertBefore(video, caja.firstChild);
    }
    var boton = caja.querySelector(".video-pausa");
    if (!boton) {
      boton = document.createElement("button");
      boton.type = "button";
      boton.className = "video-pausa";
      boton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path></path></svg>';
      caja.appendChild(boton);
    }
    var pausadoPorUsuario = false;

    function ruta(extension) { return "/video/" + idioma() + "/" + clip + "." + extension; }

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

    // Lo llama el observador al entrar o salir de vista (tambien al ocultarse su pestana).
    caja.cambioDeVista = function (enVista) {
      if (!enVista) video.pause();
      else if (!sinMovimiento.matches && !pausadoPorUsuario) reproducir();
    };

    aplicarIdioma();
    alCambiarIdioma(aplicarIdioma);
    observador.observe(caja);
  }

  function iniciar() {
    document.querySelectorAll(".tabs").forEach(iniciarPestanas);
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
