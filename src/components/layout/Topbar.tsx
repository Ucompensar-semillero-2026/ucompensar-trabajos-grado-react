import { useState, useRef, useEffect } from 'react'
import { Search, Bell, Moon, Sun, Settings, LogOut } from 'lucide-react'
import { useAppStore } from '@/stores/app.store'
import { useThemeStore } from '@/stores/theme.store'
import { isStudentRole } from '@/config/access'
import type { NavSection } from '@/types'

const sectionLabels: Record<NavSection, string> = {
  dashboard: 'Dashboard',
  tramites: 'Mis trámites',
  nuevo: 'Nuevo trámite',
  buscar: 'Buscar por cédula',
  trazabilidad: 'Trazabilidad',
  documentos: 'Documentos',
  comites: 'Comités',
  administrativo: 'Áreas administrativas',
  externo: 'Entidades externas',
  calificaciones: 'Calificaciones',
  notificaciones: 'Notificaciones',
  reportes: 'Reportes',
}

// Etiquetas del estudiante, alineadas con su menú.
const studentSectionLabels: Partial<Record<NavSection, string>> = {
  dashboard: 'Inicio',
  documentos: 'Mis documentos',
}

interface TopbarProps {
  activeSection: NavSection
  onNewTramite: () => void
  onLogout: () => void
  searchQuery: string
  onSearchChange: (q: string) => void
}

export function Topbar({ activeSection, onLogout, searchQuery, onSearchChange }: TopbarProps) {
  const { theme, toggle } = useThemeStore()
  const { currentUser } = useAppStore()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Click outside to close user menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    onLogout()
  }

  return (
    <header className="h-[64px] flex items-center px-6 gap-6 flex-shrink-0 relative z-30 transition-all duration-300">
      {/* Breadcrumb / Title */}
      <div className="flex-1">
        <h1 className="text-[24px] font-bold text-[var(--color-primary)] font-display tracking-tight">
          {(currentUser && isStudentRole(currentUser.role) && studentSectionLabels[activeSection]) || sectionLabels[activeSection]}
        </h1>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2.5 bg-[var(--color-surface)] border border-transparent rounded-full px-5 py-2 w-[320px] focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary-soft)] transition-all shadow-sm">
        <Search size={16} className="text-[var(--color-text-dim)] flex-shrink-0" />
        <input
          type="text"
          placeholder="Buscar trámites o documentos..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="border-none bg-transparent text-[13px] text-[var(--color-text)] outline-none w-full placeholder:text-[var(--color-text-dim)]"
        />
      </div>

      <div className="flex items-center gap-1.5 border-r border-[var(--color-border)] pr-4">
        {/* Notifications */}
        <button className="relative p-2 rounded-xl hover:bg-[var(--color-surface)] transition-all cursor-pointer text-[var(--color-text-dim)] hover:text-[var(--color-text)] border-none bg-transparent group">
          <Bell size={18} className="transition-transform group-hover:rotate-12" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--color-primary)] rounded-full ring-2 ring-[var(--color-bg)]" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggle}
          className="p-2 rounded-xl hover:bg-[var(--color-surface)] transition-all cursor-pointer text-[var(--color-text-dim)] hover:text-[var(--color-text)] border-none bg-transparent"
          title="Alternar tema"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* User Profile Dropdown */}
      {currentUser && (
        <div className="relative pl-1" ref={menuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-3 hover:bg-[var(--color-surface)] px-2 py-1.5 rounded-full transition-all cursor-pointer border-none bg-transparent group"
          >
            <div className="text-right">
              <span className="text-[12px] font-bold text-[var(--color-text)] block">
                {currentUser.name.split(' ')[0]}
              </span>
            </div>
            <img 
              src="https://api.dicebear.com/7.x/notionists/svg?seed=UCompensar&backgroundColor=f7d8a4" 
              alt="Avatar" 
              className="w-8 h-8 rounded-full border-2 border-[var(--color-bg)] shadow-sm object-cover transition-transform group-hover:scale-105"
            />
          </button>

          {/* Popover */}
          {isUserMenuOpen && (
            <div className="absolute right-0 top-full mt-3 w-64 bg-[var(--color-surface)] rounded-2xl shadow-xl border border-[var(--color-border)] py-2 animate-in z-50 overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg)]/50">
                <p className="text-[14px] font-bold text-[var(--color-text)]">{currentUser.name}</p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1 truncate">{currentUser.email}</p>
              </div>
              <div className="p-1.5">
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-[var(--color-text)] hover:bg-[var(--color-bg)] rounded-xl transition-all border-none bg-transparent text-left cursor-pointer group">
                  <Settings size={16} className="text-[var(--color-text-dim)] group-hover:text-[var(--color-primary)]" />
                  Configuración
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all border-none bg-transparent text-left cursor-pointer group"
                >
                  <LogOut size={16} className="transition-transform group-hover:translate-x-1" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
