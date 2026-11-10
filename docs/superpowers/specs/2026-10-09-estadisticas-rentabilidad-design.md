# Estadísticas y rentabilidad: qué se vende y qué deja

**Fecha:** 2026-10-09
**Estado:** Borrador para revisión del dueño. No hay código ni migraciones todavía.
**Base:** spec pegada por el dueño ("Sección Números"), contrastada con el repo
(`master` @ 7d5d777) y con la base `bukjmleercxlxbexekos` (solo `SELECT` de
conteos, sin datos personales).

La spec del dueño es el norte. Este documento dice qué ya tenemos, qué falta,
dónde la spec choca con lo que existe y en qué orden conviene construirlo.

---

## 1. Nombre y navegación

**Nombre: "Estadísticas".** Ya existe en el menú (`AdminLayout.tsx`, ítem
`/admin/estadisticas`, `adminOnly: true`) y en la ruta (`admin.route.tsx`,
envuelta en `OperatorAdminOnly`). No se crea una sección nueva: se amplía la
que hay con pestañas.

```
Estadísticas
  [ Resumen ]  [ Mapa ]  [ Reporte ]  [ Caja y filamento ]
  ‹  Octubre 2026  ›     Semana | Mes | Año     vs. septiembre (mismo tramo)
```

- **Resumen** (pestaña por defecto cuando esté lista): la spec, sección Resumen.
- **Mapa**: dispersión de productos y ranking por ganancia.
- **Reporte**: el resumen del mes para leer, bajar en PDF o mandar por WhatsApp.
- **Caja y filamento**: lo que hoy es toda la pantalla (`StatsPage.tsx`: ventas
  de filamento, efectivo y transferencias esperadas, entregados, salidas del
  estante por motivo y por persona, más vendidos). Se renombra porque, con la
  pestaña Resumen, "Ventas" pasaría a significar dos cosas distintas (ver §3a).
  Mientras Resumen no exista, esta es la única pestaña y se ve igual que hoy.

**Período en la URL.** Hoy el período vive en `useState` dentro de
`StatsPage` (`today | week | month | custom`). Pasa a la URL con
`useSearchParams` (patrón que ya usan `IdeasPage.tsx` y `ToolsPage.tsx`):

```
/admin/estadisticas?tab=resumen&p=mes&d=2026-10
/admin/estadisticas?tab=caja&p=semana&d=2026-10-06      (lunes de la semana)
/admin/estadisticas?tab=caja&p=rango&desde=2026-09-10&hasta=2026-10-09
```

- `p`: `dia | semana | mes | anio | rango`. Resumen, Mapa y Reporte usan
  `semana | mes | anio` (lo que pide la spec); "Caja y filamento" conserva
  `hoy` y `rango`, que son los que el dueño usa para cerrar caja.
- `d`: ancla del período. Las flechas ‹ › cambian solo `d`. Sin `d` = período
  en curso. El link se puede guardar o pasar y abre el mismo período.
- La lógica de períodos ya está en `stats.ts` (`periodRange`, `previousRange`,
  `comparisonRange` con "mismo tramo" para el período en curso, semana de lunes
  a domingo). Se extiende con `anio`, con el ancla `d` y con `shift(range, ±1)`
  para las flechas. Se reusa, no se reescribe.

**Solo admin.** Igual que hoy: oculto en el menú por `adminOnly` y la ruta
redirige con `OperatorAdminOnly`. Ningún dato de margen, costo ni ganancia se
muestra en pantallas de operadores (Entregados ya oculta montos a operadores).

---

## 2. Brechas de datos (spec §3 contra el repo y la base)

Conteos al 2026-10-09: 70 pedidos (50 cargados de golpe el 29/09 al migrar
desde la planilla, 20 cargados en la app), 72 ítems, 14 `transactions`
(todas `product_sale`), 3 `filament_sales`, 38 productos, 170 partes.

