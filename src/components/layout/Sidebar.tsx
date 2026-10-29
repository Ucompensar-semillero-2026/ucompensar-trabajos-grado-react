import { memo, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogOut, ChevronRight, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { SidebarBackdrop } from './SidebarBackdrop'
import { canSeeInMenu, isStudentRole, isTutorWorkspaceUser } from '@/config/access'
import { INSTITUTIONAL_ROLE_LABELS } from '@/config/roles'
import { NAV_ITEMS, STUDENT_NAV_GROUPS, TUTOR_NAV_GROUPS } from '@/constants'
import type { StudentNavItem } from '@/constants'
import { useThemeStore } from '@/stores/theme.store'
import { cn } from '@/utils/cn'
import type { User } from '@/types'

interface NavEntry {
  label: string
  Icon: typeof LogOut
  path?: string
  href?: string
}

interface NavItemProps {
  item: NavEntry
  active: boolean
  collapsed: boolean
  onNavigate: (path: string) => void
}

const NavItem = memo(function NavItem({ item, active, collapsed, onNavigate }: NavItemProps) {
  const className = cn(
    'w-full flex items-center gap-2.5 rounded-xl transition-all duration-200 relative cursor-pointer border-none outline-none mb-0.5 no-underline',
    collapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2 justify-start',
    active
      ? 'bg-[var(--color-primary)] text-white font-semibold shadow-lg'
      : 'text-white/85 hover:text-white hover:bg-[#0876B9]/25'
  )
  const content = (
    <>
      <item.Icon size={16} className={cn('flex-shrink-0 transition-transform', active && 'scale-110')} />
      {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
    </>
  )

  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        title={collapsed ? item.label : undefined}
        className={className}
        style={{ fontSize: 13 }}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      onClick={() => item.path && onNavigate(item.path)}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={className}
      style={{ fontSize: 13 }}
    >
      {content}
    </button>
  )
})

const isPathActive = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`)

interface SidebarProps {
  user: User
  onLogout: () => void
}

// Degradado vertical azul marino → azul petróleo; el panal y la fotografía van encima (SidebarBackdrop).
const SIDEBAR_GRADIENT = [
  'border-r border-white/10',
  'bg-[#052B41]',
  "bg-[image:radial-gradient(ellipse_120%_40%_at_0%_0%,rgba(8,118,185,0.28)_0%,rgba(8,118,185,0)_70%),linear-gradient(180deg,#041F31_0%,#052B41_45%,#073B57_100%)]",
].join(' ')

const NARROW_QUERY = '(max-width: 767px)'
const canMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

export function Sidebar({ user, onLogout }: SidebarProps) {
  // En pantallas estrechas el menú arranca contraído (solo iconos) y sigue el tamaño de la ventana.
  const [collapsed, setCollapsed] = useState(() => canMatchMedia() && window.matchMedia(NARROW_QUERY).matches)
  useEffect(() => {
    if (!canMatchMedia()) return
    const query = window.matchMedia(NARROW_QUERY)
    const onChange = (event: MediaQueryListEvent) => setCollapsed(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  const navigate = useNavigate()
  const location = useLocation()
  const { theme } = useThemeStore()

  const handleToggle = () => setCollapsed((prev) => !prev)

  // El menú se elige de forma explícita por rol: estudiantes ven su lista propia; el resto, NAV_ITEMS.
  const roleMenu = isStudentRole(user.role) ? STUDENT_NAV_GROUPS : isTutorWorkspaceUser(user) ? TUTOR_NAV_GROUPS : null
  const isItemActive = (item: StudentNavItem) =>
    !item.href &&
    (item.exact
      ? location.pathname === item.path
      : (item.activePaths ?? (item.path ? [item.path] : [])).some(p => isPathActive(location.pathname, p)))
  const navGroups = roleMenu
    ? roleMenu.map(group => ({
        label: group.label,
        entries: group.items.map(item => ({ key: item.key, item, active: isItemActive(item) })),
      }))
    : ['Principal', 'Gestión'].map(group => ({
        label: group,
        entries: NAV_ITEMS
          .filter(n => n.group.toLowerCase() === group.toLowerCase())
          .filter(n => canSeeInMenu(n.id, user))
          .map(item => ({ key: item.id, item, active: location.pathname === item.path })),
      }))

  return (
    <aside
      className={cn(
        'relative flex flex-col flex-shrink-0 h-full transition-all duration-300 overflow-hidden z-40',
        theme === 'dark' ? 'bg-[var(--color-surface)] border-r border-white/5' : SIDEBAR_GRADIENT
      )}
      style={{ width: collapsed ? 64 : 264 }}
    >
      {/* Panal tecnológico + fotografía del edificio (decorativo, bajo el contenido) */}
      {theme !== 'dark' && <SidebarBackdrop showPhoto={!collapsed} />}

      {/* ── Logo header ── */}
      <div
        className={cn(
          'relative flex-shrink-0 transition-all',
          collapsed ? 'flex flex-col items-center gap-2 px-2 py-3' : 'px-5 pb-4 pt-12'
        )}
      >
        {/* El logo es negro sobre blanco: invert + hue-rotate(180°) deja las letras blancas, conserva el naranja
            de la marca (≈ #E96722) y mix-blend-screen hace transparente el fondo. */}
        <div className="cursor-pointer animate-in" onClick={() => navigate('/dashboard')}>
          <Logo
            variant="light"
            size="lg"
            className={cn(
              '[filter:invert(1)_hue-rotate(180deg)] mix-blend-screen',
              collapsed ? 'h-9 w-9 object-cover object-left' : 'h-auto w-full'
            )}
          />
        </div>
        <button
          onClick={handleToggle}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg transition-all cursor-pointer bg-white/0 hover:bg-white/10 text-white/60 hover:text-white border-none',
            !collapsed && 'absolute right-3 top-2'
          )}
          title={collapsed ? "Expandir menú" : "Contraer menú"}
        >
          {collapsed ? <ChevronRight size={16} /> : <X size={16} />}
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="relative z-10 flex-1 overflow-y-auto py-4 px-3 space-y-4 scrollbar-premium" aria-label="Navegación principal">
        {navGroups.map((group, index) => (
          <div key={group.label} className={cn(index > 0 && !collapsed && 'border-t border-white/10 pt-4')}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7FC4EC]">
                {group.label}
              </p>
            )}
            {collapsed && index > 0 && <div className="h-px bg-white/10 mx-2 mb-2" />}
            <div className="space-y-1">
              {group.entries.map(({ key, item, active }) => (
                <NavItem
                  key={key}
                  item={item}
                  active={active}
                  collapsed={collapsed}
                  onNavigate={(path) => navigate(path)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── User footer ── */}
      <div className="relative z-10 p-3 mt-auto border-t border-white/10 bg-[#041E2F]/80">
        <div className={cn(
          'flex items-center gap-3 p-2 rounded-xl transition-all',
          !collapsed && 'hover:bg-white/5'
        )}>
          <span
            aria-hidden="true"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[12px] font-bold text-white"
            title={collapsed ? user.name : undefined}
          >
            {user.initials}
          </span>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 animate-in">
                <p className="text-[13px] font-semibold text-white truncate leading-none">{user.name}</p>
                <p className="text-[11px] mt-1 text-white/65">{user.institutionalRoles.map(r => INSTITUTIONAL_ROLE_LABELS[r]).join(' · ') || user.role}</p>
              </div>
              <button
                onClick={() => {
                  onLogout()
                  navigate('/login')
                }}
                className="flex items-center justify-center p-2 rounded-lg transition-all text-white/60 hover:text-white hover:bg-white/10 border-none cursor-pointer"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
