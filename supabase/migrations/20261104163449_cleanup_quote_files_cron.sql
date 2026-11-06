-- Borra todos los días los archivos de "Pedido a medida" con más de 30 días
-- (edge function cleanup-quote-files, que usa la API de Storage).
-- 9:00 UTC = 6:00 en Argentina.
create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-quote-files',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://bukjmleercxlxbexekos.supabase.co/functions/v1/cleanup-quote-files',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
