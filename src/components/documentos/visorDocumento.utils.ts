// Funciones puras del visor (separadas del componente para el fast refresh de Vite).
// Se cargan con el resto del visor; SheetJS sigue entrando con import() dinámico.

export type ViewerKind = 'pdf' | 'image' | 'docx' | 'xlsx' | 'none'

export function viewerKindFor(fileName: string): ViewerKind {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return 'image'
  if (ext === 'docx') return 'docx'
  if (ext === 'xlsx') return 'xlsx'
  return 'none'
}

const MIME_KINDS: Record<string, Exclude<ViewerKind, 'none'>> = {
  'application/pdf': 'pdf',
  'image/png': 'image',
  'image/jpeg': 'image',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
}

/** El visor se elige por el tipo que informa el backend (preview-info), no por la extensión. */
export function viewerKindForMime(mime: string): ViewerKind {
  return MIME_KINDS[mime.split(';')[0].trim().toLowerCase()] ?? 'none'
}

/** Filas y columnas que se muestran de cada hoja de Excel (el resto, descargando). */
export const MAX_SHEET_ROWS = 1000
export const MAX_SHEET_COLUMNS = 100

export interface SheetData {
  name: string
  header: string[]
  rows: string[][]
  truncatedRows: boolean
  truncatedColumns: boolean
}

/** "1000" -> "1.000" (sin depender del ICU del navegador). */
function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function rowsLimitNotice(maxRows = MAX_SHEET_ROWS): string {
  return `Mostrando las primeras ${groupThousands(maxRows)} filas. Descarga el archivo para verlo completo.`
}

export async function readWorkbook(blob: Blob, maxRows = MAX_SHEET_ROWS): Promise<SheetData[]> {
  const XLSX = await import('xlsx')
  // Solo valores: sin fórmulas ni HTML de las celdas.
  const workbook = XLSX.read(await blob.arrayBuffer(), { type: 'array', cellFormula: false, cellHTML: false, cellStyles: false })
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]
    const ref = sheet?.['!ref']
    if (!sheet || !ref) return { name, header: [], rows: [], truncatedRows: false, truncatedColumns: false }
    const range = XLSX.utils.decode_range(ref)
    // Se convierte solo lo que se va a mostrar: encabezado + maxRows filas, MAX_SHEET_COLUMNS columnas.
    const limited = {
      s: range.s,
      e: { r: Math.min(range.e.r, range.s.r + maxRows), c: Math.min(range.e.c, range.s.c + MAX_SHEET_COLUMNS - 1) },
    }
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, range: limited, defval: '', raw: false, blankrows: false })
    const asText = (row: unknown[]) => row.map((cell) => (cell == null ? '' : String(cell)))
    const [header = [], ...rows] = matrix.map(asText)
    const width = Math.max(header.length, ...rows.map((r) => r.length))
    const pad = (row: string[]) => (row.length < width ? [...row, ...Array<string>(width - row.length).fill('')] : row)
    return {
      name,
      header: pad(header),
      rows: rows.map(pad),
      truncatedRows: range.e.r - range.s.r > maxRows,
      truncatedColumns: range.e.c - range.s.c + 1 > MAX_SHEET_COLUMNS,
    }
  })
}
