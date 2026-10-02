# Avisos y tareas: cartelera + tablero

Fecha: 2026-10-02 · Estado: aprobado en chat, pendiente de revisión del documento

## Objetivo

Convertir la pantalla `/admin/avisos` en el lugar donde el equipo ve y organiza
todo lo que hay que hacer en el local y el taller: una **cartelera** de avisos
que se van solos cuando vencen y un **tablero** de tareas por sector, con
importancia, persona asignada, fecha, repetición y vínculo. También una vista
**tabla** de las mismas tareas.

Fuera de alcance: Recursos (tiene su propio documento), presupuestos formales
en PDF, consultas del mostrador.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Sectores | Cuatro fijos: Local, Taller, Compras y faltantes, Presupuesto. No se agregan ni renombran por ahora. |
| Vínculo de una tarea | Texto libre o link, opcional. Si empieza con `http`, se muestra como link que abre en otra pestaña. No se conecta con pedidos ni clientes. |
| Tareas que se repiten | Al marcarla, queda registrado quién y cuándo, y vuelve sola a pendiente con la fecha corrida un día, una semana o un mes. |
| Vencimiento de avisos | Fecha "hasta" opcional. Con fecha, el aviso deja de mostrarse al terminar ese día. Sin fecha, queda hasta que alguien lo archive. |
| Color de avisos | Lo elige quien lo carga. La chinche (fijado) lo pone adelante. |
| Hoy | **No cambia a la vista.** La tarjeta compacta sigue igual; solo se adapta a los datos nuevos. |
| Vistas | Tablero y Tabla. En el teléfono arranca en Tabla. |
| Datos | Se amplía la tabla `notices` existente; no se crean tablas nuevas. |

## Datos

Migración nueva sobre `public.notices` (los datos cargados no se pierden):

| Columna | Tipo | Para qué | Por defecto |
|---|---|---|---|
| `sector` | text, check in (`local`, `taller`, `compras`, `presupuesto`) | Columna del tablero (solo tareas) | `local` |
| `priority` | text, check in (`alta`, `media`, `baja`) | Importancia (solo tareas) | `media` |
| `assignee_id` | uuid → `operators(id)` on delete set null | A quién está asignada | null |
| `due_on` | date | Fecha límite de la tarea | null |
| `repeat` | text, check in (`day`, `week`, `month`) | Repetición | null (no se repite) |
| `link` | text | Vínculo libre o URL | null |
| `color` | text, check in (`amarillo`, `rosa`, `celeste`, `verde`, `lila`) | Color del aviso | `amarillo` |
| `pinned` | boolean not null | Aviso fijado adelante | false |
| `expires_on` | date | "Hasta" del aviso | null |
| `last_done_at` | timestamptz | Última vez que se hizo una tarea repetida | null |
| `last_done_by` | uuid → `operators(id)` on delete set null | Quién la hizo | null |

Migración de datos existente: `priority = 'alta'` donde `important = true`.
La columna `important` se deja (no se borra) pero la app deja de escribirla;
la fuente de verdad pasa a ser `priority`. Las tareas ya cargadas quedan en
el sector Local y se pueden mover desde el panel de edición.

Índice: el actual `notices_open_idx` alcanza (pocas filas). RLS y grants no
cambian.

Archivo: `supabase/migrations/20261005100000_notices_board.sql`. Se aplica
por MCP `execute_sql` solo cuando el usuario lo autorice.

## Reglas (funciones puras en `notices.ts`)

- `activeNotices(rows, today)`: avisos (`kind = 'notice'`) no archivados y con
  `expires_on` null o `>= today`. Orden: fijados primero, después más nuevos.
- `boardTasks(rows, today)`: tareas no archivadas; las hechas solo si
  `done_at` es de hoy (sección "Hechas hoy"). Las hechas de días anteriores
  no se muestran.
- `isOverdue(task, today)`: pendiente con `due_on < today`.
- Orden dentro de una columna: vencidas, después alta → media → baja, después
  por fecha (sin fecha al final), después más nuevas.
- `nextDue(due_on | today, repeat)`: suma 1 día, 7 días o 1 mes.
- Marcar una tarea:
  - sin `repeat`: `done_at = now`, `done_by = persona`.
  - con `repeat`: `last_done_at = now`, `last_done_by = persona`,
    `due_on = nextDue(...)`, `done_at` queda null. La tarjeta muestra
    "hecha por sabri hoy" mientras `last_done_at` sea de hoy.
- Filtros: Todas · Mías (`assignee_id = persona actual`) · Sin asignar ·
  Vencidas. Importancia (alta/media/baja) como filtro adicional que se puede
  combinar. Buscador por texto del cuerpo y del vínculo.
