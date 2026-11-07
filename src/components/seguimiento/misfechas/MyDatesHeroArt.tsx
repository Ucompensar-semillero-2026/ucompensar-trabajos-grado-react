/** Ilustración pequeña del encabezado de Mis fechas y compromisos: calendario con marcas de cumplimiento. */
export function MyDatesHeroArt() {
  return (
    <svg viewBox="0 0 320 110" className="h-full w-full" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="mda-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0E6B9C" stopOpacity="0.18" />
          <stop offset="1" stopColor="#FF641D" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <ellipse cx="195" cy="58" rx="120" ry="46" fill="url(#mda-glow)" />
      <g transform="translate(150 12)">
        <rect x="0" y="10" width="112" height="84" rx="10" fill="#073047" />
        <rect x="5" y="26" width="102" height="63" rx="6" fill="#F3F7FC" />
        <rect x="22" y="2" width="8" height="22" rx="4" fill="#FF641D" />
        <rect x="82" y="2" width="8" height="22" rx="4" fill="#FF641D" />
        {[0, 1, 2, 3].map((r) =>
          [0, 1, 2, 3, 4].map((c) => (
            <rect key={`${r}-${c}`} x={12 + c * 19} y={33 + r * 13.5} width="14" height="9" rx="2.5" fill={r === 1 && c === 3 ? '#FF641D' : r === 2 && c === 1 ? '#16A34A' : '#CFE0EE'} />
          ))
        )}
        <circle cx="104" cy="82" r="14" fill="#16A34A" stroke="#fff" strokeWidth="3" />
        <path d="M97.5 82.5 l5 5 l9 -10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}