| Dependencia de la spec | Qué ya existe (tabla/columna/archivo) | Calidad real del dato | Qué falta | Cambio mínimo |
|---|---|---|---|---|
| **Cobros** con fecha, monto, medio y tipo (seña/saldo/total) | `orders.deposit` y `orders.pending_balance` (números sueltos, sin fecha). `orders.payment_method` existe. `transactions` tiene `order_id`, `amount`, `method`, `transacted_at` y el tipo `3d_service` sin usar. Medios en `domain-constants.ts`: `cash, transfer, uala, brubank, mercadopago, other`. | `payment_method`: **70 de 70 en null** (nadie lo carga). `deposit` > 0 en 32 pedidos, 0 en 23, null en 15. `transactions` con `order_id`: **0**. Hay 29 pedidos **entregados con saldo pendiente > 0**: el saldo no se pone en cero al cobrar, así que hoy no se sabe si se cobró. 1 pedido cancelado tiene seña. | Un registro por cobro, con fecha. | Usar `transactions` como libro de cobros: `type = '3d_service'` (etiqueta "Cobro de pedido") + `order_id` + columna nueva `payment_kind` (`deposit / balance / full`, CHECK). Alta solo por RPC `register_order_payment` (valida monto > 0, medio válido, pedido no cancelado; recalcula `orders.pending_balance`). Botón "Registrar cobro" en el pedido y "Cobrado" al pasar a Entregado. Backfill: una seña por cada `deposit > 0` con fecha = alta del pedido y nota "migrado"; el saldo de los entregados viejos, según decisión D9. `orders.payment_method` queda en desuso. |
| **Canal** del pedido | `orders.origin_channel` (CHECK) y `ORIGIN_CHANNEL` en `domain-constants.ts`: `whatsapp, whatsapp_personal, instagram, facebook, local, web, other`. Etiquetas en `ORIGIN_CHANNEL_LABELS`. Ya se muestra en Entregados (`deliveredOrders.ts`). | 18 de 70 sin canal (26 %). En los cargados en la app, **8 de 20 sin canal (40 %)**: en `orderDraft.ts` el canal arranca en `null` y no es obligatorio. Valores usados: whatsapp 33, instagram 11, other 4, local 2, whatsapp_personal 2. | Que se cargue siempre. Mercado Libre no está en la lista, aunque la calculadora ya tiene recargo ML (`calc_profiles.ml_surcharge`). | Canal obligatorio en el modal (con "Otro" a mano), agregar `mercadolibre` al CHECK y a las constantes. Mapeo de la spec: `store` = `local`; `whatsapp` agrupa `whatsapp` + `whatsapp_personal` en el gráfico. Sin backfill: los viejos quedan como "Sin canal" y se muestran así. |
| **Gastos** con categoría | Nada. `filament_movements` registra compras (`kind = 'purchase'`, 2 filas) **sin precio**. En avisos existe el sector "Compras y faltantes" (`notices.ts`), pero no hay lista de compras con "Llegó" ni se usa ese sector (0 avisos). | No hay datos de gastos. | Tabla de gastos y carga rápida. | Tabla `expenses` (fecha, monto, categoría, medio, nota, operador, `source` = `manual / filament_purchase`, `ref_id`, `voided_at` + motivo). Alta y anulación solo por RPC; nunca se borra. La compra de filamento (`PurchaseModal.tsx` → `move_filament(..., 'purchase')`) pide "¿cuánto pagaste?" y genera el gasto `filament` en la misma transacción. "Automático desde la lista de compras al marcar Llegó" queda para cuando exista esa lista; hoy el disparador real es la compra de filamento. |
| **Costo del producto** (ficha) | `products` (`base_price` cargado en los 38), `product_parts` (`label`, `color`, `quantity`; 96 de 170 con color). La fórmula de costo existe: `calculator.ts` → `quote()` (material, luz, desgaste, margen de error) con `calc_profiles`. `order_items.unit_price` y `line_total` existen. | `product_parts` **no tiene gramos**; `products` no tiene horas de impresión, de trabajo ni extras. **Los 72 ítems tienen `product_id` null y `unit_price` null**: el modal permite elegir del catálogo (`OrderModal.tsx`, presets) pero se escribe a mano. Hoy no se puede saber qué producto se vendió. | Gramos por parte, minutos de impresión y de trabajo, extras; vínculo ítem ↔ producto; precio por ítem; foto del costo. | `product_parts.grams`; `products.print_minutes`, `labor_minutes`, `extras_cost`, `calc_profile_id` (opcional, default el primero). Costo = `quote()` + trabajo. `order_items.unit_cost` (foto al crear) y `cost_source`. `unit_price` se completa desde `base_price` al elegir del catálogo; si el pedido trae solo total, se reparte (§5, F5). |
| **Precio de filamento** | Precio de **venta** de lista: `filament_lines.price` (14/14), `refill_price` (1/14), `filament_colors.price` (28/126), `colorPrice()` en `filaments.ts`. Costo por kg para producción: `calc_profiles.filament_price` (21.000 en ambos perfiles). | El costo de compra de un rollo no está en ningún lado. | Costo de compra por rollo (para margen de reventa) y costo por kg para producción. | El costo sale de la compra (gasto `filament`): `expenses.amount / cantidad` = costo unitario de esa compra, guardado en el movimiento (`filament_movements.unit_cost`). Para producción se sigue usando `calc_profiles.filament_price`, con un aviso si se aleja más de 15 % del costo de la última compra. |
| **Fecha de entrega real** | `production_events` con `kind = 'stage'`, `to_status = 'delivered'` (lo registra el trigger `log_order_stage_event`). `stats.api.ts` → `deliveredMoments()` ya lo usa. `orders.flexible` = "sin apuro" (`orderFlow.ts`). | 34 pedidos entregados, solo 17 tienen evento (los demás se entregaron antes del 29/09). "Sin apuro": 6 de 70. | Nada para los pedidos nuevos. | Ninguno. "A tiempo" se calcula solo sobre entregados con evento y sin `flexible`; los viejos se muestran como "sin fecha real". No se agrega `delivered_at` en `orders`: el evento ya es la fuente. |
| **Clientes nuevos** | `customers.created_at`. | 51 creados en septiembre, casi todos el día de la migración. | Nada. | "Nuevo" = el primer pedido del cliente cae en el período. Septiembre 2026 se marca como "mes de migración" y no se compara. |
| **Fechas comerciales** (recomendaciones) | `idea_collections.target_date`. | 1 colección, sin fecha. | Nada. | Ninguno. |
| **Ventas directas** de producto | `transactions` `product_sale` (`productSales.api.ts`), 4 de 14 con `product_id`. | `method` cargado en 13 de 14. | Costo. | Si tiene `product_id`, toma el costo de la ficha al registrar (misma columna de foto). |

