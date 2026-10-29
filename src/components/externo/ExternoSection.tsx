import { useEffect, useState } from 'react'
import { Card, Button, Badge , EmptyState} from '@/components/ui'
import { Select } from '@/components/ui/Input'
import { Globe2, PlusCircle, FileSignature } from 'lucide-react'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { externalApi, type ExternalEntityOut, type ExternalApprovalOut } from '@/services/external.service'
import { processesApi, type ProcessOut } from '@/services/processes.service'

export function ExternoSection() {
  const accessToken = useAppStore((s) => s.accessToken)
  const currentUser = useAppStore((s) => s.currentUser)
  const isAdmin = currentUser?.role === 'administrativo'

  const [entities, setEntities] = useState<ExternalEntityOut[]>([])
  const [selected, setSelected] = useState<ExternalEntityOut | null>(null)
  const [processes, setProcesses] = useState<ProcessOut[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showNewEntity, setShowNewEntity] = useState(false)
  const [entityForm, setEntityForm] = useState({ name: '', entity_type: '', representative: '', email: '' })
  const [isCreatingEntity, setIsCreatingEntity] = useState(false)

  const [approvalForm, setApprovalForm] = useState({
    processId: '',
    approvalDate: '',
    documentUrl: '',
    externalSigner: '',
    signerPosition: '',
    observations: '',
  })
  const [approvals, setApprovals] = useState<ExternalApprovalOut[]>([])
  const [isRegistering, setIsRegistering] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    setIsLoading(true)
    Promise.all([externalApi.listEntities(accessToken), processesApi.list(accessToken)])
      .then(([ents, procs]) => {
        setEntities(ents)
        setProcesses(procs)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las entidades'))
      .finally(() => setIsLoading(false))
  }, [accessToken])

  function selectEntity(entity: ExternalEntityOut) {
    setSelected(entity)
    setApprovals([])
    setActionError(null)
    setActionSuccess(null)
  }

  async function loadApprovalsForProcess(processId: string) {
    if (!accessToken || !processId) {
      setApprovals([])
      return
    }
    try {
      setApprovals(await externalApi.listProcessApprovals(accessToken, processId))
    } catch {
      setApprovals([])
    }
  }

  async function handleCreateEntity() {
    if (!accessToken || !entityForm.name.trim() || !entityForm.entity_type.trim()) {
      setActionError('Nombre y tipo de entidad son obligatorios.')
      return
    }
    setIsCreatingEntity(true)
    setActionError(null)
    try {
      const created = await externalApi.createEntity(accessToken, {
        name: entityForm.name.trim(),
        entity_type: entityForm.entity_type.trim(),
        representative: entityForm.representative.trim() || undefined,
        email: entityForm.email.trim() || undefined,
      })
      setEntities((prev) => [...prev, created])
      setShowNewEntity(false)
      setEntityForm({ name: '', entity_type: '', representative: '', email: '' })
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo crear la entidad')
    } finally {
      setIsCreatingEntity(false)
    }
  }

  async function handleRegisterApproval() {
    if (!accessToken || !selected) return
    if (!approvalForm.processId || !approvalForm.approvalDate || !approvalForm.documentUrl.trim() || !approvalForm.externalSigner.trim()) {
      setActionError('Completa trámite, fecha, URL del documento y firmante.')
      return
    }
    setIsRegistering(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await externalApi.registerApproval(accessToken, selected.public_id, {
        process_public_id: approvalForm.processId,
        approval_date: approvalForm.approvalDate,
        approval_document_url: approvalForm.documentUrl.trim(),
        external_signer: approvalForm.externalSigner.trim(),
        signer_position: approvalForm.signerPosition.trim() || undefined,
        observations: approvalForm.observations.trim() || undefined,
      })
      setActionSuccess('Aval externo registrado.')
      await loadApprovalsForProcess(approvalForm.processId)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo registrar el aval')
    } finally {
      setIsRegistering(false)
    }
  }

  if (isLoading) return <p className="text-[12.5px] text-[var(--color-text-dim)]">Cargando entidades…</p>
  if (error) return <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>

  return (
    <div className="animate-in grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
      <Card className="p-0 overflow-hidden h-fit">
        <div className="px-4 py-3.5 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe2 size={16} className="text-[var(--color-primary)]" />
            <h2 className="text-[18px] font-bold tracking-tight text-[var(--color-text)]">Entidades externas</h2>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowNewEntity((v) => !v)}
              className="text-[var(--color-primary)] bg-transparent border-none cursor-pointer"
              title="Nueva entidad"
            >
              <PlusCircle size={16} />
            </button>
          )}
        </div>

        {showNewEntity && (
          <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/50 flex flex-col gap-2">
            <input placeholder="Nombre" value={entityForm.name}
              onChange={(e) => setEntityForm((f) => ({ ...f, name: e.target.value }))} className="field-input" />
            <input placeholder="Tipo (empresa, comunidad, grupo…)" value={entityForm.entity_type}
              onChange={(e) => setEntityForm((f) => ({ ...f, entity_type: e.target.value }))} className="field-input" />
            <input placeholder="Representante (opcional)" value={entityForm.representative}
              onChange={(e) => setEntityForm((f) => ({ ...f, representative: e.target.value }))} className="field-input" />
            <Button size="sm" className="font-bold" onClick={handleCreateEntity} disabled={isCreatingEntity}>
              {isCreatingEntity ? 'Creando…' : 'Crear entidad'}
            </Button>
          </div>
        )}

        {entities.length === 0 ? (
          <EmptyState icon={Globe2} title="Aún no hay entidades externas" description="Las entidades registradas aparecerán aquí junto con sus aprobaciones." />
        ) : (
          <div className="p-2 flex flex-col gap-1">
            {entities.map((e) => (
              <button
                key={e.public_id}
                onClick={() => selectEntity(e)}
                className={`text-left px-3 py-2.5 rounded-lg cursor-pointer border-none transition-all ${
                  selected?.public_id === e.public_id
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-bg)]'
                }`}
              >
                <div className="text-[12.5px] font-bold">{e.name}</div>
                <div className={`text-[10.5px] ${selected?.public_id === e.public_id ? 'text-white/70' : 'text-[var(--color-text-dim)]'}`}>
                  {e.entity_type}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-4">
        {!selected ? (
          <Card>
            <p className="text-[12.5px] text-[var(--color-text-dim)]">
              Selecciona una entidad externa para ver o registrar avales.
            </p>
          </Card>
        ) : (
          <>
            <Card>
              <h3 className="text-[16px] font-bold text-[var(--color-text)] mb-1">{selected.name}</h3>
              <p className="text-[11.5px] text-[var(--color-text-dim)]">
                {selected.representative && <>Representante: {selected.representative} · </>}
                {selected.email && <>{selected.email}</>}
              </p>
            </Card>

            {isAdmin && (
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <FileSignature size={15} className="text-[var(--color-text-dim)]" />
                  <h3 className="text-[12px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Registrar aval externo
                  </h3>
                </div>

                {actionError && (
                  <p className="mb-3 text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{actionError}</p>
                )}
                {actionSuccess && (
                  <p className="mb-3 text-[12.5px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">{actionSuccess}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="sm:col-span-2">
                    <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Trámite</label>
                    <Select
                      value={approvalForm.processId}
                      onChange={(e) => {
                        setApprovalForm((f) => ({ ...f, processId: e.target.value }))
                        loadApprovalsForProcess(e.target.value)
                      }}
                      className="w-full"
                    >
                      <option value="">Selecciona un trámite…</option>
                      {processes.map((p) => (
                        <option key={p.public_id} value={p.public_id}>{p.process_code} — {p.student.full_name}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Fecha del aval</label>
                    <input type="date" value={approvalForm.approvalDate}
                      onChange={(e) => setApprovalForm((f) => ({ ...f, approvalDate: e.target.value }))}
                      className="field-input w-full" />
                  </div>
                  <div>
                    <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">URL del documento</label>
                    <input value={approvalForm.documentUrl}
                      onChange={(e) => setApprovalForm((f) => ({ ...f, documentUrl: e.target.value }))}
                      placeholder="https://…" className="field-input w-full" />
                  </div>
                  <div>
                    <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Firmante externo</label>
                    <input value={approvalForm.externalSigner}
                      onChange={(e) => setApprovalForm((f) => ({ ...f, externalSigner: e.target.value }))}
                      placeholder="Nombre de quien firma" className="field-input w-full" />
                  </div>
                  <div>
                    <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Cargo (opcional)</label>
                    <input value={approvalForm.signerPosition}
                      onChange={(e) => setApprovalForm((f) => ({ ...f, signerPosition: e.target.value }))}
                      className="field-input w-full" />
                  </div>
                </div>

                <Button size="sm" className="font-bold" onClick={handleRegisterApproval} disabled={isRegistering}>
                  {isRegistering ? 'Registrando…' : 'Registrar aval'}
                </Button>
              </Card>
            )}

            {approvalForm.processId && (
              <Card>
                <h4 className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
                  Avales externos de este trámite
                </h4>
                {approvals.length === 0 ? (
                  <p className="text-[12px] text-[var(--color-text-dim)]">Sin avales externos todavía.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {approvals.map((a) => (
                      <div key={a.public_id} className="flex items-center justify-between px-3 py-2.5 bg-[var(--color-bg)] rounded-lg">
                        <span className="text-[12px] text-[var(--color-text)]">{a.entity.name} · firma: {a.external_signer}</span>
                        <Badge variant="blue">{a.approval_date}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
