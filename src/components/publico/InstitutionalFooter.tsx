import { Link } from 'react-router-dom'
import { ArrowUpRight, Instagram, Linkedin, Mail, MapPin, Phone } from 'lucide-react'
import brandLogo from '@/assets/logo1.jpg'

interface InstitutionalFooterProps {
  currentYear: number
}

const legalLinks = [
  { label: 'Derechos pecuniarios', href: 'https://ucompensar.edu.co/legal/' },
  { label: 'Estatuto General', href: 'https://ucompensar.edu.co/legal/' },
  { label: 'Reglamento Estudiantil', href: 'https://ucompensar.edu.co/legal/' },
  { label: 'Reglamento docente', href: 'https://ucompensar.edu.co/legal/' },
  { label: 'Reglamento de Bienestar', href: 'https://ucompensar.edu.co/legal/' },
]

const importantLinks = [
  { label: 'Documentos de interés', href: 'https://ucompensar.edu.co/documentos-de-interes/' },
  { label: 'Radica tus PQRSF', href: 'https://ucompensar.edu.co/soporte-crm/' },
  { label: 'Régimen Tributario Especial', href: 'https://ucompensar.edu.co/wp-content/uploads/2025/06/11-formulario-dian-52451002645299_presentado.pdf' },
  { label: 'Aviso de privacidad', href: 'https://ucompensar.edu.co/legal/' },
  { label: 'Línea Ética', href: 'mailto:etica@ucompensar.edu.co' },
]

const externalLinkClass = 'inline-flex items-center gap-1 text-sm text-white/85 underline decoration-white/30 underline-offset-4 transition-colors hover:text-[#FF8A50] hover:decoration-[#FF8A50] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF8A50]'

export function InstitutionalFooter({ currentYear }: InstitutionalFooterProps) {
  return (
    <footer className="w-full bg-[#073B57] px-5 py-10 text-white sm:px-8 sm:py-12">
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl">
        <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr] xl:gap-10">
          <div>
            <Link to="/" aria-label="UCompensar, ir al inicio" className="inline-flex rounded-xl bg-white p-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF8A50]">
              <img src={brandLogo} alt="Fundación Universitaria Compensar" className="h-24 w-24 object-contain" />
            </Link>
            <p className="mt-5 max-w-xl text-xs leading-6 text-white/80 sm:text-sm">
              Fundación Universitaria Compensar P.J. Resolución 23635 del 23 diciembre 1981 | 12455 del 9 de julio 2020. – VIGILADA MINEDUCACIÓN
            </p>
            <p className="mt-4 text-sm leading-6 text-white/80">
              Para requerimientos de autoridades, tutelas o notificaciones judiciales:
            </p>
            <a href="mailto:notificacionesjudiciales@ucompensar.edu.co" className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-[#FF8A50] underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              <Mail size={15} aria-hidden="true" /> notificacionesjudiciales@ucompensar.edu.co
            </a>

            <div className="mt-6 border-t border-white/20 pt-5">
              <h2 className="text-base font-bold">Síguenos en nuestras redes</h2>
              <div className="mt-3 flex flex-wrap gap-3">
                <a href="https://www.instagram.com/ucompensar/" target="_blank" rel="noreferrer" aria-label="Instagram oficial de UCompensar, abre en otra pestaña" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 px-3 text-sm text-white/90 transition-colors hover:border-[#FF8A50] hover:text-[#FF8A50] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF8A50]"><Instagram size={17} aria-hidden="true" /> Instagram <ArrowUpRight size={13} aria-hidden="true" /></a>
                <a href="https://www.linkedin.com/school/fundaci%C3%B3n-universitaria-compensar/" target="_blank" rel="noreferrer" aria-label="LinkedIn oficial de UCompensar, abre en otra pestaña" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 px-3 text-sm text-white/90 transition-colors hover:border-[#FF8A50] hover:text-[#FF8A50] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF8A50]"><Linkedin size={17} aria-hidden="true" /> LinkedIn <ArrowUpRight size={13} aria-hidden="true" /></a>
              </div>
            </div>

            <nav aria-label="Aspectos legales" className="mt-6 border-t border-white/20 pt-5">
              <h2 className="text-base font-bold">Aspectos legales</h2>
              <ul className="mt-2 divide-y divide-white/15">
                {legalLinks.map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} target="_blank" rel="noreferrer" className="block py-2.5 text-sm text-white/80 transition-colors hover:text-[#FF8A50] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF8A50]">{label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#145B78] p-5 sm:p-7 lg:p-8">
            <div className="grid gap-6 sm:grid-cols-3">
              <section aria-labelledby="footer-bogota">
                <h2 id="footer-bogota" className="text-xl font-bold text-[#FF8A50]">Bogotá</h2>
                <p className="mt-3 text-xs font-bold text-white">Sede Teusaquillo</p>
                <p className="mt-1 text-sm leading-6 text-white/80">Avenida (Calle) 32 No. 17 – 30</p>
                <div className="mt-3 flex items-start gap-2 text-sm leading-6 text-white/80"><Phone size={15} className="mt-1 shrink-0" aria-hidden="true" /><span className="flex flex-col"><a href="tel:+576013380666" className="hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF8A50]">601 338-06-66</a><a href="tel:+576019168565" className="hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF8A50]">601 916-85-65</a></span></div>
              </section>
              <section aria-labelledby="footer-campus">
                <h2 id="footer-campus" className="text-xl font-bold text-[#FF8A50]">Campus Av. 68</h2>
                <p className="mt-3 text-sm leading-6 text-white/80">Avenida Carrera 68 # 68 B - 10</p>
              </section>
              <section aria-labelledby="footer-villavicencio">
                <h2 id="footer-villavicencio" className="text-xl font-bold text-[#FF8A50]">Villavicencio</h2>
                <p className="mt-3 text-sm leading-6 text-white/80">Calle 33B #39-65, barrio El Barzal</p>
              </section>
            </div>

            <div className="mt-8 border-t border-dashed border-white/35 pt-6">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white/85"><MapPin size={16} className="text-[#FF8A50]" aria-hidden="true" /> Consulta sedes y contacto</h2>
              <a href="https://ucompensar.edu.co/sedes-y-contacto-uc/" target="_blank" rel="noreferrer" className={`${externalLinkClass} mt-3`}>Información institucional de sedes <ArrowUpRight size={14} aria-hidden="true" /></a>
            </div>
          </div>
        </div>

        <nav aria-label="Links importantes" className="mt-9 border-t border-white/25 pt-5 text-center">
          <h2 className="text-lg font-bold text-[#FF8A50]">Links importantes</h2>
          <ul className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-3">
            {importantLinks.map(({ label, href }) => (
              <li key={label}>
                <a href={href} target={href.startsWith('mailto:') ? undefined : '_blank'} rel={href.startsWith('mailto:') ? undefined : 'noreferrer'} className="inline-flex min-h-9 items-center text-xs font-semibold text-white/85 transition-colors hover:text-[#FF8A50] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF8A50] sm:text-sm">{label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-6 border-t border-white/15 pt-4 text-center text-xs text-white/65">
          Proyectos de grado · UCompensar · {currentYear}
        </div>
      </div>
    </footer>
  )
}
