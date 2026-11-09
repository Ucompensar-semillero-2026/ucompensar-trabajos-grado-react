import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/app.store'
import { NOTIFICATIONS_CHANGED, notificationsApi, type NotificationOut } from '@/services/notifications.service'

export const NOTIFICATIONS_POLL_MS = 60_000
const MAX_TOASTS = 3

/**
 * Campana y avisos emergentes. Consulta el resumen cada minuto (solo con la pestaña visible) y al volver a la
 * pestaña. Los avisos que aparecen después de la primera consulta se muestran como emergentes; los que ya estaban
 * al entrar no (solo cuentan en la campana). Estas consultas automáticas no cuentan como actividad para el cierre
 * por inactividad (useIdleLogout solo escucha interacciones reales).
 */
export function useNotificationFeed() {
  const signedIn = useAppStore((s) => Boolean(s.accessToken))
  const [unread, setUnread] = useState(0)
  const [toasts, setToasts] = useState<NotificationOut[]>([])
  const seen = useRef<Set<string> | null>(null)

  const refresh = useCallback(async () => {
    const token = useAppStore.getState().accessToken
    if (!token) return
    try {
      const summary = await notificationsApi.summary(token)
      setUnread(summary.unread)
      if (seen.current === null) {
        seen.current = new Set(summary.latest_unread.map((n) => n.public_id))
        return
      }
      const known = seen.current
      const fresh = summary.latest_unread.filter((n) => !known.has(n.public_id))
      fresh.forEach((n) => known.add(n.public_id))
      if (fresh.length) setToasts((current) => [...fresh, ...current].slice(0, MAX_TOASTS))
    } catch {
      // Sin conexión o sesión vencida: la campana se queda como estaba; la siguiente consulta lo reintenta.
    }
  }, [])

  useEffect(() => {
    if (!signedIn) {
      seen.current = null
      setUnread(0)
      setToasts([])
      return
    }
    void refresh()
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, NOTIFICATIONS_POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const onChanged = () => void refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(NOTIFICATIONS_CHANGED, onChanged)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(NOTIFICATIONS_CHANGED, onChanged)
    }
  }, [signedIn, refresh])

  const dismissToast = useCallback((publicId: string) => setToasts((current) => current.filter((n) => n.public_id !== publicId)), [])

  return { unread, setUnread, toasts, dismissToast, refresh }
}
