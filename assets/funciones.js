// Pestanas de /funciones/: un boton por grupo y un panel (bento) por grupo.
//
// Sin JS se ven todos los paneles seguidos y la fila de pestanas no aparece (CSS).
// Con JS se ve un panel: el del #<grupo> de la direccion (por ejemplo
// /funciones/#lazo, para enlazar desde la portada) o el primero. Al cambiar de
// pestana se actualiza el # sin anadir pasos al historial. Teclado del patron
// "tabs" de WAI-ARIA: flechas, Inicio y Fin; activacion al mover el foco.
(function () {
  var lista = document.querySelector(".fn-pestanas");
  if (!lista) return;
  var pestanas = Array.prototype.slice.call(lista.querySelectorAll(".fn-pestana"));
  var paneles = pestanas.map(function (p) { return document.getElementById(p.dataset.panel); });
  var barra = document.querySelector(".fn-pestanas-barra");
  var TECLAS = { ArrowRight: 1, ArrowLeft: -1 };

  lista.setAttribute("role", "tablist");
  pestanas.forEach(function (p, i) {
    p.setAttribute("role", "tab");
    p.setAttribute("aria-controls", paneles[i].id);
    paneles[i].setAttribute("role", "tabpanel");
    paneles[i].setAttribute("aria-labelledby", p.id);
    paneles[i].tabIndex = 0;
  });

  function mostrar(i, conFoco) {
    pestanas.forEach(function (p, j) {
      var activa = i === j;
      p.setAttribute("aria-selected", String(activa));
      p.tabIndex = activa ? 0 : -1;
      paneles[j].hidden = !activa;
    });
    // La pestana activa, visible dentro de la fila (en movil se desplaza en horizontal).
    var fila = lista.getBoundingClientRect(), r = pestanas[i].getBoundingClientRect();
    if (r.left < fila.left || r.right > fila.right) lista.scrollLeft += r.left - fila.left - (fila.width - r.width) / 2;
    if (conFoco) pestanas[i].focus();
  }

  function elegir(i, conFoco) {
    mostrar(i, conFoco);
    history.replaceState(null, "", "#" + paneles[i].id);
  }

  function desdeEnlace() {
    var id = location.hash.slice(1);
    for (var i = 0; i < paneles.length; i++) if (paneles[i].id === id) return i;
    return -1;
  }

  pestanas.forEach(function (p, i) {
    p.addEventListener("click", function () {
      elegir(i, false);
      // Si la fila ya esta pegada arriba, lleva el panel nuevo a su sitio bajo ella.
      if (barra.getBoundingClientRect().top <= 64 && paneles[i].getBoundingClientRect().top < 0) {
        paneles[i].scrollIntoView({ block: "start" });
      }
    });
  });

  lista.addEventListener("keydown", function (evento) {
    var i = pestanas.indexOf(document.activeElement);
    var tecla = evento["key"], n = pestanas.length, destino = null;
    if (i < 0) return;
    if (TECLAS[tecla]) destino = (i + TECLAS[tecla] + n) % n;
    else if (tecla === "Home") destino = 0;
    else if (tecla === "End") destino = n - 1;
    if (destino === null) return;
    evento.preventDefault();
    elegir(destino, true);
  });

  window.addEventListener("hashchange", function () {
    var i = desdeEnlace();
    if (i >= 0) mostrar(i, false);
  });

  mostrar(Math.max(desdeEnlace(), 0), false);
})();
