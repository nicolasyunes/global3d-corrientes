import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ShopDataProvider } from './lib/data'
import { Home } from './pages/Home'
import { NotFound } from './pages/states'
import type { ComponentType } from 'react'
import { shopBase } from './lib/basePath'
import { rememberMpTestFlag } from './lib/mercadopago'
import './styles/tienda.css'

// Solo el inicio va en el JS principal; el resto de las páginas se bajan al
// entrar.
const page =
  (load: () => Promise<Record<string, unknown>>, name: string) => () =>
    load().then((m) => ({ Component: m[name] as ComponentType }))

const catalog = page(() => import('./pages/Catalog'), 'Catalog')

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      children: [
        { index: true, element: <Home /> },
        { path: 'catalogo', lazy: catalog },
        { path: 'c/:cat', lazy: catalog },
        {
          path: 'p/:slug',
          lazy: page(() => import('./pages/Product'), 'Product'),
        },
        {
          path: 'filamentos',
          lazy: page(() => import('./pages/Filaments'), 'Filaments'),
        },
        {
          path: 'a-medida',
          lazy: page(() => import('./pages/Custom'), 'Custom'),
        },
        { path: 'carrito', lazy: page(() => import('./pages/Cart'), 'Cart') },
        {
          path: 'checkout',
          lazy: page(() => import('./pages/Checkout'), 'Checkout'),
        },
        {
          path: 'pedido/:token',
          lazy: page(() => import('./pages/Order'), 'Order'),
        },
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
  { basename: shopBase(window.location.pathname) },
)

rememberMpTestFlag()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ShopDataProvider>
      <RouterProvider router={router} />
    </ShopDataProvider>
  </StrictMode>,
)
