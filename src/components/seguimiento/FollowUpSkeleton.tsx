const block = 'rounded-2xl bg-slate-200/80 animate-pulse motion-reduce:animate-none dark:bg-white/10'

/** Marcador de carga con la misma estructura que la pantalla: KPI, columna izquierda y tabla. */
export function FollowUpSkeleton() {
  return (
    <div role="status" aria-label="Cargando seguimiento" className="space-y-5">
      <span className="sr-only">Cargando seguimiento…</span>
      <div className="grid grid-cols-2 min-[940px]:grid-cols-4 min-[1500px]:grid-cols-7 gap-3">
        {Array.from({ length: 7 }, (_, i) => <div key={i} className={`${block} h-[128px]`} />)}
      </div>
      <div className={`${block} h-[108px]`} />
      <div className="grid grid-cols-1 gap-5 min-[1760px]:grid-cols-[minmax(290px,330px)_minmax(0,1fr)]">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 min-[1760px]:grid-cols-1"><div className={`${block} h-[230px]`} /><div className={`${block} h-[300px]`} /></div>
        <div className={`${block} h-[470px]`} />
      </div>
    </div>
  )
}
