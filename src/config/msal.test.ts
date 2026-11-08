import { describe, expect, it } from 'vitest'
import { msalInstance } from './msal'

describe('configuración de MSAL', () => {
  it('no usa caché solo en memoria: MSAL 5 bloquea el inicio de sesión por redirección con ella', () => {
    // in_mem_redirect_unavailable: así quedó caído el inicio de sesión en producción el 8-nov-2026.
    const cacheLocation = msalInstance.getConfiguration().cache.cacheLocation
    expect(cacheLocation).not.toBe('memoryStorage')
    expect(cacheLocation).toBe('sessionStorage')
  })
})
