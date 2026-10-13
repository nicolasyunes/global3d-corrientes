# Global3D — admin + generadores 3D

Taller de impresión 3D Global3D (Corrientes). Admin en React + Vite + Supabase, más generadores 3D en `apps/herramientas/`.

- Producción: https://global3d-corrientes.vercel.app — Vercel despliega solo al mergear a `master`.
- Supabase: proyecto `bukjmleercxlxbexekos` (Global-3D-Corrientes), vía conector MCP.
- App solo interna (login del taller + PIN por persona). La tienda pública y el sync con Google Sheets se eliminaron en la Fase 1 (2026-09-29/30); no proponer trabajo sobre eso salvo que se reabra.
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
