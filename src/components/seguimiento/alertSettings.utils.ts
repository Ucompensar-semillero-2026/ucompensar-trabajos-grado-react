// Funciones y constantes de TaskAlertSettings.tsx que no son componentes (fast refresh de Vite).


/** Mismo orden lógico que valida el backend (que sigue siendo la autoridad). */
export function thresholdProblem(a: number, m: number, c: number): string | null {
  if (!Number.isInteger(a) || a < 1) return 'La atención inicial debe ser al menos 1 tarea vencida.'
  if (m <= a) return 'El riesgo moderado debe requerir más tareas vencidas que la atención inicial.'
  if (c <= m) return 'El riesgo crítico debe requerir más tareas vencidas que el riesgo moderado.'
  return null
}
