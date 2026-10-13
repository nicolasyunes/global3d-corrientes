# Estadísticas — F1: Cobros y canal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada peso cobrado de un pedido quede registrado con fecha, medio, tipo (seña / saldo / pago total) y quién lo cargó, y que cada pedido nuevo tenga canal (incluyendo Mercado Libre). Es la base de datos para las pestañas de Estadísticas (Cobrado, Por cobrar, canales).

**Architecture:** `transactions` (tipo `3d_service`, hoy sin usar) pasa a ser el libro de cobros de pedidos. Solo se escribe por dos funciones de Postgres (`register_order_payment`, `void_order_payment`) que mantienen `orders.deposit` / `orders.pending_balance` sincronizados (el libro es la fuente; esas columnas son el resumen). Los cobros nunca se borran: se anulan con motivo (solo admin). La seña del modal de alta pasa por la misma función. En la UI, el bloque "Saldo" del pedido gana un formulario con medio de pago y una lista de cobros; el modal pide canal (obligatorio al crear) y medio de la seña.

**Tech Stack:** React 18 + TypeScript + Vite, Vitest + Testing Library, Supabase (Postgres RPC).

**Spec:** `docs/superpowers/specs/2026-10-09-estadisticas-rentabilidad-design.md` (fase F1; está en la rama `worktree-agent-ab2b74dc941c69b95`, commit 800f294) y la spec del dueño "Números" §3 y §11 paso 1.

## Global Constraints

