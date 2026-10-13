# Números: pestaña Resumen (sin costos)

**Fecha:** 2026-10-13
**Estado:** Borrador para revisión del dueño. Sin código todavía.
**Rama:** `feature/numeros-resumen`, apilada sobre `feature/cobros-canal` (PR #27, sin mergear).
**Origen:** mockups "Resultados" y "Qué se vende y qué deja" del dueño, contrastados con
`docs/superpowers/specs/2026-10-09-estadisticas-rentabilidad-design.md` (en la rama de cobros).
Esta entrega es la **F2** de ese spec, ajustada a los mockups.

---

## 1. Alcance

**Entra:** una pestaña **Resumen** en `/admin/estadisticas` con período Semana / Mes / Año,
seis tarjetas y tres gráficos, todo calculado con datos que ya existen más los cobros de la F1.

**No entra** (queda para fases siguientes, sin cartel de "próximamente"):
gastos y "Cargar gasto" (F3), ganancia, margen y rentabilidad por producto (F4–F6),
mapa de productos (F7), reporte/PDF (F8), recomendaciones "Para mirar" (F9),
pestañas Productos, Clientes y Canales de los mockups.

## 2. Navegación

- Ítem del menú: **"Estadísticas" → "Números"** (`AdminLayout.tsx`). La ruta sigue siendo
  `/admin/estadisticas` para no romper enlaces ni tests.
- Pestañas dentro de la pantalla: `[ Resumen ] [ Caja y filamento ]`.
  - **Resumen** es la pestaña por defecto.
  - **Caja y filamento** es el contenido actual de `StatsPage.tsx`, sin cambios de
    comportamiento (pasa a un componente `CashTab`).
- Solo admin: sin cambios (`adminOnly` en el menú, `OperatorAdminOnly` en la ruta).

## 3. Período

Vive en la URL con `useSearchParams` (patrón de `IdeasPage.tsx` y `ToolsPage.tsx`):

```
/admin/estadisticas?tab=resumen&p=mes&d=2026-09
/admin/estadisticas?tab=resumen&p=semana&d=2026-10-05      (lunes de la semana)
/admin/estadisticas?tab=resumen&p=anio&d=2026
```

- `tab`: `resumen | caja`. Sin valor = `resumen`.
- `p`: `semana | mes | anio`. Sin valor = `mes`. En `caja` se conservan `hoy | rango` como hoy.
- `d`: ancla del período. Sin `d` = período en curso. Valor inválido = período en curso.
- Flechas ‹ ›: cambian solo `d` un período. No se puede avanzar más allá del período en curso.
- Leyenda "comparado con agosto" / "con la semana anterior" / "con 2025".
- Comparación: reusa `comparisonRange` de `stats.ts`. En el período en curso se compara contra
  el mismo tramo del anterior; en períodos cerrados, contra el anterior completo.
- `PeriodKind` en `stats.ts` suma `'year'`; `periodRange` y `previousRange` lo resuelven
  (1 de enero a 1 de enero). El selector de "Caja y filamento" no cambia.

## 4. Definiciones

| Cifra | Regla |
|---|---|
| **Vendido** | Suma de `orders.total_amount` de pedidos con `status <> 'cancelled'` y `created_at` en el período. Pedidos sin total suman 0 y se cuentan aparte ("N sin monto"). |
| **Pedidos / unidades** | Conteo de esos pedidos / suma de `order_items.quantity`. |
| **Cobrado** | Suma de lo que entró con fecha en el período: cobros de pedidos (`transactions` `type = '3d_service'`, `voided_at is null`, por `transacted_at`) + ventas directas de producto (`product_sale`) + ventas de filamento no anuladas. Una seña de un pedido cancelado cuenta (la plata entró). |
| **Por cobrar** | Foto **a hoy**, no del período: suma de `orders.pending_balance` > 0 de pedidos no cancelados dados de alta desde la fecha de corte (ver §7, D-A). |
| **Ticket promedio** | Vendido ÷ pedidos (de los que tienen monto). |
| **Entregados a tiempo** | Entre los pedidos cuyo evento de entrega (`production_events`, `kind = 'stage'`, `to_status = 'delivered'`, el último por pedido) cae en el período: % con fecha de entrega ≤ `due_date`. Excluye `flexible` y los que no tienen evento. Subtítulo: "N con atraso" y "sobre M con fecha real". Con M = 0 muestra "—". |
| **Clientes nuevos** | Clientes cuyo **primer** pedido (menor `created_at`, sin contar cancelados) cae en el período. Subtítulo: "de N en total" = clientes con al menos un pedido hasta el fin del período. |
| **Por canal** | `origin_channel`; `whatsapp` + `whatsapp_personal` se agrupan como "WhatsApp"; `null` = "Sin canal"; `local` = "Local"; `mercadolibre` = "Mercado Libre". |
| **Por medio** | `transactions.method` de lo cobrado; `null` = "Sin medio" (las señas migradas). Se ordena por monto. |

Comparación: `compare(curr, prev)` devuelve variación % en montos y conteos, puntos (pt) en
porcentajes y diferencia absoluta en "Clientes nuevos". Sin período anterior con datos
(prev = 0) devuelve `null` y no se muestra nada (nunca "∞ %").

## 5. Pantalla

### Tarjetas (6)

| Tarjeta | Valor | Subtítulo | Comparación |
|---|---|---|---|
| Vendido | $ | "47 pedidos · 112 unidades" | % |
| Cobrado | $ | "pedidos $X · directas $Y · filamento $Z" | % |
| Por cobrar | $ | "5 pedidos con saldo" | ninguna |
| Ticket promedio | $ | "por pedido" | % |
| Entregados a tiempo | % | "14 con atraso · sobre 49 con fecha real" | pt |
| Clientes nuevos | n | "de 39 en total" | ± n |

Cada tarjeta tiene un texto de ayuda con su regla (title/aria) para que Vendido, Cobrado y
Entregado no se confundan.

### Gráficos (SVG propio; no se agrega librería; con tabla alternativa accesible)

1. **Pedidos por semana**: 8 semanas lunes a domingo que terminan en la semana del final del
   período elegido. La última, si está en curso, más clara. Número sobre cada barra.
2. **De dónde vienen los pedidos**: barras horizontales por canal con cantidad y %.
3. **Cobrado por medio**: lista de barras (efectivo, transferencia, Mercado Pago, otros, sin medio).

Colores: azul `#2f5fd0` (ventas) y `#c2500e` (resto). El texto nunca va en color de serie.
Formato `es-AR` con `money()` de `filaments.ts`.

### Estados

- **Cargando / error:** igual que la pantalla actual (mensaje en español, sin pantalla en blanco).
- **Período vacío:** tarjetas en 0 y gráficos con "Sin datos en este período".
- **Septiembre 2026** (mes de migración): banner "Datos de la planilla, incompletos: 50 pedidos
  se cargaron juntos el 29/09" y **sin comparación** ni en ese mes ni en octubre (que lo tendría
  de base). Regla general: si el período contra el que se compararía empieza antes de
  `2026-09-30`, no se compara y se omite el porcentaje.

