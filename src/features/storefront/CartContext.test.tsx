import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CartProvider, useCart } from './CartContext'
import type { Product } from './data/products'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  cat: 'llaveros',
  name: 'Llavero test',
  price: 1000,
  personalizable: false,
  customOnRequest: true,
  colors: null,
  stock: 'in',
  desc: '',
  specs: [],
  ...overrides,
})

function CartProbe() {
  const cart = useCart()
  return (
    <div>
      <span data-testid="count">{cart.count}</span>
      <span data-testid="subtotal">{cart.subtotal}</span>
      <span data-testid="lines">{cart.lines.length}</span>
      <button onClick={() => cart.add(product(), null, '', 1)}>Add</button>
      <button onClick={() => cart.add(product({ id: 'p2', name: 'Otro' }), 'Rojo', 'Juan', 2)}>Add variant</button>
      {cart.lines.map((l) => (
        <div key={l.id}>
          <span data-testid={`qty-${l.id}`}>{l.qty}</span>
          <button onClick={() => cart.inc(l.id)}>inc-{l.id}</button>
          <button onClick={() => cart.dec(l.id)}>dec-{l.id}</button>
          <button onClick={() => cart.remove(l.id)}>remove-{l.id}</button>
        </div>
      ))}
      <button onClick={() => cart.clear()}>Clear</button>
    </div>
  )
}

function renderProvider() {
  return render(
    <CartProvider>
      <CartProbe />
    </CartProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('CartProvider', () => {
  it('starts empty', () => {
    renderProvider()
    expect(screen.getByTestId('count')).toHaveTextContent('0')
    expect(screen.getByTestId('lines')).toHaveTextContent('0')
  })

  it('adding the same product/variant merges quantities into one line', () => {
    renderProvider()
    fireEvent.click(screen.getByText('Add'))
    fireEvent.click(screen.getByText('Add'))
    expect(screen.getByTestId('lines')).toHaveTextContent('1')
    expect(screen.getByTestId('count')).toHaveTextContent('2')
  })

  it('adding a different variant creates a separate line', () => {
    renderProvider()
    fireEvent.click(screen.getByText('Add'))
    fireEvent.click(screen.getByText('Add variant'))
    expect(screen.getByTestId('lines')).toHaveTextContent('2')
    expect(screen.getByTestId('count')).toHaveTextContent('3')
  })

  it('inc/dec adjust quantity, dec never goes below 1', () => {
    renderProvider()
    fireEvent.click(screen.getByText('Add'))
    const lineId = 'p1||'
    fireEvent.click(screen.getByText(`dec-${lineId}`))
    expect(screen.getByTestId(`qty-${lineId}`)).toHaveTextContent('1')
    fireEvent.click(screen.getByText(`inc-${lineId}`))
    expect(screen.getByTestId(`qty-${lineId}`)).toHaveTextContent('2')
  })

  it('remove drops the line', () => {
    renderProvider()
    fireEvent.click(screen.getByText('Add'))
    fireEvent.click(screen.getByText('remove-p1||'))
    expect(screen.getByTestId('lines')).toHaveTextContent('0')
  })

  it('clear empties the cart', () => {
    renderProvider()
    fireEvent.click(screen.getByText('Add'))
    fireEvent.click(screen.getByText('Add variant'))
    fireEvent.click(screen.getByText('Clear'))
    expect(screen.getByTestId('lines')).toHaveTextContent('0')
  })

  it('persists the cart to localStorage and restores it on remount', () => {
    const { unmount } = renderProvider()
    fireEvent.click(screen.getByText('Add'))
    unmount()

    renderProvider()
    expect(screen.getByTestId('count')).toHaveTextContent('1')
  })

  it('useCart throws when used outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<CartProbe />)).toThrow('useCart must be used within a CartProvider')
    consoleError.mockRestore()
  })
})
