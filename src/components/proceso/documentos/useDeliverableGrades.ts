import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app.store'
import { evaluationApi } from '@/services/evaluation.service'

/**
 * Notas de la columna NOTA de «Mis tareas»: salen de la MISMA evaluación que el libro de calificaciones. Un entregable muestra
 * nota solo si el tutor vinculó un criterio con él (`deliverable_public_id`) y ese criterio tiene una nota PUBLICADA. Una
 * evaluación del proyecto completo que no está vinculada a un entregable no se muestra en ninguna fila.
 * Si la evaluación no está disponible (sin configurar o un fallo del servidor) devuelve vacío: la tabla muestra «—» y las tareas
 * siguen funcionando igual.
 */
export function useDeliverableGrades(processId: string | null): Record<string, number> {
  const accessToken = useAppStore((s) => s.accessToken)
  const [grades, setGrades] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!accessToken || !processId) {
      setGrades({})
      return
    }
    let cancelled = false
    evaluationApi
      .get(accessToken, processId)
      .then((report) => {
        if (cancelled) return
        const map: Record<string, number> = {}
        for (const moment of report.moments) {
          for (const c of moment.criteria) {
            if (c.deliverable_public_id && c.status === 'publicada' && c.grade !== null) map[c.deliverable_public_id] = c.grade
          }
        }
        setGrades(map)
      })
      .catch(() => { if (!cancelled) setGrades({}) })
    return () => { cancelled = true }
  }, [accessToken, processId])

  return grades
}
