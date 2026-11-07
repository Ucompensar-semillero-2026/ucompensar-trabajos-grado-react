import { Activity, GraduationCap, Layers } from 'lucide-react'
import type { StudentRow } from '@/services/monitoring.service'
import type { ProcessOut } from '@/services/processes.service'
import { DossierHeroArt } from './DossierHeroArt'

interface ProjectHeroCardProps {
  student: StudentRow
  /** Detalle del proceso (título, descripción y estado reales). Puede faltar si no se pudo cargar. */
  process: ProcessOut | null
  processLoading: boolean
}

export function ProjectHeroCard({ student, process, processLoading }: ProjectHeroCardProps) {
  const title = process?.title ?? student.project_title ?? student.process_code
  const description = process?.observations?.trim()
  return (
    <section
      aria-label="Proyecto de grado"
      className="fu-rise relative overflow-hidden rounded-[22px] bg-[linear-gradient(115deg,#031C34_0%,#062B4F_48%,#0B3F73_100%)] px-6 py-6 text-white shadow-[0_18px_40px_-18px_rgba(3,28,52,0.75)] md:px-8 md:py-7"
    >
      {/* decoración institucional: trama sutil y esquina naranja */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_-10%,rgba(21,101,192,0.55),transparent_45%)]" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-10 h-44 w-72 rotate-[-28deg] rounded-[36px] bg-gradient-to-r from-[#FF8A3D] to-[#FF6B1A] opacity-95" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-16 right-40 h-28 w-28 rounded-full border-[14px] border-white/5" />

      <div className="relative z-10 grid items-center gap-6 min-[1500px]:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[14px] font-extrabold text-[#FFB020]"><GraduationCap size={20} aria-hidden="true" />Proyecto de grado</p>
          <h3 className="mt-2 font-display text-[26px] font-extrabold leading-[1.12] tracking-tight md:text-[32px]">{title}</h3>
          {description ? (
            <p className="mt-3 max-w-3xl text-[14.5px] leading-relaxed text-white/85">{description}</p>
          ) : (
            <p className="mt-3 max-w-3xl text-[13.5px] italic text-white/60">{processLoading ? 'Cargando la descripción del proyecto…' : 'Este proyecto no tiene una descripción registrada.'}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#1565C0] px-4 py-2 text-[13px] font-bold shadow-md shadow-black/20 ring-1 ring-white/15">
              <Layers size={15} aria-hidden="true" />{process?.modality.name ?? student.modality_name}
            </span>
            {process && (
              <span className="inline-flex items-center gap-2 rounded-full bg-[#FFB020] px-4 py-2 text-[13px] font-bold text-[#3A2200] shadow-md shadow-black/20" title={process.state.description ?? undefined}>
                <Activity size={15} aria-hidden="true" />{process.state.name}
              </span>
            )}
          </div>
        </div>
        <div aria-hidden="true" className="hidden h-[190px] min-[1500px]:block">
          <DossierHeroArt />
        </div>
      </div>
    </section>
  )
}
