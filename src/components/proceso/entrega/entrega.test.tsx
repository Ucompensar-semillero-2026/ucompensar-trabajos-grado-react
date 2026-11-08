import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAppStore } from '@/stores/app.store'
import type { DeliverableOut, DraftOut, DraftWorkspaceOut, StageOut, SubmissionOut } from '@/services/workplan.service'

vi.mock('@/services/workplan.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/workplan.service')>()),
  workPlanApi: { get: vi.fn(), draftWorkspace: vi.fn(), saveDraft: vi.fn(), deleteDraft: vi.fn(), publishDraft: vi.fn() },
}))

// El visor tiene sus propias pruebas; aquí solo importa qué archivo se le pide mostrar.
vi.mock('@/components/documentos/VisorDocumento', () => ({
  VisorDocumento: ({ file }: { file: { path: string; fileName: string } }) => <p data-testid="visor">{file.fileName} @ {file.path}</p>,
}))
import { ApiError } from '@/services/http'
import { workPlanApi } from '@/services/workplan.service'
import { TaskSubmissionModal } from './TaskSubmissionModal'
import { attemptState, deadlineInfo, nextSubmissionVersion, timelineEvents, validateFile } from './submissionHelpers'

const stage: StageOut = { public_id: 'st1', name: 'Formulación y planificación', description: null, semester: 1, sort_order: 0, active: true, deliverables: [] }
const deliverable = (o: Partial<DeliverableOut> = {}): DeliverableOut => ({
  public_id: 'd1', stage_public_id: 'st1', title: 'Problema, objetivos y justificación', instructions: 'Redacta el problema y los objetivos.', mandatory: true, applicable: true,
  active: true, sort_order: 0, due_date: '2026-12-01', depends_on_public_id: null, accepted_extensions: null, escalate_group: true, template_file_name: null,
  template_download_url: null, status: 'disponible', is_overdue: false, can_submit: true, submissions_count: 0, current_submission: null, ...o,
})
const draft = (o: Partial<DraftOut> = {}): DraftOut => ({
  public_id: 'dr1', version: 1, file_name: 'problema.pdf', content_type: 'application/pdf', size_bytes: 1536, status: 'vigente', created_at: '2026-11-05T15:00:00',
  closed_at: null, submission_version: null, download_url: 'https://files.example/b.pdf?sig=1', ...o,
})
const submission = (o: Partial<SubmissionOut> = {}): SubmissionOut => ({
  public_id: 'sub1', version: 1, file_name: 'problema.pdf', status: 'en_revision', student_comment: null, submitted_by: { public_id: 's', full_name: 'Ana Estudiante' },
  submitted_at: '2026-11-05T16:00:00', download_url: 'https://files.example/s.pdf?sig=1', reviews: [], ...o,
})
const workspace = (o: Partial<DraftWorkspaceOut> = {}): DraftWorkspaceOut => ({
  deliverable_public_id: 'd1', current_draft: null, drafts: [], submissions: [], can_submit: true, blocked_reason: null, accepted_extensions: ['.pdf', '.docx'], max_upload_mb: 20, ...o,
})

