import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MOMENTS,
  criteriaCount,
  defaultDraft,
  duplicateCriterion,
  duplicateMoment,
  effectiveWeight,
  fieldProblems,
  initialDraft,
  isDirty,
  isValidWeight,
  momentProblem,
  momentsStatus,
  parseWeight,
  publishProblems,
  sumWeights,
  suggestedDraft,
  toDraft,
  toPayload,
} from './evaluationDraft'
import { criterion, evaluation, moment, partialEvaluation } from '@/test/evaluationFixtures'

describe('weights typed by the teacher', () => {
  it('accepts a comma or a dot and rejects empty, negative, over 100 and more than two decimals', () => {
    expect(parseWeight('12,5')).toBe(12.5)
    expect(parseWeight(' 30 ')).toBe(30)
    expect(Number.isNaN(parseWeight(''))).toBe(true)
    for (const ok of ['0', '100', '12,5', '33.33']) expect(isValidWeight(ok)).toBe(true)
    for (const bad of ['', '-1', '100.01', '101', 'abc', '33.333']) expect(isValidWeight(bad)).toBe(false)
  })

  it('adds weights without floating point noise', () => {
    expect(sumWeights(['33.33', '33.33', '33.34'])).toBe(100)
    expect(sumWeights(['0.1', '0.2'])).toBe(0.3)
    expect(sumWeights(['40', 'x'])).toBe(40) // lo ilegible no suma
  })
})

describe('default template', () => {
  it('is 20 % + 35 % + 45 % = 100 %, with editable named moments and NO invented criteria', () => {
    expect(DEFAULT_MOMENTS.map((m) => [m.name, m.weight, m.description])).toEqual([
      ['Contextualización', '20', 'Corresponde a la formulación del proyecto y definición del problema.'],
      ['Profundización', '35', 'Desarrollo del marco teórico, metodología y plan de trabajo.'],
      ['Transferencia y cierre', '45', 'Resultados, documento final y sustentación del proyecto.'],
    ])
    const draft = defaultDraft()
    expect(draft.map((m) => m.description)).toEqual(DEFAULT_MOMENTS.map((m) => m.description))
    expect(sumWeights(draft.map((m) => m.weight))).toBe(100)
    expect(draft.every((m) => m.public_id === null && m.criteria.length === 0)).toBe(true)
    expect(new Set(draft.map((m) => m.key)).size).toBe(3)
  })

  it('is suggested only when nothing is saved yet and never replaces what exists', () => {
    expect(initialDraft(evaluation({ status: 'sin_configurar', moments: [] })).map((m) => m.weight)).toEqual(['20', '35', '45'])
    expect(initialDraft(evaluation({ status: 'borrador', moments: [] })).length).toBe(3) // borrador vacío: también se sugiere
    expect(initialDraft(evaluation({ status: 'publicada', moments: [] }))).toEqual([]) // publicada: nunca se inventa nada
    const saved = initialDraft(partialEvaluation())
    expect(saved.map((m) => m.name)).toEqual(['Primer momento evaluativo', 'Segundo momento evaluativo'])
    expect(saved.map((m) => m.weight)).toEqual(['40', '60']) // lo guardado manda sobre la plantilla
  })
})

