/** Ilustración pequeña del encabezado de Documentos y entregables: hoja con texto y nube de almacenamiento con flecha de carga. */
export function DocumentsHeroArt() {
  return (
    <svg viewBox="0 0 320 110" className="h-full w-full" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="dha-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0E6B9C" stopOpacity="0.18" />
          <stop offset="1" stopColor="#FF641D" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="dha-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7DD3FC" />
          <stop offset="1" stopColor="#0E6B9C" />
        </linearGradient>
      </defs>
      <ellipse cx="190" cy="58" rx="125" ry="46" fill="url(#dha-glow)" />
      <g transform="translate(120 18)">
        <rect x="0" y="0" width="82" height="74" rx="8" fill="#073047" />
        <rect x="6" y="6" width="70" height="62" rx="5" fill="#F3F7FC" />
        <rect x="14" y="16" width="38" height="5" rx="2.5" fill="#0E6B9C" />
        <rect x="14" y="28" width="54" height="4" rx="2" fill="#B6C6D8" />
        <rect x="14" y="38" width="48" height="4" rx="2" fill="#B6C6D8" />
        <rect x="14" y="48" width="30" height="4" rx="2" fill="#B6C6D8" />
        <circle cx="64" cy="55" r="9" fill="#FF641D" />
        <path d="M60 56 l3 3 l6 -7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="translate(206 14)">
        <path d="M22 54 a17 17 0 0 1 3 -33 a24 24 0 0 1 46 6 a15 15 0 0 1 -2 27 z" fill="url(#dha-cloud)" />
        <path d="M46 46 V28 M38 35 l8 -8 l8 8" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}
