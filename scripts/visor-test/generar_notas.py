#!/usr/bin/env python3
"""Genera una carpeta SwiftPen SINTETICA (mismo formato que el sync) para probar /visor/.

Uso: python3 scripts/visor-test/generar_notas.py <carpeta destino>
Nunca lee notas reales: todo sale de formulas (espirales, ondas) y de texto inventado.
"""
import json, math, pathlib, random, sys, uuid

DPI = 320
NEGRO, ROJO, AZUL, VERDE = -16777216, 0xFFD32F2F - (1 << 32), 0xFF1976D2 - (1 << 32), 0xFF2E7D32 - (1 << 32)
AMARILLO_TRANSLUCIDO = 0x66FFEB3B - (1 << 32)


def segs(puntos, grosor=4.0, color=NEGRO, **extra):
    """Un trazo: lista de segmentos consecutivos entre los puntos."""
    return [dict(x1=a[0], y1=a[1], x2=b[0], y2=b[1], halfWidth=grosor, color=color, **extra)
            for a, b in zip(puntos, puntos[1:])]


def espiral(cx, cy, r0, r1, vueltas, n=240):
    return [(cx + (r0 + (r1 - r0) * i / n) * math.cos(vueltas * 2 * math.pi * i / n),
             cy + (r0 + (r1 - r0) * i / n) * math.sin(vueltas * 2 * math.pi * i / n)) for i in range(n + 1)]


def onda(x0, y0, largo, amp, ciclos, n=200):
    return [(x0 + largo * i / n, y0 + amp * math.sin(ciclos * 2 * math.pi * i / n)) for i in range(n + 1)]


def nota(id, titulo, trazos, **campos):
    base = dict(id=id, title=titulo, strokes=trazos, eraseMarks=[[] for _ in trazos], dpi=float(DPI),
                lastModifiedAt=1_700_000_000_000, updatedAt=1_700_000_000_000)
    base.update(campos)
    return base


A4_ANCHO, A4_ALTO, HUECO = 210 / 25.4 * DPI, 297 / 25.4 * DPI, 60

# Digitos de siete segmentos (a..g) para escribir el numero de pagina en grande.
SEGMENTOS = {"a": ((0, 0), (1, 0)), "b": ((1, 0), (1, 1)), "c": ((1, 1), (1, 2)), "d": ((0, 2), (1, 2)),
             "e": ((0, 1), (0, 2)), "f": ((0, 0), (0, 1)), "g": ((0, 1), (1, 1))}
DIGITOS = {"0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc",
           "7": "abc", "8": "abcdefg", "9": "abcdfg"}


def numero_grande(n, x0, y0, lado=260, color=NEGRO):
    trazos = []
    for k, ch in enumerate(str(n)):
        ox = x0 + k * lado * 1.5
        for seg in DIGITOS[ch]:
            (ax, ay), (bx, by) = SEGMENTOS[seg]
            trazos.append(segs([(ox + ax * lado, y0 + ay * lado), (ox + bx * lado, y0 + by * lado)], 14, color))
    return trazos


def hojas_de(n, apaisadas=()):
    """Posicion {arriba, izquierda, ancho, alto} de cada hoja, como DisposicionDePaginas.kt."""
    hojas, arriba = [], 0.0
    for i in range(n):
        ancho, alto = (A4_ALTO, A4_ANCHO) if i in apaisadas else (A4_ANCHO, A4_ALTO)
        hojas.append(dict(arriba=arriba, izquierda=(A4_ANCHO - ancho) / 2, ancho=ancho, alto=alto))
        arriba += alto + HUECO
    return hojas


