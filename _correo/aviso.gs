/**
 * Aviso del lanzamiento de SwiftPen, en el Google Form de
 * swiftpen.app@gmail.com (Extensiones > Apps Script, dentro del formulario).
 *
 * - alResponder: cuando alguien deja su email en la web, le manda el correo
 *   de "gracias por tu interes", una sola vez por email.
 * - doGet / doPost: la baja. El enlace de cada correo abre una pagina con un
 *   boton de confirmar (doGet), y la baja la hace el boton (doPost): asi un
 *   filtro de correo que abre los enlaces solo no da de baja a nadie. Al
 *   darse de baja se BORRA su email de la hoja y del formulario; solo queda
 *   una huella (HMAC) para no volver a escribirle.
 * - enviarLanzamiento: el aviso del dia del lanzamiento, a quien no se haya
 *   dado de baja. Se puede volver a lanzar: no repite a quien ya lo recibio.
 * - borrarLista: borra todo una vez enviado el aviso (lo que promete la
 *   politica de privacidad).
 *
 * Puesta en marcha (una vez): ver LEEME.md, al lado de este archivo.
 */

var WEB = "https://getswiftpen.com/";
var PRIVACIDAD = "https://getswiftpen.com/privacidad/";
// El enlace de la ficha de Google Play, para el aviso del lanzamiento.
var PLAY = "https://play.google.com/store/apps/details?id=com.matiasalm.swiftpen";
var REMITENTE = "SwiftPen";
// La URL de la pagina de baja: la de Implementar > Gestionar implementaciones,
// la que termina en /exec. Se pega aqui a mano UNA vez (no cambia al sacar
// versiones nuevas de la misma implementacion).
//
// No se saca con ScriptApp.getService().getUrl(): desde el disparador del
// formulario devuelve la URL de PRUEBAS (/dev), que solo abre el dueno del
// script - a cualquier otro le sale "Sorry, unable to open the file at this
// time" y no puede darse de baja.
var URL_DE_BAJA = "https://script.google.com/macros/s/AKfycbzTGQB0BScWyJu6zDPT3GrXCYrKWVuMSYd-aWp66VLiVfe9n3jlaNRFUnAOGlzmuvzgQg/exec";

var TEXTOS = {
  es: {
    asunto: "Gracias por tu interés en SwiftPen",
    preencabezado: "Te avisaremos en cuanto SwiftPen llegue a Google Play.",
    titulo: "¡Gracias por tu interés!",
    entradilla: "Ya estás en la lista. En cuanto SwiftPen llegue a Google Play, recibirás un único correo con el enlace para descargarlo.",
    mientras: "Lo que te espera, gratis",
    puntos: [["Notas ilimitadas", "sin cuentas ni anuncios"], ["Tu propia nube", "WebDAV o Google Drive"], ["Privado de verdad", "bloqueo con huella y sin rastreo"]],
    boton: "Ver SwiftPen",
    enlace: WEB,
    pregunta: "Si tienes alguna pregunta o algo que te gustaría ver en SwiftPen, responde a este correo: lo leo yo.",
    despedida: "Un saludo,",
    firma: "Matías, desarrollador de SwiftPen",
    pie: "Recibes este correo porque dejaste tu email en la web de SwiftPen. Si no fuiste tú, puedes darte de baja y tu email se borrará.",
    baja: "Darme de baja",
    privacidadTexto: "Política de privacidad",
    privacidad: PRIVACIDAD,
    textoPlano: "¡Gracias por tu interés en SwiftPen! Ya estás en la lista: en cuanto llegue a Google Play recibirás un único correo con el enlace para descargarlo.\n\nDarte de baja: "
  },
  en: {
    asunto: "Thanks for your interest in SwiftPen",
    preencabezado: "We'll let you know as soon as SwiftPen is on Google Play.",
    titulo: "Thanks for your interest!",
    entradilla: "You're on the list. As soon as SwiftPen is on Google Play, you'll get a single email with the link to download it.",
    mientras: "What's waiting for you, free",
    puntos: [["Unlimited notes", "no accounts, no ads"], ["Your own cloud", "WebDAV or Google Drive"], ["Truly private", "fingerprint lock, no tracking"]],
    boton: "See SwiftPen",
    enlace: WEB + "#en",
    pregunta: "If you have a question, or something you'd love to see in SwiftPen, just reply to this email: I read every one.",
    despedida: "Best,",
    firma: "Matías, SwiftPen's developer",
    pie: "You're getting this email because you left your address on the SwiftPen website. If it wasn't you, you can unsubscribe and your email will be deleted.",
    baja: "Unsubscribe",
    privacidadTexto: "Privacy policy",
    privacidad: PRIVACIDAD + "#en",
    textoPlano: "Thanks for your interest in SwiftPen! You're on the list: as soon as it's on Google Play you'll get a single email with the link to download it.\n\nUnsubscribe: "
  }
};

