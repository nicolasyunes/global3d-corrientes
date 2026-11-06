import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // En desarrollo las herramientas corren en su propio servidor (puerto 5200,
    // `npm run dev:herramientas`); el proxy las deja bajo el mismo origen que el
    // admin, igual que en producción, para compartir la sesión de Supabase.
    proxy: {
      '/herramientas': { target: 'http://localhost:5200', ws: true },
    },
  },
})
