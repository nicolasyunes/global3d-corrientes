-- Catálogo inicial de la tienda: agrupa los productos existentes en familias
-- con sus variantes, suma dos familias a pedido (trofeo de pádel y llaveros
-- con logo) y carga los datos públicos del local. Solo inserta; no modifica
-- products. Los productos se vinculan por nombre exacto: si alguno cambió de
-- nombre, simplemente queda sin vincular.

-- ---------------------------------------------------------------------------
-- Familias con variantes
-- ---------------------------------------------------------------------------
insert into public.shop_families
  (slug, name, category, description, sale_mode, lead_days, min_qty,
   option_axes, personalization, price_from, featured, position, published)
values
  ('vaso-camiseta', 'Vaso camiseta', 'vasos',
   'Vaso con textura de camiseta de fútbol, impreso en 3D en PLA. Sumale un nombre o una frase. Lavalo a mano: el PLA se deforma con agua muy caliente.',
   'stock', 3, 1,
   '[{"key":"tamano","label":"Tamaño"},{"key":"diseno","label":"Equipo"}]',
   '[{"key":"nombre","label":"Nombre (opcional)","type":"text","max":20,"placeholder":"Ej: Facu"},{"key":"frase","label":"Frase en el reverso (opcional)","type":"text","max":40,"placeholder":"Ej: Los chicos del puesto 45"}]',
   null, true, 10, true),
  ('vaso-texturizado', 'Vaso fernetero texturizado', 'vasos',
   'Vaso fernetero con textura, en los colores de tu club. Con o sin manija. Lavalo a mano: el PLA se deforma con agua muy caliente.',
   'stock', 3, 1,
   '[{"key":"tamano","label":"Tamaño"},{"key":"diseno","label":"Diseño"}]',
   '[{"key":"nombre","label":"Nombre (opcional)","type":"text","max":20,"placeholder":"Ej: Rattin"},{"key":"frase","label":"Frase en el reverso (opcional)","type":"text","max":40}]',
   null, true, 20, true),
  ('vaso-ferchetto', 'Vaso Ferchetto 500 ml', 'vasos',
   'Vaso Ferchetto de 500 ml impreso en 3D.',
   'stock', 3, 1,
   '[{"key":"diseno","label":"Diseño"}]',
   '[{"key":"nombre","label":"Nombre (opcional)","type":"text","max":20}]',
   null, false, 30, true),
  ('vaso-copa-fernetera', 'Vaso Copa del Mundo fernetero 1 L', 'vasos',
   'Vaso fernetero de 1 litro con forma de Copa del Mundo.',
   'stock', 4, 1, '[]', '[]', null, false, 40, true),
  ('vaso-milkshake', 'Vaso milkshake con figura', 'milkshake',
   'Vaso milkshake con la figura de tu personaje favorito arriba. Ideal para regalar.',
   'stock', 4, 1,
   '[{"key":"diseno","label":"Figura"}]', '[]',
   null, true, 50, true),
  ('box-regalo', 'Box de regalo', 'regalos',
   'Box armado para regalar, con vaso a elección. Podés sumar un nombre.',
   'stock', 3, 1,
   '[{"key":"modelo","label":"Modelo"}]',
   '[{"key":"nombre","label":"Nombre para el vaso (opcional)","type":"text","max":20},{"key":"equipo","label":"Equipo o colores del vaso (opcional)","type":"text","max":30}]',
   null, true, 60, true),
  ('portalatas', 'Portalatas', 'regalos',
   'Portalatas impreso en 3D, en los colores de tu club. Le podés agregar un nombre.',
   'stock', 3, 1,
   '[{"key":"diseno","label":"Diseño"}]',
   '[{"key":"nombre","label":"Nombre (opcional)","type":"text","max":16}]',
   null, true, 70, true),
  ('despolvillador', 'Despolvillador', 'regalos',
   'Despolvillador para yerba impreso en 3D.',
   'stock', 3, 1, '[{"key":"diseno","label":"Diseño"}]', '[]', null, false, 80, true),
  ('mate', 'Mate impreso en 3D', 'regalos',
   'Mate impreso en 3D con diseño.',
   'stock', 3, 1, '[{"key":"diseno","label":"Diseño"}]', '[]', null, false, 90, true);

-- ---------------------------------------------------------------------------
-- Familias a pedido (sin stock; se fabrican con tus datos)
-- ---------------------------------------------------------------------------
insert into public.shop_families
  (slug, name, category, description, sale_mode, lead_days, min_qty,
   option_axes, personalization, price_from, featured, position, published)
