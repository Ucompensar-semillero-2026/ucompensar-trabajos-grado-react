import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Download, Eye, FileSpreadsheet, FileText, Flag, History, Image as ImageIcon, Info, Layers, Save, Send, User, Users, File as FileGeneric } from 'lucide-react'
import { Button } from '@/components/ui'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { DocumentViewerModal } from '@/components/documentos/DocumentViewerModal'
import { DownloadFileButton } from '@/components/documentos/ArchivoAcciones'
import { VisorDocumento } from '@/components/documentos/VisorDocumento'
import { viewerKindFor } from '@/components/documentos/visorDocumento.utils'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { fetchPreviewInfo, filePaths, formatBytes } from '@/services/files.service'
import { processesApi, type ProcessOut, type TeamMemberOut } from '@/services/processes.service'
import { workPlanApi, type DeliverableOut, type SubmissionOut, type WorkPlanOut } from '@/services/workplan.service'
import { evaluationApi, type EvaluationCriterion, type EvaluationOut, type GradePayload, type GradingMode } from '@/services/evaluation.service'
import { DeliverableStatusBadge } from '@/components/proceso/workPlanUi'
import { formatRelativeDate, parseUtc } from '@/utils/format'
import { cn } from '@/utils/cn'
import { CARD, formatShort, todayIso } from './tutorUi.utils'

const DECISION_LABEL: Record<string, string> = { aprobado: 'Aprobada', requiere_correcciones: 'Requiere correcciones' }
const MAX_FEEDBACK = 500

interface Loaded {
  process: ProcessOut
  team: TeamMemberOut[]
  plan: WorkPlanOut
  deliverable: DeliverableOut
  stageName: string
  versions: SubmissionOut[]
  report: EvaluationOut | null
}

/** Busca el entregable que contiene la entrega: primero por su entrega vigente y, si es una versión anterior, por su historial. */
async function locate(token: string, processId: string, plan: WorkPlanOut, submissionId: string) {
  const all = plan.stages.flatMap((s) => s.deliverables.map((d) => ({ d, stageName: s.name })))
  const current = all.find((x) => x.d.current_submission?.public_id === submissionId)
  const candidates = current ? [current] : all.filter((x) => x.d.submissions_count > 0)
  for (const x of candidates) {
    const versions = await workPlanApi.listSubmissions(token, processId, x.d.public_id)
    if (versions.some((v) => v.public_id === submissionId)) return { ...x, versions }
  }
  return null
}

/** Nota «0 a 5» con una sola cifra decimal (como la guarda el backend). null = vacía; undefined = inválida. */
function parseGrade(text: string): number | null | undefined {
  const clean = text.trim().replace(',', '.')
  if (clean === '') return null
  const n = Number(clean)
  if (!Number.isFinite(n) || n < 0 || n > 5 || Math.abs(Math.round(n * 10) - n * 10) > 1e-9) return undefined
  return n
}

interface TargetValues {
  grade: number | null
  feedback: string | null
  status: 'sin_calificar' | 'borrador' | 'publicada'
}

/** Lo que ya está guardado para el destino elegido: la nota grupal (todos) o la de un estudiante. */
function targetValues(c: EvaluationCriterion | null, mode: GradingMode, studentId: string): TargetValues {
  if (!c) return { grade: null, feedback: null, status: 'sin_calificar' }
  if (mode === 'individual') {
    const g = c.student_grades.find((x) => x.student_public_id === studentId)
    return { grade: g?.grade ?? null, feedback: g?.feedback ?? null, status: g?.status ?? 'sin_calificar' }
  }
  if (c.group_grade) return { grade: c.group_grade.grade, feedback: c.group_grade.feedback, status: c.group_grade.status }
  if (c.grading_mode === 'grupal') return { grade: c.grade, feedback: c.feedback, status: c.status === 'publicada' ? 'publicada' : c.status === 'borrador' ? 'borrador' : 'sin_calificar' }
  return { grade: null, feedback: null, status: 'sin_calificar' }
}

// El campo es numérico: el navegador solo acepta el punto como separador decimal en su valor.
const toText = (n: number | null): string => (n === null ? '' : String(n))
const STATE_LABEL: Record<TargetValues['status'], string> = { sin_calificar: 'Sin calificar', borrador: 'Borrador', publicada: 'Publicada' }

const comma = (n: number): string => n.toFixed(2).replace('.', ',')
const initials = (name: string): string => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
const AVATAR = ['bg-sky-200 text-sky-800', 'bg-amber-200 text-amber-800', 'bg-emerald-200 text-emerald-800', 'bg-violet-200 text-violet-800']

