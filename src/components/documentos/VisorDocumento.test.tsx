import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as XLSX from 'xlsx'
import { useAppStore } from '@/stores/app.store'
import { makeUser } from '@/test/users'
import { filePaths, MISSING_FILE_MESSAGE, NO_ACCESS_MESSAGE, type FilePreviewInfo } from '@/services/files.service'
import { VisorDocumento } from './VisorDocumento'
import { MAX_SHEET_ROWS, readWorkbook, rowsLimitNotice, viewerKindForMime } from './visorDocumento.utils'
import { ArchivoAcciones } from './ArchivoAcciones'

// docx-preview necesita un navegador real; aquí solo importa qué se hace con su HTML.
vi.mock('docx-preview', () => ({
  renderAsync: vi.fn(async (_data: Blob, container: HTMLElement) => {
    container.innerHTML = '<section class="docx"><p>Contenido del informe</p><a href="javascript:alert(1)">malo</a><a href="https://ucompensar.edu.co">bueno</a></section>'
  }),
}))

const fetchMock = vi.fn<typeof fetch>()
const createObjectURL = vi.fn(() => 'blob:visor')
const revokeObjectURL = vi.fn()

// jsdom: su Blob no trae arrayBuffer() (los navegadores sí) y Response no entiende un Blob de jsdom
// como cuerpo; por eso el cuerpo va como bytes o texto.
if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(this)
    })
  }
}

const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/**
 * Respuesta de archivo del backend falso. No se usa `new Response(arrayBuffer)`: en Node 22 (el del CI)
 * Response no reconoce un ArrayBuffer creado dentro del entorno jsdom y lo convierte en el texto
 * "[object ArrayBuffer]". Aquí el cuerpo va directo a un Blob, igual que lo entrega un navegador.
 */
function fileResponse(body: string | ArrayBuffer, type: string, headers: Record<string, string> = {}): Response {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : new Uint8Array(body)
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'Content-Type': type, ...headers }),
    body: null,
    blob: async () => new Blob([bytes], { type }),
    json: async () => null,
  } as unknown as Response
}

/** Backend falso: .../preview-info responde `info` (o un código de error) y .../file responde `file`. */
function serve(info: Partial<FilePreviewInfo> | number, file?: () => Response) {
  fetchMock.mockImplementation(async (input) => {
    const url = String(input)
    if (url.endsWith('/preview-info')) {
      if (typeof info === 'number') return json({ detail: 'x' }, info)
      const fileUrl = `/api${url.replace(/^.*?\/api/, '').replace(/\/preview-info$/, '/file')}`
      return json({ mode: 'inline', file_url: fileUrl, embed_url: null, mime: PDF, size: 10, file_name: 'x', message: null, ...info })
    }
    return file ? file() : json({ detail: 'x' }, 404)
  })
}

const calledUrls = () => fetchMock.mock.calls.map(([url]) => String(url))

function workbook(rows: number): ArrayBuffer {
  const book = XLSX.utils.book_new()
  const data = [['Nombre', 'Nota'], ...Array.from({ length: rows }, (_, i) => [`Estudiante ${i + 1}`, i % 5])]
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(data), 'Notas')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Criterio'], ['Escrito']]), 'Criterios')
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

beforeEach(() => {
  useAppStore.getState().loginSuccess(makeUser(['estudiante']), 'token')
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
  // jsdom no navega: el clic del enlace de descarga solo se registra.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  fetchMock.mockReset()
  useAppStore.getState().logout()
})

const pdf = { path: filePaths.document('d1'), fileName: 'plan.pdf' }

describe('viewerKindForMime', () => {
  it('elige el visor por el tipo que informa el backend; lo demás no tiene vista previa', () => {
    expect([PDF, 'image/png', 'image/jpeg', DOCX, XLSX_MIME, 'application/msword', 'application/octet-stream', 'APPLICATION/PDF; charset=x'].map(viewerKindForMime))
      .toEqual(['pdf', 'image', 'image', 'docx', 'xlsx', 'none', 'none', 'pdf'])
  })
})