---

## 3. Conflictos con el repo y con decisiones ya tomadas

### a) Qué es "venta"

Hoy `Estadísticas` (y Entregados) cuenta un pedido como venta **el día que se
entregó** (`toDeliveredRows`: fecha del evento, o `due_date` si no hay). Así lo
aprobó el dueño el 2026-10-08 (`2026-10-08-control-filamentos-design.md`,
entrega 2). La spec dice "Ventas = pedidos **creados** en el período".

Las dos miden cosas distintas y las dos sirven:

| Cifra | Fecha que manda | Dónde |
|---|---|---|
| **Vendido** (spec) | alta del pedido (`orders.created_at`) | Resumen, Mapa, Reporte |
| **Cobrado** (spec) | fecha de cada cobro | Resumen, Reporte, Caja |
| **Entregado** (hoy) | evento de entrega | Caja y filamento, Entregados |

Propuesta: se respetan los tres nombres y nunca se usa "Ventas" a secas. La
pestaña actual pasa a llamarse "Caja y filamento" y su tarjeta "Pedidos
entregados" queda igual. Cancelados: fuera de "Vendido"; si tenían seña cobrada,
la seña sigue en "Cobrado" (es plata que entró) salvo que se registre la
devolución como cobro negativo (decisión D10).

Problema de datos: 50 pedidos tienen alta el 29/09 por la migración. Con la
regla de la spec, septiembre muestra un pico falso. Se agrega una fecha de
corte (`2026-09-30`): antes de esa fecha no hay comparación y Resumen muestra
"datos de la planilla, incompletos".

