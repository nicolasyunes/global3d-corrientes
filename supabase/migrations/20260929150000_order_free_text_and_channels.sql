-- Pedido en texto libre, como la planilla: PRODUCTO (title) y DESCRIPCION
-- (description) viven en la fila del pedido para que la sincronización con
-- Google Sheets los tenga desde el primer insert (los ítems llegan después).
alter table public.orders
  add column title text,
  add column description text;

alter table public.orders alter column product_type set default 'other';

-- Canales reales del taller: WhatsApp del negocio (whatsapp), WhatsApp
-- personal, Instagram, Facebook, en el local, web.
alter table public.orders drop constraint if exists orders_origin_channel_check;
alter table public.orders
  add constraint orders_origin_channel_check
  check (origin_channel in (
    'whatsapp', 'whatsapp_personal', 'instagram', 'facebook', 'local', 'web', 'other'
  ));
