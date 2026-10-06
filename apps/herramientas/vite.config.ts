import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// Generadores 3D de Global3D: se publican en el mismo dominio que el admin,
// bajo /herramientas (comparten la sesión de Supabase y el operador). Cada
// herramienta es una página; pesan varios MB por three.js, manifold y las
// tipografías, por eso no van dentro del bundle del admin.
const page = (name: string) =>
  fileURLToPath(new URL(`./${name}.html`, import.meta.url))

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/herramientas/',
  // Caché propia: con la del admin (node_modules/.vite) los dos servidores de
  // desarrollo se pisan las dependencias optimizadas y el admin falla al cargar
  // módulos ("Failed to fetch dynamically imported module")
  cacheDir: fileURLToPath(
    new URL('../../node_modules/.vite-herramientas', import.meta.url),
  ),
  // Las mismas VITE_SUPABASE_* del admin (.env en la raíz del repo)
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../../src', import.meta.url)),
    },
  },
  build: {
    // Las páginas cargan three/manifold con await a nivel de módulo
    target: 'es2022',
    // Dentro del build del admin: `npm run build` arma los dos
    outDir: fileURLToPath(new URL('../../dist/herramientas', import.meta.url)),
    emptyOutDir: false,
    rollupOptions: {
      input: {
        index: page('index'),
        llavero: page('llavero'),
        vaso: page('vaso'),
        letraCaja: page('letra-caja'),
      },
    },
  },
  server: { port: 5200 },
})