describe('Excel: límite real de 1.000 filas (sin dibujar)', () => {
  it('lee solo el encabezado y las primeras 1.000 filas, y avisa con el texto exacto', async () => {
    const [notas, criterios] = await readWorkbook(new Blob([workbook(1005)], { type: XLSX_MIME }))
    expect(MAX_SHEET_ROWS).toBe(1000)
    expect(notas.header).toEqual(['Nombre', 'Nota'])
    expect(notas.rows).toHaveLength(1000)
    expect(notas.rows[999][0]).toBe('Estudiante 1000')
    expect(notas.truncatedRows).toBe(true)
    expect(criterios.truncatedRows).toBe(false)
    expect(rowsLimitNotice()).toBe('Mostrando las primeras 1.000 filas. Descarga el archivo para verlo completo.')
  })
})

describe('VisorDocumento', () => {
  it('pide preview-info y luego el archivo con la sesión; muestra el PDF con Descargar', async () => {
    serve({ mime: PDF }, () => fileResponse('%PDF-1.7', PDF))
    render(<VisorDocumento file={pdf} />)

    expect(await screen.findByTitle('Vista previa de plan.pdf')).toHaveAttribute('src', expect.stringContaining('blob:visor'))
    expect(screen.getByRole('button', { name: /Descargar/ })).toBeEnabled()
    expect(calledUrls()).toEqual([expect.stringMatching(/\/documents\/d1\/preview-info$/), expect.stringMatching(/\/documents\/d1\/file$/)])
    for (const [, init] of fetchMock.mock.calls) expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token')
  })

  it('decide por el mime de preview-info, no por la extensión del nombre', async () => {
    // Se llama .pdf, pero el backend dice que es Word: se usa el visor de Word.
    serve({ mime: DOCX }, () => fileResponse('PK', DOCX))
    render(<VisorDocumento file={{ path: filePaths.document('d9'), fileName: 'mal-nombre.pdf' }} />)
    expect(await screen.findByText('Contenido del informe')).toBeInTheDocument()
  })

  it.each([403, 404])('con %i muestra el aviso de permiso', async (status) => {
    serve(status)
    render(<VisorDocumento file={pdf} />)
    expect(await screen.findByText(NO_ACCESS_MESSAGE)).toBeInTheDocument()
    expect(NO_ACCESS_MESSAGE).toBe('No tienes permiso para ver este documento o no existe')
  })

  it('archivo faltante: aviso, sin pedir el archivo y con Descargar deshabilitado', async () => {
    serve({ mode: 'missing', message: MISSING_FILE_MESSAGE, size: null })
    render(<VisorDocumento file={pdf} />)

    expect(await screen.findByText('Archivo no disponible. Pide que se vuelva a subir.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument() // es un aviso, no un error
    expect(screen.getByRole('button', { name: /Descargar/ })).toBeDisabled()
    expect(calledUrls()).toHaveLength(1)
  })

  it('sin vista previa (.doc) no baja el archivo hasta que se pide, y Descargar lo guarda', async () => {
    const user = userEvent.setup()
    serve({ mime: 'application/octet-stream' }, () => fileResponse('binario', 'application/octet-stream'))
    render(<VisorDocumento file={{ path: filePaths.document('d2'), fileName: 'viejo.doc' }} />)

    expect(await screen.findByText('Este formato no tiene vista previa')).toBeInTheDocument()
    expect(calledUrls()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /Descargar/ }))
    expect(calledUrls()[1]).toMatch(/\/documents\/d2\/file$/)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('sobre 15 MB (según preview-info) no descarga nada para la vista previa', async () => {
    serve({ mime: PDF, size: 16 * 1024 * 1024 }, () => fileResponse('x', PDF))
    render(<VisorDocumento file={pdf} />)

    expect(await screen.findByText('El archivo es muy grande para la vista previa')).toBeInTheDocument()
    expect(screen.getByText(/Pesa 16\.0 MB/)).toBeInTheDocument()
    expect(calledUrls()).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Descargar/ })).toBeEnabled()
  })

  it('si el tamaño no venía en preview-info, corta al ver el Content-Length', async () => {
    serve({ mime: PDF, size: null }, () => fileResponse('x', PDF, { 'Content-Length': String(16 * 1024 * 1024) }))
    render(<VisorDocumento file={pdf} />)
    expect(await screen.findByText('El archivo es muy grande para la vista previa')).toBeInTheDocument()
  })

  it('modo embed (previsto): usa el enlace del proveedor sin pedir el archivo', async () => {
    serve({ mode: 'embed', embed_url: 'https://preview.example/doc', mime: DOCX })
    render(<VisorDocumento file={pdf} />)
    expect(await screen.findByTitle('Vista previa de plan.pdf')).toHaveAttribute('src', 'https://preview.example/doc')
    expect(calledUrls()).toHaveLength(1)
  })

  it('Excel: una pestaña por hoja, encabezado fijo y aviso al pasar del límite de filas', async () => {
    const user = userEvent.setup()
    serve({ mime: XLSX_MIME }, () => fileResponse(workbook(8), XLSX_MIME))
    render(<VisorDocumento file={{ path: filePaths.document('d3'), fileName: 'notas.xlsx' }} maxSheetRows={5} />)

    const tabs = await screen.findAllByRole('tab', {}, { timeout: 10_000 })
    expect(tabs.map((t) => t.textContent)).toEqual(['Notas', 'Criterios'])
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Nombre', 'Nota'])
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 5)
    expect(screen.getByText('Mostrando las primeras 5 filas. Descarga el archivo para verlo completo.')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Criterios' }))
    expect(within(screen.getByRole('table')).getByText('Escrito')).toBeInTheDocument()
    expect(screen.queryByText(/Mostrando las primeras/)).not.toBeInTheDocument()
  })

  it('Excel corto: sin aviso de filas', async () => {
    serve({ mime: XLSX_MIME }, () => fileResponse(workbook(3), XLSX_MIME))
    render(<VisorDocumento file={{ path: filePaths.document('d4'), fileName: 'notas.xlsx' }} />)
    expect(await screen.findByText('Estudiante 3', {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.queryByText(/Mostrando las primeras/)).not.toBeInTheDocument()
  })

  it('Word: muestra el documento y quita los enlaces que no son web', async () => {
    serve({ mime: DOCX }, () => fileResponse('PK', DOCX))
    render(<VisorDocumento file={{ path: filePaths.document('d5'), fileName: 'informe.docx' }} />)

    expect(await screen.findByText('Contenido del informe')).toBeInTheDocument()
    await vi.waitFor(() => expect(screen.getByText('malo')).not.toHaveAttribute('href'))
    expect(screen.getByText('bueno')).toHaveAttribute('href', 'https://ucompensar.edu.co')
    expect(screen.getByText('bueno')).toHaveAttribute('rel', 'noopener noreferrer')
  })
})

describe('ArchivoAcciones', () => {
  it('"Ver" abre el visor del archivo y "Descargar" lo baja por el backend', async () => {
    const user = userEvent.setup()
    serve({ mime: PDF }, () => fileResponse('%PDF-1.7', PDF))
    const file = { path: filePaths.submission('p1', 's1'), fileName: 'entrega.pdf' }
    render(<ArchivoAcciones file={file} title="Propuesta inicial" downloadLabel="Descargar entrega" />)

    await user.click(screen.getByRole('button', { name: 'Descargar entrega: entrega.pdf' }))
    expect(calledUrls()[0]).toMatch(/\/processes\/p1\/work-plan\/submissions\/s1\/file$/)
    expect(createObjectURL).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Ver entrega.pdf' }))
    const dialog = screen.getByRole('dialog', { name: 'Documento entrega.pdf' })
    expect(await within(dialog).findByTitle('Vista previa de entrega.pdf')).toBeInTheDocument()
    expect(within(dialog).getByText('Tipo: Propuesta inicial')).toBeInTheDocument()
    expect(calledUrls()).toContainEqual(expect.stringMatching(/\/submissions\/s1\/preview-info$/))
  })
})
