import { useCallback, useEffect, useMemo, useState } from 'react'
import { ModalDialog as Modal } from '@/components/ui/ModalDialog'
import { CalendarDays, Eye, History, Pencil, Plus, Search } from 'lucide-react'
import { Badge, Button, Card, EmptyState } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { calendarAdminApi, type AdminCalendarEvent, type CatalogRef, type EventAction, type EventHistoryEntry, type EventStatus, type EventTypeOut, type PeriodOut } from '@/services/calendar.service'
import { LoadError } from '@/components/tutor/tutorUi'
import { EventSummary } from '@/components/publico/calendar/CalendarParts'
import { STATUS_LABEL, TIMELINE_LABEL, formatEventDates } from '@/components/publico/calendar/calendarFormat'
import type { CalendarEvent, Timeline } from '@/services/calendar.service'
import { formFromEvent, toInput, validateForm, EventForm } from './calendarioAcademico.utils'

const PAGE_SIZE = 20
const fieldClass = 'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[#0876B9]'
const labelClass = 'mb-1 block text-[12px] font-bold text-[var(--color-secondary)]'
const STATUS_VARIANT: Record<EventStatus, 'gray' | 'green' | 'blue' | 'red'> = { borrador: 'gray', publicado: 'green', cerrado: 'blue', cancelado: 'red' }

// Acciones permitidas por estado (las mismas reglas que valida el backend).
const ACTIONS: Record<EventStatus, Array<{ action: EventAction; label: string }>> = {
  borrador: [{ action: 'publicar', label: 'Publicar' }, { action: 'cancelar', label: 'Cancelar' }],
  publicado: [{ action: 'retirar', label: 'Retirar' }, { action: 'cerrar', label: 'Cerrar' }, { action: 'cancelar', label: 'Cancelar' }],
  cerrado: [],
  cancelado: [],
}

const EMPTY_FORM: EventForm = {
  title: '', description: '', event_type_id: '', academic_period_id: '', modality_ids: [], allDay: true, datesConfirmed: false,
  dateKind: 'tentativa', start: '', end: '', dateNote: '',
}

function previewEvent(form: EventForm, types: EventTypeOut[], periods: PeriodOut[], modalities: CatalogRef[]): CalendarEvent {
  const input = toInput(form)
  const now = Date.now()
  let timeline: Timeline = 'por_confirmar'
  if (input.starts_at) {
    const start = new Date(input.starts_at).getTime()
    const end = new Date(input.ends_at ?? input.starts_at).getTime() + (form.allDay ? 86_400_000 : 0)
    timeline = now < start ? 'proximo' : now < end ? 'en_curso' : 'finalizado'
  }
  const type = types.find((t) => t.id === form.event_type_id)
  const period = periods.find((p) => p.id === form.academic_period_id)
  const chosen = modalities.filter((m) => form.modality_ids.includes(m.id))
  return {
    id: 'preview', title: form.title.trim() || 'Título del evento', description: input.description,
    event_type: type ?? { id: '', code: '', name: 'Tipo de proceso' }, period: period ?? null, modalities: chosen,
    applies_to_all_modalities: chosen.length === 0, starts_at: input.starts_at, ends_at: input.ends_at, all_day: form.allDay,
    dates_confirmed: form.datesConfirmed, date_kind: form.dateKind, date_note: input.date_note, status: 'publicado', timeline,
  }
}

type Dialog =
  | { kind: 'form'; event: AdminCalendarEvent | null }
  | { kind: 'preview'; event: AdminCalendarEvent }
  | { kind: 'history'; event: AdminCalendarEvent; rows: EventHistoryEntry[] | null }
  | { kind: 'action'; event: AdminCalendarEvent; action: EventAction }

