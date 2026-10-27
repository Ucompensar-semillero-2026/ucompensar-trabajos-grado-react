import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Menu, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

const primaryLabels = ['Estudia con nosotros', 'Facultades', 'Programas', 'Campus', 'Zona Financiera']
const studentLinks = ['Enlaces de interés', 'Aplicativos', 'Pago en línea', 'Reingresos', 'Grados']

export function InstitutionalHeader() {
  const [studentsOpen, setStudentsOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const studentsButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const closeOnOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setStudentsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && studentsOpen) {
        setStudentsOpen(false)
        studentsButtonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [studentsOpen])

  return (
    <header className="relative z-20 bg-white text-[var(--color-text)] shadow-sm">
      <div className="bg-[var(--color-secondary)] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-5 px-5 py-2 text-xs sm:px-8">
          <span>Institucional</span><span>Admisiones</span><span>Atención</span>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
        <Link to="/" aria-label="UCompensar, inicio"><Logo size="md" /></Link>
        <button className="rounded-lg p-2 md:hidden" aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={mobileOpen} onClick={() => setMobileOpen((value) => !value)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav aria-label="Navegación institucional" className={`${mobileOpen ? 'flex' : 'hidden'} absolute left-0 right-0 top-full flex-col gap-1 border-t bg-white p-4 shadow-lg md:static md:flex md:flex-row md:items-center md:justify-end md:border-0 md:p-0 md:shadow-none`}>
          {primaryLabels.map((label) => <span key={label} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-text-muted)]">{label}</span>)}
          <div className="relative" ref={menuRef}>
            <button ref={studentsButtonRef} type="button" aria-haspopup="true" aria-expanded={studentsOpen} aria-controls="students-menu" onClick={() => setStudentsOpen((value) => !value)} className="flex w-full items-center gap-1 rounded-lg px-3 py-2 text-left text-sm font-bold text-[var(--color-secondary)] hover:bg-[var(--color-primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
              Estudiantes <ChevronDown size={16} aria-hidden="true" />
            </button>
            {studentsOpen && <div id="students-menu" role="menu" className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-[var(--color-border)] bg-white p-2 shadow-xl md:left-auto md:right-0">
              {studentLinks.map((label) => <button key={label} type="button" role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">{label}</button>)}
              <Link role="menuitem" to="/proyectos-de-grado" onClick={() => { setStudentsOpen(false); setMobileOpen(false) }} className="mt-1 flex items-center justify-between rounded-lg bg-[var(--color-primary-soft)] px-3 py-2.5 text-sm font-bold text-[var(--color-secondary)] hover:bg-[var(--color-primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
                Proyectos de grado <span aria-hidden="true">→</span>
              </Link>
            </div>}
          </div>
          <span className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-text-muted)]">Colaboradores</span>
          <span className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-text-muted)]">Trabaja con nosotros</span>
        </nav>
      </div>
    </header>
  )
}
