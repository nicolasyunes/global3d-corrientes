# Recursos: webs del taller y buscador en varios sitios

Fecha: 2026-10-02 · Estado: aprobado en chat, pendiente de revisión del documento

## Objetivo

Una pantalla `/admin/recursos` con acceso rápido a las webs que usa el taller
(sitios de modelos, herramientas de IA, personalizadores, reparación de STL,
proveedores y guías), un buscador que abre la misma búsqueda en varios sitios
de modelos a la vez, búsquedas guardadas vinculadas a colecciones de Ideas, y
un atajo para guardar como idea el modelo que se encontró.

Fuera de alcance: vincular proveedores a una lista de compras (todavía no
existe), mostrar recursos en Hoy (Hoy no cambia).

## Investigación: cómo se busca en varios sitios

- Los meta-buscadores (Yeggi, STL Finder, Thangs, 3DSEARCH) mantienen un
  índice propio con millones de modelos y servidores que recorren los sitios.
  No es viable acá, y Printables y Cults3D responden con verificación de
  Cloudflare a navegadores automatizados.
- Elegido: **una pestaña por sitio** con la dirección de búsqueda de cada uno
  (`{q}` = la palabra). Lo hace el navegador del usuario, sin servidor.
  Yeggi se suma como un sitio más para cubrir lo que él indexa.
- Limitación: el navegador permite abrir una sola ventana por clic; las
  demás se bloquean hasta que el usuario permite ventanas emergentes para el
  sitio. La pantalla lo detecta y ofrece links para abrir las bloqueadas.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Hoy | No cambia. Los fijados se muestran solo arriba en Recursos. |
| Búsquedas guardadas | Llevan nombre, palabras, sitios y colección de Ideas opcional. La colección es etiqueta (link a Ideas) y además destino de "Guardar como idea" mientras esa búsqueda está activa. |
| Sitios iniciales | MakerWorld, Printables, Cults3D, Thingiverse, Yeggi (buscadores); Hunyuan 3D; Crea en 3Di; Reparar STL (Aspose). Proveedores y Guías vacíos. |
| Contraseñas | Nunca se guardan. Solo "con qué cuenta entramos" (usuario o mail). |
| Datos | Dos tablas nuevas: `resources` y `saved_searches`. |

## Datos

Migración `supabase/migrations/20261006100000_resources.sql`. Se aplica por
MCP `execute_sql` solo cuando el usuario lo autorice.

### `public.resources`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk default `gen_random_uuid()` | |
| `name` | text not null, `length(trim(name)) > 0` | |
| `url` | text not null | página principal |
| `category` | text not null, check in (`modelos`, `ia`, `personalizar`, `reparar`, `proveedores`, `guias`) | |
| `description` | text | "Para qué lo usamos" |
| `price` | text not null default `gratis`, check in (`gratis`, `mixto`, `pago`) | Gratis / Gratis y pago / Pago |
| `needs_account` | boolean not null default false | Sin cuenta / Con cuenta |
| `account_hint` | text | con qué cuenta entramos, sin contraseña |
| `search_url` | text, check `search_url is null or position('{q}' in search_url) > 0` | si tiene, entra al buscador |
| `pinned` | boolean not null default false | |
| `position` | int not null default 0 | orden dentro de la sección |
| `created_by` | uuid → `operators(id)` on delete set null | |
| `created_at` | timestamptz not null default now() | |

### `public.saved_searches`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk default `gen_random_uuid()` | |
| `name` | text not null, `length(trim(name)) > 0` | |
| `query` | text not null, `length(trim(query)) > 0` | |
| `resource_ids` | uuid[] not null default `'{}'` | sitios elegidos; ids borrados se ignoran |
| `collection_id` | uuid → `idea_collections(id)` on delete set null | |
| `last_used_at` | timestamptz | |
| `created_by` | uuid → `operators(id)` on delete set null | |
| `created_at` | timestamptz not null default now() | |

RLS igual que `notices`: habilitada, política `for all to authenticated using
(true) with check (true)`, grants select/insert/update/delete a
`authenticated`.

