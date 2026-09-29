# Fase 1 — App interna de taller: limpieza, login, rediseño y piezas por ítem

**Fecha:** 2026-09-29
**Estado:** Borrador para revisión del dueño
**Referencia visual:** [docs/previews/idea-a-panel.html](../../previews/idea-a-panel.html) (Idea A elegida)

## Problema

La planilla "Pedidos - Nueva" y la app actual no resuelven los tres dolores
principales del taller (3 personas + ayudante, 7 impresoras entre casa y local,
~50 pedidos/mes):

1. **Reimpresiones**: no queda registrado qué piezas ya están hechas ni cuántas.
2. **"No sé qué falta"**: el checklist es por pedido y sí/no; no dice color,
   cantidad ni a qué vaso de un pedido de 3 vasos corresponde.
3. **"¿Qué imprimo ahora?"**: no hay vista que junte lo pendiente de todos los
   pedidos.

Además, la app mezcla una tienda pública (storefront) que ya no se quiere, el
login es por enlace mágico (el equipo quiere usuario + contraseña), y el estilo
visual no es el deseado.

## Decisiones tomadas con el dueño

| Tema | Decisión |
|---|---|
| Alcance de la app | Sólo interna: producción de taller y toma de pedidos. Se elimina todo lo de consumidor final. |
| Acceso | Login de la Idea B: **una cuenta del taller** (usuario + contraseña, se abre una vez por dispositivo) + **"¿Quién está en el taller?"**: cada persona elige su perfil e ingresa un PIN de 4 dígitos. |
| Estilo | Idea A "Panel de gestión": sidebar carbón, fondo crema, tarjetas redondeadas, paleta Global3D. |
| Vista de pedidos | Dos vistas intercambiables: **Lista** (Idea A) y **Tablero** por columnas (Idea B, con colores claros de A). |
| Colores de piezas | Texto libre (no se atan al stock de filamento). |
| Lotes (33 llaveros) | Alcanza con contador `hechas/total` por pieza; no se rastrea cada nombre. |
| Reventa (insumos/impresoras) | Se oculta; etapa posterior. |

## No-objetivos (Fase 2+)

- Plantillas de producto con piezas que se autogeneran.
- Estados "En diseño" / "Esperando aprobación".
- Nuevos canales (WhatsApp personal vs. negocio, local, web).
- Ítems que salen de stock de producto terminado; sugerencias "imprimir para stock".
- Asignar pieza a una persona / bandeja "Mis tareas" de post-proceso.
- Modo offline / PWA, notificaciones.
- Cambios a la sincronización con Google Sheets (sigue igual, a nivel pedido).

## Diseño

### 1. Limpieza: fuera el storefront

**Se elimina** `src/features/storefront/**` (Home, Categoría, Producto, Carrito,
Checkout, CartContext, ToastContext, data/products.ts, filter, pricing,
subcategories, CSS) y `src/lib/whatsapp.ts` (sólo lo usa el storefront).

**Router** ([router.tsx](../../../src/app/router.tsx)):
- Se quitan las rutas públicas. `/` → `<Navigate to="/admin" />`.
- `/admin` (índice) → `/admin/hoy`.
- Se mantiene el prefijo `/admin/*` y el lazy load para no tocar URLs existentes.

**Dependencias rotas que se resuelven:**
- `ProductForm.tsx` importa `CASH_DISCOUNT` de `storefront/pricing` → se mueve la
  constante a `src/features/products/` o se elimina el campo derivado.
- `catalog-taxonomy.test.ts` y `scripts/import-catalog.mjs` leen
  `storefront/data/products.ts` → el catálogo ya está importado a la base; se
  borran el script, el comando `import:catalog` y ese test.
- Productos: se **mantiene** la tabla y la pantalla (sirven como catálogo interno
  y stock terminado). Se ocultan del formulario los campos que sólo usaba la
  tienda (`slug`, `compare_at_price`, categoría/subcategoría, galería pública).
  **Sin migración destructiva**: las columnas quedan en la base.

**Navegación:** "Ventas de insumos" y "Stock de insumos" salen del menú (las
rutas y el código quedan, para la etapa de reventa).

### 2. Login: cuenta del taller + "¿Quién está en el taller?"

Dos capas, como en la maqueta de la Idea B:

**Capa 1 — cuenta del taller (Supabase Auth).**
- Una sola cuenta Supabase "Taller" (email + contraseña), creada a mano por el
  dueño en el panel de Supabase con rol `admin` en `profiles`. Sin registro
  público.
