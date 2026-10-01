# Correo de "gracias" y baja del aviso del lanzamiento

Esta carpeta no se publica en la web (Jekyll ignora las carpetas que
empiezan por `_`). Aquí están el script y la plantilla que van **dentro del
Google Form** de swiftpen.app@gmail.com.

- `aviso.gs`: manda el correo de gracias al apuntarse, la página de baja, el
  aviso del lanzamiento y el borrado de la lista.
- `gracias.html`: la plantilla del correo (también la del lanzamiento).
  Los logos se cargan de `swiftpen/img/correo/` de la web, en PNG.

## Puesta en marcha (una vez)

1. En el formulario: **⋮ → Apps Script**.
2. Pega `aviso.gs` en `Code.gs` (sustituye lo que haya).
3. **+ → HTML**, llámalo `gracias` (sin `.html`) y pega `gracias.html`.
4. Guarda. Arriba, elige la función **`instalar`** y pulsa **Ejecutar**.
   Google pide permisos (formulario, hojas de cálculo, enviar correo como tú):
   acéptalos. Si avisa de "app no verificada": *Configuración avanzada → Ir a
   ... (no seguro)*; es tu propio script.
5. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo** (swiftpen.app@gmail.com)
   - Quién tiene acceso: **Cualquier usuario**
   - Implementar. Esa URL es la del enlace de baja; el script la saca solo.
6. Prueba: apúntate en la web con un email tuyo. Debe llegar el correo de
   gracias; su "Darme de baja" abre la página de confirmar, y al confirmar tu
   fila desaparece de la hoja.

Si cambias `aviso.gs` después, vuelve a **Implementar → Gestionar
implementaciones → editar → Nueva versión**: la página de baja usa la versión
implementada, no la guardada.

## El día del lanzamiento

1. Comprueba que `PLAY` en `aviso.gs` apunta a la ficha de Google Play.
2. Ejecuta **`enviarLanzamiento`**. Gmail deja unos 100 correos al día desde
   un script: si se acaba, se para con un aviso; mañana se vuelve a ejecutar y
   sigue por donde iba (no repite a nadie).
3. Cuando hayan salido todos, ejecuta **`borrarLista`**. La política de
   privacidad promete que la lista se borra después del aviso.
