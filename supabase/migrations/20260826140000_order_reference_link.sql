-- Single optional external reference link per order (e.g. a MakerWorld product
-- page for an existing design the customer wants replicated). See
-- openspec/changes/2026-08-26-order-images-and-link/design.md.

alter table public.orders
  add column reference_link text;
