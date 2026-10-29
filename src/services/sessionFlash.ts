/**
 * Estado temporal de UN SOLO USO que sobrevive a una recarga de la página:
 *  - la confirmación de una operación pública ya registrada por el backend (postulación o propuesta);
 *  - la confirmación del cierre de sesión manual.
 *
 * Solo guarda datos mínimos y no sensibles (código, título, estado): nunca tokens, contraseñas ni datos personales.
 * Se consume y elimina al mostrarse; una recarga posterior no repite la confirmación. Caduca a los 10 minutos.
 */

export type PublicFlash =
  | { kind: 'application'; offerTitle: string; modality: string; code: string; state: string; registeredAt: string }
  | { kind: 'proposal'; code: string; title: string }
  // Solo el cierre voluntario (botón «Cerrar sesión») muestra una confirmación de sesión cerrada.
  | { kind: 'manual_logout' }

const FLASH_KEY = 'ucomp_public_flash'
const TTL_MS = 10 * 60 * 1000

interface Stored<T> {
  value: T
  at: number
}

// Respaldo en memoria por si sessionStorage no está disponible (modo privado estricto): cubre la navegación
// dentro de la misma carga; tras una recarga completa de Microsoft no podría conservarse.
const memory = new Map<string, string>()

function write(key: string, value: unknown) {
  const raw = JSON.stringify({ value, at: Date.now() } satisfies Stored<unknown>)
  memory.set(key, raw)
  try {
    sessionStorage.setItem(key, raw)
  } catch {
    // sin sessionStorage solo queda el respaldo en memoria
  }
}

function read<T>(key: string): T | null {
  let raw: string | null = memory.get(key) ?? null
  try {
    raw = sessionStorage.getItem(key) ?? raw
  } catch {
    // se usa el respaldo en memoria
  }
  if (!raw) return null
  try {
    const stored = JSON.parse(raw) as Stored<T>
    return Date.now() - stored.at <= TTL_MS ? stored.value : null
  } catch {
    return null
  }
}

function remove(key: string) {
  memory.delete(key)
  try {
    sessionStorage.removeItem(key)
  } catch {
    // nada que limpiar
  }
}

// ── Confirmación pública ──────────────────────────────────────────────────────

const listeners = new Set<() => void>()

export function setFlash(flash: PublicFlash) {
  write(FLASH_KEY, flash)
  listeners.forEach((listener) => listener())
}

export const peekFlash = (): PublicFlash | null => read<PublicFlash>(FLASH_KEY)
export const clearFlash = () => remove(FLASH_KEY)

export function subscribeFlash(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
