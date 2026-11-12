# Global3D — admin + generadores 3D

Taller de impresión 3D Global3D (Corrientes). Admin en React + Vite + Supabase, más generadores 3D en `apps/herramientas/`.

- Producción: https://global3d-corrientes.vercel.app — Vercel despliega solo al mergear a `master`.
- Supabase: proyecto `bukjmleercxlxbexekos` (Global-3D-Corrientes), vía conector MCP.
- Admin solo interno (login del taller + PIN por persona). El sync con Google Sheets se eliminó en la Fase 1 (2026-09-29/30). La tienda pública se reabrió en noviembre 2026 como app nueva en `apps/tienda` (ver abajo).
- Idioma: respondé en español rioplatense.

## Reglas de trabajo

- El usuario inicia sesión y pone el PIN. Nunca escribir sus contraseñas ni su PIN.
- Pedir permiso antes de descargar algo.
- No copiar código de LetraMaker; solo es referencia funcional.
- No commitear archivos locales: `.claude/launch.json`, `.atl/*`, `prompt-taller-3d.md`, `test-output.txt` (tampoco los `.xlsx` sueltos).
- Si algo falla varias veces seguidas, parar y preguntar.
- Antes de trabajar, crear una rama nueva desde `master`.

## Comandos

- `npm run dev` — admin (5173). `npm run dev:herramientas` — generadores (5200).
- `npm run build` — arma el admin y las herramientas en `dist/herramientas`.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run gen:types`.
- En desarrollo el Vite del admin hace proxy de `/herramientas` al puerto 5200.
- Las herramientas usan su propia caché de Vite (`node_modules/.vite-herramientas`); con la caché compartida aparece "Failed to fetch dynamically imported module".
- `vercel.json` tiene los rewrites de `/herramientas/`.

## Generadores 3D (`apps/herramientas/`)

Páginas: `index`, `llavero`, `vaso`, `letra-caja` (la principal). Usan manifold-3d (WASM) y three.js. Exportan 3MF, STL y DXF. Documentación y comparación con LetraMaker: `apps/herramientas/ESTILOS-LETRA-CAJA.md`.

`letra-caja.html`:
- Estilos de 3 piezas (`tresRebaje`, `apoyoDoble`, `ajusteTrasero`): contorno, frente y base. Base impresa en 3D o en PVC por DXF (espesor máx. 50), un DXF por placa. También `apoyoUnico` y opción espejo.
- Curva: se revoluciona sobre eje horizontal (con espejo y giro 180° para que el texto se lea bien). Parámetros: margen, fondo, avance, redondeo, base, radio (100 por defecto), ángulo (10–180°).
- Orgánica: inclinación del relieve `orgIncl` (0–20 mm).
- Editor 2D de agujeros: canvas con posición y diámetro a medida dentro de la zona libre de cada pieza. Los agujeros (cable y tornillos) arrancan apagados.
- En modos con rebaje, "espesor de pared" se muestra como "Pared exterior". Letras numeradas de izquierda a derecha.
- Las medidas coinciden con LetraMaker en todos los estilos; única diferencia: LED doble, +1.7 en Y del lado de LetraMaker (sin explicación).

## Diseños guardados (Supabase)

- Tabla `designs` (RLS para autenticados) y bucket `design-files` (lectura pública, máx. 50 MB). Migración: `supabase/migrations/20261006165031_designs.sql`.
- Panel en letra-caja: `apps/herramientas/src/disenos.ts` — vincula diseño a pedido; guardar, guardar como nuevo, abrir, borrar. Acepta `?diseno=` y `?pedido=`. Comparte sesión con el admin y lee el operador de `localStorage` (`g3d.operator`).
- Admin: `src/features/designs/` (`designs.api.ts`, `OrderDesigns.tsx`) = tarjeta "Diseños 3D" del pedido. Admin → Herramientas → pestaña "Generadores 3D".

## Tienda pública (`apps/tienda/`, servida en `/tienda`)

- Vite + React aparte (`npm run dev:tienda`, puerto 5300; build a `dist/tienda`). Router con basename `/tienda`. Rewrites en `vercel.json`.
- Catálogo → carrito (localStorage `g3d.tienda.cart.v1`) → checkout → `/pedido/:token` con datos de transferencia y botón que abre WhatsApp con el pedido escrito. Modo claro/oscuro.
- Supabase: migraciones `20261103192959_shop_storefront.sql` y `20261103193215_shop_families_seed.sql`. Tablas `shop_families`, `shop_family_products`, `shop_settings`, `shop_orders` (RLS solo autenticados). El rol anon solo usa RPC SECURITY DEFINER: `shop_catalog`, `shop_filaments`, `shop_settings`, `shop_create_order` (precios desde la base, límite de pedidos por WhatsApp) y `shop_order_status`.
- Los pedidos web entran a `orders` con estado `new` y `origin_channel = 'web'`, así aparecen en el admin.
- Datos del local, WhatsApp, alias/CBU y % de seña se editan en `shop_settings`; familias/variantes en `shop_families` y `shop_family_products`.
- Instagram: edge function `instagram-feed` (Instagram API with Instagram Login) con caché de 30 min en `shop_instagram` (sin acceso para anon ni authenticated). El token inicial va en el secret `INSTAGRAM_TOKEN`; la función lo renueva sola y guarda el nuevo en la tabla. Mientras no haya token, muestra con el embed oficial las publicaciones elegidas a mano en `shop_settings.instagram_posts` (array de links, máximo 6). Sin ninguna de las dos, la sección no se muestra. **Oculta desde 2026-11-10**: solo aparece si `shop_settings.instagram_visible` es `true` (sin esa clave o en `false` no se renderiza ni carga nada de Instagram). Los links elegidos siguen guardados en `instagram_posts`.
- Reels ("Mirá cómo quedan", `components/Reels.tsx`, `lib/reels.ts`): lista en `shop_settings.reels`, array de `{video, poster?, titulo?, link?}` (máx. 8). `video` y `poster` son `https://…` o un archivo bajo `apps/tienda/public/reels/` (p. ej. `reels/vaso.mp4`); `link` es el reel de Instagram. Se reproducen solos, mudos y en loop mientras se ven; sin reels cargados la sección no aparece. Van en la home entre "Los más pedidos" y "Cómo comprar".
- Pedido a medida: adjuntos (PNG/JPG/SVG/PDF, 3 × 10 MB) al bucket `shop-quote-files`, carpeta `a-medida/AAAA-MM/`; anon solo sube, los links van en el WhatsApp. pg_cron llama a diario a la edge function `cleanup-quote-files`, que borra los de más de 30 días.
- Fotos en producción: `/_vercel/image` (`images` en `vercel.json`), con fallback a la original.

