import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { LoadError } from '@/components/tutor/tutorUi'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { monitoringApi, type AlertSettings, type AlertSettingsInput } from '@/services/monitoring.service'

const fieldClass = 'w-28 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] outline-none focus:border-[#0876B9]'

/** Mismo orden lógico que valida el backend (que sigue siendo la autoridad). */
export function thresholdProblem(a: number, m: number, c: number): string | null {
  if (!Number.isInteger(a) || a < 1) return 'La atención inicial debe ser al menos 1 tarea vencida.'
  if (m <= a) return 'El riesgo moderado debe requerir más tareas vencidas que la atención inicial.'
  if (c <= m) return 'El riesgo crítico debe requerir más tareas vencidas que el riesgo moderado.'
  return null
}

/** Configuración de alertas (solo Coordinación; el backend rechaza a cualquier otro rol). */
export function TaskAlertSettings() {
  const accessToken = useAppStore((s) => s.accessToken)
  const [settings, setSettings] = useState<AlertSettings | null>(null)
  const [form, setForm] = useState<AlertSettingsInput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    if (!accessToken) return
    monitoringApi.settings(accessToken).then((s) => { setSettings(s); setForm({ ...s }) }).catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la configuración.'))
  }, [accessToken])
  useEffect(load, [load])

  if (error && !form) return <LoadError message={error} onRetry={() => { setError(null); load() }} />
  if (!form || !settings) return <p role="status" className="text-[13px] text-[var(--color-text-muted)]">Cargando configuración…</p>

  const set = <K extends keyof AlertSettingsInput>(key: K, value: AlertSettingsInput[K]) => setForm((f) => (f ? { ...f, [key]: value } : f))
  const problem = thresholdProblem(form.attention_threshold, form.moderate_threshold, form.critical_threshold)

  const save = async () => {
    if (!accessToken || saving || problem) return
    setSaving(true); setError(null); setNotice(null)
    try {
      const saved = await monitoringApi.updateSettings(accessToken, form)
      setSettings(saved); setForm({ ...saved }); setNotice('Configuración guardada.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la configuración.')
    } finally { setSaving(false) }
  }

  const num = (key: 'attention_threshold' | 'moderate_threshold' | 'critical_threshold' | 'warning_days', label: string, hint: string) => (
    <div>
      <label htmlFor={`cfg-${key}`} className="mb-1 block text-[12px] font-bold text-[var(--color-secondary)]">{label}</label>
      <input id={`cfg-${key}`} type="number" min={key === 'warning_days' ? 0 : 1} className={fieldClass} value={form[key]} onChange={(e) => set(key, Number(e.target.value))} />
      <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">{hint}</p>
    </div>
  )

  return (
    <div className="space-y-5">
      <Link to="/seguimiento" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#0876B9] hover:underline"><ArrowLeft size={15} aria-hidden="true" />Volver a seguimiento y alertas</Link>
      <Card className="p-5">
        <form noValidate className="grid gap-5" onSubmit={(e) => { e.preventDefault(); void save() }}>
          <p className="text-[13px] text-[var(--color-text-muted)]">Los umbrales cambian cuántas tareas vencidas activan cada nivel; los colores y su significado no se modifican. Los cambios se aplican sin desplegar y quedan auditados.</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {num('attention_threshold', 'Atención inicial (tareas vencidas)', 'Nivel azul')}
            {num('moderate_threshold', 'Riesgo moderado (tareas vencidas)', 'Nivel amarillo')}
            {num('critical_threshold', 'Riesgo crítico (tareas vencidas)', 'Nivel rojo')}
            {num('warning_days', 'Días para advertir vencimiento', 'Días calendario antes de la fecha límite')}
          </div>
          <div className="grid gap-2 text-[13px]">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.group_escalation_default} onChange={(e) => set('group_escalation_default', e.target.checked)} />Escalamiento grupal activado por defecto en las tareas nuevas</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.notifications_enabled} onChange={(e) => set('notifications_enabled', e.target.checked)} />Enviar notificaciones de incumplimiento y alertas</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.commitment_tracking_enabled} onChange={(e) => set('commitment_tracking_enabled', e.target.checked)} />Seguimiento de compromisos académicos</label>
          </div>
          <p className="text-[12.5px] text-[var(--color-text-muted)]">Zona horaria institucional: <strong>{settings.timezone}</strong></p>
          {problem && <p role="alert" className="text-[13px] font-medium text-red-700">{problem}</p>}
          {error && <p role="alert" className="text-[13px] font-medium text-red-700">{error}</p>}
          {notice && <p role="status" className="text-[13px] font-medium text-green-800">{notice}</p>}
          <div><Button type="submit" disabled={saving || Boolean(problem)}>{saving ? 'Guardando…' : 'Guardar configuración'}</Button></div>
        </form>
      </Card>
      {settings.history.length > 0 && (
        <Card className="p-5"><h3 className="mb-2 font-display text-[16px] font-bold text-[var(--color-secondary)]">Historial de cambios</h3>
          <ul className="space-y-1 text-[12.5px] text-[var(--color-text-muted)]">{settings.history.map((h) => <li key={h}>{h}</li>)}</ul></Card>
      )}
    </div>
  )
}