beforeEach(() => { useAppStore.setState({ accessToken: 'token' }) })
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('reglas de presentación', () => {
  it('valida extensión, vacío, tamaño y MIME declarado antes de cargar', () => {
    const f = (name: string, size: number, type = '') => new File([new Uint8Array(size)], name, { type })
    expect(validateFile(f('a.exe', 10), ['.pdf'], 20)).toBe('Formato no permitido. Usa: .pdf')
    expect(validateFile(f('a.pdf', 0), ['.pdf'], 20)).toBe('El archivo está vacío.')
    expect(validateFile(f('a.pdf', 2 * 1024 * 1024 + 1), ['.pdf'], 2)).toMatch(/máximo permitido es 2 MB/)
    expect(validateFile(f('a.pdf', 10, 'image/png'), ['.pdf'], 20)).toBe('El tipo del archivo no corresponde a su extensión.')
    expect(validateFile(f('a.pdf', 10, 'application/octet-stream'), ['.pdf'], 20)).toBeNull()
    expect(validateFile(f('a.pdf', 10, 'application/pdf'), ['.pdf'], 20)).toBeNull()
  })

  it('el plazo usa el vencimiento del backend y colores intensos por situación', () => {
    expect(deadlineInfo(deliverable({ is_overdue: true, due_date: '2026-11-01' }), '2026-11-06')).toEqual({ tone: 'rojo', label: 'Vencida hace 5 días' })
    expect(deadlineInfo(deliverable({ due_date: '2026-11-08' }), '2026-11-06')).toEqual({ tone: 'naranja', label: 'Faltan 2 días' })
    expect(deadlineInfo(deliverable({ due_date: '2026-12-01' }), '2026-11-06')).toEqual({ tone: 'azul', label: 'Faltan 25 días' })
    expect(deadlineInfo(deliverable({ status: 'aprobado' }), '2026-11-06').tone).toBe('verde')
    expect(deadlineInfo(deliverable({ due_date: null }), '2026-11-06').tone).toBe('gris')
  })

  it('el historial muestra eventos de borradores sin exponer el archivo anterior, y las revisiones reales', () => {
    const ws = workspace({
      current_draft: draft({ public_id: 'b', version: 2, created_at: '2026-11-05T15:30:00' }),
      drafts: [draft({ public_id: 'a', version: 1, file_name: 'viejo.pdf', status: 'reemplazado', closed_at: '2026-11-05T15:30:00', download_url: null }), draft({ public_id: 'b', version: 2, created_at: '2026-11-05T15:30:00' })],
      submissions: [submission({ status: 'requiere_correcciones', reviews: [{ public_id: 'r', decision: 'requiere_correcciones', comment: 'x', reviewer: { public_id: 't', full_name: 'Prof. Tutor' }, created_at: '2026-11-04T10:00:00' }] })],
    })
    const ev = timelineEvents(ws, '2026-09-15T10:00:00')
    expect(ev.map((e) => e.title)).toContain('Borrador 1 reemplazado')
    expect(ev.find((e) => e.title === 'Borrador 1 cargado')?.detail).toBeUndefined() // no se muestra el nombre del archivo anterior
    expect(ev.find((e) => e.title === 'Borrador 2 cargado')?.detail).toBe('problema.pdf')
    expect(ev.map((e) => e.title)).toContain('Correcciones solicitadas · versión 1')
    expect(ev[ev.length - 1]?.title).toBe('Tarea publicada en el plan')
    expect(attemptState(ws)).toBe('borrador')
    expect(nextSubmissionVersion(ws)).toBe(2)
  })
})

