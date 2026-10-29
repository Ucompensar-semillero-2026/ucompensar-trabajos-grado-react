import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authHeaders, request, SESSION_FLAG_KEY } from './http'
import { useAppStore } from '@/stores/app.store'
import type { User } from '@/types'

const user = { id: 'u1', name: 'Ana', role: 'estudiante' } as unknown as User

const json = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response

beforeEach(() => {
  useAppStore.getState().loginSuccess(user, 'old-token')
  localStorage.setItem(SESSION_FLAG_KEY, 'true')
})

afterEach(() => {
  vi.restoreAllMocks()
  useAppStore.getState().logout()
  localStorage.clear()
})

describe('request con access_token vencido', () => {
  it('renueva el token con la cookie de refresh y repite la llamada', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(401, { detail: 'Token expirado' }))
      .mockResolvedValueOnce(json(200, { access_token: 'new-token' }))
      .mockResolvedValueOnce(json(200, [{ id: 1 }]))

    await expect(request('/processes', { headers: authHeaders('old-token') })).resolves.toEqual([{ id: 1 }])

    expect(String(fetch.mock.calls[1][0])).toMatch(/\/auth\/refresh$/)
    expect(new Headers(fetch.mock.calls[2][1]?.headers).get('Authorization')).toBe('Bearer new-token')
    expect(useAppStore.getState().accessToken).toBe('new-token')
    expect(useAppStore.getState().isAuthenticated).toBe(true)
  })

  it('las llamadas que fallan a la vez comparten una sola renovación', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith('/auth/refresh')) return json(200, { access_token: 'new-token' })
      const auth = new Headers(init?.headers).get('Authorization')
      return auth === 'Bearer new-token' ? json(200, { ok: true }) : json(401, { detail: 'Token expirado' })
    })

    await Promise.all([
      request('/processes', { headers: authHeaders('old-token') }),
      request('/modalities', { headers: authHeaders('old-token') }),
    ])

    const refreshCalls = fetch.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))
    expect(refreshCalls).toHaveLength(1)
  })

  it('si la renovación falla cierra la sesión y propaga el 401', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(401, { detail: 'Token expirado' }))
      .mockResolvedValueOnce(json(401, { detail: 'No hay sesión activa' }))

    await expect(request('/processes', { headers: authHeaders('old-token') })).rejects.toMatchObject({ status: 401 })

    expect(useAppStore.getState().isAuthenticated).toBe(false)
    expect(localStorage.getItem(SESSION_FLAG_KEY)).toBeNull()
  })

  it('no intenta renovar en llamadas sin token ni en /auth/*', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(401, { detail: 'No autorizado' }))

    await expect(request('/proposals/public')).rejects.toMatchObject({ status: 401 })
    await expect(request('/auth/me', { headers: authHeaders('old-token') })).rejects.toMatchObject({ status: 401 })

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(useAppStore.getState().isAuthenticated).toBe(true)
  })
})
