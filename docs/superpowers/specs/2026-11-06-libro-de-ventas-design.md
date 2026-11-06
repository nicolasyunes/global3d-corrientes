# Libro de ventas — diseño

Fecha: 2026-11-06 · Estado: aprobado en chat, pendiente de revisión escrita

## Problema

Hoy "venta realizada" sale de dos lugares y ninguno es un registro propio:

- **Pedidos entregados:** "Entregados y ventas" (`/admin/ventas-pedidos`) lee `orders` con `status = 'delivered'` y muestra `total_amount` tal como está *ahora*. Si se edita el total después, cambia una venta pasada. Al entregar no se registra nada.
- **Ventas de mostrador:** "Agregar venta" (`ProductSaleSheet`) inserta una fila en `transactions` con `type = 'product_sale'`, de a un producto por vez. No guarda precio de lista, descuento, canal ni quién vendió (`operator_id` es null en las 52 filas). No hay forma de corregirla ni anularla: solo "Deshacer" durante 5 s para texto libre, y borrando. El total se lee con `Number()`, así que "13.200" se guardaría como $13,20.
- **Canales:** solo `orders.origin_channel` tiene canal. "Mayorista" no existe.

Consecuencia: un descuento de mostrador lleva a tocar el precio de lista del producto, y una venta mal cargada no se puede arreglar.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Modelo | Libro único `sales` + `sale_items` + `sale_log` (opción B del análisis) |
| Ticket | Varios productos por venta, con descuento general opcional |
| Mayorista | Tipo de cliente (`customers.wholesale`), solo etiqueta y filtro; sin lista de precios propia |
| Corregir / anular | Solo un operador admin con su PIN; anular pide motivo y no borra |
| Cargar | Cualquier operador con PIN |
| Filamento | Fuera de esta etapa; sigue en `filament_sales` |
| Monto de un pedido | El `total_amount` del pedido al momento de entregarse |
| Cobros de pedidos | Sin cambios (`transactions` tipo `3d_service`, `register_order_payment`) |

## Datos

### Tablas nuevas

**`sales`** — una fila por venta.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `sold_at` | timestamptz | default `now()`; para pedidos, el momento de la entrega |
| `channel` | text null | mismos valores que `orders.origin_channel` (check); mostrador = `local`; null = sin canal (datos viejos) |
| `customer_id` | uuid null → `customers` | |
| `order_id` | uuid null → `orders`, **unique** | null en ventas de mostrador |
| `method` | text null | mismos valores que `PAYMENT_METHOD` (check) |
| `list_total` | numeric not null | suma de `quantity × list_unit_price` de las líneas |
| `discount` | numeric not null default 0 | descuento general en $ (el % se convierte en la pantalla) |
| `amount` | numeric not null | lo cobrado: suma de líneas cobradas − `discount`; `>= 0` |
| `operator_id` | uuid null → `operators` | quién vendió |
| `note` | text null | |
| `source_tx_id` | uuid null unique | id de la `transactions` de origen (solo copia inicial) |
| `voided_at`, `voided_by`, `void_reason` | | anulación; `voided_by` → `operators` |
| `created_at`, `updated_at` | timestamptz | |

**`sale_items`** — una fila por línea del ticket.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `sale_id` | uuid → `sales` on delete cascade | |
| `position` | int | orden en el ticket |
| `product_id` | uuid null → `products` | null = texto libre |
| `description` | text not null | nombre del producto al momento, o el texto libre |
| `quantity` | int not null `> 0` | |
| `list_unit_price` | numeric not null | precio de lista al momento |
| `unit_price` | numeric not null | precio cobrado por unidad |

**`sale_log`** — historial.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `sale_id` | uuid → `sales` | |
| `operator_id` | uuid null → `operators` | |
| `kind` | text | `created`, `edited`, `voided`, `restored` |
| `reason` | text null | obligatorio en `voided` |
| `before`, `after` | jsonb null | foto de la venta y sus líneas |
| `created_at` | timestamptz | |

**`customers.wholesale boolean not null default false`.**

### Funciones (security definer, mismo patrón que `register_order_payment` / `void_order_payment`)

- `create_sale(p jsonb, p_operator uuid) returns uuid` — valida operador activo, líneas y montos; inserta venta y líneas; descuenta stock de cada línea con `product_id` (con `app.stock_kind` para que quede en `product_log`); escribe `sale_log` `created`.
- `edit_sale(p_sale uuid, p jsonb, p_operator uuid)` — solo operador `role = 'admin'`; no aplica a ventas con `order_id` ni anuladas; reemplaza líneas; ajusta stock por la diferencia por producto; escribe `edited` con antes/después.
- `void_sale(p_sale uuid, p_operator uuid, p_reason text)` — solo admin; motivo no vacío; completa `voided_*`; si es de mostrador devuelve stock; escribe `voided`.
- `record_order_sale(p_order uuid, p_operator uuid)` — usada por el trigger de entrega (abajo).

Grants: `execute` a `authenticated`, revocado a `public`/`anon`.

### Trigger de entrega

`after update of status on orders` cuando `new.status = 'delivered'` y `old.status <> 'delivered'` → `record_order_sale(new.id, null)`. El cambio de estado hoy no lleva operador (`log_order_stage_event` tampoco lo guarda), así que la venta de un pedido queda con `operator_id` null:

