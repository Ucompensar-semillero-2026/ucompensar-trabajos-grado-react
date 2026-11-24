import { ApiError } from '@/services/http'

/** Reintenta ante errores de servidor (5xx) o de red; los 4xx (permisos, no encontrado) se propagan de inmediato. */
export async function withRetry<T>(task: () => Promise<T>, retries = 2, delayMs = 600): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      const retryable = !(error instanceof ApiError) || error.status >= 500
      if (!retryable || attempt === retries) break
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)))
    }
  }
  throw lastError
}

/**
 * Como Promise.allSettled sobre `items`, pero con a lo sumo `limit` tareas en vuelo a la vez
 * y manteniendo el orden. Evita lanzar una petición por proceso en simultáneo contra la API.
 */
export async function mapSettledLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length)
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index], index) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  })
  await Promise.all(runners)
  return results
}
