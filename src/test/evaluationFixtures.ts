import type { EvaluationCriterion, EvaluationMoment, EvaluationOut, EvaluationTotals } from '@/services/evaluation.service'

/** Constructores de la respuesta de GET /processes/{id}/evaluation para las pruebas (los números los calcula el backend; aquí se fijan). */

export const criterion = (id: string, name: string, weight: number, over: Partial<EvaluationCriterion> = {}): EvaluationCriterion => ({
  public_id: id,
  name,
  description: null,
  weight_percentage: weight,
  sort_order: 0,
  deliverable_public_id: null,
  status: 'pendiente',
  grading_mode: 'grupal',
  student_grades: [],
  group_grade: null,
  grade: null,
  percent_obtained: null,
  feedback: null,
  published_at: null,
  contribution_to_moment: null,
  contribution_to_total: null,
  evaluated_percent: null,
  ...over,
})

export const moment = (id: string, name: string, weight: number, criteria: EvaluationCriterion[], over: Partial<EvaluationMoment> = {}): EvaluationMoment => ({
  public_id: id,
  name,
  description: null,
  weight_percentage: weight,
  sort_order: 0,
  criteria,
  criteria_weight_total: 100,
  evaluated_weight: 0,
  moment_grade: null,
  partial_average: null,
  contribution_to_total: 0,
  evaluated_percent: 0,
  graded_count: 0,
  pending_count: criteria.length,
  closed: false,
  ...over,
})

export const totals = (over: Partial<EvaluationTotals> = {}): EvaluationTotals => ({
  accumulated: 0,
  evaluated_percent: 0,
  graded_criteria: 0,
  pending_criteria: 0,
  total_criteria: 0,
  complete: false,
  calculated_final: null,
  ...over,
})

export const evaluation = (over: Partial<EvaluationOut> = {}): EvaluationOut => ({
  process_public_id: 'p1',
  process_title: 'Detección de fallas',
  academic_semester: '2026-2',
  student_name: 'Ana Estudiante',
  status: 'publicada',
  published_at: '2026-10-01T10:00:00',
  viewer: 'student',
  can_configure: false,
  can_grade: false,
  moments: [],
  students: [],
  totals: totals(),
  published_totals: null,
  config_problems: [],
  has_published_grades: false,
  official_final_grade: null,
  ...over,
})

/** Dos momentos (40 % y 60 %) con un criterio de 50 % del primero ya calificado y publicado (4.5), el resto pendiente. */
export function partialEvaluation(over: Partial<EvaluationOut> = {}): EvaluationOut {
  return evaluation({
    moments: [
      moment(
        'm1',
        'Primer momento evaluativo',
        40,
        [
          criterion('c1', 'Trabajo escrito', 50, {
            status: 'publicada', grade: 4.5, percent_obtained: 90, contribution_to_moment: 2.25, contribution_to_total: 0.9, evaluated_percent: 20,
            feedback: 'Buen marco teórico', published_at: '2026-10-05T15:00:00',
          }),
          criterion('c2', 'Sustentación', 30),
          criterion('c3', 'Cumplimiento de objetivos', 20),
        ],
        { evaluated_weight: 50, partial_average: 4.5, contribution_to_total: 0.9, evaluated_percent: 20, graded_count: 1, pending_count: 2 }
      ),
      moment('m2', 'Segundo momento evaluativo', 60, [criterion('c4', 'Desarrollo del prototipo', 60), criterion('c5', 'Documentación técnica', 40)]),
    ],
    totals: totals({ accumulated: 0.9, evaluated_percent: 20, graded_criteria: 1, pending_criteria: 4, total_criteria: 5 }),
    ...over,
  })
}
