import {
  LayoutDashboard, FileText, Plus, Search, GitBranch,
  FolderOpen, BarChart3, Gavel, Building2, Globe2, GraduationCap, Bell, LifeBuoy, Flag, Users, ClipboardList, FileCheck2, UserCheck, Lightbulb, Layers, CalendarDays,
} from 'lucide-react'
import type { NavSection } from '@/types'

// Fuente unica de verdad para el menu -- la usan tanto Sidebar (para
// pintar los links) como DashboardLayout (para derivar activeSection
// del path actual). Antes vivian dos arreglos separados y se
// desincronizaban (ej. la etiqueta de "buscar" quedo distinta en cada
// copia); mantenerlo en un solo lugar evita ese drift.
export const NAV_ITEMS: Array<{
  id: NavSection
  label: string
  Icon: typeof LayoutDashboard
  group: 'Principal' | 'Gestión'
  path: string
}> = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, group: 'Principal', path: '/dashboard' },
  { id: 'proceso', label: 'Mi proceso de grado', Icon: Flag, group: 'Principal', path: '/mi-proceso' },
  { id: 'portafolio', label: 'Portafolio de proyectos', Icon: Layers, group: 'Gestión', path: '/coordinacion/portafolio' },
  { id: 'calendario', label: 'Calendario académico', Icon: CalendarDays, group: 'Gestión', path: '/coordinacion/calendario' },
  { id: 'propuestas', label: 'Propuestas estudiantiles', Icon: Lightbulb, group: 'Gestión', path: '/coordinacion/propuestas' },
  { id: 'asignacion', label: 'Asignación de tutores', Icon: UserCheck, group: 'Gestión', path: '/coordinacion/asignacion' },
  { id: 'tramites', label: 'Mis trámites', Icon: FileText, group: 'Principal', path: '/tramites' },
  { id: 'nuevo', label: 'Nuevo trámite', Icon: Plus, group: 'Principal', path: '/nuevo' },
  { id: 'buscar', label: 'Buscar cédula', Icon: Search, group: 'Principal', path: '/buscar' },
  { id: 'trazabilidad', label: 'Trazabilidad', Icon: GitBranch, group: 'Gestión', path: '/trazabilidad' },
  { id: 'documentos', label: 'Documentos', Icon: FolderOpen, group: 'Gestión', path: '/documentos' },
  { id: 'comites', label: 'Comités', Icon: Gavel, group: 'Gestión', path: '/comites' },
  { id: 'administrativo', label: 'Áreas administrativas', Icon: Building2, group: 'Gestión', path: '/administrativo' },
  { id: 'externo', label: 'Entidades externas', Icon: Globe2, group: 'Gestión', path: '/externo' },
  { id: 'calificaciones', label: 'Calificaciones', Icon: GraduationCap, group: 'Gestión', path: '/calificaciones' },
  { id: 'notificaciones', label: 'Notificaciones', Icon: Bell, group: 'Gestión', path: '/notificaciones' },
  { id: 'reportes', label: 'Reportes', Icon: BarChart3, group: 'Gestión', path: '/reportes' },
]

// Menú del rol estudiante (se elige de forma explícita por rol en Sidebar; NAV_ITEMS sigue siendo
// el menú del resto de roles). `activePaths` marca como activa la opción en rutas anidadas, p. ej.
// el detalle /trazabilidad/:processId pertenece a "Mis trámites".
export interface StudentNavItem {
  key: string
  label: string
  Icon: typeof LayoutDashboard
  path?: string
  href?: string
  activePaths?: string[]
  /** Activa solo con la ruta exacta (p. ej. el panel, cuyo prefijo comparten sus subrutas). */
  exact?: boolean
}

export const SUPPORT_URL = 'https://ucompensar.edu.co/soporte-crm/'

export const STUDENT_NAV_GROUPS: Array<{ label: string; items: StudentNavItem[] }> = [
  {
    label: 'Principal',
    items: [
      { key: 'inicio', label: 'Inicio', Icon: LayoutDashboard, path: '/dashboard' },
      { key: 'proceso', label: 'Mi proceso de grado', Icon: Flag, path: '/mi-proceso' },
      { key: 'tramites', label: 'Mis trámites', Icon: FileText, path: '/tramites', activePaths: ['/tramites', '/trazabilidad'] },
    ],
  },
  {
    label: 'Seguimiento académico',
    items: [
      { key: 'propuestas', label: 'Mis propuestas', Icon: Lightbulb, path: '/mis-propuestas' },
      { key: 'documentos', label: 'Documentos y entregables', Icon: FolderOpen, path: '/documentos' },
      { key: 'notificaciones', label: 'Notificaciones', Icon: Bell, path: '/notificaciones' },
    ],
  },
  {
    label: 'Ayuda',
    items: [{ key: 'soporte', label: 'Ayuda y soporte', Icon: LifeBuoy, href: SUPPORT_URL }],
  },
]

