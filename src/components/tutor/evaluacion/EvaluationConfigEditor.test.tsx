import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import { modulesFor } from '@/test/users'
import { criterion, evaluation, moment, totals } from '@/test/evaluationFixtures'
import type { User } from '@/types'
import type { EvaluationConfigPayload, EvaluationOut } from '@/services/evaluation.service'

vi.mock('@/services/evaluation.service', () => ({ evaluationApi: { saveConfig: vi.fn(), publish: vi.fn(), unpublish: vi.fn() } }))

import { evaluationApi } from '@/services/evaluation.service'
import { EvaluationConfigEditor } from './EvaluationConfigEditor'

const tutor: User = { id: 't1', name: 'Tutor Uno', initials: 'TU', email: 't@ucompensar.edu.co', roles: ['docente'], modules: modulesFor(['docente']) }

const manager = (over: Partial<EvaluationOut> = {}): EvaluationOut => evaluation({ viewer: 'manager', can_configure: true, can_grade: true, published_totals: totals(), ...over })

/** Lo que devolvería el backend al guardar: la misma estructura, ahora con identificadores. */
function fromPayload(payload: EvaluationConfigPayload, status: 'borrador' | 'publicada'): EvaluationOut {
  return manager({
    status,
    moments: payload.moments.map((m, i) =>
      moment(`m${i + 1}`, m.name, m.weight_percentage, m.criteria.map((c, j) => criterion(`c${i + 1}${j + 1}`, c.name, c.weight_percentage, { status: 'sin_calificar', description: c.description ?? null, deliverable_public_id: c.deliverable_public_id ?? null })), { description: m.description ?? null })
    ),
  })
}

const unconfigured = () => manager({ status: 'sin_configurar', moments: [] })

/** Evaluación ya guardada como borrador: cada momento con un entregable del plan asociado («Propuesta inicial» y «Antecedentes»). */
const saved = (over: Partial<EvaluationOut> = {}) =>
  manager({
    status: 'borrador',
    moments: [
      moment('m1', 'Contextualización', 20, [criterion('c1', 'Trabajo escrito', 100, { status: 'sin_calificar', deliverable_public_id: 'd1' })]),
      moment('m2', 'Profundización', 80, [criterion('c2', 'Prototipo', 100, { status: 'sin_calificar', deliverable_public_id: 'd2' })]),
    ],
    ...over,
  })

/** Entregables cuyo nombre no coincide con la plantilla sugerida: con ellos «sin configurar» arranca sin filas. */
const NEUTRAL = [{ value: 'd1', label: 'Entregable A' }, { value: 'd2', label: 'Entregable B' }, { value: 'd3', label: 'Entregable C' }]
const DELIVERABLES = [{ value: 'd1', label: 'Propuesta inicial' }, { value: 'd2', label: 'Antecedentes' }, { value: 'd3', label: 'Metodología' }]

function Harness({ initial, deliverables = DELIVERABLES }: { initial: EvaluationOut; deliverables?: Array<{ value: string; label: string }> }) {
  const [report, setReport] = useState(initial)
  return <EvaluationConfigEditor processId="p1" report={report} deliverables={deliverables} onReport={setReport} />
}

const setup = () => userEvent.setup()
const type = async (user: ReturnType<typeof userEvent.setup>, label: string, value: string) => {
  const field = screen.getByLabelText(label)
  await user.clear(field)
  await user.type(field, value)
}
const status = () => within(screen.getByRole('status', { name: 'Estado de la configuración' }))
const summary = () => within(screen.getByRole('group', { name: 'Resumen de la configuración' }))
/** Valor (arriba) de un indicador de la tarjeta resumen, buscándolo por su etiqueta (abajo). */
const stat = (label: string) => summary().getByText(label).previousElementSibling
const bar = () => screen.getByRole('img', { name: /^Distribución de la evaluación:/ })

let lastPayload: EvaluationConfigPayload | null = null

