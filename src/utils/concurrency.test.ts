import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/http'
import { mapSettledLimit, withRetry } from './concurrency'

describe('mapSettledLimit', () => {
  it('nunca supera el límite de tareas simultáneas y conserva el orden', async () => {
    let active = 0
    let peak = 0
    const items = Array.from({ length: 20 }, (_, i) => i)
    const results = await mapSettledLimit(items, 4, async (n) => {
      active++
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      return n * 2
    })
    expect(peak).toBeLessThanOrEqual(4)
    expect(results.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual(items.map((n) => n * 2))
  })

  it('un fallo no cancela las demás tareas', async () => {
    const results = await mapSettledLimit([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('falla')
      return n
    })
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled'])
  })

  it('con lista vacía devuelve lista vacía', async () => {
    expect(await mapSettledLimit([], 4, async () => 1)).toEqual([])
  })
})

describe('withRetry', () => {
  it('reintenta un 500 y devuelve el resultado cuando el reintento funciona', async () => {
    const task = vi.fn().mockRejectedValueOnce(new ApiError(500, 'error')).mockResolvedValue('ok')
    expect(await withRetry(task, 2, 1)).toBe('ok')
    expect(task).toHaveBeenCalledTimes(2)
  })

  it('reintenta errores de red (no son ApiError)', async () => {
    const task = vi.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValue('ok')
    expect(await withRetry(task, 2, 1)).toBe('ok')
  })

  it('no reintenta un 403 ni un 404', async () => {
    for (const status of [403, 404]) {
      const task = vi.fn().mockRejectedValue(new ApiError(status, 'x'))
      await expect(withRetry(task, 2, 1)).rejects.toBeInstanceOf(ApiError)
      expect(task).toHaveBeenCalledTimes(1)
    }
  })

  it('tras agotar los reintentos propaga el último error', async () => {
    const task = vi.fn().mockRejectedValue(new ApiError(500, 'siempre'))
    await expect(withRetry(task, 2, 1)).rejects.toMatchObject({ status: 500 })
    expect(task).toHaveBeenCalledTimes(3)
  })
})
