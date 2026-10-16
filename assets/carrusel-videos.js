// Carrusel de videos de ayuda: el del centro suena y se ve entero; los vecinos, mas pequenos y
// translucidos. Al acabar el central pasa solo al siguiente. Se mueve con flechas, puntos,
// pulsando un vecino o deslizando. Con movimiento reducido nada arranca ni avanza solo y el
// boton de pausa/play sigue visible. Sin JS el HTML queda apilado (ver carrusel-videos.css).
// Cargar despues de idioma.js. No depende de interaccion.js.
(function () {
  var raiz = document.documentElement;
  var sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)");
  var TEXTOS = {
    pausa: { es: "Pausar", en: "Pause", fr: "Mettre en pause" },
    play: { es: "Reproducir", en: "Play", fr: "Lire" },
    anterior: { es: "Vídeo anterior", en: "Previous video", fr: "Vidéo précédente" },
    siguiente: { es: "Vídeo siguiente", en: "Next video", fr: "Vidéo suivante" },
    ir: { es: "Vídeo {n} de {total}", en: "Video {n} of {total}", fr: "Vidéo {n} sur {total}" }
  };
  var ICONOS = { pausa: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z", play: "M8 5v14l11-7z" };
  var ESCALA = [1, 0.78, 0.62, 0.5];
  var OPACIDAD = [1, 0.45, 0.2, 0];
  var SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="%"/></svg>';

  function idioma() { return raiz.dataset.lang || "es"; }
  function texto(clave, n, total) {
    return TEXTOS[clave][idioma()].replace("{n}", n).replace("{total}", total);
  }
  function crear(etiqueta, clase, html) {
    var e = document.createElement(etiqueta);
    e.className = clase;
    if (html) e.innerHTML = html;
    return e;
  }

  function iniciar(carrusel) {
    var lista = carrusel.querySelector(".cv-lista");
    var items = Array.prototype.slice.call(lista.children);
    var total = items.length;
    var videos = items.map(function (it) { return it.querySelector("video"); });
    var textos = items.map(function (it) { return it.querySelector(".cv-texto"); });
    var descripcion = crear("div", "cv-descripcion");
    var activo = 0;
    var pausadoPorUsuario = false;
    var enVista = false;

    // Sin controles nativos ni <source>: el JS pone src segun el idioma.
    videos.forEach(function (v) {
      v.removeAttribute("controls");
      Array.prototype.forEach.call(v.querySelectorAll("source"), function (s) { s.remove(); });
      v.loop = false;
      v.muted = true;
    });
    textos.forEach(function (p) { descripcion.appendChild(p); });
    lista.parentNode.insertBefore(descripcion, lista.nextSibling);

    var controles = crear("div", "cv-controles");
    var anterior = crear("button", "cv-boton cv-anterior", SVG.replace("%", "M15 5l-7 7 7 7"));
    var siguiente = crear("button", "cv-boton cv-siguiente", SVG.replace("%", "M9 5l7 7-7 7"));
    var pausa = crear("button", "cv-boton cv-pausa", SVG.replace("%", ICONOS.pausa));
    var puntos = crear("div", "cv-puntos");
    [anterior, siguiente, pausa].forEach(function (b) { b.type = "button"; });
    var botonesPunto = items.map(function (_, i) {
      var b = crear("button", "cv-punto");
      b.type = "button";
      b.addEventListener("click", function () { ir(i); });
      puntos.appendChild(b);
      return b;
    });
    controles.appendChild(anterior);
    controles.appendChild(pausa);
    controles.appendChild(siguiente);
    controles.appendChild(puntos);
    descripcion.parentNode.insertBefore(controles, descripcion.nextSibling);
    carrusel.classList.add("cv-activo");

    function ruta(clip, ext) { return "/video/" + idioma() + "/" + clip + "." + ext; }

    function pintarPausa() {
      var estado = videos[activo].paused ? "play" : "pausa";
      pausa.setAttribute("aria-label", texto(estado));
      pausa.querySelector("path").setAttribute("d", ICONOS[estado]);
    }
    function pintarEtiquetas() {
      anterior.setAttribute("aria-label", texto("anterior"));
      siguiente.setAttribute("aria-label", texto("siguiente"));
      botonesPunto.forEach(function (b, i) { b.setAttribute("aria-label", texto("ir", i + 1, total)); });
      pintarPausa();
    }

    function permitido() { return enVista && !document.hidden && !sinMovimiento.matches && !pausadoPorUsuario; }

    function reproducir() {
      var v = videos[activo];
      var origen = ruta(v.dataset.clip, "mp4");
      if (v.getAttribute("src") !== origen) v.src = origen;
      // Si el navegador la rechaza (ahorro de datos...) el boton sigue mostrando play.
      var p = v.play();
      if (p) p.catch(function () {});
    }
    // Vuelve al poster y deja de tener el video cargado
    function soltar(i) {
      var v = videos[i];
      v.pause();
      if (v.getAttribute("src")) { v.removeAttribute("src"); v.load(); }
    }

    function colocar() {
      var mitad = Math.floor(total / 2);
      items.forEach(function (it, i) {
        var o = ((i - activo + total + mitad) % total) - mitad;
        var d = Math.min(Math.abs(o), 3);
        it.style.setProperty("--o", o);
        it.style.setProperty("--s", ESCALA[d]);
        it.style.setProperty("--op", OPACIDAD[d]);
        it.style.setProperty("--z", 10 - d);
        it.dataset.d = d;
        it.setAttribute("aria-hidden", d === 0 ? "false" : "true");
        textos[i].classList.toggle("cv-actual", i === activo);
        botonesPunto[i].setAttribute("aria-current", String(i === activo));
      });
    }

    function ir(i) {
      i = (i + total) % total;
      if (i === activo) return;
      soltar(activo);
      activo = i;
      colocar();
      if (permitido()) reproducir();
      pintarPausa();
    }

    anterior.addEventListener("click", function () { ir(activo - 1); });
    siguiente.addEventListener("click", function () { ir(activo + 1); });
    pausa.addEventListener("click", function () {
      var v = videos[activo];
      if (v.paused) { pausadoPorUsuario = false; reproducir(); }
      else { pausadoPorUsuario = true; v.pause(); }
    });
    carrusel.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowLeft") { ev.preventDefault(); ir(activo - 1); }
      else if (ev.key === "ArrowRight") { ev.preventDefault(); ir(activo + 1); }
    });

    videos.forEach(function (v, i) {
      v.addEventListener("play", function () { if (i === activo) pintarPausa(); });
      v.addEventListener("pause", function () { if (i === activo) pintarPausa(); });
      v.addEventListener("ended", function () {
        if (i !== activo) return;
        if (sinMovimiento.matches) pintarPausa(); else ir(activo + 1);
      });
    });

    // Pulsar un vecino o deslizar (un arrastre no cuenta como pulsacion)
    var inicioX = null, arrastro = false;
    lista.addEventListener("pointerdown", function (ev) { inicioX = ev.clientX; arrastro = false; });
    lista.addEventListener("pointerup", function (ev) {
      if (inicioX === null) return;
      var dx = ev.clientX - inicioX;
      inicioX = null;
      if (Math.abs(dx) > 40) { arrastro = true; ir(activo + (dx < 0 ? 1 : -1)); }
    });
    lista.addEventListener("pointercancel", function () { inicioX = null; });
    items.forEach(function (it, i) {
      it.addEventListener("click", function () { if (!arrastro) ir(i); arrastro = false; });
    });

    // Idioma: poster y video de la carpeta del idioma activo (conserva el instante y el estado)
    function aplicarIdioma() {
      videos.forEach(function (v, i) {
        v.poster = ruta(v.dataset.clip, "webp");
        if (i === activo && v.getAttribute("src")) {
          var t = v.currentTime, sonaba = !v.paused;
          v.src = ruta(v.dataset.clip, "mp4");
          v.currentTime = t;
          if (sonaba) reproducir();
        }
      });
      pintarEtiquetas();
    }
    new MutationObserver(aplicarIdioma).observe(raiz, { attributes: true, attributeFilter: ["data-lang"] });

    // Solo suena mientras se ve (y con la pestana visible)
    function alCambiarVista() {
      if (permitido()) reproducir(); else videos[activo].pause();
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        enVista = es[0].isIntersecting;
        alCambiarVista();
      }, { threshold: 0.5 }).observe(lista);
    }
    document.addEventListener("visibilitychange", alCambiarVista);

    colocar();
    aplicarIdioma();
  }

  function arrancar() { document.querySelectorAll(".carrusel").forEach(iniciar); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