- Proyecto Supabase: `bukjmleercxlxbexekos` (base **real**). Migraciones: prueba en seco con `DO ... raise exception 'DRYRUN_OK'` en una sola llamada `execute_sql`; **aplicar pide confirmación del dueño en el chat** y lo hace el controlador, no el implementador.
- Funciones SQL: `security definer`, `set search_path = ''`, `revoke ... from public, anon`, `grant ... to authenticated`. Mensajes de error en español rioplatense (se muestran en pantalla). Nunca se borra un cobro: se anula con motivo.
- Node: el PATH del sistema tiene Node 16 (rompe vitest). Siempre `export PATH="/c/Users/nyunes/AppData/Local/nvm/v20.19.0:$PATH"` antes de `npx`/`npm`. Correr tests con `npx vitest run --dir src` (hay copias del repo en `.claude/worktrees/` que ensucian la corrida).
- `vi.mock` con constantes de nivel superior: usar `vi.hoisted`.
- Copy de la UI en español rioplatense. Montos con `formatMoney` de `src/features/orders/format.ts`. Medios de pago: `PAYMENT_METHOD` / `PAYMENT_METHOD_LABELS` de `src/lib/domain-constants.ts` (cash, transfer, uala, brubank, mercadopago, other).
- **Carga rápida es prioridad** (memoria del dueño): registrar un cobro tiene que ser 2 toques (monto o "Todo el saldo" + medio + Guardar). El canal obligatorio es solo al **crear** un pedido (editar uno viejo sin canal no se bloquea).
- Seguridad (nivel acordado): ocultar por rol en la UI; lo que escribe plata va por RPC. Registrar un cobro lo puede hacer cualquier persona activa (cobran en el local); **anular** exige admin activo en la base y botón solo para admin en la UI.
- Rulings ya tomados para esta fase (del diseño, con default): D9 NO se aplica en esta fase (los 29 entregados viejos con saldo no se tocan; se le consulta al dueño aparte); D10 la seña de un pedido cancelado queda como cobrada; D11 Mercado Libre se agrega como canal.
- No commitear: `.claude/launch.json`, `.atl/*`, `prompt-taller-3d.md`, `test-output.txt`, `*.xlsx`.
- Comentarios en inglés, breves (SQL en español). Commits terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20261009180000_order_payments.sql` (crear) | Columnas del libro, políticas, canal `mercadolibre`, backfill de señas, RPC |
| `src/lib/database.types.ts` (modificar) | Columnas nuevas de `transactions` y RPC nuevas |
| `src/lib/domain-constants.ts` (modificar) | Canal `mercadolibre` |
| `src/features/orders/payments.ts` (crear) | Lógica pura de cobros |
| `src/features/orders/payments.test.ts` (crear) | Tests de unidad |
| `src/features/orders/orderDraft.ts` (modificar) | `depositMethod`, validación al crear |
| `src/features/orders/orderDraft.test.ts` (modificar) | Tests de la validación |
| `src/features/orders/payments.api.ts` (crear) | Llamadas a la base de cobros |
| `src/features/orders/payments.api.test.ts` (crear) | Tests de las llamadas |
| `src/features/orders/orderSave.api.ts` (modificar) | La seña se registra como cobro |
| `src/features/orders/orderSave.api.test.ts` (modificar) | Tests |
| `src/features/orders/OrderModal.tsx` (modificar) | Medio de la seña, canal obligatorio, seña de solo lectura al editar |
| `src/features/orders/OrderModal.test.tsx` (modificar) | Tests |
| `src/features/orders/OrderSummary.tsx` (modificar) | Formulario con medio, lista de cobros, anular |
| `src/features/orders/OrderPayments.tsx` (crear) | Lista de cobros del pedido (con anulación para admin) |
| `src/features/orders/OrderProduction.tsx` (modificar) | Conecta `onPay` a la RPC |
| `src/features/orders/OrderProduction.test.tsx` (modificar) | Tests |

---

### Task 1: Migración — libro de cobros, canal y funciones

**Files:**
- Create: `supabase/migrations/20261009180000_order_payments.sql`
- Modify: `src/lib/database.types.ts`

**Interfaces:**
- Produces (base):
  - columnas en `public.transactions`: `payment_kind text` (`deposit|balance|full`, solo para `type = '3d_service'`), `operator_id uuid`, `voided_at timestamptz`, `voided_by uuid`, `void_reason text`.
  - `register_order_payment(p_order uuid, p_amount numeric, p_method text, p_operator uuid, p_note text default null) returns public.transactions`
  - `void_order_payment(p_tx uuid, p_operator uuid, p_reason text) returns public.transactions`
  - `orders_origin_channel_check` incluye `'mercadolibre'`.
- Produces (TS): esas columnas en `Tables['transactions']` (Row/Insert/Update) y las dos funciones en `Functions`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Estadísticas F1: cada cobro de un pedido queda registrado con fecha, medio,
-- tipo y quién lo cargó. transactions (type '3d_service') es el libro; las
-- columnas orders.deposit / pending_balance son el resumen y las mantienen las
-- funciones de abajo. Los cobros no se borran: se anulan con motivo.

-- ---------------------------------------------------------------------------
-- Libro de cobros
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column payment_kind text,
  add column operator_id uuid references public.operators (id) on delete set null,
  add column voided_at timestamptz,
  add column voided_by uuid references public.operators (id) on delete set null,
  add column void_reason text,
  add constraint transactions_payment_kind_check
    check (payment_kind is null or payment_kind in ('deposit', 'balance', 'full')),
  add constraint transactions_payment_kind_type_check
    check (payment_kind is null or type = '3d_service'),
  add constraint transactions_void_check
    check ((voided_at is null) = (void_reason is null));

-- Los cobros de pedidos solo se escriben por las funciones de abajo (corren
-- como dueño de la tabla y no pasan por estas políticas). Las ventas de
-- producto e insumos siguen igual.
drop policy transactions_all on public.transactions;
create policy transactions_read
  on public.transactions for select to authenticated using (true);
create policy transactions_insert
  on public.transactions for insert to authenticated
  with check (type <> '3d_service');
create policy transactions_update
  on public.transactions for update to authenticated
  using (type <> '3d_service') with check (type <> '3d_service');
create policy transactions_delete
  on public.transactions for delete to authenticated
  using (type <> '3d_service');

-- ---------------------------------------------------------------------------
-- Canal: se suma Mercado Libre
-- ---------------------------------------------------------------------------
alter table public.orders drop constraint orders_origin_channel_check;
alter table public.orders add constraint orders_origin_channel_check
  check (origin_channel in ('whatsapp', 'whatsapp_personal', 'instagram',
                            'facebook', 'local', 'web', 'mercadolibre', 'other'));

-- ---------------------------------------------------------------------------
-- Señas ya cargadas: una fila por pedido, con la fecha de alta y nota "migrado".
-- El medio no se conoce. Los saldos de pedidos viejos NO se tocan.
-- ---------------------------------------------------------------------------
insert into public.transactions
  (type, order_id, customer_id, amount, method, note, transacted_at, payment_kind)
select '3d_service', o.id, o.customer_id, o.deposit, null, 'migrado', o.created_at,
       case when o.total_amount is not null and o.deposit >= o.total_amount
            then 'full' else 'deposit' end
from public.orders o
where coalesce(o.deposit, 0) > 0;

-- ---------------------------------------------------------------------------
-- Registrar un cobro
-- ---------------------------------------------------------------------------
create or replace function public.register_order_payment(
  p_order uuid,
  p_amount numeric,
  p_method text,
  p_operator uuid,
  p_note text default null
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_paid numeric(12, 2);
  v_due numeric(12, 2);
  v_kind text;
  v_tx public.transactions;
  v_label text;
begin
  if not exists (
    select 1 from public.operators where id = p_operator and active
  ) then
    raise exception 'No se reconoce a la persona que cobra';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Escribí el monto que pagó';
  end if;
  if p_method is null
     or p_method not in ('cash', 'transfer', 'uala', 'brubank', 'mercadopago', 'other') then
    raise exception 'Elegí cómo pagó';
  end if;

  select * into v_order from public.orders where id = p_order for update;
  if not found then
    raise exception 'No se encontró el pedido';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'El pedido está cancelado';
  end if;
  if v_order.total_amount is null then
    raise exception 'Cargá primero el total del pedido';
  end if;

  v_paid := coalesce(v_order.deposit, 0);
  v_due := v_order.total_amount - v_paid;
  if p_amount > v_due then
    raise exception 'El cobro supera el saldo (queda %)', public.ars(v_due);
  end if;

  v_kind := case
    when v_paid = 0 and p_amount >= v_order.total_amount then 'full'
    when v_paid = 0 then 'deposit'
    else 'balance'
  end;

  insert into public.transactions
    (type, order_id, customer_id, amount, method, note, payment_kind, operator_id)
  values
    ('3d_service', p_order, v_order.customer_id, p_amount, p_method,
     nullif(trim(p_note), ''), v_kind, p_operator)
  returning * into v_tx;

  update public.orders
    set deposit = v_paid + p_amount,
        pending_balance = v_order.total_amount - (v_paid + p_amount)
    where id = p_order;

  v_label := public.ars(p_amount) || ' · ' || case p_method
    when 'cash' then 'efectivo'
    when 'transfer' then 'transferencia'
    when 'mercadopago' then 'Mercado Pago'
    when 'uala' then 'Ualá'
    when 'brubank' then 'Brubank'
    else 'otro medio' end;
  insert into public.production_events (order_id, operator_id, kind, label, delta)
    values (p_order, p_operator, 'payment', v_label, round(p_amount)::integer);

  return v_tx;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anular un cobro: solo admin, con motivo; devuelve el saldo al pedido
-- ---------------------------------------------------------------------------
create or replace function public.void_order_payment(
  p_tx uuid,
  p_operator uuid,
  p_reason text
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
  v_order public.orders;
  v_new numeric(12, 2);
begin
  if not exists (
    select 1 from public.operators
    where id = p_operator and role = 'admin' and active
  ) then
    raise exception 'Solo un administrador puede anular cobros';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Escribí el motivo de la anulación';
  end if;

  select * into v_tx from public.transactions
    where id = p_tx and type = '3d_service' and order_id is not null for update;
  if not found then
    raise exception 'No se encontró el cobro';
  end if;
  if v_tx.voided_at is not null then
    raise exception 'El cobro ya está anulado';
  end if;

  select * into v_order from public.orders where id = v_tx.order_id for update;
  v_new := greatest(0, coalesce(v_order.deposit, 0) - v_tx.amount);

  update public.transactions
    set voided_at = now(), voided_by = p_operator, void_reason = trim(p_reason)
    where id = p_tx
    returning * into v_tx;

  update public.orders
    set deposit = v_new,
        pending_balance = case when total_amount is null then pending_balance
                               else total_amount - v_new end
    where id = v_tx.order_id;

  insert into public.production_events (order_id, operator_id, kind, label, delta)
    values (v_tx.order_id, p_operator, 'payment',
            'Cobro anulado · ' || public.ars(v_tx.amount) || ' (' || trim(p_reason) || ')',
            -round(v_tx.amount)::integer);

  return v_tx;
end;
$$;

revoke execute on function public.register_order_payment(uuid, numeric, text, uuid, text) from public, anon;
revoke execute on function public.void_order_payment(uuid, uuid, text) from public, anon;
grant execute on function public.register_order_payment(uuid, numeric, text, uuid, text) to authenticated;
grant execute on function public.void_order_payment(uuid, uuid, text) to authenticated;
```

