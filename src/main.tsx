import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import './styles/base.css'
import './styles/ui.css'

// After a deploy, an open tab asks for chunks that no longer exist. Reload
// once to pick up the new build; the flag avoids a reload loop.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  try {
    if (sessionStorage.getItem('g3d.chunkReload')) return
    sessionStorage.setItem('g3d.chunkReload', '1')
  } catch {
    return
  }
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
