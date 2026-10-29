import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ChevronDown, Moon, Sun, LogOut } from 'lucide-react'
import { SearchField } from '@/components/ui/SearchField'
import { INSTITUTIONAL_ROLE_LABELS } from '@/config/roles'
import { useAppStore } from '@/stores/app.store'
import { useThemeStore } from '@/stores/theme.store'

interface TopbarProps {
  onLogout: () => void
  searchQuery: string
  onSearchChange: (q: string) => void
}

export function Topbar({ onLogout, searchQuery, onSearchChange }: TopbarProps) {
  const { theme, toggle } = useThemeStore()
  const { currentUser } = useAppStore()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Cierra el menú al hacer clic fuera o al pulsar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const roleLabel = currentUser
    ? currentUser.institutionalRoles.map((r) => INSTITUTIONAL_ROLE_LABELS[r]).join(' · ') || currentUser.role
    : ''

  const iconButton =
    'flex h-10 w-10 items-center justify-center rounded-xl border-none bg-transparent text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-secondary)] cursor-pointer'

  return (
    <header className="relative z-30 flex h-[68px] flex-shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 md:gap-5 md:px-6">
      <SearchField
        label="Buscar trámites o documentos"
        placeholder="Buscar trámites o documentos…"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        wrapperClassName="min-w-0 flex-1 md:max-w-xl"
      />

      <div className="ml-auto flex items-center gap-1 md:gap-2">
        {/* Sin indicador de novedades: el backend no expone un estado leído/no leído */}
        <Link to="/notificaciones" className={iconButton} aria-label="Ver notificaciones" title="Notificaciones">
          <Bell size={18} aria-hidden />
        </Link>

        <button type="button" onClick={toggle} className={iconButton} title="Alternar tema" aria-label="Alternar tema">
          {theme === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
        </button>
      </div>

      {currentUser && (
        <div className="relative border-l border-[var(--color-border)] pl-3 md:pl-5" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            className="flex cursor-pointer items-center gap-3 rounded-xl border-none bg-transparent px-2 py-1.5 transition-colors hover:bg-[var(--color-bg)]"
          >
            <span
              aria-hidden
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-secondary)] text-[13px] font-bold text-white"
            >
              {currentUser.initials}
            </span>
            <span className="hidden min-w-0 text-left md:block">
              <span className="block max-w-[160px] truncate text-[13px] font-semibold leading-tight text-[var(--color-text)]">
                {currentUser.name}
              </span>
              <span className="block max-w-[160px] truncate text-[12px] leading-tight text-[var(--color-text-muted)]">
                {roleLabel}
              </span>
            </span>
            <ChevronDown size={16} aria-hidden className="hidden text-[var(--color-text-muted)] md:block" />
          </button>

          {isUserMenuOpen && (
            <div
              role="menu"
              className="animate-in absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2 shadow-[var(--shadow-md)]"
            >
              <div className="border-b border-[var(--color-border)] px-5 py-3">
                <p className="text-[14px] font-bold text-[var(--color-text)]">{currentUser.name}</p>
                <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-muted)]">{currentUser.email}</p>
              </div>
              <div className="p-1.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={onLogout}
                  className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border-none bg-transparent px-4 py-2.5 text-left text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <LogOut size={16} aria-hidden />
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
