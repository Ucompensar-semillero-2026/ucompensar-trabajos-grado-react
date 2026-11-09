/**
 * Formato de notas y porcentajes para el libro de calificaciones. Aquí NO se calcula nada: los aportes, la nota acumulada y el
 * porcentaje evaluado los calcula el backend (una sola implementación) y la pantalla solo los muestra.
 */

export const GRADE_MAX = 5

const percentFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

/** «4.5» (una decimal) para la nota de un criterio. */
export const formatGrade = (value: number): string => value.toFixed(1)

/** «4.5 / 5.0». */
export const formatGradeOfScale = (value: number): string => `${formatGrade(value)} / ${GRADE_MAX.toFixed(1)}`

/** «3.85» (dos decimales) para aportes y acumulados, que pueden no caer en un solo decimal. */
export const formatPoints = (value: number): string => value.toFixed(2)

/** «30 %», «12,5 %», «33,33 %». */
export const formatPercent = (value: number): string => `${percentFormat.format(value)} %`