### Carga inicial (en la misma migración)

| Nombre | Categoría | URL | Búsqueda | Precio | Cuenta | Fijado |
|---|---|---|---|---|---|---|
| MakerWorld | modelos | https://makerworld.com | `https://makerworld.com/es/search/models?keyword={q}` | gratis | sí | sí |
| Printables | modelos | https://www.printables.com | `https://www.printables.com/search/models?q={q}` | gratis | no | sí |
| Cults3D | modelos | https://cults3d.com | `https://cults3d.com/es/b%C3%BAsqueda?q={q}` | mixto | sí | no |
| Thingiverse | modelos | https://www.thingiverse.com | `https://www.thingiverse.com/search?q={q}&type=things` | gratis | no | no |
| Yeggi | modelos | https://www.yeggi.com | `https://www.yeggi.com/q/{q}/` | gratis | no | no |
| Hunyuan 3D | ia | https://3d.hunyuan.tencent.com | — | gratis | sí | sí |
| Crea en 3Di | personalizar | https://3dinsumos.com.ar | — | gratis | no | sí |
| Reparar STL (Aspose) | reparar | https://products.aspose.app/3d/es/repairing/stl | — | gratis | no | no |

Descripciones: MakerWorld "Modelos listos para imprimir, con perfiles de
impresión."; Printables "Modelos gratis de la comunidad."; Cults3D "Modelos
gratis y pagos; muchos diseños exclusivos."; Thingiverse "El repositorio
clásico de modelos gratis."; Yeggi "Busca en muchos sitios de modelos a la
vez."; Hunyuan 3D "Genera un modelo 3D a partir de una foto o un texto.";
Crea en 3Di "Generadores para personalizar: posavasos, cajas, litofanías,
engranajes."; Reparar STL "Arregla archivos STL con errores antes de
laminar.".

Las direcciones de búsqueda de Printables, Cults3D y Yeggi se confirman en
el navegador del usuario durante la verificación; si alguna no funciona se
corrige desde el modal (no requiere código).

## Reglas (funciones puras en `resources.ts`)

- `buildSearchUrl(template, query)`: reemplaza `{q}` por
  `encodeURIComponent(query.trim())`.
- `searchSites(resources)`: los que tienen `search_url`, en orden de
  `position` y nombre.
- `sections(resources, filter)`: agrupa en Modelos para descargar
  (`modelos`), Crear, personalizar y reparar (`ia`, `personalizar`,
  `reparar`), Proveedores, Guías y ayuda; filtra por texto en nombre,
  dominio y descripción.
- `pinnedResources(resources)`: fijados, por `position` y nombre.
- `domainOf(url)`: host sin `www.`.
- `accessTags(resource)`: `['Gratis' | 'Gratis y pago' | 'Pago', 'Sin
  cuenta' | 'Con cuenta']`.
- `lastUsedLabel(stamp, now)`: "nunca", "hoy", "ayer", "hace 3 días",
  "hace 1 sem", "hace 2 sem", después fecha corta.
- `openSearch(urls, open = window.open)`: llama `open(url, '_blank')` para
  cada una, pone `opener = null` en cada ventana abierta, y devuelve las que
  quedaron bloqueadas (resultado `null`). No se usa el parámetro `noopener`
  porque con él `window.open` siempre devuelve `null` y no se podría saber
  cuáles se bloquearon.

## Pantalla `/admin/recursos`

1. **Encabezado**: "HERRAMIENTAS", "Recursos", buscador "Buscar en
   recursos" (filtra tarjetas), botón "Agregar recurso".
2. **Buscar un modelo en todos los sitios** (franja oscura): campo de texto,
   chips "Dónde" con los sitios buscadores (marcados recordados en
   `localStorage`, envuelto en try/catch; por defecto todos), botón "Buscar en
   N sitios" (deshabilitado sin texto o sin sitios), Enter también busca.
   Si quedan pestañas bloqueadas: aviso "Se bloquearon N pestañas. Permití
   ventanas emergentes para este sitio o abrilas acá:" con un link por sitio.
   Botón "Guardar esta búsqueda" → mini formulario (nombre, colección de
   Ideas opcional) dentro de la franja. Si hay búsqueda activa, se muestra su
   nombre con una "x" para soltarla.
