export interface ProjectModality {
  id: string
  name: string
  description?: string | null
}

export type OpportunityStatus = 'Disponible' | 'Cerrada' | 'Próximamente'

export interface ProjectOffer {
  id: string
  title: string
  modalityId: string
  area: string
  description: string
  objective: string
  keywords: string[]
  status: OpportunityStatus
  scope?: string
  problem?: string
  audience?: string
  recommendedKnowledge?: string[]
  skills?: string[]
  expectedProducts?: string[]
  requirements?: string[]
  requiredDocuments?: string[]
  workMode?: string
  openDate?: string
  closeDate?: string
  contact?: string
  maxStudents?: number
  occupiedSeats?: number
  minStudents?: number
}

export type OfferCapacity =
  | { kind: 'unknown'; minStudents?: number }
  | { kind: 'maximum'; maxStudents: number; minStudents?: number }
  | { kind: 'tracked'; maxStudents: number; occupiedSeats: number; availableSeats: number; minStudents?: number }

function isNonNegativeInteger(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export function getOfferCapacity(offer: Pick<ProjectOffer, 'maxStudents' | 'occupiedSeats' | 'minStudents'>): OfferCapacity {
  const maxStudents = isNonNegativeInteger(offer.maxStudents) ? offer.maxStudents : undefined
  const minStudents = isNonNegativeInteger(offer.minStudents)
    && (maxStudents === undefined || offer.minStudents <= maxStudents)
    ? offer.minStudents
    : undefined

  if (maxStudents === undefined) return { kind: 'unknown', minStudents }
  if (maxStudents === 0) return { kind: 'maximum', maxStudents, minStudents }
  if (!isNonNegativeInteger(offer.occupiedSeats) || offer.occupiedSeats > maxStudents) {
    return { kind: 'maximum', maxStudents, minStudents }
  }

  return {
    kind: 'tracked',
    maxStudents,
    occupiedSeats: offer.occupiedSeats,
    availableSeats: Math.max(0, maxStudents - offer.occupiedSeats),
    minStudents,
  }
}

export function getOfferCapacityLabel(
  offer: Pick<ProjectOffer, 'maxStudents' | 'occupiedSeats' | 'minStudents'>,
  capacity: OfferCapacity = getOfferCapacity(offer),
): string {
  if (capacity.kind === 'unknown') return 'Cupos por confirmar'
  if (capacity.kind === 'maximum') {
    return capacity.maxStudents === 0
      ? 'Cupos completos'
      : `Equipo de hasta ${capacity.maxStudents} ${capacity.maxStudents === 1 ? 'estudiante' : 'estudiantes'}`
  }
  if (capacity.availableSeats === 0) return 'Cupos completos'
  if (capacity.availableSeats === 1) return '1 cupo disponible'
  return `${capacity.availableSeats} cupos disponibles`
}

export function isOfferAtCapacity(offer: Pick<ProjectOffer, 'maxStudents' | 'occupiedSeats' | 'minStudents'>): boolean {
  const capacity = getOfferCapacity(offer)
  return capacity.kind === 'maximum'
    ? capacity.maxStudents === 0
    : capacity.kind === 'tracked' && capacity.availableSeats === 0
}

export const projectModalities: ProjectModality[] = [
  { id: 'PROYECTO_INV', name: 'Proyecto de investigación' },
  { id: 'PROYECTO_EMP', name: 'Proyecto de emprendimiento' },
  { id: 'PROYECTO_CONS', name: 'Proyecto de consultoría' },
  { id: 'PROYECTO_SOC', name: 'Proyecto de intervención social' },
  { id: 'SEMILLERO_INV', name: 'Proyecto de semillero de investigación' },
  { id: 'PASANTIA_INV', name: 'Pasantía de investigación' },
  { id: 'PROYECTO_APL', name: 'Proyecto aplicado' },
  { id: 'CURSO_PROF', name: 'Curso de profundización' },
  { id: 'INMERSION_INTL', name: 'Inmersión internacional' },
  { id: 'COTERMINAL', name: 'Programa co-terminal' },
]

export function modalityRouteSlug(modalityId: string): string {
  const modality = projectModalities.find((item) => item.id === modalityId)
  const value = modality?.name ?? modalityId
  return value.toLocaleLowerCase('es-CO').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Contenido inicial de ejemplo para desarrollar y validar la experiencia del catálogo.
// Capacidades y ocupaciones ilustrativas del prototipo; sustituir por datos institucionales confirmados.
export const projectOffers: ProjectOffer[] = [
  {
    id: 'demo-investigacion',
    maxStudents: 6,
    occupiedSeats: 0,
    title: 'Analítica de datos para la toma de decisiones',
    modalityId: 'PROYECTO_INV',
    area: 'Ciencia de datos e innovación',
    description: 'Análisis de datos para identificar patrones y desarrollar indicadores que apoyen la toma de decisiones en una organización.',
    objective: 'Diseñar una propuesta analítica que transforme datos en información útil.',
    keywords: ['Analítica', 'Datos', 'Indicadores', 'Investigación'],
    status: 'Disponible',
  },
  {
    id: 'demo-innovacion',
    maxStudents: 5,
    occupiedSeats: 3,
    title: 'Optimización de procesos mediante automatización',
    modalityId: 'PROYECTO_APL',
    area: 'Ingeniería y transformación digital',
    description: 'Diseño de una solución tecnológica que permita optimizar tareas repetitivas y mejorar la eficiencia de un proceso organizacional.',
    objective: 'Identificar oportunidades de automatización y proponer una solución evaluable.',
    keywords: ['Automatización', 'Procesos', 'Innovación', 'Tecnología'],
    status: 'Disponible',
  },
  {
    id: 'modelo-negocio-solucion-sostenible',
    maxStudents: 6,
    occupiedSeats: 4,
    title: 'Modelo de negocio para una solución sostenible',
    modalityId: 'PROYECTO_EMP',
    area: 'Emprendimiento e innovación',
    description: 'Desarrollo de una propuesta de negocio que responda a una necesidad identificada y contemple su viabilidad.',
    objective: 'Estructurar una propuesta de valor y un modelo de negocio.',
    keywords: ['Emprendimiento', 'Sostenibilidad', 'Modelo de negocio'],
    status: 'Disponible',
  },
  {
    id: 'experiencia-usuario-servicios-digitales',
    maxStudents: 4,
    occupiedSeats: 3,
    title: 'Mejora de la experiencia del usuario en servicios digitales',
    modalityId: 'PROYECTO_CONS',
    area: 'Experiencia de usuario y transformación digital',
    description: 'Análisis de una experiencia digital para identificar oportunidades de mejora en la navegación, la accesibilidad y la eficiencia del servicio.',
    objective: 'Formular recomendaciones sustentadas en un diagnóstico.',
    keywords: ['UX', 'Accesibilidad', 'Servicios digitales', 'Consultoría'],
    status: 'Disponible',
  },
  {
    id: 'solucion-tecnologica-necesidad-comunitaria',
    maxStudents: 5,
    occupiedSeats: 5,
    title: 'Solución tecnológica para una necesidad comunitaria',
    modalityId: 'PROYECTO_SOC',
    area: 'Innovación social',
    description: 'Diseño de una propuesta que responda a una necesidad de una comunidad mediante herramientas tecnológicas o metodologías de intervención.',
    objective: 'Formular una solución con objetivos, alcance e indicadores de impacto.',
    keywords: ['Comunidad', 'Innovación social', 'Impacto'],
    status: 'Disponible',
  },
  {
    id: 'prototipo-monitoreo-investigacion',
    maxStudents: 6,
    occupiedSeats: 2,
    title: 'Desarrollo de un prototipo de monitoreo',
    modalityId: 'SEMILLERO_INV',
    area: 'Investigación e ingeniería',
    description: 'Diseño de un prototipo para registrar, procesar y visualizar información relacionada con un problema de interés académico.',
    objective: 'Construir y documentar una prueba de concepto.',
    keywords: ['Prototipo', 'Sensores', 'Investigación', 'Ingeniería'],
    status: 'Disponible',
  },
  {
    id: 'diagnostico-mejora-proceso-organizacional',
    maxStudents: 4,
    occupiedSeats: 0,
    title: 'Diagnóstico y mejora de un proceso organizacional',
    modalityId: 'PROYECTO_APL',
    area: 'Gestión de procesos',
    description: 'Evaluación de un proceso para identificar fallas, oportunidades de mejora e indicadores de seguimiento.',
    objective: 'Formular una propuesta de mejora basada en el diagnóstico realizado.',
    keywords: ['Procesos', 'Indicadores', 'Calidad', 'Mejora continua'],
    status: 'Disponible',
  },
  {
    id: 'estrategia-innovacion-servicio',
    maxStudents: 5,
    occupiedSeats: 3,
    title: 'Estrategia de innovación para un servicio',
    modalityId: 'PROYECTO_CONS',
    area: 'Innovación y estrategia',
    description: 'Identificación de oportunidades para mejorar un servicio mediante el análisis de sus usuarios, necesidades y procesos.',
    objective: 'Elaborar una estrategia de innovación con acciones priorizadas.',
    keywords: ['Estrategia', 'Innovación', 'Servicios'],
    status: 'Disponible',
  },
  {
    id: 'analisis-eficiencia-energetica',
    maxStudents: 6,
    occupiedSeats: 4,
    title: 'Análisis de eficiencia energética en espacios de uso académico',
    modalityId: 'PROYECTO_INV',
    area: 'Energía y sostenibilidad',
    description: 'Estudio de patrones de consumo energético y factores asociados para formular recomendaciones basadas en datos disponibles.',
    objective: 'Analizar el consumo energético y proponer indicadores que faciliten la evaluación de alternativas de eficiencia.',
    keywords: ['Eficiencia energética', 'Sostenibilidad', 'Indicadores', 'Investigación'],
    status: 'Disponible',
    problem: 'La falta de información organizada dificulta comparar patrones de consumo e identificar oportunidades de mejora.',
    scope: 'Análisis de información disponible, definición de indicadores y formulación de recomendaciones; no incluye implementación de infraestructura.',
    expectedProducts: ['Documento de análisis', 'Conjunto de indicadores', 'Recomendaciones sustentadas'],
  },
  {
    id: 'modelado-prediccion-demanda',
    maxStudents: 5,
    occupiedSeats: 4,
    title: 'Modelado de datos para estimar demanda de servicios',
    modalityId: 'PROYECTO_INV',
    area: 'Analítica y modelado',
    description: 'Exploración de métodos de análisis y modelado para comprender variaciones en la demanda de un servicio a partir de conjuntos de datos disponibles.',
    objective: 'Comparar alternativas de modelado y documentar sus alcances para apoyar el análisis de demanda.',
    keywords: ['Modelado', 'Analítica', 'Demanda', 'Datos'],
    status: 'Disponible',
    problem: 'La variación de la demanda puede dificultar la planeación de capacidad y recursos.',
    scope: 'Preparación y análisis de datos, comparación de métodos y presentación de resultados; la precisión dependerá de las fuentes disponibles.',
    expectedProducts: ['Datos documentados', 'Comparación de modelos', 'Informe de resultados'],
  },
  {
    id: 'propuesta-valor-producto-circular',
    maxStudents: 4,
    occupiedSeats: 1,
    title: 'Propuesta de valor para un producto de economía circular',
    modalityId: 'PROYECTO_EMP',
    area: 'Economía circular y emprendimiento',
    description: 'Estructuración de una iniciativa que aproveche materiales o recursos de forma circular y responda a una necesidad identificada.',
    objective: 'Definir una propuesta de valor y explorar su viabilidad con herramientas de modelado de negocio.',
    keywords: ['Economía circular', 'Propuesta de valor', 'Emprendimiento'],
    status: 'Disponible',
    problem: 'Algunas necesidades de usuarios pueden abordarse mediante alternativas que reduzcan desperdicios y prolonguen el uso de recursos.',
    scope: 'Formulación y validación inicial de la propuesta; no implica la creación de una empresa ni garantiza resultados comerciales.',
    expectedProducts: ['Propuesta de valor', 'Modelo de negocio inicial', 'Registro de validación exploratoria'],
  },
  {
    id: 'servicio-digital-emprendedor',
    maxStudents: 6,
    occupiedSeats: 0,
    title: 'Diseño de un servicio digital para resolver una necesidad cotidiana',
    modalityId: 'PROYECTO_EMP',
    area: 'Servicios digitales',
    description: 'Diseño de una iniciativa de servicio digital a partir de la identificación de usuarios, necesidades y una propuesta de valor diferenciada.',
    objective: 'Formular un modelo de servicio y una ruta de validación inicial con usuarios potenciales.',
    keywords: ['Servicios digitales', 'Emprendimiento', 'Usuarios', 'Prototipo'],
    status: 'Disponible',
    problem: 'Las necesidades identificadas pueden carecer de soluciones de servicio accesibles y comprensibles para sus usuarios.',
    scope: 'Diseño conceptual, prototipo de baja fidelidad y validación exploratoria; no incluye el despliegue de una plataforma productiva.',
    expectedProducts: ['Mapa de usuarios', 'Propuesta de valor', 'Prototipo conceptual'],
  },
  {
    id: 'diagnostico-accesibilidad-servicio',
    maxStudents: 5,
    occupiedSeats: 3,
    title: 'Diagnóstico de accesibilidad en un servicio digital',
    modalityId: 'PROYECTO_CONS',
    area: 'Accesibilidad y experiencia de usuario',
    description: 'Revisión de un servicio digital con criterios de accesibilidad y análisis de recorridos de usuario para priorizar oportunidades de mejora.',
    objective: 'Elaborar un diagnóstico y recomendaciones priorizadas para mejorar la experiencia de uso.',
    keywords: ['Accesibilidad', 'Experiencia de usuario', 'Diagnóstico', 'Consultoría'],
    status: 'Disponible',
    problem: 'Barreras de interacción pueden impedir que distintos usuarios completen tareas dentro de un servicio digital.',
    scope: 'Evaluación de una muestra acordada del servicio y formulación de recomendaciones; su aplicación depende de quien administra el servicio.',
    expectedProducts: ['Matriz de hallazgos', 'Priorización de mejoras', 'Informe de recomendaciones'],
  },
  {
    id: 'estrategia-comunicacion-comunitaria',
    maxStudents: 4,
    occupiedSeats: 4,
    title: 'Estrategia de comunicación para una iniciativa comunitaria',
    modalityId: 'PROYECTO_SOC',
    area: 'Comunicación e innovación social',
    description: 'Diseño de una estrategia de comunicación que facilite la participación y el acceso a información útil para una comunidad.',
    objective: 'Proponer acciones y materiales de comunicación coherentes con el contexto y las necesidades identificadas.',
    keywords: ['Comunidad', 'Comunicación', 'Participación', 'Intervención social'],
    status: 'Disponible',
    audience: 'La caracterización de participantes y comunidad debe definirse con acompañamiento académico y respetando la privacidad.',
    scope: 'Diagnóstico comunicativo y diseño de una propuesta; la implementación depende de acuerdos y autorizaciones aplicables.',
    expectedProducts: ['Diagnóstico de comunicación', 'Plan de acciones', 'Prototipos de materiales'],
  },
  {
    id: 'herramienta-mapeo-necesidades-sociales',
    maxStudents: 6,
    occupiedSeats: 4,
    title: 'Herramienta para mapear necesidades y recursos comunitarios',
    modalityId: 'PROYECTO_SOC',
    area: 'Tecnología para la participación',
    description: 'Exploración de una herramienta sencilla para organizar necesidades, recursos y actores relacionados con una iniciativa comunitaria.',
    objective: 'Diseñar y evaluar un prototipo de apoyo al registro y consulta de información comunitaria.',
    keywords: ['Participación', 'Prototipo', 'Comunidad', 'Información'],
    status: 'Disponible',
    problem: 'La información sobre necesidades y recursos locales puede encontrarse dispersa y ser difícil de consultar.',
    scope: 'Prototipo y evaluación inicial con información de prueba o autorizada; no contempla publicar datos personales.',
    expectedProducts: ['Modelo de información', 'Prototipo navegable', 'Resultados de evaluación inicial'],
  },
  {
    id: 'sistema-registro-variables-ambientales',
    maxStudents: 5,
    occupiedSeats: 2,
    title: 'Sistema de registro de variables ambientales para investigación',
    modalityId: 'SEMILLERO_INV',
    area: 'Instrumentación y ambiente',
    description: 'Desarrollo de una prueba de concepto para registrar variables ambientales y organizar los datos obtenidos para análisis posterior.',
    objective: 'Documentar un flujo de adquisición y consulta de datos adecuado para una pregunta de investigación.',
    keywords: ['Sensores', 'Ambiente', 'Datos', 'Semillero'],
    status: 'Disponible',
    scope: 'Prueba de concepto y documentación; selección de variables, equipos y sitio requiere definición con el grupo académico correspondiente.',
    expectedProducts: ['Prototipo de registro', 'Descripción del flujo de datos', 'Informe de pruebas'],
  },
  {
    id: 'revision-evidencia-tecnologias-aprendizaje',
    maxStudents: 4,
    occupiedSeats: 3,
    title: 'Revisión de evidencia sobre tecnologías para el aprendizaje',
    modalityId: 'SEMILLERO_INV',
    area: 'Educación y tecnología',
    description: 'Organización y análisis de publicaciones académicas sobre una tecnología o estrategia de aprendizaje delimitada.',
    objective: 'Sintetizar hallazgos y vacíos de conocimiento que puedan orientar una pregunta de investigación.',
    keywords: ['Revisión de literatura', 'Educación', 'Tecnología', 'Semillero'],
    status: 'Disponible',
    scope: 'Búsqueda y síntesis de literatura de acuerdo con un protocolo acordado; no equivale a una revisión sistemática si no se define como tal.',
    expectedProducts: ['Estrategia de búsqueda', 'Matriz de literatura', 'Síntesis de hallazgos'],
  },
  {
    id: 'apoyo-analisis-datos-laboratorio',
    maxStudents: 6,
    occupiedSeats: 1,
    title: 'Apoyo al análisis y documentación de datos de investigación',
    modalityId: 'PASANTIA_INV',
    area: 'Gestión y análisis de datos',
    description: 'Participación en actividades de organización, limpieza y documentación de datos vinculados a un proceso de investigación.',
    objective: 'Aplicar prácticas de gestión de datos y documentar las actividades desarrolladas durante la pasantía.',
    keywords: ['Pasantía', 'Datos', 'Investigación', 'Documentación'],
    status: 'Disponible',
    scope: 'Las actividades, el acceso a información y el acompañamiento deben acordarse con el grupo o entidad receptora.',
    expectedProducts: ['Bitácora de actividades', 'Datos documentados según autorización', 'Informe de resultados'],
  },
  {
    id: 'prototipo-instrumentacion-investigativa',
    maxStudents: 5,
    occupiedSeats: 0,
    title: 'Apoyo al desarrollo de un prototipo de instrumentación',
    modalityId: 'PASANTIA_INV',
    area: 'Instrumentación y prototipado',
    description: 'Colaboración en el diseño, ensamble o prueba de componentes para una actividad de investigación previamente delimitada.',
    objective: 'Documentar el proceso de prototipado y los resultados de las pruebas realizadas.',
    keywords: ['Pasantía', 'Instrumentación', 'Prototipo', 'Pruebas'],
    status: 'Disponible',
    scope: 'El plan de trabajo, los recursos y las condiciones de acceso requieren acuerdo con el grupo receptor y el acompañamiento académico.',
    expectedProducts: ['Plan de trabajo', 'Registro de pruebas', 'Documentación técnica'],
  },
  {
    id: 'sistematizacion-resultados-investigacion',
    maxStudents: 4,
    occupiedSeats: 2,
    title: 'Sistematización de resultados de una actividad investigativa',
    modalityId: 'PASANTIA_INV',
    area: 'Comunicación científica',
    description: 'Apoyo a la organización y presentación de resultados obtenidos durante una actividad de investigación, respetando los acuerdos de uso de la información.',
    objective: 'Preparar una síntesis estructurada de resultados y evidencias de la actividad investigativa.',
    keywords: ['Pasantía', 'Resultados', 'Sistematización', 'Investigación'],
    status: 'Disponible',
    scope: 'El acceso a resultados, los productos y su circulación dependen de las autorizaciones y acuerdos académicos aplicables.',
    expectedProducts: ['Matriz de resultados', 'Síntesis de hallazgos', 'Informe de actividades'],
  },
  {
    id: 'tablero-seguimiento-indicadores',
    maxStudents: 6,
    occupiedSeats: 6,
    title: 'Tablero para seguimiento de indicadores de un proceso',
    modalityId: 'PROYECTO_APL',
    area: 'Visualización y gestión de información',
    description: 'Diseño de una solución de visualización que organice indicadores y facilite el seguimiento de un proceso definido.',
    objective: 'Construir y evaluar un prototipo de tablero con criterios de pertinencia, claridad y uso responsable de los datos.',
    keywords: ['Indicadores', 'Visualización', 'Prototipo', 'Procesos'],
    status: 'Disponible',
    problem: 'La información de seguimiento puede estar dispersa y no facilitar la lectura oportuna de tendencias.',
    scope: 'Prototipo con datos autorizados o de prueba; la integración a sistemas institucionales no está incluida.',
    expectedProducts: ['Diseño del tablero', 'Prototipo funcional', 'Guía de uso y evaluación'],
  },
]
