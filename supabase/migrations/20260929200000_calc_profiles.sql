-- Cost calculator profiles ("P1S", "Taller casa"…): the fixed costs behind a
-- price quote. Shared by the whole workshop, so every device sees the same
-- numbers. Formulas live in the app (src/features/calculator/calculator.ts),
-- copied from the Calculadora_3D_GLOBAL3D sheet.

create table public.calc_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) > 0),
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  filament_price numeric not null default 0 check (filament_price >= 0),
  kwh_price numeric not null default 0 check (kwh_price >= 0),
  printer_model text,
  printer_watts numeric not null default 100 check (printer_watts >= 0),
  machine_life_hours numeric not null default 3000
    check (machine_life_hours > 0),
  spare_parts_cost numeric not null default 0 check (spare_parts_cost >= 0),
  error_margin_pct numeric not null default 5 check (error_margin_pct >= 0),
  ml_surcharge numeric not null default 0.8 check (ml_surcharge >= 0),
  updated_by uuid references public.operators(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calc_profiles enable row level security;

create policy calc_profiles_all
  on public.calc_profiles for all to authenticated
  using (true) with check (true);

-- Starting point: the values in the shop's sheet.
insert into public.calc_profiles
  (name, filament_price, kwh_price, printer_model, printer_watts,
   machine_life_hours, spare_parts_cost, error_margin_pct, ml_surcharge)
values
  ('P1S', 21000, 140, 'Bambu Lab P1S', 100, 3000, 150000, 5, 0.8);
