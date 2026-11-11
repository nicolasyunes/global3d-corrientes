-- Prende Mercado Pago en la tienda: ya está probado con ?mp=prueba, el
-- access token está en los secrets y las edge functions (mp-pay, mp-webhook,
-- mp-preference) están desplegadas.
update public.shop_settings
   set value = jsonb_set(value, '{enabled}', 'true')
 where key = 'mercadopago'
   and value->>'enabled' = 'false';
