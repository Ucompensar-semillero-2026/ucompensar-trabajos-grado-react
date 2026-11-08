import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Eye, FileText, Send, Upload, X } from 'lucide-react'
import { Button, Card, EmptyState } from '@/components/ui'
import {
  agregarComentarioDemo,
  agregarReunionDemo,
  asignarJuradoDemo,
  asignarTutorDemo,
  cambiarEstadoDemo,
  cargarDocumentoDemo,
  obtenerTramiteDemo,
  PERSONAS_MOCK,
  programarSustentacionDemo,
  type EventoTramite,
  type EstadoTramite,
  type TramiteTrazabilidad,
  type VersionDocumento,
} from '@/services/trazabilidad.service'
import { parseUtc } from '@/utils/format'
import { EstadoBadge } from './EstadoBadge'
import { ResumenTramite } from './ResumenTramite'
import { TabComentarios } from './TabComentarios'
import { TabReuniones } from './TabReuniones'
import { usePermisos } from './usePermisos'

type DetailTab = 'historial' | 'documentos' | 'comentarios' | 'reuniones'
const AVAILABLE_STATES: Partial<Record<EstadoTramite, EstadoTramite[]>> = {
  ENVIADO: ['EN_REVISION', 'DEVUELTO', 'RECHAZADO'],
  EN_REVISION: ['APROBADO', 'DEVUELTO', 'RECHAZADO'],
  DEVUELTO: ['EN_REVISION', 'RECHAZADO'],
  APROBADO: ['EN_SUSTENTACION', 'FINALIZADO'],
  EN_SUSTENTACION: ['FINALIZADO', 'DEVUELTO'],
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(parseUtc(value))
}

function stateClass(state: EstadoTramite) {
  if (state === 'APROBADO' || state === 'FINALIZADO') return 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
  if (state === 'EN_REVISION' || state === 'EN_SUSTENTACION') return 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
  if (state === 'DEVUELTO' || state === 'RECHAZADO') return 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
  return 'border-[var(--color-border)] bg-[var(--color-bg)]'
}

function downloadVersion(version: VersionDocumento) {
  const link = document.createElement('a')
  if (version.contenido.startsWith('data:')) {
    link.href = version.contenido
  } else {
    link.href = URL.createObjectURL(new Blob([version.contenido], { type: version.mimeType }))
  }
  link.download = version.nombreArchivo
  link.click()
  if (link.href.startsWith('blob:')) URL.revokeObjectURL(link.href)
}

function HistorialDemo({ events, onDocument }: { events: EventoTramite[]; onDocument: (id: string) => void }) {
  const [type, setType] = useState('')
  const [user, setUser] = useState('')
  const types = useMemo(() => [...new Set(events.map((event) => event.tipo))].sort(), [events])
  const users = useMemo(() => [...new Map(events.map((event) => [event.usuarioId, event.usuarioNombre])).entries()], [events])
  const filtered = events.filter((event) => (!type || event.tipo === type) && (!user || event.usuarioId === user))
  return <Card>
    <div className="mb-4 flex flex-wrap gap-3">
      <label className="field-label">Tipo de evento<select aria-label="Filtrar por tipo de evento" className="field-input mt-1" value={type} onChange={(event) => setType(event.target.value)}><option value="">Todos</option>{types.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="field-label">Usuario<select aria-label="Filtrar por usuario" className="field-input mt-1" value={user} onChange={(event) => setUser(event.target.value)}><option value="">Todos</option>{users.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    </div>
    {filtered.length === 0 ? <EmptyState icon={FileText} title="No hay movimientos" description="No hay eventos que coincidan con los filtros seleccionados." /> : (
      <ol className="space-y-3">
        {filtered.map((event) => <li key={event.id} className={`rounded-xl border p-4 ${stateClass(event.estadoNuevo)}`}>
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-bold text-[var(--color-text)]">{event.tipo}</h3><p className="mt-1 text-xs text-[var(--color-text-muted)]">{event.usuarioNombre} · {event.rol}</p></div><time dateTime={event.fecha} className="text-xs text-[var(--color-text-muted)]">{formatDate(event.fecha)}</time></div>
          <p className="mt-2 text-sm text-[var(--color-text)]">{event.detalle}</p>
          {event.estadoAnterior && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{event.estadoAnterior.replace(/_/g, ' ')} → {event.estadoNuevo.replace(/_/g, ' ')}</p>}
          {event.documentoId && <button type="button" onClick={() => onDocument(event.documentoId!)} className="mt-2 text-xs font-semibold text-[#0876B9] underline">Abrir documento adjunto</button>}
        </li>)}
      </ol>
    )}
  </Card>
}

function DocumentosDemo({ tramite, canUpload, onUpload, onPreview }: {
  tramite: TramiteTrazabilidad
  canUpload: boolean
  onUpload: (file: File) => void
  onPreview: (version: VersionDocumento) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return <Card>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-[17px] font-bold text-[var(--color-text)]">Documentos y versiones</h2><p className="text-xs text-[var(--color-text-muted)]">Ejemplo local: los archivos no se envían al servidor.</p></div>
      {canUpload && <>
        <input ref={inputRef} type="file" className="sr-only" aria-label="Seleccionar documento para cargar" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.currentTarget.value = '' }} />
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}><Upload size={14} aria-hidden="true" /> Cargar documento</Button>
      </>}
    </div>
    {tramite.documentos.length === 0 ? <EmptyState icon={FileText} title="Aún no hay documentos" description="Los documentos cargados aparecerán aquí." /> : <div className="space-y-3">
      {tramite.documentos.map((doc) => <section key={doc.id} className="rounded-xl border border-[var(--color-border)] p-4">
        <h3 className="text-sm font-bold text-[var(--color-text)]">{doc.nombre}</h3>
        <ol className="mt-2 divide-y divide-[var(--color-border)]">
          {[...doc.versiones].reverse().map((version) => <li key={`${doc.id}-${version.version}`} className="flex flex-wrap items-center gap-2 py-2">
            <div className="min-w-0 flex-1"><p className="truncate text-sm text-[var(--color-text)]">{version.nombreArchivo} · v{version.version}</p><p className="text-xs text-[var(--color-text-muted)]">{formatDate(version.fecha)} · {version.autor.nombre}</p></div>
            <EstadoBadge estado={version.estado === 'Aprobado' ? 'APROBADO' : version.estado === 'Devuelto' ? 'DEVUELTO' : 'EN_REVISION'} />
            <button type="button" aria-label={`Previsualizar ${version.nombreArchivo}`} onClick={() => onPreview(version)} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"><Eye size={16} aria-hidden="true" /></button>
            <button type="button" aria-label={`Descargar ${version.nombreArchivo}`} onClick={() => downloadVersion(version)} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"><Download size={16} aria-hidden="true" /></button>
          </li>)}
        </ol>
      </section>)}
    </div>}
  </Card>
}