### b) Filamento: ingreso y costo que la spec no tiene

La spec solo ve pedidos. Pero el taller también vende rollos (`filament_sales`,
precio de lista puesto por la base en `sell_filament`, cobro `cash`/`transfer`
al MP del dueño, anulación con motivo) y compra rollos (`move_filament`
`purchase`). Encaje:

- **Ingresos** = cobros de pedidos + ventas directas de producto (`transactions`
  `product_sale`) + ventas de filamento no anuladas. Resumen muestra el total y
  el desglose por fuente.
- **Gastos** = `expenses`, donde la compra de filamento entra como categoría
  `filament`.
- **Margen de reventa de filamento** = precio de lista − costo de la última
  compra de ese color/línea, por rollo. Se muestra en "Caja y filamento", no en
  el Mapa de productos (el Mapa es de productos impresos).
- El filamento que se usa para producir **no** se suma como gasto otra vez: ya
  está adentro del costo de cada producto. Gasto de caja (lo que se pagó) y
  costo de lo vendido (lo que consumió cada producto) son dos vistas distintas,
  y la pantalla dice cuál es cuál.

### c) Costo unitario: reusar `calc_profiles` en lugar de un `CostSettings` nuevo

`calculator.ts` ya tiene una interfaz llamada `CostSettings` (precio del
filamento, kWh, watts, vida útil, repuestos, % error, recargo ML) que se llena
desde `calc_profiles` (2 perfiles: P1S y A1 local). La spec propone otro
`CostSettings` con `laborPerHour`, `machinePerHour`, `targetMargin`,
`mapUnitsCut`, `mapMarginCut`.

- **Hora de máquina**: no hace falta cargarla. Sale de `calc_profiles`:
  luz (`watts/1000 × kwh_price`) + desgaste (`spare_parts_cost /
  machine_life_hours`). Con los valores actuales: 14 + 50 = **$64 por hora**,
  más el 5 % de margen de error. Se muestra calculada y no se edita a mano.
- **Material**: `grams/1000 × filament_price` del perfil, igual que la
  calculadora. Una sola fórmula para la Calculadora y para la ficha: se
  extrae `quote()` sin cambiar su resultado y la ficha la llama.
- **Lo que sí es nuevo** (no es de una impresora, es del negocio): valor hora de
  trabajo, margen objetivo y cortes del mapa. Va en una tabla de una sola fila,
  `business_settings`, que solo edita el admin por RPC. No se mete en
  `calc_profiles` porque esa tabla es por impresora.
- Para no chocar con el nombre existente, el tipo nuevo se llama
  `BusinessSettings`.

### d) El plan anterior "Gastos y rentabilidad" queda absorbido

Lo que el dueño ya había aceptado y dónde cae ahora:

| Del plan anterior | Dónde queda |
|---|---|
| Carga de gastos | F3 (tabla `expenses`, carga rápida, solo admin) |
| Costo en las compras de filamento | F3 (la compra pide el monto y crea el gasto) |
| Margen por rollo | F3, pestaña "Caja y filamento" |
| Rotación de filamento (días de stock por color) | F3, misma pestaña: salidas de los últimos 30 días contra stock actual |
| Merma | F3. Merma = rollos perdidos en ajustes negativos de conteo (`kind = 'count'`, entrega 3 de filamentos) + fallas de impresión (`register_task_failure`, `production_events`) valorizadas con el costo |

No queda nada del plan anterior afuera.

---

## 4. Decisiones del dueño (con default; no frenan el trabajo)