- Resumen del encabezado: pendientes, de importancia alta, vencidas.

`visibleNotices`, `sortNotices` y `openTasks` siguen existiendo para la
tarjeta de Hoy; `sortNotices` pasa a usar `priority = 'alta'` en lugar de
`important`.

## Pantalla `/admin/avisos`

Arriba hacia abajo:

1. **Encabezado**: etiqueta "EQUIPO", título "Avisos y tareas", resumen
   ("10 pendientes · 4 de importancia alta · 1 vencida", la parte de alta en
   rojo). A la derecha: selector Tabla / Tablero y botón "Nueva tarea".
2. **Cartelera**: título con "N avisos activos · se van solos cuando vencen",
   botón "Nuevo aviso" y "Ocultar" (recordado en el navegador). Tarjetas de
   color en grilla de 3 por fila (1 en el teléfono): texto, chinche si está
   fijado, quién lo cargó · hace cuánto, "hasta el jue 8" si tiene fecha.
   Al tocar una tarjeta se edita; desde ahí se fija, cambia color o archiva.
3. **Filtros**: pestañas Todas / Mías / Sin asignar / Vencidas con
   cantidades, chips de importancia con cantidades, buscador.
4. **Tablero**: 4 columnas con fondo suave de su color (Local crema, Taller
   celeste, Compras verde, Presupuesto lila), ícono, nombre, cantidad y
   desglose "1 alta · 1 media · 1 baja". Tarjeta de tarea:
   - chip de importancia (barras + texto) y fecha arriba (Hoy, Ayer, Sáb 3;
     en rojo si está vencida),
   - círculo para marcar + texto,
   - "cada semana" si se repite, avatar y nombre o "Sin asignar",
   - vínculo debajo, si tiene,
   - borde rojo si está vencida.
   Abajo de cada columna: "Agregar en {sector}…" (carga rápida: escribir y
   Enter; queda con importancia media y sin asignar). Después, "HECHAS HOY · N"
   con las tachadas.
5. **Tabla**: mismas tareas filtradas; columnas Tarea · Sector · Importancia ·
   Asignado · Fecha, con orden por columna. Círculo para marcar en cada fila.

**Panel de tarea** (al tocar una tarjeta o "Nueva tarea"): texto, sector,
importancia, asignado (personas activas), fecha, repetir (no / día / semana /
mes), vínculo. Botones Guardar, Archivar y, con confirmación dentro del
panel, Borrar.

**Panel de aviso** ("Nuevo aviso" o al tocar uno): texto, color (5 muestras),
fijar, hasta (fecha opcional). Guardar, Archivar.

## Menú lateral

"Avisos" pasa a "Avisos y tareas" con ícono de tilde y un número con las
tareas pendientes (mismo estilo que el de Ideas).

## Hoy

Sin cambios visibles. Ajustes internos de `NoticesCard compact`:
- el ordenamiento usa `priority`,
- la bandera "Importante" pasa `priority` entre `alta` y `media`,
- los avisos vencidos (`expires_on < hoy`) dejan de aparecer.
- el formulario de carga rápida crea tareas en sector Local, media.

## Archivos

- `supabase/migrations/20261005100000_notices_board.sql` (nuevo)
- `src/lib/database.types.ts` (columnas nuevas)
- `src/features/notices/notices.ts` (reglas nuevas) + `notices.test.ts`
- `src/features/notices/notices.api.ts` (crear/editar con los campos nuevos,
  marcar con repetición, borrar)
- `src/features/notices/NoticesPage.tsx` (reescrita)
- `src/features/notices/NoticeBoard.tsx`, `NoticeTable.tsx`,
  `NoticeCartelera.tsx`, `TaskPanel.tsx`, `NoticePanel.tsx` (nuevos)
- `src/features/notices/notices.css`
- `src/features/notices/NoticesCard.tsx` (ajustes internos)
- `src/features/admin/AdminLayout.tsx` (nombre, ícono, número)

## Errores

- Si falla la carga: banner de error en la pantalla, como hoy.
- Marcar, cambiar importancia o archivar: cambio optimista; si falla, vuelve
  atrás y muestra un aviso abajo ("No se pudo marcar la tarea.").
- Archivar muestra "Deshacer" como hoy.

## Pruebas

- `notices.test.ts`: vencimiento de avisos, orden de la columna, `isOverdue`,
  `nextDue` (incluye fin de mes), filtros y resumen.
- `NoticesPage.test.tsx`: muestra cartelera y 4 columnas; marcar una tarea
  repetida corre la fecha; "Agregar en Taller" crea en ese sector; filtro
  Mías; cambio a Tabla.
- `TodayPage.test.tsx` sigue pasando sin cambios de comportamiento.
