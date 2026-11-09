import { ApiError } from '@/services/http'

/** El mensaje que mandó el servidor (ya en español y con la causa real); si no hay, uno genérico. */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback
}