function FileIcon({ name }: { name: string }) {
  switch (viewerKindFor(name)) {
    case 'xlsx': return <FileSpreadsheet size={30} className="text-emerald-600" aria-hidden="true" />
    case 'pdf': return <FileText size={30} className="text-red-500" aria-hidden="true" />
    case 'docx': return <FileText size={30} className="text-blue-600" aria-hidden="true" />
    case 'image': return <ImageIcon size={30} className="text-purple-500" aria-hidden="true" />
    default: return <FileGeneric size={30} className="text-zinc-500" aria-hidden="true" />
  }
}

type Confirm = 'publicar' | 'correcciones' | null

/**
 * Revisión de una entrega en una ventana modal sobre la pantalla actual (sin ruta ni pestaña propias): el archivo real, el grupo y el
 * proyecto, la nota del entregable y las decisiones del tutor. La nota se guarda en el criterio de evaluación ligado a ese entregable
 * (la misma nota que ve la pestaña «Evaluación» y el libro de calificaciones). Publicar la nota es lo que da por calificada (aprobada) la entrega:
 * el backend lo hace en la misma operación. La otra decisión posible es pedir correcciones, que no publica ninguna nota.
 */
export function SubmissionReviewModal({ processId, submissionId, onClose, onChanged }: { processId: string; submissionId: string; onClose: () => void; onChanged: () => void | Promise<void> }) {
  const accessToken = useAppStore((s) => s.accessToken)
  const [data, setData] = useState<Loaded | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [viewId, setViewId] = useState(submissionId)
  const [fileInfo, setFileInfo] = useState<{ mime: string; size: number | null } | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [gradeText, setGradeText] = useState('')
  const [feedback, setFeedback] = useState('')
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [busy, setBusy] = useState<'borrador' | Exclude<Confirm, null> | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const inFlight = useRef(false)
  const formReady = useRef(false)
  const [mode, setMode] = useState<GradingMode>('grupal')
  const [studentId, setStudentId] = useState('')
  const [confirmChange, setConfirmChange] = useState(false) // el docente ya confirmó cambiar de modalidad (se envía al guardar)
  const [askMode, setAskMode] = useState<GradingMode | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      const [process, team, plan] = await Promise.all([processesApi.get(accessToken, processId), processesApi.team(accessToken, processId), workPlanApi.get(accessToken, processId)])
      const found = await locate(accessToken, processId, plan, submissionId)
      if (!found) {
        setError('No encontramos esta entrega en el proyecto. Puede que se haya reemplazado o que no tengas acceso.')
        setStatus('error')
        return
      }
      const report = await evaluationApi.get(accessToken, processId).catch(() => null) // la revisión no depende de que la evaluación esté disponible
      if (!formReady.current) {
        // El formulario parte de lo que ya está guardado en el criterio de este entregable y, después, solo cambia cuando el tutor escribe o guarda.
        const saved = report?.moments.flatMap((m) => m.criteria).find((c) => c.deliverable_public_id === found.d.public_id)
        const savedMode: GradingMode = saved?.grading_mode ?? 'grupal'
        const people = report?.students ?? []
        const pending = people.find((p) => saved?.student_grades.find((g) => g.student_public_id === p.public_id)?.status !== 'publicada') ?? people[0]
        const sid = pending?.public_id ?? ''
        const values = targetValues(saved ?? null, savedMode, sid)
        setMode(savedMode)
        setStudentId(sid)
        setGradeText(toText(values.grade))
        setFeedback(values.feedback ?? '')
        formReady.current = true
      }
      setData({ process, team, plan, deliverable: found.d, stageName: found.stageName, versions: [...found.versions].sort((a, b) => b.version - a.version), report })
      setError(null)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? 'No encontramos esta entrega o no tienes acceso a ella.' : err instanceof ApiError ? err.message : 'No se pudo cargar la entrega')
      setStatus('error')
    }
  }, [accessToken, processId, submissionId])

  useEffect(() => {
    setStatus('loading')
    void load()
  }, [load])

  const sub = data?.versions.find((v) => v.public_id === viewId) ?? data?.versions[0] ?? null
  const criterion: EvaluationCriterion | null = data?.report?.moments.flatMap((m) => m.criteria).find((c) => c.deliverable_public_id === data.deliverable.public_id) ?? null
  const momentOf = data?.report?.moments.find((m) => m.criteria.some((c) => c.public_id === criterion?.public_id)) ?? null

  // Tamaño y formato reales del archivo que se está viendo.
  useEffect(() => {
    if (!accessToken || !sub) return
    let live = true
    setFileInfo(null)
    fetchPreviewInfo(accessToken, { path: filePaths.submission(processId, sub.public_id), fileName: sub.file_name })
      .then((info) => { if (live) setFileInfo({ mime: info.mime, size: info.size }) })
      .catch(() => { if (live) setFileInfo(null) })
    return () => { live = false }
  }, [accessToken, processId, sub?.public_id, sub?.file_name]) // eslint-disable-line react-hooks/exhaustive-deps -- solo cambia con la versión vista

  const close = () => { if (!busy) onClose() }

  if (status !== 'ready' || !data || !sub) {
    return (
      <ModalDialog title="Revisión de entrega" variant="review" icon={<FileText size={22} />} onClose={onClose}>
        {status === 'error' ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-[14px] font-semibold text-[var(--color-text)]">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => { setStatus('loading'); void load() }}>Reintentar</Button>
          </div>
        ) : (
          <div role="status" aria-label="Cargando entrega" aria-busy="true" className="flex flex-col gap-4">
            <span className="sr-only">Cargando entrega…</span>
            <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/10" />
            <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/10" />
          </div>
        )}
      </ModalDialog>
    )
  }

  const { process, team, plan, deliverable: d, stageName, versions, report } = data
  const isLatest = versions[0].public_id === sub.public_id
  const canReview = plan.can_manage && isLatest && sub.status === 'en_revision'
  const ownerRole = team.find((m) => m.user.public_id === process.student.public_id)?.process_role
  const students = (ownerRole ? team.filter((m) => m.active && m.process_role === ownerRole).map((m) => m.user.full_name) : []).filter(Boolean)
  const group = students.length ? students : [process.student.full_name]
  const submittedLocal = parseUtc(sub.submitted_at)
  const deliveredIso = todayIso(submittedLocal)
  const onTime = d.due_date ? deliveredIso <= d.due_date : null
  const grade = parseGrade(gradeText)
  const weight = momentOf && criterion ? (momentOf.weight_percentage * criterion.weight_percentage) / 100 : null // % del proyecto: peso del momento × peso del criterio
  const equivalent = weight !== null && typeof grade === 'number' ? (weight * grade) / 5 : null
  const evaluationPublished = report?.status === 'publicada'
  const gradable = Boolean(report?.can_grade && evaluationPublished && criterion && isLatest)
  const unavailable = !report
    ? 'No se pudo consultar la evaluación del proyecto en este momento.'
    : !criterion
      ? 'Este entregable no está asociado a ningún criterio de evaluación. Asócialo en la pestaña Evaluación para poder calificarlo.'
      : !evaluationPublished
        ? 'La evaluación todavía no está publicada: publica su configuración en la pestaña Evaluación para poder calificar.'
        : !report.can_grade
          ? 'Solo el tutor o un evaluador asignado puede calificar este proyecto.'
          : !isLatest
            ? 'Estás viendo una versión anterior: la nota se registra sobre la versión actual.'
            : null
  const gradeError = grade === undefined ? 'La nota debe estar entre 0 y 5, con un solo decimal.' : null
  const people = report?.students ?? []
  const storedMode: GradingMode = criterion?.grading_mode ?? 'grupal'
  const stored = targetValues(criterion, storedMode, studentId)
  const hasStored = criterion
    ? storedMode === 'individual'
      ? criterion.student_grades.some((g) => g.grade !== null || Boolean(g.feedback))
      : stored.grade !== null || Boolean(stored.feedback)
    : false
  const publishedStored = criterion ? (storedMode === 'individual' ? criterion.student_grades.some((g) => g.status === 'publicada') : stored.status === 'publicada') : false
  const showSelector = people.length > 1 || storedMode === 'individual'
  const personName = people.find((p) => p.public_id === studentId)?.full_name ?? ''
  const individualMissing = mode === 'individual' && !studentId

  const fill = (m: GradingMode, sid: string, c: EvaluationCriterion | null = criterion) => {
    const v = targetValues(c, m, sid)
    setGradeText(toText(v.grade))
    setFeedback(v.feedback ?? '')
    setMessage(null)
  }
  const applyMode = (next: GradingMode) => {
    const sid = studentId || people[0]?.public_id || ''
    setMode(next)
    setStudentId(sid)
    setConfirmChange(next !== storedMode && hasStored) // se confirmó: el servidor lo exige al guardar
    setAskMode(null)
    fill(next, sid)
  }
  const chooseMode = (next: GradingMode) => {
    if (next === mode || busy !== null) return
    if (publishedStored && next !== storedMode) return // con notas publicadas no se cambia de modalidad
    if (next !== storedMode && hasStored && !confirmChange) {
      setAskMode(next)
      return
    }
    applyMode(next)
  }
  const chooseStudent = (sid: string) => {
    if (busy !== null) return
    setStudentId(sid)
    fill('individual', sid)
  }
  const needsFeedback = confirm === 'correcciones'
  const feedbackOk = !needsFeedback || feedback.trim().length > 0

  const run = async (kind: 'borrador' | Exclude<Confirm, null>, action: () => Promise<{ close?: boolean; message?: string } | void>, success: string, closes: boolean) => {
    if (!accessToken || inFlight.current) return // un doble clic no duplica la acción
    inFlight.current = true
    setBusy(kind)
    setMessage(null)
    try {
      const result = await action()
      setConfirm(null)
      await onChanged()
      if (result?.close ?? closes) {
        onClose()
        return
      }
      setMessage({ kind: 'ok', text: result?.message ?? success })
      await load()
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'No se pudo completar la acción. Intenta de nuevo.' })
    } finally {
      inFlight.current = false
      setBusy(null)
    }
  }

  const saveGrade = (publish: boolean) => async () => {
    if (!criterion) return
    const payload: GradePayload = {
      grade: grade ?? null,
      feedback: feedback.trim() || null,
      publish,
      mode,
      student_public_id: mode === 'individual' ? studentId : null,
      confirm_mode_change: confirmChange,
    }
    const updated = await evaluationApi.saveGrade(accessToken as string, processId, criterion.public_id, payload)
    setData((cur) => (cur ? { ...cur, report: updated } : cur))
    setConfirmChange(false)
    if (mode !== 'individual' || !publish) return
    // Individual: se sigue con el siguiente integrante sin nota publicada; la ventana se cierra cuando todos la tienen.
    const next = updated.moments.flatMap((m) => m.criteria).find((c) => c.public_id === criterion.public_id)
    const waiting = people.filter((p) => next?.student_grades.find((g) => g.student_public_id === p.public_id)?.status !== 'publicada')
    if (waiting.length === 0) return { close: true }
    setStudentId(waiting[0].public_id)
    fill('individual', waiting[0].public_id, next ?? null)
    return { close: false, message: `Calificación publicada para ${personName}. Faltan: ${waiting.map((p) => p.full_name).join(', ')}.` }
  }
  const requestCorrections = async () => {
    await workPlanApi.review(accessToken as string, processId, sub.public_id, 'requiere_correcciones', feedback.trim())
  }

  const confirmText: Record<Exclude<Confirm, null>, string> = {
    publicar: `¿Publicar la calificación? El estudiante podrá consultar la nota y la retroalimentación.${mode === 'individual' ? ` Solo se publica la de ${personName}.` : people.length > 1 ? ' Se aplicará a todos los integrantes del grupo.' : ''}`,
    correcciones: `¿Devolver la versión ${sub.version} de «${d.title}» al estudiante para que la corrija? La versión queda en el historial.`,
  }
  const confirmAction = (): void => {
    if (confirm === 'publicar') void run('publicar', saveGrade(true), 'Calificación publicada.', true)
    else if (confirm === 'correcciones') void run('correcciones', requestCorrections, 'Correcciones solicitadas.', true)
  }
  const canPublish = gradable && typeof grade === 'number' && !individualMissing
  const kindLabel = sub.file_name.includes('.') ? sub.file_name.split('.').pop()?.toUpperCase() : 'Archivo'
  const fileRef = { path: filePaths.submission(processId, sub.public_id), fileName: sub.file_name }

  return (
    <>
      <ModalDialog title="Revisión de entrega" variant="review" icon={<FileText size={22} />} onClose={close}>
        <div className="flex flex-col gap-4">
          {/* Entrega */}
          <section aria-label="Entrega en revisión" className={cn(CARD, 'flex flex-wrap items-center justify-between gap-4 p-4')}>
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6500] dark:bg-orange-500/15"><FileText size={26} aria-hidden="true" /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="break-words font-display text-[21px] font-extrabold text-[var(--color-secondary)]">{d.title}</h3>
                  <DeliverableStatusBadge status={sub.status} />
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[12.5px] font-bold text-[var(--color-secondary)] dark:bg-white/10">Versión {sub.version}{isLatest ? '' : ' (anterior)'}</span>
                </div>
                <p className="text-[13px] text-[var(--color-text-muted)]">Entregable de la etapa: {stageName}</p>
              </div>
            </div>
            <dl className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2.5">
                <CalendarDays size={22} aria-hidden="true" className="text-slate-500" />
                <div><dt className="text-[11.5px] text-[var(--color-text-muted)]">Fecha de entrega</dt><dd className="text-[14px] font-bold text-[var(--color-secondary)]">{formatShort(deliveredIso)} <span className="font-normal text-[var(--color-text-muted)]">· {formatRelativeDate(sub.submitted_at)}</span></dd></div>
              </div>
              <div className="flex items-center gap-2.5">
                <CalendarDays size={22} aria-hidden="true" className="text-slate-500" />
                <div><dt className="text-[11.5px] text-[var(--color-text-muted)]">Fecha límite</dt><dd className="text-[14px] font-bold text-[var(--color-secondary)]">{d.due_date ? formatShort(d.due_date) : 'Sin fecha definida'}</dd></div>
              </div>
              {onTime !== null && (
                onTime
                  ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-[13px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><CheckCircle2 size={15} aria-hidden="true" />Entrega puntual</span>
                  : <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3.5 py-1.5 text-[13px] font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300"><AlertTriangle size={15} aria-hidden="true" />Entrega tardía</span>
              )}
            </dl>
          </section>

          {/* Grupo y proyecto */}
          <section aria-label="Grupo y proyecto" className={cn(CARD, 'flex flex-wrap items-center gap-x-6 gap-y-3 p-4')}>
            <div className="flex min-w-0 items-center gap-3">
              <Users size={22} aria-hidden="true" className="shrink-0 text-sky-600" />
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-[var(--color-secondary)]">{group.length === 1 ? 'Estudiante' : `Grupo de estudiantes (${group.length})`}</p>
                <ul aria-label="Estudiantes del grupo" className="mt-1 flex flex-wrap gap-2">
                  {group.map((n, i) => (
                    <li key={n} className="inline-flex items-center gap-2 rounded-full bg-slate-100 py-1 pl-1 pr-3 text-[13px] font-bold text-[var(--color-secondary)] dark:bg-white/10">
                      <span aria-hidden="true" className={cn('flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold', AVATAR[i % AVATAR.length])}>{initials(n)}</span>{n}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex min-w-[220px] flex-1 items-center gap-2.5 lg:border-l lg:border-[#DCE6F2] lg:pl-5 dark:lg:border-[var(--color-border)]">
              <Layers size={20} aria-hidden="true" className="shrink-0 text-slate-500" />
              <div className="min-w-0"><p className="text-[11.5px] text-[var(--color-text-muted)]">Proyecto</p><p className="break-words text-[13.5px] font-bold text-[var(--color-secondary)]">{process.title?.trim() || process.process_code}</p></div>
            </div>
            <div className="flex items-center gap-2.5 lg:border-l lg:border-[#DCE6F2] lg:pl-5 dark:lg:border-[var(--color-border)]">
              <Layers size={20} aria-hidden="true" className="shrink-0 text-slate-500" />
              <div><p className="text-[11.5px] text-[var(--color-text-muted)]">Modalidad</p><p className="text-[13.5px] font-bold text-[var(--color-secondary)]">{process.modality.name}</p></div>
            </div>
            <div className="flex items-center gap-2.5 lg:border-l lg:border-[#DCE6F2] lg:pl-5 dark:lg:border-[var(--color-border)]">
              <Flag size={20} aria-hidden="true" className="shrink-0 text-slate-500" />
              <div><p className="text-[11.5px] text-[var(--color-text-muted)]">Etapa</p><p className="text-[13.5px] font-bold text-[var(--color-secondary)]">{stageName}</p></div>
            </div>
          </section>

          {!isLatest && (
            <p role="status" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
              <Info size={16} aria-hidden="true" />Estás viendo una versión anterior: la versión actual es la {versions[0].version}.
              <button type="button" onClick={() => setViewId(versions[0].public_id)} className="font-bold underline underline-offset-4">Ir a la versión actual</button>
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
            {/* Entrega del estudiante */}
            <section aria-label="Entrega del estudiante" className={cn(CARD, 'flex min-w-0 flex-col gap-3 p-4')}>
              <h3 className="font-display text-[19px] font-extrabold text-[var(--color-secondary)]">Entrega del estudiante</h3>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileIcon name={sub.file_name} />
                  <div className="min-w-0">
                    <p className="break-all text-[14px] font-bold text-[var(--color-secondary)]">{sub.file_name}</p>
                    <p className="text-[12.5px] text-[var(--color-text-muted)]">{kindLabel}{fileInfo?.size ? ` · ${formatBytes(fileInfo.size)}` : ''}</p>
                  </div>
                </div>
                {!sub.file_missing && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setViewerOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE6F2] bg-[var(--color-surface)] px-3.5 py-2 text-[13px] font-bold text-[var(--color-secondary)] transition hover:border-[#0876B9] dark:border-[var(--color-border)]"><Eye size={15} aria-hidden="true" />Ver archivo</button>
                    <DownloadFileButton file={fileRef} ariaLabel={`Descargar original: ${sub.file_name}`} className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE6F2] bg-[var(--color-surface)] px-3.5 py-2 text-[13px] font-bold text-[var(--color-secondary)] transition hover:border-[#0876B9] dark:border-[var(--color-border)]">
                      <Download size={15} aria-hidden="true" />Descargar original
                    </DownloadFileButton>
                  </div>
                )}
              </div>
              {sub.student_comment && <p className="rounded-xl bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-text)]"><strong>Comentario del estudiante:</strong> {sub.student_comment}</p>}
              {sub.file_missing ? (
                <p role="alert" className="rounded-xl border border-dashed border-amber-300 px-4 py-8 text-center text-[13px] font-medium text-amber-800 dark:text-amber-300">El archivo de esta versión no está disponible en el almacenamiento. Pide al estudiante que lo vuelva a subir.</p>
              ) : (
                <div className="h-[clamp(420px,68vh,780px)] overflow-hidden rounded-xl border border-[#DCE6F2] dark:border-[var(--color-border)]"><VisorDocumento key={sub.public_id} file={fileRef} /></div>
              )}

              {versions.length > 1 && (
                <div aria-label="Versiones de la entrega" role="group" className="border-t border-[#DCE6F2] pt-3 dark:border-[var(--color-border)]">
                  <p className="mb-1.5 flex items-center gap-2 text-[13px] font-bold text-[var(--color-secondary)]"><History size={15} aria-hidden="true" className="text-sky-600" />Versiones ({versions.length})</p>
                  <ol className="flex flex-col gap-1.5">
                    {versions.map((v) => (
                      <li key={v.public_id} className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12.5px]', v.public_id === sub.public_id && 'bg-orange-50/70 dark:bg-orange-500/10')}>
                        <span className="min-w-0 break-words"><strong>Versión {v.version}</strong>{v.public_id === versions[0].public_id ? ' (actual)' : ''} · {formatShort(todayIso(parseUtc(v.submitted_at)))} · {v.file_name}
                          {v.reviews.map((r) => <span key={r.public_id} className="block text-[var(--color-text-muted)]">{DECISION_LABEL[r.decision] ?? r.decision} por {r.reviewer.full_name}{r.comment ? `: ${r.comment}` : ''}</span>)}
                        </span>
                        <span className="flex items-center gap-2">
                          <DeliverableStatusBadge status={v.status} />
                          {v.public_id !== sub.public_id && <button type="button" onClick={() => setViewId(v.public_id)} className="font-semibold text-[#0876B9] underline underline-offset-4">Ver esta versión</button>}
                          {!v.file_missing && <DownloadFileButton file={{ path: filePaths.submission(processId, v.public_id), fileName: v.file_name }} ariaLabel={`Descargar versión ${v.version}`} className="rounded-lg p-1 text-[var(--color-text-muted)] hover:text-[#0876B9]"><Download size={14} aria-hidden="true" /></DownloadFileButton>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>

            {/* Calificación */}
            <div className="flex min-w-0 flex-col gap-4 lg:self-start">
            {showSelector && (
              <section aria-label="Tipo de calificación" className={cn(CARD, 'flex flex-col gap-3 p-4')}>
                <h3 className="flex items-center gap-2 font-display text-[19px] font-extrabold text-[var(--color-secondary)]"><Users size={19} aria-hidden="true" className="text-[#FF6500]" />Tipo de calificación</h3>
                <div role="radiogroup" aria-label="Tipo de calificación" className="grid gap-3 sm:grid-cols-2">
                  {([
                    ['individual', 'Individual', 'Califica a cada estudiante por separado', User],
                    ['grupal', 'Grupal', 'Asigna una misma calificación a todos los integrantes del grupo', Users],
                  ] as const).map(([value, title, text, Icon]) => {
                    const active = mode === value
                    const blocked = publishedStored && value !== storedMode
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={title}
                        disabled={busy !== null || blocked}
                        title={blocked ? 'Ya hay notas publicadas: no se puede cambiar de modalidad' : undefined}
                        onClick={() => chooseMode(value)}
                        className={cn('flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50', active ? 'border-[#FF6500] bg-orange-50/70 shadow-sm dark:bg-orange-500/10' : 'border-[#DCE6F2] hover:border-[#FF6500]/50 dark:border-[var(--color-border)]')}
                      >
                        <span aria-hidden="true" className={cn('mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2', active ? 'border-[#FF6500]' : 'border-slate-400')}>{active && <span className="h-2 w-2 rounded-full bg-[#FF6500]" />}</span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-[14px] font-extrabold text-[var(--color-secondary)]"><Icon size={16} aria-hidden="true" />{title}</span>
                          <span className="block text-[12px] text-[var(--color-text-muted)]">{text}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                {askMode && (
                  <div role="alertdialog" aria-label="Confirmar cambio de modalidad" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                    <span className="min-w-0 flex-1">¿Cambiar a calificación {askMode === 'grupal' ? 'grupal' : 'individual'}? Las notas {storedMode === 'grupal' ? 'grupales' : 'individuales'} guardadas se conservan, pero dejan de contar mientras uses la otra modalidad.</span>
                    <Button type="button" size="sm" onClick={() => applyMode(askMode)}>Sí, cambiar</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAskMode(null)}>Cancelar</Button>
                  </div>
                )}
              </section>
            )}
            <section aria-label="Calificación del entregable" className={cn(CARD, 'flex min-w-0 flex-col gap-3 p-4')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-display text-[19px] font-extrabold text-[var(--color-secondary)]"><BarChart3 size={19} aria-hidden="true" className="text-[#FF6500]" />Calificación del entregable</h3>
                {weight !== null && <span className="rounded-full bg-slate-100 px-3 py-1 text-[12.5px] font-bold text-[var(--color-secondary)] dark:bg-white/10">Aporte al proyecto: <span className="text-[#FF6500]">{comma(weight)} %</span></span>}
              </div>

              {unavailable && (
                <div role="status" className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                  <p>{unavailable}</p>
                  <Link to={`/tutor/proyectos/${processId}?tab=evaluacion`} className="w-fit font-bold underline underline-offset-4">Ir a la evaluación del proyecto</Link>
                </div>
              )}
              {criterion && (
                <p className="text-[12.5px] text-[var(--color-text-muted)]">
                  Criterio: <strong className="text-[var(--color-text)]">{criterion.name}</strong>{momentOf ? ` · ${momentOf.name}` : ''} ·{' '}
                  {criterion.status === 'publicada' ? 'Nota publicada' : criterion.status === 'borrador' ? 'Borrador guardado' : 'Sin calificar'}
                </p>
              )}

              {showSelector && mode === 'individual' && (
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1 text-[14px] font-bold text-[var(--color-secondary)]">
                    Selecciona el estudiante para calificar
                    <select aria-label="Estudiante a calificar" value={studentId} disabled={busy !== null} onChange={(e) => chooseStudent(e.target.value)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[14px] font-semibold text-[var(--color-text)]">
                      {people.map((p) => <option key={p.public_id} value={p.public_id}>{p.full_name}</option>)}
                    </select>
                  </label>
                  <ul aria-label="Estado de calificación por estudiante" className="flex flex-wrap gap-2">
                    {people.map((p) => {
                      const v = targetValues(criterion, 'individual', p.public_id)
                      const active = p.public_id === studentId
                      return (
                        <li key={p.public_id}>
                          <button type="button" aria-pressed={active} disabled={busy !== null} onClick={() => chooseStudent(p.public_id)} className={cn('flex items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition', active ? 'border-[#FF6500] bg-orange-50/70 dark:bg-orange-500/10' : 'border-[#DCE6F2] hover:border-[#FF6500]/50 dark:border-[var(--color-border)]')}>
                            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-[11px] font-extrabold text-sky-800">{initials(p.full_name)}</span>
                            <span className="leading-tight"><span className="block text-[12.5px] font-bold text-[var(--color-secondary)]">{p.full_name}</span><span className="block text-[11.5px] text-[var(--color-text-muted)]">{STATE_LABEL[v.status]}{v.grade !== null ? ` · ${String(v.grade).replace('.', ',')}` : ''}</span></span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              {showSelector && mode === 'grupal' && (
                <p className="rounded-xl bg-[var(--color-bg)] px-3 py-2 text-[12.5px] text-[var(--color-text)]">
                  Una sola nota y una sola retroalimentación para todos los integrantes: <strong>{people.map((p) => p.full_name).join(', ')}</strong>.
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:items-end">
                <label className="flex flex-col gap-1 text-[14px] font-bold text-[var(--color-secondary)]">
                  Nota (0 a 5)
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={5}
                    step={0.1}
                    value={gradeText}
                    disabled={!gradable || busy !== null}
                    onChange={(e) => setGradeText(e.target.value)}
                    aria-invalid={gradeError ? true : undefined}
                    aria-describedby={gradeError ? 'nota-error' : undefined}
                    placeholder="—"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[20px] font-bold text-[var(--color-text)] outline-none focus:border-[#0876B9] disabled:opacity-60"
                  />
                </label>
                <div className="flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2.5 text-[13px] text-sky-900 dark:bg-sky-500/10 dark:text-sky-200">
                  <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <p>{equivalent !== null ? `Equivale a un aporte de ${comma(equivalent)} % sobre la nota final del proyecto.` : weight !== null ? `Con la nota máxima aporta ${comma(weight)} % a la nota final del proyecto.` : 'El aporte se calcula con el peso del entregable en la evaluación configurada.'}</p>
                </div>
              </div>
              {gradeError && <p id="nota-error" role="alert" className="text-[12.5px] font-semibold text-red-700">{gradeError}</p>}

              <label className="flex flex-col gap-1 text-[14px] font-bold text-[var(--color-secondary)]">
                Retroalimentación para el estudiante
                <textarea
                  value={feedback}
                  maxLength={MAX_FEEDBACK}
                  rows={5}
                  disabled={busy !== null || (!gradable && !canReview)}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Opcional al guardar borrador; obligatoria para solicitar correcciones."
                  className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] font-normal text-[var(--color-text)] outline-none focus:border-[#0876B9] disabled:opacity-60"
                />
                <span className="self-end text-[12px] font-normal text-[var(--color-text-muted)]">{feedback.length} / {MAX_FEEDBACK}</span>
              </label>
            </section>
            </div>
          </div>

          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className={cn('rounded-xl border px-4 py-2.5 text-[13px] font-medium', message.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300')}>{message.text}</p>
          )}

          {/* Acciones */}
          <div className="sticky bottom-0 -mx-1 flex flex-col gap-3 border-t border-[#DCE6F2] bg-[var(--color-surface)] px-1 pb-1 pt-3 dark:border-[var(--color-border)]">
            {confirm && (
              <div role="alertdialog" aria-label="Confirmar acción" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                <span className="min-w-0 flex-1">{confirmText[confirm]}{!feedbackOk && <strong className="mt-1 block text-red-700">Escribe en la retroalimentación qué debe corregir el estudiante.</strong>}</span>
                <Button type="button" size="sm" disabled={busy !== null || !feedbackOk} onClick={confirmAction}>{busy ? 'Procesando…' : 'Sí, confirmar'}</Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => setConfirm(null)}>Cancelar</Button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button type="button" variant="outline" disabled={!gradable || busy !== null || grade === undefined || individualMissing} onClick={() => void run('borrador', saveGrade(false), 'Borrador guardado. El estudiante aún no lo ve.', false)}>
                <Save size={15} aria-hidden="true" /> {busy === 'borrador' ? 'Guardando…' : 'Guardar borrador'}
              </Button>
              <Button type="button" disabled={!canPublish || busy !== null || Boolean(confirm)} title={!canPublish ? 'Escribe una nota válida para publicar' : undefined} onClick={() => setConfirm('publicar')}>
                <Send size={15} aria-hidden="true" /> {busy === 'publicar' ? 'Publicando…' : 'Publicar calificación'}
              </Button>
              <Button type="button" variant="outline" disabled={!canReview || busy !== null || Boolean(confirm)} title={!canReview ? 'Solo se pueden pedir correcciones sobre la versión actual en revisión' : undefined} onClick={() => setConfirm('correcciones')}>
                <AlertTriangle size={15} aria-hidden="true" /> Solicitar correcciones
              </Button>
            </div>
            {sub.reviews.length > 0 && !canReview && (
              <p className="text-center text-[12.5px] text-[var(--color-text-muted)]">
                Última decisión sobre esta versión: <strong>{DECISION_LABEL[sub.reviews[sub.reviews.length - 1].decision] ?? sub.reviews[sub.reviews.length - 1].decision}</strong> por {sub.reviews[sub.reviews.length - 1].reviewer.full_name}
                {sub.reviews[sub.reviews.length - 1].comment ? ` — ${sub.reviews[sub.reviews.length - 1].comment}` : ''}
              </p>
            )}
            {!plan.can_manage && <p className="text-center text-[12.5px] text-[var(--color-text-muted)]">Vista de consulta: solo el tutor asignado a este proyecto puede revisar entregas.</p>}
          </div>
        </div>
      </ModalDialog>
      {viewerOpen && <DocumentViewerModal isOpen onClose={() => setViewerOpen(false)} document={{ file_name: sub.file_name, file_path: fileRef.path, studentName: sub.submitted_by.full_name, documentType: d.title, version: sub.version }} />}
    </>
  )
}
