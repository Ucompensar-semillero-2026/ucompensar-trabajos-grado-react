import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/services/http'
import { monitoringApi, type Expediente } from '@/services/monitoring.service'
import { processesApi, type ProcessOut, type TeamMemberOut } from '@/services/processes.service'
import { documentsApi, type ProcessDocumentOut } from '@/services/documents.service'
import { workPlanApi, type WorkPlanOut } from '@/services/workplan.service'

export interface DossierSection<T> {
  data: T | null
  error: string | null
  loading: boolean
}

const empty = <T,>(): DossierSection<T> => ({ data: null, error: null, loading: true })

function message(err: unknown, fallback: string, notFound?: string): string {
  if (err instanceof ApiError) return err.status === 404 && notFound ? notFound : err.message
  return fallback
}

/**
 * Datos del expediente de UN estudiante en UN proyecto. El expediente de seguimiento es obligatorio; proceso, equipo, documentos y
 * plan se cargan en paralelo y cada uno falla por separado (un 403/404 en documentos no oculta el resto).
 * Al cambiar de estudiante o proyecto todo se reinicia y se descartan respuestas tardías del anterior: nunca se mezclan datos.
 */
export function useStudentDossier(accessToken: string | null, processId: string | undefined, studentId: string | undefined) {
  const [expediente, setExpediente] = useState<DossierSection<Expediente>>(empty)
  const [process, setProcess] = useState<DossierSection<ProcessOut>>(empty)
  const [team, setTeam] = useState<DossierSection<TeamMemberOut[]>>(empty)
  const [documents, setDocuments] = useState<DossierSection<ProcessDocumentOut[]>>(empty)
  const [plan, setPlan] = useState<DossierSection<WorkPlanOut>>(empty)
  const [nonce, setNonce] = useState(0)
  const keyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!accessToken || !processId || !studentId) return
    const key = `${processId}:${studentId}`
    if (keyRef.current !== key) {
      // Otro estudiante u otro proyecto: no se muestra nada del anterior mientras carga.
      keyRef.current = key
      setExpediente(empty())
      setProcess(empty())
      setTeam(empty())
      setDocuments(empty())
      setPlan(empty())
    }
    let current = true
    const settle = <T,>(set: (s: DossierSection<T>) => void, promise: Promise<T>, fallback: string, notFound?: string) =>
      promise
        .then((data) => { if (current) set({ data, error: null, loading: false }) })
        .catch((err) => { if (current) set({ data: null, error: message(err, fallback, notFound), loading: false }) })

    settle(setExpediente, monitoringApi.expediente(accessToken, processId, studentId), 'No se pudo cargar el expediente.')
    settle(setProcess, processesApi.get(accessToken, processId), 'No se pudo cargar el proyecto.')
    settle(setTeam, processesApi.team(accessToken, processId), 'No se pudo cargar el equipo.')
    settle(setDocuments, documentsApi.listForProcess(accessToken, processId), 'No se pudieron cargar los documentos.')
    settle(setPlan, workPlanApi.get(accessToken, processId), 'No se pudo cargar el plan de trabajo.', 'El proyecto aún no tiene un plan de trabajo publicado.')
    return () => { current = false }
  }, [accessToken, processId, studentId, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  /** Lista fresca de documentos (los enlaces firmados caducan): se usa justo antes de descargar. */
  const refreshDocuments = useCallback(async () => {
    if (!accessToken || !processId) return []
    const fresh = await documentsApi.listForProcess(accessToken, processId)
    setDocuments({ data: fresh, error: null, loading: false })
    return fresh
  }, [accessToken, processId])

  return { expediente, process, team, documents, plan, reload, refreshDocuments }
}

export type StudentDossier = ReturnType<typeof useStudentDossier>
