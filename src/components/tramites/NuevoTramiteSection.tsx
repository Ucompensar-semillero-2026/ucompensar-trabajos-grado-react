import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Badge } from '@/components/ui'
import { Select } from '@/components/ui/Input'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { modalitiesApi, type RequiredDocumentOut } from '@/services/modalities.service'
import { processesApi } from '@/services/processes.service'
import type { ModalityOut } from '@/types/api'
import { PlusCircle } from 'lucide-react'
import { hasModule } from '@/config/access'
import { roleLabels } from '@/config/roles'

export function NuevoTramiteSection() {
  const navigate = useNavigate()
  const accessToken = useAppStore((s) => s.accessToken)
  const currentUser = useAppStore((s) => s.currentUser)

  const [modalities, setModalities] = useState<ModalityOut[]>([])
  const [modalityId, setModalityId] = useState('')
  const [academicSemester, setAcademicSemester] = useState('')
  const [observations, setObservations] = useState('')
  const [requiredDocs, setRequiredDocs] = useState<RequiredDocumentOut[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    modalitiesApi
      .list(accessToken)
      .then((mods) => {
        setModalities(mods)
        if (mods.length > 0) setModalityId(mods[0].public_id)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las modalidades'))
      .finally(() => setIsLoading(false))
  }, [accessToken])

  useEffect(() => {
    if (!accessToken || !modalityId) return
    modalitiesApi
      .get(accessToken, modalityId)
      .then((detail) => setRequiredDocs(detail.required_documents))
      .catch(() => setRequiredDocs([]))
  }, [accessToken, modalityId])

  const handleSubmit = async () => {
    if (!accessToken || !modalityId || !academicSemester.trim()) {
      setError('Selecciona una modalidad y escribe el semestre académico.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const process = await processesApi.create(accessToken, {
        modality_public_id: modalityId,
        academic_semester: academicSemester.trim(),
        observations: observations.trim() || undefined,
      })
      navigate(`/trazabilidad/${process.public_id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo radicar el trámite')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (currentUser && !hasModule(currentUser, 'nuevo')) {
    return (
      <div className="max-w-[700px]">
        <p className="text-sm text-[var(--color-text-dim)]">
          Solo los estudiantes pueden radicar un nuevo trámite. Tu cuenta es de <strong>{roleLabels(currentUser.roles).join(', ')}</strong>.
        </p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-4 max-w-[700px]">
      <Card>
        <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] -mx-4 -mt-4 mb-6 px-5 py-4 rounded-t-xl flex items-center gap-2.5 shadow-md">
          <PlusCircle size={18} stroke="white" />
          <span className="text-[14px] font-bold text-white tracking-tight">
            Radicar nuevo trámite
          </span>
        </div>

        {error && (
          <p className="mb-4 text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <div className="mb-6 pb-6 border-b border-neutral-border">
          <h3 className="text-[11px] font-bold text-neutral-muted uppercase tracking-wide mb-3.5">
            Modalidad
          </h3>
          {isLoading ? (
            <p className="text-[12.5px] text-[var(--color-text-dim)]">Cargando modalidades…</p>
          ) : (
            <Select
              value={modalityId}
              onChange={(e) => setModalityId(e.target.value)}
              className="w-full"
            >
              {modalities.map((m) => (
                <option key={m.public_id} value={m.public_id}>{m.name}</option>
              ))}
            </Select>
          )}
        </div>

        <div className="mb-6 pb-6 border-b border-neutral-border">
          <h3 className="text-[11px] font-bold text-neutral-muted uppercase tracking-wide mb-3.5">
            Información académica
          </h3>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">
                Semestre académico
              </label>
              <input
                value={academicSemester}
                onChange={(e) => setAcademicSemester(e.target.value)}
                placeholder="ej. 2026-2"
                maxLength={10}
                className="field-input w-full"
              />
            </div>
            <div>
              <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">
                Observaciones (opcional)
              </label>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={2}
                className="field-input resize-none w-full"
              />
            </div>
          </div>
        </div>

        {/* Required documents preview -- lo que exige la modalidad seleccionada */}
        <div className="mb-6">
          <h3 className="text-[11px] font-bold text-neutral-muted uppercase tracking-wide mb-3.5">
            Documentos que necesitarás cargar
          </h3>
          {requiredDocs.length === 0 ? (
            <p className="text-[12px] text-[var(--color-text-dim)]">
              Esta modalidad no tiene documentos requeridos configurados todavía.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {requiredDocs.map((doc) => (
                <div
                  key={doc.public_id}
                  className="flex items-center justify-between px-4 py-3 bg-neutral-bg rounded-xl border-l-[4px] border-l-[var(--color-border)]"
                >
                  <span className="text-[12px] font-medium text-neutral-text">{doc.document_type.name}</span>
                  {doc.mandatory ? <Badge variant="orange">Obligatorio</Badge> : <Badge variant="gray">Opcional</Badge>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t border-neutral-border">
          <Button size="md" className="font-bold" onClick={handleSubmit} disabled={isSubmitting || isLoading}>
            {isSubmitting ? 'Radicando…' : 'Radicar trámite →'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
