-- Additive migration: orders.origin_channel (open-list text + CHECK).
-- Records the social channel an order was captured from (facebook / whatsapp /
-- instagram / other). Nullable so existing rows are unaffected and an unknown
-- or unset channel stays valid. New values are extensible via a later
-- migration without altering an enum type.

alter table public.orders
  add column origin_channel text
  check (origin_channel in ('facebook', 'whatsapp', 'instagram', 'other'));
