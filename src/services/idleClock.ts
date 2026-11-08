/**
 * Reloj de inactividad: cuándo fue la última actividad REAL de la persona (mouse, teclado, toque, desplazamiento).
 * Se comparte entre pestañas con localStorage: trabajar en una pestaña mantiene viva la sesión en todas.
 * Solo guarda una hora (número), nunca datos de la persona. Sin red: el aviso al servidor está en activity.ts.
 */
import { DEFAULT_IDLE_TIMEOUT_MINUTES } from '@/config/sessionPolicy'

const LAST_ACTIVITY_KEY = 'ucomp_last_activity'
// Escribir en localStorage en cada movimiento del mouse sería innecesario: basta una vez por segundo.
const WRITE_EVERY_MS = 1000

let minutes = DEFAULT_IDLE_TIMEOUT_MINUTES
let lastActivity = Date.now()
let lastWrite = 0

/** El servidor manda el tiempo real en GET /auth/me (`idle_timeout_minutes`). */
export function setIdleTimeoutMinutes(value: number | undefined) {
  if (typeof value === 'number' && value > 0) minutes = value
}

export const idleTimeoutMinutes = () => minutes
export const idleTimeoutMs = () => minutes * 60_000

function readStored(): number {
  try {
    const value = Number(localStorage.getItem(LAST_ACTIVITY_KEY))
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

/** `force`: escribe aunque haya pasado menos de un segundo (al iniciar sesión, para no heredar una hora vieja). */
export function recordActivity(now = Date.now(), force = false) {
  lastActivity = now
  if (!force && now - lastWrite < WRITE_EVERY_MS) return
  lastWrite = now
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
  } catch {
    // Sin localStorage cada pestaña cuenta por su lado; el servidor sigue controlando el cierre.
  }
}

/** La actividad más reciente de cualquier pestaña. */
export function lastActivityAt(): number {
  return Math.max(lastActivity, readStored())
}

/** Solo para pruebas. */
export function resetIdleClock() {
  minutes = DEFAULT_IDLE_TIMEOUT_MINUTES
  lastActivity = Date.now()
  lastWrite = 0
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY)
  } catch {
    // nada que limpiar
  }
}
