# Control de filamentos: ventas, salidas, estadísticas, conteo y resumen diario

**Fecha:** 2026-10-08
**Estado:** Aprobado en chat; pendiente de revisión escrita del dueño

## Problema

Los empleados cobran ventas de filamento en efectivo o por transferencia al MP
del dueño. Hoy una venta no tiene registro propio: se carga como "usado" o como
"ajuste" (63 ajustes en la primera semana de octubre), o no se carga. No queda
precio, forma de cobro ni motivo de la salida. Un rollo vendido y no avisado es
ganancia perdida que se descubre días después, si es que se descubre.

El dueño quiere saber qué salió del estante, por qué, quién lo sacó, y cuándo
(día y hora), y que los montos y el control solo los vea él.

## Decisiones tomadas con el dueño

| Tema | Decisión |
|---|---|
| Cobro | Mixto: los empleados cobran en efectivo o por transferencia al MP del dueño. |
| Precio de venta | Siempre el de lista. Sin descuentos (si algún día se agregan, con PIN de admin). |
| PIN por venta | No. Queda a nombre de la persona activa. El dueño cambia su PIN (pantalla Personas, lo hace él) y su perfil no se abre en otras PCs. |
| Pantallas de control | Personas, Estadísticas y Actividad: solo admin, ocultas por rol en el menú y en la ruta. |
| Entregados | Visible para todos, pero sin montos ni totales para operadores. |
| Motivos de salida | Venta, a producción, a la otra sede, uso personal, ajuste. |
| Stock | Un solo estante: el stock es "rollos cerrados en el estante". Todo lo que sale se descuenta. |
| Conteo | Semanal, a ciegas, lo puede hacer cualquiera; las diferencias las ve y aprueba el dueño. |
| Avisos | Resumen diario por Telegram (no aviso por cada venta). |
| Orden | 1 Movimientos → 2 Estadísticas → 3 Conteo → 4 Telegram. Cada entrega es un PR. |

## Alcance de seguridad (explícito)

Todos comparten una sesión de Supabase ("cuenta del taller"); el perfil activo
se elige con PIN en el cliente. Ocultar pantallas por rol frena el uso normal,
no a alguien que abra la consola del navegador y consulte la API. El dueño
eligió este nivel. Lo que **sí** se blinda en la base, porque no cuesta fricción:

- El stock solo cambia por funciones que dejan registro. **Hoy no es así**: la
  política `filament_colors_all` y el grant de tabla permiten `update` directo
  de `stock`/`stock_refill`. Se cambia a grants por columna (insert/update de
  todo menos `stock` y `stock_refill`) y las funciones que mueven stock pasan a
  `security definer` con `search_path = ''`. El alta de un color nuevo deja de
  mandar `stock: 0` (usa el default).
- Las ventas no se borran ni se editan: solo se anulan, con motivo, y la
  anulación queda en el registro.
- El precio de una venta lo pone la base desde la lista, no el cliente.

Si más adelante hace falta candado real de lectura, se agrega una RPC de lectura
que exija PIN de admin, sin rehacer nada.

## No-objetivos

- Stock por sede.
- Descuentos.
- Aviso de Telegram por cada venta (solo resumen diario).
- Conciliación automática con la API de Mercado Pago (el resumen da las cifras
  para cruzar a mano).
- Cambios a la venta de insumos vieja (`transactions.supplies_sale`/`inventory`),
  que quedó en desuso.

---

## Entrega 1: Movimientos de filamento

### Datos

Nuevos tipos de movimiento en `filament_movements.kind` y `filament_log.kind`:

| kind | Etiqueta | Signo |
|---|---|---|
| `purchase` | Compra | + (solo admin) |
| `used` | A producción (antes "se terminó") | − |
| `sale` | Venta | − |
| `transfer` | A la otra sede | − |
| `personal` | Uso personal | − |
| `adjust` | Ajuste | ± (motivo obligatorio) |
| `sale_void` | Venta anulada | + (solo admin) |
| `count` | Ajuste por conteo (entrega 3) | ± |

Se agrega `kind` a los checks; los existentes no cambian de valor.

Tabla nueva `filament_sales` (una fila por venta):

- `id`, `created_at`
- `operator_id` → `operators` (on delete set null)
- `color_id` → `filament_colors` (on delete set null)
- `line_label`, `color_label` text: nombres guardados como texto, igual que
  `filament_log`, para que se lean aunque se borre el color.
- `refill` boolean
- `quantity` integer > 0
- `unit_price` numeric(12,2) not null: precio de lista al momento de la venta
- `total` numeric(12,2) generado (`quantity * unit_price`)
- `payment` text check in (`cash`, `transfer`)
- `customer` text null
- `voided_at`, `voided_by` → `operators`, `void_reason` text: anulación

RLS: `select` e `insert` para `authenticated`; sin `update`/`delete` por API.
La anulación es por RPC.

### Funciones (RPC)

