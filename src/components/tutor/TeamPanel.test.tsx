import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import { makeUser } from '@/test/users'

vi.mock('@/services/processes.service', () => ({
  processesApi: { team: vi.fn(), eligibleMembers: vi.fn(), addTeamMember: vi.fn(), removeTeamMember: vi.fn(), changeTutor: vi.fn() },
}))
import { processesApi, type EligibleMembersOut, type TeamMemberOut } from '@/services/processes.service'
import { TeamPanel } from './TeamPanel'

const person = (id: string, name: string) => ({ public_id: id, full_name: name, email: `${id}@u.co`, active: true })
const member = (id: string, role: string, name: string, extra: Partial<TeamMemberOut> = {}): TeamMemberOut => ({
  public_id: id, user: person(`${id}-u`, name), process_role: role, role_label: null, assigned_at: '2026-10-20T10:00:00', active: true, ...extra,
})
const eligible = (role: 'tutor' | 'evaluador', label: string, max: number, assigned: number, users = [person('d1', 'Diego Docente'), person('x1', 'Ximena Externa')]): EligibleMembersOut => ({
  role, role_label: label, max_count: max, assigned_count: assigned, users,
})

const team = [
  member('m1', 'estudiante', 'Ana Estudiante', { role_label: 'Estudiante' }),
  member('m2', 'tutor', 'Tomás Tutor', { role_label: 'Tutor de semillero', assigned_by: person('c1', 'Clara Coordinadora') }),
]

beforeEach(() => {
  useAppStore.getState().loginSuccess(makeUser(['coordinador']), 'token')
  vi.mocked(processesApi.team).mockResolvedValue(team)
  vi.mocked(processesApi.eligibleMembers).mockImplementation(async (_t, _p, role) =>
    role === 'tutor' ? eligible('tutor', 'Tutor de semillero', 1, 1) : eligible('evaluador', 'Evaluador', 2, 0),
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useAppStore.getState().logout()
})

describe('Equipo del trámite', () => {
  it('muestra el nombre del rol en la modalidad y quién asignó', async () => {
    render(<TeamPanel processId="p1" canManage />)
    const list = await screen.findByRole('list', { name: 'Integrantes' })
    expect(within(list).getByText('Tutor de semillero:')).toBeInTheDocument()
    expect(within(list).getByText(/asignado por Clara Coordinadora/)).toBeInTheDocument()
    expect(await screen.findByTestId('quota-evaluador')).toHaveTextContent('(0 de 2)')
    expect(screen.getByTestId('quota-tutor')).toHaveTextContent('(1 de 1)')
  })

  it('asigna un evaluador con las personas elegibles del backend', async () => {
    const user = userEvent.setup()
    vi.mocked(processesApi.addTeamMember).mockResolvedValue({} as never)
    render(<TeamPanel processId="p1" canManage />)

    await user.selectOptions(await screen.findByLabelText('Persona para evaluador'), 'x1')
    await user.click(screen.getByRole('button', { name: 'Asignar como evaluador' }))

    expect(processesApi.addTeamMember).toHaveBeenCalledWith('token', 'p1', 'x1', 'evaluador')
    await waitFor(() => expect(processesApi.team).toHaveBeenCalledTimes(2)) // recarga el equipo
  })

  it('con el tutor ya asignado ofrece cambiarlo (PUT /tutor), no sumar otro', async () => {
    const user = userEvent.setup()
    vi.mocked(processesApi.changeTutor).mockResolvedValue({} as never)
    render(<TeamPanel processId="p1" canManage />)

    await user.selectOptions(await screen.findByLabelText('Persona para tutor de semillero'), 'd1')
    await user.click(screen.getByRole('button', { name: 'Cambiar tutor de semillero' }))

    expect(processesApi.changeTutor).toHaveBeenCalledWith('token', 'p1', 'd1')
    expect(processesApi.addTeamMember).not.toHaveBeenCalled()
  })

  it('quita a un integrante', async () => {
    const user = userEvent.setup()
    vi.mocked(processesApi.removeTeamMember).mockResolvedValue(undefined)
    render(<TeamPanel processId="p1" canManage />)

    await user.click(await screen.findByRole('button', { name: 'Retirar a Tomás Tutor (Tutor de semillero)' }))
    expect(processesApi.removeTeamMember).toHaveBeenCalledWith('token', 'p1', 'm2')
    // Al estudiante no se le puede retirar.
    expect(screen.queryByRole('button', { name: /Retirar a Ana Estudiante/ })).not.toBeInTheDocument()
  })

  it('con el cupo de evaluadores lleno no deja asignar más', async () => {
    vi.mocked(processesApi.eligibleMembers).mockImplementation(async (_t, _p, role) =>
      role === 'tutor' ? eligible('tutor', 'Tutor de semillero', 1, 1) : eligible('evaluador', 'Evaluador', 2, 2),
    )
    render(<TeamPanel processId="p1" canManage />)

    expect(await screen.findByText('Cupo lleno: retira a uno para asignar otro.')).toBeInTheDocument()
    expect(screen.getByTestId('quota-evaluador')).toHaveTextContent('(2 de 2)')
    expect(screen.queryByRole('button', { name: 'Asignar como evaluador' })).not.toBeInTheDocument()
  })

  it('muestra tal cual el mensaje del 422 del backend', async () => {
    const user = userEvent.setup()
    vi.mocked(processesApi.addTeamMember).mockRejectedValue(
      new ApiError(422, 'El evaluador debe tener el rol institucional docente o externo'),
    )
    render(<TeamPanel processId="p1" canManage />)

    await user.selectOptions(await screen.findByLabelText('Persona para evaluador'), 'd1')
    await user.click(screen.getByRole('button', { name: 'Asignar como evaluador' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El evaluador debe tener el rol institucional docente o externo')
  })

  it('sin manage_team solo se ve el equipo: ni controles ni consulta de elegibles', async () => {
    render(<TeamPanel processId="p1" canManage={false} />)

    expect(await screen.findByText(/Tomás Tutor/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Retirar/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Persona para/)).not.toBeInTheDocument()
    expect(processesApi.eligibleMembers).not.toHaveBeenCalled()
  })

  it('una modalidad sin evaluadores lo dice en vez de ofrecer el selector', async () => {
    vi.mocked(processesApi.eligibleMembers).mockImplementation(async (_t, _p, role) =>
      role === 'tutor' ? eligible('tutor', 'Docente del curso', 1, 0) : eligible('evaluador', 'Evaluador', 0, 0, []),
    )
    render(<TeamPanel processId="p1" canManage />)
    expect(await screen.findByText('Esta modalidad no usa evaluador.')).toBeInTheDocument()
  })
})
