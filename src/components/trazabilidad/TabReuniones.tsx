import { useEffect, useState } from 'react'
import { CalendarDays, Users } from 'lucide-react'
import { Button, Card, EmptyState } from '@/components/ui'
import type { ActorTramite, ReunionTramite } from '@/services/trazabilidad.service'
import { guardarReunionLocal, listarReunionesLocales } from '@/services/trazabilidad.service'
import { formatRelativeDate } from '@/utils/format'

export function TabReuniones({ processId, actor, canManage, initialMeetings = [], onAdd }: { processId: string; actor: ActorTramite; canManage: boolean; initialMeetings?: ReunionTramite[]; onAdd?: (reunion: Omit<ReunionTramite, 'id' | 'registradaPor'>) => Promise<ReunionTramite> | ReunionTramite }) {
  const [meetings, setMeetings] = useState<ReunionTramite[]>([])
  const [date, setDate] = useState(new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16))
  const [topic, setTopic] = useState('')
  const [commitments, setCommitments] = useState('')
  const [attendees, setAttendees] = useState(actor.nombre)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const stored = listarReunionesLocales(processId)
    const initialIds = new Set(initialMeetings.map((meeting) => meeting.id))
    setMeetings([...initialMeetings, ...stored.filter((meeting) => !initialIds.has(meeting.id))])
  }, [initialMeetings, processId])

  const submit = async () => {
    if (busy) return
    setBusy(true)
    try {
      const payload = {
        fecha: new Date(date).toISOString(),
        tema: topic,
        compromisos: commitments,
        asistentes: attendees.split(',').map((name) => name.trim()).filter(Boolean),
      }
      const saved = onAdd
        ? await onAdd(payload)
        : guardarReunionLocal(processId, payload, actor)
      setMeetings((current) => [...current, saved])
      setTopic('')
      setCommitments('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la asesoría.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="space-y-4">
    <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Prototipo local: las asesorías se guardan en este navegador y no se sincronizan con el servidor.</p>
    {canManage && <Card className="space-y-3">
      <h3 className="text-sm font-bold text-[var(--color-text)]">Registrar asesoría</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label">Fecha y hora<input className="field-input mt-1" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field-label">Tema<input className="field-input mt-1" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tema de la reunión" /></label>
      </div>
      <label className="field-label">Compromisos<textarea className="field-input mt-1 resize-y" rows={3} value={commitments} onChange={(e) => setCommitments(e.target.value)} placeholder="Acuerdos y próximos pasos" /></label>
      <label className="field-label">Asistentes separados por coma<input className="field-input mt-1" value={attendees} onChange={(e) => setAttendees(e.target.value)} /></label>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end"><Button onClick={() => void submit()} disabled={!topic.trim() || !date || busy}>{busy ? 'Guardando…' : 'Guardar asesoría'}</Button></div>
    </Card>}
    {meetings.length === 0 ? <EmptyState icon={CalendarDays} title="Sin asesorías registradas" description="Las reuniones de seguimiento aparecerán aquí." /> : <ol className="space-y-3">{[...meetings].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((meeting) => <li key={meeting.id}><Card className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-[var(--color-text)]">{meeting.tema}</h3><time dateTime={meeting.fecha} className="text-xs text-[var(--color-text-muted)]">{formatRelativeDate(meeting.fecha)}</time></div>
      {meeting.compromisos && <p className="whitespace-pre-wrap text-sm text-[var(--color-text)]">{meeting.compromisos}</p>}
      <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"><Users size={14} aria-hidden="true" />{meeting.asistentes.join(', ') || 'Sin asistentes registrados'} · Registró {meeting.registradaPor}</p>
    </Card></li>)}</ol>}
  </div>
}
