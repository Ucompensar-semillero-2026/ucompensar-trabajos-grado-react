import { useRef, type KeyboardEvent } from 'react'
import { cn } from '@/utils/cn'
import { DOSSIER_TABS, panelId, tabId, type DossierTab } from './dossierHelpers'

/** Pestañas del expediente (patrón WAI-ARIA: flechas, Inicio y Fin mueven el foco y activan la pestaña). */
export function DossierTabs({ active, onChange, counts }: { active: DossierTab; onChange: (tab: DossierTab) => void; counts: Partial<Record<DossierTab, number>> }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = DOSSIER_TABS.length - 1
    const next = e.key === 'ArrowRight' ? (index === last ? 0 : index + 1) : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null
    if (next === null) return
    e.preventDefault()
    refs.current[next]?.focus()
    onChange(DOSSIER_TABS[next].id)
  }
  return (
    <div className="fu-rise rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
      <div role="tablist" aria-label="Secciones del expediente" className="scrollbar-premium flex gap-0.5 overflow-x-auto px-2">
        {DOSSIER_TABS.map((t, i) => {
          const selected = active === t.id
          const count = counts[t.id]
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[i] = el }}
              id={tabId(t.id)}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={panelId(t.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                'relative flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-4 text-[13px] font-bold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#FF6B1A]',
                selected ? 'text-[var(--color-secondary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-secondary)]',
              )}
            >
              <t.Icon size={17} aria-hidden="true" className={selected ? 'text-[#FF6B1A]' : undefined} />
              {t.label}
              {count !== undefined && count > 0 && (
                <span className={cn('min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 text-white', t.id === 'alertas' ? 'bg-red-600' : 'bg-[#1565C0]')}>{count}</span>
              )}
              <span aria-hidden="true" className={cn('absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-[#FF6B1A] transition-transform duration-300 motion-reduce:transition-none', selected ? 'scale-x-100' : 'scale-x-0')} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