values
  ('trofeo-padel', 'Trofeo de pádel con nombre', 'trofeos',
   'Paleta con base y placa con el nombre del torneo y la categoría. Para torneos y clubes.',
   'a_pedido', 5, 6, '[]',
   '[{"key":"torneo","label":"Torneo y categoría","type":"text","max":60,"required":true,"placeholder":"Ej: Torneo aniversario · 6ta damas"},{"key":"colores","label":"Colores","type":"text","max":40,"placeholder":"Ej: base negra, paleta amarilla"}]',
   10000, true, 100, true),
  ('llaveros-logo', 'Llaveros con tu logo', 'llaveros',
   'Llavero plano con el logo de tu negocio o evento, en dos colores. El logo nos lo mandás por WhatsApp y antes de imprimir te pasamos una prueba.',
   'a_pedido', 4, 20, '[]',
   '[{"key":"texto","label":"Texto o nombre del negocio","type":"text","max":30,"required":true},{"key":"colores","label":"Colores","type":"text","max":40,"placeholder":"Ej: base negra y logo blanco"}]',
   1200, true, 110, true);

-- ---------------------------------------------------------------------------
-- Productos sueltos: una familia por producto
-- ---------------------------------------------------------------------------
insert into public.shop_families
  (slug, name, category, sale_mode, lead_days, min_qty, featured, position, published)
values
  ('trofeo-guante-boxeo', 'Trofeo guante de boxeo 25 cm', 'trofeos', 'stock', 5, 1, false, 120, true),
  ('copa-piston', 'Copa Pistón 15 cm', 'trofeos', 'stock', 5, 1, false, 130, true),
  ('llavero-flexi-spiderman', 'Llavero flexi araña', 'llaveros', 'stock', 3, 1, false, 140, true),
  ('llavero-friends', 'Llavero Friends', 'llaveros', 'stock', 3, 1, false, 150, true),
  ('chimuelo-articulado', 'Dragón articulado', 'figuras', 'stock', 5, 1, false, 160, true),
  ('figura-arana-20', 'Figura hombre araña 20 cm', 'figuras', 'stock', 5, 1, false, 170, true),
  ('mascara-arana', 'Máscara hombre araña', 'figuras', 'stock', 7, 1, false, 180, true),
  ('varita-magica-arana', 'Varita mágica araña', 'figuras', 'stock', 4, 1, false, 190, true),
  ('tetris-balance', 'Tetris Balance', 'juegos', 'stock', 5, 1, true, 200, true),
  ('tateti', 'Tateti', 'juegos', 'stock', 3, 1, false, 210, true),
  ('ruleta', 'Ruleta 20 cm', 'juegos', 'stock', 4, 1, false, 220, true),
  ('lampara-retro', 'Lámpara retro', 'hogar', 'stock', 5, 1, false, 230, true),
  ('soporte-celular', 'Soporte para celular acanalado', 'hogar', 'stock', 3, 1, false, 240, true),
  ('bolsita-fantasma', 'Bolsita fantasma', 'hogar', 'stock', 3, 1, false, 250, true),
  ('porta-botellas-tactico', 'Portabotellas táctico', 'hogar', 'stock', 4, 1, false, 260, true),
  ('craneo-trigemino', 'Cráneo con nervio trigémino', 'didactico', 'stock', 7, 1, false, 270, true),
  ('mandibula-articulada', 'Mandíbula articulada', 'didactico', 'stock', 7, 1, false, 280, true),
  ('cianoacrilato', 'Cianoacrilato', 'insumos', 'stock', 0, 1, false, 290, true),
  ('activador-cianoacrilato', 'Activador de cianoacrilato', 'insumos', 'stock', 0, 1, false, 300, true);