export function DetalleDemoTrazabilidad({ tramiteId }: { tramiteId: string }) {
  const [tramite, setTramite] = useState<TramiteTrazabilidad | null>(null)
  const [tab, setTab] = useState<DetailTab>('historial')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [preview, setPreview] = useState<VersionDocumento | null>(null)
  const [selectedTutor, setSelectedTutor] = useState('')
  const [selectedJury, setSelectedJury] = useState('')
  const [sustentationDate, setSustentationDate] = useState('')
  const [busy, setBusy] = useState(false)
  const { actor, canView, canComment, canManage } = usePermisos()

  useEffect(() => {
    setTramite(obtenerTramiteDemo(tramiteId))
  }, [tramiteId])

  const runAction = async (action: () => Promise<TramiteTrazabilidad> | TramiteTrazabilidad, message: string) => {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      setTramite(await action())
      setSuccess(message)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo completar la acción.')
    } finally {
      setBusy(false)
    }
  }

  if (!tramite) return <Card><p role="status" className="text-sm text-[var(--color-text-muted)]">Cargando ejemplo…</p></Card>
  if (!canView(tramite)) return <Card className="max-w-3xl text-center"><h1 className="text-xl font-bold text-[var(--color-text)]">Acceso no autorizado</h1><p className="mt-2 text-sm text-[var(--color-text-muted)]">Este trámite no está disponible para tu usuario.</p><Link to="/trazabilidad" className="mt-5 inline-flex rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white">Volver a trazabilidad</Link></Card>

  const transitions = canManage(tramite) ? (AVAILABLE_STATES[tramite.estado] ?? []) : []
  const tabs: Array<[DetailTab, string]> = [
    ['historial', `Historial (${tramite.eventos.length})`],
    ['documentos', `Documentos (${tramite.documentos.length})`],
    ['comentarios', 'Comentarios'],
    ['reuniones', 'Reuniones'],
  ]

  return <div className="w-full min-w-0 space-y-5 animate-fadeIn">
    <Link to="/trazabilidad" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline"><ArrowLeft size={14} aria-hidden="true" />Volver a trazabilidad</Link>
    <ResumenTramite tramite={tramite} />
    <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Ejemplo demostrativo: los cambios de estado son de prueba; comentarios y reuniones se guardan solo en este navegador.</p>
    {actor.rol === 'Estudiante' && <Card className="border-[#FF6500]/30 bg-[#FF6500]/10"><h2 className="text-sm font-bold text-[var(--color-text)]">¿Qué sigue?</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">{tramite.estado === 'DEVUELTO' ? 'Revisa las observaciones, responde en Comentarios y carga la versión corregida del documento.' : `Tu trámite está en ${tramite.etapaActual}. Consulta la próxima fecha límite y los comentarios del equipo.`}</p></Card>}

    {actor.rol === 'Coordinador' && <Card className="space-y-3">
      <h2 className="text-[15px] font-bold text-[var(--color-text)]">Acciones de coordinación · demostración</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="field-label">Asignar o reasignar tutor<select className="field-input mt-1" value={selectedTutor} onChange={(event) => setSelectedTutor(event.target.value)}><option value="">Selecciona un tutor</option>{PERSONAS_MOCK.tutores.map((person) => <option key={person.id} value={person.id}>{person.nombre}</option>)}</select></label>
        <Button type="button" variant="outline" disabled={!selectedTutor || busy} onClick={() => void runAction(() => asignarTutorDemo(tramite.id, actor, selectedTutor), 'Tutor asignado en el ejemplo.')}>Asignar tutor</Button>
        <label className="field-label">Asignar jurado<select className="field-input mt-1" value={selectedJury} onChange={(event) => setSelectedJury(event.target.value)}><option value="">Selecciona un jurado</option>{PERSONAS_MOCK.jurados.map((person) => <option key={person.id} value={person.id}>{person.nombre}</option>)}</select></label>
        <Button type="button" variant="outline" disabled={!selectedJury || busy} onClick={() => void runAction(() => asignarJuradoDemo(tramite.id, actor, selectedJury), 'Jurado asignado en el ejemplo.')}>Asignar jurado</Button>
        <label className="field-label">Fecha de sustentación<input className="field-input mt-1" type="datetime-local" value={sustentationDate} onChange={(event) => setSustentationDate(event.target.value)} /></label>
        <Button type="button" variant="outline" disabled={!sustentationDate || busy} onClick={() => void runAction(() => programarSustentacionDemo(tramite.id, actor, new Date(sustentationDate).toISOString()), 'Sustentación programada en el ejemplo.')}>Programar sustentación</Button>
      </div>
    </Card>}

    {transitions.length > 0 && <Card><h2 className="mb-3 text-[15px] font-bold text-[var(--color-text)]">{actor.rol === 'Tutor' ? 'Revisión del tutor' : 'Actualizar estado'}</h2><div className="flex flex-wrap gap-2">
      {transitions.map((state) => <Button key={state} type="button" disabled={busy} onClick={() => void runAction(() => cambiarEstadoDemo(tramite.id, actor, state), state === 'APROBADO' ? 'Propuesta aprobada; avanzó al siguiente paso.' : `Estado actualizado a ${state.replace(/_/g, ' ').toLowerCase()}.`)}><Send size={14} aria-hidden="true" />{state === 'APROBADO' ? 'Aprobar y avanzar' : state === 'DEVUELTO' ? 'Solicitar correcciones' : state === 'RECHAZADO' ? 'Rechazar' : `Avanzar a ${state.replace(/_/g, ' ').toLowerCase()}`}</Button>)}
    </div></Card>}

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>}
    <div role="tablist" aria-label="Secciones de trazabilidad" className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
      {tabs.map(([id, label]) => <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-h-10 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-[#FF6500] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]'}`}>{label}</button>)}
    </div>
    {tab === 'historial' && <HistorialDemo events={tramite.eventos} onDocument={(documentId) => {
      const version = tramite.documentos.find((doc) => doc.id === documentId)?.versiones.slice(-1)[0]
      if (version) setPreview(version)
    }} />}
    {tab === 'documentos' && <DocumentosDemo tramite={tramite} canUpload={actor.rol === 'Estudiante'} onUpload={(file) => void runAction(() => cargarDocumentoDemo(tramite.id, actor, file), 'Documento cargado en el ejemplo.')} onPreview={setPreview} />}
    {tab === 'comentarios' && <TabComentarios
      processId={tramite.id}
      actor={actor}
      canComment={canComment(tramite)}
      initialComments={tramite.comentarios}
      onAdd={async (text, replyTo) => {
        const updated = await agregarComentarioDemo(tramite.id, actor, text, replyTo)
        setTramite(updated)
        return updated.comentarios[updated.comentarios.length - 1]
      }}
    />}
    {tab === 'reuniones' && <TabReuniones
      processId={tramite.id}
      actor={actor}
      canManage={canManage(tramite)}
      initialMeetings={tramite.reuniones}
      onAdd={async (meeting) => {
        const updated = await agregarReunionDemo(tramite.id, actor, meeting)
        setTramite(updated)
        return updated.reuniones[updated.reuniones.length - 1]
      }}
    />}

    {preview && <div role="dialog" aria-modal="true" aria-label={`Vista previa de ${preview.nombreArchivo}`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreview(null)}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-[var(--color-surface)] p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2"><h2 className="truncate text-sm font-bold text-[var(--color-text)]">{preview.nombreArchivo}</h2><button type="button" aria-label="Cerrar vista previa" onClick={() => setPreview(null)} className="rounded-lg p-2 hover:bg-[var(--color-bg)]"><X size={18} aria-hidden="true" /></button></div>
        {preview.contenido.startsWith('data:') ? <iframe title={`Vista previa de ${preview.nombreArchivo}`} src={preview.contenido} className="h-[70vh] w-full rounded-lg border border-[var(--color-border)]" /> : <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--color-bg)] p-4 text-sm text-[var(--color-text)]">{preview.contenido}</pre>}
      </div>
    </div>}
  </div>
}
