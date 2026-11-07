import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarClock, CheckCircle2, ListTree, XCircle } from 'lucide-react'
import { LoadError } from '@/components/tutor/tutorUi'
import { useAppStore } from '@/stores/app.store'
import { hasModule } from '@/config/access'
import { ApiError, resolveFileUrl } from '@/services/http'
import { workPlanApi } from '@/services/workplan.service'
import type { ProcessDocumentOut } from '@/services/documents.service'
import { ExtensionManager } from './ExtensionManager'
import { TeacherInterventionModal } from './TeacherInterventionModal'
import { TaskComplianceTimeline } from './TaskComplianceTimeline'
import { AlertsTab, ProjectAlertsCard } from './expediente/AlertsPanels'
import { DeliverablesPanel } from './expediente/DeliverablesPanel'
import { DocumentsTab, RecentDocumentsCard } from './expediente/DocumentsPanels'
import { DossierHeader } from './expediente/DossierHeader'
import { DossierTabs } from './expediente/DossierTabs'
import { buildActivitiesCsv, buildDossierHtml, dossierFileName, downloadGenerated } from './expediente/dossierExport'
import { panelId, tabId, type DossierTab } from './expediente/dossierHelpers'
import { DossierCard, DossierSkeleton } from './expediente/dossierUi'
import { InterventionsPanel } from './expediente/InterventionsPanel'
import { KeyDatesCard } from './expediente/KeyDatesCard'
import { ProjectHeroCard } from './expediente/ProjectHeroCard'
import { ProjectMetrics } from './expediente/ProjectMetrics'
import { StudentIdentityCard } from './expediente/StudentIdentityCard'
import { ProjectTeamCard, TeamTab } from './expediente/TeamPanels'
import { WorkPlanPanel } from './expediente/WorkPlanPanel'
import { useStudentDossier } from './expediente/useStudentDossier'

type Notice = { kind: 'ok' | 'error'; text: string }

function openUrl(url: string) {
  const link = document.createElement('a')
  link.href = resolveFileUrl(url)
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.click()
}