-- ---------------------------------------------------------------------------
-- Vínculo producto → familia con sus opciones
-- ---------------------------------------------------------------------------
with m (slug, product_name, opts, pos) as (
  values
    ('vaso-camiseta', 'Vaso Camiseta 650 ml RIVER', '{"tamano":"650 ml","diseno":"River"}', 1),
    ('vaso-camiseta', 'Vaso Camiseta 1lt RIVER', '{"tamano":"1 L","diseno":"River"}', 2),
    ('vaso-camiseta', 'Vaso Camiseta 650 ml BOCA', '{"tamano":"650 ml","diseno":"Boca"}', 3),
    ('vaso-camiseta', 'Vaso Camiseta 650ml Mandiyu', '{"tamano":"650 ml","diseno":"Mandiyú"}', 4),
    ('vaso-camiseta', 'Vaso Camiseta 1 lt Mandiyu', '{"tamano":"1 L","diseno":"Mandiyú"}', 5),
    ('vaso-camiseta', 'Vaso Camiseta 1lt AFA', '{"tamano":"1 L","diseno":"Argentina"}', 6),
    ('vaso-texturizado', 'Vaso Texturizado 650 ml BOCA', '{"tamano":"650 ml","diseno":"Boca"}', 1),
    ('vaso-texturizado', 'Vaso Texturizado 2025 650 ml BOCA', '{"tamano":"650 ml","diseno":"Boca 2025"}', 2),
    ('vaso-texturizado', 'Vaso Texturizado 2025 650 ml RIVER', '{"tamano":"650 ml","diseno":"River 2025"}', 3),
    ('vaso-texturizado', 'Vaso Texturizado 650 ml RIVER negro', '{"tamano":"650 ml","diseno":"River negro"}', 4),
    ('vaso-texturizado', 'Vaso Texturizado 650 ml AFA', '{"tamano":"650 ml","diseno":"Argentina"}', 5),
    ('vaso-texturizado', 'Vaso Texturizado 1 lt RIVER rojo', '{"tamano":"1 L","diseno":"River rojo"}', 6),
    ('vaso-texturizado', 'Vaso Texturizado 2025 1lt BOCA', '{"tamano":"1 L","diseno":"Boca 2025"}', 7),
    ('vaso-texturizado', 'Vaso Texturizado 2026 1lt Un Poco de Chisme', '{"tamano":"1 L","diseno":"Un poco de chisme"}', 8),
    ('vaso-texturizado', 'Vaso Texturizado sin manija 1lt BOCA', '{"tamano":"1 L sin manija","diseno":"Boca"}', 9),
    ('vaso-texturizado', 'Vaso Texturizado sin manija 1lt RIVER', '{"tamano":"1 L sin manija","diseno":"River"}', 10),
    ('vaso-ferchetto', 'Vaso Ferchetto 500 ml RIVER blanco', '{"diseno":"River blanco"}', 1),
    ('vaso-ferchetto', 'Vaso Ferchetto 500 ml RIVER negro', '{"diseno":"River negro"}', 2),
    ('vaso-copa-fernetera', 'Vaso Copa del Mundo Fernetera 1 lt', '{}', 1),
    ('vaso-milkshake', 'Vaso Milkshake Spiderman', '{"diseno":"Hombre araña"}', 1),
    ('vaso-milkshake', 'Vaso Milkshake Toy Story REX', '{"diseno":"Rex"}', 2),
    ('vaso-milkshake', 'Vaso Milkshake Toy Story WOODY', '{"diseno":"Woody"}', 3),
    ('vaso-milkshake', 'Vaso Milkshake Toy Story BUZZ', '{"diseno":"Buzz"}', 4),
    ('vaso-milkshake', 'Vaso Milkshake Toy Story HAMM', '{"diseno":"Hamm"}', 5),
    ('vaso-milkshake', 'Vaso Milkshake Toy Story JESSIE', '{"diseno":"Jessie"}', 6),
    ('vaso-milkshake', 'Vaso Milkshake Toy Story LOTSO', '{"diseno":"Lotso"}', 7),
    ('vaso-milkshake', 'Vaso Milkshake Toy Story MARCIANITO', '{"diseno":"Marcianito"}', 8),
    ('vaso-milkshake', 'Vaso Milkshake Chimuelo', '{"diseno":"Dragón"}', 9),
    ('vaso-milkshake', 'Vaso Milkshake Creeper', '{"diseno":"Creeper"}', 10),
    ('vaso-milkshake', 'Vaso Milkshake Goku', '{"diseno":"Goku"}', 11),
    ('vaso-milkshake', 'Vaso Milkshake Guerreras K-Pop MIRA', '{"diseno":"K-Pop Mira"}', 12),
    ('vaso-milkshake', 'Vaso Milkshake Guerreras K-Pop RUMI', '{"diseno":"K-Pop Rumi"}', 13),
    ('vaso-milkshake', 'Vaso Milkshake Mario Bros', '{"diseno":"Mario"}', 14),
    ('vaso-milkshake', 'Vaso Milkshake Plants vs Zombies', '{"diseno":"Plantas vs zombies"}', 15),
    ('vaso-milkshake', 'Vaso Milkshake Sonic', '{"diseno":"Sonic"}', 16),
    ('box-regalo', 'BOX CERVECERO 1lt', '{"modelo":"Box cervecero 1 L"}', 1),
    ('box-regalo', 'Bandeja Cervecera para Regalo', '{"modelo":"Bandeja cervecera"}', 2),
    ('box-regalo', 'BOX MATERO', '{"modelo":"Box matero"}', 3),
    ('portalatas', 'Portalatas AFA', '{"diseno":"Argentina"}', 1),
    ('portalatas', 'Portalatas Boca blanco', '{"diseno":"Boca blanco"}', 2),
    ('portalatas', 'Portalatas RIVER blanco', '{"diseno":"River blanco"}', 3),
    ('portalatas', 'Portalatas River rojo', '{"diseno":"River rojo"}', 4),
    ('despolvillador', 'Despolvillador Boca River', '{"diseno":"Boca y River"}', 1),
    ('despolvillador', 'Despolvillador Boca', '{"diseno":"Boca"}', 2),
    ('despolvillador', 'Despolvillador River Negro', '{"diseno":"River negro"}', 3),
    ('mate', 'Mate Bombonera', '{"diseno":"Bombonera"}', 1),
    ('mate', 'Mate Ceresita', '{"diseno":"Cerecita"}', 2),
    ('mate', 'Mate River rojo', '{"diseno":"River rojo"}', 3),
    ('trofeo-guante-boxeo', 'Trofeo Guante de Boxeo (25 cm de alto)', '{}', 1),
    ('copa-piston', 'Copa Piston 15 cm de alto', '{}', 1),
    ('llavero-flexi-spiderman', 'Llavero Flexi Spiderman', '{}', 1),
    ('llavero-friends', 'Llavero Friends', '{}', 1),
    ('chimuelo-articulado', 'Chimuelo Articulado', '{}', 1),
    ('figura-arana-20', 'Figura Spiderman 20 cm de alto', '{}', 1),
    ('mascara-arana', 'Mascara Spiderman', '{}', 1),
    ('varita-magica-arana', 'Varita Mágica Araña', '{}', 1),
    ('tetris-balance', 'Tetris Balance', '{}', 1),
    ('tateti', 'Tateti', '{}', 1),
    ('ruleta', 'Ruleta 20 cm de alto', '{}', 1),
    ('lampara-retro', 'Lampara Retro', '{}', 1),
    ('soporte-celular', 'Soporte para Celular acanalado', '{}', 1),
    ('bolsita-fantasma', 'Bolsita Fantasma', '{}', 1),
    ('porta-botellas-tactico', 'Porta botellas tactico', '{}', 1),
    ('craneo-trigemino', 'Craneo con nervio trigemino', '{}', 1),
    ('mandibula-articulada', 'Mandibula Articulada', '{}', 1),
    ('cianoacrilato', 'Cianoacrilato', '{}', 1),
    ('activador-cianoacrilato', 'Activador de cianoacrilato', '{}', 1)
)
insert into public.shop_family_products (product_id, family_id, option_values, position)
select distinct on (p.id) p.id, f.id, m.opts::jsonb, m.pos
from m
join public.products p on p.name = m.product_name
join public.shop_families f on f.slug = m.slug
order by p.id, p.created_at
on conflict (product_id) do nothing;

-- ---------------------------------------------------------------------------
-- Datos públicos del local
-- ---------------------------------------------------------------------------
insert into public.shop_settings (key, value) values
  ('whatsapp', '"5493794684473"'),
  ('instagram', '"global3d_corrientes"'),
  ('local', '{"direccion":"Junín 862, Corrientes","horarios":"De 9 a 12:30 y de 16:30 a 21 hs","mapsQuery":"Junín 862, Corrientes, Argentina"}'),
  ('transferencia', '{"alias":"global3d.corrientes","cbu":"3840200500000008276162","titular":"Agustina Alejandra Romero Lucena","banco":"Ualá Bank S.A.U."}'),
  ('sena', '{"porcentaje":50}'),
  ('envios', '{"corrientes":"A coordinar por WhatsApp según la zona","pais":"Te pasamos el costo por WhatsApp antes de despachar"}')
on conflict (key) do nothing;
