import { useEffect, useState } from 'react'
import { Card, Button, Badge } from '@/components/ui'
import { Select } from '@/components/ui/Input'
import { GraduationCap, Award } from 'lucide-react'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { gradingApi, type GradeOut, type FinalGradeOut, type MentionType } from '@/services/grading.service'
import { modalitiesApi, type EvaluationCriterionOut } from '@/services/modalities.service'
import { processesApi, type ProcessOut } from '@/services/processes.service'

const CAN_REGISTER_FINAL = ['coordinador', 'consejo_facultad', 'administrativo']

export function CalificacionesSection() {
  const accessToken = useAppStore((s) => s.accessToken)
  const currentUser = useAppStore((s) => s.currentUser)
  const canRegisterFinal = currentUser ? CAN_REGISTER_FINAL.includes(currentUser.role) : false

  const [processes, setProcesses] = useState<ProcessOut[]>([])
  const [processId, setProcessId] = useState('')
  const [criteria, setCriteria] = useState<EvaluationCriterionOut[]>([])
  const [grades, setGrades] = useState<GradeOut[]>([])
  const [finalGrade, setFinalGrade] = useState<FinalGradeOut | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [gradeForm, setGradeForm] = useState({ criterionId: '', grade: '', observation: '' })
  const [finalForm, setFinalForm] = useState({ finalGrade: '', councilMinutes: '', honorMention: '' as '' | MentionType })
  const [isSubmittingGrade, setIsSubmittingGrade] = useState(false)
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    processesApi
      .list(accessToken)
      .then(setProcesses)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los trámites'))
      .finally(() => setIsLoading(false))
  }, [accessToken])

  async function selectProcess(id: string) {
    setProcessId(id)
    setActionError(null)
    setFinalGrade(null)
    setCriteria([])
    setGrades([])
    if (!accessToken || !id) return

    const process = processes.find((p) => p.public_id === id)
    if (!process) return

    try {
      const [modalityDetail, gradesData] = await Promise.all([
        modalitiesApi.get(accessToken, process.modality.public_id),
        gradingApi.listGrades(accessToken, id),
      ])
      setCriteria(modalityDetail.criteria)
      setGrades(gradesData)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudieron cargar los criterios')
    }

    try {
      setFinalGrade(await gradingApi.getFinalGrade(accessToken, id))
    } catch {
      setFinalGrade(null) // aun no tiene calificacion final registrada
    }
  }

  async function handleAddGrade() {
    if (!accessToken || !processId || !gradeForm.criterionId || !gradeForm.grade) {
      setActionError('Selecciona un criterio y escribe la nota.')
      return
    }
    setIsSubmittingGrade(true)
    setActionError(null)
    try {
      await gradingApi.addGrade(accessToken, processId, {
        criterion_public_id: gradeForm.criterionId,
        grade: Number(gradeForm.grade),
        observation: gradeForm.observation.trim() || undefined,
      })
      setGrades(await gradingApi.listGrades(accessToken, processId))
      setGradeForm({ criterionId: '', grade: '', observation: '' })
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo registrar la calificación')
    } finally {
      setIsSubmittingGrade(false)
    }
  }

  async function handleRegisterFinal() {
    if (!accessToken || !processId || !finalForm.finalGrade) {
      setActionError('Escribe la nota final.')
      return
    }
    setIsSubmittingFinal(true)
    setActionError(null)
    try {
      const result = await gradingApi.registerFinalGrade(accessToken, processId, {
        final_grade: Number(finalForm.finalGrade),
        council_minutes: finalForm.councilMinutes.trim() || undefined,
        honor_mention: finalForm.honorMention || undefined,
      })
      setFinalGrade(result)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo registrar la calificación final')
    } finally {
      setIsSubmittingFinal(false)
    }
  }

  if (isLoading) return <p className="text-[12.5px] text-[var(--color-text-dim)]">Cargando…</p>
  if (error) return <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>

  return (
    <div className="animate-in flex flex-col gap-4 max-w-[900px]">
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap size={16} className="text-[var(--color-primary)]" />
          <h2 className="text-[18px] font-bold tracking-tight text-[var(--color-text)]">Calificaciones</h2>
        </div>
        <Select value={processId} onChange={(e) => selectProcess(e.target.value)} className="w-full">
          <option value="">Selecciona un trámite…</option>
          {processes.map((p) => (
            <option key={p.public_id} value={p.public_id}>{p.process_code} — {p.student.full_name} ({p.modality.name})</option>
          ))}
        </Select>
      </Card>

      {processId && (
        <>
          {actionError && (
            <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{actionError}</p>
          )}

          <Card>
            <h3 className="text-[12px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">
              Registrar nota por criterio
            </h3>
            {criteria.length === 0 ? (
              <p className="text-[12px] text-[var(--color-text-dim)]">Esta modalidad no tiene criterios de evaluación configurados.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_1fr_auto] gap-2 items-end mb-4">
                <div>
                  <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Criterio</label>
                  <Select value={gradeForm.criterionId} onChange={(e) => setGradeForm((f) => ({ ...f, criterionId: e.target.value }))} className="w-full">
                    <option value="">Selecciona…</option>
                    {criteria.map((c) => (
                      <option key={c.public_id} value={c.public_id}>{c.name} ({c.weight_percentage}%)</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Nota (0-5)</label>
                  <input type="number" min={0} max={5} step={0.1} value={gradeForm.grade}
                    onChange={(e) => setGradeForm((f) => ({ ...f, grade: e.target.value }))} className="field-input w-full" />
                </div>
                <div>
                  <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Observación (opcional)</label>
                  <input value={gradeForm.observation}
                    onChange={(e) => setGradeForm((f) => ({ ...f, observation: e.target.value }))} className="field-input w-full" />
                </div>
                <Button size="sm" className="font-bold" onClick={handleAddGrade} disabled={isSubmittingGrade}>
                  {isSubmittingGrade ? 'Guardando…' : 'Registrar'}
                </Button>
              </div>
            )}

            {grades.length > 0 && (
              <div className="flex flex-col gap-2 pt-3 border-t border-[var(--color-border)]">
                {grades.map((g) => (
                  <div key={g.public_id} className="flex items-center justify-between px-3 py-2 bg-[var(--color-bg)] rounded-lg">
                    <span className="text-[12px] font-medium text-[var(--color-text)]">{g.criterion.name}</span>
                    <span className="text-[11px] text-[var(--color-text-dim)]">{g.evaluator.full_name}</span>
                    <Badge variant={Number(g.grade) >= 3.5 ? 'green' : 'red'}>{g.grade}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {canRegisterFinal && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Award size={15} className="text-[var(--color-text-dim)]" />
                <h3 className="text-[12px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">Calificación final</h3>
              </div>

              {finalGrade ? (
                <div className="flex items-center gap-3">
                  <Badge variant={finalGrade.passed ? 'green' : 'red'}>
                    {finalGrade.final_grade} — {finalGrade.passed ? 'Aprobado' : 'No aprobado'}
                  </Badge>
                  {finalGrade.honor_mention && <Badge variant="blue">{finalGrade.honor_mention}</Badge>}
                  <span className="text-[11.5px] text-[var(--color-text-dim)]">Registrada por {finalGrade.registered_by.full_name}</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Nota final (0-5)</label>
                    <input type="number" min={0} max={5} step={0.1} value={finalForm.finalGrade}
                      onChange={(e) => setFinalForm((f) => ({ ...f, finalGrade: e.target.value }))} className="field-input w-full" />
                  </div>
                  <div>
                    <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Acta del consejo (opcional)</label>
                    <input value={finalForm.councilMinutes}
                      onChange={(e) => setFinalForm((f) => ({ ...f, councilMinutes: e.target.value }))} className="field-input w-full" />
                  </div>
                  <div>
                    <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Mención (opcional)</label>
                    <Select value={finalForm.honorMention} onChange={(e) => setFinalForm((f) => ({ ...f, honorMention: e.target.value as MentionType | '' }))} className="w-full">
                      <option value="">Sin mención</option>
                      <option value="MERITORIO">Meritorio</option>
                      <option value="LAUREADO">Laureado</option>
                    </Select>
                  </div>
                  <div className="sm:col-span-3">
                    <Button size="sm" className="font-bold" onClick={handleRegisterFinal} disabled={isSubmittingFinal}>
                      {isSubmittingFinal ? 'Registrando…' : 'Registrar calificación final'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
