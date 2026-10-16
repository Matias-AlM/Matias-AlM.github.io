// Bento de herramientas: solo una celda abierta a la vez; Escape, clic fuera o la X (el + girado) la cierran.
// Sin JS las celdas siguen siendo <details> y se abren y cierran solas.
(function () {
  var celdas = Array.prototype.slice.call(document.querySelectorAll(".bento-tools details.bc"));
  if (!celdas.length) return;

  function cerrar(celda, enfocar) {
    celda.open = false;
    if (enfocar) celda.querySelector("summary").focus();
  }

  celdas.forEach(function (celda) {
    celda.addEventListener("toggle", function () {
      if (!celda.open) return;
      celdas.forEach(function (otra) { if (otra !== celda && otra.open) cerrar(otra, false); });
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var abierta = celdas.filter(function (c) { return c.open; })[0];
    if (abierta) cerrar(abierta, true);
  });

  document.addEventListener("click", function (e) {
    celdas.forEach(function (c) { if (c.open && !c.contains(e.target)) cerrar(c, false); });
  });
})();