## 6. Estructura de código

Todo en `src/features/stats/`. Cálculos en funciones puras con Vitest antes de la UI.

| Archivo | Responsabilidad |
|---|---|
| `period.ts` | `parsePeriod(searchParams, now)`, `periodToParams`, `shiftPeriod(period, ±1)`, `periodLabel`, `compareLabel`, `isBeforeCutoff`. Usa `periodRange`/`comparisonRange` de `stats.ts`. |
| `summary.ts` | `sold`, `collected`, `receivable`, `ticketAverage`, `onTimeRate`, `newCustomers`, `ordersByWeek`, `byChannel`, `collectedByMethod`, `compare`. Sin acceso a la base. |
| `summary.api.ts` | `loadSummary(range, cmpRange, now)`: trae pedidos con ítems, cobros, ventas directas, ventas de filamento, primeros pedidos por cliente y eventos de entrega (reusa `deliveredMoments`). |
| `SummaryTab.tsx` | Tarjetas y composición. |
| `charts.tsx` | `WeeklyBars`, `ChannelBars`, `MethodBars` (SVG + tabla alternativa). |
| `CashTab.tsx` | Contenido actual de `StatsPage`, movido sin cambios de lógica. |
| `StatsPage.tsx` | Contenedor: pestañas y período en la URL. |

Cambios fuera de la carpeta: etiqueta del menú en `AdminLayout.tsx` (+ `AdminLayout.test.tsx`);
`PeriodKind` en `stats.ts` (+ tests).

**Carga de datos:** se consulta por rango y se agrega en el cliente (volumen ~50 pedidos/mes).
La foto de "Por cobrar" y los primeros pedidos por cliente leen todos los pedidos con columnas
mínimas (`id, customer_id, created_at, status, total_amount, pending_balance, flexible,
due_date, origin_channel`). No hay migraciones ni tablas nuevas.

## 7. Decisiones abiertas (con default)

| # | Decisión | Default | Si está mal |
|---|---|---|---|
| D-A | **Por cobrar** y los saldos viejos. La F1 no toca los saldos de pedidos anteriores a la migración (hay ~29 entregados con saldo > 0 sin confirmar si se cobraron) y el spec del 09/10 (D9) dejaba abierta qué hacer. | Por cobrar cuenta solo pedidos dados de alta desde `2026-09-30`. Debajo, una línea "N pedidos anteriores con saldo sin confirmar" que abre la lista. | Si todos esos saldos sí se deben, Por cobrar queda corto hasta que se registre cada cobro. |
| D-B | "Vendido" por alta del pedido (`created_at`), no por entrega. | Alta del pedido (spec F2). | "Entregado" sigue visible en Caja y filamento. |
| D-C | Fecha de corte de migración. | `2026-09-30` (constante única). | Se cambia en un lugar. |
| D-D | Semana de lunes a domingo, "mismo tramo" en el período en curso. | Como hoy. | — |

## 8. Pruebas

- `period.test.ts`: parseo y ancla inválida, flechas, tope en el período en curso, año
  bisiesto, lunes de semana, cambio de mes, período en la URL ida y vuelta.
- `summary.test.ts`: cada cifra con pedidos cancelados, sin total, con cobros anulados,
  seña de pedido cancelado, "a tiempo" con flexible / sin evento / re-entregado, cliente que
  pidió antes del período, canal nulo, WhatsApp agrupado, semanas vacías, `compare` con prev = 0.
- `StatsPage.test.tsx` / `SummaryTab` : pestaña por defecto, período desde la URL, banner de
  septiembre sin comparación, período vacío, error de carga.
- `AdminLayout.test.tsx`: etiqueta "Números".
- Verificación manual en el dev server con datos reales antes del PR.

## 9. Riesgos

- **Números engañosos por datos viejos** (septiembre, saldos): mitigado con corte, banner y
  la línea de saldos sin confirmar. Es el riesgo principal.
- **Confundir Vendido, Cobrado y Entregado:** textos de ayuda en cada tarjeta.
- **PR apilado:** depende del #27. Si el #27 cambia, hay que rebasar. Mergear en orden.
- **Canal sin cargar** en el 26 % de los pedidos viejos: se muestra como "Sin canal".
