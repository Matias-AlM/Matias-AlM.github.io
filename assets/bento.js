// Bento de herramientas: el detalle de cada celda es un <dialog> modal (showModal): Escape, clic fuera y la X lo
// cierran, el foco vuelve a la celda y el vídeo se pausa. La rejilla no cambia nunca.
(function () {
  var raiz = document.documentElement;
  var CERRAR = { es: "Cerrar", en: "Close", fr: "Fermer" };
  function idioma() { return raiz.dataset.lang || "es"; }

  function poner(video) {
    var clip = video.dataset.clip;
    video.poster = "/video/" + idioma() + "/" + clip + ".webp";
    var origen = "/video/" + idioma() + "/" + clip + ".mp4";
    if (video.getAttribute("src") !== origen) video.src = origen;
  }

  document.addEventListener("click", function (e) {
    var abre = e.target.closest("[data-abre]");
    if (abre) {
      var dialogo = document.getElementById(abre.dataset.abre);
      dialogo.querySelector(".bc-cerrar").setAttribute("aria-label", CERRAR[idioma()]);
      var video = dialogo.querySelector("video");
      if (video) poner(video);
      dialogo.showModal();
      return;
    }
    var cerrar = e.target.closest(".bc-cerrar");
    if (cerrar) cerrar.closest("dialog").close();
  });

  Array.prototype.forEach.call(document.querySelectorAll("dialog.bc-dialogo"), function (dialogo) {
    // Clic en el fondo (fuera de la tarjeta)
    dialogo.addEventListener("click", function (e) { if (e.target === dialogo) dialogo.close(); });
    dialogo.addEventListener("close", function () {
      var video = dialogo.querySelector("video");
      if (video) video.pause();
    });
  });

  // Pestañas: la activa se centra en la fila con scroll horizontal (móvil)
  Array.prototype.forEach.call(document.querySelectorAll(".bento-tabs .tab"), function (tab) {
    tab.addEventListener("click", function () { tab.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); });
  });
})();