// El aviso del dia del lanzamiento: la misma plantilla con otros textos.
var LANZAMIENTO = {
  es: {
    asunto: "SwiftPen ya está en Google Play",
    preencabezado: "Ya puedes descargarlo, gratis.",
    titulo: "SwiftPen ya está aquí",
    entradilla: "Te apuntaste para enterarte el primer día, y es hoy: SwiftPen ya se puede descargar gratis en Google Play.",
    boton: "Descargar en Google Play",
    enlace: PLAY,
    pie: "Este es el aviso que pediste en la web de SwiftPen. No recibirás más correos: la lista se borra después de este envío.",
    textoPlano: "SwiftPen ya está en Google Play: " + PLAY + "\n\nDarte de baja: "
  },
  en: {
    asunto: "SwiftPen is now on Google Play",
    preencabezado: "You can download it now, for free.",
    titulo: "SwiftPen is here",
    entradilla: "You signed up to hear on day one, and that's today: SwiftPen is now free to download on Google Play.",
    boton: "Get it on Google Play",
    enlace: PLAY,
    pie: "This is the notice you asked for on the SwiftPen website. You won't get any more emails: the list is deleted after this one.",
    textoPlano: "SwiftPen is now on Google Play: " + PLAY + "\n\nUnsubscribe: "
  }
};

// --- Al responder: el correo de gracias -------------------------------------

function alResponder(e) {
  var datos = leerRespuesta(e.response);
  if (!datos) return;
  var props = PropertiesService.getScriptProperties();
  var huella = firma(datos.email);
  if (props.getProperty("baja:" + huella)) {
    // Se dio de baja antes: ni correo ni dato guardado.
    e.source.deleteResponse(e.response.getId());
    borrarDeLaHoja(datos.email);
    return;
  }
  if (props.getProperty("gracias:" + huella)) return; // ya se le escribio
  if (MailApp.getRemainingDailyQuota() < 1) return; // sin cupo hoy: sin correo, pero apuntado
  enviar(datos.email, datos.idioma, TEXTOS[datos.idioma]);
  props.setProperty("gracias:" + huella, new Date().toISOString());
}

// --- La baja -------------------------------------------------------------------

/** Dos cosas:
 * - accion=baja: la pide el boton de la pagina de baja de la WEB
 *   (swiftpen/baja/), sin cookies de Google, y contesta en JSON. Es el camino
 *   de los correos nuevos: una pagina del script no abre con varias cuentas
 *   de Google en el navegador ("la app no esta disponible"), y una peticion
 *   sin cookies llega como anonima, que funciona siempre.
 * - sin accion: la pagina con el boton de confirmar, la de los enlaces de los
 *   correos que ya salieron. No da de baja por si sola (ver la cabecera). */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var idioma = p.l === "en" ? "en" : "es";
  var email = normalizar(p.e);
  var valido = !!(email && p.f && p.f === firma(email));
  if (p.accion === "baja") {
    if (valido) darDeBaja(email);
    return ContentService.createTextOutput(JSON.stringify({ ok: valido }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return pagina(idioma, valido ? "confirmar" : "invalido", p);
}

/** El boton de confirmar. */
function doPost(e) {
  var p = (e && e.parameter) || {};
  var idioma = p.l === "en" ? "en" : "es";
  var email = normalizar(p.e);
  if (!(email && p.f && p.f === firma(email))) return pagina(idioma, "invalido", p);
  darDeBaja(email);
  return pagina(idioma, "hecho", p);
}

function darDeBaja(email) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    PropertiesService.getScriptProperties().setProperty("baja:" + firma(email), new Date().toISOString());
    var form = FormApp.getActiveForm();
    form.getResponses().forEach(function (r) {
      var d = leerRespuesta(r);
      if (d && d.email === email) form.deleteResponse(r.getId());
    });
    borrarDeLaHoja(email);
  } finally {
    lock.releaseLock();
  }
}

