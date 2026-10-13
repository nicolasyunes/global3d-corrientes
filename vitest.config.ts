import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { loadEnv } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

// The live workshop project. Integration tests create users, customers and
// orders, so they must never point here.
const PRODUCTION_REF = 'bukjmleercxlxbexekos'

// `npm test` runs unit tests only. `npm run test:integration` runs the cloud
// integration tests against the project in .env.integration (a separate,
// disposable Supabase project).
export default defineConfig(({ mode }) => {
  const integration = mode === 'integration'
  if (integration) {
    const env = loadEnv(mode, process.cwd(), '')
    if ((env.VITE_SUPABASE_URL ?? '').includes(PRODUCTION_REF)) {
      throw new Error(
        'Los tests de integración apuntan a la base real del taller. ' +
          'Configurá un proyecto de pruebas en .env.integration.',
      )
    }
  }
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: integration
        ? ['src/**/*.integration.test.ts']
        : configDefaults.include,
      exclude: integration
        ? configDefaults.exclude
        : [...configDefaults.exclude, '**/*.integration.test.ts'],
    },
  }
})