3. **Fijados**: fila de tarjetas chicas (inicial, nombre, categoría, ícono de
   abrir). Se oculta si no hay.
4. **Secciones** con tarjetas: inicial con color por categoría, nombre,
   dominio, descripción, etiquetas, estrella (fijar/soltar), botón "Abrir"
   (link con `target="_blank" rel="noreferrer"`). Tocar el nombre abre el
   modal de edición. Al final de Proveedores y Guías, tarjeta punteada
   "Agregar proveedor" / "Agregar guía" que abre el modal con la categoría
   elegida.
5. **Columna derecha**:
   - **Búsquedas guardadas**: nombre, "“palabras” · N sitios · hace X",
     etiqueta "Colección {nombre}" (link a `/admin/ideas`), botón abrir
     (corre la búsqueda, actualiza `last_used_at`, queda activa), y borrar
     con confirmación en la fila.
   - **¿Encontraste algo?**: campo "Pegá el link…", botón "Guardar como
     idea". Lee el link con `readLink` (de Ideas) y crea la idea con
     `createIdea({ title, url, source: detectSource(url), preview_image_url,
     preview_author, collection_id, created_by })`; título = título leído o
     el dominio. Si hay búsqueda activa con colección, la muestra: "Se guarda
     en Colección X". Al terminar, aviso "Guardada en Ideas" con link a
     `/admin/ideas`.

En teléfono la columna derecha va debajo; tarjetas en una columna; sin scroll
horizontal del cuerpo.

**Modal Agregar/Editar recurso**: link (al pegar uno válido se lee con
`readLink` y se muestra "Leído de la página" con título y dominio; el nombre
se completa si está vacío), Nombre, Categoría (6 chips), Para qué lo usamos,
Precio (Gratis / Gratis y pago / Pago), Cuenta (Sin cuenta / Con cuenta) y
"Con qué cuenta entramos (sin contraseña)" visible con "Con cuenta", "Incluir
en Buscar en todos los sitios" + campo dirección de búsqueda (obligatorio que
tenga `{q}` si está marcado), "Fijar arriba". Botones Cancelar, Guardar; al
editar también Borrar con confirmación dentro del modal.

## Menú lateral

"Recursos" con ícono `globe` (nuevo en `Icon.tsx`), `sideOnly`, debajo de
Ideas.

## Archivos

- `supabase/migrations/20261006100000_resources.sql` (nuevo)
- `src/lib/database.types.ts` (tablas nuevas)
- `src/features/resources/resources.ts` + `resources.test.ts`
- `src/features/resources/resources.api.ts`
- `src/features/resources/ResourcesPage.tsx` + test
- `src/features/resources/MultiSearch.tsx`, `ResourceCard.tsx`,
  `ResourceModal.tsx`, `SavedSearches.tsx`, `FoundIt.tsx`
- `src/features/resources/resources.css`
- `src/components/Icon.tsx` (`globe`)
- `src/features/admin/admin.route.tsx`, `AdminLayout.tsx`

## Errores

- Carga fallida: banner de error.
- Guardar/borrar fallido: mensaje dentro del modal o aviso abajo.
- `readLink` nunca falla (devuelve vacío); si no lee nada, se usa el dominio.

## Pruebas

- `resources.test.ts`: `buildSearchUrl` (acentos y espacios), secciones y
  filtro, etiquetas, `lastUsedLabel`, `openSearch` con ventanas bloqueadas.
- `ResourcesPage.test.tsx`: muestra secciones y fijados; buscar abre una URL
  por sitio marcado; desmarcar un chip lo saca; guardar búsqueda con
  colección; "Guardar como idea" usa la colección de la búsqueda activa;
  agregar recurso desde el modal.
