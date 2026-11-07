import '@testing-library/jest-dom/vitest'

// jsdom no implementa window.scrollTo; el catálogo lo usa para partir siempre del inicio.
window.scrollTo = (() => {}) as typeof window.scrollTo

// Las pruebas NUNCA salen a internet. Una llamada que la prueba no simuló falla al instante, igual en
// todos lados. Antes, en Vercel (donde VITE_API_URL apunta a la API real de Render) esas llamadas sí
// llegaban a producción: el menú de coordinación pedía /api/monitoring/summary, Render respondía 401
// con el token falso, la app intentaba renovar la sesión, la cerraba, y eso ocurría en medio de la
// prueba SIGUIENTE, que quedaba sin sesión y fallaba "al azar". En local y en GitHub no pasaba porque
// sin VITE_API_URL la llamada iba a /api de la propia máquina y fallaba sola.
// Una prueba que necesita la red la simula con vi.stubGlobal('fetch', ...) o mockeando el servicio.
export class UnmockedNetworkError extends TypeError {}

globalThis.fetch = ((input: RequestInfo | URL) => {
  const url = input instanceof Request ? input.url : String(input)
  return Promise.reject(new UnmockedNetworkError(`Llamada de red no simulada en una prueba: ${url}`))
}) as typeof fetch