| # | Decisión | Default que propongo | Qué pasa si el default está mal |
|---|---|---|---|
| D1 | Valor de la hora de trabajo | $0 hasta que la cargues; las fichas muestran "sin trabajo" | Los márgenes se ven más altos de lo real. Se corrige cambiando un número; las fotos de costo viejas no cambian (§5 F5). |
| D2 | Valor de la hora de máquina | Calculado desde `calc_profiles` (hoy $64/h + 5 %) | Si te parece bajo, cambiá vida útil o repuestos en la Calculadora; arregla las dos pantallas juntas. |
| D3 | Margen objetivo | 55 % (el de la spec) | Solo cambian colores y el precio sugerido. Barato de corregir. |
| D4 | Cortes del mapa | 15 unidades por mes (proporcional para semana y año) y el margen objetivo | Un producto cae en otra zona. Se cambia en ajustes. |
| D5 | Quién carga gastos | Solo vos (admin). Las compras de filamento las puede registrar cualquiera, pero el monto lo pone el admin | Si cargan otros y se equivocan, se anula con motivo; no se borra. |
| D6 | ¿Sueldos y alquiler cuentan? | Sí, como categorías `wages` y `rent`, fuera del margen por producto. El Resumen muestra "Resultado del mes" = cobrado − todos los gastos | Si no querés mostrarlos, se ocultan de un tilde. Sin ellos el resultado mensual engaña. |
| D7 | PDF en navegador o servidor | Navegador, con `jspdf` (ya está en el proyecto, `filaments/pdf.ts`) | Si después querés mandarlo solo por Telegram o mail, se agrega server. Nada se tira. |
| D8 | Comisiones de MP y ML | Por ahora, porcentaje fijo por medio/canal en `business_settings` (MP 0 % por defecto, ML desde `calc_profiles.ml_surcharge`), descontado como gasto calculado, no cargado | Si el % está mal, la ganancia de ML se ve mal. La conciliación con la API de MP sigue fuera de alcance (decisión del 2026-10-08). |
| D9 | Saldo de los entregados viejos (29 pedidos) | Se asume "cobrado el saldo el día de la entrega" (o el `due_date` si no hay evento), marcado como `migrado` | Si alguno no se cobró, "Por cobrar" queda bajo. Se puede revisar la lista una vez. |
| D10 | Seña de un pedido cancelado | Queda como cobrada (no se devolvió) salvo que registres la devolución | Si se devolvió y no se carga, "Cobrado" queda alto. |
| D11 | Mercado Libre como canal | Se agrega `mercadolibre` | Ninguno si no se usa. |
| D12 | Pedidos con varios ítems y un solo total | Reparto proporcional al `base_price` de cada producto; si no hay, en partes iguales | La ganancia por producto se reparte distinto que en la realidad. Se evita cargando el precio por ítem. |

---

## 5. Plan por fases (un PR por fase)

Reglas para todas las fases:

- Rama nueva desde `master` por fase. Solo admin en UI (`adminOnly` +
  `OperatorAdminOnly`).
- **Plata y fotos de costo se escriben solo por RPC** `security definer` con
  `search_path = ''`, siguiendo `sell_filament` / `void_filament_sale`: la RPC
  valida que `p_operator` sea admin activo cuando corresponde, deja registro y
  nunca borra (anula con motivo). Las tablas nuevas tienen RLS con lectura para
  autenticados y **sin** insert/update/delete directo (grants revocados).
- No usar `is_admin()` para lo nuevo: depende de `profiles`, que tiene 0 filas,
  así que no identifica al admin del taller. El rol vive en `operators.role` y
  se valida en la RPC. (Mismo nivel de seguridad que eligió el dueño el
  2026-10-08: ocultar por rol en la UI y blindar lo que escribe plata.)
- Cálculos en funciones puras (`src/features/stats/*.ts`) con tests de Vitest
  antes de la UI, como `stats.ts` / `stats.test.ts`. Volumen bajo (~50
  pedidos/mes): se consulta por rango y se agrega en el cliente; no hacen falta
  vistas materializadas.
- Formato `es-AR` (ya está `money()` en `filaments.ts`); gráficos en SVG propio
  (no hay librería de gráficos; no se agrega ninguna), con tabla alternativa,
  un solo eje Y, series #2f5fd0 (ventas) y #c2500e (costo/gastos), texto nunca
  en color de serie.

### F1. Cobros y canal (M)

- **Objetivo:** que cada peso cobrado tenga fecha y medio, y que cada pedido
  tenga canal. Es el dato que más tarda en juntarse, por eso va primero.
