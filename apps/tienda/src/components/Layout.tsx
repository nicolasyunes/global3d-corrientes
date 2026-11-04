import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { cartCount, useCart } from '../lib/cart'
import { CATEGORIES } from '../lib/catalog'
import { useShop } from '../lib/data'
import { useTheme } from '../lib/theme'
import { waLink } from '../lib/whatsapp'
import { ToastProvider } from './bits'
import {
  IconCart,
  IconClose,
  IconMenu,
  IconMoon,
  IconSun,
  IconWhatsApp,
} from './Icons'

function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Global3D, inicio">
      Global<b>3D</b>
    </Link>
  )
}

export function Layout() {
  const items = useCart()
  const count = cartCount(items)
  const [theme, toggleTheme] = useTheme()
  const { settings } = useShop()
  const [menu, setMenu] = useState(false)
  const loc = useLocation()

  useEffect(() => {
    setMenu(false)
    window.scrollTo({ top: 0 })
  }, [loc.pathname])

  // Las páginas con barra fija abajo suben el botón de WhatsApp
  const hasBar = /^\/(p\/|carrito|checkout)/.test(loc.pathname)

  return (
    <div className={hasBar ? 'has-bar' : undefined}>
      <a href="#main" className="sr-only">
        Ir al contenido
      </a>
      <div className="openbar">
        <div className="container">
          <span className="dot" aria-hidden="true" />
          <span>
            {settings.local.direccion} · {settings.local.horarios}
          </span>
        </div>
      </div>
      <header className="hdr">
        <div className="container hdr-row">
          <button
            className="icon-btn menu-btn"
            type="button"
            aria-label="Abrir menú"
            onClick={() => setMenu(true)}
          >
            <IconMenu />
          </button>
          <Brand />
          <nav className="nav" aria-label="Principal">
            <NavLink to="/catalogo">Catálogo</NavLink>
            <NavLink to="/c/vasos">Vasos</NavLink>
            <NavLink to="/c/trofeos">Trofeos</NavLink>
            <NavLink to="/filamentos">Filamentos</NavLink>
            <NavLink to="/a-medida">A medida</NavLink>
          </nav>
          <button
            className="icon-btn"
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === 'dark'
                ? 'Cambiar a modo claro'
                : 'Cambiar a modo oscuro'
            }
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <Link
            to="/carrito"
            className="icon-btn"
            aria-label={`Carrito, ${count} productos`}
          >
            <IconCart />
            {count > 0 && (
              <span className="cart-count">{count > 99 ? '99+' : count}</span>
            )}
          </Link>
        </div>
      </header>

      {menu && (
        <>
          <div className="drawer-backdrop" onClick={() => setMenu(false)} />
          <nav className="drawer" aria-label="Menú">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Brand />
              <button
                className="icon-btn"
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setMenu(false)}
              >
                <IconClose />
              </button>
            </div>
            <div className="sep" />
            <Link to="/catalogo">Todo el catálogo</Link>
            {CATEGORIES.map((c) => (
              <Link key={c.slug} to={`/c/${c.slug}`}>
                {c.label}
              </Link>
            ))}
            <div className="sep" />
            <Link to="/filamentos">Filamentos</Link>
            <Link to="/a-medida">Pedido a medida</Link>
            <Link to="/a-medida?tipo=empresa">Empresas y mayoristas</Link>
            <Link to="/carrito">Carrito</Link>
          </nav>
        </>
      )}

      <main id="main">
        <ToastProvider>
          <Outlet />
        </ToastProvider>
      </main>

      <footer className="ftr">
        <div className="container ftr-grid">
          <div className="stack" style={{ gap: 8 }}>
            <span className="brand" style={{ color: 'inherit' }}>
              Global<b>3D</b>
            </span>
            <p>Diseño e impresión 3D en Corrientes. Minorista y mayorista.</p>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <strong>Visitanos</strong>
            <p>{settings.local.direccion}</p>
            <p>{settings.local.horarios}</p>
            <p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.local.mapsQuery)}`}
                target="_blank"
                rel="noreferrer"
              >
                Cómo llegar
              </a>
            </p>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <strong>Contacto</strong>
            <p>
              <a
                href={waLink(
                  settings.whatsapp,
                  '¡Hola Global3D! Tengo una consulta.',
                )}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp {formatPhone(settings.whatsapp)}
              </a>
            </p>
            <p>
              <a
                href={`https://www.instagram.com/${settings.instagram}/`}
                target="_blank"
                rel="noreferrer"
              >
                Instagram @{settings.instagram}
              </a>
            </p>
            <p>Transferencia · Efectivo en el local</p>
          </div>
        </div>
      </footer>

      {!loc.pathname.startsWith('/pedido/') && (
        <a
          className="wa-fab"
          href={waLink(
            settings.whatsapp,
            '¡Hola Global3D! Tengo una consulta.',
          )}
          target="_blank"
          rel="noreferrer"
          aria-label="Escribinos por WhatsApp"
        >
          <IconWhatsApp />
        </a>
      )}
    </div>
  )
}

export function formatPhone(p: string): string {
  const d = p.replace(/\D/g, '').replace(/^549/, '')
  return d.length === 10 ? `${d.slice(0, 4)} ${d.slice(4)}` : d
}
