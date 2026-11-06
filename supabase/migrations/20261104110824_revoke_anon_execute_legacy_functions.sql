-- Funciones SECURITY DEFINER que anon podía llamar por /rest/v1/rpc.
-- Los triggers no chequean EXECUTE al dispararse, así que siguen funcionando.
revoke execute on function public.consume_inventory() from public, anon, authenticated;
revoke execute on function public.consume_product_stock() from public, anon, authenticated;
revoke execute on function public.log_product_change() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- is_admin() la siguen pudiendo usar los usuarios con sesión.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