- [ ] **Step 2: Verificar supuestos**

Run: `grep -n "'payment'" supabase/migrations/20261001100000_postprocess_and_auto_stage.sql | head -3` — el check de `production_events.kind` debe incluir `payment` (si no, ajustar la inserción de eventos). Run: `grep -rn "public.ars" supabase/migrations | head -2` — la función `public.ars(numeric)` existe (migración `20261008180000_filament_sale_note.sql`).

- [ ] **Step 3: Tipos**

En `src/lib/database.types.ts`, a mano y en el estilo del archivo, agregar a `transactions` (Row, Insert opcionales, Update opcionales) las columnas `payment_kind: string | null`, `operator_id: string | null`, `voided_at: string | null`, `voided_by: string | null`, `void_reason: string | null`, más los `Relationships` de `operator_id` y `voided_by` hacia `operators` (mismo estilo que `filament_sales_operator_id_fkey`). Agregar en `Functions`:

```ts
register_order_payment: {
  Args: {
    p_order: string
    p_amount: number
    p_method: string
    p_operator: string
    p_note?: string | null
  }
  Returns: Database['public']['Tables']['transactions']['Row']
}
void_order_payment: {
  Args: { p_tx: string; p_operator: string; p_reason: string }
  Returns: Database['public']['Tables']['transactions']['Row']
}
```

- [ ] **Step 4: Typecheck y commit**

Run: `export PATH="/c/Users/nyunes/AppData/Local/nvm/v20.19.0:$PATH" && npm run typecheck` → sin errores.

```bash
git add supabase/migrations/20261009180000_order_payments.sql src/lib/database.types.ts
git commit -m "feat(cobros): libro de cobros de pedidos y canal Mercado Libre"
```

**No se prueba en seco ni se aplica en esta tarea:** lo hace el controlador con el OK del dueño.

---

### Task 2: Lógica pura de cobros, canal y borrador

**Files:**
- Create: `src/features/orders/payments.ts`, `src/features/orders/payments.test.ts`
- Modify: `src/lib/domain-constants.ts`, `src/features/orders/orderDraft.ts`, `src/features/orders/orderDraft.test.ts`

**Interfaces:**
- Consumes: `PAYMENT_METHOD`, `PAYMENT_METHOD_LABELS`, `PaymentMethod` de `@/lib/domain-constants`; `parseMoney` de `./orderDraft`; `Database` de `@/lib/database.types`.
- Produces:
  - `type PaymentKind = 'deposit' | 'balance' | 'full'`; `PAYMENT_KIND_LABELS: Record<PaymentKind, string>` (`Seña`, `Saldo`, `Pago total`).
  - `type PaymentRow = Database['public']['Tables']['transactions']['Row']`
  - `paymentKindFor(total: number, alreadyPaid: number, amount: number): PaymentKind`
  - `activePayments(rows: readonly PaymentRow[]): PaymentRow[]` (sin anulados)
  - `paidTotal(rows: readonly PaymentRow[]): number` (suma de no anulados)
  - `methodLabel(method: string | null): string` (`Sin medio` si es null o desconocido)
  - `validatePayment(input: { amount: string; method: PaymentMethod | null; balance: number }): string | null`
  - `ORIGIN_CHANNEL` incluye `'mercadolibre'` y `ORIGIN_CHANNEL_LABELS.mercadolibre === 'Mercado Libre'`.
  - `OrderDraft.depositMethod: PaymentMethod | null` (default `null` en `emptyDraft`); `DraftErrors` suma `'channel' | 'depositMethod'`; `validateDraft(draft, opts?: { creating?: boolean })`.

- [ ] **Step 1: Tests que fallan** (`payments.test.ts`)