- **Datos:** `transactions.payment_kind` (CHECK `deposit/balance/full`, null para
  ventas de producto); RPC `register_order_payment(p_order, p_amount, p_method,
  p_kind, p_operator, p_at)` y `void_order_payment` (admin, con motivo). Grants:
  `transactions` deja de aceptar insert directo de `3d_service`. CHECK de
  `origin_channel` + `mercadolibre`. Backfill de señas (y de saldos según D9),
  todo con nota `migrado`.
- **Funciones puras + tests:** `paymentsOf(order, txs)`, `balanceDue(total,
  payments)` (pago mayor al total → saldo 0 y aviso "pagó de más"),
  `paymentKindFor(total, alreadyPaid, amount)`.
- **UI:** en el pedido, bloque "Cobros" con lista y "Registrar cobro"
  (monto, medio, fecha = hoy). Al pasar a Entregado con saldo, pregunta "¿Cobraste
  el saldo?". Canal obligatorio en el modal de alta. Los operadores pueden
  registrar cobros (cobran en el local) pero no ven totales del período.
- **Riesgos:** frenar la carga rápida (memoria: prioridad del admin). El cobro
  tiene que ser 2 toques. Doble registro si se cobra en la seña del modal y
  además con el botón: la seña del modal pasa a crear el cobro por la RPC.

### F2. Pestañas, período en la URL y Resumen sin costos (M)

- **Objetivo:** primer valor visible: cuánto vendí, cuánto cobré, cuánto me
  deben, de dónde vienen los pedidos.
- **Datos:** ninguno nuevo.
- **Funciones puras + tests:** `parsePeriod(searchParams)` / `periodToParams`,
  `shiftPeriod`, rango `anio`; `sold(orders, range)` (no cancelados, alta en el
  rango), `collected(payments, filamentSales, productSales, range)`,
  `receivable(orders, payments, today)`, `ticketAverage`, `newCustomers`,
  `onTimeRate(orders, deliveredMoments)` (excluye `flexible` y sin evento),
  `ordersByWeek(orders, 8)`, `byChannel`, `compare(curr, prev)` (variación % en
  montos, puntos en porcentajes). Casos borde: período vacío, semana lunes a
  domingo, corte de migración.
- **UI:** contenedor de pestañas en `StatsPage` (la pantalla actual pasa a
  `CashTab` sin cambios de comportamiento). Resumen con: Vendido, Cobrado, Por
  cobrar, Pedidos + unidades, Ticket promedio, Entregados a tiempo, Clientes
  nuevos; pedidos por semana (8); por canal. Los indicadores de costo dicen
  "llega con la ficha de costo".
- **Riesgos:** confundir Vendido/Cobrado/Entregado → textos de ayuda en cada
  tarjeta. Septiembre distorsionado → corte de migración.

### F3. Gastos, compras de filamento y rentabilidad del filamento (M)

- **Objetivo:** saber cuánto salió y cuánto deja el filamento. Absorbe el plan
  "Gastos y rentabilidad".
- **Datos:** `expenses` (§2) con categorías `filament, supplies, power,
  shipping, parts, store, wages, rent, fees, other`; RPC `add_expense`,
  `void_expense` (admin). `filament_movements.unit_cost`; `move_filament` para
  `purchase` pasa por una RPC `purchase_filament(p_color, p_refill, p_qty,
  p_total, p_operator)` que crea el movimiento y el gasto juntos.
- **Funciones puras + tests:** `expensesByCategory`, `cashResult(collected,
  expenses)`, `spoolMargin(listPrice, lastCost)`, `rotationDays(stock,
  outLast30)`, `shrinkage(countAdjusts, failures, unitCost)`.
- **UI:** "Cargar gasto" (monto, categoría en chips, medio, fecha; 3 toques) en
  "Caja y filamento"; lista con anulación. `PurchaseModal` pide el total
  pagado. Resumen suma Gastos y Resultado del período.
- **Riesgos:** gastos que no se cargan = resultado inflado. Recordatorio
  mensual en avisos (opcional). Doble conteo de filamento (§3b): el gasto de
  compra va a caja, nunca al costo de producto.

