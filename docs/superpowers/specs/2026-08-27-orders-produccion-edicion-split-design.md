# Split pedido: pantalla de producción vs. pantalla de datos/edición

**Fecha:** 2026-08-27
**Estado:** Aprobado (diseño) — pendiente de plan de implementación
**Ámbito:** `/admin/orders/:id` y la vista Kanban de `/admin/orders`

## Problema

Hoy `/admin/orders/:id` ([OrderDetail.tsx](../../../src/features/orders/OrderDetail.tsx))
apila en una sola pantalla dos modos mentales que no se usan juntos:

- **Producir**: qué colores, qué medidas, qué texto se graba, qué falta hacer,
  en qué etapa está.
- **Administrar el pedido**: nombre y teléfono del cliente, total, seña, saldo,
  método de pago, canal de origen, link de referencia.

Para operar una granja 3D (3 personas, trabajo repartido entre casa y local,
tandas que cruzan pedidos) el piso de taller necesita una vista limpia y rápida
de "qué hay que fabricar", sin el ruido de la parte comercial. La edición de
datos es una tarea distinta, menos frecuente, que puede vivir en su propia
pantalla.

El Kanban de `/admin/orders` ([OrdersKanban.tsx](../../../src/features/orders/OrdersKanban.tsx))
tampoco habla el idioma del piso: las tarjetas muestran cliente / producto /
vencimiento / saldo, pero no los colores ni el texto a imprimir ni cuánto falta
de la checklist.

## Objetivos

- `/admin/orders/:id` = **pantalla de producción**: sólo lo necesario para
  fabricar. Lectura, salvo avanzar etapa y tildar la checklist.
- `/admin/orders/:id/editar` = **pantalla de datos/edición**: el `OrderForm`
  completo (cliente, plata, pago, canal, link, colores, ítems, medidas,
  observaciones).
- Kanban rediseñado con datos de producción en la tarjeta.
- **Sin migración de base de datos.** Se reorganiza lo que ya existe.
- Respetar la prioridad de carga rápida: nada de fetches pesados nuevos.

## No-objetivos

- No se agregan campos de granja (impresora asignada, material/filamento,
  tiempo/gramos estimados). Queda para una iteración posterior con migración.
- No se cambia el flujo de estados ni el set de columnas del Kanban.
- No se introduce drag-and-drop en el Kanban (flujo lineal; el botón "Avanzar"
  es accesible con teclado y lector de pantalla).
- No se toca la Lista por fecha (Pendientes / Próximos / Planilla).

## Enfoques evaluados

| Enfoque | Decisión |
|---|---|
| **A. Dos pantallas por ruta, producción primero** | **Elegido.** Cada modo mental en su propia URL; la de producción es la que se abre al tocar una tarjeta. |
| B. Una ruta con pestañas "Producción" / "Datos" | Descartado. Mantiene los dos modos en la misma pantalla; no reduce el ruido visual. |
| C. Separar por rol/permiso | Descartado. En un taller de 3 personas el operario y quien edita datos suelen ser la misma persona. |

## Diseño

### 1. Ruteo y navegación

En [admin.route.tsx](../../../src/features/admin/admin.route.tsx):

| Ruta | Hoy | Propuesta |
|---|---|---|
| `orders/:id` | `<OrderDetail />` | `<OrderProduction />` (nuevo) |
| `orders/:id/editar` | — | `<OrderEdit />` (nuevo) |

- Las tarjetas del Kanban y de la Lista siguen enlazando a `/admin/orders/:id`
  (sin cambios de URL en los orígenes).
- `OrderProduction` header: `← Volver` (a `/admin/orders`) + link discreto
  `Datos y edición ↗` (a `/admin/orders/:id/editar`).
- `OrderEdit` header: `← Volver a producción` (a `/admin/orders/:id`).
- `OrderDetail.tsx` se elimina. Sus piezas se reparten entre las dos pantallas
  nuevas. `ProductionChecklist.tsx` y `OrderImages.tsx` se reutilizan sin
  cambios.

### 2. `OrderProduction` — pantalla de piso de taller