describe('modal de entrega', () => {
  const renderModal = (d = deliverable(), onClose = vi.fn(), onSubmitted = vi.fn()) => {
    render(<TaskSubmissionModal processId="p1" deliverable={d} stage={stage} dependencyTitle={null} planPublishedAt="2026-09-15T10:00:00" onClose={onClose} onSubmitted={onSubmitted} />)
    return { onClose, onSubmitted }
  }

  it('muestra encabezado, instrucciones, información y un único Entregar en el pie', async () => {
    vi.mocked(workPlanApi.draftWorkspace).mockResolvedValue(workspace({ current_draft: draft(), drafts: [draft()] }))
    renderModal()
    const dialog = await screen.findByRole('dialog', { name: 'Problema, objetivos y justificación' })
    expect(within(dialog).getByText('Formulación y planificación')).toBeInTheDocument()
    expect(within(dialog).getByText('Obligatorio')).toBeInTheDocument()
    expect(await within(dialog).findByText('Borrador guardado', { selector: 'p' })).toBeInTheDocument()
    expect(within(dialog).getByText('Redacta el problema y los objetivos.')).toBeInTheDocument()
    expect(within(dialog).getByText('Al entregar, tu archivo se publicará y quedará disponible para tu tutor, quien podrá revisarlo y dejar observaciones.')).toBeInTheDocument()
    expect(within(dialog).getByText('1,5 KB', { exact: false })).toBeInTheDocument()
    const footer = dialog.querySelector('footer') as HTMLElement
    expect(within(footer).getByRole('button', { name: /^Entregar$/ })).toBeEnabled()
    expect(within(dialog).getAllByRole('button', { name: /Entregar/ })).toHaveLength(1)
  })

  it('elimina el borrador solo tras confirmar', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.draftWorkspace).mockResolvedValue(workspace({ current_draft: draft(), drafts: [draft()] }))
    vi.mocked(workPlanApi.deleteDraft).mockResolvedValue(workspace({ drafts: [draft({ status: 'eliminado', closed_at: '2026-11-05T17:00:00', download_url: null })] }))
    renderModal()
    await user.click(await screen.findByRole('button', { name: 'Eliminar borrador' }))
    expect(workPlanApi.deleteDraft).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }))
    await waitFor(() => expect(workPlanApi.deleteDraft).toHaveBeenCalledWith('token', 'p1', 'd1'))
    expect(await screen.findByText('Borrador eliminado.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Entregar$/ })).toBeDisabled()
  })

  it('muestra el porcentaje de carga y permite cancelarla sin guardar nada', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.draftWorkspace).mockResolvedValue(workspace())
    vi.mocked(workPlanApi.saveDraft).mockImplementation((_t, _p, _d, _f, onProgress, signal) => {
      onProgress?.(40)
      return new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new ApiError(0, 'Carga cancelada. El archivo no se guardó.'))))
    })
    renderModal()
    await user.upload(await screen.findByLabelText('Seleccionar archivo'), new File(['%PDF'], 'a.pdf', { type: 'application/pdf' }))
    expect(await screen.findByText('Guardando borrador… 40%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Entregar$/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Cancelar carga' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Carga cancelada. El archivo no se guardó.')
  })

  it('un doble clic en Confirmar entrega publica una sola vez', async () => {
    const user = userEvent.setup()
    let resolve: (s: SubmissionOut) => void = () => {}
    vi.mocked(workPlanApi.draftWorkspace).mockResolvedValue(workspace({ current_draft: draft(), drafts: [draft()] }))
    vi.mocked(workPlanApi.publishDraft).mockImplementation(() => new Promise((r) => { resolve = r }))
    const { onSubmitted } = renderModal()
    await user.click(await screen.findByRole('button', { name: /^Entregar$/ }))
    const confirm = screen.getByRole('button', { name: 'Confirmar entrega' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(await screen.findByRole('button', { name: 'Publicando…' })).toBeDisabled()
    resolve(submission())
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1))
    expect(workPlanApi.publishDraft).toHaveBeenCalledTimes(1)
  })

  it('en revisión no ofrece Entregar ni carga libre: preparar otra versión es una acción explícita', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.draftWorkspace).mockResolvedValue(workspace({ submissions: [submission()] }))
    renderModal(deliverable({ status: 'en_revision' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText(/Versión 1 entregada · En revisión por tu tutor/)).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /^Entregar$/ })).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Seleccionar archivo')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /Preparar una nueva versión \(se publicará como versión 2/ }))
    expect(within(dialog).getByLabelText('Seleccionar archivo')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /^Entregar$/ })).toBeDisabled()
  })

  it('aprobada: sin carga, sin Entregar y con el aviso correspondiente', async () => {
    vi.mocked(workPlanApi.draftWorkspace).mockResolvedValue(workspace({ can_submit: false, blocked_reason: 'Este entregable ya fue aprobado', submissions: [submission({ status: 'aprobado' })] }))
    renderModal(deliverable({ status: 'aprobado', can_submit: false }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Esta actividad ya fue aprobada. No admite nuevas entregas.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /^Entregar$/ })).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/Seleccionar archivo|Reemplazar el borrador/)).not.toBeInTheDocument()
    expect(within(dialog.querySelector('footer') as HTMLElement).getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cerrar ventana' })).toBeInTheDocument()
  })

  it('Esc cierra, salvo durante una carga o publicación', async () => {
    vi.mocked(workPlanApi.draftWorkspace).mockResolvedValue(workspace())
    vi.mocked(workPlanApi.saveDraft).mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await user.upload(await screen.findByLabelText('Seleccionar archivo'), new File(['%PDF'], 'a.pdf', { type: 'application/pdf' }))
    await screen.findByText(/Guardando borrador/)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})


