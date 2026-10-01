-- Detalle de entrega del pedido: si lo retiran o se envía, dónde, a qué hora,
-- quién pasa a retirar y una nota de la casa. Todo opcional.

alter table public.orders
  add column delivery_kind text
    check (delivery_kind in ('pickup', 'shipping')),
  add column delivery_place text,
  add column delivery_time text
    check (delivery_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column delivery_person text,
  add column delivery_note text;
