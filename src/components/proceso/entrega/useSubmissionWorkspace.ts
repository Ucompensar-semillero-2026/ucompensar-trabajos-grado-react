import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, resolveFileUrl } from '@/services/http'
import { workPlanApi, type DraftWorkspaceOut, type SubmissionOut } from '@/services/workplan.service'
import { validateFile } from './submissionHelpers'

type Notice = { kind: 'ok' | 'error'; text: string }

function openInNewTab(url: string) {
  const link = document.createElement('a')
  link.href = resolveFileUrl(url)
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.click()
}

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback)

/**
 * Estado y acciones del modal de entrega de UNA tarea. Separa la carga del borrador (privado) de la publicación formal.
 * Las operaciones son de un solo vuelo (refs) para que un doble clic no dispare dos cargas o dos publicaciones; aun así el
 * backend es idempotente al publicar.
 */
export function useSubmissionWorkspace(accessToken: string | null, processId: string, deliverableId: string) {
  const [workspace, setWorkspace] = useState<DraftWorkspaceOut | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [upload, setUpload] = useState<{ fileName: string; percent: number } | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState<SubmissionOut | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const busy = useRef(false)
  const abort = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    if (!accessToken) return null
    try {
      const ws = await workPlanApi.draftWorkspace(accessToken, processId, deliverableId)
      setWorkspace(ws)
      setLoadError(null)
      return ws
    } catch (err) {
      setLoadError(errorText(err, 'No se pudo cargar la tarea.'))
      return null
    }
  }, [accessToken, processId, deliverableId])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => () => abort.current?.abort(), [])

  const uploadFile = useCallback(async (file: File) => {
    if (!accessToken || !workspace || busy.current) return
    const problem = validateFile(file, workspace.accepted_extensions, workspace.max_upload_mb)
    if (problem) return setNotice({ kind: 'error', text: problem })
    busy.current = true
    abort.current = new AbortController()
    setNotice(null)
    setUpload({ fileName: file.name, percent: 0 })
    try {
      const ws = await workPlanApi.saveDraft(accessToken, processId, deliverableId, file, (percent) => setUpload({ fileName: file.name, percent }), abort.current.signal)
      setWorkspace(ws)
      setPublished(null)
      setNotice({ kind: 'ok', text: 'Borrador guardado correctamente. Aún no se ha entregado.' })
    } catch (err) {
      // Si la carga falla, el borrador anterior (si existía) sigue siendo el vigente: no se pierde ni se publica nada.
      setNotice({ kind: 'error', text: errorText(err, 'No se pudo guardar el borrador.') })
      await refresh()
    } finally {
      busy.current = false
      abort.current = null
      setUpload(null)
    }
  }, [accessToken, workspace, processId, deliverableId, refresh])

  const cancelUpload = useCallback(() => abort.current?.abort(), [])

  const removeDraft = useCallback(async () => {
    if (!accessToken || busy.current) return
    busy.current = true
    try {
      setWorkspace(await workPlanApi.deleteDraft(accessToken, processId, deliverableId))
      setNotice({ kind: 'ok', text: 'Borrador eliminado.' })
    } catch (err) {
      setNotice({ kind: 'error', text: errorText(err, 'No se pudo eliminar el borrador.') })
      await refresh()
    } finally {
      busy.current = false
    }
  }, [accessToken, processId, deliverableId, refresh])

  /** Publica el borrador vigente. Devuelve true si quedó entregado. */
  const publish = useCallback(async (comment?: string) => {
    const draft = workspace?.current_draft
    if (!accessToken || !draft || busy.current) return false
    busy.current = true
    setPublishing(true)
    setNotice(null)
    try {
      const submission = await workPlanApi.publishDraft(accessToken, processId, deliverableId, draft.public_id, comment)
      setPublished(submission)
      await refresh()
      return true
    } catch (err) {
      // Un error (o un corte de red) nunca se presenta como entrega: se recarga el estado real y el borrador se conserva.
      setNotice({ kind: 'error', text: `${errorText(err, 'No se pudo entregar.')} Tu borrador se conserva; puedes intentarlo de nuevo.` })
      await refresh()
      return false
    } finally {
      busy.current = false
      setPublishing(false)
    }
  }, [accessToken, workspace, processId, deliverableId, refresh])

  /** Abre un archivo pidiendo antes enlaces firmados nuevos (los anteriores caducan). */
  const openFresh = useCallback(async (target: { kind: 'draft' } | { kind: 'submission'; publicId: string }) => {
    const ws = await refresh()
    const url = target.kind === 'draft' ? ws?.current_draft?.download_url : ws?.submissions.find((s) => s.public_id === target.publicId)?.download_url
    if (!url) return setNotice({ kind: 'error', text: 'El archivo ya no está disponible.' })
    openInNewTab(url)
  }, [refresh])

  return { workspace, loadError, upload, publishing, published, notice, setNotice, refresh, uploadFile, cancelUpload, removeDraft, publish, openFresh }
}

export type SubmissionWorkspace = ReturnType<typeof useSubmissionWorkspace>
