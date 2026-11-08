import { useCallback, useEffect, useRef, useState } from 'react'
import { IDLE_WARNING_MS } from '@/config/sessionPolicy'
import { noteActivity, startActivityTracking, stopActivityTracking } from '@/services/activity'
import { idleTimeoutMs, lastActivityAt } from '@/services/idleClock'

// Interacciones reales. Las consultas automáticas de la página (contadores, notificaciones) no pasan por aquí,
// así que no cuentan como actividad.
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
// Con el aviso en pantalla, mover el mouse o desplazarse no basta: hay que responder al aviso (clic o tecla).
const PASSIVE_EVENTS = new Set<string>(['pointermove', 'wheel', 'scroll'])

/**
 * Cierre de sesión por inactividad. El tiempo cuenta SOLO cuando la persona no toca nada, en ninguna pestaña.
 * Dos minutos antes del cierre devuelve `secondsLeft` para mostrar el aviso; al llegar a cero llama `onTimeout`.
 * El servidor aplica el mismo límite por su cuenta (ver services/activity.ts).
 */
export function useIdleLogout(enabled: boolean, onTimeout: () => void) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const warningRef = useRef(false)
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  useEffect(() => {
    if (!enabled) return
    let fired = false
    const expire = () => {
      if (fired) return
      fired = true
      warningRef.current = false
      setSecondsLeft(null)
      onTimeoutRef.current()
    }

    startActivityTracking(expire)

    const onActivity = (event: Event) => {
      if (warningRef.current && PASSIVE_EVENTS.has(event.type)) return
      noteActivity()
    }

    // Se recalcula con la hora real (no con un contador): una pestaña en segundo plano o un equipo suspendido
    // retrasan los temporizadores, pero al volver el cálculo sale bien y se cierra si ya pasó el tiempo.
    const tick = () => {
      const left = idleTimeoutMs() - (Date.now() - lastActivityAt())
      if (left <= 0) return expire()
      const warning = left <= IDLE_WARNING_MS
      warningRef.current = warning
      setSecondsLeft(warning ? Math.ceil(left / 1000) : null)
    }

    ACTIVITY_EVENTS.forEach((type) => window.addEventListener(type, onActivity, { capture: true, passive: true }))
    document.addEventListener('visibilitychange', tick)
    tick()
    const interval = window.setInterval(tick, 1000)

    return () => {
      window.clearInterval(interval)
      ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, onActivity, { capture: true }))
      document.removeEventListener('visibilitychange', tick)
      stopActivityTracking()
      warningRef.current = false
      setSecondsLeft(null)
    }
  }, [enabled])

  const stayConnected = useCallback(() => {
    warningRef.current = false
    noteActivity()
    setSecondsLeft(null)
  }, [])

  return { secondsLeft, stayConnected }
}
