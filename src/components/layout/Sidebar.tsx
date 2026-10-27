import { memo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogOut, ChevronRight, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { canAccessSection, isStudentRole } from '@/config/access'
import { NAV_ITEMS, STUDENT_NAV_GROUPS } from '@/constants'
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
      : 'text-white/70 hover:text-white hover:bg-white/10'
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

// Mismo lenguaje visual que las tarjetas de modalidades del catálogo: azul ingeniería → petróleo,
// con teal sutil a la izquierda y un resplandor naranja difuminado abajo a la derecha.
const SIDEBAR_GRADIENT = [
  'border-r border-white/10',
  'bg-[#052B41]',
  "bg-[image:radial-gradient(ellipse_130%_52%_at_100%_100%,rgba(239,103,35,0.42)_0%,rgba(239,103,35,0.2)_38%,rgba(239,103,35,0)_72%),radial-gradient(ellipse_150%_48%_at_0%_40%,rgba(6,176,185,0.16)_0%,rgba(6,176,185,0)_68%),linear-gradient(180deg,#052B41_0%,#073B57_100%)]",
].join(' ')

export function Sidebar({ user, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { theme } = useThemeStore()

  const handleToggle = () => setCollapsed((prev) => !prev)

  // El menú se elige de forma explícita por rol: estudiantes ven su lista propia; el resto, NAV_ITEMS.
  const navGroups = isStudentRole(user.role)
    ? STUDENT_NAV_GROUPS.map(group => ({
        label: group.label,
        entries: group.items.map(item => ({
          key: item.key,
          item,
          active: !item.href && (item.activePaths ?? (item.path ? [item.path] : [])).some(p => isPathActive(location.pathname, p)),
        })),
      }))
    : ['Principal', 'Gestión'].map(group => ({
        label: group,
        entries: NAV_ITEMS
          .filter(n => n.group.toLowerCase() === group.toLowerCase())
          .filter(n => canAccessSection(n.id, user.role))
          .map(item => ({ key: item.id, item, active: location.pathname === item.path })),
      }))

  return (
    <aside
      className={cn(
        'flex flex-col flex-shrink-0 h-full transition-all duration-300 overflow-hidden z-40',
        theme === 'dark' ? 'bg-[var(--color-surface)] border-r border-white/5' : SIDEBAR_GRADIENT
      )}
      style={{ width: collapsed ? 64 : 264 }}
    >
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
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4 scrollbar-premium">
        {navGroups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
                {group.label}
              </p>
            )}
            {collapsed && <div className="h-px bg-white/5 mx-2 mb-2" />}
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
      <div className="p-3 mt-auto border-t border-white/10">
        <div className={cn(
          'flex items-center gap-3 p-2 rounded-xl transition-all',
          !collapsed && 'hover:bg-white/5'
        )}>
          <img 
            src="https://api.dicebear.com/7.x/notionists/svg?seed=UCompensar&backgroundColor=f7d8a4" 
            alt="Avatar" 
            className="w-9 h-9 rounded-full border-2 border-white/10 shadow-md object-cover transition-transform hover:scale-105"
            title={collapsed ? user.name : undefined}
          />
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 animate-in">
                <p className="text-[13px] font-semibold text-white truncate leading-none">{user.name}</p>
                <p className="text-[11px] mt-1 text-white/65">{user.role}</p>
              </div>
              <button
                onClick={() => {
                  onLogout()
                  navigate('/login')
                }}
                className="flex items-center justify-center p-2 rounded-lg transition-all text-white/40 hover:text-white hover:bg-white/10 border-none cursor-pointer"
                title="Cerrar sesión"
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
