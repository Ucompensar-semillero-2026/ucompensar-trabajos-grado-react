import type { NavSection } from '@/types'
import { labelFor, type Audience } from '@/config/navLabels'

export interface SectionMeta {
  title: string
  description: string
  /** Muestra la fotografía de bienvenida en el encabezado (solo secciones de uso frecuente). */
  art?: boolean
  /** Ilustración propia del encabezado (en lugar de la fotografía). */
  illustration?: 'monitoring' | 'documents' | 'dates'
}

const DEFAULT_META: Record<NavSection, SectionMeta> = {
  dashboard: { title: 'Dashboard', description: 'Resumen general de los trámites y la actividad de la plataforma.', art: true },
  tutor: { title: 'Panel del tutor', description: 'Tus proyectos asignados, entregas por revisar y fechas próximas.', art: true },
  'tutor-proyectos': { title: 'Mis proyectos asignados', description: 'Estudiantes y proyectos de grado que tienes a cargo como tutor.' },
  'tutor-planes': { title: 'Planes de trabajo', description: 'Crea, edita y publica el plan de cada proyecto: etapas, entregables y fechas.' },
  'tutor-revisiones': { title: 'Plantillas y revisiones', description: 'Entregas de tus estudiantes pendientes de revisión.' },
  'tutor-estadisticas': { title: 'Estadísticas e informes', description: 'Avance y estado de los entregables de tus proyectos.' },
  'mis-propuestas': { title: 'Mis propuestas', description: 'Sigue el estado de tus ideas, responde a Coordinación y confirma tu participación.' },
  propuestas: { title: 'Propuestas estudiantiles', description: 'Evalúa las ideas presentadas por los estudiantes, confirma el tutor y conviértelas en procesos.' },
  portafolio: { title: 'Portafolio de proyectos', description: 'Vista general de ofertas, propuestas y procesos de grado, con su estado y responsables.' },
  seguimiento: { title: 'Seguimiento de tareas', description: 'Supervisa el cumplimiento de actividades, identifica riesgos académicos y registra intervenciones para acompañar a los estudiantes durante el desarrollo de sus proyectos.', illustration: 'monitoring' },
  'mis-fechas': { title: 'Mis fechas y compromisos', description: 'Consulta tus tareas, fechas límite y el estado de tus entregables en el plan de trabajo.', illustration: 'dates' },
  calendario: { title: 'Calendario académico', description: 'Crea, publica y mantiene las fechas de los procesos de grado que consultan los estudiantes.' },
  asignacion: { title: 'Asignación de tutores', description: 'Asigna o cambia el tutor de cada proyecto de grado y supervisa su avance.' },
  proceso: { title: 'Mi proceso de grado', description: 'Plan de trabajo, fechas y avance de tu proyecto.', art: true },
  tramites: { title: 'Trámites', description: 'Consulta y sigue los trámites de trabajo de grado.', art: true },
  nuevo: { title: 'Nuevo trámite', description: 'Inicia un trámite de trabajo de grado eligiendo la modalidad.' },
  buscar: { title: 'Buscar por cédula', description: 'Localiza trámites a partir del documento de identidad del estudiante.' },
  trazabilidad: { title: 'Trazabilidad', description: 'Historial, documentos y estado de cada trámite.' },
  documentos: { title: 'Documentos', description: 'Visualiza, revisa y gestiona los documentos académicos cargados en los trámites.', art: true },
  comites: { title: 'Comités', description: 'Sesiones y decisiones de los comités de grado.' },
  administrativo: { title: 'Áreas administrativas', description: 'Revisiones y avales de las áreas administrativas.' },
  externo: { title: 'Entidades externas', description: 'Aprobaciones y seguimiento de las entidades externas.' },
  calificaciones: { title: 'Calificaciones', description: 'Calificaciones de los trabajos de grado.' },
  notificaciones: { title: 'Notificaciones', description: 'Avisos enviados sobre tus trámites.', art: true },
  reportes: { title: 'Reportes', description: 'Indicadores y reportes sobre los trámites.' },
}

// Descripciones, arte y títulos propios de cada perfil. El NOMBRE del módulo sale del catálogo único (config/navLabels.ts);
// aquí solo se adaptan los textos de ayuda al contexto de cada perfil y, donde no hay nombre de catálogo, el título.
type RoleMeta = Partial<Record<NavSection, Partial<SectionMeta>>>

const STUDENT_META: RoleMeta = {
  dashboard: { description: 'Resumen de tu actividad y de tus proyectos de trabajo de grado.', art: true },
  tramites: { description: 'Consulta el estado de tus postulaciones y proyectos de grado.', art: true },
  // «Mis tareas» (/documentos) se presenta como «Mis tareas y calificaciones»: entregables por semestre con su estado, nota y fecha límite.
  // El nombre del menú no cambia (sigue saliendo del catálogo navLabels). Sin fotografía ni ilustración: el encabezado es sobrio.
  documentos: { title: 'Mis tareas y calificaciones', description: 'Consulta las notas y observaciones de tus entregables del proceso de grado.', art: false },
}

const TEACHER_META: RoleMeta = {
  tutor: { description: 'Tus procesos y proyectos asignados, entregables por revisar y fechas próximas.', art: true },
  'tutor-proyectos': { description: 'Estudiantes y proyectos de grado que tienes a cargo como tutor.' },
  trazabilidad: { description: 'Consulta los estados, documentos y movimientos de los procesos de tus estudiantes.' },
  'tutor-revisiones': { description: 'Consulta, revisa y haz seguimiento a los entregables que envían tus estudiantes.' },
  seguimiento: { description: 'Supervisa las fechas de entrega y los compromisos de tus estudiantes, identifica riesgos académicos y registra intervenciones para acompañarlos.' },
}

const COORDINATION_META: RoleMeta = {
  dashboard: { description: 'Coordinación académica: procesos de grado, asignación de tutores y seguimiento del avance.', art: true },
  tramites: { description: 'Consulta y gestiona los procesos de trabajo de grado.', art: true },
  documentos: { description: 'Visualiza, revisa y gestiona los documentos y entregables cargados en los procesos.', art: true },
}

const ROLE_META: Record<Audience, RoleMeta> = { student: STUDENT_META, teacher: TEACHER_META, coordination: COORDINATION_META, other: {} }

/** Expediente de un proyecto del tutor (/tutor/proyectos/:id, cualquier pestaña). */
const TUTOR_PROJECT_PATH = /^\/tutor\/proyectos\/[^/]+\/?$/

/** En el expediente el encabezado de página (título y descripción) sobra: el menú ya indica la sección y el proyecto trae su propia barra. */
export function hidesTutorProjectHeader(pathname: string): boolean {
  return TUTOR_PROJECT_PATH.test(pathname)
}

export function getSectionMeta(section: NavSection, audience: Audience): SectionMeta {
  const base = DEFAULT_META[section]
  const role = ROLE_META[audience][section]
  return {
    ...base,
    ...role,
    title: role?.title ?? labelFor(section, audience) ?? base.title,
    description: role?.description ?? base.description,
  }
}
