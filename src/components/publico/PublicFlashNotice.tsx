import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { clearFlash, peekFlash, subscribeFlash, type PublicFlash } from '@/services/sessionFlash'

type Shown = Exclude<PublicFlash, { kind: 'manual_logout' }>

function registeredAtLabel(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' }).format(date)
}

/**
 * Confirmación de una postulación o propuesta ya registradas, mostrada tras cerrar la sesión. Es de un solo uso:
 * se lee, se elimina del almacenamiento y una recarga posterior no la vuelve a mostrar.
 */
export function PublicFlashNotice() {
  // La confirmación de cierre manual pertenece a /sesion-cerrada: aquí ni se muestra ni se consume.
  const peek = (): Shown | null => {
    const current = peekFlash()
    return current && current.kind !== 'manual_logout' ? current : null
  }
  const [flash, setFlash] = useState<Shown | null>(peek)

  useEffect(() => {
    if (peek()) clearFlash()
    return subscribeFlash(() => {
      const next = peek()
      if (next) clearFlash()
      setFlash(next)
    })
  }, [])

  if (!flash) return null
  const dismiss = () => {
    setFlash(null)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pt-6 sm:px-8">
      <section role="status" aria-live="polite" aria-labelledby="public-flash-title" className="rounded-2xl border border-[#BFE3CF] bg-[#EAF7F1] p-5 text-[#173B2A] shadow-sm sm:p-6">
        <p id="public-flash-title" className="flex items-center gap-2 text-lg font-bold text-[#15804B]">
          <CheckCircle2 size={22} aria-hidden="true" />
          {flash.kind === 'application' ? 'Tu postulación quedó registrada' : 'Recibimos tu propuesta'}
        </p>
        {flash.kind === 'application' ? (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2"><dt className="text-xs font-semibold text-[#3F6B55]">Oferta</dt><dd className="font-bold">{flash.offerTitle}</dd></div>
            <div><dt className="text-xs font-semibold text-[#3F6B55]">Modalidad</dt><dd>{flash.modality}</dd></div>
            <div><dt className="text-xs font-semibold text-[#3F6B55]">Código del trámite</dt><dd className="break-all font-mono text-xs">{flash.code}</dd></div>
            <div><dt className="text-xs font-semibold text-[#3F6B55]">Estado</dt><dd className="font-bold">{flash.state}</dd></div>
            <div><dt className="text-xs font-semibold text-[#3F6B55]">Fecha de registro</dt><dd>{registeredAtLabel(flash.registeredAt)}</dd></div>
          </dl>
        ) : (
          <p className="mt-2 text-sm">Código <strong>{flash.code}</strong> · «{flash.title}». Quedó en estado «Pendiente de revisión».</p>
        )}
        <Button type="button" className="mt-4 min-h-11 bg-[#FF6B35] px-4 text-white hover:bg-[#F4511E]" onClick={dismiss}>
          Volver al catálogo <ArrowRight size={16} aria-hidden="true" />
        </Button>
      </section>
    </div>
  )
}
