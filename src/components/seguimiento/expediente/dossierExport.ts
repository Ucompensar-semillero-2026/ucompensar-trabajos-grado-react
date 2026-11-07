import type { Expediente } from '@/services/monitoring.service'
import type { ProcessOut, TeamMemberOut } from '@/services/processes.service'
import type { ProcessDocumentOut } from '@/services/documents.service'
import type { WorkPlanOut } from '@/services/workplan.service'
import { RISK_META, TASK_STATE_META, formatDay, formatMoment } from '../monitoringUi'
import { KIND_LABEL } from '../TeacherInterventionModal'
import { alertReasons } from '../monitoringHelpers'
import { TEAM_ROLE_LABEL, slugify } from './dossierHelpers'

// El backend no ofrece una exportación del expediente: ambos archivos se generan en el navegador SOLO con los datos ya cargados
// (nada se inventa ni se completa). Lo que no se pudo cargar se declara como no disponible.

const COMMITMENT_LABEL: Record<string, string> = { pendiente: 'Pendiente', en_seguimiento: 'En seguimiento', cumplido: 'Cumplido', incumplido: 'Incumplido', cancelado: 'Cancelado' }

function csvCell(value: string | number | boolean | null | undefined): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

/** CSV de las actividades del estudiante (UTF-8 con BOM para Excel). */
export function buildActivitiesCsv(exp: Expediente): string {
  const header = ['Actividad', 'Etapa', 'Estado', 'Fecha límite original', 'Fecha límite efectiva', 'Entrega', 'Entrega tardía', 'Ampliaciones', 'Escalamiento grupal']
  const lines = exp.tasks.map((t) => [
    t.title, t.stage, TASK_STATE_META[t.state].label, t.original_due, t.effective_due, t.delivered_at, t.late_delivery ? 'Sí' : 'No',
    t.extensions.map((e) => `${e.previous_due_date} → ${e.new_due_date} (+${e.days_added}): ${e.reason}`).join(' | '), t.escalate_group ? 'Sí' : 'No',
  ].map(csvCell).join(','))
  return String.fromCharCode(0xfeff) + [header.map(csvCell).join(','), ...lines].join('\r\n')
}

const esc = (value: string | number | null | undefined) =>
  String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const unavailable = (what: string) => `<p class="muted">${esc(what)} no disponible en este momento.</p>`

interface DossierExportInput {
  expediente: Expediente
  process: ProcessOut | null
  team: TeamMemberOut[] | null
  documents: ProcessDocumentOut[] | null
  plan: WorkPlanOut | null
  generatedBy: string | null
  now?: Date
}

