import { createBrowserRouter, Navigate } from 'react-router-dom'
import { CartProvider } from '@/features/storefront/CartContext'
import { ToastProvider } from '@/features/storefront/ToastContext'
import StorefrontLayout from '@/features/storefront/StorefrontLayout'
import HomePage from '@/features/storefront/HomePage'
import CategoryPage from '@/features/storefront/CategoryPage'
import ProductDetailPage from '@/features/storefront/ProductDetailPage'
import CartPage from '@/features/storefront/CartPage'
import CheckoutPage from '@/features/storefront/CheckoutPage'
import App from './App'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        element: (
          <CartProvider>
            <ToastProvider>
              <StorefrontLayout />
            </ToastProvider>
          </CartProvider>
        ),
        children: [
          { index: true, element: <HomePage /> },
          { path: 'categoria/:slug?', element: <CategoryPage /> },
          { path: 'producto/:id', element: <ProductDetailPage /> },
          { path: 'carrito', element: <CartPage /> },
          { path: 'checkout', element: <CheckoutPage /> },
        ],
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
