import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { Card, Button, EmptyState } from '@/components/ui'
import { StatusBadge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Input'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { modalitiesApi } from '@/services/modalities.service'
import { processesApi, type ProcessOut } from '@/services/processes.service'
import type { ModalityOut } from '@/types/api'

export function TramitesSection() {
  const navigate = useNavigate()
  const accessToken = useAppStore((s) => s.accessToken)
  const [processes, setProcesses] = useState<ProcessOut[]>([])
  const [modalities, setModalities] = useState<ModalityOut[]>([])
  const [selectedModality, setSelectedModality] = useState('todas')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)
    Promise.all([processesApi.list(accessToken), modalitiesApi.list(accessToken)])
      .then(([procs, mods]) => {
        setProcesses(procs)
        setModalities(mods)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los trámites'))
      .finally(() => setIsLoading(false))
  }, [accessToken])

  const filtered =
    selectedModality === 'todas'
      ? processes
      : processes.filter((p) => p.modality.public_id === selectedModality)

  return (
    <div className="animate-in">
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--color-border)] bg-[var(--color-bg)]/30 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-bold text-[var(--color-text)] tracking-tight">Todos los trámites</h2>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
              {isLoading ? (
                'Cargando…'
              ) : (
                <>
                  Actualmente hay <span className="font-bold text-[var(--color-primary)]">{processes.length} trámite{processes.length === 1 ? '' : 's'}</span> registrados.
                </>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <Select
              className="w-52"
              value={selectedModality}
              onChange={(e) => setSelectedModality(e.target.value)}
            >
              <option value="todas">Todas las modalidades</option>
              {modalities.map((m) => (
                <option key={m.public_id} value={m.public_id}>{m.name}</option>
              ))}
            </Select>
            <Button size="sm" className="font-bold">Exportar .xlsx</Button>
          </div>
        </div>

        {error && (
          <p className="mx-6 mt-4 text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <div className="overflow-x-auto scrollbar-premium">
          {isLoading ? (
            <p className="px-6 py-8 text-[12.5px] text-[var(--color-text-dim)]">Cargando trámites…</p>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={processes.length === 0 ? 'Aún no tienes trámites' : 'Sin resultados'}
              description={
                processes.length === 0
                  ? 'Cuando te postules a una oferta o inicies un trámite, aparecerá aquí con su estado y su trazabilidad.'
                  : 'No hay trámites que coincidan con este filtro. Prueba con otra modalidad.'
              }
            />
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Código', 'Estudiante', 'Modalidad', 'Semestre', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.public_id} className="group cursor-default">
                    <td className="td font-bold text-[var(--color-secondary)]">{p.process_code}</td>
                    <td className="td font-bold text-[var(--color-text)]">{p.student.full_name}</td>
                    <td className="td text-[var(--color-text-muted)]">{p.modality.name}</td>
                    <td className="td text-[var(--color-text-muted)]">{p.academic_semester}</td>
                    <td className="td"><StatusBadge status={p.state.code} /></td>
                    <td className="td text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-bold"
                        onClick={() => navigate(`/trazabilidad/${p.public_id}`)}
                      >
                        Ver detalle
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}
