import { cn } from '@/utils/cn'

/**
 * ÚNICO estilo de toda acción de «Entregar» de la plataforma: naranja institucional #FF641D, hover #E5530F, texto blanco en
 * negrita. Lo usan `DeliverButton` (botones) y los enlaces que llevan a entregar (p. ej. el panel de Inicio del estudiante).
 * Deshabilitado: naranja desaturado con texto oscuro, para que siga legible.
 */
const BASE =
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#FF641D] bg-[#FF641D] font-bold text-white transition-colors duration-150 ' +
  'hover:border-[#E5530F] hover:bg-[#E5530F] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF641D] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#18202F] ' +
  'disabled:cursor-not-allowed disabled:border-[#F3C7AD] disabled:bg-[#F3C7AD] disabled:text-[#7A3410] disabled:hover:border-[#F3C7AD] disabled:hover:bg-[#F3C7AD]'

const SIZE = {
  /** Filas de tabla y tarjetas (junto a «Ver detalle»). */
  sm: 'h-9 px-3 text-[12.5px]',
  /** Pie del modal, confirmación y panel lateral. */
  md: 'h-11 px-6 text-[13.5px] shadow-md shadow-orange-500/25 disabled:shadow-none',
  /** Solo icono (listas compactas de «Documentos y entregables»). */
  icon: 'h-9 w-9 px-0',
} as const

export type DeliverButtonSize = keyof typeof SIZE

export const deliverButtonClass = (size: DeliverButtonSize = 'sm', className?: string) => cn(BASE, SIZE[size], className)
