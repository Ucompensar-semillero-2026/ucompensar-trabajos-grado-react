import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AlarmClock, Bell, CheckCheck, X } from 'lucide-react'
import { useAppStore } from '@/stores/app.store'
import { useNotificationFeed } from '@/hooks/useNotificationFeed'
import { notificationsApi, notifyNotificationsChanged, type NotificationOut } from '@/services/notifications.service'
import { timeAgo } from '@/utils/format'

const TOAST_MS = 7000

function isAlert(n: NotificationOut) {
  return n.category === 'alerta'
}

function Icon({ n, size = 16 }: { n: NotificationOut; size?: number }) {
  return isAlert(n) ? <AlarmClock size={size} aria-hidden="true" /> : <Bell size={size} aria-hidden="true" />
}

/**
 * Campana del encabezado: número de no leídos, panel con los últimos avisos y avisos emergentes (abajo a la derecha)
 * cuando llega uno nuevo. Al abrir un aviso se marca como leído y lleva a su pantalla.
 */
export function NotificationBell({ className }: { className: string }) {
  const navigate = useNavigate()
  const { unread, setUnread, toasts, dismissToast } = useNotificationFeed()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationOut[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const token = () => useAppStore.getState().accessToken

  useEffect(() => {
    if (!open) return
    const token = useAppStore.getState().accessToken
    if (!token) return
    setLoadError(false)
    notificationsApi.listMine(token, 10).then(setItems).catch(() => setLoadError(true))
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openNotification = (n: NotificationOut) => {
    const t = token()
    if (t && !n.read_at) {
      setUnread((count) => Math.max(0, count - 1))
      setItems((list) => list?.map((x) => (x.public_id === n.public_id ? { ...x, read_at: new Date().toISOString() } : x)) ?? list)
      notificationsApi.markRead(t, n.public_id).then(notifyNotificationsChanged).catch(() => undefined)
    }
    dismissToast(n.public_id)
    setOpen(false)
    navigate(n.link && n.link.startsWith('/') ? n.link : '/notificaciones')
  }

  const markAll = () => {
    const t = token()
    if (!t) return
    setUnread(0)
    setItems((list) => list?.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })) ?? list)
    notificationsApi.markAllRead(t).then(notifyNotificationsChanged).catch(() => undefined)
  }

  const badge = unread > 99 ? '99+' : String(unread)

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={className}
        aria-label={unread ? `Notificaciones: ${unread} sin leer` : 'Notificaciones'}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notificaciones"
      >
        <span className="relative inline-flex">
          <Bell size={18} aria-hidden />
          {unread > 0 && (
            <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#E53935] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[var(--color-surface)]">
              {badge}
            </span>
          )}
        </span>
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Notificaciones"
          className="fu-rise absolute right-0 top-[calc(100%+8px)] z-[90] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_24px_60px_-18px_rgba(3,28,52,0.45)]"
        >
          <header className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
            <h2 className="text-[14px] font-bold text-[var(--color-text)]">Notificaciones</h2>
            <button
              type="button"
              onClick={markAll}
              disabled={unread === 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-bg)] disabled:cursor-default disabled:text-[var(--color-text-dim)] disabled:hover:bg-transparent"
            >
              <CheckCheck size={14} aria-hidden="true" />
              Marcar todo como leído
            </button>
          </header>

          <div className="max-h-[min(420px,60vh)] overflow-y-auto">
            {loadError ? (
              <p className="px-4 py-6 text-center text-[12.5px] text-red-600">No se pudieron cargar las notificaciones.</p>
            ) : items === null ? (
              <p className="px-4 py-6 text-center text-[12.5px] text-[var(--color-text-dim)]">Cargando…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12.5px] text-[var(--color-text-dim)]">No tienes notificaciones.</p>
            ) : (
              <ul>
                {items.map((n) => {
                  const unreadItem = !n.read_at
                  return (
                    <li key={n.public_id}>
                      <button
                        type="button"
                        onClick={() => openNotification(n)}
                        className={`flex w-full items-start gap-3 border-b border-[var(--color-border)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--color-bg)] ${unreadItem ? 'bg-[#FFF7F2] dark:bg-orange-500/[0.06]' : ''}`}
                      >
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isAlert(n) ? 'bg-[#FFF4E5] text-[#B45309] dark:bg-amber-500/15 dark:text-amber-300' : 'bg-[#EAF4FB] text-[#0876B9] dark:bg-sky-500/15 dark:text-sky-300'}`}>
                          <Icon n={n} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className={`truncate text-[13px] ${unreadItem ? 'font-bold text-[var(--color-text)]' : 'font-medium text-[var(--color-text-muted)]'}`}>
                              {n.subject || 'Aviso'}
                            </span>
                            {n.created_at && <span className="shrink-0 text-[11px] text-[var(--color-text-dim)]">{timeAgo(n.created_at)}</span>}
                          </span>
                          {n.body && <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-[var(--color-text-muted)]">{n.body}</span>}
                        </span>
                        {unreadItem && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" aria-label="Sin leer" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <footer className="border-t border-[var(--color-border)] px-4 py-2.5 text-center">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate('/notificaciones')
              }}
              className="text-[12.5px] font-bold text-[var(--color-primary)] hover:underline"
            >
              Ver todas
            </button>
          </footer>
        </section>
      )}

      <NotificationToasts toasts={toasts} onOpen={openNotification} onDismiss={dismissToast} />
    </div>
  )
}

function NotificationToasts({ toasts, onOpen, onDismiss }: { toasts: NotificationOut[]; onOpen: (n: NotificationOut) => void; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null
  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[105] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2.5" role="status" aria-live="polite">
      {toasts.map((n) => (
        <Toast key={n.public_id} n={n} onOpen={onOpen} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  )
}

function Toast({ n, onOpen, onDismiss }: { n: NotificationOut; onOpen: (n: NotificationOut) => void; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(n.public_id), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [n.public_id, onDismiss])

  return (
    <div className="fu-rise pointer-events-auto flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-[0_18px_44px_-14px_rgba(3,28,52,0.5)]">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isAlert(n) ? 'bg-[#FFF4E5] text-[#B45309] dark:bg-amber-500/15 dark:text-amber-300' : 'bg-[#EAF4FB] text-[#0876B9] dark:bg-sky-500/15 dark:text-sky-300'}`}>
        <Icon n={n} size={18} />
      </span>
      <button type="button" onClick={() => onOpen(n)} className="min-w-0 flex-1 text-left">
        <span className="block text-[13px] font-bold text-[var(--color-text)]">{n.subject || 'Nuevo aviso'}</span>
        {n.body && <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-[var(--color-text-muted)]">{n.body}</span>}
      </button>
      <button type="button" onClick={() => onDismiss(n.public_id)} aria-label="Cerrar aviso" className="rounded-lg p-1 text-[var(--color-text-dim)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]">
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  )
}