/** Expediente de seguimiento de UN estudiante (ruta `/seguimiento/:processId/:studentId`). */
export function StudentTaskMonitoring() {
  const { processId, studentId } = useParams<{ processId: string; studentId: string }>()
  const accessToken = useAppStore((s) => s.accessToken)
  const user = useAppStore((s) => s.currentUser)
  const dossier = useStudentDossier(accessToken, processId, studentId)
  const { expediente, process, team, documents, plan, reload, refreshDocuments } = dossier
  const [dialog, setDialog] = useState<'intervention' | 'extension' | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [tab, setTab] = useState<DossierTab>('historial')

  // Otro expediente: se vuelve a la primera pestaña y se cierran avisos y diálogos del anterior.
  useEffect(() => { setTab('historial'); setNotice(null); setDialog(null) }, [processId, studentId])

  useEffect(() => {
    if (notice?.kind !== 'ok') return
    const t = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(t)
  }, [notice])

  // Coordinación supervisa; registrar y ampliar es del tutor del proyecto (el backend lo exige además).
  const canAct = Boolean(user) && !hasModule(user, 'workspace-coordination')
  const data = expediente.data

  const downloadDocument = async (doc: ProcessDocumentOut) => {
    try {
      // Los enlaces de descarga están firmados y caducan: se pide la lista de nuevo para usar uno vigente.
      const fresh = (await refreshDocuments()).find((d) => d.public_id === doc.public_id)
      if (!fresh) throw new ApiError(404, 'El documento ya no está disponible.')
      openUrl(fresh.download_url)
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof ApiError ? err.message : 'No se pudo descargar el documento.' })
    }
  }

  const openPlanFile = async (deliverableId: string, kind: 'submission' | 'template') => {
    if (!accessToken || !processId) return
    try {
      const fresh = await workPlanApi.get(accessToken, processId)
      const d = fresh.stages.flatMap((s) => s.deliverables).find((x) => x.public_id === deliverableId)
      const url = kind === 'template' ? d?.template_download_url : d?.current_submission?.download_url
      if (!url) throw new ApiError(404, 'El archivo ya no está disponible.')
      openUrl(url)
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof ApiError ? err.message : 'No se pudo abrir el archivo.' })
    }
  }

  const downloadDossier = () => {
    if (!data) return
    const html = buildDossierHtml({ expediente: data, process: process.data, team: team.data, documents: documents.data, plan: plan.data, generatedBy: user?.name ?? null })
    downloadGenerated(html, dossierFileName(data.student.student_name, 'expediente'), 'text/html;charset=utf-8')
    setNotice({ kind: 'ok', text: 'Expediente descargado. Ábrelo en el navegador para imprimirlo o guardarlo como PDF.' })
  }

  const exportActivities = () => {
    if (!data) return
    downloadGenerated(buildActivitiesCsv(data), dossierFileName(data.student.student_name, 'actividades'), 'text/csv;charset=utf-8')
    setNotice({ kind: 'ok', text: `Historial exportado: ${data.tasks.length} ${data.tasks.length === 1 ? 'actividad' : 'actividades'}.` })
  }

  if (expediente.loading && !data) return <DossierSkeleton />

  return (
    <div className="space-y-5">
      <DossierHeader canRegister={canAct} ready={Boolean(data)} onRegister={() => setDialog('intervention')} onDownload={downloadDossier} onExport={exportActivities} />

      {expediente.error && <LoadError message={expediente.error} onRetry={reload} />}
      {notice && (
        <p role={notice.kind === 'ok' ? 'status' : 'alert'} className={notice.kind === 'ok'
          ? 'fu-rise flex items-center gap-2 rounded-xl border-2 border-green-500 bg-green-50 px-4 py-3 text-[13px] font-bold text-green-800 dark:bg-green-500/10 dark:text-green-200'
          : 'fu-rise flex items-center gap-2 rounded-xl border-2 border-red-500 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-800 dark:bg-red-500/10 dark:text-red-200'}>
          {notice.kind === 'ok' ? <CheckCircle2 size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}{notice.text}
        </p>
      )}

      {data && accessToken && (
        <div className="grid grid-cols-1 items-start gap-5 min-[1280px]:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0 space-y-4">
            <StudentIdentityCard student={data.student} />
            <ProjectHeroCard student={data.student} process={process.data} processLoading={process.loading} />
            <ProjectMetrics expediente={data} />
            <DossierTabs
              active={tab}
              onChange={setTab}
              counts={{ alertas: data.tasks.filter((t) => t.state === 'vencida').length + (data.group_alert ? 1 : 0), intervenciones: data.interventions.length, documentos: documents.data?.length }}
            />
            <div role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)} key={tab} className="fu-rise">
              {tab === 'historial' && (
                <DossierCard
                  title="Historial de actividades"
                  Icon={ListTree}
                  titleId="exp-tasks"
                  action={canAct ? (
                    <button type="button" onClick={() => setDialog('extension')} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[12.5px] font-bold text-[var(--color-secondary)] transition-all hover:-translate-y-px hover:border-violet-500 hover:shadow-md">
                      <CalendarClock size={14} aria-hidden="true" className="text-violet-600" />Ampliar plazo
                    </button>
                  ) : undefined}
                >
                  <TaskComplianceTimeline tasks={data.tasks} />
                </DossierCard>
              )}
              {tab === 'plan' && <WorkPlanPanel plan={plan} />}
              {tab === 'entregables' && <DeliverablesPanel plan={plan} onOpenFile={openPlanFile} />}
              {tab === 'documentos' && <DocumentsTab documents={documents} onDownload={downloadDocument} />}
              {tab === 'intervenciones' && <InterventionsPanel expediente={data} token={accessToken} canAct={canAct} onRegister={() => setDialog('intervention')} onChanged={reload} />}
              {tab === 'alertas' && <AlertsTab expediente={data} />}
              {tab === 'equipo' && <TeamTab team={team} process={process.data} />}
            </div>
          </div>

          <aside aria-label="Resumen del proyecto" className="space-y-4 min-[1280px]:sticky min-[1280px]:top-0">
            <ProjectAlertsCard expediente={data} />
            <ProjectTeamCard team={team} process={process.data} />
            <KeyDatesCard student={data.student} plan={plan.data} process={process.data} />
            <RecentDocumentsCard documents={documents} onDownload={downloadDocument} onShowAll={() => setTab('documentos')} />
          </aside>

          {dialog === 'intervention' && (
            <TeacherInterventionModal token={accessToken} student={data.student} tasks={data.tasks} onClose={() => setDialog(null)}
              onSaved={() => { setDialog(null); setNotice({ kind: 'ok', text: 'Intervención registrada.' }); reload() }} />
          )}
          {dialog === 'extension' && (
            <ExtensionManager token={accessToken} student={data.student} tasks={data.tasks} onClose={() => setDialog(null)}
              onSaved={() => { setDialog(null); setNotice({ kind: 'ok', text: 'Ampliación autorizada. Las fechas originales se conservan en el historial.' }); reload() }} />
          )}
        </div>
      )}
    </div>
  )
}
