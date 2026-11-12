-- Subcategoría de cada familia (dentro de su categoría), para filtrar productos
-- en el admin. Texto libre; null = sin subcategoría. Carga inicial propuesta
-- a partir de los nombres, para que el dueño la revise.
-- Aplicada en Supabase el 2026-11-12 vía MCP.

alter table public.shop_families add column subcategory text;

comment on column public.shop_families.subcategory is
  'Subcategoría dentro de category (ej. trofeos → Pádel). Null = sin subcategoría.';

update public.shop_families f
set subcategory = v.sub
from (values
  ('craneo-trigemino', 'Anatomía'),
  ('mandibula-articulada', 'Anatomía'),
  ('chimuelo-articulado', 'Personajes'),
  ('figura-diosa-hecate-28cm', 'Personajes'),
  ('figura-arana-20', 'Personajes'),
  ('figura-pikachu-30cm', 'Personajes'),
  ('munecos-stranger-things', 'Personajes'),
  ('figura-funko-messi-18cm', 'Funko'),
  ('figura-funko-michael-jackson', 'Funko'),
  ('huevos-golosineros-alcancias-boca-river', 'Alcancías'),
  ('huevos-golosineros-alcancias-capibara', 'Alcancías'),
  ('huevos-golosineros-alcancias-stitch', 'Alcancías'),
  ('mascara-arana', 'Disfraces'),
  ('varita-magica-arana', 'Disfraces'),
  ('bolsita-fantasma', 'Decoración'),
  ('lampara-retro', 'Decoración'),
  ('letrero-inicial-nombre', 'Decoración'),
  ('porta-botellas-tactico', 'Organización'),
  ('soporte-celular', 'Organización'),
  ('activador-cianoacrilato', 'Pegamentos'),
  ('cianoacrilato', 'Pegamentos'),
  ('portalapices-mario-bros', 'Escritorio'),
  ('ruleta', 'Juegos de mesa'),
  ('tateti', 'Juegos de mesa'),
  ('tetris-balance', 'Juegos de mesa'),
  ('llaveros-logo', 'Personalizados'),
  ('llaveros-portacelular-personalizable', 'Personalizados'),
  ('llavero-boca-juniors-la-bombonera', 'Fútbol y deportes'),
  ('llavero-porta-celular-afa', 'Fútbol y deportes'),
  ('llaveros-formula-1', 'Fútbol y deportes'),
  ('llavero-minecraft', 'Personajes'),
  ('llavero-capibara', 'Personajes'),
  ('llavero-flexi-spiderman', 'Personajes'),
  ('llavero-friends', 'Personajes'),
  ('vaso-milkshake', 'Personajes'),
  ('vaso-milkshake-demogorgon-stranger-things', 'Personajes'),
  ('vaso-milkshake-vecna-stranger-things', 'Personajes'),
  ('vasos-afa-milkshake', 'Fútbol'),
  ('box-regalo', 'Varios'),
  ('despolvillador', 'Varios'),
  ('mate', 'Mate y bebidas'),
  ('portalatas', 'Mate y bebidas'),
  ('trofeo-padel-personalizado', 'Pádel'),
  ('trofeo-padel-personalizado-18cm', 'Pádel'),
  ('trofeo-padel-personalizado-18cm-2', 'Pádel'),
  ('trofeo-paleta-padel', 'Pádel'),
  ('copa-piston', 'Deportes'),
  ('trofeo-basquet-30cm', 'Deportes'),
  ('trofeo-de-pool', 'Deportes'),
  ('trofeo-guante-boxeo', 'Deportes'),
  ('medallas-personalizables-con-logo', 'Medallas'),
  ('trofeo-padel', 'Medallas'),
  ('trofeo-personalizable-15cm', 'Genéricos'),
  ('trofeo-primer-lugar-giratorio', 'Genéricos'),
  ('trofeo-reconocimeinto-18cm', 'Genéricos'),
  ('vaso-copa-fernetera', 'Ferneteros'),
  ('vaso-ferchetto', 'Ferneteros'),
  ('vaso-texturizado', 'Ferneteros'),
  ('porta-lata-cerveza-473cc-personalizable', 'Porta latas'),
  ('porta-lata-coca-cola-354-cc', 'Porta latas'),
  ('vaso-camiseta', 'Fútbol')
) as v(slug, sub)
where f.slug = v.slug;
