# Ideas (próximos productos) — diseño

Fecha: 2026-09-30 · Estado: para revisar

## Para qué

Un lugar donde el taller va juntando cosas que podría imprimir: links de
MakerWorld, Cults, Printables, Instagram…, archivos STL/3MF, capturas y fotos.
Se ordenan por colección temática (Día de la Madre, Navidad) y se sigue su
avance (Idea → Para probar → Probada). No crea productos: pasar una idea al
catálogo se decide más adelante.

## Datos (migración nueva)

`idea_collections`
- `id`, `name` (obligatorio), `target_date` (date, opcional), `position`,
  `created_at`.

`ideas`
- `id`, `title` (obligatorio), `url` (opcional), `source` (texto:
  makerworld | cults | printables | thingiverse | instagram | tiktok |
  pinterest | photo | other), `preview_image_url`, `preview_author`,
  `collection_id` (FK a `idea_collections`, `on delete set null`),
  `status` (idea | to_test | tested, por defecto idea), `priority`
  (normal | high, por defecto normal), `notes`, `created_by` (operador),
  `created_at`, `updated_at` (trigger como en el resto de las tablas).

`idea_files`
- `id`, `idea_id` (FK, `on delete cascade`), `storage_path`, `kind`
  (image | video | model), `file_name` (nombre original, para descargar),
  `size_bytes`, `position`, `created_at`.

Storage: depósito `idea-files`, público para lectura como `order-images`,
50 MB por archivo. Acepta imágenes, video corto (mp4/webm/mov) y
`.stl` / `.3mf` / `.obj` / `.step`.

Permisos (RLS): igual que pedidos, solo usuarios con acceso al panel leen y
escriben. Borrar una idea borra sus filas de archivos; la app borra también
los archivos del depósito.

## Leer el link

Función de Supabase `link-preview` (requiere sesión del panel):
- Recibe `{ url }`, valida que sea http(s) y no apunte a direcciones
  internas, descarga como máximo ~1 MB del HTML con timeout de 6 s y lee
  `og:title`, `og:image`, `og:site_name` y autor (`author` /
  `article:author`).
- Devuelve `{ title, image, author, site }` o campos vacíos si el sitio
  bloquea. Nunca falla la carga de la idea.

El sitio (`source`) se detecta en la app por el dominio, sin depender de la
función, así la etiqueta "MakerWorld", "Instagram"… aparece siempre.

## Pantalla

Ruta `/admin/ideas`, en el menú debajo de Taller, con el contador de ideas
que no están probadas.

Encabezado: eyebrow "Próximos productos", título "Ideas", selector
Galería / Tablero, botón "+ Agregar idea".

Filtros: chips "Todas", una por colección (nombre, fecha y "faltan N días"
si tiene fecha, cantidad), "Sin colección", "+ Colección" (nombre y fecha
opcional; editar y borrar desde el mismo chip). Buscador por nombre/notas y
botón "Solo alta".

Galería: una sección por colección (y "Sin colección" al final), con
resumen a la derecha ("1 probada · 4 por probar"). Tarjetas con la foto
(la del link, si no la primera foto propia, si no un recuadro), etiqueta del
sitio arriba a la izquierda, ▶ si es video, nombre, estado con su punto de
color y "Alta" si corresponde. Última tarjeta "Agregar acá", que abre el
alta con esa colección elegida.

Tablero: columnas Idea / Para probar / Probada con los mismos colores de
etapa que Pedidos (gris, azul, lila). Tarjeta con foto, etiqueta, nombre,
colección, cantidad de links y archivos. Se muestran 5 por columna y
"+ N más". Se mueven con "Pasar a …" (sin arrastrar).

Agregar idea (ventana):
1. Campo del link arriba. Al pegar, se detecta el sitio y se consulta
   `link-preview`; el recuadro "Leído del link" muestra imagen, título y
   sitio · autor. El título completa "Nombre" si estaba vacío.
2. Zona "Fotos, capturas o reels": arrastrar, elegir o pegar con Ctrl+V;
   miniaturas al lado con opción de quitar.
3. Nombre (obligatorio), Colección, Prioridad (Normal / Alta).
4. Nota: los STL/3MF se pueden sumar ahora (misma zona) o después.
5. Cancelar / Guardar idea. Sin link ni foto, alcanza con el nombre.

Detalle de la idea (panel lateral al tocar una tarjeta): editar nombre,
link, colección, prioridad, estado y notas; ver fotos grandes; lista de
archivos 3D con descarga y borrar; sumar archivos; borrar la idea (con
confirmación).

## Errores

- Link ilegible: se guarda igual, recuadro dice "No se pudo leer el link;
  poné el nombre y pegá una captura".
- Archivo muy grande o de tipo no aceptado: mensaje en la zona de archivos,
  el resto se sube.
- Falla una subida: la idea queda guardada y el archivo marca "Reintentar".

## Pruebas

- Detección de sitio por dominio.
- Agrupado por colección, filtro por colección / "Solo alta" / búsqueda.
- "faltan N días" de la colección.
- Ventana de alta: pegar link completa el nombre, sin nombre no guarda.
- Validación de archivos (tipo y tamaño).

## Publicar

Requiere en producción: aplicar la migración, crear el depósito
`idea-files` y desplegar la función `link-preview`. Se pide permiso antes.

## Fuera de alcance

Pasar a catálogo / crear producto, arrastrar tarjetas, ideas en varias
colecciones a la vez, comentarios.
