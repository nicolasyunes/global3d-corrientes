-- Archivos que adjunta el cliente en "Pedido a medida" de la tienda (logo,
-- foto de referencia, plano). Se suben sin sesión y el link va en el mensaje
-- de WhatsApp, así que el bucket es de lectura pública por link. Nadie puede
-- listarlo, pisar ni borrar archivos desde la tienda: anon solo sube, en la
-- carpeta a-medida/, con nombre aleatorio. Máximo 10 MB y solo PNG, JPEG,
-- SVG o PDF.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-quote-files',
  'shop-quote-files',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf']
);

create policy shop_quote_files_anon_insert
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'shop-quote-files'
    and (storage.foldername(name))[1] = 'a-medida'
    and array_length(storage.foldername(name), 1) = 2
  );

-- El taller los ve y los limpia desde el panel.
create policy shop_quote_files_staff_read
  on storage.objects for select to authenticated
  using (bucket_id = 'shop-quote-files');

create policy shop_quote_files_staff_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'shop-quote-files');