Componente nuevo: `src/features/orders/OrderProduction.tsx`. Una sola columna,
mobile-first. Orden vertical:

1. **Tira de encabezado**
   - Nombre del cliente en tamaño chico (es referencia, no el sujeto de la
     pantalla).
   - Tipo de producto.
   - Vencimiento con color de urgencia y texto relativo ("faltan 2 días",
     "vencido hace 1"). Reutiliza `formatDueDate` / `isOverdue` de
     [list.ts](../../../src/features/orders/list.ts) y
     [format.ts](../../../src/features/orders/format.ts).
   - `StatusBadge` con la etapa actual.

2. **Control de etapa** — la única acción de escritura de peso en esta pantalla.
   - Etapa actual destacada.
   - Botón primario `Avanzar a {ORDER_STATUS_LABELS[next]} →`
     (`next = nextOrderStatus(order.status)`).
   - Botón secundario `Cancelar pedido` cuando no está `finished` ni
     `cancelled`.
   - Misma lógica que la sección `status-actions` de `OrderDetail` hoy:
     `updateOrder(id, { status })` + merge del row persistido sobre el estado
     local (preservando la relación `customers`).
   - Mensajes de estado terminal ("Este pedido está completo" / "…fue
     cancelado") y `form-banner--error` en caso de fallo.

3. **"Qué hay que hacer"** — el núcleo. Todo desde campos que ya vienen en la
   fila del pedido (`getOrder` ya los trae). Cada fila se **omite** si el dato
   está vacío (no se muestran labels sin valor):
   - **Colores por parte** — `color_spec` (Json `{ parte: color }`) como lista
     parte → color. Punto de muestra de color cuando el valor mapea a un color
     conocido (best-effort, tabla nombre→hex acotada); texto solo si no.
     Reutiliza `colorPartsFromSpec` de
     [validation.ts](../../../src/features/orders/validation.ts) para parsear.
   - **Medidas** — `measurements` tal cual.
   - **Texto / personalización** — `personalization` del pedido en tamaño
     grande y seleccionable (es lo que se graba).
   - **Ítems** — cuando `listOrderItems(orderId)` devuelve filas, se listan
     debajo: descripción + personalización + cantidad por ítem. Es adicional a
     la línea de `personalization` del pedido, no la reemplaza. Si no hay
     ítems, la sección se omite.

4. **Referencia visual**
   - `<OrderImages orderId={order.id} />` sin cambios — las fotos de referencia
     (lo que mandó el cliente, mockups, logos a crear) son dato de producción.
   - `reference_link`, si existe, como `Ver modelo ↗` (target `_blank`,
     `rel="noopener noreferrer"`).

5. **Checklist de producción**
   - `<ProductionChecklist orderId={order.id} />` sin cambios. Ya es 100%
     producción (tareas con tag `casa` / `local`, tildado incremental).

6. **Observaciones**
   - `observations` tal cual, sólo lectura.

**No se muestra en esta pantalla:** `total_amount`, `deposit`, `payment_method`,
`origin_channel`, teléfono del cliente.

**Excepción — saldo pendiente:** se muestra `Saldo pendiente: {formatMoney(order.pending_balance)}`
**sólo cuando `order.status === 'finished'`** (momento de entregar: "no lo
entregues sin cobrar el saldo"). En cualquier otra etapa, oculto. El valor es
`pending_balance` verbatim, nunca recalculado.

**Carga de datos:**
- `getOrder(id)` — trae el pedido con `customers(name, phone)`, `color_spec`,
  `personalization`, `measurements`, `observations`, `status`, `due_date`,
  `pending_balance`, `reference_link`.
- `listOrderItems(id)` — sólo si se decide mostrar ítems desglosados; se puede
  cargar en paralelo con `getOrder` vía `Promise.all`.
- `ProductionChecklist` y `OrderImages` se auto-cargan (sin cambios).
- Estados de carga (`Cargando…`) y error (`form-banner--error` + link
  `Volver a pedidos`) como en `OrderDetail` hoy.

### 3. `OrderEdit` — pantalla de datos del pedido

Componente nuevo: `src/features/orders/OrderEdit.tsx`. Es un envoltorio finito
alrededor del `OrderForm` existente:

- `getOrder(id)` → estados `loading` / `error` / `order` (mismo patrón que
  `OrderDetail`).
- Header solo-lectura: `← Volver a producción`, nombre del cliente, `StatusBadge`
  con la etapa.
- `<OrderForm key={order.id} initialOrder={order} onSaved={handleSaved} />`.
  - `OrderForm` en modo edición ya sabe actualizar: `updateCustomer`
    (nombre + teléfono), y `updateOrder` con `product_type`, `due_date`,
    `total_amount`, `deposit`, `pending_balance`, `payment_method`,
    `origin_channel`, `reference_link`, `color_spec`, `personalization`,
    `measurements`, `observations`, más `replaceOrderItems`.
  - `OrderForm` **nunca toca `status`** (ya es así) — el avance de etapa es
    exclusivo de `OrderProduction`.
- `handleSaved` re-lee el pedido con `getOrder` para refrescar la relación
  `customers`.
- **Sin** botones de avanzar/cancelar etapa.
- **Sin** galería de imágenes (vive en `OrderProduction`, para no duplicar).

### 4. Rediseño del Kanban

Toca [OrdersKanban.tsx](../../../src/features/orders/OrdersKanban.tsx),
[OrdersList.tsx](../../../src/features/orders/OrdersList.tsx),
[orders.api.ts](../../../src/features/orders/orders.api.ts) y
`orders.css`.

**Columnas:** sin cambios. `KANBAN_STATUSES = [...ORDER_STATUS_FLOW, 'cancelled']`
→ Nuevo, Imprimiendo, Post-procesado, Terminado, Entregado, Cancelado.
("En cola" sólo aparece si hay pedidos históricos en ese estado.)

**Contenido de la tarjeta** (`kanban-card`), reordenado para "qué hay en el
piso":

1. Cliente (negrita) + tipo de producto. *(ya está)*
2. **Colores** compactos — desde `color_spec`, formato `tapa negro · base blanco`,
   con puntos de muestra, truncado a una línea. Se omite si `color_spec` está
   vacío.
3. **Texto a imprimir** — snippet de `personalization` en una línea con elipsis.
   Se omite si está vacío.
4. Meta row: vencimiento con urgencia · pill de checklist `3/5` · `N ítems` si
   `itemCounts[id] > 1`.
5. Nota de `observations`. *(ya está)*
6. Botón `Avanzar a {next} →`. *(ya está, sin cambios de comportamiento)*

**Datos:**
- `color_spec` y `personalization` ya vienen en cada fila de `listOrders()` →
  costo cero.
- El pill `3/5` necesita conteos de tareas por pedido. Se agrega a
  `orders.api.ts`:

  ```ts
  // Un row por tarea, sólo las columnas necesarias — el Kanban reduce a
  // { hechas, total } por pedido en cliente (tabla chica, no amerita RPC).
  export async function listProductionTaskCounts(): Promise<
    Record<string, { done: number; total: number }>
  > {
    const { data, error } = await supabase
      .from('order_production_tasks')
      .select('order_id, done')
    if (error) throw error
    const counts: Record<string, { done: number; total: number }> = {}
    for (const row of data ?? []) {
      const c = (counts[row.order_id] ??= { done: 0, total: 0 })
      c.total += 1
      if (row.done) c.done += 1
    }
    return counts
  }
  ```

- `OrdersList` lo suma al `Promise.all` de carga existente
  (`listOrders()` + `listOrderItemCounts()` + `listProductionTaskCounts()`),
  guarda en estado y lo pasa a `<OrdersKanban taskCounts={…} />`. Un pedido sin
  tareas no muestra pill.

**Modernización visual (solo tokens de `tokens.css`, nunca hex crudo):**
- Borde izquierdo de la tarjeta en el color de etapa (`ORDER_STATUS_COLORS`).
- Header de columna tintado (ya usa `borderTopColor`; se refuerza con fondo
  sutil).
- Escala tipográfica más densa en la tarjeta; jerarquía clara cliente > colores
  > texto > meta.
- Sin scroll horizontal: se mantiene el grid que envuelve (columnas full-width
  apiladas en teléfono, grid desde ~900px).

### 5. Flujo de datos y errores (resumen)

| Pantalla | Lectura | Escritura |
|---|---|---|
| `OrderProduction` | `Promise.all([getOrder, listOrderItems])` + auto-carga de `ProductionChecklist` / `OrderImages` | `updateOrder(id,{status})` (avanzar/cancelar); toggles de checklist vía `ProductionChecklist` |
| `OrderEdit` | `getOrder` | `updateCustomer` + `updateOrder` + `replaceOrderItems` vía `OrderForm` |
| Kanban | `listOrders` + `listOrderItemCounts` + `listProductionTaskCounts` (un `Promise.all`) | `updateOrder(id,{status})` con patch local en `orders` |

Errores: se reutilizan `form-banner form-banner--error` y el texto `Cargando…`.
Pedido inexistente: banner + link `Volver a pedidos`.

## Plan de tests

- **Unit — `listProductionTaskCounts` reducer**: dado un array de
  `{ order_id, done }`, agrupa a `{ done, total }` por pedido; pedido sin filas
  ausente del map.
- **`OrderProduction`**:
  - Renderiza colores, medidas y personalización desde el pedido.
  - Omite la fila de una sección cuando el campo está vacío.
  - `Avanzar a {X}` llama a `updateOrder` con el `status` siguiente y refleja el
    cambio.
  - **No** renderiza total / seña / método de pago / canal.
  - Renderiza `Saldo pendiente` sólo con `status === 'finished'`.
- **`OrderEdit`**:
  - Renderiza `OrderForm` con los valores iniciales del pedido.
  - No muestra botones de avanzar/cancelar etapa.
  - `onSaved` dispara un re-fetch.
- **`OrdersKanban`**:
  - La tarjeta muestra colores + snippet de personalización + pill `3/5`.
  - Pedido sin tareas → sin pill.
  - `Avanzar` sigue funcionando y patchea el estado.
  - El link de la tarjeta apunta a `/admin/orders/:id`.
- **Ruteo** (`admin.route` o test de integración):
  - `/admin/orders/:id` monta `OrderProduction`.
  - `/admin/orders/:id/editar` monta `OrderEdit`.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/features/admin/admin.route.tsx` | Nueva ruta `orders/:id/editar`; `orders/:id` → `OrderProduction` |
| `src/features/orders/OrderProduction.tsx` | **Nuevo** |
| `src/features/orders/OrderEdit.tsx` | **Nuevo** |
| `src/features/orders/OrderDetail.tsx` | **Eliminado** |
| `src/features/orders/OrdersKanban.tsx` | Rediseño de tarjeta; nueva prop `taskCounts` |
| `src/features/orders/OrdersList.tsx` | Fetch de `listProductionTaskCounts`; pasar `taskCounts` al Kanban |
| `src/features/orders/orders.api.ts` | `+ listProductionTaskCounts()` |
| `src/features/orders/orders.css` | Estilos de tarjeta Kanban + layout de `OrderProduction` |
| `src/features/orders/ProductionChecklist.tsx` | Sin cambios (reutilizado) |
| `src/features/orders/OrderImages.tsx` | Sin cambios (reutilizado) |
| Tests | `OrderProduction.test.tsx`, `OrderEdit.test.tsx`, `OrdersKanban.test.tsx` (nuevo/actualizado), `orders.api` o `list` test para el reducer, `admin.route` test |

## Riesgos y mitigaciones

- **Enlaces existentes a `/admin/orders/:id`** esperando ver el form de edición:
  hoy no hay ninguno externo — sólo Kanban y Lista, que siguen apuntando a la
  misma URL (ahora producción). La edición se alcanza desde el link nuevo.
- **`color_spec` con formas inesperadas**: `colorPartsFromSpec` ya tolera Json
  arbitrario; si no parsea, se omite la sección de colores.
- **Costo del tercer fetch en el load del Kanban**: `order_production_tasks` es
  una tabla chica e indexada por `order_id`; va en el mismo `Promise.all`, no
  serializa la carga.
