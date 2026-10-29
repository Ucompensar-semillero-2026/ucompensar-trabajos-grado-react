import { Navigate, useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { clearFlash, peekFlash } from '@/services/sessionFlash'

/**
 * Confirmación del cierre VOLUNTARIO de sesión. Solo existe tras pulsar «Cerrar sesión»: depende de una marca de un
 * solo uso (sin datos, sin tokens) que se elimina al pulsar el botón. Sin esa marca (acceso directo, recarga posterior)
 * redirige al login, así que nunca reaparece un aviso antiguo. No se oculta por tiempo.
 */
export function SessionClosedScreen() {
  const navigate = useNavigate()
  if (peekFlash()?.kind !== 'manual_logout') return <Navigate to="/login" replace />

  const goToLogin = () => {
    clearFlash()
    navigate('/login', { replace: true })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F6F8] px-5 py-10">
      <section role="status" aria-labelledby="session-closed-title" className="w-full max-w-md rounded-3xl border border-[#DCE5E9] bg-white p-8 text-center shadow-[0_18px_42px_rgba(7,59,87,0.08)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF7F1] text-[#15804B]"><CheckCircle2 size={32} aria-hidden="true" /></div>
        <h1 id="session-closed-title" className="mt-5 text-2xl font-bold text-[#073B57]">Has cerrado sesión correctamente</h1>
        <Button type="button" className="mt-7 min-h-11 w-full bg-[#FF6B35] px-4 font-bold text-white hover:bg-[#F4511E]" onClick={goToLogin}>
          Continuar al inicio de sesión
        </Button>
      </section>
    </main>
  )
}