beforeEach(() => {
  useAppStore.setState({ currentUser: tutor, isAuthenticated: true, accessToken: 'token' })
  lastPayload = null
  vi.mocked(evaluationApi.saveConfig).mockImplementation(async (_t, _p, payload) => {
    lastPayload = payload
    return fromPayload(payload, 'borrador')
  })
  vi.mocked(evaluationApi.publish).mockImplementation(async () => fromPayload(lastPayload as EvaluationConfigPayload, 'publicada'))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
})

describe('primera entrada: distribución sugerida', () => {
  it('shows the 3 suggested moments (20 % · 35 % · 45 %) with their descriptions, adding up to 100 %, without saving anything by itself', async () => {
    render(<Harness initial={unconfigured()} deliverables={[]} />)

    for (const [n, name, weight, description] of [
      [1, 'Contextualización', '20', 'Corresponde a la formulación del proyecto y definición del problema.'],
      [2, 'Profundización', '35', 'Desarrollo del marco teórico, metodología y plan de trabajo.'],
      [3, 'Transferencia y cierre', '45', 'Resultados, documento final y sustentación del proyecto.'],
    ] as const) {
      expect(screen.getByLabelText(`Nombre del momento ${n}`)).toHaveValue(name)
      expect(screen.getByLabelText(`Porcentaje del momento ${n}`)).toHaveValue(Number(weight))
      expect(screen.getByLabelText(`Descripción del momento ${n}`)).toHaveValue(description)
    }
    expect(screen.getByText('Momento 1 ·')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(
      'Se ha cargado la distribución sugerida de UCompensar Virtual (20 % - 35 % - 45 %). Puedes editar los nombres, porcentajes, criterios, asignar o modificar entregables, agregar o eliminar momentos. El porcentaje total de los momentos debe ser 100 % para publicar la evaluación.'
    )

    expect(screen.getByText('Detección de fallas')).toBeInTheDocument() // nombre real del proyecto (no uno de ejemplo)
    expect(screen.getByText(/Periodo académico 2026-2 \| Estudiante: Ana Estudiante/)).toBeInTheDocument()
    expect(stat('momentos evaluativos')).toHaveTextContent('3')
    expect(stat('distribuido')).toHaveTextContent('100 %')
    expect(stat('criterios configurados')).toHaveTextContent('0')
    expect(stat('editable')).toHaveTextContent('Borrador')
    expect(status().getByText('Los momentos suman 100 %. Puedes guardar la configuración.')).toBeInTheDocument()
    expect(status().getByText('El momento 1 no tiene criterios.')).toBeInTheDocument() // los criterios no se inventan

    expect(screen.getByRole('button', { name: 'Publicar evaluación' })).toBeDisabled() // sin criterios no se publica
    expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeEnabled()
    expect(evaluationApi.saveConfig).not.toHaveBeenCalled() // nada se escribe en el backend hasta que el docente guarda
  })

  it('can be used as it is: it is saved with exactly those three moments and then the suggestion message gives way to the draft one', async () => {
    const user = setup()
    render(<Harness initial={unconfigured()} deliverables={[]} />)

    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }))
    expect(evaluationApi.saveConfig).toHaveBeenCalledWith('token', 'p1', {
      moments: [
        { public_id: null, name: 'Contextualización', description: 'Corresponde a la formulación del proyecto y definición del problema.', weight_percentage: 20, criteria: [] },
        { public_id: null, name: 'Profundización', description: 'Desarrollo del marco teórico, metodología y plan de trabajo.', weight_percentage: 35, criteria: [] },
        { public_id: null, name: 'Transferencia y cierre', description: 'Resultados, documento final y sustentación del proyecto.', weight_percentage: 45, criteria: [] },
      ],
    })
    expect(await screen.findByText('Guardado correctamente.')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Configuración guardada como borrador')
    expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled()
  })

  it('keeps every moment fully editable: name, percentage and description', async () => {
    const user = setup()
    render(<Harness initial={unconfigured()} deliverables={[]} />)

    await type(user, 'Nombre del momento 1', 'Avance inicial')
    await type(user, 'Porcentaje del momento 1', '25')
    await type(user, 'Descripción del momento 1', 'Propuesta y marco teórico')
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }))

    expect(lastPayload?.moments[0]).toMatchObject({ name: 'Avance inicial', weight_percentage: 25, description: 'Propuesta y marco teórico' })
  })

  it('Cancel goes back to the suggested distribution when nothing was saved', async () => {
    const user = setup()
    render(<Harness initial={unconfigured()} deliverables={[]} />)

    await type(user, 'Nombre del momento 1', 'Otro nombre')
    await user.click(screen.getByRole('button', { name: 'Cancelar cambios' }))
    expect(screen.getByLabelText('Nombre del momento 1')).toHaveValue('Contextualización')
    expect(screen.getAllByLabelText(/^Nombre del momento \d$/)).toHaveLength(3)
  })
})

