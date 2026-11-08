// Archivos servidos por el backend con la sesión (cabecera Authorization).
// Todo archivo -- PDF, imagen, Word, Excel -- pasa por la MISMA regla de
// permisos del trámite, y ya no por URLs firmadas: tampoco hay problemas de
// CORS con R2, porque el navegador solo habla con la API.
import { ApiError, authHeaders, request, requestRaw } from './http'

/** Sobre este tamaño no se hace vista previa: solo se ofrece descargar. */
export const PREVIEW_MAX_BYTES = 15 * 1024 * 1024

export const filePaths = {
  document: (documentId: string) => `/documents/${documentId}/file`,
  submission: (processId: string, submissionId: string) => `/processes/${processId}/work-plan/submissions/${submissionId}/file`,
  template: (processId: string, deliverableId: string) => `/processes/${processId}/work-plan/deliverables/${deliverableId}/template/file`,
  /** Borrador vigente del estudiante (solo él lo ve), para revisarlo antes de entregar. */
  draft: (processId: string, deliverableId: string) => `/processes/${processId}/work-plan/deliverables/${deliverableId}/draft/file`,
}

/** Lo que el visor necesita para pedir y nombrar un archivo. */
export interface FileRef {
  /** Ruta de la API que entrega el archivo (ver filePaths). Termina en /file. */
  path: string
  fileName: string
}

/** Respuesta de .../preview-info: cómo mostrar el archivo. El visor decide por `mode`, no por el proveedor. */
export interface FilePreviewInfo {
  mode: 'inline' | 'embed' | 'missing'
  /** Ruta con /api (así la devuelve el backend). */
  file_url: string
  embed_url: string | null
  mime: string
  size: number | null
  file_name: string
  message: string | null
}

export const MISSING_FILE_MESSAGE = 'Archivo no disponible. Pide que se vuelva a subir.'

/** .../file -> .../preview-info (misma regla de permisos en el backend). */
export function previewInfoPath(filePath: string): string {
  return filePath.replace(/\/file$/, '/preview-info')
}

/** El backend devuelve file_url con /api; el cliente HTTP ya lo antepone. */
export function apiPath(fileUrl: string): string {
  return fileUrl.replace(/^\/api(?=\/)/, '')
}

export function fetchPreviewInfo(accessToken: string, file: FileRef, signal?: AbortSignal): Promise<FilePreviewInfo> {
  return request<FilePreviewInfo>(previewInfoPath(file.path), { headers: authHeaders(accessToken), signal })
}

export type LoadedFile = { kind: 'ok'; blob: Blob } | { kind: 'too-large'; size: number }

export const NO_ACCESS_MESSAGE = 'No tienes permiso para ver este documento o no existe'

/** Mensaje para la persona: 403 y 404 se tratan igual (el backend no confirma si el archivo existe). */
export function fileErrorMessage(error: unknown): string {
  if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return NO_ACCESS_MESSAGE
  if (error instanceof ApiError && error.status === 0) return error.message
  return 'No se pudo cargar el archivo. Intenta de nuevo o descárgalo.'
}

/**
 * Pide el archivo. Si declara (Content-Length) o resulta pesar más de `maxBytes`,
 * no se guarda: se corta la descarga y se devuelve 'too-large'.
 */
export async function fetchFile(accessToken: string, path: string, maxBytes = Number.POSITIVE_INFINITY, signal?: AbortSignal): Promise<LoadedFile> {
  const res = await requestRaw(path, { headers: authHeaders(accessToken), signal })
  const declared = Number(res.headers.get('Content-Length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes) {
    void res.body?.cancel().catch(() => undefined)
    return { kind: 'too-large', size: declared }
  }
  const blob = await res.blob()
  if (blob.size > maxBytes) return { kind: 'too-large', size: blob.size }
  return { kind: 'ok', blob }
}

/** Entrega al navegador un archivo ya descargado, con su nombre original. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Tras el clic el navegador ya tomó el archivo; se libera la memoria.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadFile(accessToken: string, file: FileRef): Promise<void> {
  const loaded = await fetchFile(accessToken, file.path)
  if (loaded.kind === 'ok') saveBlob(loaded.blob, file.fileName)
}

export function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}
