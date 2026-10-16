// Carrusel de videos de ayuda: el del centro suena y se ve entero; los vecinos, mas pequenos y
// translucidos. Al acabar el central pasa solo al siguiente. Se mueve con flechas, puntos,
// pulsando un vecino o deslizando. Con movimiento reducido nada arranca ni avanza solo y el
// boton de pausa/play sigue visible. Sin JS el HTML queda apilado (ver carrusel-videos.css).
// Varios por pagina (uno por panel de pestanas): cada .carrusel lleva su estado. Un item puede ser
// una imagen en vez de un video; con un solo item no hay vecinos ni flechas (y el video se repite).
// Con dos items se anaden dos clones solo visuales (alias del otro clip: mismo poster, aria-hidden,
// sin video) para que siempre se vean tres; pulsar un clon enfoca el clip real.
// Cargar despues de idioma.js; no depende de interaccion.js (que oculta los paneles inactivos).
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
    var activo = 0; // clip real enfocado
    // Anillo de posiciones: los items reales y, con dos clips, dos clones (anillo de 4: A B A' B')
    var anillo = items.slice();
    var real = items.map(function (_, i) { return i; });
    var imagenesClon = [];
    var av = 0; // posicion del anillo enfocada
    var pausadoPorUsuario = false;
    var enVista = false;

    // Sin controles nativos ni <source>: el JS pone src segun el idioma.
    videos.forEach(function (v) {
      if (!v) return;
      v.removeAttribute("controls");
      Array.prototype.forEach.call(v.querySelectorAll("source"), function (s) { s.remove(); });
      v.loop = total === 1;
      v.muted = true;
    });
    textos.forEach(function (p) { descripcion.appendChild(p); });
    lista.parentNode.insertBefore(descripcion, lista.nextSibling);

    if (total === 2) {
      items.forEach(function (_, i) {
        var clon = crear("li", "cv-item cv-clon", '<figure class="cv-video"><img alt="" decoding="async"></figure>');
        var img = clon.querySelector("img");
        img.setAttribute("width", videos[i].getAttribute("width"));
        img.setAttribute("height", videos[i].getAttribute("height"));
        clon.setAttribute("aria-hidden", "true");
        lista.appendChild(clon);
        anillo.push(clon);
        real.push(i);
        imagenesClon.push(img);
      });
    }
    var n = anillo.length;

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
    if (total === 1) controles.classList.add("cv-solo");

    function ruta(clip, ext) { return "/video/" + idioma() + "/" + clip + "." + ext; }

    function pintarPausa() {
      var v = videos[activo];
      pausa.hidden = !v;
      if (!v) return;
      var estado = v.paused ? "play" : "pausa";
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
      if (!v) return;
      var origen = ruta(v.dataset.clip, "mp4");
      if (v.getAttribute("src") !== origen) v.src = origen;
      // Si el navegador la rechaza (ahorro de datos...) el boton sigue mostrando play.
      var p = v.play();
      if (p) p.catch(function () {});
    }
    // Vuelve al poster y deja de tener el video cargado
    function soltar(i) {
      var v = videos[i];
      if (!v) return;
      v.pause();
      if (v.getAttribute("src")) { v.removeAttribute("src"); v.load(); }
    }

    function colocar() {
      var mitad = Math.floor(n / 2);
      anillo.forEach(function (it, k) {
        var o = ((k - av + n + mitad) % n) - mitad;
        // El unico opuesto (anillo par) se esconde: asi el salto de un lado al otro no se ve
        var d = (n % 2 === 0 && Math.abs(o) === mitad) ? 3 : Math.min(Math.abs(o), 3);
        it.style.setProperty("--o", o);
        it.style.setProperty("--s", ESCALA[d]);
        it.style.setProperty("--op", OPACIDAD[d]);
        it.style.setProperty("--z", 10 - d);
        it.dataset.d = d;
        if (k < total) it.setAttribute("aria-hidden", d === 0 ? "false" : "true");
      });
      items.forEach(function (_, i) {
        textos[i].classList.toggle("cv-actual", i === activo);
        botonesPunto[i].setAttribute("aria-current", String(i === activo));
      });
    }

    function moverA(k) {
      k = (k + n) % n;
      if (k === av) return;
      soltar(activo);
      av = k;
      activo = real[av];
      colocar();
      if (permitido()) reproducir();
      pintarPausa();
    }
    function mover(d) { moverA(av + d); }
    // Va al clip real i por el camino hacia delante
    function ir(i) {
      for (var s = 0; s < n; s++) {
        var k = (av + s) % n;
        if (real[k] === i && i !== activo) { moverA(k); return; }
      }
    }

    anterior.addEventListener("click", function () { mover(-1); });
    siguiente.addEventListener("click", function () { mover(1); });
    pausa.addEventListener("click", function () {
      var v = videos[activo];
      if (!v) return;
      if (v.paused) { pausadoPorUsuario = false; reproducir(); }
      else { pausadoPorUsuario = true; v.pause(); }
    });
    carrusel.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowLeft") { ev.preventDefault(); mover(-1); }
      else if (ev.key === "ArrowRight") { ev.preventDefault(); mover(1); }
    });

    videos.forEach(function (v, i) {
      if (!v) return;
      v.addEventListener("play", function () { if (i === activo) pintarPausa(); });
      v.addEventListener("pause", function () { if (i === activo) pintarPausa(); });
      v.addEventListener("ended", function () {
        if (i !== activo) return;
        if (sinMovimiento.matches) pintarPausa(); else mover(1);
      });
    });

    // Pulsar un vecino o deslizar (un arrastre no cuenta como pulsacion)
    var inicioX = null, arrastro = false;
    lista.addEventListener("pointerdown", function (ev) { inicioX = ev.clientX; arrastro = false; });
    lista.addEventListener("pointerup", function (ev) {
      if (inicioX === null) return;
      var dx = ev.clientX - inicioX;
      inicioX = null;
      if (Math.abs(dx) > 40) { arrastro = true; mover(dx < 0 ? 1 : -1); }
    });
    lista.addEventListener("pointercancel", function () { inicioX = null; });
    anillo.forEach(function (it, k) {
      it.addEventListener("click", function () { if (!arrastro) moverA(k); arrastro = false; });
    });

    // Idioma: poster y video de la carpeta del idioma activo (conserva el instante y el estado)
    function aplicarIdioma() {
      videos.forEach(function (v, i) {
        if (!v) return;
        v.poster = ruta(v.dataset.clip, "webp");
        if (i === activo && v.getAttribute("src")) {
          var t = v.currentTime, sonaba = !v.paused;
          v.src = ruta(v.dataset.clip, "mp4");
          v.currentTime = t;
          if (sonaba) reproducir();
        }
      });
      imagenesClon.forEach(function (img, i) { img.src = ruta(videos[i].dataset.clip, "webp"); });
      pintarEtiquetas();
    }
    new MutationObserver(aplicarIdioma).observe(raiz, { attributes: true, attributeFilter: ["data-lang"] });

    // Solo suena mientras se ve (y con la pestana visible)
    function alCambiarVista() {
      if (permitido()) reproducir(); else if (videos[activo]) videos[activo].pause();
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