// Menú del tutor (docente). Es presentación: cada endpoint verifica en el backend que la persona sea
// tutora ACTIVA del proceso (process_team). Ver isTutorWorkspaceUser en config/access.ts.
export const TUTOR_NAV_GROUPS: Array<{ label: string; items: StudentNavItem[] }> = [
  {
    label: 'Principal',
    items: [{ key: 'panel', label: 'Panel del tutor', Icon: LayoutDashboard, path: '/tutor', exact: true }],
  },
  {
    label: 'Seguimiento académico',
    items: [
      { key: 'proyectos', label: 'Mis proyectos asignados', Icon: Users, path: '/tutor/proyectos' },
      { key: 'planes', label: 'Planes de trabajo', Icon: ClipboardList, path: '/tutor/planes' },
      { key: 'revisiones', label: 'Plantillas y revisiones', Icon: FileCheck2, path: '/tutor/revisiones' },
    ],
  },
  {
    label: 'Análisis y comunicación',
    items: [
      { key: 'estadisticas', label: 'Estadísticas e informes', Icon: BarChart3, path: '/tutor/estadisticas' },
      { key: 'notificaciones', label: 'Notificaciones', Icon: Bell, path: '/notificaciones' },
      { key: 'soporte', label: 'Ayuda y soporte', Icon: LifeBuoy, href: SUPPORT_URL },
    ],
  },
]

// Rutas del espacio del tutor -> sección (título y descripción de la página).
export const TUTOR_ROUTE_SECTIONS: Array<{ prefix: string; exact?: boolean; section: NavSection }> = [
  { prefix: '/coordinacion/proyectos', section: 'asignacion' },
  { prefix: '/mis-propuestas', section: 'mis-propuestas' },
  { prefix: '/tutor', exact: true, section: 'tutor' },
  { prefix: '/tutor/proyectos', section: 'tutor-proyectos' },
  { prefix: '/tutor/planes', section: 'tutor-planes' },
  { prefix: '/tutor/revisiones', section: 'tutor-revisiones' },
  { prefix: '/tutor/estadisticas', section: 'tutor-estadisticas' },
]

export const MODALIDADES = [
  'Proyecto de grado',
  'Pasantía empresarial',
  'Homologación',
  'Emprendimiento',
  'Intercambio internacional',
  'Semillero',
  'Monografía',
] as const

export const CARRERAS = [
  'Ingeniería de Sistemas',
  'Ingeniería de Software',
  'Ingeniería Industrial',
  'Ingeniería de Telecomunicaciones',
  'Ingeniería Multimedia',
  'Ciencia de Datos',
  'Ingeniería Biomédica',
  'Ingeniería en Tecnologías de la Información y las Comunicaciones',
  'Administración de Empresas',
  'Administración de Servicios de Salud',
  'Mercadeo y Publicidad',
  'Profesional en Negocios y Logística Internacional',
  'Contaduría Pública',
  'Finanzas y Negocios Internacionales',
  'Administración en Salud',
  'Administración Financiera',
  'Comunicación Política y Gobierno',
  'Profesional en Deporte y Actividad Física',
  'Licenciatura en Educación Infantil',
  'Comunicación Social',
  'Licenciatura en Bilingüismo con Énfasis en Inglés',
  'Diseño Visual',
  'Profesional en Lenguas',
  'Psicología',
] as const

export const SEMESTRES = [
  '1.° semestre',
  '2.° semestre',
  '3.° semestre',
  '4.° semestre',
  '5.° semestre',
  '6.° semestre',
  '7.° semestre',
  '8.° semestre',
  '9.° semestre',
  '10.° semestre',
] as const

export const ESTADO_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  'en-revision': 'En revisión',
  'aprobado-consejo': 'Aprobado consejo',
  completado: 'Completado',
  'docs-faltantes': 'Docs faltantes',
}