describe('barra de distribución', () => {
  it('shows one segment per moment with its real percentage and the total, and updates as soon as a percentage changes', async () => {
    const user = setup()
    render(<Harness initial={unconfigured()} deliverables={[]} />)

    expect(screen.getByText('Distribución de la evaluación')).toBeInTheDocument()
    expect(bar()).toHaveAccessibleName('Distribución de la evaluación: Contextualización 20 %, Profundización 35 %, Transferencia y cierre 45 %')
    expect(within(bar()).getByText('Momento 1 · 20 %')).toBeInTheDocument()
    expect(within(bar()).getByText('Momento 3 · 45 %')).toBeInTheDocument()
    expect(screen.getByText('Total: 100 %')).toBeInTheDocument()

    await type(user, 'Porcentaje del momento 3', '30') // 20 + 35 + 30
    expect(bar()).toHaveAccessibleName(/Transferencia y cierre 30 %$/)
    expect(within(bar()).getByText('Momento 3 · 30 %')).toBeInTheDocument()
    expect(within(bar()).getByText('Faltan 15 %')).toBeInTheDocument() // lo que falta, a la vista
    expect(screen.getByText('Total: 85 %')).toBeInTheDocument()
    expect(stat('distribuido')).toHaveTextContent('85 %')
  })
})

