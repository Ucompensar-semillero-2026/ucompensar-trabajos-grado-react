import { afterEach, describe, expect, it, vi } from 'vitest'
import { authApi } from './auth.service'

afterEach(() => vi.restoreAllMocks())

describe('authApi.verifyIdentity', () => {
  it('sends only the new password to the authenticated identity verification endpoint', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ public_id: 'student-public-id' }),
    } as Response)

    await expect(authApi.verifyIdentity('active-access-token', 'fresh-password', 'student-public-id'))
      .resolves.toBeUndefined()

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('/api/auth/verify')
    expect(options?.method).toBe('POST')
    expect(options?.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer active-access-token',
    })
    expect(options?.body).toBe(JSON.stringify({ password: 'fresh-password' }))
    expect(options?.body).not.toContain('student@')
  })

  it('rejects a verification response for another account', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ public_id: 'different-user' }),
    } as Response)

    await expect(authApi.verifyIdentity('active-access-token', 'fresh-password', 'expected-user'))
      .rejects.toMatchObject({ status: 403, message: 'Las credenciales no corresponden a la cuenta que inició esta sesión.' })
  })

  it('keeps a network failure as an explicit authentication error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(authApi.verifyIdentity('active-access-token', 'fresh-password', 'student-public-id'))
      .rejects.toMatchObject({ status: 0, message: 'No se pudo conectar con el servidor' })
  })
})
