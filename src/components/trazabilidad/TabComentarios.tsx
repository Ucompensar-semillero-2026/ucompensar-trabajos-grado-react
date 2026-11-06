import { useEffect, useState } from 'react'
import { MessageSquare, Reply } from 'lucide-react'
import { Button, Card, EmptyState } from '@/components/ui'
import type { ActorTramite, ComentarioTramite } from '@/services/trazabilidad.service'
import { guardarComentarioLocal, listarComentariosLocales } from '@/services/trazabilidad.service'
import { formatRelativeDate } from '@/utils/format'

export function TabComentarios({ processId, actor, canComment, initialComments = [], onAdd }: { processId: string; actor: ActorTramite; canComment: boolean; initialComments?: ComentarioTramite[]; onAdd?: (texto: string, respuestaA: string | null) => Promise<ComentarioTramite> | ComentarioTramite }) {
  const [comments, setComments] = useState<ComentarioTramite[]>([])
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<ComentarioTramite | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const stored = listarComentariosLocales(processId)
    const initialIds = new Set(initialComments.map((comment) => comment.id))
    setComments([...initialComments, ...stored.filter((comment) => !initialIds.has(comment.id))])
  }, [initialComments, processId])

  const submit = async () => {
    if (busy) return
    setBusy(true)
    try {
      const saved = onAdd
        ? await onAdd(draft, replyTo?.id ?? null)
        : guardarComentarioLocal(processId, actor, draft, replyTo?.id ?? null)
      setComments((current) => [...current, saved])
      setDraft('')
      setReplyTo(null)
      setError(null)
      setSuccess(onAdd ? 'Comentario agregado al ejemplo.' : 'Comentario guardado en este navegador.')
    } catch (err) {
      setSuccess(null)
      setError(err instanceof Error ? err.message : 'No se pudo guardar el comentario.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="space-y-4">
    <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Prototipo local: estos comentarios se guardan en este navegador y no se sincronizan con el servidor.</p>
    {canComment && <Card className="space-y-3">
      {replyTo && <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text-muted)]"><span>Respondiendo a {replyTo.usuarioNombre}: “{replyTo.texto}”</span><button type="button" onClick={() => setReplyTo(null)} className="font-semibold text-[var(--color-primary)]">Cancelar</button></div>}
      <label htmlFor="trace-comment" className="field-label">{replyTo ? 'Tu respuesta' : 'Nueva observación'}</label>
      <textarea id="trace-comment" className="field-input resize-y" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escribe una observación para el equipo del trámite…" rows={3} />
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {success && <p role="status" className="text-xs text-emerald-700">{success}</p>}
      <div className="flex justify-end"><Button onClick={() => void submit()} disabled={!draft.trim() || busy}><MessageSquare size={15} aria-hidden="true" />{busy ? 'Publicando…' : 'Publicar comentario'}</Button></div>
    </Card>}
    {comments.length === 0 ? <EmptyState icon={MessageSquare} title="Aún no hay comentarios" description="Las observaciones aparecerán en este hilo." /> : <ol className="space-y-3">{comments.map((comment) => <li key={comment.id}><Card className="space-y-2">
      {comment.respuestaA && <p className="rounded-lg bg-[var(--color-bg)] px-3 py-2 text-[11px] text-[var(--color-text-muted)]">Respuesta a {comments.find((parent) => parent.id === comment.respuestaA)?.usuarioNombre ?? 'un comentario'}: {comments.find((parent) => parent.id === comment.respuestaA)?.texto ?? 'comentario anterior'}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-[var(--color-text)]">{comment.usuarioNombre} <span className="font-normal text-[var(--color-text-muted)]">· {comment.rol}</span></p><time className="text-xs text-[var(--color-text-muted)]" dateTime={comment.fecha}>{formatRelativeDate(comment.fecha)}</time></div>
      <p className="whitespace-pre-wrap text-sm text-[var(--color-text)]">{comment.texto}</p>
      {canComment && <button type="button" onClick={() => setReplyTo(comment)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline"><Reply size={14} aria-hidden="true" /> Responder</button>}
    </Card></li>)}</ol>}
  </div>
}
