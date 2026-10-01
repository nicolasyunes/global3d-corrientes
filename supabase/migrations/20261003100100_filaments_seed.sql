-- Carga inicial de filamentos con el stock relevado en el diseño
-- (pantalla "Filamentos — por marca"). Solo inserta si todavía no hay líneas.

do $$
declare
  v_line uuid;
begin
  if exists (select 1 from public.filament_lines) then
    return;
  end if;

  insert into public.filament_lines (brand, name, material, presentation, price, refill_price, accent, position)
  values ('3N3', 'PLA', 'PLA', 'spool', 22100, null, '#b8a3d9', 0)
  returning id into v_line;
  insert into public.filament_colors (line_id, name, swatch, finish, price, stock, stock_refill, spool_available, position) values
    (v_line, 'Blanco', '#f7f5f0', 'Estándar', 21150, 2, null, true, 0),
    (v_line, 'Negro', '#1d1b19', 'Estándar', 21150, 2, null, true, 1),
    (v_line, 'Rojo', '#d0312d', 'Estándar', 21150, 15, null, true, 2),
    (v_line, 'Azul', '#2450b8', 'Estándar', 21150, 0, null, true, 3),
    (v_line, 'Amarillo', '#f2c230', 'Estándar', 21150, 0, null, true, 4),
    (v_line, 'Amarillo Fluo', '#e3f00a', 'Fluo', null, 0, null, true, 5),
    (v_line, 'Gris Plomo', '#6b6e72', 'Estándar', 21150, 1, null, true, 6),
    (v_line, 'Gris Acero', '#8a9097', 'Estándar', null, 0, null, true, 7),
    (v_line, 'Verde', '#2e8b4a', 'Estándar', null, 0, null, true, 8),
    (v_line, 'Verde Fluo', '#43e02a', 'Fluo', null, 0, null, true, 9),
    (v_line, 'Naranja', '#f07b22', 'Estándar', null, 0, null, true, 10),
    (v_line, 'Fucsia', '#d6317e', 'Estándar', null, 0, null, true, 11),
    (v_line, 'Rosa', '#f3a0b8', 'Estándar', null, 6, null, true, 12),
    (v_line, 'Violeta', '#7b4bb3', 'Estándar', null, 0, null, true, 13),
    (v_line, 'Celeste', '#7cc4ec', 'Estándar', null, 0, null, true, 14),
    (v_line, 'Hueso', '#efe6d2', 'Estándar', null, 0, null, true, 15),
    (v_line, 'Rústico', '#a5714a', 'Estándar', null, 0, null, true, 16),
    (v_line, 'Habano', '#8b5a2b', 'Estándar', null, 0, null, true, 17),
    (v_line, 'Oro', '#caa13a', 'Estándar', null, 0, null, true, 18),
    (v_line, 'Cobre', '#b87333', 'Estándar', null, 0, null, true, 19),
    (v_line, 'Bronce', '#a0703c', 'Estándar', null, 0, null, true, 20),
    (v_line, 'Natural', '#efe8d8', 'Estándar', null, 1, null, true, 21);

  insert into public.filament_lines (brand, name, material, presentation, price, refill_price, accent, position)
  values ('3N3', '3nMax PLA', 'PLA', 'spool', 21000, null, '#d9a3c0', 1)
  returning id into v_line;
  insert into public.filament_colors (line_id, name, swatch, finish, price, stock, stock_refill, spool_available, position) values
    (v_line, 'Blanco', '#f7f5f0', 'Estándar', null, 0, null, true, 0),
    (v_line, 'Negro', '#1d1b19', 'Estándar', null, 0, null, true, 1),
    (v_line, 'Rojo', '#d0312d', 'Estándar', null, 0, null, true, 2),
    (v_line, 'Azul', '#2450b8', 'Estándar', null, 1, null, true, 3),
    (v_line, 'Amarillo', '#f2c230', 'Estándar', null, 0, null, true, 4),
    (v_line, 'Celeste', '#7cc4ec', 'Estándar', null, 4, null, true, 5),
    (v_line, 'Rosa', '#f3a0b8', 'Estándar', null, 0, null, true, 6),
    (v_line, 'Gris Plomo', '#6b6e72', 'Estándar', null, 0, null, true, 7),
    (v_line, 'Verde', '#2e8b4a', 'Estándar', null, 0, null, true, 8),
    (v_line, 'Lila', '#b39ddb', 'Estándar', null, 0, null, true, 9),
    (v_line, 'Uva', '#5b2a6e', 'Estándar', null, 1, null, true, 10),
    (v_line, 'Chocolate', '#5a3a24', 'Estándar', null, 0, null, true, 11),
    (v_line, 'Bronce', '#a0703c', 'Estándar', null, 0, null, true, 12);

  insert into public.filament_lines (brand, name, material, presentation, price, refill_price, accent, position)
  values ('3N3', 'PETG', 'PETG', 'spool', 20500, null, '#f0dca0', 2)
  returning id into v_line;
  insert into public.filament_colors (line_id, name, swatch, finish, price, stock, stock_refill, spool_available, position) values
    (v_line, 'Blanco', '#f7f5f0', 'Estándar', null, 0, null, true, 0),
    (v_line, 'Negro', '#1d1b19', 'Estándar', null, 5, null, true, 1),
    (v_line, 'Azul', '#2450b8', 'Estándar', null, 0, null, true, 2),
    (v_line, 'Rojo', '#d0312d', 'Estándar', null, 0, null, true, 3),
    (v_line, 'Gris Espacial', '#4a4e55', 'Estándar', null, 0, null, true, 4),
    (v_line, 'Bronce', '#a0703c', 'Estándar', null, 0, null, true, 5);

  insert into public.filament_lines (brand, name, material, presentation, price, refill_price, accent, position)
  values ('3N3', '3NFLEX', 'TPU', 'spool', 30000, null, '#cfc3e6', 3)
  returning id into v_line;
  insert into public.filament_colors (line_id, name, swatch, finish, price, stock, stock_refill, spool_available, position) values
    (v_line, 'Blanco TPU', '#f7f5f0', 'Estándar', null, 1, null, true, 0);

  insert into public.filament_lines (brand, name, material, presentation, price, refill_price, accent, position)
  values ('Flashforge', 'PLA', 'PLA', 'spool', 18000, null, '#cfe0e3', 4)
  returning id into v_line;
  insert into public.filament_colors (line_id, name, swatch, finish, price, stock, stock_refill, spool_available, position) values
    (v_line, 'Negro', '#1d1b19', 'Estándar', null, 1, null, true, 0);

  insert into public.filament_lines (brand, name, material, presentation, price, refill_price, accent, position)
  values ('Elegoo', 'PLA', 'PLA', 'spool', 25000, null, '#f5d6b8', 5)
  returning id into v_line;
  insert into public.filament_colors (line_id, name, swatch, finish, price, stock, stock_refill, spool_available, position) values
    (v_line, 'Blanco Rapid', '#f7f5f0', 'Rapid', null, 6, null, true, 0),
    (v_line, 'Amarillo Rapid', '#f2c230', 'Rapid', null, 2, null, true, 1),
    (v_line, 'Gris', '#8f9296', 'Estándar', null, 1, null, true, 2),
    (v_line, 'Traslúcido', 'rgba(220,230,235,.6)', 'Traslúcido', null, 1, null, true, 3),
    (v_line, 'Tricolor black-purple-blue', 'conic-gradient(#d0312d,#caa13a,#6a3d9a,#2e8b4a,#d0312d)', 'Multicolor', 30000, 0, null, true, 4),
    (v_line, 'Bicolor rojo-verde', 'conic-gradient(#d0312d,#caa13a,#6a3d9a,#2e8b4a,#d0312d)', 'Multicolor', 30000, 0, null, true, 5);

  insert into public.filament_lines (brand, name, material, presentation, price, refill_price, accent, position)
  values ('Grilon3', 'PLA', 'PLA', 'spool', 26600, null, '#a9c4ef', 6)
  returning id into v_line;
  insert into public.filament_colors (line_id, name, swatch, finish, price, stock, stock_refill, spool_available, position) values
    (v_line, 'Blanco', '#f7f5f0', 'Estándar', 25500, 1, null, true, 0),
    (v_line, 'Negro', '#1d1b19', 'Estándar', 25500, 3, null, true, 1),
    (v_line, 'Gris Plata', '#b9bcc0', 'Estándar', 25500, 0, null, true, 2),
    (v_line, 'Gris Espacial', '#4a4e55', 'Estándar', 25500, 0, null, true, 3),
    (v_line, 'Rojo', '#d0312d', 'Estándar', 25500, 0, null, true, 4),
    (v_line, 'Azul', '#2450b8', 'Estándar', 25500, 1, null, true, 5),
    (v_line, 'Violeta', '#7b4bb3', 'Estándar', null, 0, null, true, 6),
    (v_line, 'Verde', '#2e8b4a', 'Estándar', null, 2, null, true, 7),
    (v_line, 'Verde Manzana', '#7ac943', 'Estándar', null, 0, null, true, 8),
    (v_line, 'Rosa', '#f3a0b8', 'Estándar', null, 0, null, true, 9),
    (v_line, 'Fucsia', '#d6317e', 'Estándar', null, 2, null, true, 10),
    (v_line, 'Celeste', '#7cc4ec', 'Estándar', null, 0, null, true, 11),
    (v_line, 'Turquesa', '#2bb3b1', 'Estándar', null, 0, null, true, 12),
    (v_line, 'Azul Prusia', '#1f3a68', 'Estándar', null, 1, null, true, 13),
    (v_line, 'Bordó', '#6e1a2a', 'Estándar', null, 0, null, true, 14),
    (v_line, 'Dorado', '#caa13a', 'Estándar', null, 3, null, true, 15),
    (v_line, 'Bronce', '#a0703c', 'Estándar', null, 1, null, true, 16),
    (v_line, 'Cobre', '#b87333', 'Estándar', null, 0, null, true, 17),
    (v_line, 'Amarillo Fluo', '#e3f00a', 'Fluo', null, 0, null, true, 18),
    (v_line, 'Magenta Fluo', '#ff2fb3', 'Fluo', null, 0, null, true, 19),
    (v_line, 'Naranja Fluo', '#ff6a13', 'Fluo', null, 1, null, true, 20),
    (v_line, 'Verde Fluo', '#43e02a', 'Fluo', null, 0, null, true, 21),
    (v_line, 'Piel 162', '#f0c7a4', 'Estándar', null, 0, null, true, 22),
    (v_line, 'Piel 720', '#d9a07a', 'Estándar', null, 5, null, true, 23);

  insert into public.filament_lines (brand, name, material, presentation, price, refill_price, accent, position)
  values ('Grilon3', 'PLA especial', 'PLA especial', 'spool', 31000, null, '#f3b8d6', 7)
  returning id into v_line;
  insert into public.filament_colors (line_id, name, swatch, finish, price, stock, stock_refill, spool_available, position) values
    (v_line, 'Dorado Silk', 'linear-gradient(135deg,#caa13a,#fff 55%,#caa13a)', 'Silk', null, 0, null, true, 0),
    (v_line, 'Platino Silk', 'linear-gradient(135deg,#d8d8d4,#fff 55%,#d8d8d4)', 'Silk', null, 0, null, true, 1),
    (v_line, 'Blanco Perla Silk', 'linear-gradient(135deg,#f7f5f0,#fff 55%,#f7f5f0)', 'Silk', null, 0, null, true, 2),
    (v_line, 'Tutti Frutti Silk', 'conic-gradient(#d0312d,#caa13a,#6a3d9a,#2e8b4a,#d0312d)', 'Silk', null, 0, null, true, 3),
    (v_line, 'Chocolate Boutique', '#5a3a24', 'Boutique', 28800, 0, null, true, 4),
    (v_line, 'Dulce de leche Boutique', '#c89559', 'Boutique', 28800, 0, null, true, 5),
    (v_line, 'Salmón Boutique', '#f4a28c', 'Boutique', 28800, 1, null, true, 6),
    (v_line, 'Carpincho', '#9c7b56', 'Estándar', 28800, 3, null, true, 7),
    (v_line, 'Caoba Wood', '#6a2e1f', 'Wood', 35500, 0, null, true, 8),
    (v_line, 'Cerezo Wood', '#8e3b2e', 'Wood', 35500, 0, null, true, 9),
    (v_line, 'Nogal Wood', '#5e4230', 'Wood', 35500, 0, null, true, 10),
    (v_line, 'Pino Wood', '#d8b98a', 'Wood', 35500, 0, null, true, 11);

  insert into public.filament_lines (brand, name, material, presentation, price, refill_price, accent, position)
  values ('Grilon3', 'PETG', 'PETG', 'spool', 21500, null, '#8fb8bf', 8)
  returning id into v_line;
  insert into public.filament_colors (line_id, name, swatch, finish, price, stock, stock_refill, spool_available, position) values
    (v_line, 'Blanco', '#f7f5f0', 'Estándar', null, 0, null, true, 0),
    (v_line, 'Negro', '#1d1b19', 'Estándar', null, 0, null, true, 1),
    (v_line, 'Gris Plata', '#b9bcc0', 'Estándar', null, 0, null, true, 2),
    (v_line, 'Gris Acero', '#8a9097', 'Estándar', null, 0, null, true, 3),
    (v_line, 'NOVA', '#9aa7b5', 'Estándar', null, 0, null, true, 4),
    (v_line, 'Natural', '#efe8d8', 'Estándar', null, 0, null, true, 5),
    (v_line, 'Rojo Clear', '#d0312d99', 'Clear', null, 1, null, true, 6),
    (v_line, 'Amarillo Clear', '#f2c23099', 'Clear', null, 1, null, true, 7),
    (v_line, 'Verde Clear', '#2e8b4a99', 'Clear', null, 0, null, true, 8),
    (v_line, 'Azul Clear', '#2450b899', 'Clear', null, 0, null, true, 9),
    (v_line, 'Ámbar Clear', '#d98c1f99', 'Clear', null, 1, null, true, 10);

  insert into public.filament_lines (brand, name, material, presentation, price, refill_price, accent, position)
  values ('GST3D', 'PLA Lite', 'PLA', 'spool', 16500, null, '#f5c79a', 9)
  returning id into v_line;
  insert into public.filament_colors (line_id, name, swatch, finish, price, stock, stock_refill, spool_available, position) values
    (v_line, 'Black', '#1d1b19', 'Estándar', null, 0, null, true, 0),
    (v_line, 'White', '#f7f5f0', 'Estándar', null, 0, null, true, 1),
    (v_line, 'Sky blue', '#7cc4ec', 'Estándar', null, 0, null, true, 2),
    (v_line, 'Red', '#d0312d', 'Estándar', null, 0, null, true, 3),
    (v_line, 'Gold', '#caa13a', 'Estándar', null, 0, null, true, 4),
    (v_line, 'Gold Silk', 'linear-gradient(135deg,#caa13a,#fff 55%,#caa13a)', 'Silk', null, 0, null, true, 5),
    (v_line, 'Blue Silk', '#cfc7bd', 'Silk', 20000, 0, null, true, 6),
    (v_line, 'Silver', '#c0c3c7', 'Estándar', null, 0, null, true, 7),
    (v_line, 'Tricolor Silk Red Gold Orange Fluo', 'conic-gradient(#d0312d,#caa13a,#6a3d9a,#2e8b4a,#d0312d)', 'Silk', null, 0, null, true, 8);

  insert into public.filament_lines (brand, name, material, presentation, price, refill_price, accent, position)
  values ('Fila Nova', 'PLA', 'PLA', 'spool', 18000, null, '#a9c4ef', 10)
  returning id into v_line;
  insert into public.filament_colors (line_id, name, swatch, finish, price, stock, stock_refill, spool_available, position) values
    (v_line, 'Police Blue', '#1c2f6b', 'Estándar', null, 0, null, true, 0),
    (v_line, 'Gold World Cup', '#caa13a', 'Estándar', null, 2, null, true, 1);

  insert into public.filament_lines (brand, name, material, presentation, price, refill_price, accent, position)
  values ('Freemover', 'PLA', 'PLA', 'spool', 25000, null, '#e58a7a', 11)
  returning id into v_line;
  insert into public.filament_colors (line_id, name, swatch, finish, price, stock, stock_refill, spool_available, position) values
    (v_line, 'Tricolor Silk Rose Red Green', 'conic-gradient(#d0312d,#caa13a,#6a3d9a,#2e8b4a,#d0312d)', 'Silk', null, 0, null, true, 0),
    (v_line, 'Bicolor Silk Black Purple', 'conic-gradient(#d0312d,#caa13a,#6a3d9a,#2e8b4a,#d0312d)', 'Silk', null, 0, null, true, 1),
    (v_line, 'Matte Graphite Purple', '#4a4458', 'Mate', 22000, 0, null, true, 2),
    (v_line, 'Earth Brown', '#7a5230', 'Estándar', 16500, 0, null, true, 3),
    (v_line, 'Matte Lavender', '#b7a6d9', 'Mate', 20000, 0, null, true, 4),
    (v_line, 'Esmeralda', '#1f8a5e', 'Estándar', 20000, 0, null, true, 5),
    (v_line, 'Lava Orange', '#e5572a', 'Estándar', 16500, 0, null, true, 6);

  insert into public.filament_lines (brand, name, material, presentation, price, refill_price, accent, position)
  values ('Bambu Lab', 'PLA Lite', 'PLA', 'both', 25000, 21000, '#e98a8a', 12)
  returning id into v_line;
  insert into public.filament_colors (line_id, name, swatch, finish, price, stock, stock_refill, spool_available, position) values
    (v_line, 'Blanco', '#f7f5f0', 'Estándar', null, 0, 5, true, 0),
    (v_line, 'Negro', '#1d1b19', 'Estándar', null, 3, 2, true, 1),
    (v_line, 'Gris', '#8f9296', 'Estándar', null, 0, 0, true, 2),
    (v_line, 'Azul', '#2450b8', 'Estándar', null, 4, 0, true, 3),
    (v_line, 'Rojo', '#d0312d', 'Estándar', null, 2, 1, true, 4),
    (v_line, 'Celeste', '#7cc4ec', 'Estándar', null, 1, 2, true, 5),
    (v_line, 'Naranja', '#f07b22', 'Estándar', null, 0, 1, false, 6),
    (v_line, 'Verde', '#2e8b4a', 'Estándar', null, 0, 1, true, 7),
    (v_line, 'Amarillo Sunflower', '#f2b705', 'Estándar', null, 2, 1, true, 8),
    (v_line, 'Mate Beige', '#e5d3b3', 'Estándar', null, 1, 0, true, 9);

  insert into public.filament_lines (brand, name, material, presentation, price, refill_price, accent, position)
  values ('Bambu Lab', 'PLA', 'PLA', 'spool', 56000, null, '#f5d98a', 13)
  returning id into v_line;
  insert into public.filament_colors (line_id, name, swatch, finish, price, stock, stock_refill, spool_available, position) values
    (v_line, 'Beige', '#e5d3b3', 'Estándar', null, 2, null, true, 0),
    (v_line, 'Silver', '#c0c3c7', 'Estándar', null, 1, null, true, 1);
end;
$$;
