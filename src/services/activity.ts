/**
 * Aviso de actividad al servidor (POST /auth/activity). El servidor es quien decide el cierre por inactividad:
 * si la página no le avisa, la sesión deja de renovarse a los `idle_timeout_minutes`, aunque alguien manipule el
 * navegador o deje la pestaña abierta.
 *
 * Como mucho un aviso por minuto POR NAVEGADOR (la hora del último aviso se comparte entre pestañas). Si hubo
 * actividad dentro de ese minuto, se avisa al final del minuto: así el servidor nunca va por detrás de la página.
 */
import { IDLE_EXPIRED_DETAIL } from '@/config/sessionPolicy'
import { authApi } from './auth.service'
import { ApiError } from './http'
import { lastActivityAt, recordActivity } from './idleClock'

const REPORTED_KEY = 'ucomp_activity_reported'
export const REPORT_INTERVAL_MS = 60_000

let lastReport = 0
let timer: ReturnType<typeof setTimeout> | null = null
let onIdleRejected: (() => void) | null = null

function reportedAt(): number {
  try {
    const stored = Number(localStorage.getItem(REPORTED_KEY))
    return Math.max(lastReport, Number.isFinite(stored) ? stored : 0)
  } catch {
    return lastReport
  }
}

function send(now: number) {
  lastReport = now
  try {
    localStorage.setItem(REPORTED_KEY, String(now))
  } catch {
    // se usa la hora en memoria
  }
  authApi.activity().catch((err) => {
    // El servidor ya cerró la sesión por inactividad: la página también la cierra y lo explica.
    // Otros errores (sin conexión, sesión vencida) los maneja la siguiente llamada normal.
    if (err instanceof ApiError && err.status === 401 && err.message === IDLE_EXPIRED_DETAIL) onIdleRejected?.()
  })
}

function schedule(now: number) {
  const due = reportedAt() + REPORT_INTERVAL_MS
  if (now >= due) {
    send(now)
    return
  }
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    if (onIdleRejected && lastActivityAt() > reportedAt()) send(Date.now())
  }, due - now)
}

/** Actividad real de la persona en esta pestaña. */
export function noteActivity(now = Date.now()) {
  recordActivity(now)
  if (onIdleRejected) schedule(now)
}

/** Al entrar al portal (inicio de sesión o recarga de la página, que también es actividad). */
export function startActivityTracking(onServerClosedForIdle: () => void) {
  onIdleRejected = onServerClosedForIdle
  const now = Date.now()
  recordActivity(now, true)
  schedule(now)
}

export function stopActivityTracking() {
  onIdleRejected = null
  if (timer) clearTimeout(timer)
  timer = null
}

/** Solo para pruebas. */
export function resetActivityReports() {
  stopActivityTracking()
  lastReport = 0
  try {
    localStorage.removeItem(REPORTED_KEY)
  } catch {
    // nada que limpiar
  }
}
