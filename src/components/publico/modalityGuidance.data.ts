export interface ModalityGuidance {
  requirementsToReview: string[]
  documentsToPrepare: string[]
}

export const modalityGuidance: Record<string, ModalityGuidance> = {
  PROYECTO_INV: {
    requirementsToReview: [
      'Relación del tema con el programa académico.',
      'Definición del problema o pregunta de investigación.',
      'Viabilidad del proyecto y disponibilidad de información.',
      'Enfoque metodológico y acompañamiento académico aplicable.',
    ],
    documentsToPrepare: [
      'Propuesta o anteproyecto de investigación.',
      'Planteamiento del problema y justificación.',
      'Objetivos generales y específicos.',
      'Marco de referencia o antecedentes.',
      'Metodología propuesta.',
      'Cronograma de actividades.',
      'Referencias bibliográficas.',
      'Aval o documentación ética, cuando corresponda al tipo de estudio.',
    ],
  },
  PROYECTO_EMP: {
    requirementsToReview: [
      'Identificación de una necesidad u oportunidad.',
      'Propuesta de valor.',
      'Viabilidad de la solución.',
      'Relación del proyecto con las competencias del programa académico.',
    ],
    documentsToPrepare: [
      'Documento de formulación del emprendimiento.',
      'Descripción de la necesidad o problema.',
      'Propuesta de valor.',
      'Modelo de negocio.',
      'Análisis de mercado o usuarios.',
      'Plan de implementación.',
      'Estimación de recursos y presupuesto.',
      'Evidencias de validación, cuando estén disponibles.',
    ],
  },
  PROYECTO_CONS: {
    requirementsToReview: [
      'Delimitación de un problema organizacional.',
      'Alcance del diagnóstico.',
      'Viabilidad de las recomendaciones.',
      'Disponibilidad de información para el análisis.',
    ],
    documentsToPrepare: [
      'Propuesta de consultoría.',
      'Descripción del contexto y del problema.',
      'Plan de diagnóstico.',
      'Alcance y objetivos.',
      'Metodología de análisis.',
      'Cronograma.',
      'Entregables previstos.',
      'Autorización para consultar información de una organización, cuando corresponda.',
    ],
  },
  PROYECTO_SOC: {
    requirementsToReview: [
      'Identificación de una necesidad social.',
      'Caracterización de la población o comunidad relacionada.',
      'Viabilidad de la intervención.',
      'Consideraciones éticas y de protección de la información.',
    ],
    documentsToPrepare: [
      'Diagnóstico de la necesidad.',
      'Descripción del contexto.',
      'Justificación de la intervención.',
      'Objetivos y población beneficiaria.',
      'Plan de actividades.',
      'Cronograma.',
      'Indicadores de seguimiento o impacto.',
      'Consentimientos o autorizaciones, cuando correspondan.',
    ],
  },
  SEMILLERO_INV: {
    requirementsToReview: [
      'Relación con una línea de investigación.',
      'Participación o vinculación al semillero, cuando aplique.',
      'Coherencia entre el proyecto y las actividades investigativas.',
      'Acompañamiento académico correspondiente.',
    ],
    documentsToPrepare: [
      'Propuesta de investigación.',
      'Descripción del problema.',
      'Objetivos.',
      'Metodología.',
      'Cronograma de trabajo.',
      'Evidencia de vinculación al semillero, cuando corresponda.',
      'Aval o acompañamiento del grupo, cuando aplique.',
      'Informe de avances o productos esperados.',
    ],
  },
  PASANTIA_INV: {
    requirementsToReview: [
      'Existencia de una actividad o proyecto de investigación pertinente.',
      'Alcance y objetivos de la pasantía.',
      'Condiciones de acompañamiento académico.',
      'Disponibilidad de una entidad o grupo receptor, cuando corresponda.',
    ],
    documentsToPrepare: [
      'Propuesta o plan de trabajo.',
      'Objetivos y actividades.',
      'Cronograma de la pasantía.',
      'Carta de aceptación o aval de la entidad receptora, cuando aplique.',
      'Identificación de los responsables del acompañamiento, si corresponde.',
      'Informe de resultados o avances.',
      'Evidencias de las actividades realizadas.',
    ],
  },
  PROYECTO_APL: {
    requirementsToReview: [
      'Identificación de un problema concreto.',
      'Justificación de la solución propuesta.',
      'Viabilidad técnica.',
      'Criterios para validar los resultados.',
    ],
    documentsToPrepare: [
      'Formulación del proyecto.',
      'Descripción del problema.',
      'Requisitos o necesidades identificadas.',
      'Diseño de la solución.',
      'Metodología de desarrollo.',
      'Cronograma.',
      'Plan de pruebas o validación.',
      'Documentación técnica y resultados esperados.',
    ],
  },
  CURSO_PROF: {
    requirementsToReview: [
      'Correspondencia del curso con el programa académico.',
      'Condiciones de inscripción y aprobación.',
      'Equivalencia o reconocimiento académico, cuando corresponda.',
      'Condiciones de evaluación establecidas para la opción seleccionada.',
    ],
    documentsToPrepare: [
      'Información del curso elegido.',
      'Plan de contenidos o programa académico.',
      'Evidencia de inscripción, cuando aplique.',
      'Certificado de participación o finalización, cuando corresponda.',
      'Evidencia de evaluación o aprobación, cuando sea requerida.',
      'Soportes académicos solicitados por el programa.',
    ],
  },
  INMERSION_INTL: {
    requirementsToReview: [
      'Correspondencia académica de la actividad internacional.',
      'Objetivos y alcance de la experiencia.',
      'Condiciones de participación y movilidad.',
      'Requisitos de viaje o permanencia, cuando correspondan.',
    ],
    documentsToPrepare: [
      'Propuesta de la experiencia internacional.',
      'Plan de actividades académicas.',
      'Carta de aceptación o invitación, cuando aplique.',
      'Itinerario, si corresponde.',
      'Documentos de viaje y autorizaciones exigibles según el destino.',
      'Soporte de seguro o cobertura, cuando corresponda.',
      'Informe académico o evidencia de resultados.',
      'Documentos de reconocimiento académico, si se requieren.',
    ],
  },
  COTERMINAL: {
    requirementsToReview: [
      'Compatibilidad entre el programa de origen y el programa de destino.',
      'Condiciones de admisión o continuidad académica.',
      'Reglas de reconocimiento o equivalencia de asignaturas.',
      'Requisitos de aprobación definidos por los programas involucrados.',
    ],
    documentsToPrepare: [
      'Solicitud o propuesta de participación.',
      'Historial académico, cuando corresponda.',
      'Documento de admisión o aceptación, si aplica.',
      'Plan de estudios relacionado con la opción.',
      'Aprobaciones académicas requeridas.',
      'Evidencias de inscripción y aprobación de las actividades correspondientes.',
      'Soportes para el reconocimiento académico, cuando proceda.',
    ],
  },
}
