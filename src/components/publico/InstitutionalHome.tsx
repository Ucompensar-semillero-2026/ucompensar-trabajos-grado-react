import { ArrowRight, BookOpen, Lightbulb, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card } from '@/components/ui'
import { InstitutionalHeader } from './InstitutionalHeader'

export function InstitutionalHome() {
  return <div className="min-h-screen bg-white text-slate-800">
    <InstitutionalHeader />
    <main>
      <section className="relative isolate flex min-h-[560px] items-center overflow-hidden bg-[#172a49] px-6 py-20 text-white sm:px-10 lg:min-h-[620px]">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_78%_48%,rgba(0,173,186,.55),transparent_34%),radial-gradient(ellipse_at_70%_85%,rgba(255,102,0,.38),transparent_34%),linear-gradient(115deg,#172a49_10%,#243455_58%,#315765_100%)]" />
        <div aria-hidden="true" className="absolute -right-24 top-12 hidden h-[520px] w-[520px] rounded-full border border-white/10 lg:block"><div className="absolute inset-12 rounded-full border border-white/10" /><div className="absolute inset-28 rounded-full border border-white/10" /></div>
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[.18em] text-orange-200"><Lightbulb size={15} /> Proyectos de grado</span>
            <h1 className="mt-7 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">Convierte tus ideas en <span className="text-orange-300">proyectos</span> que avanzan.</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">Explora opciones de demostración para conocer cómo podría funcionar el catálogo de proyectos académicos.</p>
            <Link to="/proyectos-de-grado" className="mt-9 inline-flex"><Button size="lg" className="gap-3">Explorar proyectos <ArrowRight size={18} /></Button></Link>
          </div>
        </div>
        <div aria-hidden="true" className="absolute bottom-0 right-[8%] hidden h-40 w-52 skew-x-[-18deg] border-x border-t border-white/10 bg-white/[.03] lg:block" />
      </section>
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
        <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#e05a1e]">Tu siguiente paso</p><h2 className="mt-3 text-3xl font-bold text-[#243455] sm:text-4xl">Una idea puede abrir nuevos caminos</h2><p className="mt-4 text-slate-600">Este prototipo reúne una experiencia de navegación para consultar modalidades y ofertas de ejemplo.</p></div>
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {[{ Icon: BookOpen, title: 'Explora modalidades', text: 'Consulta categorías de ejemplo para organizar las propuestas.' }, { Icon: Users, title: 'Encuentra una opción', text: 'Revisa fichas demostrativas asociadas a cada modalidad.' }, { Icon: Lightbulb, title: 'Da el siguiente paso', text: 'Inicia sesión para continuar con el flujo de demostración.' }].map(({ Icon, title, text }) => <Card key={title} className="p-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#e05a1e]"><Icon size={22} /></span><h3 className="mt-5 text-xl font-bold text-[#243455]">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p></Card>)}
        </div>
      </section>
    </main>
    <footer className="border-t border-slate-200 bg-slate-50 px-5 py-6 text-center text-xs text-slate-500">Prototipo académico de navegación · Contenido de ofertas de demostración</footer>
  </div>
}
