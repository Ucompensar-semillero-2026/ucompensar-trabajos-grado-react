import type { ReactNode } from 'react'
import { ChevronDown, FilterX, Search } from 'lucide-react'
import { Card } from '@/components/ui'
import { cn } from '@/utils/cn'
import type { CommitmentStatus, RiskLevel, StudentFilters } from '@/services/monitoring.service'
import { RISK_META } from './monitoringUi.utils'

const COMMITMENT_FILTERS: Array<{ value: CommitmentStatus | 'vencido'; label: string }> = [
  { value: 'pendiente', label: 'Compromiso pendiente' }, { value: 'en_seguimiento', label: 'En seguimiento' }, { value: 'vencido', label: 'Compromiso vencido' },
  { value: 'cumplido', label: 'Cumplido' }, { value: 'incumplido', label: 'Incumplido' },
]

const control = 'h-10 w-full rounded-xl border bg-[var(--color-surface)] text-[13px] text-[var(--color-text)] outline-none transition-all duration-200 hover:border-[#0876B9]/60 focus:border-[#0876B9] focus:ring-2 focus:ring-[#0876B9]/20'

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-bold text-[var(--color-secondary)]">{label}</label>
      {children}
    </div>
  )
}

interface SelectProps {
  id: string
  label: string
  value: string | undefined
  allLabel: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}

function SelectField({ id, label, value, allLabel, options, onChange }: SelectProps) {
  return (
    <Field id={id} label={label}>
      <div className="relative">
        <select
          id={id}
          className={cn(control, 'cursor-pointer appearance-none px-3 pr-9', value ? 'border-[#0876B9] bg-[#0876B9]/[0.07] font-semibold shadow-[0_0_0_3px_rgba(8,118,185,0.14)]' : 'border-[var(--color-border)]')}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{allLabel}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)]" />
      </div>
    </Field>
  )
}

interface FollowUpFiltersProps {
  filters: StudentFilters
  projects: Array<{ id: string; label: string }>
  modalities: Array<{ code: string; name: string }>
  active: boolean
  onChange: (patch: Partial<StudentFilters>) => void
  onClear: () => void
}

export function FollowUpFilters({ filters, projects, modalities, active, onChange, onClear }: FollowUpFiltersProps) {
  return (
    <Card className="fu-rise p-4 md:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field id="mon-search" label="Buscar estudiante">
          <div className="relative">
            <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)]" />
            <input
              id="mon-search"
              type="search"
              placeholder="Nombre o correo del estudiante…"
              className={cn(control, 'pl-9 pr-3', filters.search ? 'border-[#0876B9] bg-[#0876B9]/[0.07] shadow-[0_0_0_3px_rgba(8,118,185,0.14)]' : 'border-[var(--color-border)]')}
              value={filters.search ?? ''}
              onChange={(e) => onChange({ search: e.target.value })}
            />
          </div>
        </Field>
        <SelectField id="mon-project" label="Proyecto" value={filters.process_id} allLabel="Todos" options={projects.map((p) => ({ value: p.id, label: p.label }))} onChange={(v) => onChange({ process_id: v || undefined })} />
        <SelectField id="mon-modality" label="Modalidad" value={filters.modality} allLabel="Todas" options={modalities.map((m) => ({ value: m.code, label: m.name }))} onChange={(v) => onChange({ modality: v || undefined })} />
        <SelectField id="mon-level" label="Nivel de alerta" value={filters.level} allLabel="Todos" options={(Object.keys(RISK_META) as RiskLevel[]).map((l) => ({ value: l, label: RISK_META[l].label }))} onChange={(v) => onChange({ level: (v || undefined) as RiskLevel | undefined })} />
        <SelectField id="mon-commitment" label="Estado del compromiso" value={filters.commitment} allLabel="Todos" options={COMMITMENT_FILTERS} onChange={(v) => onChange({ commitment: (v || undefined) as StudentFilters['commitment'] })} />
      </div>
      {active && (
        <button
          type="button"
          onClick={onClear}
          className="mt-3 inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[12.5px] font-bold text-[var(--color-secondary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          <FilterX size={14} aria-hidden="true" />Limpiar filtros
        </button>
      )}
    </Card>
  )
}
