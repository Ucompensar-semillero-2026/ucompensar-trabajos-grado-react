import { useEffect, useState } from 'react'
import { Card, Badge } from '@/components/ui'
import { Select } from '@/components/ui/Input'
import { Bell, CheckCheck, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { notificationsApi, notifyNotificationsChanged, type NotificationOut } from '@/services/notifications.service'
import { processesApi, type ProcessOut } from '@/services/processes.service'
import { formatRelativeDate, timeAgo } from '@/utils/format'

function NotificationRow({ notification, onRead }: { notification: NotificationOut; onRead?: (n: NotificationOut) => void }) {
  const unread = onRead !== undefined && !notification.read_at
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl ${unread ? 'bg-[#FFF7F2] ring-1 ring-[#FFD9C7] dark:bg-orange-500/[0.06] dark:ring-orange-500/20' : 'bg-[var(--color-bg)]'}`}
    >
      <div className="mt-0.5">
        {notification.sent ? (
          <CheckCircle2 size={16} className="text-[var(--color-teal)]" />
        ) : notification.send_error ? (
          <XCircle size={16} className="text-red-500" />
        ) : (
          <Clock size={16} className="text-[var(--color-text-dim)]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" aria-label="Sin leer" />}
          <p className={`text-[12.5px] text-[var(--color-text)] truncate ${unread ? 'font-bold' : 'font-semibold'}`}>
            {notification.subject || 'Sin asunto'}
          </p>
          <Badge variant={notification.sent ? 'green' : notification.send_error ? 'red' : 'gray'}>
            {notification.sent ? 'Enviada' : notification.send_error ? 'Error' : 'Pendiente'}
          </Badge>
        </div>
        {notification.body && (
          <p className="text-[12px] text-[var(--color-text-muted)] mt-1">{notification.body}</p>
        )}
        {notification.send_error && (
          <p className="text-[11px] text-red-500 mt-1">{notification.send_error}</p>
        )}
        {(notification.created_at || notification.sent_at) && (
          <p className="text-[10.5px] text-[var(--color-text-dim)] mt-1.5">
            {notification.created_at ? timeAgo(notification.created_at) : formatRelativeDate(notification.sent_at as string)}
          </p>
        )}
      </div>
      {unread && (
        <button
          type="button"
          onClick={() => onRead(notification)}
          className="shrink-0 rounded-lg px-2 py-1 text-[11.5px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface)]"
        >
          Marcar como leída
        </button>
      )}
    </div>
  )
}

export function NotificacionesSection() {
  const accessToken = useAppStore((s) => s.accessToken)

  const [myNotifications, setMyNotifications] = useState<NotificationOut[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [processes, setProcesses] = useState<ProcessOut[]>([])
  const [processId, setProcessId] = useState('')
  const [processNotifications, setProcessNotifications] = useState<NotificationOut[]>([])
  const [isLoadingProcess, setIsLoadingProcess] = useState(false)
  const [processError, setProcessError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    Promise.all([notificationsApi.listMine(accessToken), processesApi.list(accessToken)])
      .then(([mine, procs]) => {
        setMyNotifications(mine)
        setProcesses(procs)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las notificaciones'))
      .finally(() => setIsLoading(false))
  }, [accessToken])

  async function selectProcess(id: string) {
    setProcessId(id)
    setProcessNotifications([])
    setProcessError(null)
    if (!accessToken || !id) return
    setIsLoadingProcess(true)
    try {
      setProcessNotifications(await notificationsApi.listForProcess(accessToken, id))
    } catch (err) {
      setProcessError(err instanceof ApiError ? err.message : 'No se pudieron cargar las notificaciones del trámite')
    } finally {
      setIsLoadingProcess(false)
    }
  }

  const markRead = (n: NotificationOut) => {
    if (!accessToken) return
    setMyNotifications((list) => list.map((x) => (x.public_id === n.public_id ? { ...x, read_at: new Date().toISOString() } : x)))
    notificationsApi.markRead(accessToken, n.public_id).then(notifyNotificationsChanged).catch(() => undefined)
  }

  const markAll = () => {
    if (!accessToken) return
    setMyNotifications((list) => list.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })))
    notificationsApi.markAllRead(accessToken).then(notifyNotificationsChanged).catch(() => undefined)
  }

  const unreadCount = myNotifications.filter((n) => !n.read_at).length

  if (isLoading) return <p className="text-[12.5px] text-[var(--color-text-dim)]">Cargando…</p>
  if (error) return <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>

  return (
    <div className="animate-in flex w-full min-w-0 flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Bell size={16} className="text-[var(--color-primary)]" />
          <h2 className="text-[18px] font-bold tracking-tight text-[var(--color-text)]">Mis notificaciones</h2>
          {unreadCount > 0 && <Badge variant="orange">{unreadCount} sin leer</Badge>}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAll}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-bg)]"
            >
              <CheckCheck size={14} aria-hidden="true" />
              Marcar todo como leído
            </button>
          )}
        </div>
        {myNotifications.length === 0 ? (
          <p className="text-[12px] text-[var(--color-text-dim)]">No tienes notificaciones registradas todavía.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {myNotifications.map((n) => (
              <NotificationRow key={n.public_id} notification={n} onRead={markRead} />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-[12px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">
          Notificaciones por trámite
        </h3>
        <Select value={processId} onChange={(e) => selectProcess(e.target.value)} className="w-full mb-4">
          <option value="">Selecciona un trámite…</option>
          {processes.map((p) => (
            <option key={p.public_id} value={p.public_id}>{p.process_code} — {p.student.full_name}</option>
          ))}
        </Select>

        {processError && (
          <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{processError}</p>
        )}
        {isLoadingProcess && <p className="text-[12px] text-[var(--color-text-dim)]">Cargando…</p>}
        {!isLoadingProcess && processId && processNotifications.length === 0 && !processError && (
          <p className="text-[12px] text-[var(--color-text-dim)]">Este trámite no tiene notificaciones registradas.</p>
        )}
        {processNotifications.length > 0 && (
          <div className="flex flex-col gap-2">
            {processNotifications.map((n) => (
              <NotificationRow key={n.public_id} notification={n} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
