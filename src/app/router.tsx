import { createBrowserRouter, Navigate } from 'react-router-dom'
import CatalogPage from '@/features/catalog/CatalogPage'
import App from './App'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <CatalogPage />,
      },
      {
        path: 'admin/*',
        // Route-level lazy: the whole admin subtree (deps included) is split
        // into its own chunk and fetched on first navigation to /admin. A
        // future ProtectedRoute wrapper lives inside the lazy module so auth
        // libraries also stay out of the public bundle.
        lazy: () => import('@/features/admin/admin.route'),
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
])
