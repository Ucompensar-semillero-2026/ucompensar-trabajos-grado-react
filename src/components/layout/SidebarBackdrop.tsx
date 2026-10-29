import campusPhoto from '@/assets/images/ucompensar-campus1.jpg'

// Fondo decorativo del sidebar: panal tecnológico (SVG inline) + fotografía del edificio.
// Todo es decorativo: aria-hidden y pointer-events-none, por debajo del contenido (z-10).

const BLUE = '#0876B9'
const LIGHT_BLUE = '#6FC3F0'
const ORANGE = '#FF6500'

const R = 30 // radio del hexágono (hexágonos de punta plana)
const STEP_X = 1.5 * R
const STEP_Y = Math.sqrt(3) * R
const VIEW_W = 264
const VIEW_H = 1000

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`
  }).join(' ')
}

// Pseudoaleatorio determinista: el patrón es siempre el mismo (sin Math.random en render).
function hash(col: number, row: number): number {
  const n = Math.sin(col * 127.1 + row * 311.7) * 43758.5453
  return n - Math.floor(n)
}

type CellKind = 'fill' | 'line' | 'accent'
interface Cell {
  cx: number
  cy: number
  r: number
  kind: CellKind
  col: number
  row: number
}

function buildCells(): Cell[] {
  const cells: Cell[] = []
  const cols = Math.ceil(VIEW_W / STEP_X) + 1
  const rows = Math.ceil(VIEW_H / STEP_Y) + 1
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const cx = col * STEP_X - 10
      const cy = row * STEP_Y + (col % 2 ? STEP_Y / 2 : 0) + 10
      const h = hash(col, row)
      // Más densidad hacia la derecha y en el tramo medio-inferior (donde el panal "respira" sobre
      // la fotografía); la zona del texto del menú queda más tranquila.
      const lowerBoost = Math.max(0, 1 - Math.abs(cy / VIEW_H - 0.62) / 0.3) * 0.24
      const density = 0.14 + (cx / VIEW_W) * 0.32 + lowerBoost
      if (h > density) continue
      const kind: CellKind = h < density * 0.15 ? 'accent' : h < density * 0.5 ? 'fill' : 'line'
      // Hexágonos de distintos tamaños
      const r = R * (0.62 + hash(row, col) * 0.36)
      cells.push({ cx, cy, r, kind, col, row })
    }
  }
  return cells
}

const CELLS = buildCells()

// Conexiones entre celdas cercanas (líneas de "circuito") y nodos luminosos.
const LINKS = CELLS.flatMap((a, i) =>
  CELLS.slice(i + 1)
    .filter((b) => Math.hypot(a.cx - b.cx, a.cy - b.cy) < STEP_Y * 1.15 && hash(a.col + b.col, a.row + b.row) > 0.45)
    .map((b) => ({ x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy, accent: a.kind === 'accent' || b.kind === 'accent' }))
)

const NODES = CELLS.filter((c) => hash(c.col * 3, c.row * 5) > 0.55).map((c, index) => {
  const vertex = Math.floor(hash(c.row, c.col * 7) * 6)
  const angle = (Math.PI / 3) * vertex
  return {
    x: c.cx + c.r * Math.cos(angle),
    y: c.cy + c.r * Math.sin(angle),
    orange: c.kind === 'accent' || index % 7 === 0,
  }
})

function HexPattern() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="sb-node-blue">
          <stop offset="0" stopColor={LIGHT_BLUE} stopOpacity="0.95" />
          <stop offset="1" stopColor={LIGHT_BLUE} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sb-node-orange">
          <stop offset="0" stopColor={ORANGE} stopOpacity="1" />
          <stop offset="1" stopColor={ORANGE} stopOpacity="0" />
        </radialGradient>
      </defs>

      {LINKS.map((l, i) => (
        <line
          key={`l${i}`}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={l.accent ? ORANGE : LIGHT_BLUE}
          strokeOpacity={l.accent ? 0.55 : 0.3}
          strokeWidth="0.8"
        />
      ))}

      {CELLS.map((c, i) => (
        <polygon
          key={`c${i}`}
          points={hexPoints(c.cx, c.cy, c.r)}
          fill={c.kind === 'fill' ? BLUE : 'none'}
          fillOpacity={c.kind === 'fill' ? 0.22 : 0}
          stroke={c.kind === 'accent' ? ORANGE : LIGHT_BLUE}
          strokeOpacity={c.kind === 'accent' ? 0.7 : c.kind === 'fill' ? 0.4 : 0.28}
          strokeWidth={c.kind === 'accent' ? 1.1 : 0.9}
        />
      ))}

      {NODES.map((n, i) => (
        <g key={`n${i}`}>
          <circle cx={n.x} cy={n.y} r={n.orange ? 10 : 7} fill={n.orange ? 'url(#sb-node-orange)' : 'url(#sb-node-blue)'} />
          <circle cx={n.x} cy={n.y} r={2} fill={n.orange ? '#FFB27A' : '#D8F0FF'} />
        </g>
      ))}
    </svg>
  )
}

interface SidebarBackdropProps {
  /** Con el menú contraído solo se conserva el panal (sin fotografía). */
  showPhoto: boolean
}

export function SidebarBackdrop({ showPhoto }: SidebarBackdropProps) {
  return (
    <>
      {showPhoto && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[30%] min-h-[230px]">
          <img
            src={campusPhoto}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-[80%_50%]"
          />
          {/* Se funde con el azul por arriba y se oscurece por abajo para la franja del perfil;
              el centro queda claro para que el edificio siga siendo reconocible. */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#052B41_0%,rgba(5,43,65,0.55)_28%,rgba(5,43,65,0.05)_62%,rgba(4,30,47,0.6)_100%)]" />
        </div>
      )}
      <HexPattern />
    </>
  )
}