- `take_filament(p_color, p_refill, p_qty, p_kind, p_operator, p_note)`:
  saca `p_qty` (> 0) con `p_kind` en (`used`, `transfer`, `personal`).
  **Falla si no hay stock suficiente** (hoy `move_filament` se clava en 0 en
  silencio). `personal` exige nota. Reusa `move_filament` para el registro.
- `sell_filament(p_color, p_refill, p_qty, p_payment, p_operator, p_customer)`:
  calcula el precio de lista (`color.price`, si no `line.refill_price` para
  recarga o `line.price` para spool); si no hay precio cargado, falla con
  "Este filamento no tiene precio de lista". Verifica stock, descuenta con
  `kind = 'sale'` e inserta en `filament_sales`, todo en una transacción.
  La nota del log lleva cantidad, forma de cobro y total.
- `void_filament_sale(p_sale, p_operator, p_reason)`: exige que `p_operator`
  sea admin activo y motivo no vacío; marca la venta y devuelve el stock con
  `kind = 'sale_void'`. Una venta ya anulada no se anula de nuevo.
- `move_filament` sigue para compras y ajustes. Los ajustes desde la app pasan
  a exigir nota (validación en el cliente y en una función envoltorio
  `adjust_filament` que rechaza nota vacía).

### Pantalla Filamentos

- El botón "−" de cada color se reemplaza por **"Sacar"**, que abre una hoja
  con el motivo (Venta / A producción / A la otra sede / Uso personal), la
  cantidad (default 1) y spool o recarga si la línea es `both`.
  - Venta: muestra el precio de lista y el total (no editables), elige
    efectivo o transferencia MP, cliente opcional.
  - Uso personal: nota obligatoria.
- "+" y la edición de stock en el `LineDrawer` (ajustes) y "Compra"
  (`PurchaseModal`): **solo admin**. Ajustes con motivo obligatorio.
- Pestaña "Actividad": solo admin.
- El toast confirma qué salió y por qué ("Venta · 1 × PLA Rojo · $12.000 efectivo").

### Entregados

`DeliveredOrdersList`: para operadores (`!isAdmin`) se ocultan montos por fila,
totales por mes y el total general. Siguen viendo qué, a quién y cuándo.

### Menú

Personas (ya), Productos y stock (ya), Estadísticas y Conteo-revisión
(entregas 2 y 3) con `adminOnly`. Las rutas admin-only redirigen a `/admin/hoy`
si el perfil activo no es admin (hoy solo se ocultan del menú).

### Pruebas

- Integración (DB): venta descuenta y crea fila con el precio de lista; venta
  sin stock falla sin dejar nada; anulación por no-admin falla; doble
  anulación falla; `take_filament` sin stock falla; `personal` sin nota falla.
- Unidad/UI: hoja "Sacar" (validaciones por motivo), Entregados sin montos para
  operador, rutas admin-only redirigen.

---

## Entrega 2: Estadísticas (solo admin)

Ruta `/admin/estadisticas`. Selector de período: hoy, semana, mes, rango libre,
con comparación contra el período anterior equivalente.

- **Ventas de filamento**: tabla con día, hora, persona, línea/color, cantidad,
  precio, total, forma de cobro, cliente; anuladas tachadas. Totales: efectivo
  esperado, transferencia esperada, unidades.
- **Productos entregados**: pedidos entregados (`orders.total_amount`) y ventas
  directas (`transactions` `product_sale`), cantidad y monto. La fecha de un
  pedido entregado sigue la convención actual de Entregados (`due_date`).
- **Salidas por motivo y por persona**: a producción, a la otra sede, uso
  personal, ajustes (cantidad de ajustes y neto).
- **Más vendidos** por color y por línea.

Se calcula en el cliente a partir de consultas por rango (volumen bajo: ~50
pedidos/mes). Funciones puras de agregación con tests de unidad.

## Entrega 3: Conteo de stock

- Tablas `stock_counts` (quién, inicio, fin, aprobado por/cuándo) y
  `stock_count_items` (color, refill, contado, esperado al momento de cerrar).
- Pantalla **Conteo** (todos): lista de colores con un campo "cuántos hay",
  **sin mostrar el stock del sistema**. Al cerrar se guarda el esperado.
- Revisión (solo admin): diferencias por color, quién contó y cuándo. Aprobar
  genera ajustes `kind = 'count'` solo en las filas con diferencia.
- Aviso "hace N días que no se cuenta" si pasan más de 7 días.

## Entrega 4: Resumen diario por Telegram

- Edge function `daily-summary` (service role) que arma el texto del día:
  ventas (unidades, efectivo esperado, transferencias esperadas), anuladas,
  salidas por motivo y persona, ajustes, colores bajo el mínimo, días desde el
  último conteo, entregados del día.
- `pg_cron` la llama todos los días a las 21:00 de Argentina (00:00 UTC).
- Secretos `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` en Supabase. **El dueño
  crea el bot con BotFather y carga el token él mismo**; Claude guía los pasos y
  nunca maneja el token.
- Si el envío falla, queda en los logs de la función; no reintenta en loop.