```ts
import { describe, expect, it } from 'vitest'
import {
  PAYMENT_KIND_LABELS,
  activePayments,
  methodLabel,
  paidTotal,
  paymentKindFor,
  validatePayment,
  type PaymentRow,
} from './payments'

const row = (over: Partial<PaymentRow>): PaymentRow =>
  ({
    id: 'p1', type: '3d_service', order_id: 'o1', amount: 1000, method: 'cash',
    payment_kind: 'deposit', transacted_at: '2026-10-09T12:00:00Z', note: null,
    operator_id: null, voided_at: null, voided_by: null, void_reason: null,
    ...over,
  }) as PaymentRow

describe('paymentKindFor', () => {
  it('primer cobro que cubre todo es pago total; parcial es seña; los siguientes son saldo', () => {
    expect(paymentKindFor(10000, 0, 10000)).toBe('full')
    expect(paymentKindFor(10000, 0, 4000)).toBe('deposit')
    expect(paymentKindFor(10000, 4000, 6000)).toBe('balance')
    expect(paymentKindFor(10000, 4000, 2000)).toBe('balance')
  })
})

describe('totales', () => {
  const rows = [
    row({ id: 'a', amount: 4000 }),
    row({ id: 'b', amount: 1500, payment_kind: 'balance' }),
    row({ id: 'c', amount: 999, voided_at: '2026-10-10T00:00:00Z', void_reason: 'error' }),
  ]
  it('los anulados no cuentan', () => {
    expect(activePayments(rows).map((r) => r.id)).toEqual(['a', 'b'])
    expect(paidTotal(rows)).toBe(5500)
    expect(paidTotal([])).toBe(0)
  })
})

describe('etiquetas', () => {
  it('medio y tipo en castellano', () => {
    expect(methodLabel('cash')).toBe('Efectivo')
    expect(methodLabel('mercadopago')).toBe('Mercado Pago')
    expect(methodLabel(null)).toBe('Sin medio')
    expect(methodLabel('bitcoin')).toBe('Sin medio')
    expect(PAYMENT_KIND_LABELS).toEqual({ deposit: 'Seña', balance: 'Saldo', full: 'Pago total' })
  })
})

describe('validatePayment', () => {
  it('pide monto, medio y que no supere el saldo', () => {
    expect(validatePayment({ amount: '', method: 'cash', balance: 5000 })).toBe('Escribí el monto que pagó.')
    expect(validatePayment({ amount: 'abc', method: 'cash', balance: 5000 })).toBe('Revisá el monto.')
    expect(validatePayment({ amount: '0', method: 'cash', balance: 5000 })).toBe('Escribí el monto que pagó.')
    expect(validatePayment({ amount: '1000', method: null, balance: 5000 })).toBe('Elegí cómo pagó.')
    expect(validatePayment({ amount: '6.000', method: 'cash', balance: 5000 })).toBe('El cobro supera el saldo.')
    expect(validatePayment({ amount: '5.000', method: 'transfer', balance: 5000 })).toBeNull()
  })
})
```

En `orderDraft.test.ts` agregar:

```ts
describe('validateDraft al crear', () => {
  const base = () => ({
    ...emptyDraft(),
    customerName: 'Ana',
    items: [{ product: 'Vaso', quantity: '1', details: '' }],
    dueDate: '2026-10-20',
    total: '10000',
  })
  it('sin opciones no pide canal ni medio (editar pedidos viejos)', () => {
    expect(validateDraft({ ...base(), deposit: '3000' })).toEqual({})
  })
  it('al crear pide canal', () => {
    expect(validateDraft(base(), { creating: true }).channel).toBe('Elegí el canal.')
    expect(validateDraft({ ...base(), channel: 'instagram' }, { creating: true })).toEqual({})
  })
  it('al crear con seña pide el medio y el total', () => {
    const d = { ...base(), channel: 'instagram' as const, deposit: '3000' }
    expect(validateDraft(d, { creating: true }).depositMethod).toBe('Elegí cómo pagó la seña.')
    expect(validateDraft({ ...d, depositMethod: 'cash' }, { creating: true })).toEqual({})
    expect(
      validateDraft({ ...d, total: '', depositMethod: 'cash' }, { creating: true }).total,
    ).toBe('Poné el total para registrar la seña.')
  })
})
```

(Importar `emptyDraft`, `validateDraft` si el archivo no los importa ya.)

- [ ] **Step 2: Correr y ver que fallan**

Run: `export PATH="/c/Users/nyunes/AppData/Local/nvm/v20.19.0:$PATH" && npx vitest run --dir src src/features/orders/payments.test.ts src/features/orders/orderDraft.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

`src/lib/domain-constants.ts`: agregar `'mercadolibre'` a `ORIGIN_CHANNEL` (antes de `'other'`) y `mercadolibre: 'Mercado Libre'` a `ORIGIN_CHANNEL_LABELS`.

`src/features/orders/payments.ts`:

```ts
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/domain-constants'
import type { Database } from '@/lib/database.types'
import { parseMoney } from './orderDraft'

export type PaymentRow = Database['public']['Tables']['transactions']['Row']
export type PaymentKind = 'deposit' | 'balance' | 'full'

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  deposit: 'Seña',
  balance: 'Saldo',
  full: 'Pago total',
}

// Same rule as register_order_payment in the database.
export function paymentKindFor(
  total: number,
  alreadyPaid: number,
  amount: number,
): PaymentKind {
  if (alreadyPaid === 0 && amount >= total) return 'full'
  if (alreadyPaid === 0) return 'deposit'
  return 'balance'
}

