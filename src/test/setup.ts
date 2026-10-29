import '@testing-library/jest-dom/vitest'

// jsdom no implementa window.scrollTo; el catálogo lo usa para partir siempre del inicio.
window.scrollTo = (() => {}) as typeof window.scrollTo
