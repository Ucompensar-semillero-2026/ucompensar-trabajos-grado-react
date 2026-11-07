import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { workPlanApi } from './workplan.service'

// Flujo de carga directa del borrador: start → PUT a la URL prefirmada (SIN credenciales de la API) → complete.

class FakeXhr {
  static instances: FakeXhr[] = []
  method = ''
  url = ''
  withCredentials: boolean | undefined
  headers: Record<string, string> = {}
  sent: unknown = undefined
  status = 200
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  constructor() { FakeXhr.instances.push(this) }
  open(method: string, url: string) { this.method = method; this.url = url }
  setRequestHeader(name: string, value: string) { this.headers[name] = value }
  send(body: unknown) {
    this.sent = body
    this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 })
    queueMicrotask(() => this.onload?.())
  }
  abort() { this.onabort?.() }
}

const ticket = {
  draft_public_id: 'draft-1',
  upload_url: 'https://cuenta.r2.cloudflarestorage.com/bucket/p/drafts/abc.pdf?X-Amz-Signature=firma',
  method: 'PUT',
  headers: { 'Content-Type': 'application/pdf' },
  expires_at: '2026-11-06T12:00:00',
  max_bytes: 20 * 1024 * 1024,
}
const workspace = { current_draft: { public_id: 'draft-1', status: 'vigente' }, drafts: [], submissions: [], can_submit: true, blocked_reason: null }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('workPlanApi.saveDraft (carga directa al almacenamiento)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    FakeXhr.instances = []
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('inicia, sube directo sin credenciales con el Content-Type firmado y confirma', async () => {
    fetchMock.mockResolvedValueOnce(json(ticket, 201)).mockResolvedValueOnce(json(workspace))
    const file = new File(['%PDF-1.4'], 'propuesta.pdf', { type: 'application/pdf' })
    const progress: number[] = []

    const result = await workPlanApi.saveDraft('token', 'proc-1', 'del-1', file, (p) => progress.push(p))

    const [startUrl, startInit] = fetchMock.mock.calls[0]
    expect(String(startUrl)).toContain('/processes/proc-1/work-plan/deliverables/del-1/draft/uploads')
    expect(startInit.method).toBe('POST')
    expect(JSON.parse(startInit.body)).toEqual({ file_name: 'propuesta.pdf', content_type: 'application/pdf', size_bytes: file.size })

    const xhr = FakeXhr.instances[0]
    expect(xhr.method).toBe('PUT')
    expect(xhr.url).toBe(ticket.upload_url)
    expect(xhr.withCredentials).toBe(false) // ni cookies de la API
    expect(xhr.headers).toEqual({ 'Content-Type': 'application/pdf' }) // sin Authorization
    expect(xhr.sent).toBe(file)
    expect(progress).toEqual([50])

    expect(String(fetchMock.mock.calls[1][0])).toContain('/draft/uploads/draft-1/complete')
    expect(result).toEqual(workspace)
  })

  it('completa el tipo por extensión cuando el navegador no lo informa', async () => {
    fetchMock.mockResolvedValueOnce(json({ ...ticket, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } }, 201)).mockResolvedValueOnce(json(workspace))
    await workPlanApi.saveDraft('token', 'p', 'd', new File(['x'], 'informe.docx', { type: '' }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).content_type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })

  it('si el almacenamiento rechaza el PUT no confirma nada', async () => {
    fetchMock.mockResolvedValueOnce(json(ticket, 201))
    vi.spyOn(FakeXhr.prototype, 'send').mockImplementationOnce(function (this: FakeXhr) { this.status = 403; queueMicrotask(() => this.onload?.()) })
    await expect(workPlanApi.saveDraft('token', 'p', 'd', new File(['x'], 'a.pdf', { type: 'application/pdf' }))).rejects.toMatchObject({ status: 403 })
    expect(fetchMock).toHaveBeenCalledTimes(1) // nunca llamó a /complete
  })

  it('cancelar durante la subida aborta el PUT y no confirma', async () => {
    fetchMock.mockResolvedValueOnce(json(ticket, 201))
    vi.spyOn(FakeXhr.prototype, 'send').mockImplementationOnce(function () { /* la subida queda en curso */ })
    const controller = new AbortController()
    const pending = workPlanApi.saveDraft('token', 'p', 'd', new File(['x'], 'a.pdf', { type: 'application/pdf' }), undefined, controller.signal)
    await vi.waitFor(() => expect(FakeXhr.instances.length).toBe(1))
    controller.abort()
    await expect(pending).rejects.toMatchObject({ message: expect.stringContaining('cancelada') })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
