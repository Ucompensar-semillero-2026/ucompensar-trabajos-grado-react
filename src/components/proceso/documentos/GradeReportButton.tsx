import { Link } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'

/** Ruta del reporte general de notas del estudiante (página aparte; no tiene opción propia en el menú). */
export const GRADE_REPORT_PATH = '/documentos/reporte-notas'

/** Botón «Ver reporte general de notas»: va arriba a la derecha del encabezado de /documentos (lo coloca DashboardLayout). */
export function GradeReportButton() {
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end sm:text-right">
      <Link
        to={GRADE_REPORT_PATH}
        className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-[#FF641D] bg-[var(--color-surface)] px-5 text-[14.5px] font-bold text-[#E5530F] transition-colors hover:bg-[#FF641D]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF641D] dark:text-orange-300"
      >
        <BarChart3 size={18} aria-hidden="true" />
        Ver reporte general de notas
      </Link>
      <span className="text-[12.5px] text-[var(--color-text-muted)]">Reporte general (criterios, ponderaciones y nota final)</span>
    </div>
  )
}