var PAGINAS = {
  es: {
    confirmar: ["¿Darte de baja?", "Se borrará tu email de la lista de SwiftPen y no recibirás más correos.", "Confirmar baja"],
    hecho: ["Te has dado de baja", "Tu email se ha borrado de la lista de SwiftPen. No recibirás más correos."],
    invalido: ["Enlace no válido", "Este enlace de baja no es válido. Escribe a swiftpen.app@gmail.com y te damos de baja a mano."]
  },
  en: {
    confirmar: ["Unsubscribe?", "Your email will be removed from the SwiftPen list, and you won't get any more emails.", "Confirm"],
    hecho: ["You're unsubscribed", "Your email has been removed from the SwiftPen list. You won't get any more emails."],
    invalido: ["Invalid link", "This unsubscribe link isn't valid. Write to swiftpen.app@gmail.com and we'll remove you by hand."]
  }
};

function escapar(s) {
  return String(s || "").replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
}

function pagina(idioma, estado, p) {
  var t = PAGINAS[idioma][estado];
  var boton = estado !== "confirmar" ? "" :
    '<form method="post" action="' + urlDeBaja() + '" target="_top" style="margin:22px 0 0">' +
    '<input type="hidden" name="e" value="' + escapar(p.e) + '"><input type="hidden" name="f" value="' + escapar(p.f) + '">' +
    '<input type="hidden" name="l" value="' + idioma + '">' +
    '<button type="submit" style="font:700 15px/1 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#fff;border:0;border-radius:12px;padding:13px 22px;cursor:pointer;background:#6d57dc;background-image:linear-gradient(90deg,#3d6fe0,#a33fd4)">' + t[2] + '</button></form>';
  var html =
    '<!doctype html><html lang="' + idioma + '"><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;background:#f2f2f8;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#16162a">' +
    '<div style="max-width:480px;margin:64px auto;padding:0 16px;text-align:center">' +
    '<img src="https://getswiftpen.com/img/correo/wordmark.png?v=2" width="150" alt="SwiftPen" style="width:150px;height:auto;margin-bottom:28px">' +
    '<div style="background:#fff;border:1px solid #e6e6ef;border-radius:20px;padding:32px 28px">' +
    '<h1 style="margin:0 0 10px;font-size:24px">' + t[0] + '</h1>' +
    '<p style="margin:0;font-size:16px;line-height:1.6;color:#4b4e60">' + t[1] + '</p>' + boton +
    '</div>' +
    '<p style="margin-top:20px"><a href="' + WEB + (idioma === "en" ? "#en" : "") + '" target="_top" style="color:#7a3fe0">getswiftpen.com</a></p>' +
    '</div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(t[0] + " · SwiftPen")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

// --- El dia del lanzamiento --------------------------------------------------

/** Lanzar a mano el dia del lanzamiento (con PLAY ya apuntando a la ficha).
 * Si se acaba el cupo diario de Gmail (~100), se para: volver a lanzarlo al
 * dia siguiente sigue por donde iba. */
function enviarLanzamiento() {
  var props = PropertiesService.getScriptProperties();
  var vistos = {};
  var enviados = 0;
  FormApp.getActiveForm().getResponses().forEach(function (r) {
    var d = leerRespuesta(r);
    if (!d || vistos[d.email]) return;
    vistos[d.email] = true;
    var huella = firma(d.email);
    if (props.getProperty("baja:" + huella) || props.getProperty("lanzamiento:" + huella)) return;
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error("Sin cupo de Gmail hoy: vuelve a lanzarlo mañana.");
    var t = Object.assign({}, TEXTOS[d.idioma], LANZAMIENTO[d.idioma]);
    enviar(d.email, d.idioma, t);
    props.setProperty("lanzamiento:" + huella, new Date().toISOString());
    enviados++;
  });
  Logger.log("Avisos enviados: " + enviados);
}

/** Despues del lanzamiento: borra las respuestas, la hoja y el estado. */
function borrarLista() {
  var form = FormApp.getActiveForm();
  form.deleteAllResponses();
  var hoja = hojaDeRespuestas();
  if (hoja && hoja.getLastRow() > 1) hoja.deleteRows(2, hoja.getLastRow() - 1);
  var props = PropertiesService.getScriptProperties();
  var secreto = props.getProperty("secreto");
  props.deleteAllProperties();
  if (secreto) props.setProperty("secreto", secreto);
  Logger.log("Lista borrada.");
}

// --- Piezas ------------------------------------------------------------------

function enviar(email, idioma, t) {
  var plantilla = HtmlService.createTemplateFromFile("gracias");
  plantilla.t = t;
  plantilla.idioma = idioma;
  plantilla.enlaceBaja = enlaceBaja(email, idioma);
  GmailApp.sendEmail(email, t.asunto, (t.textoPlano || t.entradilla + "\n\n") + plantilla.enlaceBaja, {
    htmlBody: plantilla.evaluate().getContent(),
    name: REMITENTE
  });
}

/** Email e idioma de una respuesta: las preguntas se buscan por su titulo. */
function leerRespuesta(respuesta) {
  var email = "", idioma = "es";
  respuesta.getItemResponses().forEach(function (ir) {
    var titulo = ir.getItem().getTitle().toLowerCase();
    var valor = String(ir.getResponse() || "");
    if (titulo.indexOf("mail") >= 0) email = valor;
    else if (titulo.indexOf("idioma") >= 0 || titulo.indexOf("language") >= 0) idioma = valor === "en" ? "en" : "es";
  });
  email = normalizar(email);
  return email ? { email: email, idioma: idioma } : null;
}

function normalizar(email) {
  email = String(email || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

/** HMAC del email con un secreto que solo tiene el script: firma el enlace
 * de baja (nadie puede dar de baja a otro) y es la huella que se guarda en
 * lugar del email. */
function firma(email) {
  var props = PropertiesService.getScriptProperties();
  var secreto = props.getProperty("secreto");
  if (!secreto) {
    secreto = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("secreto", secreto);
  }
  var bytes = Utilities.computeHmacSha256Signature(email, secreto);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, "").slice(0, 24);
}

/** La pagina de baja de la web, que llama al script (ver doGet). urlDeBaja()
 * se comprueba igual: sin el script implementado, esa pagina no puede dar de
 * baja a nadie. */
function enlaceBaja(email, idioma) {
  urlDeBaja();
  return WEB + "baja/?e=" + encodeURIComponent(email) + "&f=" + firma(email) + "&l=" + idioma + "#" + idioma;
}

/** URL_DE_BAJA, comprobada. Sin una baja que funcione no sale ningun correo:
 * es obligatoria (LSSI art. 21, RGPD art. 21), y un correo sin ella es peor
 * que no mandarlo. El error se ve en Ejecuciones. */
function urlDeBaja() {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^\/]+\/exec$/.test(URL_DE_BAJA)) {
    throw new Error("Falta URL_DE_BAJA (la URL /exec de la implementacion de aplicacion web): ver LEEME.md, paso 6.");
  }
  return URL_DE_BAJA;
}

function hojaDeRespuestas() {
  var form = FormApp.getActiveForm();
  try {
    return SpreadsheetApp.openById(form.getDestinationId()).getSheets()[0];
  } catch (err) {
    return null; // el formulario no tiene hoja vinculada
  }
}

function borrarDeLaHoja(email) {
  var hoja = hojaDeRespuestas();
  if (!hoja || hoja.getLastRow() < 2) return;
  var valores = hoja.getDataRange().getValues();
  var col = valores[0].map(function (c) { return String(c).toLowerCase(); }).findIndex(function (c) { return c.indexOf("mail") >= 0; });
  if (col < 0) return;
  for (var fila = valores.length - 1; fila >= 1; fila--) {
    if (normalizar(valores[fila][col]) === email) hoja.deleteRow(fila + 1);
  }
}

/** Ejecutar UNA vez a mano: crea el disparador de "al enviar el formulario". */
function instalar() {
  var form = FormApp.getActiveForm();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "alResponder") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("alResponder").forForm(form).onFormSubmit().create();
  firma("prueba@prueba.com"); // crea el secreto
  Logger.log("Instalado. Falta implementar como aplicación web (ver LEEME.md).");
}
