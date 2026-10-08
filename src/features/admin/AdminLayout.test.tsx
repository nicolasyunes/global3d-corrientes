import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminLayout from './AdminLayout'

const { useAuthMock, useOperatorMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useOperatorMock: vi.fn(),
}))

vi.mock('@/features/auth/useAuth', () => ({ useAuth: useAuthMock }))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: useOperatorMock,
}))

const agustina = {
  id: 'op-2',
  name: 'Agustina',
  initials: 'AG',
  color: '#0E7C66',
  role: 'operator',
  active: true,
  created_at: '',
}

function operatorState(isAdmin: boolean) {
  return {
    current: { ...agustina, role: isAdmin ? 'admin' : 'operator' },
    isAdmin,
    lock: vi.fn(),
    byId: () => undefined,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({ signOut: vi.fn().mockResolvedValue(undefined) })
  useOperatorMock.mockReturnValue(operatorState(false))
})

function renderAdminLayout() {
  return render(
    <MemoryRouter initialEntries={['/admin/orders']}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="orders" element={<div>Orders page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminLayout', () => {
  it('renders the navigation, the active person and the outlet', () => {
    renderAdminLayout()
    expect(screen.getAllByText('Hoy').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Taller').length).toBeGreaterThan(0)
    expect(screen.getByText('Agustina')).toBeInTheDocument()
    expect(screen.getByText('Orders page')).toBeInTheDocument()
  })

  it('signs the workshop account out only after confirming', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    renderAdminLayout()
    const button = screen.getByRole('button', {
      name: 'Cerrar sesión del taller',
    })
    fireEvent.click(button)
    expect(useAuthMock().signOut).not.toHaveBeenCalled()
    confirm.mockReturnValueOnce(true)
    fireEvent.click(button)
    expect(useAuthMock().signOut).toHaveBeenCalledTimes(1)
    confirm.mockRestore()
  })

  it('locks back to the person picker', () => {
    const state = operatorState(false)
    useOperatorMock.mockReturnValue(state)
    renderAdminLayout()
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar persona' }))
    expect(state.lock).toHaveBeenCalledTimes(1)
  })

  it('hides admin sections for regular operators', () => {
    renderAdminLayout()
    expect(screen.queryByText('Productos y stock')).not.toBeInTheDocument()
    expect(screen.queryByText('Personas')).not.toBeInTheDocument()
    expect(screen.queryByText('Estadísticas')).not.toBeInTheDocument()
  })

  it('shows admin sections for admins', () => {
    useOperatorMock.mockReturnValue(operatorState(true))
    renderAdminLayout()
    expect(screen.getByText('Productos y stock')).toBeInTheDocument()
    expect(screen.getByText('Personas')).toBeInTheDocument()
    expect(screen.getByText('Estadísticas')).toBeInTheDocument()
  })
})
