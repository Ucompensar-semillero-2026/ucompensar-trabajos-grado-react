import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, FileCheck2, Send } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import { DocumentViewerModal, type ViewerDocument } from '@/components/documentos/DocumentViewerModal'
import { TeamPanel } from '@/components/tutor/TeamPanel'
import { ApiError } from '@/services/http'
import { documentsApi, type ChecklistItemOut, type ProcessDocumentOut } from '@/services/documents.service'
import { processesApi, type ProcessDetailOut, type ProcessHistoryOut, type TeamMemberOut } from '@/services/processes.service'
import type { PossibleStateOut } from '@/types/api'
import { hasModule } from '@/config/access'
import { cargarDetalleTrazabilidad, cargarEntregasPlanTrazabilidad, MOCK_TRAMITES, processToTramite, stepForStateCode, type EtapaPlanTrazabilidad, type RolTramite } from '@/services/trazabilidad.service'
import type { SubmissionOut } from '@/services/workplan.service'
import { useAppStore } from '@/stores/app.store'
import { ResumenTramite } from './ResumenTramite'
import { TabDocumentos } from './TabDocumentos'
import { TabComentarios } from './TabComentarios'
import { TabReuniones } from './TabReuniones'
import { Timeline } from './Timeline'
import { TrazabilidadIndex } from './TrazabilidadIndex'
import { DetalleDemoTrazabilidad } from './DetalleDemoTrazabilidad'
import { actorFor, processPermissions, rolInProcess } from './usePermisos'

type TraceTab = 'audit' | 'docs' | 'comments' | 'meetings'

// El texto del botón depende de QUÉ es la persona en este trámite (my_process_roles),
// no de su rol institucional. El permiso ya lo decidió el backend (available-transitions).
function stateActionLabel(targetCode: string, rol: RolTramite, targetName: string) {
  const code = targetCode.toUpperCase()
  if (rol === 'Estudiante') {
    if (code === 'EN_REVISION_COMITE_FACULTAD') return 'Radicar propuesta a Coordinación'
    if (code === 'ANTEPROYECTO_EN_REVISION') return 'Enviar anteproyecto al tutor'
    if (code === 'ENTREGA_TRABAJO_ESCRITO') return 'Entregar trabajo final'
    return `Enviar a ${targetName}`
  }
  if (/RECHAZ|REPROB/.test(code)) return 'Rechazar trámite'
  if (/DOCUMENTOS_PENDIENTES|DEVUEL|CORRECC/.test(code)) return 'Solicitar correcciones'
  if (rol === 'Tutor' && code === 'AVANCES_EN_REVISION') return 'Aprobar anteproyecto y continuar'
  if (/APROBADO_COMITE_GENERAL/.test(code)) return 'Aprobar propuesta'
  if (code === 'JURADOS_ASIGNADOS') return 'Confirmar jurados y avanzar'
  if (code === 'EN_SUSTENTACION') return 'Iniciar sustentación'
  if (code === 'CALIFICACION_REGISTRADA') return 'Registrar calificación'
  if (code === 'CERRADO') return 'Cerrar trámite'
  return `Aprobar y avanzar a ${targetName}`
}

