// Funciones y constantes de ProjectDetail.tsx que no son componentes (fast refresh de Vite).


/** Solo se acepta volver al propio portafolio (con sus filtros en la query); cualquier otro valor cae al portafolio sin filtros. */
export function safePortfolioReturn(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith(PORTFOLIO_PATH)) return PORTFOLIO_PATH
  const rest = value.slice(PORTFOLIO_PATH.length)
  return rest === '' || (rest.startsWith('?') && !rest.includes('#')) ? value : PORTFOLIO_PATH
}

export const PORTFOLIO_PATH = '/coordinacion/portafolio'