## Envíos por Correo Argentino (API MiCorreo)

- Edge function `correo-cotizar`: saca el token (JWT, con caché y un reintento si vence) y llama a `/rates/packages` y `/agencies`. Secrets: `MICORREO_USER`, `MICORREO_PASSWORD`, `MICORREO_CUSTOMER_ID` y `MICORREO_ENV` (`prod` usa `api.correoargentino.com.ar`; cualquier otro valor, `apitest`). Sin credenciales responde 503 y la tienda vuelve a "a cotizar". La lógica pura está en `lib.ts`, con tests en vitest.
- Migración `20261106180111_shop_correo_envios.sql`: cajas y CP de origen en `shop_settings.correo`; `ship_box` en `products` (si es null usa el de `shop_families`); tabla `shipping_quotes` (sin políticas: solo service role); `shop_shipping_boxes(items)` cuenta las cajas del carrito.
- `shop_create_order` con `delivery.shipping` valida que la cotización esté vigente y sea del mismo carrito, suma el envío al total y lo agrega como ítem. El precio sale siempre de `shipping_quotes`, nunca del navegador. Sin `shipping` se comporta como antes.
- El descuento por efectivo/transferencia es solo sobre los productos; el envío va entero y se cobra completo con la seña.
- Tienda: `apps/tienda/src/components/CorreoShipping.tsx` (carrito y checkout) y `lib/shipping.ts`.
- Admin: `src/features/shipping/` = pantalla **Cotizar envío** (`/admin/envios`), con cajas o medidas a mano y copiar para WhatsApp. Las cajas y el CP de origen los edita el admin desde ahí. La caja de cada producto se elige en su ficha ("Tienda online").
- PAQ.AR es otra API (alta de envíos, rótulos, seguimiento, con `agreement` + API-Key). Todavía no se usa.