/** Expediente completo en un HTML autocontenido, listo para imprimir o guardar como PDF. */
export function buildDossierHtml({ expediente: exp, process, team, documents, plan, generatedBy, now = new Date() }: DossierExportInput): string {
  const s = exp.student
  const title = process?.title ?? s.project_title ?? s.process_code
  const reasons = alertReasons(s)
  const rows = (cells: Array<Array<string | number | null | undefined>>) => cells.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')
  const table = (head: string[], body: Array<Array<string | number | null | undefined>>) =>
    `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows(body)}</tbody></table>`

  const sections = [
    `<h2>Identificación</h2>${table(['Estudiante', 'Correo', 'Modalidad', 'Tutor', 'Estado del seguimiento'], [[s.student_name, s.student_email, s.modality_name, s.tutor_name ?? '—', RISK_META[s.level].label]])}`,
    `<h2>Proyecto</h2><p class="big">${esc(title)}</p>${process?.observations ? `<p>${esc(process.observations)}</p>` : '<p class="muted">Sin descripción registrada.</p>'}
     <p><strong>Código:</strong> ${esc(s.process_code)}${process ? ` · <strong>Estado:</strong> ${esc(process.state.name)} · <strong>Semestre:</strong> ${esc(process.academic_semester)}` : ''}</p>`,
    `<h2>Indicadores</h2>${table(['Asignadas', 'Entregadas', 'Pendientes', 'Vencidas', 'Cumplimiento'], [[s.assigned, s.delivered, s.pending, s.overdue, `${exp.completion_pct}%`]])}`,
    `<h2>Alertas</h2><p><strong>Nivel individual:</strong> ${esc(RISK_META[s.level].label)}${reasons.length ? ` · ${esc(reasons.join(' · '))}` : ''}</p>
     <p><strong>Alerta grupal:</strong> ${exp.group_alert ? `Activa${exp.group_overdue_students.length ? ` (origen: ${esc(exp.group_overdue_students.join(', '))})` : ''}` : 'Sin alerta grupal'}</p>`,
    `<h2>Historial de actividades</h2>${exp.tasks.length ? table(['Actividad', 'Etapa', 'Estado', 'Límite original', 'Límite efectivo', 'Entrega'], exp.tasks.map((t) => [t.title, t.stage, TASK_STATE_META[t.state].label, formatDay(t.original_due), formatDay(t.effective_due), t.delivered_at ? formatMoment(t.delivered_at) : 'Sin entrega'])) : '<p class="muted">Sin actividades asignadas.</p>'}`,
    `<h2>Plan de trabajo</h2>${plan ? `<p><strong>Estado:</strong> ${plan.status === 'publicado' ? 'Publicado' : 'Borrador'} · <strong>Inicio:</strong> ${esc(formatDay(plan.start_date))} · <strong>Entrega final:</strong> ${esc(formatDay(plan.target_end_date))} · <strong>Avance:</strong> ${plan.progress.percent}%</p>${table(['Etapa', 'Entregable', 'Fecha límite'], plan.stages.flatMap((st) => st.deliverables.filter((d) => d.active).map((d) => [st.name, d.title, formatDay(d.due_date)])))}` : unavailable('El plan de trabajo')}`,
    `<h2>Intervenciones</h2>${exp.interventions.length ? table(['Fecha', 'Tipo', 'Modalidad', 'Registró', 'Observaciones'], exp.interventions.map((i) => [formatMoment(i.occurred_at), KIND_LABEL[i.kind], i.mode === 'virtual' ? 'Virtual' : 'Presencial', i.created_by, i.observations])) : '<p class="muted">Sin intervenciones registradas.</p>'}`,
    `<h2>Compromisos</h2>${exp.commitments.length ? table(['Compromiso', 'Fecha', 'Estado', 'Vencido'], exp.commitments.map((c) => [c.description, formatDay(c.due_date), COMMITMENT_LABEL[c.status] ?? c.status, c.is_overdue ? 'Sí' : 'No'])) : '<p class="muted">Sin compromisos.</p>'}`,
    `<h2>Equipo</h2>${team ? table(['Integrante', 'Correo', 'Rol', 'Vigente'], team.map((m) => [m.user.full_name, m.user.email, TEAM_ROLE_LABEL[m.process_role] ?? m.process_role, m.active ? 'Sí' : 'No'])) : unavailable('El equipo')}`,
    `<h2>Documentos</h2>${documents ? (documents.length ? table(['Tipo', 'Archivo', 'Versión', 'Estado', 'Cargado'], documents.map((d) => [d.document_type.name, d.file_name, d.version, d.status, formatMoment(d.uploaded_at)])) : '<p class="muted">Sin documentos cargados.</p>') : unavailable('La lista de documentos')}`,
  ]

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Expediente — ${esc(s.student_name)}</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;margin:32px;line-height:1.45}
header{border-bottom:4px solid #FF6B1A;padding-bottom:12px;margin-bottom:20px}
h1{color:#062B4F;margin:0;font-size:24px}h2{color:#062B4F;font-size:16px;margin:24px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
.big{font-size:18px;font-weight:700;color:#062B4F;margin:4px 0}.muted{color:#64748b;font-style:italic}
table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;vertical-align:top}th{background:#F2F6FC;color:#062B4F}
footer{margin-top:28px;font-size:11px;color:#64748b}@media print{body{margin:12mm}}
</style></head><body>
<header><h1>Expediente del estudiante</h1><p>${esc(s.student_name)} · ${esc(title)}</p></header>
${sections.join('\n')}
<footer>Generado el ${esc(formatMoment(now.toISOString()))}${generatedBy ? ` por ${esc(generatedBy)}` : ''} desde la plataforma de trabajos de grado. Contiene datos personales: trátelo según la política de protección de datos.</footer>
</body></html>`
}

export function dossierFileName(studentName: string, kind: 'expediente' | 'actividades', now: Date = new Date()): string {
  return `${kind}-${slugify(studentName)}-${now.toISOString().slice(0, 10)}.${kind === 'expediente' ? 'html' : 'csv'}`
}

/** Descarga real de un archivo generado en el navegador. */
export function downloadGenerated(content: string, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
