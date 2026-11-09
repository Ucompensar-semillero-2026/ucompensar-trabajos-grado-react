// Funciones y constantes de ExtensionManager.tsx que no son componentes (fast refresh de Vite).


/** Vista previa de la nueva fecha (días calendario). El backend es quien la calcula y valida de verdad. */
export function previewDue(effectiveDue: string, days: number): string {
  const date = new Date(`${effectiveDue}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
