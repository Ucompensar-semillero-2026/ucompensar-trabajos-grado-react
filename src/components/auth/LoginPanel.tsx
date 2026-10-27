import { BookOpen, LineChart, ShieldCheck } from 'lucide-react'
import panelPhoto from '@/assets/images/Imagen Dashboard.jpg'

const highlights = [
  {
    icon: BookOpen,
    title: 'Modalidades académicas',
    desc: 'Encuentra alternativas para desarrollar tu proyecto.',
  },
  {
    icon: LineChart,
    title: 'Seguimiento del proceso',
    desc: 'Consulta la información y los avances de tu trámite.',
  },
  {
    icon: ShieldCheck,
    title: 'Acceso institucional',
    desc: 'Ingresa con las credenciales habilitadas para la plataforma.',
  },
]

export function LoginPanel() {
  return (
    <div className="relative flex min-h-[540px] w-full flex-col justify-end overflow-hidden bg-[#052b41] px-6 py-7 sm:px-9 min-w-0 md:w-[46%] md:flex-none md:py-9 lg:px-12">
      <img
        src={panelPhoto}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[50%_18%]"
      />
      {/* Capa horizontal: navy intenso tras el texto → teal suave → casi transparente (~70 % del ancho) */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(5,43,65,0.82)_0%,rgba(7,59,87,0.58)_35%,rgba(6,176,185,0.2)_70%,rgba(6,176,185,0)_100%)]" />
      {/* Base oscura que sube solo hasta la zona del texto, para que el pie siga legible */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,rgba(5,43,65,0.78)_0%,rgba(5,43,65,0.4)_28%,rgba(5,43,65,0)_58%)]" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border-[22px] border-white/[0.06]" />

      <div className="relative z-10 min-w-0 md:w-[52%] md:max-w-[360px]">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f4d29d] sm:text-xs">
          Portal académico
        </p>

        <h1 className="font-display text-[32px] font-bold leading-[1.05] tracking-tight text-white md:text-[clamp(30px,3.3vw,44px)]">
          Impulsa tu<br />proyecto de<br />grado.
        </h1>

        <p className="mt-4 max-w-[440px] text-[14px] leading-[1.6] text-white/90 [text-shadow:0_1px_3px_rgba(5,43,65,0.55)] md:max-w-none">
          Explora modalidades, consulta oportunidades académicas y avanza en tu proceso de titulación desde UCompensar.
        </p>

        <ul className="mt-6 hidden flex-col gap-3.5 md:flex">
          {highlights.map(({ icon: Icon, title, desc }) => (
            <li key={title} className="flex items-start gap-3.5">
              <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm">
                <Icon size={17} strokeWidth={1.7} className="text-white" aria-hidden="true" />
              </span>
              <div className="[text-shadow:0_1px_3px_rgba(5,43,65,0.55)]">
                <p className="text-[13px] font-semibold text-white lg:text-[15px]">{title}</p>
                <p className="mt-0.5 text-[12px] leading-5 text-white/75 lg:text-[14px]">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="group relative z-10 mt-6 w-fit">
        <a
          href="https://www.tiktok.com/@agenciaateneabogota/photo/7634718930216471815?image_index=5"
          target="_blank"
          rel="noopener noreferrer"
          aria-describedby="photo-credit-tooltip"
          className="rounded text-[12px] text-white/80 underline underline-offset-4 transition-colors hover:text-white focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Crédito de la imagen
        </a>
        <span
          id="photo-credit-tooltip"
          role="tooltip"
          className="pointer-events-none invisible absolute bottom-full left-0 mb-2 w-max max-w-[min(280px,80vw)] rounded-lg bg-[#052b41] px-3 py-2 text-[12px] leading-5 text-white opacity-0 shadow-lg ring-1 ring-white/20 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
        >
          Fuente: Agencia Atenea Bogotá (@agenciaateneabogota). Ver publicación original.
        </span>
      </div>
    </div>
  )
}
