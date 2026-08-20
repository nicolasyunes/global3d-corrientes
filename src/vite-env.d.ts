/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  // Dev-only flag that gates the seeded operator session seam. Optional;
  // defaults to off. No credentials live here.
  readonly VITE_ENABLE_DEV_SESSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