### F4. Ficha de costo y ajustes del negocio (M)

- **Objetivo:** cada producto del catálogo sabe cuánto cuesta hacerlo.
- **Datos:** `product_parts.grams`; `products.print_minutes`, `labor_minutes`,
  `extras_cost`, `calc_profile_id`; `business_settings` (una fila:
  `labor_per_hour`, `target_margin`, `map_units_cut`, `map_margin_cut`,
  `fee_pct` por medio/canal). Escritura de `business_settings` por RPC admin.
- **Funciones puras + tests:** extraer de `quote()` una `productionCost(profile,
  {grams, minutes})` (los tests de `calculator.test.ts` siguen verdes sin
  cambios), `unitCost(product, parts, profile, settings)` con desglose
  (material, máquina, trabajo, extras, error), `suggestedPrice(cost, margin)`
  redondeado a la centena, `missingCost(product)`.
- **UI:** en el formulario de producto (`ProductForm.tsx`, ya admin), sección
  "Costo" con gramos por parte, tiempos y extras, y el costo/margen contra
  `base_price` en vivo. Pantalla de ajustes del negocio (dentro de
  Estadísticas). Botón "Traer de la Calculadora" para no tipear dos veces.
- **Riesgos:** cargar 38 fichas lleva tiempo; el Resumen muestra el % de ventas
  sin costo y se puede empezar por los 10 que más salen. `products_write` usa
  `is_admin()`: verificar al implementar que el admin puede guardar (§5 reglas).

### F5. Ítems vinculados al producto y foto del costo (M)

- **Objetivo:** que cada ítem vendido sepa qué producto es, a qué precio y cuánto
  costó ese día.
- **Datos:** `order_items.unit_cost`, `cost_source` (`catalog / manual / none`),
  `costed_at`. La foto se toma por RPC o trigger al crear el ítem (y al cambiar
  de producto), nunca desde el cliente. `transactions` (venta de producto)
  recibe la misma foto. `unit_price`/`line_total` se completan.
- **Funciones puras + tests:** `allocateOrderTotal(total, items)` (D12),
  `itemCost(item)`, `costCoverage(items)` (> 10 % sin costo → aviso).
- **UI:** en el modal de pedido, el buscador de producto sugiere el catálogo
  primero (ya existe el preset); precio por ítem opcional, prellenado desde
  `base_price`. Producto a medida = ítem sin producto: costo manual opcional
  ("¿cuánto te costó?") o "sin costo cargado".
- **Riesgos:** hoy 0 de 72 ítems tienen producto. Si la gente sigue escribiendo
  a mano, el Mapa queda vacío. Hacer que elegir del catálogo sea más rápido que
  tipear (autocompletar con Enter). Los pedidos viejos quedan "sin costo".

### F6. Resumen con ganancia y margen (S)

- **Objetivo:** "cuánto me quedó" y qué productos dejan más plata.
- **Datos:** ninguno nuevo.
- **Funciones puras + tests:** `profitByProduct(items, range)` (unidades,
  vendido, costo, ganancia, margen), `profitPerOrder`, `marginBand(margin,
  target)` (verde ≥ objetivo, ámbar entre objetivo − 10 pt y objetivo, rojo
  abajo).
- **UI:** tarjeta Ganancia por pedido; tabla "Lo que más deja" con barra de
  margen y % escrito; aviso de ítems sin costo excluidos del margen.
- **Riesgos:** margen engañoso con pocos ítems con costo → mostrar "n ítems con
  costo de N".

### F7. Mapa (M)

- **Objetivo:** ver de un vistazo estrellas, revisar precio, nicho y repensar.
- **Funciones puras + tests:** `mapPoints(profitByProduct)`, `zoneOf(point,
  cuts)` (bordes exactos incluidos en la zona de arriba/derecha), escalado de
  tamaño por ventas, `costBreakdown(product)`.
- **UI:** dispersión SVG (X unidades, Y margen %, tamaño = vendido), líneas de
  corte, tooltip, panel lateral con precio promedio, costo, desglose, precio
  sugerido; ranking por ganancia como alternativa en tabla. En celular, la tabla
  primero.