describe('messages for the teacher', () => {
  it('says how much is missing or in excess for the moments', () => {
    expect(momentsStatus(100)).toEqual({ ok: true, text: 'Los momentos suman 100 %. Puedes guardar la configuración.' })
    expect(momentsStatus(85)).toEqual({ ok: false, text: 'Los momentos suman 85 %. Faltan 15 % para completar la evaluación.' })
    expect(momentsStatus(115.5)).toEqual({ ok: false, text: 'Los momentos suman 115,5 %. Exceden en 15,5 % el total permitido.' })
  })

  it('says what is wrong inside a moment (numbered from 1) and stays silent when it is complete', () => {
    const base = toDraft(partialEvaluation())
    expect(momentProblem(1, { ...base[0], criteria: [] })).toBe('El momento 1 no tiene criterios.')
    const short = { ...base[1], criteria: base[1].criteria.map((c, i) => ({ ...c, weight: i === 0 ? '60' : '20' })) }
    expect(momentProblem(2, short)).toBe('El momento 2 tiene criterios que suman 80 %. Falta 20 %.')
    const over = { ...base[1], criteria: base[1].criteria.map((c) => ({ ...c, weight: '70' })) }
    expect(momentProblem(2, over)).toBe('El momento 2 tiene criterios que suman 140 %. Excede en 40 %.')
    expect(momentProblem(1, { ...base[0], criteria: base[0].criteria.map((c, i) => ({ ...c, weight: ['50', '30', '20'][i] })) })).toBeNull()
  })

  it('lists everything that blocks publishing: no moments, moments not adding up to 100 %, moments without criteria', () => {
    expect(publishProblems([])).toEqual(['Agrega al menos un momento evaluativo.'])
    expect(publishProblems(defaultDraft())).toEqual(['El momento 1 no tiene criterios.', 'El momento 2 no tiene criterios.', 'El momento 3 no tiene criterios.'])
    const draft = toDraft(partialEvaluation())
    draft[1].weight = '50'
    draft[1].criteria = draft[1].criteria.map((c, i) => ({ ...c, weight: i === 0 ? '60' : '40' }))
    draft[0].criteria = draft[0].criteria.map((c, i) => ({ ...c, weight: ['50', '30', '20'][i] }))
    expect(publishProblems(draft)).toEqual(['Los momentos suman 90 %. Faltan 10 % para completar la evaluación.'])
    draft[1].weight = '60'
    expect(publishProblems(draft)).toEqual([])
  })
})

describe('effective weight', () => {
  it('is moment % × criterion % / 100: 20 % × 60 % = 12 % and 20 % × 40 % = 8 % of the final grade', () => {
    expect(effectiveWeight('20', '60')).toBe(12)
    expect(effectiveWeight('20', '40')).toBe(8)
    expect(effectiveWeight('35', '50')).toBe(17.5)
    expect(effectiveWeight('33,33', '100')).toBe(33.33)
    expect(effectiveWeight('', '40')).toBeNull()
    expect(effectiveWeight('20', 'x')).toBeNull()
  })
})

describe('duplicating', () => {
  it('copies a criterion without identity, deliverable link or grade flag', () => {
    const original = { key: 'k', public_id: 'c1', name: 'Trabajo escrito', description: 'd', weight: '60', deliverable_public_id: 'd1', graded: true }
    const copy = duplicateCriterion(original)
    expect(copy).toMatchObject({ public_id: null, name: 'Trabajo escrito (copia)', weight: '60', deliverable_public_id: '', graded: false, description: 'd' })
    expect(copy.key).not.toBe(original.key)
  })

  it('copies a moment with its criteria and a 0 % weight so the total does not exceed 100 % by accident', () => {
    const [first] = toDraft(partialEvaluation())
    const copy = duplicateMoment(first)
    expect(copy).toMatchObject({ public_id: null, name: 'Primer momento evaluativo (copia)', weight: '0' })
    expect(copy.criteria).toHaveLength(3)
    expect(copy.criteria.every((c) => c.public_id === null && c.graded === false && c.deliverable_public_id === '')).toBe(true)
    expect(new Set([...first.criteria, ...copy.criteria].map((c) => c.key)).size).toBe(6)
  })
})

