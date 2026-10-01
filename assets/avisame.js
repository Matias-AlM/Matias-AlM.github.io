// "Avisame cuando salga": el email va a un Google Form de
// swiftpen.app@gmail.com, sin salir de la pagina.
//
// Google Forms acepta un POST a su /formResponse con un campo por pregunta
// (entry.<id>). Desde otro dominio la respuesta es opaca (no-cors): no se
// puede leer si fue bien, asi que se da por enviado si la peticion no falla.
//
// Los ids salen del enlace "Obtener enlace prellenado" del formulario.
(function () {
  var FORMULARIO = "https://docs.google.com/forms/d/e/ID_DEL_FORMULARIO/formResponse";
  var CAMPO_EMAIL = "entry.EMAIL";
  var CAMPO_CONSENTIMIENTO = "entry.CONSENTIMIENTO";
  var CAMPO_IDIOMA = "entry.IDIOMA";
  // El texto exacto de la opcion de la casilla en el formulario.
  var OPCION_CONSENTIMIENTO = "Sí";

  var TEXTOS = {
    es: { email: "Escribe un email válido.", consentimiento: "Marca la casilla para poder avisarte.", enviando: "Enviando…", listo: "¡Listo! Te escribiré el día que salga.", error: "No se pudo enviar. Prueba otra vez en un rato." },
    en: { email: "Please enter a valid email.", consentimiento: "Tick the box so I can let you know.", enviando: "Sending…", listo: "You're in! I'll email you on launch day.", error: "Couldn't send it. Please try again in a bit." }
  };

  document.querySelectorAll("form.avisame").forEach(function (form) {
    var t = TEXTOS[form.dataset.idioma] || TEXTOS.es;
    var estado = form.querySelector(".avisame-estado");
    var boton = form.querySelector("button");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = form.email.value.trim();
      if (!form.email.checkValidity() || !email) { estado.textContent = t.email; form.email.focus(); return; }
      if (!form.consentimiento.checked) { estado.textContent = t.consentimiento; form.consentimiento.focus(); return; }
      var datos = new FormData();
      datos.append(CAMPO_EMAIL, email);
      datos.append(CAMPO_CONSENTIMIENTO, OPCION_CONSENTIMIENTO);
      datos.append(CAMPO_IDIOMA, form.dataset.idioma);
      boton.disabled = true;
      estado.textContent = t.enviando;
      fetch(FORMULARIO, { method: "POST", mode: "no-cors", body: datos })
        .then(function () { form.classList.add("enviado"); estado.textContent = t.listo; form.reset(); })
        .catch(function () { estado.textContent = t.error; })
        .then(function () { boton.disabled = false; });
    });
  });
})();