export function TrazabilidadSection() {
  const { processId } = useParams<{ processId: string }>()
  const location = useLocation()
  const accessToken = useAppStore((state) => state.accessToken)
  const currentUser = useAppStore((state) => state.currentUser)

  const [process, setProcess] = useState<ProcessDetailOut | null>(null)
  const [team, setTeam] = useState<TeamMemberOut[]>([])
  const [history, setHistory] = useState<ProcessHistoryOut[]>([])
  const [checklist, setChecklist] = useState<ChecklistItemOut[]>([])
  const [documents, setDocuments] = useState<ProcessDocumentOut[]>([])
  const [workPlanDocuments, setWorkPlanDocuments] = useState<EtapaPlanTrazabilidad[]>([])
  const [workPlanDocumentsError, setWorkPlanDocumentsError] = useState<string | null>(null)
  // Estados a los que esta persona puede mover el trámite: los calcula el backend (contrato 6.1).
  const [availableTransitions, setAvailableTransitions] = useState<PossibleStateOut[]>([])
  const [tab, setTab] = useState<TraceTab>('audit')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [isChangingState, setIsChangingState] = useState(false)
  const [uploadingType, setUploadingType] = useState<string | null>(null)
  const [reviewingDocumentId, setReviewingDocumentId] = useState<string | null>(null)
  const [activeViewerDoc, setActiveViewerDoc] = useState<ViewerDocument | null>(null)
  const [canReviewActiveDocument, setCanReviewActiveDocument] = useState(false)

  const load = useCallback(async () => {
    if (!processId) return
    if (MOCK_TRAMITES.some((tramite) => tramite.id === processId)) return
    if (!accessToken) {
      setIsLoading(false)
      setError('La sesión no está disponible. Vuelve a iniciar sesión para consultar el trámite.')
      return
    }
    setIsLoading(true)
    setError(null)
    setAccessDenied(false)
    setWorkPlanDocuments([])
    setWorkPlanDocumentsError(null)
    try {
      const detail = await cargarDetalleTrazabilidad(accessToken, processId)
      setProcess(detail.process)
      setTeam(detail.team)
      setHistory(detail.history)
      setChecklist(detail.checklist)
      setDocuments(detail.documents)
      setAvailableTransitions(detail.availableTransitions)
      try {
        setWorkPlanDocuments(await cargarEntregasPlanTrazabilidad(accessToken, processId))
      } catch (err) {
        setWorkPlanDocumentsError(err instanceof ApiError
          ? `No se pudieron cargar las entregas del plan de trabajo: ${err.message}`
          : 'No se pudieron cargar las entregas del plan de trabajo.')
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
        setAccessDenied(true)
        setError(null)
      } else {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el trámite.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, processId])

  useEffect(() => { void load() }, [load])

  const tutor = team.find((member) => member.active && member.process_role === 'tutor')?.user ?? null
  const evaluators = team.filter((member) => member.active && member.process_role === 'evaluador').map((member) => member.user)
  const traceData = process ? processToTramite(process, tutor, evaluators) : null
  // Permisos: SOLO lo que dice el backend en el detalle (my_process_roles + allowed_actions).
  const perms = processPermissions(process)
  const canManageProcess = perms.canManage
  const isStudentOwner = perms.isStudent
  // Etiqueta de comentarios y reuniones: qué es la persona en ESTE trámite.
  const actor = actorFor(currentUser, rolInProcess(process))
  const missingMandatoryDocument = checklist.find((item) => item.mandatory && item.checklist_status === 'faltante')
  const pendingDocumentsCount = documents.filter((document) => document.status === 'pendiente').length
  const workPlanSubmissionCount = workPlanDocuments.reduce((total, stage) =>
    total + stage.deliverables.reduce((stageTotal, deliverable) => stageTotal + deliverable.submissions.length, 0), 0)
  // Hay botones de estado si el backend ofrece algún destino (mismas reglas que PUT /state).
  const canActOnState = availableTransitions.length > 0

  const handleChangeState = async (targetStatePublicId: string) => {
    if (!accessToken || !processId) return
    const target = availableTransitions.find((state) => state.public_id === targetStatePublicId)
    setIsChangingState(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await processesApi.changeState(accessToken, processId, targetStatePublicId)
      const targetCode = target?.code.toUpperCase() ?? ''
      const result = /RECHAZ/.test(targetCode) ? 'Trámite rechazado'
        : /DEVUEL|CORRECC/.test(targetCode) ? 'Se solicitaron correcciones'
          : actor.rol === 'Tutor' ? 'Aprobación del tutor registrada'
            : actor.rol === 'Coordinador' ? 'Aprobación registrada por Coordinación'
              : 'Trámite actualizado'
      setActionSuccess(`${result} a «${target?.name ?? 'el siguiente estado'}».`)
      await load()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.')
    } finally {
      setIsChangingState(false)
    }
  }

  const handleUpload = async (documentTypePublicId: string, file: File) => {
    if (!accessToken || !processId) return
    setUploadingType(documentTypePublicId)
    setActionError(null)
    setActionSuccess(null)
    try {
      await documentsApi.upload(accessToken, processId, documentTypePublicId, file)
      await load()
      setTab('docs')
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo cargar el documento.')
    } finally {
      setUploadingType(null)
    }
  }

  const handleReviewDocument = async (document: { public_id?: string }, status: 'aprobado' | 'rechazado', comment?: string) => {
    if (!accessToken || !document.public_id) return
    setReviewingDocumentId(document.public_id)
    setActionError(null)
    setActionSuccess(null)
    try {
      const updated = await documentsApi.review(accessToken, document.public_id, status, comment)
      setDocuments((current) => current.map((item) => item.public_id === updated.public_id ? updated : item))
      setChecklist((current) => current.map((item) => item.document?.public_id === updated.public_id
        ? { ...item, document: updated, checklist_status: updated.status }
        : item))
      setActiveViewerDoc((current) => current?.public_id === updated.public_id ? { ...current, status: updated.status } : current)
      setActionSuccess(status === 'aprobado' ? 'Documento aprobado correctamente.' : 'Documento devuelto con observaciones.')
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo revisar el documento.')
    } finally {
      setReviewingDocumentId(null)
    }
  }

  if (!processId) return <TrazabilidadIndex />
  if (MOCK_TRAMITES.some((tramite) => tramite.id === processId)) return <DetalleDemoTrazabilidad tramiteId={processId} />

  if (isLoading && !process) return <div role="status" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)]">Cargando el expediente de trazabilidad…</div>

  if (accessDenied) return <div className="max-w-3xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-[var(--shadow-sm)]">
    <h1 className="text-xl font-bold text-[var(--color-text)]">Acceso no autorizado</h1>
    <p className="mt-2 text-sm text-[var(--color-text-muted)]">Este trámite no está disponible para tu usuario.</p>
    <Link to="/trazabilidad" className="mt-5 inline-flex rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">Volver a trazabilidad</Link>
  </div>

  if (error || !process || !traceData) return <div className="max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
    <p>{error ?? 'No se encontró el trámite.'}</p>
    <button type="button" onClick={() => void load()} className="mt-3 font-semibold underline">Reintentar</button>
  </div>

  const backTo = location.state?.fromTutorExpediente
    ? { to: `/tutor/proyectos/${processId}`, label: 'Volver al expediente del proyecto' }
    : hasModule(currentUser, 'workspace-student')
      ? { to: '/tramites', label: 'Volver a mis trámites' }
      : { to: '/trazabilidad', label: 'Volver al listado de trazabilidad' }

  return <div className="max-w-6xl space-y-5 animate-fadeIn">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <Link to={backTo.to} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline"><ArrowLeft size={14} aria-hidden="true" />{backTo.label}</Link>
        <h1 className="section-title mt-3">{process.title?.trim() || process.process_code}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{process.student.full_name} · {process.modality.name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-[var(--color-teal)]">{process.process_code}</span><span className="text-xs text-[var(--color-text-muted)]">Semestre {process.academic_semester}</span><StatusBadge status={process.state.code} label={process.state.name} /></div>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {perms.canReviewDocuments && pendingDocumentsCount > 0 && <button type="button" onClick={() => setTab('docs')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-[13px] font-bold text-emerald-800 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"><FileCheck2 size={16} aria-hidden="true" />Revisar documentos ({pendingDocumentsCount})</button>}
        {canActOnState && <div className="flex flex-wrap gap-2">
          {availableTransitions.map((target) => <button key={target.public_id} type="button" onClick={() => void handleChangeState(target.public_id)} disabled={isChangingState} className="btn-primary inline-flex min-h-10 items-center gap-2 px-4 py-2 text-sm font-bold disabled:opacity-50">
            <Send size={15} aria-hidden="true" />{stateActionLabel(target.code, actor.rol, target.name)}
          </button>)}
        </div>}
      </div>
    </div>

    {isLoading && <p role="status" className="rounded-xl bg-[var(--color-bg)] px-4 py-2 text-xs text-[var(--color-text-muted)]">Actualizando el expediente…</p>}
    {actionError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{actionError}</p>}
    {actionSuccess && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">{actionSuccess}</p>}

    <ResumenTramite tramite={traceData} />

    {isStudentOwner && <section className="rounded-2xl border border-[#FF6500]/30 bg-[#FF6500]/10 p-4 dark:bg-[#FF6500]/15">
      <h2 className="text-sm font-bold text-[var(--color-text)]">¿Qué sigue?</h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{process.state.is_final_state
        ? 'Tu trámite finalizó. Consulta el historial para ver el cierre del proceso.'
        : missingMandatoryDocument
          ? `Carga el documento obligatorio «${missingMandatoryDocument.document_type.name}» para continuar.`
          : `Tu trámite está en «${process.state.name}». El siguiente paso depende de la revisión del equipo académico.`}</p>
    </section>}

    <TeamPanel processId={process.public_id} canManage={perms.managesTeam} onTeamChanged={() => void load()} />

    <div role="tablist" aria-label="Secciones de trazabilidad" className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-sm">
      {([
        ['audit', `Historial (${history.length})`],
        ['docs', `Documentos (${documents.length + workPlanSubmissionCount})`],
        ['comments', 'Comentarios'],
        ['meetings', 'Reuniones'],
      ] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`min-h-10 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6500] ${tab === key ? 'bg-[#FF6500] text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'}`}>{label}</button>)}
    </div>

    {tab === 'audit' && <section className="card animate-fadeIn" aria-label="Historial del trámite">
      <Timeline history={history} currentStep={stepForStateCode(process.state.code, process.state.is_final_state, Boolean(tutor))} hasTutor={Boolean(tutor)} canExport={perms.canExport} />
    </section>}

    {tab === 'docs' && <TabDocumentos
      checklist={checklist}
      documents={documents}
      workPlanDocuments={workPlanDocuments}
      workPlanDocumentsError={workPlanDocumentsError}
      studentName={process.student.full_name}
      canUpload={perms.canUpload}
      canReview={perms.canReviewDocuments}
      reviewingDocumentId={reviewingDocumentId}
      uploadingType={uploadingType}
      onUpload={(documentTypeId, file) => void handleUpload(documentTypeId, file)}
      onApprove={(document) => void handleReviewDocument(document, 'aprobado')}
      onPreview={(document) => {
        setCanReviewActiveDocument(true)
        setActiveViewerDoc({
          public_id: document.public_id,
          file_name: document.file_name,
          download_url: document.download_url,
          studentName: process.student.full_name,
          documentType: document.document_type.name,
          version: document.version,
          status: document.status,
        })
      }}
      onPreviewWorkPlan={(submission: SubmissionOut, deliverableTitle: string) => {
        setCanReviewActiveDocument(false)
        setActiveViewerDoc({
          public_id: submission.public_id,
          file_name: submission.file_name,
          download_url: submission.download_url,
          studentName: submission.submitted_by.full_name,
          documentType: deliverableTitle,
          version: submission.version,
          status: submission.status === 'en_revision' ? 'pendiente'
            : submission.status === 'requiere_correcciones' ? 'rechazado'
              : 'aprobado',
        })
      }}
    />}
    {tab === 'comments' && <TabComentarios processId={process.public_id} actor={actor} canComment={perms.canComment} />}
    {tab === 'meetings' && <TabReuniones processId={process.public_id} actor={actor} canManage={canManageProcess} />}

    <DocumentViewerModal
      isOpen={Boolean(activeViewerDoc)}
      onClose={() => {
        setActiveViewerDoc(null)
        setCanReviewActiveDocument(false)
      }}
      document={activeViewerDoc}
      canReview={perms.canReviewDocuments && canReviewActiveDocument}
      isReviewing={reviewingDocumentId === activeViewerDoc?.public_id}
      onApprove={(document) => handleReviewDocument(document, 'aprobado')}
      onReject={(document, comment) => handleReviewDocument(document, 'rechazado', comment)}
    />
  </div>
}
