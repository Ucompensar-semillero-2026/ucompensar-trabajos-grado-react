import { useEffect, useState } from 'react'
import { Card, Button, Badge , EmptyState} from '@/components/ui'
import { Select } from '@/components/ui/Input'
import { Building2, UserCog, Stamp } from 'lucide-react'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import {
  administrativeApi,
  type AdministrativeAreaOut,
  type AreaUserOut,
  type AdministrativeApprovalOut,
  type AdministrativeApprovalResult,
} from '@/services/administrative.service'
import { processesApi, type ProcessOut } from '@/services/processes.service'

const RESULTS: { value: AdministrativeApprovalResult; label: string }[] = [
  { value: 'APROBADO', label: 'Aprobado' },
  { value: 'RECHAZADO', label: 'Rechazado' },
  { value: 'OBSERVADO', label: 'Observado' },
]

export function AdministrativoSection() {
  const accessToken = useAppStore((s) => s.accessToken)
  const currentUser = useAppStore((s) => s.currentUser)
  const isAdmin = currentUser?.role === 'administrativo'

  const [areas, setAreas] = useState<AdministrativeAreaOut[]>([])
  const [selected, setSelected] = useState<AdministrativeAreaOut | null>(null)
  const [areaUsers, setAreaUsers] = useState<AreaUserOut[]>([])
  const [processes, setProcesses] = useState<ProcessOut[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    processId: '',
    result: 'APROBADO' as AdministrativeApprovalResult,
    observations: '',
  })
  const [approvals, setApprovals] = useState<AdministrativeApprovalOut[]>([])
  const [isSigning, setIsSigning] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const [signSuccess, setSignSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    setIsLoading(true)
    Promise.all([administrativeApi.listAreas(accessToken), processesApi.list(accessToken)])
      .then(([areasData, procsData]) => {
        setAreas(areasData)
        setProcesses(procsData)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las áreas'))
      .finally(() => setIsLoading(false))
  }, [accessToken])

  function selectArea(area: AdministrativeAreaOut) {
    setSelected(area)
    setApprovals([])
    setSignError(null)
    setSignSuccess(null)
    if (isAdmin && accessToken) {
      administrativeApi.listAreaUsers(accessToken, area.public_id).then(setAreaUsers).catch(() => setAreaUsers([]))
    } else {
      setAreaUsers([])
    }
  }

  async function loadApprovalsForProcess(processId: string) {
    if (!accessToken || !processId) {
      setApprovals([])
      return
    }
    try {
      const data = await administrativeApi.listProcessApprovals(accessToken, processId)
      setApprovals(data)
    } catch {
      setApprovals([])
    }
  }

  async function handleSign() {
    if (!accessToken || !selected || !form.processId) {
      setSignError('Selecciona un trámite.')
      return
    }
    setIsSigning(true)
    setSignError(null)
    setSignSuccess(null)
    try {
      await administrativeApi.signApproval(accessToken, selected.public_id, {
        process_public_id: form.processId,
        result: form.result,
        observations: form.observations.trim() || undefined,
      })
      setSignSuccess('Aval registrado correctamente.')
      await loadApprovalsForProcess(form.processId)
    } catch (err) {
      // Sin require_role fijo -- si esta cuenta no tiene can_sign_approvals
      // en esta área, el backend lo rechaza acá, no antes.
      setSignError(err instanceof ApiError ? err.message : 'No se pudo firmar el aval')
    } finally {
      setIsSigning(false)
    }
  }

  if (isLoading) return <p className="text-[12.5px] text-[var(--color-text-dim)]">Cargando áreas…</p>
  if (error) return <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>

  return (
    <div className="animate-in grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <Card className="p-0 overflow-hidden h-fit">
        <div className="px-4 py-3.5 border-b border-[var(--color-border)] flex items-center gap-2">
          <Building2 size={16} className="text-[var(--color-primary)]" />
          <h2 className="text-[18px] font-bold tracking-tight text-[var(--color-text)]">Áreas administrativas</h2>
        </div>
        {areas.length === 0 ? (
          <EmptyState icon={Building2} title="Aún no hay áreas administrativas" description="Las áreas registradas aparecerán aquí junto con sus revisiones." />
        ) : (
          <div className="p-2 flex flex-col gap-1">
            {areas.map((a) => (
              <button
                key={a.public_id}
                onClick={() => selectArea(a)}
                className={`text-left px-3 py-2.5 rounded-lg cursor-pointer border-none transition-all ${
                  selected?.public_id === a.public_id
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-bg)]'
                }`}
              >
                <div className="text-[12.5px] font-bold">{a.name}</div>
                {a.manager && (
                  <div className={`text-[10.5px] ${selected?.public_id === a.public_id ? 'text-white/70' : 'text-[var(--color-text-dim)]'}`}>
                    Responsable: {a.manager.full_name}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-4">
        {!selected ? (
          <Card>
            <p className="text-[12.5px] text-[var(--color-text-dim)]">
              Selecciona un área para firmar avales sobre trámites.
            </p>
          </Card>
        ) : (
          <>
            {isAdmin && (
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <UserCog size={15} className="text-[var(--color-text-dim)]" />
                  <h3 className="text-[12px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Usuarios con firma en {selected.name}
                  </h3>
                </div>
                {areaUsers.length === 0 ? (
                  <p className="text-[12px] text-[var(--color-text-dim)]">Nadie tiene permiso de firma en esta área todavía.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {areaUsers.map((u) => (
                      <div key={u.public_id} className="flex items-center justify-between px-3 py-2 bg-[var(--color-bg)] rounded-lg">
                        <span className="text-[12.5px] font-medium text-[var(--color-text)]">{u.user.full_name}</span>
                        {u.can_sign_approvals ? <Badge variant="green">Puede firmar</Badge> : <Badge variant="gray">Sin firma</Badge>}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Stamp size={15} className="text-[var(--color-text-dim)]" />
                <h3 className="text-[12px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
                  Firmar aval de {selected.name}
                </h3>
              </div>

              {signError && (
                <p className="mb-3 text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{signError}</p>
              )}
              {signSuccess && (
                <p className="mb-3 text-[12.5px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">{signSuccess}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="sm:col-span-2">
                  <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Trámite</label>
                  <Select
                    value={form.processId}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, processId: e.target.value }))
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
                  <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Resultado</label>
                  <Select
                    value={form.result}
                    onChange={(e) => setForm((f) => ({ ...f, result: e.target.value as AdministrativeApprovalResult }))}
                    className="w-full"
                  >
                    {RESULTS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Observaciones (opcional)</label>
                  <input
                    value={form.observations}
                    onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
                    className="field-input w-full"
                  />
                </div>
              </div>

              <Button size="sm" className="font-bold" onClick={handleSign} disabled={isSigning}>
                {isSigning ? 'Firmando…' : 'Firmar aval'}
              </Button>
            </Card>

            {form.processId && (
              <Card>
                <h4 className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
                  Avales registrados para este trámite
                </h4>
                {approvals.length === 0 ? (
                  <p className="text-[12px] text-[var(--color-text-dim)]">Sin avales todavía.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {approvals.map((a) => (
                      <div key={a.public_id} className="flex items-center justify-between px-3 py-2.5 bg-[var(--color-bg)] rounded-lg">
                        <span className="text-[12px] text-[var(--color-text)]">{a.signed_by.full_name}</span>
                        <Badge variant={a.result === 'APROBADO' ? 'green' : a.result === 'RECHAZADO' ? 'red' : 'orange'}>
                          {a.result}
                        </Badge>
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
