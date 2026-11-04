import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Tienda pública de Global3D. Se publica en el mismo proyecto de Vercel que el
// admin, bajo /tienda (más adelante, en la raíz del dominio de la tienda). Lee
// la base solo a través de las funciones shop_* (ver la migración
// 20261103192959_shop_storefront.sql); el público no toca tablas.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/tienda/',
  plugins: [react()],
  // Caché propia para que no choque con el admin ni con las herramientas
  cacheDir: fileURLToPath(
    new URL('../../node_modules/.vite-tienda', import.meta.url),
  ),
  // Las mismas VITE_SUPABASE_* del admin (.env en la raíz del repo)
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../../src', import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../../dist/tienda', import.meta.url)),
    emptyOutDir: false,
  },
  server: { port: 5300 },
  preview: { port: 5300 },
})
