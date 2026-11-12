-- Fotos propias de una familia de la tienda, para las que se venden a pedido
-- y no tienen productos asociados (la tienda toma las fotos de los productos).
-- shop_catalog() las devuelve en `images`; la tienda las usa si la familia no
-- tiene fotos de productos.

alter table public.shop_families
  add column images text[] not null default '{}';

create or replace function public.shop_catalog()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', f.slug,
    'name', f.name,
    'category', f.category,
    'description', f.description,
    'saleMode', f.sale_mode,
    'leadDays', f.lead_days,
    'minQty', f.min_qty,
    'optionAxes', f.option_axes,
    'personalization', f.personalization,
    'priceFrom', f.price_from,
    'featured', f.featured,
    'images', to_jsonb(f.images),
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'description', p.description,
        'options', fp.option_values,
        'price', p.base_price,
        'stock', greatest(coalesce(p.stock_quantity, 0), 0),
        'images', coalesce(
          (select jsonb_agg(i.url order by i.position)
             from public.product_images i where i.product_id = p.id),
          case when p.image_url is not null
               then jsonb_build_array(p.image_url) else '[]'::jsonb end)
      ) order by fp.position, p.base_price, p.name)
      from public.shop_family_products fp
      join public.products p on p.id = fp.product_id
      where fp.family_id = f.id and p.active
    ), '[]'::jsonb)
  ) order by f.position, f.name), '[]'::jsonb)
  from public.shop_families f
  where f.published;
$$;

-- Premiaciones: trofeos y medallas personalizados (fotos de un torneo real).
update public.shop_families
set
  name = 'Trofeos y medallas para premiaciones',
  description = 'Trofeos, medallas y reconocimientos con el logo y los nombres de tu torneo, club o empresa. Antes de imprimir te pasamos una prueba del diseño.',
  images = array[
    '/tienda/familias/premiaciones-1.jpg',
    '/tienda/familias/premiaciones-2.jpg',
    '/tienda/familias/premiaciones-3.jpg'
  ]
where slug = 'trofeo-padel';
