# Hoja de ruta automática

`getswiftpen.com/roadmap/` se genera desde los issues de GitHub con `scripts/roadmap.py`.
Nadie edita la página a mano: se cambian las etiquetas de los issues.

## Qué issues salen

Solo los que llevan una etiqueta de estado, en `Matias-AlM/swiftpen` (privado) o en este repo:

| Etiqueta | Sección |
|---|---|
| `roadmap:en-desarrollo` | En desarrollo |
| `roadmap:planeado` | Planeado |
| `roadmap:considerando` | Bajo consideración |

- Sin etiqueta de estado, no sale nada (bugs internos, feedback, issues de trabajo…).
- Un issue **cerrado** con etiqueta de estado sale como hecho (✓ y tachado) durante 30 días y luego desaparece
  (`DIAS_HECHO` en el script). Para quitar algo antes, se quita la etiqueta.
- Con varias etiquetas de estado gana la más avanzada (en desarrollo > planeado > considerando).
- La etiqueta `roadmap` a secas **no** publica: en `swiftpen` ya significa «para versiones futuras» (uso interno).
- Los pull requests se ignoran.

## Qué texto sale

Del issue solo se lee el **título** y el bloque opcional del cuerpo (invisible en GitHub); el resto del
cuerpo, los comentarios, autores y números de issue no se leen ni se publican nunca.

```
<!-- roadmap
titulo: Título público en español (opcional; por defecto, el título del issue)
titulo-en: Public title in English
titulo-fr: Titre public en français
desc: Descripción corta opcional.
desc-en: Optional short description.
desc-fr: Description courte facultative.
-->
```

Si falta `titulo-en` o `titulo-fr`, esa versión sale con el texto en español (título y descripción) y el
script avisa. No hay traducción automática. Todo el texto se escapa como HTML (los títulos son contenido
externo) y se limita a 160/300 caracteres.

## Cómo se actualiza

El workflow `Deploy to Firebase Hosting on merge` (`.github/workflows/firebase-hosting-merge.yml`) corre el
generador antes de `construir.sh` en cada despliegue y se dispara con:

- push a `main`;
- cron, cada 6 horas;
- botón manual (Actions → Run workflow);
- `repository_dispatch` de tipo `roadmap` (ver abajo).

Si el disparo no es un push, solo se redespliega cuando el HTML generado difiere del publicado. El generador
no hace commits: genera en el runner. `sitio/roadmap/index.html` guarda entre `<!--roadmap:inicio-->` y
`<!--roadmap:fin-->` una copia de reserva que se usa si no hay ningún issue publicable. Si el generador falla,
el despliegue de un push sigue con esa copia y el job acaba en rojo; un disparo programado no despliega nada.

Los workflows con `schedule` se desactivan tras 60 días sin actividad en el repo; se reactivan a mano.

## Alta del token (una vez)

`swiftpen` es privado: el `GITHUB_TOKEN` de este repo no lo puede leer. Hace falta un secreto `ROADMAP_TOKEN`:

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
2. Resource owner: `Matias-AlM`. Expiración: la más larga permitida (apúntala: al caducar la Action falla en rojo).
3. Repository access: *Only select repositories* → `swiftpen` (y este repo si se quiere).
4. Permissions → Repository permissions → **Issues: Read-only** (lo de Metadata se añade solo). Nada más.
5. Generate token y copiarlo.
6. En `Matias-AlM/Matias-AlM.github.io` → Settings → Secrets and variables → Actions → **New repository secret**:
   nombre `ROADMAP_TOKEN`, valor el token.
7. Actions → *Deploy to Firebase Hosting on merge* → Run workflow, y comprobar que el paso del roadmap pasa.

Sin el secreto el paso del roadmap falla con un mensaje claro y la web no se rompe (ver arriba).

## Actualización inmediata desde el repo de la app (opcional)

Sin esto, los cambios tardan hasta 6 horas. Para que sea inmediato, en `swiftpen` un workflow como este avisa
a la web cuando se crea, edita, etiqueta o cierra un issue (necesita un secreto `WEB_DISPATCH_TOKEN` en
`swiftpen`: PAT fine-grained con acceso a este repo y **Contents: Read and write**, que es lo que exige
`repository_dispatch`):

```yaml
name: Avisar a la web (roadmap)
on:
  issues:
    types: [opened, edited, closed, reopened, labeled, unlabeled]
jobs:
  avisar:
    if: ${{ contains(join(github.event.issue.labels.*.name, ','), 'roadmap:') || startsWith(github.event.label.name, 'roadmap:') }}
    runs-on: ubuntu-latest
    steps:
      - run: >
          gh api repos/Matias-AlM/Matias-AlM.github.io/dispatches
          -f event_type=roadmap
        env:
          GH_TOKEN: ${{ secrets.WEB_DISPATCH_TOKEN }}
```

## Probar en local

```
python3 scripts/roadmap.py --dry-run                                        # issues reales (usa `gh auth token`)
python3 scripts/roadmap.py --ejemplo scripts/roadmap_ejemplo.json --dry-run # sin red
python3 -m unittest discover -s scripts -p 'test_roadmap.py'
```
