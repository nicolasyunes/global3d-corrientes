import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ShopDataProvider } from './lib/data'
import { Cart } from './pages/Cart'
import { Catalog } from './pages/Catalog'
import { Checkout } from './pages/Checkout'
import { Custom } from './pages/Custom'
import { Filaments } from './pages/Filaments'
import { Home } from './pages/Home'
import { Order } from './pages/Order'
import { Product } from './pages/Product'
import { NotFound } from './pages/states'
import { shopBase } from './lib/basePath'
import './styles/tienda.css'

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      children: [
        { index: true, element: <Home /> },
        { path: 'catalogo', element: <Catalog /> },
        { path: 'c/:cat', element: <Catalog /> },
        { path: 'p/:slug', element: <Product /> },
        { path: 'filamentos', element: <Filaments /> },
        { path: 'a-medida', element: <Custom /> },
        { path: 'carrito', element: <Cart /> },
        { path: 'checkout', element: <Checkout /> },
        { path: 'pedido/:token', element: <Order /> },
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
  { basename: shopBase(window.location.pathname) },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ShopDataProvider>
      <RouterProvider router={router} />
    </ShopDataProvider>
  </StrictMode>,
)
