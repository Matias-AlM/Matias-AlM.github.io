# Vídeos de ayuda de SwiftPen

Un vídeo por opción y por idioma: `video/{es,en,fr}/<clip>.mp4` con su póster `<clip>.webp`
(fotograma al 40 % del vídeo). MP4 H.264, 30 fps, sin audio, `+faststart`.

Se generan con `scripts/videos.sh` a partir de `~/swiftpen/app/src/main/res/raw*/tutorial_*.mp4`
(`SWIFTPEN_RES` para otra ruta). Por idioma usa `raw-<idioma>/` si existe y, si no, `raw/` (es).

**Estado:** los clips originales solo existen en español, así que `en/` y `fr/` son **copia
provisional de `es/`** (idénticos byte a byte). Muestran texto de interfaz en español
(«Alcance del borrado», «Seleccionar», «Nueva grabación»…) y letra manuscrita en español. Para
regrabarlos, la app (`~/swiftpen-capturas/inyeccion/tutoriales.py <en|fr>`) deja los clips en
`res/raw-en` y `res/raw-fr`; después basta con volver a ejecutar `scripts/videos.sh`.

## Vídeo del hero (`hero.mp4`)

`video/{es,en,fr}/hero.mp4` + `hero.webp` (primer fotograma, es el póster del hero) en `sitio/nuevo/`: zoom con dos
dedos, escribir a mano, subrayar, borrar y zoom de vuelta. Está grabado en la tablet real con gestos táctiles
inyectados (no es una animación). 1766×1080, 60 fps, sin audio, H.264 crf 24, `+faststart`, ≈1,5 MB. Se reproduce
en bucle (`interaccion.js`, `.video-caja[data-video="hero"]`) y con `prefers-reduced-motion` se queda el póster.
- `es/` usa la nota en español; `en/` la nota en inglés; **`fr/` es copia provisional de `en/`** (la nota está en inglés).
- **Bucle sin salto:** el vídeo empieza donde empieza el zoom y los últimos 1,0 s son un fundido (curva suave) hacia la
  escena inicial, con la hoja del final alineada con la del principio (solo por debajo de las barras de herramientas).
  Así el último frame coincide con el primero aunque la grabación acabara ±1 % de zoom y unos px desplazada.
  Script: `bucle_sin_salto.py entrada.mp4 salida.mp4` (informe `video-web-zoom`, opencv + ffmpeg).
- **Claro y oscuro (`hero.mp4` / `hero-oscuro.mp4`, con sus `.webp`):** la misma grabación con la **interfaz de la app actual** (barra, deshacer/rehacer e
  indicador de zoom reales, capturados en un emulador con el mismo tamaño lógico que la tablet) puesta en postproducción; la hoja no cambia. Las dos
  variantes salen del mismo proceso y la misma línea de tiempo: **la barra es la misma en cada frame (mismos colores, misma herramienta y misma
  selección) y solo cambia el modo**. Cada idioma tiene su pareja (es con es, en con en; fr usa el inglés en las dos). Se elige con
  `prefers-color-scheme` (`data-video-oscuro` en el `.video-caja`, `interaccion.js`). Script: `oscuro.py` (informe `video-web-oscuro`).
- Origen: informes `video-web-zoom` y `video-web-zoom-en` (grabación sin barras del sistema), pasados por `bucle_sin_salto.py`
  (crf 24, 60 fps, `+faststart`).

## Dimensiones

| Clip | Ancho×alto | Duración | MP4 (KB) |
|---|---|---|---|
| `forma_perfecta` | 960×558 | 9,0 s | 39 |
| `garabatear` | 874×644 (original, sin ampliar) | 5,3 s | 36 |
| `linea_recta` | 960×402 | 4,6 s | 28 |
| `objeto_completo` | 960×554 | 5,6 s | 37 |
| `alcance_goma` | 960×402 | 6,2 s | 61 |
| `lazo_seleccionar` | 960×412 | 12,7 s | 88 |
| `audio` | 800×794 | 17,0 s | 149 |

Total por idioma: ≈0,43 MB de MP4 (+ ≈0,08 MB de pósters WebP). El póster tiene el mismo tamaño que el vídeo.

## Textos (de `ui/Tutoriales.kt` → `strings.xml` de la app)

**forma_perfecta**
- es: Al terminar un trazo, deja el lápiz quieto un momento y se convierte en una forma perfecta.
- en: When you finish a stroke, hold the pen still for a moment and it turns into a perfect shape.
- fr: À la fin d'un trait, gardez le stylet immobile un instant et il devient une forme parfaite.

**garabatear**
- es: Garabatea encima de lo escrito para borrarlo. Si te equivocas, deshacer lo devuelve.
- en: Scribble over your writing to erase it. If you change your mind, undo brings it back.
- fr: Gribouillez sur ce que vous avez écrit pour l'effacer. En cas d'erreur, annuler le fait revenir.

**linea_recta**
- es: Manteniendo: deja el lápiz quieto al final y el trazo se endereza. Siempre: sale recto directamente.
- en: Holding: pause at the end of the stroke and it straightens out. Always: it comes out straight right away.
- fr: En maintenant : gardez le stylet immobile à la fin et le trait se redresse. Toujours : il sort droit directement.

**objeto_completo**
- es: Basta con rozar un trazo para borrarlo entero. Desactivado, borra solo por donde pasas.
- en: Just brush a stroke to erase the whole thing. Turn it off to erase only where you go over.
- fr: Il suffit d'effleurer un trait pour l'effacer en entier. Désactivé, la gomme n'efface que là où elle passe.

**alcance_goma**
- es: Elige qué borra la goma. Con solo el resaltador, quitas el resaltado sin tocar lo escrito.
- en: Choose what the eraser removes. With only the highlighter, you can clear highlights without touching your writing.
- fr: Choisissez ce que la gomme efface. Avec seulement le surligneur, vous retirez le surlignage sans toucher à l'écriture.

**lazo_seleccionar**
- es: Elige qué agarra el lazo. Así mueves un dibujo sin llevarte el texto de al lado.
- en: Choose what the lasso picks up, so you can move a drawing without dragging along the text next to it.
- fr: Choisissez ce que le lasso attrape : vous déplacez un dessin sans emporter le texte d'à côté.

**audio**
- es: Graba mientras escribes. Al escucharlo, tu letra se vuelve a escribir al ritmo del audio; toca una palabra para saltar a ese momento.
- en: Record while you write. On playback, your writing redraws in sync with the audio; tap a word to jump to that moment.
- fr: Enregistrez pendant que vous écrivez. À l'écoute, votre écriture se redessine au rythme de l'audio ; touchez un mot pour aller à ce moment-là.
