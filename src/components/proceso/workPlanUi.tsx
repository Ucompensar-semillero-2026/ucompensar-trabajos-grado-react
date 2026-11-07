import { Badge } from '@/components/ui'
import { type ProcessOut } from '@/services/processes.service'
import { type DeliverableStatus } from '@/services/workplan.service'
import { STATUS_META, processLabel } from './workPlanUi.utils'

export function DeliverableStatusBadge({ status }: { status: DeliverableStatus }) {
  const { label, variant } = STATUS_META[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function ProcessSelector({
  processes,
  value,
  onChange,
}: {
  processes: ProcessOut[]
  value: string | null
  onChange: (id: string) => void
}) {
  if (processes.length < 2) return null
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
      <label htmlFor="process-selector" className="text-[13px] font-semibold text-[var(--color-text-muted)]">
        Proceso de grado
      </label>
      <select
        id="process-selector"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[260px] flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[#0876B9]"
      >
        {processes.map((p) => (
          <option key={p.public_id} value={p.public_id}>
            {processLabel(p)}
          </option>
        ))}
      </select>
    </div>
  )
}
