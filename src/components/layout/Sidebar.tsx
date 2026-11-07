import { memo, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogOut, ChevronRight, X, LifeBuoy } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { SidebarBackdrop } from './SidebarBackdrop'
import { hasModule } from '@/config/access'
import { roleLabels } from '@/config/roles'
import { useMonitoringBadge } from '@/hooks/useMonitoringBadge'
import { NAV_ITEMS, STUDENT_NAV_GROUPS, SUPPORT_URL, TUTOR_NAV_GROUPS } from '@/constants'
import { audienceOf, labelFor } from '@/config/navLabels'
import type { StudentNavItem } from '@/constants'
import { useThemeStore } from '@/stores/theme.store'
import { cn } from '@/utils/cn'
import type { User } from '@/types'

interface NavEntry {
  label: string
  Icon: typeof LogOut
  path?: string
  href?: string
  badge?: number | null
}

interface NavItemProps {
  item: NavEntry
  active: boolean
  collapsed: boolean
  onNavigate: (path: string) => void
}

const NavItem = memo(function NavItem({ item, active, collapsed, onNavigate }: NavItemProps) {
  // Todas las opciones: texto e icono blancos en negrita. La activa lleva el naranja institucional #FF641D con una sombra
  // naranja muy sutil; las inactivas son transparentes y en hover se aclaran con blanco de baja opacidad.
  const className = cn(
    'relative mb-0.5 flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-[14px] border-none text-[15.5px] font-bold leading-tight text-white no-underline outline-none transition-colors duration-200',
    'focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-0',
    collapsed ? 'justify-center px-2 py-2.5' : 'justify-start px-3.5 py-2.5',
    active
      ? 'bg-[#FF641D] shadow-[0_6px_16px_-6px_rgba(255,100,29,0.6)]'
      : 'bg-transparent hover:bg-white/10'
  )
  const content = (
    <>
      <item.Icon size={18} strokeWidth={2.1} aria-hidden="true" className="flex-shrink-0 text-white" />
      {!collapsed && <span className="min-w-0 flex-1 break-words text-left">{item.label}</span>}
      {item.badge != null && item.badge > 0 && (
        <span
          aria-label={`${item.badge} ${item.badge === 1 ? 'estudiante requiere' : 'estudiantes requieren'} seguimiento`}
          className={cn('min-w-5 rounded-full bg-[#FF6B35] px-1.5 text-center text-[11px] font-bold leading-5 text-white', collapsed && 'absolute right-1 top-1')}
        >
          {item.badge}
        </span>
      )}
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
  // Estudiantes únicos que requieren seguimiento (calculado por el backend); solo si el backend expone el módulo de seguimiento.
  const monitoringBadge = useMonitoringBadge(hasModule(user, 'seguimiento'))

  // El menú y los nombres los elige el espacio de trabajo que dice el backend (GET /auth/me -> modules).
  const audience = audienceOf(user)
  const roleMenu = hasModule(user, 'workspace-student') ? STUDENT_NAV_GROUPS : hasModule(user, 'workspace-tutor') ? TUTOR_NAV_GROUPS : null
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
    : [
        ...(['Principal', 'Gestión'] as const).map(group => ({
          // Coordinación y administración: la sección «Gestión» se presenta como «Gestión académica».
          label: group === 'Gestión' && audience === 'coordination' ? 'Gestión académica' : group,
          entries: NAV_ITEMS
            .filter(n => n.group === group)
            .filter(n => hasModule(user, n.id))
            .map(item => ({
              key: item.id,
              // Nombre del módulo para este perfil (catálogo único en config/navLabels.ts); sin entrada, el original.
              item: { ...item, label: labelFor(item.id, audience) ?? item.label },
              active: location.pathname === item.path || (item.id === 'seguimiento' && isPathActive(location.pathname, item.path)),
            })),
        })),
        { label: 'Ayuda', entries: [{ key: 'soporte', item: { label: 'Ayuda y soporte', Icon: LifeBuoy, href: SUPPORT_URL } as NavEntry, active: false }] },
      ]

  return (
    <aside
      className={cn(
        'relative flex flex-col flex-shrink-0 h-full transition-all duration-300 overflow-hidden z-40',
        theme === 'dark' ? 'bg-[var(--color-surface)] border-r border-white/5' : SIDEBAR_GRADIENT
      )}
      style={{ width: collapsed ? 64 : 244 }}
    >
      {/* Panal tecnológico + fotografía del edificio (decorativo, bajo el contenido) */}
      {theme !== 'dark' && <SidebarBackdrop showPhoto={!collapsed} />}

      {/* ── Logo header ── */}
      <div
        className={cn(
          'relative flex-shrink-0 transition-all',
          collapsed ? 'flex flex-col items-center gap-2 px-2 py-3' : 'px-5 pb-4 pt-11'
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
            'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/70',
            !collapsed && 'absolute right-3 top-2.5'
          )}
          title={collapsed ? "Expandir menú" : "Contraer menú"}
        >
          {collapsed ? <ChevronRight size={16} /> : <X size={16} />}
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="relative z-10 flex-1 overflow-y-auto py-4 px-3 space-y-4 scrollbar-premium" aria-label="Navegación principal">
        {navGroups.map((group, index) => (
          <div key={group.label} className={cn(index > 0 && !collapsed && 'border-t border-white/15 pt-4')}>
            {!collapsed && (
              <p className="mb-2 px-3.5 text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#9ED8FA]">
                {group.label}
              </p>
            )}
            {collapsed && index > 0 && <div className="mx-2 mb-2 h-px bg-white/15" />}
            <div className="space-y-1.5">
              {group.entries.map(({ key, item, active }) => (
                <NavItem
                  key={key}
                  item={key === 'seguimiento' ? { ...item, badge: monitoringBadge } : item}
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
      <div className="relative z-10 mt-auto border-t border-white/15 bg-[#041E2F]/70 p-3 backdrop-blur-md">
        <div className={cn(
          'flex items-center gap-3 p-2 rounded-xl transition-all',
          !collapsed && 'hover:bg-white/5'
        )}>
          <span
            aria-hidden="true"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-[#0A3550] text-[13px] font-extrabold text-white"
            title={collapsed ? user.name : undefined}
          >
            {user.initials}
          </span>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 animate-in">
                <p className="truncate text-[15px] font-bold leading-none text-white">{user.name}</p>
                <p className="mt-1 truncate text-[13px] font-medium text-white/85">{roleLabels(user.roles).join(' · ')}</p>
              </div>
              <button
                onClick={() => {
                  onLogout()
                  navigate('/login')
                }}
                className="flex cursor-pointer items-center justify-center rounded-lg border-none p-2 text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