def nota_de_paginas(id, titulo, n, apaisadas=(), con_imagen=None, **campos):
    """n hojas con trazos distintos en cada una: el numero de la hoja, y un dibujo segun i % 4."""
    trazos, imagenes = [], []
    colores = [AZUL, ROJO, VERDE, NEGRO]
    for i, h in enumerate(hojas_de(n, apaisadas)):
        x0, y0, w = h["izquierda"], h["arriba"], h["ancho"]
        trazos += numero_grande(i + 1, x0 + 200, y0 + 200, color=colores[i % 4])
        cx, cy = x0 + w / 2, y0 + h["alto"] / 2 + 300
        dibujo = i % 4
        if dibujo == 0:
            trazos.append(segs(espiral(cx, cy, 30, 600, 4), 5, colores[0]))
        elif dibujo == 1:
            trazos += [segs(onda(x0 + 300, cy + 140 * k, w - 600, 50, 3 + k), 6, colores[1]) for k in range(-3, 4)]
        elif dibujo == 2:
            trazos.append(segs([(x0 + 300 + k * 120, cy + (400 if k % 2 else -400)) for k in range((int(w) - 600) // 120)], 8, colores[2]))
        else:
            trazos += [segs([(x0 + 300, cy - 500 + 100 * k), (x0 + w - 300, cy - 500 + 100 * k)], 3, colores[3]) for k in range(11)]
        if con_imagen and i % con_imagen == 0:
            imagenes.append({"id": f"img-{i}", "centroX": x0 + w - 700, "centroY": y0 + 600, "ancho": 800, "alto": 533,
                             "giro": 0.1 * (i % 3), "debajoDelTrazo": 0})
    papeles = {str(i): {"orientation": "HORIZONTAL"} for i in apaisadas}
    return nota(id, titulo, trazos, pageCount=n, imagenes=imagenes, pagePapers=papeles, **campos), [im["id"] for im in imagenes]


def escribir_imagen(out, nota_id, img_id, tono):
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (600, 400), (200, 230, 255))
    d = ImageDraw.Draw(img)
    for i in range(0, 600, 60):
        d.rectangle([i, 0, i + 30, 400], fill=((120 + i + tono) % 255, 160, 220))
    d.ellipse([200, 100, 400, 300], fill=(255, 200, 0))
    img.save(out / f"image-{nota_id}_{img_id}.webp")


def main(destino):
    rnd = random.Random(7)
    out = pathlib.Path(destino)
    out.mkdir(parents=True, exist_ok=True)
    nuevo = lambda: str(uuid.UUID(int=rnd.getrandbits(128), version=4))
    carpetas = {"trabajo": nuevo(), "ideas": nuevo(), "diario": nuevo()}
    (out / f"folder-{carpetas['trabajo']}.json").write_text(json.dumps({"id": carpetas["trabajo"], "name": "Trabajo", "createdAt": 1}))
    (out / f"folder-{carpetas['ideas']}.json").write_text(json.dumps({"id": carpetas["ideas"], "name": "Ideas", "parentId": carpetas["trabajo"]}))
    (out / f"folder-{carpetas['diario']}.json").write_text(json.dumps({"id": carpetas["diario"], "name": "Diario"}))

    notas = []
    # 1. Tinta de varios colores y grosores
    t = [segs(espiral(1300, 1500, 40, 700, 4), 3, NEGRO), segs(onda(300, 600, 2000, 120, 5), 8, ROJO),
         segs(onda(300, 2900, 2000, 90, 7), 14, AZUL), segs(onda(300, 3200, 2000, 60, 9), 2.5, VERDE)]
    notas.append(nota(nuevo(), "Tinta: colores y grosores", t, lastModifiedAt=1_700_000_500_000, folderId=carpetas["ideas"]))
    # 2. Resaltador debajo y goma parcial
    texto = [segs(onda(300, 1000 + 160 * i, 2000, 25, 6 + i), 3) for i in range(8)]
    resaltador = [segs([(280, 1000 + 160 * i), (2300, 1000 + 160 * i)], 38, AMARILLO_TRANSLUCIDO) for i in (1, 4)]
    goma = [[] for _ in texto + resaltador]
    goma[2] = segs([(900, 1320 + 25 * k) for k in range(0, 4)], 90) + segs([(900, 1330), (1500, 1330)], 70)
    notas.append(nota(nuevo(), "Resaltador y goma", texto + resaltador, eraseMarks=goma, folderId=carpetas["trabajo"],
                      lastModifiedAt=1_700_000_400_000))
    # 3. Notas de 1, 3, 5 (la 2 apaisada) y 12 paginas, con trazos distintos por pagina e imagenes
    for n, titulo, extra in ((1, "1 pagina", {}), (3, "3 paginas", {"con_imagen": 2}),
                             (5, "5 paginas (la 2 apaisada)", {"apaisadas": (1,)}), (12, "12 paginas con imagenes", {"con_imagen": 3})):
        nid = nuevo()
        nn, imgs = nota_de_paginas(nid, titulo, n, paperColor=0xFFF1F8E9 - (1 << 32) if n == 5 else 0xFFFCFBF4 - (1 << 32),
                                   lastModifiedAt=1_700_000_300_000 - n, **extra)
        notas.append(nn)
        for k, im in enumerate(imgs):
            escribir_imagen(out, nid, im, 40 * k)
    # 4. Lienzo infinito con coordenadas negativas
    li = [segs(espiral(-600, -400, 20, 900, 5), 6, ROJO), segs(onda(-1500, 900, 4000, 200, 4), 10, AZUL)]
    notas.append(nota(nuevo(), "Lienzo infinito", li, lienzoInfinito=True, lastModifiedAt=1_700_000_200_000))
    # 5. Imagen webp (se escribe el fichero image-<nota>_<img>.webp) con giro, bajo la tinta
    id_img = nuevo()
    n5 = nota(nuevo(), "Con imagen girada", [segs(onda(300, 1500, 2000, 100, 3), 8, ROJO)],
              imagenes=[{"id": id_img, "centroX": 1300, "centroY": 1500, "ancho": 1200, "alto": 800, "giro": 0.25,
                         "debajoDelTrazo": 0},
                        {"id": "caja-texto", "centroX": 1300, "centroY": 600, "ancho": 800, "alto": 200,
                         "texto": {"tramos": []}}],
              lastModifiedAt=1_700_000_100_000)
    notas.append(n5)
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (600, 400), (200, 230, 255))
    d = ImageDraw.Draw(img)
    for i in range(0, 600, 60):
        d.rectangle([i, 0, i + 30, 400], fill=(120 + i % 120, 160, 220))
    d.ellipse([200, 100, 400, 300], fill=(255, 200, 0))
    img.save(out / f"image-{n5['id']}_{id_img}.webp")
    # 6. Bloqueada (con trazos: el visor no debe dibujarlos), borrada, sin titulo, titulo hostil
    notas.append(nota(nuevo(), "Secreta", [segs(espiral(1300, 1500, 40, 700, 4), 3)], bloqueada=True,
                      folderId=carpetas["diario"], lastModifiedAt=1_700_000_050_000))
    notas.append(nota(nuevo(), "Borrada", [segs(onda(300, 600, 2000, 120, 5), 8)], deletedAt=1_700_000_900_000))
    notas.append(nota(nuevo(), "", [segs(onda(300, 800, 2000, 200, 2), 6, VERDE)], fijada=True, lastModifiedAt=1))
    notas.append(nota(nuevo(), '<img src=x onerror="document.title=\'XSS\'"> <b>hostil</b>',
                      [segs(onda(300, 800, 2000, 100, 2), 6, AZUL)], lastModifiedAt=1_699_999_000_000))
    # 7. Muchas notas pequenas para la rejilla y el scroll
    for i in range(14):
        notas.append(nota(nuevo(), f"Garabato {i + 1}", [segs(espiral(1300, 1700, 20, 300 + 40 * i, 2 + i % 4), 3 + i % 5,
                                                              [ROJO, AZUL, VERDE, NEGRO][i % 4])],
                          folderId=[carpetas["trabajo"], None, carpetas["diario"]][i % 3],
                          lastModifiedAt=1_698_000_000_000 - i * 86_400_000))
    for n in notas:
        (out / f"note-{n['id']}.json").write_text(json.dumps(n, ensure_ascii=False))
    (out / f"note-{nuevo()}.json").write_text("{esto no es json")  # el visor lo cuenta como ilegible
    print(f"{len(notas)} notas sinteticas en {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