export function activePayments(rows: readonly PaymentRow[]): PaymentRow[] {
  return rows.filter((r) => r.voided_at === null)
}

export function paidTotal(rows: readonly PaymentRow[]): number {
  return activePayments(rows).reduce((sum, r) => sum + r.amount, 0)
}

export function methodLabel(method: string | null): string {
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? 'Sin medio'
}

export function validatePayment({
  amount,
  method,
  balance,
}: {
  amount: string
  method: PaymentMethod | null
  balance: number
}): string | null {
  const value = parseMoney(amount)
  if (value === null || value === 0) return 'Escribí el monto que pagó.'
  if (Number.isNaN(value) || value < 0) return 'Revisá el monto.'
  if (!method) return 'Elegí cómo pagó.'
  if (value > balance) return 'El cobro supera el saldo.'
  return null
}
```

`orderDraft.ts`: importar `PaymentMethod` de `@/lib/domain-constants`; agregar a `OrderDraft` el campo `depositMethod: PaymentMethod | null` (con comentario: "How the deposit was paid; only asked when creating"); `emptyDraft` lo inicializa en `null`; `DraftErrors` suma `'channel' | 'depositMethod'`; y:

```ts
export function validateDraft(
  draft: OrderDraft,
  opts: { creating?: boolean } = {},
): DraftErrors {
  // ...cuerpo actual sin cambios...
  if (opts.creating) {
    if (!draft.channel) errors.channel = 'Elegí el canal.'
    if (deposit !== null && !Number.isNaN(deposit) && deposit > 0) {
      if (!draft.depositMethod) errors.depositMethod = 'Elegí cómo pagó la seña.'
      if (total === null) errors.total = 'Poné el total para registrar la seña.'
    }
  }
  return errors
}
```

(La condición de `total === null` va después de la validación existente de total; no pisar un error de total ya puesto: usar `errors.total ??= '...'`.) Actualizar `loadDraft` en `orderSave.api.ts` agregando `depositMethod: null` al objeto devuelto, y cualquier otro literal de `OrderDraft` que el typecheck marque.

- [ ] **Step 4: Correr y ver que pasan**

Run: `npx vitest run --dir src src/features/orders` → PASS; `npm run typecheck` sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain-constants.ts src/features/orders/payments.ts src/features/orders/payments.test.ts src/features/orders/orderDraft.ts src/features/orders/orderDraft.test.ts src/features/orders/orderSave.api.ts
git commit -m "feat(cobros): lógica de cobros, canal Mercado Libre y validación al crear"
```

---

### Task 3: Llamadas a la base y seña como cobro

**Files:**
- Create: `src/features/orders/payments.api.ts`, `src/features/orders/payments.api.test.ts`
- Modify: `src/features/orders/orderSave.api.ts`, `src/features/orders/orderSave.api.test.ts`

**Interfaces:**
- Consumes: `supabase` de `@/lib/supabase`; `PaymentRow` de `./payments`; `PaymentMethod` de `@/lib/domain-constants`.
- Produces:
  - `registerOrderPayment(orderId: string, amount: number, method: PaymentMethod, operatorId: string | null, note?: string): Promise<PaymentRow>`
  - `voidOrderPayment(txId: string, operatorId: string | null, reason: string): Promise<PaymentRow>`
  - `listOrderPayments(orderId: string): Promise<PaymentRow[]>` (más nuevo primero)
  - `createOrderFromDraft(draft, operatorId): Promise<OrderRow & { paymentWarning?: string }>`: el pedido se inserta **sin** seña (`deposit: null`, `pending_balance` = total) y, si el borrador tiene seña > 0, se registra con `registerOrderPayment`; si eso falla, no se lanza error: se devuelve `paymentWarning`.

- [ ] **Step 1: Test que falla** (`payments.api.test.ts`)

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc, from } }))

import { listOrderPayments, registerOrderPayment, voidOrderPayment } from './payments.api'

describe('payments API', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
    rpc.mockResolvedValue({ data: { id: 'p1' }, error: null })
  })

  it('registerOrderPayment manda pedido, monto, medio, persona y nota', async () => {
    await registerOrderPayment('o1', 5000, 'transfer', 'op1', 'seña')
    expect(rpc).toHaveBeenCalledWith('register_order_payment', {
      p_order: 'o1', p_amount: 5000, p_method: 'transfer', p_operator: 'op1', p_note: 'seña',
    })
  })

  it('voidOrderPayment manda cobro, persona y motivo', async () => {
    await voidOrderPayment('p1', 'op1', 'error de carga')
    expect(rpc).toHaveBeenCalledWith('void_order_payment', {
      p_tx: 'p1', p_operator: 'op1', p_reason: 'error de carga',
    })
  })

  it('el mensaje de la base llega tal cual', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'El cobro supera el saldo (queda $500)' } })
    await expect(registerOrderPayment('o1', 9999, 'cash', 'op1')).rejects.toThrow(
      'El cobro supera el saldo (queda $500)',
    )
  })

  it('listOrderPayments pide los cobros del pedido, el más nuevo primero', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 'p1' }], error: null })
    const eqType = vi.fn().mockReturnValue({ order })
    const eqOrder = vi.fn().mockReturnValue({ eq: eqType })
    const select = vi.fn().mockReturnValue({ eq: eqOrder })
    from.mockReturnValue({ select })
    const r = await listOrderPayments('o1')
    expect(from).toHaveBeenCalledWith('transactions')
    expect(eqOrder).toHaveBeenCalledWith('order_id', 'o1')
    expect(eqType).toHaveBeenCalledWith('type', '3d_service')
    expect(order).toHaveBeenCalledWith('transacted_at', { ascending: false })
    expect(r).toEqual([{ id: 'p1' }])
  })
})
```

En `orderSave.api.test.ts` (que simula `supabase.from`): agregar `rpc` al mock de `@/lib/supabase` (vía `vi.hoisted`, `rpc: vi.fn()` resolviendo `{ data: { id: 'p1' }, error: null }` en el `beforeEach`) y estos tests:

```ts
it('la seña no va en el pedido: se registra como cobro', async () => {
  await createOrderFromDraft(
    draft({ total: '10000', deposit: '3000', depositMethod: 'cash', channel: 'instagram' }),
    'op1',
  )
  const orderInsert = calls.find((c) => c.table === 'orders' && c.op === 'insert')!
  expect(orderInsert.payload).toMatchObject({ deposit: null, pending_balance: 10000 })
  expect(rpc).toHaveBeenCalledWith('register_order_payment', expect.objectContaining({
    p_amount: 3000, p_method: 'cash', p_operator: 'op1',
  }))
})

