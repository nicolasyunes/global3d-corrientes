import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// Generadores 3D de Global3D: app aparte del admin (pesan varios MB por
// three.js, manifold y las tipografías). Cada herramienta es una página.
const page = (name: string) =>
  fileURLToPath(new URL(`./${name}.html`, import.meta.url))

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  build: {
    // Las páginas cargan three/manifold con await a nivel de módulo
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
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
