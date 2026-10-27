/** Ruta a la que vuelve Microsoft para retomar la postulación (ver ProjectDetail). */
export function applicationReturnPath(offerId: string): string {
  return `/proyectos-de-grado/${encodeURIComponent(offerId)}?postular=1`
}