it('sin seña no llama a la función de cobros', async () => {
  await createOrderFromDraft(draft({ total: '10000', channel: 'local' }), 'op1')
  expect(rpc).not.toHaveBeenCalled()
})

it('si el cobro falla, el pedido igual se guarda y vuelve un aviso', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'Cargá primero el total del pedido' } })
  const r = await createOrderFromDraft(
    draft({ total: '10000', deposit: '3000', depositMethod: 'cash' }),
    'op1',
  )
  expect(r.paymentWarning).toContain('Cargá primero el total del pedido')
})
```

(Adaptar al fake de `respond` del archivo para que el insert de `orders` devuelva una fila con `id`.)

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run --dir src src/features/orders/payments.api.test.ts src/features/orders/orderSave.api.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

`payments.api.ts`:

```ts
import { supabase } from '@/lib/supabase'
import type { PaymentMethod } from '@/lib/domain-constants'
import type { PaymentRow } from './payments'

// Database errors carry a Spanish message meant for the screen.
function fail(error: { message: string }): never {
  throw new Error(error.message)
}

// The database checks the amount against the balance, keeps the order's
// deposit / pending balance in step and logs the payment in the order's activity.
export async function registerOrderPayment(
  orderId: string,
  amount: number,
  method: PaymentMethod,
  operatorId: string | null,
  note?: string,
): Promise<PaymentRow> {
  const { data, error } = await supabase.rpc('register_order_payment', {
    p_order: orderId,
    p_amount: amount,
    p_method: method,
    p_operator: operatorId as string, // the database rejects null with a message
    p_note: note ?? null,
  })
  if (error) fail(error)
  return data as PaymentRow
}

// Admin only (checked in the database); gives the amount back to the balance.
export async function voidOrderPayment(
  txId: string,
  operatorId: string | null,
  reason: string,
): Promise<PaymentRow> {
  const { data, error } = await supabase.rpc('void_order_payment', {
    p_tx: txId,
    p_operator: operatorId as string, // the database rejects null with a message
    p_reason: reason,
  })
  if (error) fail(error)
  return data as PaymentRow
}

export async function listOrderPayments(orderId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('order_id', orderId)
    .eq('type', '3d_service')
    .order('transacted_at', { ascending: false })
  if (error) fail(error)
  return data ?? []
}
```

`orderSave.api.ts`: en `createOrderFromDraft`, el insert del pedido usa `{ ...orderFields(draft), deposit: null, pending_balance: balanceOf({ total: draft.total, deposit: '' }) }`; al final, antes de `return`:

```ts
  const deposit = parseMoney(draft.deposit)
  let paymentWarning: string | undefined
  if (deposit && !Number.isNaN(deposit) && deposit > 0 && draft.depositMethod) {
    try {
      await registerOrderPayment(order.id, deposit, draft.depositMethod, operatorId)
    } catch (err) {
      paymentWarning = `Pedido guardado, pero no se pudo registrar la seña: ${
        err instanceof Error ? err.message : 'error desconocido'
      }. Registrala desde el pedido.`
    }
  }
  return { ...order, paymentWarning }
```

Cambiar el tipo de retorno a `Promise<OrderRow & { paymentWarning?: string }>`. `updateOrderFromDraft` no cambia (la seña al editar es de solo lectura; sigue mandando el `deposit` ya cargado en el borrador).

- [ ] **Step 4: Correr y ver que pasan**

Run: `npx vitest run --dir src src/features/orders` → PASS; typecheck sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/features/orders/payments.api.ts src/features/orders/payments.api.test.ts src/features/orders/orderSave.api.ts src/features/orders/orderSave.api.test.ts
git commit -m "feat(cobros): la seña del alta se registra como cobro"
```

---

### Task 4: Modal de alta — medio de la seña y canal obligatorio

**Files:**
- Modify: `src/features/orders/OrderModal.tsx`, `src/features/orders/OrderModal.test.tsx`

**Interfaces:**
- Consumes: `validateDraft(draft, { creating })`, `OrderDraft.depositMethod`, `DraftErrors.channel | depositMethod` (Task 2); `createOrderFromDraft` con `paymentWarning` (Task 3); `PAYMENT_METHOD`, `PAYMENT_METHOD_LABELS`, `ORIGIN_CHANNEL`.
- Produces: comportamiento de pantalla (sin nuevas exportaciones).

