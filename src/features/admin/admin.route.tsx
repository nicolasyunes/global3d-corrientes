import AdminPage from './AdminPage'

// Auth-guard seam: wrap <AdminPage /> in a <ProtectedRoute /> here once
// authentication lands (data-model-core). Keeping the wrapper inside this lazy
// module guarantees auth libraries never enter the public bundle.
export function Component() {
  return <AdminPage />
}
