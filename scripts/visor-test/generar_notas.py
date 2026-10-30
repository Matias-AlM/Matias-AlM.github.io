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
    # 3. Varias paginas, una apaisada
    pag = [segs(espiral(1300, 1900 + i * 4200, 30, 500, 3), 5, NEGRO if i % 2 else AZUL) for i in range(3)]
    notas.append(nota(nuevo(), "Tres hojas (la 2 apaisada)", pag, pageCount=3, paperColor=0xFFF1F8E9 - (1 << 32),
                      pagePapers={"1": {"orientation": "HORIZONTAL", "color": 0xFFFFF3E0 - (1 << 32)}},
                      lastModifiedAt=1_700_000_300_000))
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