describe('visor en «Mis tareas»', () => {
  const renderModal = (d = deliverable(), onClose = vi.fn()) => {
    render(<TaskSubmissionModal processId="p1" deliverable={d} stage={stage} dependencyTitle={null} planPublishedAt="2026-09-15T10:00:00" onClose={onClose} onSubmitted={vi.fn()} />)
    return { onClose }
  }

  it('el estudiante ve su borrador (también Word) ANTES de entregarlo, por la ruta privada del borrador', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.draftWorkspace).mockResolvedValue(workspace({ current_draft: draft({ file_name: 'avance.docx', version: 2 }) }))
    renderModal()

    await user.click(await screen.findByRole('button', { name: /Vista previa/ }))
    const viewer = screen.getByRole('dialog', { name: 'Documento avance.docx' })
    expect(within(viewer).getByTestId('visor')).toHaveTextContent('avance.docx @ /processes/p1/work-plan/deliverables/d1/draft/file')
    expect(within(viewer).getByText(/Borrador \(no entregado\)/)).toBeInTheDocument()
    expect(within(viewer).getByText('v2')).toBeInTheDocument()
  })

  it('la plantilla se puede ver sin descargarla', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.draftWorkspace).mockResolvedValue(workspace())
    renderModal(deliverable({ template_file_name: 'Ficha anteproyecto.docx', template_download_url: 'https://files.example/t.docx?sig=1' }))

    await user.click(await screen.findByRole('button', { name: /Ver plantilla/ }))
    expect(screen.getByTestId('visor')).toHaveTextContent('Ficha anteproyecto.docx @ /processes/p1/work-plan/deliverables/d1/template/file')
    expect(screen.getByRole('button', { name: /Descargar plantilla/ })).toBeInTheDocument()
  })

  it('si la plantilla no se puede descargar, dice la causa real del servidor', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.draftWorkspace).mockResolvedValue(workspace())
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false, status: 410, headers: new Headers(), json: async () => ({ detail: 'El archivo ya no está guardado en la plataforma.' }),
    } as Response)
    renderModal(deliverable({ template_file_name: 'Ficha anteproyecto.docx', template_download_url: 'https://files.example/t.docx?sig=1' }))

    await user.click(await screen.findByRole('button', { name: /Descargar plantilla/ }))
    expect(await screen.findByText('El archivo ya no está guardado en la plataforma.')).toBeInTheDocument()
    expect(String(fetch.mock.calls[0][0])).toMatch(/\/processes\/p1\/work-plan\/deliverables\/d1\/template\/file$/)
    fetch.mockRestore()
  })

  it('la versión entregada también se ve desde su tarjeta', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.draftWorkspace).mockResolvedValue(workspace({ submissions: [submission()] }))
    renderModal(deliverable({ status: 'en_revision', submissions_count: 1 }))

    await user.click(await screen.findByRole('button', { name: /Ver versión 1/ }))
    expect(screen.getByTestId('visor')).toHaveTextContent('problema.pdf @ /processes/p1/work-plan/submissions/sub1/file')
  })

  it('un formato sin vista previa (.pptx) solo ofrece descargar', async () => {
    vi.mocked(workPlanApi.draftWorkspace).mockResolvedValue(workspace({ current_draft: draft({ file_name: 'sustentacion.pptx' }) }))
    renderModal()
    expect(await screen.findByText('sustentacion.pptx')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Vista previa/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Descargar$/ })).toBeInTheDocument()
  })

  it('Esc cierra solo el visor y deja abierta la ventana de entrega', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.draftWorkspace).mockResolvedValue(workspace({ current_draft: draft() }))
    const { onClose } = renderModal()

    await user.click(await screen.findByRole('button', { name: /Vista previa/ }))
    expect(screen.getByRole('dialog', { name: 'Documento problema.pdf' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Documento problema.pdf' })).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Vista previa/ })).toBeInTheDocument()
  })
})