export function CalendarioAcademico() {
  const accessToken = useAppStore((s) => s.accessToken)
  const [events, setEvents] = useState<AdminCalendarEvent[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<EventStatus | ''>('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [types, setTypes] = useState<EventTypeOut[]>([])
  const [periods, setPeriods] = useState<PeriodOut[]>([])
  const [modalities, setModalities] = useState<CatalogRef[]>([])

  const loadCatalogs = useCallback(() => {
    if (!accessToken) return
    Promise.all([calendarAdminApi.types(accessToken), calendarAdminApi.periods(accessToken), calendarAdminApi.modalities(accessToken)])
      .then(([t, p, m]) => { setTypes(t.filter((x) => x.active)); setPeriods(p.filter((x) => x.active)); setModalities(m) })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los catálogos.'))
  }, [accessToken])

  const loadEvents = useCallback(() => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    calendarAdminApi
      .list(accessToken, { status: status || undefined, search: search.trim() || undefined, page, page_size: PAGE_SIZE })
      .then((res) => { setEvents(res.items); setTotal(res.total) })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el calendario.'))
      .finally(() => setLoading(false))
  }, [accessToken, status, search, page])

  useEffect(loadCatalogs, [loadCatalogs])
  useEffect(loadEvents, [loadEvents])

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const openHistory = (event: AdminCalendarEvent) => {
    setDialog({ kind: 'history', event, rows: null })
    if (!accessToken) return
    calendarAdminApi.history(accessToken, event.id)
      .then((rows) => setDialog({ kind: 'history', event, rows }))
      .catch(() => setDialog({ kind: 'history', event, rows: [] }))
  }

  const done = (message: string) => { setDialog(null); setNotice(message); loadEvents() }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="cal-admin-status" className={labelClass}>Estado</label>
            <select id="cal-admin-status" className={fieldClass} value={status} onChange={(e) => { setStatus(e.target.value as EventStatus | ''); setPage(1) }}>
              <option value="">Todos</option>
              {(Object.keys(STATUS_LABEL) as EventStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cal-admin-search" className={labelClass}>Buscar por título</label>
            <div className="relative"><Search size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)]" />
              <input id="cal-admin-search" type="search" className={`${fieldClass} pl-8`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} /></div>
          </div>
        </div>
        <Button type="button" className="gap-2" onClick={() => setDialog({ kind: 'form', event: null })}><Plus size={15} aria-hidden="true" />Nuevo evento</Button>
      </div>

      {notice && <p role="status" className="rounded-xl border border-[#BFE3CF] bg-[#EAF7F1] px-4 py-3 text-[13px] font-medium text-[#116A3E]">{notice}</p>}
      {error && <LoadError message={error} onRetry={() => { loadCatalogs(); loadEvents() }} />}

      <Card className="overflow-hidden p-0">
        {loading ? (
          <p role="status" className="p-6 text-[13px] text-[var(--color-text-muted)]">Cargando eventos…</p>
        ) : events.length === 0 && !error ? (
          <EmptyState icon={CalendarDays} title="Aún no hay eventos" description="Crea el primer evento como borrador. Nada se muestra a los estudiantes hasta que lo publiques." />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {events.map((event) => (
              <li key={event.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-bold text-[var(--color-secondary)]">{event.title}</p>
                    <Badge variant={STATUS_VARIANT[event.status]}>{STATUS_LABEL[event.status]}</Badge>
                    <Badge variant="gray">{TIMELINE_LABEL[event.timeline]}</Badge>
                  </div>
                  <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
                    {event.event_type.name}{event.period ? ` · ${event.period.name}` : ''} · {formatEventDates(event)} · {event.dates_confirmed ? (event.date_kind === 'oficial' ? 'Oficial' : 'Tentativa') : 'Por confirmar'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(event.status === 'borrador' || event.status === 'publicado') && <Button type="button" variant="outline" size="sm" className="gap-1.5" aria-label={`Editar ${event.title}`} onClick={() => setDialog({ kind: 'form', event })}><Pencil size={13} aria-hidden="true" />Editar</Button>}
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" aria-label={`Previsualizar ${event.title}`} onClick={() => setDialog({ kind: 'preview', event })}><Eye size={13} aria-hidden="true" />Vista previa</Button>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" aria-label={`Historial de ${event.title}`} onClick={() => openHistory(event)}><History size={13} aria-hidden="true" />Historial</Button>
                  {ACTIONS[event.status].map(({ action, label }) => (
                    <Button key={action} type="button" size="sm" variant={action === 'publicar' ? 'primary' : 'outline'} aria-label={`${label} ${event.title}`} onClick={() => setDialog({ kind: 'action', event, action })}>{label}</Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between text-[12.5px] text-[var(--color-text-muted)]">
          <span>Página {page} de {pages} · {total} eventos</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Siguiente</Button>
          </div>
        </div>
      )}

      {dialog?.kind === 'form' && accessToken && (
        <EventFormDialog token={accessToken} event={dialog.event} types={types} periods={periods} modalities={modalities}
          onPeriodCreated={(p) => setPeriods((current) => [p, ...current])} onClose={() => setDialog(null)}
          onSaved={(saved) => done(`Evento «${saved.title}» guardado como ${STATUS_LABEL[saved.status].toLowerCase()}.`)} />
      )}
      {dialog?.kind === 'preview' && (
        <Modal title="Así lo verá el estudiante" onClose={() => setDialog(null)}><EventSummary event={{ ...dialog.event, status: 'publicado' }} headingLevel={3} /></Modal>
      )}
      {dialog?.kind === 'history' && (
        <Modal title={`Historial · ${dialog.event.title}`} onClose={() => setDialog(null)}>
          {dialog.rows === null ? <p role="status" className="text-[13px]">Cargando historial…</p> : dialog.rows.length === 0 ? <p className="text-[13px]">Sin registros.</p> : (
            <ol className="space-y-2">{dialog.rows.map((row, i) => (
              <li key={i} className="rounded-xl border border-[var(--color-border)] p-3 text-[13px]">
                <p className="font-bold text-[var(--color-secondary)]">{row.action}{row.to_status && row.to_status !== row.from_status ? ` → ${row.to_status}` : ''}</p>
                <p className="text-[var(--color-text-muted)]">{row.actor} · {new Date(row.created_at + 'Z').toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
                {row.comment && <p className="mt-1">{row.comment}</p>}
              </li>))}</ol>
          )}
        </Modal>
      )}
      {dialog?.kind === 'action' && accessToken && (
        <ActionDialog token={accessToken} event={dialog.event} action={dialog.action} onClose={() => setDialog(null)}
          onDone={(saved) => done(`Evento «${saved.title}»: ahora está ${STATUS_LABEL[saved.status].toLowerCase()}.`)} />
      )}
    </div>
  )
}

function ActionDialog({ token, event, action, onClose, onDone }: { token: string; event: AdminCalendarEvent; action: EventAction; onClose: () => void; onDone: (e: AdminCalendarEvent) => void }) {
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const needsReason = action === 'cerrar' || action === 'cancelar'
  const pending = action === 'publicar' && !event.dates_confirmed
  const verb: Record<EventAction, string> = { publicar: 'Publicar', retirar: 'Retirar', cerrar: 'Cerrar', cancelar: 'Cancelar' }

  const confirm = async () => {
    if (busy) return
    if (needsReason && !comment.trim()) return setError('Indica el motivo.')
    setBusy(true)
    setError(null)
    try {
      onDone(await calendarAdminApi.transition(token, event.id, action, comment))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción.')
      setBusy(false)
    }
  }

  return (
    <Modal title={`${verb[action]} evento`} onClose={onClose} footer={<>
      <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Volver</Button>
      <Button type="button" onClick={() => void confirm()} disabled={busy}>{busy ? 'Procesando…' : `Confirmar: ${verb[action].toLowerCase()}`}</Button>
    </>}>
      <p className="text-[13px]">Evento: <strong>{event.title}</strong></p>
      {action === 'publicar' && <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">Al publicarlo, cualquier visitante podrá verlo en el calendario público.</p>}
      {pending && <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">Las fechas de este evento aún no están confirmadas. Se publicará como «Fecha por confirmar» y no se mostrará un día exacto ni como oficial.</p>}
      {action === 'retirar' && <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">Volverá a borrador y dejará de ser visible para los estudiantes.</p>}
      {needsReason && (
        <div className="mt-3"><label htmlFor="cal-action-reason" className={labelClass}>Motivo</label>
          <textarea id="cal-action-reason" rows={3} maxLength={1000} className={fieldClass} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
      )}
      {error && <p role="alert" className="mt-3 text-[13px] font-medium text-red-700">{error}</p>}
    </Modal>
  )
}

function EventFormDialog({ token, event, types, periods, modalities, onPeriodCreated, onClose, onSaved }: {
  token: string; event: AdminCalendarEvent | null; types: EventTypeOut[]; periods: PeriodOut[]; modalities: CatalogRef[]
  onPeriodCreated: (p: PeriodOut) => void; onClose: () => void; onSaved: (e: AdminCalendarEvent) => void
}) {
  const [form, setForm] = useState<EventForm>(() => (event ? formFromEvent(event) : EMPTY_FORM))
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newPeriod, setNewPeriod] = useState({ code: '', name: '' })
  const [periodError, setPeriodError] = useState<string | null>(null)
  const errors = attempted ? validateForm(form) : {}
  const set = <K extends keyof EventForm>(key: K, value: EventForm[K]) => setForm((c) => ({ ...c, [key]: value }))
  const preview = useMemo(() => previewEvent(form, types, periods, modalities), [form, types, periods, modalities])

  const save = async () => {
    if (saving) return
    setAttempted(true)
    setError(null)
    if (Object.keys(validateForm(form)).length > 0) return
    setSaving(true)
    try {
      const body = toInput(form)
      onSaved(event ? await calendarAdminApi.update(token, event.id, body) : await calendarAdminApi.create(token, body))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el evento.')
      setSaving(false)
    }
  }

  const addPeriod = async () => {
    setPeriodError(null)
    try {
      const created = await calendarAdminApi.createPeriod(token, { code: newPeriod.code.trim(), name: newPeriod.name.trim() })
      onPeriodCreated(created)
      set('academic_period_id', created.id)
      setNewPeriod({ code: '', name: '' })
    } catch (err) {
      setPeriodError(err instanceof ApiError ? err.message : 'Revisa el código (p. ej. 2026-1) y el nombre del periodo.')
    }
  }

  const err = (text?: string) => text && <p role="alert" className="mt-1 text-[12px] font-medium text-red-700">{text}</p>

  return (
    <Modal title={event ? 'Editar evento' : 'Nuevo evento'} onClose={onClose} wide footer={<>
      <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
      <Button type="submit" form="calendar-event-form" disabled={saving}>{saving ? 'Guardando…' : event?.status === 'publicado' ? 'Guardar cambios' : 'Guardar como borrador'}</Button>
    </>}>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
        <form id="calendar-event-form" className="grid min-w-0 gap-4" noValidate onSubmit={(e) => { e.preventDefault(); void save() }}>
          <div><label htmlFor="ev-title" className={labelClass}>Título</label>
            <input id="ev-title" className={fieldClass} maxLength={200} value={form.title} onChange={(e) => set('title', e.target.value)} />{err(errors.title)}</div>
          <div><label htmlFor="ev-desc" className={labelClass}>Descripción (opcional)</label>
            <textarea id="ev-desc" rows={3} maxLength={2000} className={fieldClass} value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="ev-type" className={labelClass}>Tipo de proceso</label>
              <select id="ev-type" className={fieldClass} value={form.event_type_id} onChange={(e) => set('event_type_id', e.target.value)}>
                <option value="">Selecciona…</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>{err(errors.type)}</div>
            <div><label htmlFor="ev-period" className={labelClass}>Periodo académico</label>
              <select id="ev-period" className={fieldClass} value={form.academic_period_id} onChange={(e) => set('academic_period_id', e.target.value)}>
                <option value="">Sin periodo</option>{periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          </div>
          <fieldset className="rounded-xl border border-dashed border-[var(--color-border)] p-3">
            <legend className="px-1 text-[12px] font-bold text-[var(--color-secondary)]">Nuevo periodo (opcional)</legend>
            <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <input aria-label="Código del periodo" placeholder="2026-1" className={fieldClass} value={newPeriod.code} onChange={(e) => setNewPeriod({ ...newPeriod, code: e.target.value })} />
              <input aria-label="Nombre del periodo" placeholder="Primer periodo de 2026" className={fieldClass} value={newPeriod.name} onChange={(e) => setNewPeriod({ ...newPeriod, name: e.target.value })} />
              <Button type="button" variant="outline" size="sm" disabled={!newPeriod.code.trim() || !newPeriod.name.trim()} onClick={() => void addPeriod()}>Crear periodo</Button>
            </div>{err(periodError ?? undefined)}
          </fieldset>
          <fieldset>
            <legend className={labelClass}>Modalidades a las que aplica</legend>
            <p className="mb-2 text-[12px] text-[var(--color-text-muted)]">Sin selección, el evento es general y aplica a todas las modalidades.</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {modalities.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={form.modality_ids.includes(m.id)} onChange={(e) => set('modality_ids', e.target.checked ? [...form.modality_ids, m.id] : form.modality_ids.filter((id) => id !== m.id))} />{m.name}
                </label>))}
            </div>
          </fieldset>
          <fieldset className="grid gap-3 rounded-xl border border-[var(--color-border)] p-3">
            <legend className="px-1 text-[12px] font-bold text-[var(--color-secondary)]">Fechas</legend>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={form.datesConfirmed} onChange={(e) => setForm((c) => ({ ...c, datesConfirmed: e.target.checked, dateKind: e.target.checked ? c.dateKind : 'tentativa' }))} />Las fechas están confirmadas</label>
            {!form.datesConfirmed && <p className="text-[12px] text-[var(--color-text-muted)]">Se publicará como «Fecha por confirmar», sin un día exacto.</p>}
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={form.allDay} disabled={!form.datesConfirmed} onChange={(e) => setForm((c) => ({ ...c, allDay: e.target.checked, start: '', end: '' }))} />Evento de día completo (sin hora)</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="ev-start" className={labelClass}>Inicio</label>
                <input id="ev-start" type={form.allDay ? 'date' : 'datetime-local'} disabled={!form.datesConfirmed} className={fieldClass} value={form.start} onChange={(e) => set('start', e.target.value)} />{err(errors.start)}</div>
              <div><label htmlFor="ev-end" className={labelClass}>Cierre (opcional)</label>
                <input id="ev-end" type={form.allDay ? 'date' : 'datetime-local'} disabled={!form.datesConfirmed} className={fieldClass} value={form.end} onChange={(e) => set('end', e.target.value)} />{err(errors.end)}</div>
            </div>
            <div><label htmlFor="ev-note" className={labelClass}>Nota sobre la fecha (opcional)</label>
              <input id="ev-note" className={fieldClass} maxLength={200} placeholder="Ej.: segundo semestre" value={form.dateNote} onChange={(e) => set('dateNote', e.target.value)} /></div>
            <div role="radiogroup" aria-label="Carácter de la fecha" className="flex flex-wrap gap-4 text-[13px]">
              <label className="flex items-center gap-2"><input type="radio" name="ev-kind" checked={form.dateKind === 'tentativa'} onChange={() => set('dateKind', 'tentativa')} />Tentativa</label>
              <label className="flex items-center gap-2"><input type="radio" name="ev-kind" disabled={!form.datesConfirmed} checked={form.dateKind === 'oficial'} onChange={() => set('dateKind', 'oficial')} />Oficial</label>
            </div>{err(errors.kind)}
          </fieldset>
          {error && <p role="alert" className="text-[13px] font-medium text-red-700">{error}</p>}
        </form>
        <aside aria-label="Previsualización" className="min-w-0 space-y-2 border-t border-[var(--color-border)] pt-5 lg:sticky lg:top-0 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Así lo verá el estudiante</p>
          <EventSummary event={preview} headingLevel={3} />
        </aside>
      </div>
    </Modal>
  )
}
