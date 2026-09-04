-- Additive migration: order_status.delivered.
-- The production flow used to end at `finished` ("Listo"), with no way to
-- distinguish an order that's ready for pickup from one already handed to
-- the customer. `delivered` is the new terminal step after `finished` --
-- reaching it moves the order out of the Pendientes/Próximos queues and
-- into the Ventas de Pedidos section.

alter type public.order_status add value 'delivered' after 'finished';