- **Riesgos:** pocos productos con costo al principio = mapa pobre. Mostrar el
  mapa solo con 3 o más productos con costo; si no, la tabla.

### F8. Reporte, PDF y WhatsApp (M)

- **Objetivo:** el resumen del mes en una hoja para leer o compartir.
- **Funciones puras + tests:** `headline(summary, prev)` (frase armada),
  `top3(by)` (más vendido, más ganancia, clientes — clientes por cantidad de
  pedidos y monto, sin teléfonos), `salesCalendar(orders, month)`,
  `reportText(summary)` para WhatsApp.
- **UI:** pestaña Reporte; "Descargar PDF" con `jspdf` en el navegador (igual que
  `filaments/pdf.ts`); "Enviar por WhatsApp" = link `wa.me` con el texto, sin
  número cargado (lo elige el dueño en su WhatsApp). El reporte no incluye
  teléfonos ni datos de contacto de clientes.
- **Riesgos:** el PDF incluye nombres de clientes en el top 3; opción de
  ocultarlos antes de compartir.

### F9. Recomendaciones (S)

- **Objetivo:** hasta 3 cosas para hacer el mes que viene.
- **Funciones puras + tests:** `recommendations(summary, settings, ideas, today)`
  con las reglas de la spec en orden (margen bajo, estrella, atrasos < 80 % a
  tiempo, fecha comercial en 30 días desde `idea_collections.target_date`, sin
  costo > 10 %, cobros pendientes > 20 %) y corte en 3. Una prueba por regla y
  una por el orden.
- **UI:** bloque en Resumen y en Reporte.
- **Riesgos:** recomendaciones obvias o repetidas; cada una con el número que
  la dispara a la vista.

### Orden y por qué

F1 primero porque los cobros con fecha no se pueden reconstruir hacia atrás:
cada semana sin registrar es una semana perdida. F2 da valor ese mismo día con
lo que ya hay. F3 cierra la caja y el filamento (el plan que el dueño ya había
aceptado). F4 y F5 son el prerrequisito del margen; recién ahí F6–F9. F2, F3 y
F4 son independientes entre sí después de F1 y se pueden hacer en paralelo.

---

## 6. Indicadores recomendados

| Indicador | Definición corta | Fase |
|---|---|---|
| **Plata** | | |
| Vendido | Total de pedidos no cancelados dados de alta en el período + ventas directas + filamento | F2 |
| Cobrado (por medio) | Cobros con fecha en el período, por efectivo/transferencia/MP/otros | F2 (con datos desde F1) |
| Por cobrar | Total − cobros de pedidos abiertos y entregados, a hoy | F2 |
| Ticket promedio | Vendido en pedidos ÷ pedidos | F2 |
| Gastos por categoría | Suma de `expenses` no anulados | F3 |
| Resultado del período | Cobrado − gastos | F3 |
| Ganancia y margen | Vendido con costo − costo; ÷ vendido con costo | F6 |
| Ganancia por pedido | Ganancia ÷ pedidos con costo | F6 |
| **Productividad y clientes** | | |
| Pedidos y unidades | Conteo de pedidos y suma de cantidades | F2 |
| Entregados a tiempo | Entregados con evento ≤ fecha prometida, sin "sin apuro" | F2 |
| Pedidos por semana (8) y por canal | | F2 |
| Clientes nuevos y recurrentes | Primer pedido en el período / más de un pedido (hoy 7 recurrentes) | F2 |
| Cobertura de costo | % de ítems con costo cargado | F5 |
| Zonas del mapa | Productos estrella, revisar precio, nicho, repensar | F7 |
| **Filamento** | | |
| Margen por rollo | Precio de lista − costo de última compra | F3 |
| Rotación | Días de stock por color con las salidas de los últimos 30 días | F3 |
| Merma | Rollos perdidos en conteos + fallas de impresión, en pesos | F3 |
| Ventas de filamento, efectivo y transferencia esperados | (ya existe) | hoy |
