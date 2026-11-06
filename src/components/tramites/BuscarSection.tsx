import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Badge } from '@/components/ui'
import { StatusBadge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { processesApi, type ProcessOut } from '@/services/processes.service'
import { getInitials } from '@/utils/format'

export function BuscarSection() {
  const navigate = useNavigate()
  const accessToken = useAppStore((s) => s.accessToken)
  const [query, setQuery] = useState('')
  const [processes, setProcesses] = useState<ProcessOut[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    processesApi
      .list(accessToken)
      .then(setProcesses)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los trámites'))
      .finally(() => setIsLoading(false))
  }, [accessToken])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return processes
    return processes.filter(
      (p) =>
        p.student.full_name.toLowerCase().includes(q) ||
        p.student.email.toLowerCase().includes(q) ||
        p.process_code.toLowerCase().includes(q)
    )
  }, [processes, query])

  return (
    <div className="animate-fade-in max-w-[480px] space-y-3">
      <Card>
        <h3 className="text-[12.5px] font-bold text-neutral-text mb-3">
          Buscar trámite
        </h3>
        <Input
          className="w-full"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre, correo o código de trámite…"
        />
      </Card>

      {error && (
        <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-[12.5px] text-[var(--color-text-dim)] px-1">Cargando…</p>
      ) : results.length === 0 ? (
        <p className="text-[12.5px] text-[var(--color-text-dim)] px-1">
          {query ? 'Sin resultados para esta búsqueda.' : 'No hay trámites registrados.'}
        </p>
      ) : (
        results.map((p) => (
          <Card key={p.public_id}>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-neutral-border">
              <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center text-[13px] font-bold text-primary">
                {getInitials(p.student.full_name)}
              </div>
              <div>
                <div className="text-[13.5px] font-bold">{p.student.full_name}</div>
                <div className="text-[10.5px] text-neutral-muted">
                  {p.student.email} · {p.academic_semester}
                </div>
              </div>
              <Badge variant={p.state.is_final_state ? 'gray' : 'green'} className="ml-auto">
                {p.state.is_final_state ? 'Cerrado' : 'Activo'}
              </Badge>
            </div>

            <div className="flex items-center justify-between px-3 py-2.5 bg-neutral-bg rounded-lg border-l-[3px] border-l-primary">
              <div>
                <div className="text-[12px] font-semibold">{p.modality.name}</div>
                <div className="text-[10px] text-neutral-muted">{p.process_code}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusBadge status={p.state.code} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/trazabilidad/${p.public_id}`)}
                >
                  Ver
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}