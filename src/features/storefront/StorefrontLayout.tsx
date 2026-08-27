import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useCart } from './CartContext'
import StorefrontNav from './StorefrontNav'
import { waHref } from '@/lib/whatsapp'
import './storefront.css'

export default function StorefrontLayout() {
  const navigate = useNavigate()
  const cart = useCart()
  const [search, setSearch] = useState('')

  const submitSearch = () => {
    const q = search.trim()
    navigate(q ? `/categoria/todas?q=${encodeURIComponent(q)}` : '/categoria/todas')
  }

  return (
    <div className="sf-shell">
      <header className="sf-header">
        <div className="sf-header__row">
          <button type="button" className="sf-brand" onClick={() => navigate('/')}>
            GLOBAL<span className="sf-brand__accent">3D</span>
          </button>
          <div className="sf-header__search">
            <input
              className="sf-input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSearch()
              }}
              placeholder="Buscar productos, categorías..."
            />
          </div>
          <button
            type="button"
            className="btn btn--icon sf-cart-btn"
            aria-label="Carrito"
            onClick={() => navigate('/carrito')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            {cart.count > 0 && (
              <span key={cart.count} className="sf-cart-badge">
                {cart.count}
              </span>
            )}
          </button>
        </div>
        <StorefrontNav />
      </header>

      <a
        href={waHref('Hola! Quiero hacer una consulta.')}
        target="_blank"
        rel="noopener noreferrer"
        className="sf-whatsapp"
        aria-label="Escribinos por WhatsApp"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#ffffff">
          <path d="M17.5 14.4c-.3-.1-1.6-.8-1.9-.9-.2-.1-.4-.1-.6.1-.2.2-.6.9-.8 1.1-.1.2-.3.2-.5.1-1.3-.6-2.5-1.5-3.5-3-.2-.3 0-.5.1-.6.2-.2.4-.5.6-.7.2-.2.2-.4.1-.6-.1-.2-.6-1.5-.8-2-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.4-.3.4-1 1-1 2.4 0 1.4 1 2.8 1.1 3 .1.2 2 3.1 4.9 4.2 2.4.9 2.9.7 3.4.7.5-.1 1.6-.7 1.9-1.3.3-.6.3-1.1.2-1.3-.1-.1-.3-.2-.4-.2z"></path>
          <path d="M12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2z" fill="none" stroke="#ffffff" strokeWidth="1.5"></path>
        </svg>
      </a>

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  )
}
