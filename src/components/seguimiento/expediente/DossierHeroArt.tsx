/** Ilustración del proyecto de grado: libros, portátil con gráfico de avance, bombilla de investigación y diana de objetivos. */
export function DossierHeroArt() {
  return (
    <svg viewBox="0 0 320 210" className="h-full w-full" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="dha-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EFF6FF" />
          <stop offset="1" stopColor="#C7DDFB" />
        </linearGradient>
        <radialGradient id="dha-bulb" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#FFF4B8" />
          <stop offset="0.55" stopColor="#FFC93C" />
          <stop offset="1" stopColor="#F59E0B" />
        </radialGradient>
        <linearGradient id="dha-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B82F6" stopOpacity="0.35" />
          <stop offset="1" stopColor="#3B82F6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="170" cy="120" rx="150" ry="86" fill="url(#dha-glow)" />
      {/* libros */}
      <g transform="translate(18 120)">
        <rect x="0" y="40" width="104" height="22" rx="4" fill="#1D4ED8" />
        <rect x="4" y="44" width="92" height="14" rx="2" fill="#F8FAFC" />
        <rect x="10" y="18" width="96" height="22" rx="4" fill="#FF6B1A" />
        <rect x="14" y="22" width="84" height="14" rx="2" fill="#FFF7ED" />
        <rect x="2" y="-2" width="98" height="20" rx="4" fill="#0EA5E9" />
        <rect x="6" y="2" width="86" height="12" rx="2" fill="#F0F9FF" />
      </g>
      {/* portátil */}
      <g transform="translate(98 58)">
        <rect x="0" y="0" width="150" height="98" rx="9" fill="#0F2A4A" />
        <rect x="7" y="7" width="136" height="84" rx="5" fill="url(#dha-screen)" />
        <rect x="18" y="58" width="15" height="24" rx="2" fill="#93C5FD" />
        <rect x="40" y="46" width="15" height="36" rx="2" fill="#60A5FA" />
        <rect x="62" y="52" width="15" height="30" rx="2" fill="#3B82F6" />
        <rect x="84" y="34" width="15" height="48" rx="2" fill="#2563EB" />
        <rect x="106" y="24" width="15" height="58" rx="2" fill="#1D4ED8" />
        <polyline points="20,50 46,38 68,44 92,26 118,16" fill="none" stroke="#FF6B1A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="118" cy="16" r="4" fill="#FF6B1A" />
        <rect x="18" y="14" width="34" height="5" rx="2.5" fill="#94A3B8" />
        <rect x="18" y="23" width="22" height="5" rx="2.5" fill="#CBD5E1" />
        <path d="M-16 98 H166 L156 108 H-6 Z" fill="#334155" />
        <rect x="52" y="98" width="46" height="3" rx="1.5" fill="#64748B" />
      </g>
      {/* bombilla */}
      <g transform="translate(118 2)">
        <circle cx="22" cy="24" r="20" fill="url(#dha-bulb)" />
        <rect x="14" y="42" width="16" height="9" rx="2" fill="#94A3B8" />
        <rect x="16" y="51" width="12" height="4" rx="2" fill="#64748B" />
        <path d="M-6 24h-8M50 24h8M22 -8v-6M0 4l-6-6M44 4l6-6" stroke="#FFC93C" strokeWidth="3" strokeLinecap="round" />
      </g>
      {/* diana */}
      <g transform="translate(232 120)">
        <circle cx="34" cy="34" r="34" fill="#FF6B1A" />
        <circle cx="34" cy="34" r="25" fill="#FFFFFF" />
        <circle cx="34" cy="34" r="16" fill="#FF6B1A" />
        <circle cx="34" cy="34" r="7" fill="#FFFFFF" />
        <path d="M34 34 L74 -6" stroke="#0F2A4A" strokeWidth="4" strokeLinecap="round" />
        <path d="M66 -10 l12 -2 -2 12 z" fill="#0F2A4A" />
      </g>
    </svg>
  )
}