## Envíos por Andreani

- Edge function `andreani-quote`, junto a `correo-cotizar`: la tienda cotiza las dos a la vez (`api.quoteShipping` → `mergeQuotes`) y alcanza con que una responda. Si ninguna está configurada, vuelve a "a cotizar".
- API (confirmada en el plugin oficial `andreani-publico/magento-2.3`; la doc de developers.andreani.com es una SPA): `GET /login` con Basic Auth → token en el header `x-authorization-token` (24 h, se guarda en memoria y se reintenta una vez si da 401). `GET /v1/tarifas?cpDestino&contrato&cliente&sucursalOrigen&bultos[0][kilos|volumen|valorDeclarado]` → precio en `tarifaConIva.total`. Sucursales: `GET /v2/sucursales?canal=B2C&seHaceAtencionAlCliente=true` (pública).
- Bulto: usa las mismas cajas que Correo (`shop_shipping_boxes` + `shop_settings.correo.cajas`); suma kg y cm³ en un solo bulto. Valor declarado = precio del carrito según la base.
- Secrets: `ANDREANI_USER`, `ANDREANI_PASSWORD`, `ANDREANI_CLIENTE`, `ANDREANI_CONTRATO_DOMICILIO` y/o `ANDREANI_CONTRATO_SUCURSAL` (sin uno, esa opción no aparece), `ANDREANI_ENV` (`prod` = `apis.andreani.com`; otro valor = `apisqa`). Opcionales: `ANDREANI_SUCURSAL_ORIGEN`, `ANDREANI_BASE_URL`.
- Migración `20261112150000_shop_andreani_envios.sql`: `shipping_quotes.carrier` (`correo` | `andreani`); `shop_create_order` toma la empresa de la cotización guardada. Tarifas de Andreani con `productType` `AN`.
- Tienda: cada tarifa trae `carrier` y su `quoteId`; el componente sigue siendo `CorreoShipping.tsx`. Sucursales de Correo por provincia, las de Andreani por CP.

## Imagen a SVG (`src/features/tools/vectorize.ts`)

- Usa `vtracer-wasm` (MIT): posteriza, luego `to_svg` en modo polygon (jerarquía cutout, `colorPrecision` 0). El modo spline de esta build está roto; `colorPrecision` 8 falla la librería.
- Curvas suavizadas por `smoothPath` (elimina vértices, detecta esquinas, Laplace, Catmull-Rom → Bézier). Presets de detalle: low / medium / high.
- `loadTracer()` inicializa el `.wasm` de forma asíncrona. Tests en `vectorize.test.ts`.
- Se descartó Convertio (Potrace es monocromo) e imagetracerjs.

## Pendientes

- Probar Imagen a SVG con logos reales (letras finas, degradés).
- Llavero y vaso: alcanza con que se puedan descargar; no hace falta panel de guardado por ahora.
- Faltantes vs LetraMaker: pestaña externa, rebaje de pared externa, frente de acrílico en la curva, más plantillas de relieve, vista de camas, presets.
- Plantilla de perforado para halo; acentos unidos a su letra.
- Impresiones de prueba para calibrar tolerancias.
