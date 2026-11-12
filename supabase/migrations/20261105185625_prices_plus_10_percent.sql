-- Backfill del historial (2026-11-06). Esta migración se aplicó a mano en
-- producción el 2026-11-05 a las 18:56:25 con la versión 20261105185625 y
-- nunca volvió al repo. Se la agrega con su versión original a propósito: ya
-- figura en `supabase_migrations.schema_migrations`, por lo que NO se vuelve a
-- ejecutar sobre producción. Cambiarle el número la haría correr de nuevo y
-- los precios subirían otro 10%.
--
-- No se conserva el texto original (nunca estuvo en git). La fórmula se
-- reconstruyó desde el estado de producción: `ceil(precio * 1.1 / 100) * 100`
-- reproduce las 69 filas de `price_backup_20261105` contra los valores
-- actuales, y coincide con lo que anotó el registro de productos
-- ("Precio: 41200.00 → 45400.00" para Lampara Retro).

-- Respaldo previo al aumento, tal como quedó en producción.
create table if not exists public.price_backup_20261105 (
  kind text,
  id uuid,
  price numeric
);

insert into public.price_backup_20261105 (kind, id, price)
select 'product', id, base_price from public.products
where coalesce(base_price, 0) > 0;

insert into public.price_backup_20261105 (kind, id, price)
select 'family', id, price_from from public.shop_families
where coalesce(price_from, 0) > 0;

-- Aumento del 10% redondeado hacia arriba a los $100.
update public.products
set base_price = ceil(base_price * 1.1 / 100) * 100
where coalesce(base_price, 0) > 0;

update public.shop_families
set price_from = ceil(price_from * 1.1 / 100) * 100
where coalesce(price_from, 0) > 0;