describe('cantidad y orden de los momentos', () => {
  it('goes from 3 to 2 moments and then to 4, rebalancing the percentages', async () => {
    const user = setup()
    render(<Harness initial={unconfigured()} deliverables={[]} />)

    await user.click(screen.getByRole('button', { name: 'Eliminar momento 3' })) // sin criterios: se quita directo (hasta guardar se puede cancelar)
    expect(stat('momentos evaluativos')).toHaveTextContent('2')
    expect(status().getByText('Los momentos suman 55 %. Faltan 45 % para completar la evaluación.')).toBeInTheDocument()
    await type(user, 'Porcentaje del momento 1', '40')
    await type(user, 'Porcentaje del momento 2', '60')
    expect(status().getByText('Los momentos suman 100 %. Puedes guardar la configuración.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Agregar momento/ }))
    await user.click(screen.getByRole('button', { name: /Agregar momento/ }))
    expect(stat('momentos evaluativos')).toHaveTextContent('4')
    for (const [n, w] of [[1, '25'], [2, '25'], [3, '25'], [4, '25']] as const) await type(user, `Porcentaje del momento ${n}`, w)
    await type(user, 'Nombre del momento 3', 'Tercer momento')
    await type(user, 'Nombre del momento 4', 'Cuarto momento')
    expect(status().getByText('Los momentos suman 100 %. Puedes guardar la configuración.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }))
    expect(lastPayload?.moments.map((m) => [m.name, m.weight_percentage])).toEqual([['Contextualización', 25], ['Profundización', 25], ['Tercer momento', 25], ['Cuarto momento', 25]])
  })

  it('reorders moments up and down', async () => {
    const user = setup()
    render(<Harness initial={saved()} />)

    await user.click(screen.getByRole('button', { name: 'Bajar momento 1' }))
    expect(screen.getByLabelText('Nombre del momento 1')).toHaveValue('Profundización')
    expect(screen.getByLabelText('Nombre del momento 2')).toHaveValue('Contextualización')
    expect(screen.getByRole('button', { name: 'Subir momento 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar momento 2' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Subir momento 2' }))
    expect(screen.getByLabelText('Nombre del momento 1')).toHaveValue('Contextualización')
  })

  it('collapses and expands a moment card without losing what was typed', async () => {
    const user = setup()
    render(<Harness initial={saved()} />)

    expect(screen.getByLabelText('Entregable vinculado del criterio 1.1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Contraer momento 1' }))
    expect(screen.queryByLabelText('Entregable vinculado del criterio 1.1')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nombre del momento 1')).toBeInTheDocument() // el encabezado de la tarjeta sigue a la vista
    await user.click(screen.getByRole('button', { name: 'Expandir momento 1' }))
    expect(screen.getByLabelText('Entregable vinculado del criterio 1.1')).toHaveValue('d1')
  })

  it('duplicates a moment with its rows at 0 % and without deliverable link (a deliverable belongs to one row only)', async () => {
    const user = setup()
    render(<Harness initial={saved()} />)

    await user.click(screen.getByRole('button', { name: 'Duplicar momento 1' }))
    expect(stat('momentos evaluativos')).toHaveTextContent('3')
    expect(screen.getByLabelText('Nombre del momento 2')).toHaveValue('Contextualización (copia)')
    expect(screen.getByLabelText('Porcentaje del momento 2')).toHaveValue(0) // para no pasar de 100 % sin querer
    expect(screen.getByLabelText('Entregable vinculado del criterio 2.1')).toHaveValue('') // la copia queda sin entregable: hay que asociarlo
    expect(screen.getByLabelText('Entregable vinculado del criterio 1.1')).toHaveValue('d1') // el original conserva su vínculo
    expect(status().getByText(/La fila 1 del momento «Contextualización \(copia\)» no tiene un entregable del plan de trabajo asociado\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled() // no se guarda con filas sin entregable
  })

  it('asks for confirmation before deleting a moment that has criteria', async () => {
    const user = setup()
    render(<Harness initial={saved()} />)

    await user.click(screen.getByRole('button', { name: 'Eliminar momento 1' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Confirmar eliminación del momento 1' })
    expect(dialog).toHaveTextContent('¿Eliminar este momento y sus 1 criterio?')
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByLabelText('Nombre del momento 1')).toHaveValue('Contextualización')

    await user.click(screen.getByRole('button', { name: 'Eliminar momento 1' }))
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar el momento 1' }))
    expect(stat('momento evaluativo')).toHaveTextContent('1')
    expect(evaluationApi.saveConfig).not.toHaveBeenCalled() // hasta guardar nada cambia en el backend
    expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeEnabled()
  })
})

describe('tarjeta de momento y tabla de criterios', () => {
  it('shows the moment header like the reference: number, name, percentage pill, description and the criteria table columns', async () => {
    render(<Harness initial={saved()} />)

    const first = within(screen.getByRole('region', { name: 'Momento 1' }))
    expect(first.getByText('Momento 1 ·')).toBeInTheDocument()
    expect(first.getByLabelText('Nombre del momento 1')).toHaveValue('Contextualización')
    expect(first.getByText('20 %')).toBeInTheDocument() // píldora junto al nombre
    expect(first.getByText('Entregables del momento (1)')).toBeInTheDocument()
    for (const header of ['Entregable (plan de trabajo)', '% dentro del momento', 'Aporte a la nota final', 'Acciones']) {
      expect(first.getByText(header)).toBeInTheDocument()
    }
    expect(first.queryByText('Criterio')).not.toBeInTheDocument() // ya no hay nombres de criterio libres: la fila ES el entregable del plan
    expect(first.getByRole('button', { name: /Agregar entregable/ })).toBeInTheDocument()
    expect(first.getByText('Total criterios: 100 %')).toBeInTheDocument()
  })

  it('shows the contribution of each deliverable to the final grade (moment % × deliverable %) and how much is missing inside a moment', async () => {
    const user = setup()
    render(<Harness initial={unconfigured()} deliverables={NEUTRAL} />)

    await user.click(screen.getAllByRole('button', { name: /Agregar entregable/ })[0])
    await user.selectOptions(screen.getByLabelText('Entregable vinculado del criterio 1.1'), 'd1')
    await type(user, 'Porcentaje del criterio 1.1', '60')
    await user.click(screen.getAllByRole('button', { name: /Agregar entregable/ })[0])
    await user.selectOptions(screen.getByLabelText('Entregable vinculado del criterio 1.2'), 'd2')
    await type(user, 'Porcentaje del criterio 1.2', '30')

    const first = within(screen.getByRole('region', { name: 'Momento 1' }))
    expect(first.getByText('12,00 %', { selector: 'span[title="Aporte a la nota final"]' })).toBeInTheDocument() // 20 % × 60 %
    expect(first.getByText('6,00 %')).toBeInTheDocument() // 20 % × 30 %
    expect(status().getByText('El momento 1 tiene criterios que suman 90 %. Falta 10 %.')).toBeInTheDocument()
    expect(first.getByText('Incompleto')).toBeInTheDocument()

    await type(user, 'Porcentaje del criterio 1.2', '40')
    expect(first.getByText('8,00 %')).toBeInTheDocument() // 20 % × 40 %
    expect(first.getByText('Completo')).toBeInTheDocument()
    expect(first.getByText('Total criterios: 100 %')).toBeInTheDocument()
    expect(status().queryByText(/El momento 1 tiene criterios que suman/)).not.toBeInTheDocument()
    expect(first.getByText('Entregables del momento (2)')).toBeInTheDocument()
    expect(stat('criterios configurados')).toHaveTextContent('2')
  })

  it('updates the contributions when the moment percentage changes', async () => {
    const user = setup()
    render(<Harness initial={saved()} />)

    const second = within(screen.getByRole('region', { name: 'Momento 2' }))
    expect(second.getByText('80,00 %', { selector: 'span[title="Aporte a la nota final"]' })).toBeInTheDocument() // 80 % × 100 %
    await type(user, 'Porcentaje del momento 2', '35')
    expect(second.getByText('35,00 %', { selector: 'span[title="Aporte a la nota final"]' })).toBeInTheDocument()
  })
})

describe('porcentajes', () => {
  it('explains missing and excess percentages, never corrects them by itself, and blocks values out of range', async () => {
    const user = setup()
    render(<Harness initial={unconfigured()} deliverables={[]} />)

    await type(user, 'Porcentaje del momento 3', '30') // 20 + 35 + 30
    expect(status().getByText('Los momentos suman 85 %. Faltan 15 % para completar la evaluación.')).toBeInTheDocument()
    expect(screen.getByLabelText('Porcentaje del momento 3')).toHaveValue(30) // no se «arregla» solo

    await type(user, 'Porcentaje del momento 3', '60')
    expect(status().getByText('Los momentos suman 115 %. Exceden en 15 % el total permitido.')).toBeInTheDocument()
    expect(screen.getByText('Total: 115 %')).toBeInTheDocument()

    await type(user, 'Porcentaje del momento 3', '-5')
    expect(status().getByText(/debe estar entre 0 y 100/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled()
    await type(user, 'Porcentaje del momento 3', '101')
    expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled()
  })
})

describe('entregables del plan de trabajo', () => {
  it('lists only the real deliverables of the plan, names the row after the chosen one and offers each deliverable once', async () => {
    const user = setup()
    render(<Harness initial={saved()} />)

    await user.click(within(screen.getByRole('region', { name: 'Momento 2' })).getByRole('button', { name: /Agregar entregable/ }))
    const fresh = screen.getByLabelText('Entregable vinculado del criterio 2.2')
    expect(within(fresh).getAllByRole('option').map((o) => o.textContent)).toEqual(['Selecciona un entregable del plan', 'Propuesta inicial', 'Antecedentes', 'Metodología']) // solo los del plan, sin inventar ninguno
    expect(within(fresh).getByRole('option', { name: 'Propuesta inicial' })).toBeDisabled() // ya lo usa la fila 1.1
    expect(within(fresh).getByRole('option', { name: 'Antecedentes' })).toBeDisabled() // ya lo usa la fila 2.1
    expect(within(fresh).getByRole('option', { name: 'Metodología' })).toBeEnabled()
    await user.selectOptions(fresh, 'd3')
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }))
    expect(lastPayload?.moments[1].criteria.map((c) => [c.name, c.deliverable_public_id])).toEqual([['Antecedentes', 'd2'], ['Metodología', 'd3']])
  })

  it('shows a link to a deliverable that no longer exists in the plan and does not let it be saved until it is replaced', async () => {
    const user = setup()
    render(<Harness initial={saved()} deliverables={[{ value: 'd2', label: 'Antecedentes' }, { value: 'd3', label: 'Metodología' }]} />) // «Propuesta inicial» (d1) ya no está en el plan

    const select = screen.getByLabelText('Entregable vinculado del criterio 1.1')
    expect(select).toHaveValue('d1')
    expect(within(select).getByRole('option', { name: 'Entregable ya no disponible en el plan' })).toBeInTheDocument()
    await user.selectOptions(select, '') // sin entregable no se puede guardar
    expect(status().getByText(/no tiene un entregable del plan de trabajo asociado/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled()
    await user.selectOptions(select, 'd3') // el docente lo reemplaza por uno vigente
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }))
    expect(lastPayload?.moments[0].criteria[0]).toMatchObject({ deliverable_public_id: 'd3', name: 'Metodología' })
  })

  it('takes the row names from the deliverable titles of the plan, so renaming a deliverable there is picked up here', async () => {
    render(<Harness initial={saved()} deliverables={[{ value: 'd1', label: 'Propuesta inicial (v2)' }, { value: 'd2', label: 'Antecedentes' }]} />)

    expect(within(screen.getByLabelText('Entregable vinculado del criterio 1.1')).getByRole('option', { name: 'Propuesta inicial (v2)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled() // sin cambios del docente: el nombre sincronizado no cuenta como cambio
  })

  it('lists the real plan deliverables that no row uses yet, and stops listing them once they are linked', async () => {
    const user = setup()
    render(<Harness initial={saved()} deliverables={[{ value: 'd1', label: 'Propuesta inicial' }, { value: 'd2', label: 'Antecedentes' }, { value: 'd7', label: 'Informe extra del tutor' }]} />)

    const status = screen.getByRole('status', { name: 'Estado de la configuración' })
    expect(status).toHaveTextContent('Entregables del plan sin criterio asociado: Informe extra del tutor.') // d1 y d2 ya están asociados
    await user.click(within(screen.getByRole('region', { name: 'Momento 2' })).getByRole('button', { name: /Agregar entregable/ }))
    await user.selectOptions(screen.getByLabelText('Entregable vinculado del criterio 2.2'), 'd7')
    expect(status).not.toHaveTextContent('sin criterio asociado')
  })
})

describe('guardar y publicar', () => {
  it('shows saving, saved and error states and really sends the configuration to the backend', async () => {
    const user = setup()
    let resolve!: (r: EvaluationOut) => void
    vi.mocked(evaluationApi.saveConfig).mockImplementationOnce((_t, _p, payload) => new Promise((r) => { lastPayload = payload; resolve = r }))
    render(<Harness initial={unconfigured()} deliverables={[]} />)

    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }))
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    resolve(fromPayload(lastPayload as EvaluationConfigPayload, 'borrador'))
    expect(await screen.findByText('Guardado correctamente.')).toBeInTheDocument()

    await type(user, 'Nombre del momento 1', 'Cambio')
    vi.mocked(evaluationApi.saveConfig).mockRejectedValueOnce(new ApiError(409, 'El momento «Cambio» tiene notas registradas y no se puede eliminar.'))
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('tiene notas registradas')
    expect(screen.getByLabelText('Nombre del momento 1')).toHaveValue('Cambio') // no se pierde lo escrito
  })

  it('publishes only a valid configuration that is already saved, and then offers to deactivate it', async () => {
    const user = setup()
    render(<Harness initial={unconfigured()} deliverables={NEUTRAL} />)

    for (const [n, id] of [[1, 'd1'], [2, 'd2'], [3, 'd3']] as const) {
      await user.click(screen.getAllByRole('button', { name: /Agregar entregable/ })[n - 1])
      await user.selectOptions(screen.getByLabelText(`Entregable vinculado del criterio ${n}.1`), id)
      await type(user, `Porcentaje del criterio ${n}.1`, '100')
    }
    expect(screen.getByRole('button', { name: 'Publicar evaluación' })).toBeDisabled() // hay cambios sin guardar
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }))
    await screen.findByText('Guardado correctamente.')

    expect(screen.getByRole('button', { name: 'Publicar evaluación' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Publicar evaluación' }))
    expect(evaluationApi.publish).toHaveBeenCalledWith('token', 'p1')
    expect(await screen.findByText(/Evaluación publicada: tu estudiante ya ve la estructura/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desactivar evaluación' })).toBeEnabled()
    expect(stat('visible para el estudiante')).toHaveTextContent('Publicada')
  })

  it('does not allow publishing while something is missing, and says what', async () => {
    render(<Harness initial={saved({ moments: [moment('m1', 'Contextualización', 20, [criterion('c1', 'Trabajo escrito', 100, { status: 'sin_calificar', deliverable_public_id: 'd1' })]), moment('m2', 'Profundización', 70, [criterion('c2', 'Prototipo', 80, { status: 'sin_calificar', deliverable_public_id: 'd2' })])] })} />)

    expect(screen.getByRole('button', { name: 'Publicar evaluación' })).toBeDisabled()
    expect(status().getByText('Los momentos suman 90 %. Faltan 10 % para completar la evaluación.')).toBeInTheDocument()
    expect(status().getByText('El momento 2 tiene criterios que suman 80 %. Falta 20 %.')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Momento 2' })).getByText('Incompleto')).toBeInTheDocument()
    expect(evaluationApi.publish).not.toHaveBeenCalled()
  })

  it('does not allow publishing an evaluation without moments', async () => {
    const user = setup()
    render(<Harness initial={saved()} />)

    await user.click(screen.getByRole('button', { name: 'Eliminar momento 2' }))
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar el momento 2' }))
    await user.click(screen.getByRole('button', { name: 'Eliminar momento 1' }))
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar el momento 1' }))
    expect(status().getByText('Agrega al menos un momento evaluativo.')).toBeInTheDocument()
    expect(screen.getByText(/Aún no hay momentos evaluativos/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publicar evaluación' })).toBeDisabled()
  })

  it('shows the whole configuration as complete when every moment has criteria adding up to 100 %', async () => {
    render(<Harness initial={saved()} />)

    expect(stat('momentos evaluativos')).toHaveTextContent('2')
    expect(stat('distribuido')).toHaveTextContent('100 %')
    expect(stat('criterios configurados')).toHaveTextContent('2')
    expect(stat('editable')).toHaveTextContent('Borrador')
    expect(status().getByText('Los entregables de cada momento suman 100 %: la evaluación se puede publicar.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publicar evaluación' })).toBeEnabled()
  })
})

describe('restaurar distribución sugerida', () => {
  it('replaces the moments with 20 % · 35 % · 45 % only after the teacher confirms, and can still be cancelled', async () => {
    const user = setup()
    render(<Harness initial={saved()} />)

    await user.click(screen.getByRole('button', { name: 'Restaurar distribución sugerida (20 % - 35 % - 45 %)' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Confirmar restauración' })
    expect(dialog).toHaveTextContent('se descartarán sus criterios')
    expect(dialog).toHaveTextContent('No se borra ningún entregable ni nota')
    await user.click(within(dialog).getByRole('button', { name: 'No, conservar' }))
    expect(screen.getByLabelText('Entregable vinculado del criterio 1.1')).toHaveValue('d1') // nada cambió

    await user.click(screen.getByRole('button', { name: 'Restaurar distribución sugerida (20 % - 35 % - 45 %)' }))
    await user.click(screen.getByRole('button', { name: 'Sí, restaurar' }))
    expect(screen.getAllByLabelText(/^Nombre del momento \d$/).map((i) => (i as HTMLInputElement).value)).toEqual(['Contextualización', 'Profundización', 'Transferencia y cierre'])
    expect(screen.getAllByLabelText(/^Porcentaje del momento \d$/).map((i) => (i as HTMLInputElement).value)).toEqual(['20', '35', '45'])
    expect(screen.getByText(/Se restauró la distribución sugerida/)).toBeInTheDocument()
    expect(evaluationApi.saveConfig).not.toHaveBeenCalled() // restaurar tampoco escribe en el backend por sí solo

    await user.click(screen.getByRole('button', { name: 'Cancelar cambios' })) // y se vuelve a lo guardado
    expect(screen.getByLabelText('Nombre del momento 1')).toHaveValue('Contextualización')
    expect(screen.getByLabelText('Porcentaje del momento 2')).toHaveValue(80)
  })

  it('is not offered over a published evaluation or over graded criteria', async () => {
    render(<Harness initial={saved({ status: 'publicada' })} />)
    expect(screen.getByRole('button', { name: 'Restaurar distribución sugerida (20 % - 35 % - 45 %)' })).toBeDisabled()
    cleanup()

    render(<Harness initial={saved({ moments: [moment('m1', 'Contextualización', 100, [criterion('c1', 'Trabajo escrito', 100, { status: 'borrador', grade: 4 })])] })} />)
    expect(screen.getByRole('button', { name: 'Restaurar distribución sugerida (20 % - 35 % - 45 %)' })).toBeDisabled()
  })
})

describe('notas publicadas', () => {
  it('locks percentages and structure but lets the deliverable link be corrected', async () => {
    const user = setup()
    render(
      <Harness
        initial={saved({
          status: 'publicada',
          has_published_grades: true,
          moments: [moment('m1', 'Contextualización', 100, [criterion('c1', 'Trabajo escrito', 100, { status: 'publicada', grade: 4, deliverable_public_id: 'd1' })])],
        })}
      />
    )

    expect(screen.getAllByRole('note').some((n) => n.textContent?.includes('Ya hay notas publicadas'))).toBe(true)
    expect(stat('estructura bloqueada')).toHaveTextContent('Publicada')
    expect(screen.getByLabelText('Porcentaje del momento 1')).toBeDisabled()
    expect(screen.getByLabelText('Porcentaje del criterio 1.1')).toBeDisabled()
    expect(screen.getByRole('button', { name: /Agregar momento/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Agregar entregable/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Duplicar momento 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Eliminar momento 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Eliminar criterio 1.1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Desactivar evaluación' })).toBeDisabled()
    expect(screen.getByText('Este entregable ya tiene una nota registrada.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Entregable vinculado del criterio 1.1'), 'd3')
    expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeEnabled()
  })
})
