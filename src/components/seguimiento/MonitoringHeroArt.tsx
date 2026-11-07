/** Ilustración decorativa del encabezado de Seguimiento y alertas: portátil con gráfico, campana de alerta y verificación. */
export function MonitoringHeroArt() {
  return (
    <svg viewBox="0 0 340 150" className="h-full w-full" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="mha-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C4B5FD" stopOpacity="0.55" />
          <stop offset="1" stopColor="#93C5FD" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="mha-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EFF6FF" />
          <stop offset="1" stopColor="#DBEAFE" />
        </linearGradient>
        <linearGradient id="mha-bell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFB020" />
          <stop offset="1" stopColor="#FF6500" />
        </linearGradient>
      </defs>
      <ellipse cx="215" cy="84" rx="150" ry="62" fill="url(#mha-glow)" />
      <g transform="translate(150 28)">
        <rect x="0" y="0" width="132" height="84" rx="8" fill="#1E3A8A" />
        <rect x="6" y="6" width="120" height="72" rx="5" fill="url(#mha-screen)" />
        <rect x="16" y="48" width="14" height="22" rx="2" fill="#93C5FD" />
        <rect x="36" y="38" width="14" height="32" rx="2" fill="#60A5FA" />
        <rect x="56" y="44" width="14" height="26" rx="2" fill="#3B82F6" />
        <rect x="76" y="28" width="14" height="42" rx="2" fill="#2563EB" />
        <polyline points="16,44 40,32 62,38 84,20 112,14" fill="none" stroke="#FF6500" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="112" cy="14" r="4" fill="#FF6500" />
        <path d="M-14 90 H146 L138 98 H-6 Z" fill="#334155" />
        <rect x="46" y="90" width="40" height="3" rx="1.5" fill="#64748B" />
      </g>
      <g transform="translate(96 14)">
        <path d="M30 6c-3-5-9-5-12 0-9 3-14 12-14 24v14l-8 10h56l-8-10V30c0-12-5-21-14-24z" fill="url(#mha-bell)" />
        <ellipse cx="24" cy="62" rx="9" ry="6" fill="#F59E0B" />
        <path d="M-6 18l-9-6M-4 8l-5-9M60 8l6-8M64 20l9-4" stroke="#FFB020" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
      <g transform="translate(262 78)">
        <circle cx="26" cy="26" r="26" fill="#16A34A" />
        <circle cx="26" cy="26" r="26" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="3" />
        <path d="M14 27l8 8 16-17" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}