describe('draft conversion', () => {
  it('builds a draft from the saved configuration and sends it back with ids, order and numeric weights', () => {
    const draft = toDraft(partialEvaluation())
    expect(draft.map((m) => [m.name, m.weight, m.criteria.length])).toEqual([['Primer momento evaluativo', '40', 3], ['Segundo momento evaluativo', '60', 2]])
    expect(draft[0].criteria[0]).toMatchObject({ public_id: 'c1', graded: true }) // ya tiene nota: no se podrá eliminar
    expect(draft[0].criteria[1].graded).toBe(false)
    expect(criteriaCount(draft)).toBe(5)

    const payload = toPayload(draft)
    expect(payload.moments[0]).toMatchObject({ public_id: 'm1', name: 'Primer momento evaluativo', weight_percentage: 40 })
    expect(payload.moments[0].criteria.map((c) => [c.public_id, c.weight_percentage, c.deliverable_public_id])).toEqual([['c1', 50, null], ['c2', 30, null], ['c3', 20, null]])
  })

  it('detects unsaved changes and ignores internal keys', () => {
    const saved = toDraft(partialEvaluation())
    expect(isDirty(toDraft(partialEvaluation()), saved)).toBe(false)
    const edited = toDraft(partialEvaluation())
    edited[1].weight = '55'
    expect(isDirty(edited, saved)).toBe(true)
    expect(isDirty(defaultDraft(), [])).toBe(true) // la plantilla sugerida cuenta como cambio sin guardar
  })

  it('reports empty names and unreadable percentages before talking to the server', () => {
    const draft = toDraft(partialEvaluation())
    draft[0].name = '   '
    draft[1].criteria[0].weight = '1000'
    const problems = fieldProblems(draft)
    expect(problems).toContain('El momento 1 no tiene nombre.')
    expect(problems.some((p) => p.includes('«Desarrollo del prototipo»') && p.includes('entre 0 y 100'))).toBe(true)
    const linked = toDraft(partialEvaluation())
    linked.forEach((m) => m.criteria.forEach((c, k) => { c.deliverable_public_id = `d-${m.key}-${k}` }))
    expect(fieldProblems(linked)).toEqual([])
    expect(fieldProblems(toDraft(partialEvaluation())).every((p) => p.includes('no tiene un entregable del plan de trabajo asociado'))).toBe(true) // filas sin entregable no se guardan
    expect(moment('x', 'X', 100, [criterion('y', 'Y', 100)]).criteria).toHaveLength(1) // los constructores de prueba son consistentes
  })
})

describe('suggested association with the real plan deliverables', () => {
  const real = [
    ['d1', 'Propuesta inicial'], ['d2', 'Problema, objetivos y justificación'], ['d3', 'Antecedentes o estado del arte'],
    ['d4', 'Metodología'], ['d5', 'Plan de trabajo y cronograma'], ['d6', 'Primer informe de avance'], ['d7', 'Entregables de ejecución de la investigación'],
    ['d8', 'Evidencias y resultados'], ['d9', 'Segundo informe de avance'], ['d10', 'Documento final'], ['d11', 'Aval del tutor'], ['d12', 'Correcciones y sustentación'],
  ].map(([value, label]) => ({ value, label }))

  it('places each real deliverable in its moment (3 / 4 / 5), splits 100 % evenly inside it and links the criterion to it', () => {
    const draft = suggestedDraft(real)
    expect(draft.map((m) => m.criteria.map((c) => c.deliverable_public_id))).toEqual([['d1', 'd2', 'd3'], ['d4', 'd5', 'd6', 'd7'], ['d8', 'd9', 'd10', 'd11', 'd12']])
    expect(draft.map((m) => m.criteria.map((c) => c.weight))).toEqual([['34', '33', '33'], ['25', '25', '25', '25'], ['20', '20', '20', '20', '20']])
    expect(draft.map((m) => sumWeights(m.criteria.map((c) => c.weight)))).toEqual([100, 100, 100])
    expect(draft.map((m) => m.weight)).toEqual(['20', '35', '45'])
    expect(publishProblems(draft)).toEqual([])
  })

  it('never invents deliverables: a project with only some of them (or custom ones) gets criteria only for the recognised ones', () => {
    const draft = suggestedDraft([{ value: 'x1', label: 'Documento final' }, { value: 'x2', label: 'Bitácora de laboratorio' }])
    expect(draft.flatMap((m) => m.criteria.map((c) => c.deliverable_public_id))).toEqual(['x1']) // «Bitácora…» queda sin asociar para que el tutor decida
    expect(draft[2].criteria[0].weight).toBe('100')
    expect(suggestedDraft([]).every((m) => m.criteria.length === 0)).toBe(true)
  })

  it('is only used when nothing is saved: a saved evaluation always wins', () => {
    expect(initialDraft(evaluation({ status: 'sin_configurar', moments: [] }), real).flatMap((m) => m.criteria)).toHaveLength(12)
    expect(initialDraft(partialEvaluation(), real).map((m) => m.name)).toEqual(['Primer momento evaluativo', 'Segundo momento evaluativo'])
  })
})
