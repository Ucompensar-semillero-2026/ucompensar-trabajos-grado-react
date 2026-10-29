// Capa decorativa del banner de /proyectos-de-grado: hexágonos conectados, nodos luminosos,
// paneles holográficos con gráficos y líneas técnicas. Es SVG inline ligero, sin animaciones
// (respeta prefers-reduced-motion por construcción), aria-hidden y sin interceptar clics.
// El título, la descripción y el botón siguen siendo texto real del DOM; esta capa va encima del
// degradado (para que los paneles se vean) pero no recibe eventos.

const ELECTRIC = '#3DA5FF'
const ORANGE = '#FF7A2F'

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

function Node({ x, y, color = 'blue', r = 9 }: { x: number; y: number; color?: 'blue' | 'orange'; r?: number }) {
  const orange = color === 'orange'
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={orange ? 'url(#hero-glow-orange)' : 'url(#hero-glow-blue)'} />
      <circle cx={x} cy={y} r={orange ? 4.5 : 3.5} fill={orange ? ORANGE : '#7CC4FF'} />
    </g>
  )
}

const BARS = [18, 30, 24, 44, 36, 56, 48, 68]

function Panel({ children, transform }: { children: React.ReactNode; transform: string }) {
  return (
    <g transform={transform}>
      <rect width="258" height="150" rx="10" fill="url(#hero-panel-fill)" stroke={ELECTRIC} strokeOpacity="0.85" strokeWidth="1.6" />
      <rect x="4" y="4" width="250" height="142" rx="7" fill="none" stroke="#9AD2FF" strokeOpacity="0.18" />
      {children}
    </g>
  )
}

export function HeroTechOverlay() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[15] hidden h-full w-full md:block"
      viewBox="0 0 1600 980"
      preserveAspectRatio="xMinYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="hero-glow-blue">
          <stop offset="0" stopColor="#6CC0FF" stopOpacity="0.9" />
          <stop offset="1" stopColor="#6CC0FF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hero-glow-orange">
          <stop offset="0" stopColor={ORANGE} stopOpacity="1" />
          <stop offset="1" stopColor={ORANGE} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hero-panel-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1B6FC4" stopOpacity="0.3" />
          <stop offset="1" stopColor="#0B3F7A" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id="hero-bar" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#1E78D6" />
          <stop offset="1" stopColor="#5CC0FF" />
        </linearGradient>
        <linearGradient id="hero-streak" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={ELECTRIC} stopOpacity="0" />
          <stop offset="0.5" stopColor={ELECTRIC} stopOpacity="0.9" />
          <stop offset="1" stopColor={ELECTRIC} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Hexágonos conectados en el borde izquierdo */}
      <g fill="none" stroke={ELECTRIC} strokeOpacity="0.45" strokeWidth="1.3">
        <polygon points={hexPoints(36, 90, 100)} />
        <polygon points={hexPoints(30, 420, 84)} fill="#1B6FC4" fillOpacity="0.12" />
        <polygon points={hexPoints(90, 610, 72)} />
        <polygon points={hexPoints(-10, 262, 46)} strokeOpacity="0.3" />
      </g>
      <g stroke={ELECTRIC} strokeOpacity="0.5" strokeWidth="1">
        <line x1="32" y1="180" x2="32" y2="282" />
        <polyline points="34,282 110,330 130,420" fill="none" strokeOpacity="0.4" />
        <polyline points="42,500 100,560 108,650" fill="none" />
        <line x1="45" y1="660" x2="45" y2="740" />
      </g>
      <Node x={33} y={284} color="orange" r={11} />
      <Node x={42} y={380} />
      <Node x={42} y={498} color="orange" r={11} />
      <Node x={108} y={650} color="orange" r={9} />
      <Node x={45} y={740} />
      <Node x={184} y={788} />

      {/* Paneles holográficos (solo desde pantallas anchas, para no tapar el texto) */}
      <g className="hidden min-[1500px]:inline">
        <Panel transform="translate(478 52) skewY(5)">
          {/* birrete */}
          <g transform="translate(26 30)">
            <polygon points="0,16 40,2 80,16 40,30" fill="#8CCBFF" fillOpacity="0.85" />
            <path d="M14,24 v14 q26,12 52,0 v-14" fill="none" stroke="#8CCBFF" strokeWidth="2.5" />
            <line x1="80" y1="16" x2="80" y2="42" stroke={ORANGE} strokeWidth="2" />
          </g>
          {[0, 1, 2].map((i) => (
            <rect key={i} x="26" y={94 + i * 14} width={150 - i * 28} height="4" rx="2" fill="#8CCBFF" fillOpacity="0.45" />
          ))}
          {BARS.map((h, i) => (
            <rect key={i} x={140 + i * 12} y={118 - h} width="7" height={h} rx="1.5" fill="url(#hero-bar)" />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x="176" y={26 + i * 8} width={60 - (i % 2) * 14} height="3" rx="1.5" fill="#8CCBFF" fillOpacity="0.4" />
          ))}
        </Panel>

        <Panel transform="translate(461 640) skewY(4)">
          {/* documento dentro de un anillo */}
          <g transform="translate(58 70)">
            <circle r="34" fill="none" stroke="#8CCBFF" strokeWidth="2.2" />
            <rect x="-14" y="-18" width="28" height="36" rx="3" fill="none" stroke="#8CCBFF" strokeWidth="2" />
            {[-8, -1, 6].map((y) => (
              <line key={y} x1="-8" y1={y} x2="8" y2={y} stroke="#8CCBFF" strokeWidth="1.6" />
            ))}
          </g>
          {[0, 1].map((i) => (
            <rect key={i} x="26" y={118 + i * 12} width={86 - i * 20} height="4" rx="2" fill="#8CCBFF" fillOpacity="0.45" />
          ))}
          {BARS.map((h, i) => (
            <rect key={i} x={150 + i * 12} y={128 - h * 0.9} width="7" height={h * 0.9} rx="1.5" fill="url(#hero-bar)" />
          ))}
          {[0, 1, 2].map((i) => (
            <rect key={i} x="130" y={28 + i * 9} width={104 - i * 18} height="3" rx="1.5" fill="#8CCBFF" fillOpacity="0.4" />
          ))}
        </Panel>
      </g>

      {/* Líneas técnicas y circuitos en la esquina inferior izquierda */}
      <g fill="none">
        <path d="M0,812 L470,980" stroke="url(#hero-streak)" strokeWidth="2.2" />
        <path d="M0,846 L400,980" stroke="url(#hero-streak)" strokeWidth="1" strokeOpacity="0.6" />
        <polyline points="360,812 460,836 580,884 618,930" stroke={ELECTRIC} strokeOpacity="0.45" strokeWidth="1" />
        <polyline points="452,834 468,812" stroke={ORANGE} strokeOpacity="0.6" strokeWidth="1" />
      </g>
      <Node x={438} y={812} color="orange" r={10} />
      <Node x={560} y={874} color="orange" r={10} />
      <Node x={618} y={936} />
      <Node x={425} y={880} r={7} />
    </svg>
  )
}
