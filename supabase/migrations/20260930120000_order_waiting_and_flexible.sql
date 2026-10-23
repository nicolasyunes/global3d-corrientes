-- "En espera": orders not fully confirmed yet (no deposit, design not
-- approved, customer silent). They stay out of production until confirmed,
-- but come back for review on follow_up_on so they are never forgotten.
-- "Sin apuro": confirmed orders whose due date is only a guide; they are kept
-- apart from urgent production.
alter table public.orders
  add column waiting_reason text,
  add column follow_up_on date,
  add column flexible boolean not null default false;

comment on column public.orders.waiting_reason is
  'Non-null = order is "En espera" (not confirmed); the text says why.';
comment on column public.orders.follow_up_on is
  'When to check a waiting order again.';
comment on column public.orders.flexible is
  'Sin apuro: the due date is a guide, not a deadline.';