- `LoginPage` pasa de `signInWithOtp` a `supabase.auth.signInWithPassword`
  (campos Usuario/Email + Contraseña). La sesión persiste en el dispositivo; sólo
  se vuelve a pedir si se cierra sesión.
- RLS no cambia: todo sigue `to authenticated`.

**Capa 2 — persona activa (operadores con PIN).**

```sql
create extension if not exists pgcrypto;

create table public.operators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initials text not null,
  color text not null default '#F37021',
  role text not null default 'operator' check (role in ('admin', 'operator')),
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- pin_hash nunca sale de la base:
revoke select (pin_hash) on public.operators from anon, authenticated;
```

- RPC `verify_operator_pin(p_operator uuid, p_pin text) returns boolean`
  (`security definer`, compara con `crypt()`).
- RPC `set_operator_pin(p_operator uuid, p_pin text)` y
  `create_operator(name, initials, color, role, pin)` — sólo desde la pantalla
  **Personas** (visible para operadores `admin`).
- **Primer uso**: si no hay operadores, la app pide crear el primero (el dueño,
  rol admin) antes de continuar.
- Pantalla **"¿Quién está en el taller?"**: avatares grandes + teclado numérico
  de PIN. El operador elegido se guarda en `localStorage` del dispositivo.
- **Cambiar de persona**: tocando el avatar del sidebar/encabezado. Bloqueo
  automático opcional tras 30 min sin uso (vuelve a pedir PIN, no la contraseña).
- Pantallas de admin (Productos, Personas) se muestran según `operators.role`
  del operador activo.
- **Alcance de seguridad (explícito)**: el PIN identifica a la persona para el
  historial y protege pantallas de admin en la UI; no es una barrera contra
  alguien con la contraseña del taller. Adecuado para un equipo chico de
  confianza.

### 3. Rediseño visual (Idea A)

**Tokens** ([tokens.css](../../../src/styles/tokens.css)) — se agregan, sin romper
los existentes:
- Fondo de app `--color-bg: #F8F5F0` (crema cálido); superficies blancas.
- Radios `--radius-card: 16px`, `--radius-control: 12px`, `--radius-pill: 999px`.
- Sombra `--shadow-card: 0 1px 2px rgba(29,29,27,.04), 0 8px 24px rgba(29,29,27,.06)`.
- Tipografía: **Manrope** (Google Fonts, 500–800) para toda la app.
- Estados: se agrega violeta de post-proceso `#6B3E8E` / fondo `#EFE7F6`.

**Shell nuevo** (`AdminLayout` reescrito):
- Escritorio (≥ 900px): sidebar carbón de 240px con wordmark, secciones con
  contadores (Hoy · ¿Qué imprimo? · Pedidos · Ventas de pedidos · Productos) y
  bloque de usuario abajo.
- Celular: barra inferior (Hoy · Imprimir · Pedidos · Más) + botón flotante
  naranja "+" = pedido rápido.
- Encabezado de página: eyebrow numerado ("01 · Martes 29 de septiembre") + título.

**Componentes compartidos** (`src/components/ui/`): `KpiCard`, `ProgressBar`,
`Badge` (reusa colores de `StatusBadge`), `PieceRow`, `Toast`, `PageHeader`.

**Animaciones** (150–450ms, respetan `prefers-reduced-motion`): entrada de
tarjetas, llenado de barras de progreso, toast de confirmación, pulso en pieza
"imprimiendo".

**Pantallas que se rediseñan en Fase 1:** Login, Hoy (nueva), ¿Qué imprimo?
(nueva), Pedidos (lista + Kanban), Pedido-producción, Pedido-edición/Nuevo
pedido, Pedido rápido. El resto (Ventas de pedidos, Productos) toma el shell y
los tokens nuevos sin rediseño propio.

**DESIGN.md y PRODUCT.md** se actualizan: equipo de 3 + ayudante (no un solo
operador), app sólo interna, Manrope, nueva paleta de superficies.

### 4. Piezas por ítem (modelo de datos)

Se evoluciona `order_production_tasks` (cada fila = una **pieza**) en una
migración aditiva:

