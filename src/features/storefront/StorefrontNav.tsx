import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { NAV, type NavCategory } from './navigation'
import { useMediaQuery } from './useMediaQuery'

const OPEN_DELAY = 120
const CLOSE_DELAY = 200

function subLinkTo(catSlug: string, subSlug: string): string {
  return `/categoria/${catSlug}?sub=${subSlug}`
}

export default function StorefrontNav() {
  const isDesktop = useMediaQuery('(min-width: 900px)')
  return isDesktop ? <DesktopNav /> : <MobileNav />
}

function DesktopNav() {
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const openTimer = useRef<number | undefined>(undefined)
  const closeTimer = useRef<number | undefined>(undefined)
  const location = useLocation()

  useEffect(() => {
    setOpenSlug(null)
  }, [location.pathname, location.search])

  useEffect(
    () => () => {
      window.clearTimeout(openTimer.current)
      window.clearTimeout(closeTimer.current)
    },
    [],
  )

  const scheduleOpen = (slug: string) => {
    window.clearTimeout(closeTimer.current)
    openTimer.current = window.setTimeout(() => setOpenSlug(slug), OPEN_DELAY)
  }
  const scheduleClose = () => {
    window.clearTimeout(openTimer.current)
    closeTimer.current = window.setTimeout(() => setOpenSlug(null), CLOSE_DELAY)
  }
  const closeNow = () => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    setOpenSlug(null)
  }

  const openCat: NavCategory | undefined = NAV.find((c) => c.slug === openSlug)

  return (
    <nav
      className="sf-nav"
      aria-label="Categorías"
      onMouseLeave={scheduleClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') closeNow()
      }}
    >
      <div className="sf-nav__bar">
        <Link className="sf-nav__item" to="/categoria/todas" onFocus={closeNow}>
          Todas
        </Link>
        {NAV.map((c) => (
          <div key={c.slug} className="sf-nav__group" onMouseEnter={() => scheduleOpen(c.slug)}>
            <Link
              to={`/categoria/${c.slug}`}
              className={`sf-nav__item ${openSlug === c.slug ? 'sf-nav__item--open' : ''}`}
              aria-expanded={openSlug === c.slug}
              aria-controls={openSlug === c.slug ? 'sf-megamenu-panel' : undefined}
              aria-haspopup={c.subLinks.length > 0}
              onFocus={() => (c.subLinks.length ? setOpenSlug(c.slug) : closeNow())}
            >
              <span aria-hidden="true">{c.icon}</span> {c.name}
            </Link>

            {openSlug === c.slug && c.subLinks.length > 0 && (
              <div
                className="sf-megamenu"
                id="sf-megamenu-panel"
                role="region"
                aria-label={c.name}
                onMouseEnter={() => window.clearTimeout(closeTimer.current)}
                onMouseLeave={scheduleClose}
              >
                <div className="sf-megamenu__inner">
                  <div className="sf-megamenu__title">
                    <span aria-hidden="true">{c.icon}</span> {c.name}
                  </div>
                  <ul className="sf-megamenu__cols">
                    <li>
                      <Link
                        to={`/categoria/${c.slug}`}
                        className="sf-megamenu__link sf-megamenu__link--all"
                      >
                        Ver todo
                      </Link>
                    </li>
                    {c.subLinks.map((s) => (
                      <li key={s.slug}>
                        <Link to={subLinkTo(c.slug, s.slug)} className="sf-megamenu__link">
                          {s.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {openCat && openCat.subLinks.length > 0 && (
        <div className="sf-megamenu__scrim" aria-hidden="true" onMouseEnter={scheduleClose} />
      )}
    </nav>
  )
}

function MobileNav() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const location = useLocation()
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const prevOpenRef = useRef(false)

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!drawerOpen) {
      // Restore focus to the hamburger toggle when the drawer closes.
      if (prevOpenRef.current) toggleRef.current?.focus()
      prevOpenRef.current = false
      return
    }
    prevOpenRef.current = true
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  const trapTab = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !drawerRef.current) return
    const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    )
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <nav className="sf-nav sf-nav--mobile" aria-label="Categorías">
      <button
        type="button"
        ref={toggleRef}
        className="sf-nav__toggle"
        aria-expanded={drawerOpen}
        aria-controls="sf-drawer"
        onClick={() => setDrawerOpen((v) => !v)}
      >
        <span aria-hidden="true">☰</span> Categorías
      </button>

      {drawerOpen && (
        <div className="sf-drawer__scrim" aria-hidden="true" onClick={() => setDrawerOpen(false)} />
      )}

      <div
        id="sf-drawer"
        ref={drawerRef}
        className={`sf-drawer ${drawerOpen ? 'sf-drawer--open' : ''}`}
        onKeyDown={trapTab}
        {...(drawerOpen ? {} : { inert: '' })}
      >
        <div className="sf-drawer__head">
          <span>Categorías</span>
          <button
            type="button"
            ref={closeBtnRef}
            className="sf-drawer__close"
            aria-label="Cerrar menú"
            onClick={() => setDrawerOpen(false)}
          >
            ✕
          </button>
        </div>
        <ul className="sf-drawer__list">
          <li>
            <Link to="/categoria/todas" className="sf-drawer__cat">
              Todas las categorías
            </Link>
          </li>
          {NAV.map((c) => (
            <li key={c.slug}>
              <div className="sf-drawer__row">
                <Link to={`/categoria/${c.slug}`} className="sf-drawer__cat">
                  <span aria-hidden="true">{c.icon}</span> {c.name}
                </Link>
                {c.subLinks.length > 0 && (
                  <button
                    type="button"
                    className="sf-drawer__expand"
                    aria-expanded={expanded === c.slug}
                    aria-label={`Ver subcategorías de ${c.name}`}
                    onClick={() => setExpanded((v) => (v === c.slug ? null : c.slug))}
                  >
                    {expanded === c.slug ? '▲' : '▼'}
                  </button>
                )}
              </div>
              {expanded === c.slug && c.subLinks.length > 0 && (
                <ul className="sf-drawer__sub">
                  {c.subLinks.map((s) => (
                    <li key={s.slug}>
                      <Link to={subLinkTo(c.slug, s.slug)} className="sf-drawer__sublink">
                        {s.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
