import { ClipboardList, ShieldCheck, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { StudentRow } from '@/services/monitoring.service'
import { RiskLevelBadge } from '../monitoringUi'
import { Avatar } from './dossierUi'

function Fact({ Icon, label, children }: { Icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F2F6FC] text-[#062B4F] ring-1 ring-[var(--color-border)] dark:bg-white/10 dark:text-sky-200">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-[11.5px] text-[var(--color-text-muted)]">{label}</p>
        <div className="text-[13px] font-bold text-[var(--color-secondary)]">{children}</div>
      </div>
    </div>
  )
}

export function StudentIdentityCard({ student }: { student: StudentRow }) {
  return (
    <section aria-label="Identificación del estudiante" className="fu-rise rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <Avatar name={student.student_name} size="lg" />
          <div className="min-w-0">
            <h2 className="font-display text-[21px] font-extrabold leading-tight text-[var(--color-secondary)]">{student.student_name}</h2>
            <p className="truncate text-[12.5px] text-[var(--color-text-muted)]" title={student.student_email}>{student.student_email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
          <Fact Icon={ClipboardList} label="Modalidad">{student.modality_name}</Fact>
          <Fact Icon={UserRound} label="Tutor asignado">{student.tutor_name ?? 'Sin tutor asignado'}</Fact>
          <Fact Icon={ShieldCheck} label="Estado del seguimiento"><RiskLevelBadge level={student.level} /></Fact>
        </div>
      </div>
    </section>
  )
}