```sql
alter table public.order_production_tasks
  add column order_item_id uuid references public.order_items (id) on delete cascade,
  add column color text,
  add column quantity_total integer not null default 1 check (quantity_total > 0),
  add column quantity_done integer not null default 0,
  add column status text not null default 'pending'
    check (status in ('pending', 'printing', 'done')),
  add column updated_by uuid references public.operators (id),
  add constraint tasks_done_lte_total check (quantity_done between 0 and quantity_total);

-- Backfill desde el booleano actual, luego se retira.
update public.order_production_tasks
  set status = case when done then 'done' else 'pending' end,
      quantity_done = case when done then 1 else 0 end;
alter table public.order_production_tasks drop column done;

create index order_production_tasks_item_idx on public.order_production_tasks (order_item_id);
create index order_production_tasks_status_idx on public.order_production_tasks (status);
```

- `order_item_id` **nulo** = pieza del pedido en general (pedidos de un solo
  producto que no usan `order_items`, que hoy son la mayoría).
- `location` (casa/local) se conserva.

**Reglas (trigger `before update`)**, para que la base sea la fuente de verdad:
- `quantity_done` llega a `quantity_total` → `status = 'done'`.
- `quantity_done` entre 1 y total−1 → `status = 'printing'`.
- `status` se marca `done` a mano → `quantity_done = quantity_total`.
- `status` vuelve a `pending` → `quantity_done = 0`.
- `updated_by` lo manda la app en cada escritura con el operador activo (todos
  comparten `auth.uid()`, así que la persona viene del operador, no de la sesión).

**Historial** — tabla nueva `production_events` (escrita por trigger
`after insert/update/delete` en tareas, nunca por la app):

```sql
create table public.production_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  task_id uuid references public.order_production_tasks (id) on delete set null,
  operator_id uuid references public.operators (id),  -- copiado de tasks.updated_by
  kind text not null check (kind in ('created', 'status', 'count', 'failed', 'deleted')),
  label text not null,          -- copia del nombre de la pieza al momento
  from_status text, to_status text,
  delta integer,
  created_at timestamptz not null default now()
);
```

- "Falla" = RPC `register_task_failure(task_id, operator_id)` que sólo inserta un evento
  `failed` (no cambia el contador; la pieza sigue pendiente).
- RLS: `select`/`insert` para `authenticated`, como el resto del árbol de pedidos.

**Estado del pedido**: sigue siendo el enum manual actual (el botón "Avanzar").
Único automatismo nuevo: cuando la primera pieza pasa a `printing` y el pedido
está en `new`/`in_queue`, el pedido pasa a `printing` (trigger). Cuando todas
las piezas están `done`, la pantalla de producción **resalta** "Avanzar a
Post-procesado / Terminado" (no avanza solo: el post-proceso lo decide la
persona).

**Estado del ítem** (no se guarda, se calcula en cliente): sin piezas → sin
indicador; todas `done` → Listo; alguna ≠ `pending` → Imprimiendo; si no → Sin
empezar. Resumen del pedido: "N de M ítems listos".

### 5. Pantallas

**Hoy** (`/admin/hoy`, nueva, página inicial):
- 4 KPIs: Atrasados · Vencen hoy/mañana · En producción (+ piezas en cola) ·
  Listos para avisar (+ suma de saldos).
- Lista "Pedidos por fecha" (pestañas Urgentes / Todos / Listos) con barra de
  avance = Σ`quantity_done` / Σ`quantity_total` de sus piezas.
- Panel "¿Qué imprimo ahora?" con las primeras ~8 piezas pendientes.

**¿Qué imprimo?** (`/admin/imprimir`, nueva):
- Todas las piezas `status ≠ done` de pedidos no entregados ni cancelados.
- Agrupadas por **color normalizado** (`trim` + minúsculas + sin tildes;
  sin color → grupo "Sin color"), grupos ordenados por la fecha más urgente.
- Dentro del grupo: por `due_date`. Cada fila: pieza, faltan N, #pedido · ítem,
  vencimiento, botón **+1** (y +N con mantener apretado o un selector).
- Filtro por color (chips) y por ubicación (casa/local).
- Datos: una consulta `order_production_tasks` + `orders(due_date,status,customers(name))`
  + `order_items(description,position)`.

**Pedido — producción** (`/admin/orders/:id`, se rehace según la maqueta):
- Encabezado: #pedido · cliente · canal, título, vencimiento, "Editar datos".
- Línea de etapas (Nuevo → Imprimiendo → Post-proceso → Terminado → Entregado)
  con el botón "Avanzar".
