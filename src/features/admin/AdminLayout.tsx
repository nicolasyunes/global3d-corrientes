import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import Icon, { type IconName } from '@/components/Icon'
import { useAuth } from '@/features/auth/useAuth'
import { useOperator } from '@/features/operators/operator-context'
import { countOpenIdeas } from '@/features/ideas/ideas.api'
import { useOrderModal } from '@/features/orders/order-modal-context'
import { OrderModalProvider } from '@/features/orders/OrderModalProvider'
import './shell.css'

function NewOrderFab() {
  const { openNew } = useOrderModal()
  return (
    <button
      type="button"
      className="shell-fab"
      aria-label="Nuevo pedido"
      onClick={openNew}
    >
      <Icon name="plus" size={26} />
    </button>
  )
}

interface NavItem {
  to: string
  label: string
  short?: string
  icon: IconName
  adminOnly?: boolean
  // Sidebar only; on the phone it lives in "Más".
  sideOnly?: boolean
}

const MAIN: NavItem[] = [
  { to: '/admin/hoy', label: 'Hoy', icon: 'home' },
  { to: '/admin/semana', label: 'Semana', icon: 'calendar' },
  { to: '/admin/orders', label: 'Pedidos', icon: 'box' },
  { to: '/admin/taller', label: 'Taller', icon: 'printer' },
  { to: '/admin/avisos', label: 'Avisos', icon: 'chat', sideOnly: true },
  { to: '/admin/ideas', label: 'Ideas', icon: 'bulb', sideOnly: true },
  {
    to: '/admin/filamentos',
    label: 'Filamentos',
    icon: 'spool',
    sideOnly: true,
  },
]

const SECONDARY: NavItem[] = [
  { to: '/admin/ventas-pedidos', label: 'Entregados', icon: 'receipt' },
  { to: '/admin/calculadora', label: 'Calculadora', icon: 'calc' },
  {
    to: '/admin/productos',
    label: 'Productos y stock',
    icon: 'layers',
    adminOnly: true,
  },
  { to: '/admin/personas', label: 'Personas', icon: 'users', adminOnly: true },
]

function navClass({ isActive }: { isActive: boolean }) {
  return `shell-nav__link${isActive ? ' is-active' : ''}`
}

export default function AdminLayout() {
  const { signOut } = useAuth()

  // Signing the workshop account out means typing its email and password
  // again on this device; switching person only needs a PIN.
  function confirmSignOut() {
    if (
      window.confirm(
        'Vas a cerrar la cuenta del taller en este dispositivo. Para volver a entrar vas a necesitar el email y la contraseña (no solo el PIN).\n\nSi solo querés cambiar de persona, usá "Cambiar persona".\n\n¿Cerrar igual?',
      )
    )
      void signOut()
  }
  const { current, isAdmin, lock } = useOperator()
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  const secondary = SECONDARY.filter((item) => !item.adminOnly || isAdmin)
  const [openIdeas, setOpenIdeas] = useState(0)

  useEffect(() => setMoreOpen(false), [location.pathname])
  useEffect(() => {
    void countOpenIdeas().then(setOpenIdeas)
  }, [location.pathname])

  const badge = (item: NavItem) =>
    item.to === '/admin/ideas' && openIdeas > 0 ? (
      <span className="shell-nav__badge">{openIdeas}</span>
    ) : null

  return (
    <OrderModalProvider>
      <div className="shell">
        <aside className="shell-side" aria-label="Navegación principal">
          <Link to="/admin/hoy" className="brand shell-side__brand">
            <span className="brand__cube">
              <Icon name="box" size={18} />
            </span>
            Global<span className="brand__accent">3D</span>
          </Link>
          <nav className="shell-nav">
            {MAIN.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                <Icon name={item.icon} />
                {item.label}
                {badge(item)}
              </NavLink>
            ))}
            <p className="shell-nav__section">Taller</p>
            {secondary.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="shell-me">
            <span className="avatar" style={{ background: current?.color }}>
              {current?.initials}
            </span>
            <div className="shell-me__who">
              <strong>{current?.name}</strong>
              <button type="button" onClick={lock}>
                Cambiar persona
              </button>
            </div>
            <button
              type="button"
              className="icon-btn shell-me__out"
              aria-label="Cerrar sesión del taller"
              title="Cerrar sesión del taller"
              onClick={confirmSignOut}
            >
              <Icon name="logout" />
            </button>
          </div>
        </aside>

        <div className="shell-main">
          <Outlet />
        </div>

        <NewOrderFab />

        <nav className="shell-bottom" aria-label="Navegación">
          {MAIN.filter((item) => !item.sideOnly).map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass}>
              <Icon name={item.icon} />
              {item.short ?? item.label}
            </NavLink>
          ))}
          <button
            type="button"
            className={`shell-nav__link${moreOpen ? ' is-active' : ''}`}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <span
              className="avatar avatar--sm"
              style={{ background: current?.color }}
            >
              {current?.initials}
            </span>
            Más
          </button>
        </nav>

        {moreOpen && (
          <div className="shell-more" role="dialog" aria-label="Más opciones">
            <button
              type="button"
              className="shell-more__scrim"
              aria-label="Cerrar"
              onClick={() => setMoreOpen(false)}
            />
            <div className="shell-more__panel">
              {[...MAIN.filter((item) => item.sideOnly), ...secondary].map(
                (item) => (
                  <NavLink key={item.to} to={item.to} className={navClass}>
                    <Icon name={item.icon} />
                    {item.label}
                  </NavLink>
                ),
              )}
              <button type="button" className="shell-nav__link" onClick={lock}>
                <Icon name="users" />
                Cambiar persona ({current?.name})
              </button>
              <button
                type="button"
                className="shell-nav__link"
                onClick={confirmSignOut}
              >
                <Icon name="logout" />
                Cerrar sesión del taller
              </button>
            </div>
          </div>
        )}
      </div>
    </OrderModalProvider>
  )
}
