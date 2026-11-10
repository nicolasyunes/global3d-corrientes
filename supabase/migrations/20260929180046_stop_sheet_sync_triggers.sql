-- Backfill del historial (2026-11-06). Esta migración se aplicó a mano en
-- producción el 2026-09-29 con la versión 20260929180046 y nunca volvió al
-- repo, así que `supabase db reset` no reproducía producción. Se la agrega con
-- su versión original a propósito: ya figura en `supabase_migrations.
-- schema_migrations`, por lo que no se vuelve a ejecutar sobre producción.
--
-- No se conserva el texto original (nunca estuvo en git). Esto es una
-- reconstrucción del efecto observado: frenar el sync con la planilla de
-- Google dando de baja los dos triggers, un día antes de la limpieza completa
-- de 20260930100000_drop_sheet_sync_and_storefront.sql, que vuelve a bajarlos
-- con `if exists` y además borra las funciones y la tabla de configuración.

drop trigger if exists trg_orders_sync_to_sheet on public.orders;
drop trigger if exists trg_inventory_sync_to_sheet on public.inventory;
