// "Avisame cuando salga": el email va a un Google Form de
// swiftpen.app@gmail.com, sin salir de la pagina.
//
// Google Forms acepta un POST a su /formResponse con un campo por pregunta
// (entry.<id>). Desde otro dominio la respuesta es opaca (no-cors): no se
// puede leer si fue bien, asi que se da por enviado si la peticion no falla.
//
// Los ids salen del enlace "Obtener enlace prellenado" del formulario.
(function () {
  var FORMULARIO = "https://docs.google.com/forms/d/e/1FAIpQLScY50qomnr8aoQ618ezqdxORCDCwen7VHNfES7s8PzQaAVCKg/formResponse";
  var CAMPO_EMAIL = "entry.1210126568";
  var CAMPO_CONSENTIMIENTO = "entry.575628627";
  var CAMPO_IDIOMA = "entry.2063081660";
  // El texto exacto de la opcion de la casilla en el formulario.
  var OPCION_CONSENTIMIENTO = "Sí";

  var TEXTOS = {
    es: { email: "Introduce un email válido.", consentimiento: "Es necesario aceptar para recibir el aviso.", enviando: "Enviando…", listo: "¡Gracias! Serás de los primeros en saber cuándo sale SwiftPen.", nota: "Te hemos enviado un correo de confirmación. Si no lo ves, mira en la carpeta de spam y márcalo como «No es spam» para no perderte el aviso del lanzamiento.", error: "No se ha podido enviar. Inténtalo de nuevo más tarde." },
    en: { email: "Please enter a valid email address.", consentimiento: "Please accept to receive the notice.", enviando: "Sending…", listo: "Thanks! You'll be among the first to know when SwiftPen launches.", nota: "We've sent you a confirmation email. If you can't find it, check your spam folder and mark it as \"Not spam\" so you don't miss the launch notice.", error: "Something went wrong. Please try again later." }
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
        .then(function () {
          form.classList.add("enviado");
          // Dos lineas: el gracias y, mas discreto, que mire el spam.
          estado.textContent = t.listo;
          var nota = document.createElement("span");
          nota.className = "avisame-nota";
          nota.textContent = t.nota;
          estado.appendChild(nota);
          form.reset();
        })
        .catch(function () { estado.textContent = t.error; })
        .then(function () { boton.disabled = false; });
    });
  });
})();