**Comportamiento:**
- `handleSubmit` llama `validateDraft(draft, { creating: !editing })`.
- Debajo del campo "Seña ($)", **solo al crear y solo si la seña es mayor que 0**, un grupo de chips `role="group" aria-label="Medio de la seña"` con los seis medios (`PAYMENT_METHOD_LABELS`); `aria-pressed` según `draft.depositMethod`; tocar uno lo elige (volver a tocarlo lo quita). Error `errors.depositMethod` con la clase `omodal__err`.
- **Al editar** un pedido (`editing`), el input de la seña va `disabled` con una ayuda "Los cobros se registran desde el pedido." (`<p className="field-hint">` o la clase de ayuda que ya use el modal), y no se muestra el grupo de medios.
- Paso "Canal y notas": el título del grupo de chips dice "Canal" y, al crear, se marca como obligatorio (texto "Canal (obligatorio)" en una etiqueta visible; `aria-label="Canal"` del grupo no cambia). Se muestra `errors.channel` con `omodal__err`. Los chips salen de `ORIGIN_CHANNEL`, así que "Mercado Libre" aparece solo.
- Al guardar, si `createOrderFromDraft` devuelve `paymentWarning`, se pasa al callback existente: `onSaved(order, [uploadWarning, order.paymentWarning].filter(Boolean).join(' ') || undefined)`.

- [ ] **Step 1: Tests que fallan** (`OrderModal.test.tsx`; seguir el estilo de los tests existentes del archivo: cómo montan el modal, cómo mockean `orderSave.api`)

```tsx
it('al crear, no deja guardar sin canal', async () => {
  // completar cliente, un producto y fecha; dejar el canal sin elegir; guardar
  expect(await screen.findByText('Elegí el canal.')).toBeInTheDocument()
  expect(createOrderFromDraft).not.toHaveBeenCalled()
})

it('con seña pide el medio de pago', async () => {
  // completar lo mínimo, elegir canal, total 10000 y seña 3000, sin medio; guardar
  expect(await screen.findByText('Elegí cómo pagó la seña.')).toBeInTheDocument()
  fireEvent.click(within(screen.getByRole('group', { name: 'Medio de la seña' })).getByRole('button', { name: 'Efectivo' }))
  // guardar de nuevo
  expect(createOrderFromDraft).toHaveBeenCalledWith(
    expect.objectContaining({ deposit: '3000', depositMethod: 'cash', channel: expect.any(String) }),
    expect.anything(),
  )
})

it('el grupo de medios no aparece sin seña', () => {
  expect(screen.queryByRole('group', { name: 'Medio de la seña' })).toBeNull()
})

it('al editar, la seña no se puede cambiar y no pide canal', async () => {
  // abrir en modo edición con un pedido sin canal y seña 2000
  expect(screen.getByLabelText('Seña ($)')).toBeDisabled()
  // guardar: updateOrderFromDraft se llama igual (sin error de canal)
})

it('muestra el aviso si la seña no se pudo registrar', async () => {
  // createOrderFromDraft resuelve { id: 'o1', paymentWarning: 'Pedido guardado, pero no se pudo registrar la seña: x. Registrala desde el pedido.' }
  expect(onSaved).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('no se pudo registrar la seña'))
})
```

- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run --dir src src/features/orders/OrderModal.test.tsx` → FAIL.

- [ ] **Step 3: Implementar** según el comportamiento de arriba; la pantalla no puede mostrar horizontal scroll a 375 px (los seis chips de medio hacen wrap con la clase `chips` existente).

- [ ] **Step 4: Correr** — `npx vitest run --dir src src/features/orders`, `npm run typecheck`, `npm run lint` → verdes.

- [ ] **Step 5: Commit**

```bash
git add src/features/orders/OrderModal.tsx src/features/orders/OrderModal.test.tsx
git commit -m "feat(cobros): medio de la seña y canal obligatorio al crear pedidos"
```

---

### Task 5: Cobros en el pedido

**Files:**
- Create: `src/features/orders/OrderPayments.tsx`
- Modify: `src/features/orders/OrderSummary.tsx`, `src/features/orders/OrderProduction.tsx`, `src/features/orders/OrderProduction.test.tsx`

**Interfaces:**
- Consumes: `registerOrderPayment`, `voidOrderPayment`, `listOrderPayments` (Task 3); `PaymentRow`, `PAYMENT_KIND_LABELS`, `methodLabel`, `validatePayment`, `activePayments` (Task 2); `PAYMENT_METHOD`, `PAYMENT_METHOD_LABELS`; `useOperator()` → `{ current, isAdmin }`; `formatMoney`.
- Produces:
  - `OrderPayments({ orderId, reloadKey, onVoided }: { orderId: string; reloadKey: number; onVoided: () => void })` (default export).
  - `OrderSummary` cambia su prop `onPay` a `onPay: (amount: number, method: PaymentMethod) => Promise<boolean>` y suma las props `paymentsKey: number` y `onPaymentVoided: () => void`; renderiza `<OrderPayments>` dentro del bloque "Saldo".

**Comportamiento:**
- **Formulario de cobro** (en `OrderSummary`, el existente "¿Cuánto pagó?"): se agrega un grupo de chips `role="group" aria-label="Medio de pago"` con los seis medios, ninguno preseleccionado; "Guardar pago" valida con `validatePayment({ amount, method, balance })` y muestra el texto devuelto como error; "Todo el saldo" sigue. El botón "Registrar pago" aparece para pedidos **no cancelados** con saldo > 0, **incluidos los entregados** (hoy se oculta cuando está cerrado). Si el pedido está entregado y tiene saldo, el rótulo del bloque muestra además "Entregado con saldo pendiente".
- **`OrderProduction.registerPayment(amount, method)`**: llama `registerOrderPayment(order.id, amount, method, operatorId)`, luego `getOrder(order.id)` para refrescar `order`, sube `paymentsKey` y `activityKey`; devuelve `true`/`false` y deja el mensaje de error de la base en `actionError` si falla. Ya no hace `updateOrder` de `deposit`/`pending_balance` ni `logOrderEvent` (la función de la base lo hace).
- **`OrderPayments`**: carga `listOrderPayments(orderId)` (con `alive` y recarga por `reloadKey`); si no hay cobros no renderiza nada. Lista `<ul aria-label="Cobros">` con cada fila: fecha (`dd/mm`), tipo (`PAYMENT_KIND_LABELS`, o "Cobro" si `payment_kind` es null), medio (`methodLabel`), monto (`formatMoney`) y, si `note === 'migrado'`, la marca "migrado". Las anuladas van tachadas (`<s>`) con "Anulado: {motivo}". **Solo admin** ve el botón "Anular" en cada cobro activo; pide el motivo (campo de texto + "Confirmar"/"Cancelar"), llama `voidOrderPayment(tx.id, current?.id ?? null, motivo)`, muestra errores en `role="alert"` y al terminar llama `onVoided()`. Motivo vacío: "Escribí el motivo de la anulación."
- Al anular (`onPaymentVoided`) `OrderProduction` re-lee el pedido y sube `paymentsKey` y `activityKey`.

- [ ] **Step 1: Tests que fallan** (`OrderProduction.test.tsx`; seguir cómo ese archivo mockea `orders.api` y el contexto de operador, y agregar mocks de `./payments.api`)

```tsx
it('registrar un pago pide el medio y llama a la base', async () => {
  // pedido en cola con total 10000 y saldo 10000
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }))
  fireEvent.change(screen.getByLabelText('¿Cuánto pagó?'), { target: { value: '4000' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar pago' }))
  expect(await screen.findByText('Elegí cómo pagó.')).toBeInTheDocument()
  expect(registerOrderPayment).not.toHaveBeenCalled()
  fireEvent.click(within(screen.getByRole('group', { name: 'Medio de pago' })).getByRole('button', { name: 'Transferencia' }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar pago' })))
  expect(registerOrderPayment).toHaveBeenCalledWith('o1', 4000, 'transfer', expect.anything())
})

it('un pedido entregado con saldo todavía deja registrar el cobro', () => {
  // pedido delivered con pending_balance 6000
  expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument()
  expect(screen.getByText('Entregado con saldo pendiente')).toBeInTheDocument()
})

it('un pedido cancelado no deja registrar cobros', () => {
  expect(screen.queryByRole('button', { name: 'Registrar pago' })).toBeNull()
})

it('lista los cobros con fecha, tipo y medio; los anulados van tachados', async () => {
  // listOrderPayments devuelve una seña en efectivo y un saldo anulado con motivo "error"
  const list = await screen.findByRole('list', { name: 'Cobros' })
  expect(within(list).getByText('Seña')).toBeInTheDocument()
  expect(within(list).getByText('Efectivo')).toBeInTheDocument()
  expect(within(list).getByText(/Anulado: error/)).toBeInTheDocument()
})

it('el operador no ve Anular; el admin sí y pide motivo', async () => {
  // como operador: queryByRole('button', { name: 'Anular' }) es null
  // como admin: click en Anular, Confirmar sin motivo -> 'Escribí el motivo de la anulación.'
  //             con motivo -> voidOrderPayment('p1', 'op-1', 'error de carga')
})
```

- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run --dir src src/features/orders/OrderProduction.test.tsx` → FAIL.

- [ ] **Step 3: Implementar** `OrderPayments.tsx`, los cambios de `OrderSummary.tsx` y de `OrderProduction.tsx` según el comportamiento. Estilos: reutilizar las clases `osum2__*` y `chips`/`chip` existentes; agregar solo lo mínimo en el CSS del pedido para la lista (sin scroll horizontal a 375 px).

- [ ] **Step 4: Verificación completa** — `npx vitest run --dir src` (todo en verde), `npm run typecheck`, `npm run lint` (0 errores), `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add src/features/orders/OrderPayments.tsx src/features/orders/OrderSummary.tsx src/features/orders/OrderProduction.tsx src/features/orders/OrderProduction.test.tsx
git commit -m "feat(cobros): registrar, listar y anular cobros desde el pedido"
```

---

## Self-Review

- **Spec (F1 del diseño + spec del dueño §3/§11.1):** cobros con fecha, monto, medio y tipo → Task 1 (libro + RPC) y Task 5 (UI); canal con Mercado Libre y obligatorio al crear → Tasks 1, 2 y 4; la seña del modal pasa por la misma RPC → Tasks 3 y 4; anulación con motivo solo admin → Tasks 1 y 5; operadores pueden registrar cobros → Task 1 (sin chequeo de rol) y Task 5; backfill de señas → Task 1; pedidos entregados con saldo siguen cobrándose → Task 5. Fuera de esta fase (por decisión): D9 (saldos viejos), estadísticas que consumen los cobros (F2).
- **Sin placeholders:** SQL, lógica pura, capa de datos y tests de estas capas están completos; la UI de Tasks 4 y 5 se define por comportamiento y tests concretos y sigue los patrones de `OrderModal`/`OrderSummary`.
- **Consistencia de tipos:** `PaymentRow` = fila de `transactions`; `registerOrderPayment(orderId, amount, method, operatorId, note?)` es lo que usan `createOrderFromDraft` (Task 3) y `OrderProduction.registerPayment` (Task 5); `onPay(amount, method)` coincide entre `OrderSummary` y `OrderProduction`; `validateDraft(draft, { creating })` se usa igual en tests (Task 2) y modal (Task 4).
