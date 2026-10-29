// Bloqueo del scroll del documento mientras hay un diálogo abierto. Lleva la cuenta de los
// bloqueos activos y restaura EXACTAMENTE los estilos originales cuando se libera el último,
// sin importar el orden de montaje/desmontaje (StrictMode, diálogos apilados, navegación).
let activeLocks = 0
let saved: { overflow: string; paddingRight: string } | null = null

export function lockScroll(): () => void {
  const body = document.body
  if (activeLocks === 0) {
    saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
    // Compensa el ancho de la barra de scroll para que el fondo no "salte" al bloquear.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollbarWidth > 0) {
      const current = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0
      body.style.paddingRight = `${current + scrollbarWidth}px`
    }
    body.style.overflow = 'hidden'
  }
  activeLocks += 1

  let released = false
  return () => {
    if (released) return
    released = true
    activeLocks = Math.max(0, activeLocks - 1)
    if (activeLocks === 0 && saved) {
      body.style.overflow = saved.overflow
      body.style.paddingRight = saved.paddingRight
      saved = null
    }
  }
}

export function resetScrollToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
}