- Si no existe venta para el pedido: la crea con `sold_at = now()`, `channel = origin_channel`, `customer_id`, `method = payment_method`, `amount = list_total = total_amount` (0 si es null), líneas desde `order_items` (descripción, cantidad, `unit_price`); si no hay ítems, una línea con el título del pedido. Escribe `created`.
- Si ya existe (re-entrega): actualiza fecha, monto y líneas con los valores actuales del pedido; si estaba anulada la reactiva (`restored`). Escribe `edited`/`restored`.
- **Las ventas de pedidos no mueven stock** (igual que hoy).
- Volver un pedido atrás desde Entregado no toca la venta; si el pedido se cancela, un admin la anula.

### Seguridad (RLS)

- `sales`, `sale_items`, `sale_log`: `select` para `authenticated`; sin `insert`/`update`/`delete` directos. Todo pasa por las funciones.
- `customers.wholesale` se edita con la política actual de `customers`.

## Pantallas

### Ventas (`/admin/ventas`, en el menú; `/admin/ventas-pedidos` redirige)

- Lista con filtros: período (hoy / semana / mes / rango), canal, medio de pago, mayorista, quién vendió; interruptor "mostrar anuladas" (tachadas, no suman).
- Fila: hora, resumen ("Vaso Boca ×2 + 1 más"), canal, cliente, cobrado, descuento si hubo, medio, quién. Las de pedido muestran "Pedido #N" y abren el pedido.
- Encabezado con totales del filtro: cobrado, cantidad de ventas, descuentos.

### Nueva venta (hoja/modal, prioridad: carga rápida)

1. Buscador por palabras (`matchesQuery`, rama `fix/productos-busqueda-precio`) o texto libre; Enter agrega la línea con precio de lista.
2. Por línea: cantidad y precio unitario editable.
3. Descuento general opcional en $ o %; resumen "Lista · Descuento · Cobrás" en vivo.
4. Medio de pago con botones grandes; canal por defecto `local`; cliente opcional con buscador.
5. Guardar → `create_sale`; operador = el del PIN activo.

Montos con `parseMoney` (formato argentino: "13.200" = 13200, "13.200,50" = 13200.5).

### Detalle de venta

Líneas, totales e historial (`sale_log`). Botones **Corregir** (abre la misma hoja prellenada → `edit_sale`) y **Anular** (motivo → `void_sale`). Igual que los cobros de pedidos, se habilitan cuando la persona activa (elegida con su PIN) es admin; si no, se ve "Solo un admin puede corregir o anular" y la base lo rechaza igual. En ventas de pedido, Corregir no está; se ofrece abrir el pedido.

### Otros

- Pedidos: al pasar a Entregado, aviso "Venta registrada: $X"; el detalle del pedido enlaza a su venta.
- Clientes: casilla "Mayorista".
- Se retira "Agregar venta" de la pantalla vieja y `ProductSaleSheet` (reemplazado por Nueva venta).

## Copia de datos existentes (en la migración, idempotente)

- Las 52 `transactions` `product_sale` → `sales` con una línea cada una: fecha, monto, medio, cliente, producto/cantidad o `note` como descripción; `list_total = amount`, `discount = 0`, `channel = 'local'`, `operator_id = null`, `source_tx_id = transactions.id`. No se toca stock. `on conflict (source_tx_id) do nothing`.
- Pedidos con `status = 'delivered'` → una venta cada uno con `total_amount` actual, `sold_at` = último evento `production_events` `kind = 'stage'`, `to_status = 'delivered'` (o `due_date` a las 12:00 de Argentina si no hay, igual que hoy calcula Estadísticas), `channel = origin_channel` (null si no tiene). `on conflict (order_id) do nothing`.
- Las filas viejas de `transactions` no se borran.

## Estadísticas

`stats.api.ts` / `stats.ts` pasan a leer `sales` con `voided_at is null` en lugar de pedidos entregados + `product_sale`. Antes de mergear se comparan los totales mensuales viejos y nuevos: deben coincidir; si no, se frena y se explica la diferencia. Se agregan cortes por canal y mayorista.

## Salida a producción

1. Rama `feature/libro-ventas` desde `master`.
2. Migración escrita y probada; antes de aplicarla en producción se muestra qué crea y cuántas filas copia, y se aplica con OK del usuario.
3. Pantallas, PR, merge. La migración solo agrega: el admin viejo sigue andando hasta el merge (lo único que cambia antes es que el trigger empieza a crear ventas).
4. Plan de vuelta atrás: el trigger de entrega se puede deshabilitar sin perder datos.

## Pruebas

- **Base:** una venta por pedido aunque se entregue dos veces; stock baja al crear, se ajusta al corregir y vuelve al anular; no admin no puede corregir ni anular; anular sin motivo falla; todo queda en `sale_log`; la copia inicial no duplica si se corre dos veces.
- **Código:** cálculo del ticket (líneas, descuento $ y %, redondeo a peso), `parseMoney`, filtros y totales de la lista.
- **Navegador** (el usuario pone el PIN): cargar un ticket, corregirlo, anularlo, entregar un pedido.

## Fuera de alcance

Filamento en el libro, lista de precios mayorista, cambios en cobros de pedidos, alinear la política `products_write` de producción con el repo (se anota como pendiente aparte).

## Dependencias

La búsqueda por palabras (`src/lib/search.ts`) está en `fix/productos-busqueda-precio`, sin mergear. Ese PR se mergea antes, o esta rama lo incorpora.
