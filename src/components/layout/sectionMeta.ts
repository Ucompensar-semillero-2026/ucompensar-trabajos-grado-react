import type { NavSection } from '@/types'

export interface SectionMeta {
  title: string
  description: string
  /** Muestra la fotografía de bienvenida en el encabezado (solo secciones de uso frecuente). */
  art?: boolean
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

// Textos del estudiante, alineados con su menú lateral.
const STUDENT_META: Partial<Record<NavSection, SectionMeta>> = {
  dashboard: { title: 'Inicio', description: 'Resumen de tu actividad y de tus trámites de trabajo de grado.', art: true },
  tramites: { title: 'Mis trámites', description: 'Consulta el estado de tus postulaciones y trámites de grado.', art: true },
  documentos: { title: 'Documentos y entregables', description: 'Descarga plantillas, entrega tus documentos y consulta las observaciones de tu tutor.', art: true },
}

// Textos de Coordinación académica (rol Coordinador/Administrador en su panel de inicio).
const COORDINATION_META: Partial<Record<NavSection, SectionMeta>> = {
  dashboard: { title: 'Coordinación académica', description: 'Procesos de grado, asignación de tutores y seguimiento del avance.', art: true },
}

export function getSectionMeta(section: NavSection, isStudent: boolean, isCoordination = false): SectionMeta {
  return (isStudent && STUDENT_META[section]) || (isCoordination && COORDINATION_META[section]) || DEFAULT_META[section]
}
