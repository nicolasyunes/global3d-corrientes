import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from './App'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/admin" replace /> },
      {
        path: 'admin/*',
        lazy: () => import('@/features/admin/admin.route'),
      },
      { path: '*', element: <Navigate to="/admin" replace /> },
    ],
  },
])
