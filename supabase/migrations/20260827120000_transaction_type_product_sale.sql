-- Adds the `product_sale` value to `transaction_type` for direct product
-- sales (something already in stock, sold and paid on the spot — no order /
-- production flow). Its own migration because `alter type ... add value`
-- can't be used in the same transaction that defines it, so the columns +
-- trigger that reference it live in the next file. Same split as
-- 20260826150000_orders_delivered_status.sql.

alter type public.transaction_type add value 'product_sale' after 'supplies_sale';