- **Ítems** (o un grupo implícito "El pedido" si no hay `order_items`): cada uno
  con su badge calculado y sus piezas (`PieceRow`):
  - cuadrado de estado que avanza Falta → Imprimiendo → Lista con un toque;
  - punto de color + nombre + color en texto;
  - contador `hechas/total` con +1 cuando `quantity_total > 1`;
  - quién/cuándo (último evento);
  - "Falla" y "Quitar" en un menú de la fila.
- Alta rápida por ítem: "¿Qué falta?" + color (texto libre con sugerencias de
  los colores ya usados) + cantidad (default 1) → Enter.
- Referencias (fotos, link) y observaciones como hoy.
- Panel **Actividad**: últimos eventos de `production_events` con nombre de la
  persona.
- Saldo al entregar: sólo cuando el pedido está Terminado (regla actual).

**Pedidos** (`/admin/orders`) — selector **Lista | Tablero** arriba a la derecha,
recordado por dispositivo (`localStorage`):
- **Lista** (Idea A): filas con ícono, cliente · #pedido · badge de etapa, barra
  de avance por piezas y vencimiento con color de urgencia; pestañas Urgentes /
  Todos / Listos.
- **Tablero** (Idea B, reemplaza al Kanban actual): columnas Nuevo ·
  Imprimiendo · Post-proceso · Listo para avisar (Entregado y Cancelado
  colapsados al final). Tarjeta: título, cliente + resumen de piezas, barra
  segmentada de avance, vencimiento (rojo atrasado / naranja hoy-mañana) e
  iniciales del último operador que lo tocó. Botón "Avanzar" en la tarjeta
  (sin drag-and-drop en Fase 1). En celular las columnas se deslizan de a una.

## Flujo de datos

| Acción | Escritura | Efectos en base |
|---|---|---|
| Tocar el estado de una pieza | `update tasks set status` | trigger ajusta contador, `updated_by`, evento `status`; puede pasar el pedido a `printing` |
| +1 | `update tasks set quantity_done = quantity_done + 1` (RPC `increment_task(id, n)` para evitar carreras entre dos celulares) | trigger ajusta estado + evento `count` |
| Falla | RPC `register_task_failure(id)` | evento `failed` |
| Agregar pieza | `insert tasks` | evento `created` |

## Plan de tests

- **Migración** (integración con `supabase db reset`, patrón de
  `rls.integration.test.ts`): backfill `done → status`; reglas del trigger
  (llegar al total ⇒ done; volver a pending ⇒ 0); `increment_task` no supera el
  total; eventos con `profile_id` correcto; RLS niega `anon`.
- **Unit**: `normalizeColor`, agrupación de "¿Qué imprimo?", estado derivado del
  ítem, avance del pedido, conversión usuario → email.
- **Componentes**: `PieceRow` (ciclo de estados, +1, toast), `Hoy` (KPIs desde
  fixtures), `OrderProduction` (ítems + grupo implícito), `LoginPage`
  (usuario/contraseña, error de credenciales).
- **Ruteo**: `/` → `/admin/hoy`; rutas del storefront ya no existen.
- **Manual en navegador** (escritorio + celular): cargar el pedido de 3 vasos y
  el Vaso Spiderman de la maqueta, avanzar piezas como dos operadores distintos
  (cambiando de persona con PIN) y ver el historial.
- **Operadores**: PIN correcto/incorrecto, `pin_hash` no legible desde el
  cliente, pantallas de admin ocultas para `operator`.

## Riesgos

- **Pedidos existentes con checklist**: el backfill los conserva como piezas
  generales del pedido, con cantidad 1.
- **Dos personas tocando la misma pieza**: el contador va por RPC atómica; el
  estado "último gana" es aceptable a esta escala.
- **Contraseña del taller compartida**: si se filtra, se cambia desde el panel
  de Supabase y se vuelve a ingresar en cada dispositivo; los PIN no cambian.
- **Deploy en Vercel**: al quitar la tienda, la URL raíz lleva al login; si
  alguien comparte el link de la tienda, deja de funcionar (esperado).

## Orden de implementación sugerido

1. Limpieza del storefront + router (sin cambios visuales).
2. Tokens + shell nuevo + login con contraseña + operadores con PIN.
3. Migración de piezas + eventos + RPCs, con tests.
4. Pantalla de producción del pedido con ítems y piezas.
5. ¿Qué imprimo? y Hoy.
6. Restyle de lista/Kanban/formularios; actualizar DESIGN.md y PRODUCT.md.
