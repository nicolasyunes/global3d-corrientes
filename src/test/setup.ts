import '@testing-library/jest-dom/vitest'

// jsdom has no object URLs; file pickers use them for local previews.
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:preview'
  URL.revokeObjectURL = () => undefined
}
