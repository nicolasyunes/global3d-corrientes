# Global3D

Single Vite + React + TypeScript app for the Global3D 3D-printing business:

- **`/`** — public catalog shell (eager-loaded).
- **`/admin/*`** — workshop shell, lazily loaded so admin code never enters the public bundle.

Supabase is the data layer (direct `supabase-js` + RLS). RLS — not app count — is the security boundary.

## Prerequisites

- Node 20+ (see `.nvmrc`; e.g. `nvm use` with nvm-windows).
- npm 10+.
- A Supabase project (for the connectivity smoke test; optional for dev).

## Setup

```bash
npm install
cp .env.example .env   # then fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
```

## Scripts

| Script          | Command                                   |
| --------------- | ----------------------------------------- |
| `npm run dev`   | Vite dev server                           |
| `npm run build` | Production build                          |
| `npm run preview` | Preview the production build             |
| `npm test`      | Run vitest (unit + smoke tests)           |
| `npm run typecheck` | `tsc --noEmit` (app + config files)    |
| `npm run lint`  | ESLint (flat config)                      |
| `npm run format` | Prettier write                           |
| `npm run format:check` | Prettier check                     |

## Structure

```
src/
├── main.tsx          # entry: mounts the router, imports base.css
├── app/              # router + root layout
├── features/
│   ├── catalog/      # public shell (eager)
│   └── admin/        # workshop shell (lazy boundary only)
├── lib/              # supabase client + env validation
├── styles/           # design tokens + mobile-first base
└── test/             # vitest setup
```

## Admin boundary

The `/admin/*` route uses a route-level `lazy()` import. The admin subtree (and any
future auth libraries) is split into its own chunk and fetched only on first
navigation to `/admin`. A `ProtectedRoute` seam is reserved inside the lazy module
(no auth is implemented in this change).

## Env

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are validated at client init and
fail fast with a message naming the missing/malformed variable. The anon key is
public by design — RLS protects the data.
