import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { Upload } from 'lucide-react'
import { deliverButtonClass, type DeliverButtonSize } from './deliverButtonStyle'

interface Props extends Omit<ComponentPropsWithoutRef<'button'>, 'children'> {
  size?: DeliverButtonSize
  /** Icono blanco a la izquierda (por defecto, el de subida). */
  icon?: ReactNode
  /** Sin texto (size="icon"): el nombre accesible va en `aria-label`. */
  children?: ReactNode
}

/**
 * Botón de «Entregar» con el estilo naranja institucional único (ver `deliverButtonStyle.ts`).
 * `forwardRef`: React 18 no entrega `ref` a componentes de función (el diálogo de confirmación enfoca este botón).
 */
export const DeliverButton = forwardRef<HTMLButtonElement, Props>(function DeliverButton(
  { size = 'sm', icon, children, className, type = 'button', ...rest },
  ref
) {
  return (
    <button ref={ref} type={type} className={deliverButtonClass(size, className)} {...rest}>
      {icon ?? <Upload size={size === 'sm' ? 14 : 16} aria-hidden="true" />}
      {children}
    </button>
  )
})
