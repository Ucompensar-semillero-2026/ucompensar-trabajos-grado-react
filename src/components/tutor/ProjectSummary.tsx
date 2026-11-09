import type { ReactNode } from 'react'
import { AlertTriangle, BookOpen, CalendarDays, CheckCircle2, Clock, ExternalLink, FileText, FileUp, Flag, GraduationCap, History, Layers, Target, User, type LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { PlanEventOut, StageOut, WorkPlanOut } from '@/services/workplan.service'
import type { ProcessHistoryOut, ProcessOut, TeamMemberOut } from '@/services/processes.service'
import { formatRelativeDate } from '@/utils/format'
import { formatCalendarDate } from '@/components/proceso/workPlanUi.utils'
import { DeliverableStatusBadge } from '@/components/proceso/workPlanUi'
import { Pill, ProgressBar } from './tutorUi'
import { CARD, TONES, buildFeed, nextDelivery, stageSummary, stateTone, type SummaryTone as Tone } from './tutorUi.utils'

interface Props {
  process: ProcessOut
  plan: WorkPlanOut | null
  team: TeamMemberOut[]
  activity: PlanEventOut[]
  history: ProcessHistoryOut[]
  /** Abre el entregable en la pestaña «Entregables». */
  onOpenDeliverable: (deliverablePublicId: string) => void
}

const STATE_ICON: Record<Tone, LucideIcon> = { green: CheckCircle2, blue: Clock, orange: Clock, red: AlertTriangle, gray: Flag }

function Kpi({ icon: Icon, tone, label, value, hint }: { icon: LucideIcon; tone: Tone; label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className={cn(CARD, 'flex min-w-0 items-center gap-3 p-4')}>
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', TONES[tone].tile)}><Icon size={20} aria-hidden="true" /></span>
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-semibold text-[var(--color-text-muted)]">{label}</p>
        <p className="truncate font-display text-[24px] font-extrabold leading-tight text-[var(--color-secondary)]">{value}</p>
        {hint && <p className="truncate text-[11.5px] text-[var(--color-text-muted)]">{hint}</p>}
      </div>
    </div>
  )
}

function Fact({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300"><Icon size={17} aria-hidden="true" /></span>
      <div className="min-w-0">
        <dt className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</dt>
        <dd className="break-words text-[13.5px] font-bold text-[var(--color-secondary)]">{children}</dd>
      </div>
    </div>
  )
}

function Empty({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#DCE6F2] px-4 py-6 text-center dark:border-[var(--color-border)]">
      <Icon size={22} aria-hidden="true" className="text-[var(--color-text-muted)]" />
      <p className="text-[13.5px] font-bold text-[var(--color-secondary)]">{title}</p>
      <p className="max-w-sm text-[12.5px] text-[var(--color-text-muted)]">{text}</p>
    </div>
  )
}

const FEED_ICON: Record<string, LucideIcon> = { entrega: FileUp, aprobado: CheckCircle2, correcciones: AlertTriangle, plan: CalendarDays, estado: Flag }
const STAGE_ICONS: LucideIcon[] = [BookOpen, GraduationCap, Layers, Target]

export function ProjectSummary({ process, plan, team, activity, history, onOpenDeliverable }: Props) {
  const tutors = team.filter((m) => m.process_role === 'tutor' && m.active)
  const title = process.title?.trim() || `Sin título registrado · ${process.process_code}`
  const published = plan?.status === 'publicado'
  // El avance oficial (obligatorios aprobados) lo calcula el backend y solo se muestra con el plan publicado.
  const progress = published && plan && plan.progress.total_required > 0 ? plan.progress : null
  const next = nextDelivery(plan)
  const stages = (plan?.stages ?? []).map((s: StageOut) => ({ stage: s, ...stageSummary(s) }))
  const feed = buildFeed(activity, history).slice(0, 6)
  const state = stateTone(process.state.name)
  const closed = Boolean(plan?.official_completion || process.closed_at)
  const noProgressText = plan ? 'Se mostrará cuando el plan esté publicado y tenga entregables obligatorios.' : 'Aún no hay un plan de trabajo: crea uno en la pestaña «Plan de trabajo».'
  const dash = '—'

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-[var(--color-secondary)] md:text-[30px]">
          Resumen <span className="text-[#FF6500]">del proyecto</span>
        </h2>
        <p className="mt-1 text-[14px] text-[var(--color-text-muted)]">Seguimiento académico y avance de entregables.</p>
      </div>

      {/* Encabezado del proyecto */}
      <section aria-label="Datos del proyecto" className={cn(CARD, 'grid gap-5 p-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]')}>
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6500] dark:bg-orange-500/15"><FileText size={30} aria-hidden="true" /></span>
          <div className="min-w-0">
            <h3 className="break-words font-display text-[19px] font-extrabold leading-snug text-[var(--color-secondary)]">{title}</h3>
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{process.modality.name} · Periodo académico {process.academic_semester}</p>
          </div>
        </div>
        <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          <Fact icon={User} label="Estudiante">{process.student.full_name}</Fact>
          <Fact icon={GraduationCap} label="Tutor">{tutors.length ? tutors.map((t) => t.user.full_name).join(', ') : 'Sin tutor activo'}</Fact>
          <Fact icon={Layers} label="Modalidad">{process.modality.name}</Fact>
          <Fact icon={CalendarDays} label="Fecha de inicio">{plan ? formatCalendarDate(plan.start_date) : 'Plan sin crear'}</Fact>
          <Fact icon={Target} label="Fecha objetivo">{plan ? formatCalendarDate(plan.target_end_date) : 'Plan sin crear'}</Fact>
          <Fact icon={Flag} label="Finalización oficial">{closed ? 'Proceso cerrado' : 'Proceso en curso'}</Fact>
          <div className="sm:col-span-2 xl:col-span-3">
            <dt className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Estado del proceso</dt>
            <dd><Pill tone={state} icon={STATE_ICON[state]}>{process.state.name}</Pill></dd>
          </div>
        </dl>
      </section>

      {/* Indicadores */}
      <section aria-label="Indicadores del proyecto" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={CheckCircle2} tone="green" label="Avance aprobado" value={progress ? `${progress.percent} %` : dash} hint={progress ? 'de los obligatorios' : undefined} />
        <Kpi icon={FileText} tone="blue" label="Entregables aprobados" value={progress ? `${progress.approved} / ${progress.total_required}` : dash} />
        <Kpi icon={Clock} tone="orange" label="Por revisar" value={progress ? progress.pending_review : dash} />
        <Kpi icon={AlertTriangle} tone="orange" label="Con correcciones" value={progress ? progress.needs_corrections : dash} />
        <Kpi icon={AlertTriangle} tone="red" label="Vencidos" value={progress ? progress.overdue : dash} />
        <Kpi
          icon={CalendarDays}
          tone="blue"
          label="Próxima entrega"
          value={next ? next.shortDate : dash}
          hint={next ? next.deliverable.title : 'Sin fechas por vencer'}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Avance académico */}
        <section aria-label="Avance académico del proyecto" className={cn(CARD, 'p-5')}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-[19px] font-extrabold text-[var(--color-secondary)]">Avance académico del proyecto</h3>
            {progress && <span className="rounded-full bg-orange-50 px-3 py-1 text-[13px] font-extrabold text-[#FF6500] dark:bg-orange-500/15">{progress.percent} %</span>}
          </div>
          {progress ? (
            <>
              <ProgressBar percent={progress.percent} label="Avance de entregables obligatorios aprobados" />
              <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
                {progress.approved} de {progress.total_required} entregables obligatorios aprobados · {progress.total_required - progress.approved} pendientes · {progress.pending_review} en revisión · {progress.needs_corrections} con correcciones · {progress.overdue} vencidos.
              </p>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">Un 100 % de entregables aprobados no equivale a la finalización oficial del proyecto.</p>
            </>
          ) : (
            <p className="text-[13px] text-[var(--color-text-muted)]">{noProgressText}</p>
          )}

          {stages.length > 0 && (
            <ul aria-label="Avance por etapas" className="mt-4 flex flex-col gap-3 border-t border-[#DCE6F2] pt-4 dark:border-[var(--color-border)]">
              {stages.map(({ stage, required, approved, percent, total, state: stageState }, i) => {
                const Icon = STAGE_ICONS[i % STAGE_ICONS.length]
                return (
                  <li key={stage.public_id} className="flex flex-col gap-2 rounded-xl border border-[#DCE6F2] p-3 dark:border-[var(--color-border)] sm:flex-row sm:items-center">
                    <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', TONES[stageState.tone].tile)}><Icon size={20} aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-[14px] font-bold text-[var(--color-secondary)]">{stage.name}</p>
                        <span className="text-[12.5px] text-[var(--color-text-muted)]">Semestre {stage.semester}</span>
                        <Pill tone={stageState.tone}>{stageState.label}</Pill>
                      </div>
                      {stage.description && <p className="text-[12.5px] text-[var(--color-text-muted)]">{stage.description}</p>}
                      <p className="text-[12px] text-[var(--color-text-muted)]">
                        {total} {total === 1 ? 'entregable' : 'entregables'}
                        {required > 0 ? ` · ${approved}/${required} obligatorios aprobados · ${required - approved} pendientes` : ' · sin obligatorios'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:w-[210px]">
                      <div className="flex-1"><ProgressBar percent={percent} label={`Avance de ${stage.name}`} /></div>
                      <span className="w-12 text-right text-[13px] font-extrabold text-[var(--color-secondary)]">{percent} %</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          {/* Próxima entrega */}
          <section aria-label="Próxima entrega" className="rounded-2xl border border-orange-200 bg-orange-50/70 p-5 shadow-[0_2px_10px_rgba(255,101,0,0.08)] dark:border-orange-400/30 dark:bg-orange-500/10">
            <div className="mb-2 flex items-center gap-2 text-[#FF6500]">
              <CalendarDays size={20} aria-hidden="true" />
              <h3 className="font-display text-[19px] font-extrabold text-[var(--color-secondary)]">Próxima entrega</h3>
            </div>
            {next ? (
              <div className="flex flex-col gap-2">
                <p className="break-words text-[16px] font-extrabold text-[var(--color-secondary)]">{next.deliverable.title}</p>
                <p className="text-[12.5px] text-[var(--color-text-muted)]">{next.stageName}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <DeliverableStatusBadge status={next.deliverable.status} />
                  <Pill tone={next.overdue ? 'red' : next.days <= 7 ? 'orange' : 'blue'} icon={Clock}>{next.remaining}</Pill>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                  <p className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--color-text-muted)]"><CalendarDays size={14} aria-hidden="true" />Fecha límite: {formatCalendarDate(next.deliverable.due_date)}</p>
                  <button
                    type="button"
                    onClick={() => onOpenDeliverable(next.deliverable.public_id)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-1.5 text-[13px] font-bold text-white transition-all duration-200 hover:bg-[var(--color-primary-hover)] hover:shadow-[0_4px_12px_var(--color-primary-soft)] active:scale-[0.97]"
                  >
                    Ver entregable <ExternalLink size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : (
              <Empty icon={CalendarDays} title="No hay entregas próximas" text={plan ? 'Todos los entregables con fecha están aprobados o no tienen fecha límite.' : 'Cuando crees el plan de trabajo, aquí verás la siguiente fecha límite.'} />
            )}
          </section>

          {/* Actividad reciente */}
          <section aria-label="Actividad reciente" className={cn(CARD, 'p-5')}>
            <h3 className="mb-3 flex items-center gap-2 font-display text-[19px] font-extrabold text-[var(--color-secondary)]"><History size={19} aria-hidden="true" className="text-sky-600" />Actividad reciente</h3>
            {feed.length === 0 ? (
              <Empty icon={History} title="Sin actividad registrada" text="Aquí aparecerán las entregas, revisiones y cambios del plan y del estado del proyecto." />
            ) : (
              <ul className="flex flex-col divide-y divide-[#DCE6F2] dark:divide-[var(--color-border)]">
                {feed.map((item) => {
                  const Icon = FEED_ICON[item.kind]
                  return (
                    <li key={item.key} className="flex items-center gap-3 py-2.5">
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', TONES[item.tone].tile)}><Icon size={17} aria-hidden="true" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-[13.5px] font-bold text-[var(--color-secondary)]">{item.title}</p>
                        <p className="text-[12px] text-[var(--color-text-muted)]">{item.detail ? `${item.detail} · ` : ''}{formatRelativeDate(item.at)}</p>
                      </div>
                      <Pill tone={item.tone}>{item.chip}</Pill>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
