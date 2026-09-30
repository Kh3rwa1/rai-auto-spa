/**
 * Original static SVG doodles for the Washbook landing page.
 * Hand-drawn automotive style: dark ink outlines, paper fills, teal/mint/sun
 * accents. All decorative — parents must mark them aria-hidden.
 */

const INK = "#2b333c";
const TEAL = "#0d9488";
const MINT = "#ddefe4";
const SUN = "#f2c14e";
const PAPER = "#fffdf7";
const SKY = "#cfe8dd";

type ArtProps = { className?: string };

function Star({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const o = r * 0.36;
  return (
    <polygon
      points={`${x},${y - r} ${x + o},${y - o} ${x + r},${y} ${x + o},${y + o} ${x},${y + r} ${x - o},${y + o} ${x - r},${y} ${x - o},${y - o}`}
      fill={fill}
      stroke={INK}
      strokeWidth={4}
      strokeLinejoin="round"
    />
  );
}

function Bubble({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="none" stroke={TEAL} strokeWidth={4} />
      <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.22} fill={TEAL} opacity={0.7} />
    </g>
  );
}

export function HeroCar({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 640 440" className={className} aria-hidden="true" focusable="false">
      {/* sun */}
      <circle cx={566} cy={66} r={30} fill={SUN} stroke={INK} strokeWidth={6} />
      {/* hills */}
      <path d="M-10,336 Q120,252 268,318 T650,302 L650,450 L-10,450 Z" fill={MINT} opacity={0.6} />
      {/* bunting */}
      <path d="M8,34 Q320,96 632,28" fill="none" stroke={INK} strokeWidth={4} />
      {[
        { x: 88, y: 47, f: TEAL },
        { x: 168, y: 55, f: MINT },
        { x: 248, y: 60, f: SUN },
        { x: 328, y: 61, f: PAPER },
        { x: 408, y: 58, f: TEAL },
        { x: 488, y: 51, f: SUN },
        { x: 560, y: 43, f: MINT },
      ].map(({ x, y, f }) => (
        <polygon
          key={x}
          points={`${x},${y} ${x + 26},${y + 2} ${x + 12},${y + 26}`}
          fill={f}
          stroke={INK}
          strokeWidth={4}
          strokeLinejoin="round"
        />
      ))}
      {/* road */}
      <path
        d="M-10,376 C140,356 260,392 420,372 C520,360 590,368 650,360"
        fill="none"
        stroke={INK}
        strokeWidth={7}
        strokeLinecap="round"
      />
      {/* motion lines behind the car */}
      <g stroke={INK} strokeWidth={5} strokeLinecap="round" opacity={0.55}>
        <line x1={560} y1={242} x2={606} y2={238} />
        <line x1={566} y1={268} x2={614} y2={266} />
        <line x1={560} y1={294} x2={604} y2={296} />
      </g>
      {/* car body */}
      <path
        d="M96,320 L100,270 Q102,252 122,248 L172,238 L208,200 Q216,190 232,188 L382,185 Q400,185 412,197 L456,236 L520,246 Q540,249 542,270 L545,320 Z"
        fill={PAPER}
        stroke={INK}
        strokeWidth={7}
        strokeLinejoin="round"
      />
      {/* windows */}
      <polygon
        points="222,206 258,206 288,236 218,236"
        fill={SKY}
        stroke={INK}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <polygon
        points="268,206 372,204 396,234 296,236"
        fill={SKY}
        stroke={INK}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      {/* headlight + bumper */}
      <rect x={92} y={276} width={34} height={22} rx={11} fill={SUN} stroke={INK} strokeWidth={5} />
      <line x1={96} y1={312} x2={130} y2={312} stroke={INK} strokeWidth={6} strokeLinecap="round" />
      {/* soap suds on the roof */}
      <g fill={PAPER} stroke={INK} strokeWidth={5}>
        <circle cx={286} cy={168} r={20} />
        <circle cx={316} cy={160} r={24} />
        <circle cx={348} cy={168} r={18} />
        <circle cx={302} cy={146} r={14} />
      </g>
      {/* wheels */}
      <g>
        <circle cx={192} cy={326} r={42} fill={INK} />
        <circle cx={192} cy={326} r={16} fill={PAPER} />
        <circle cx={452} cy={326} r={42} fill={INK} />
        <circle cx={452} cy={326} r={16} fill={PAPER} />
      </g>
      {/* arches */}
      <path d="M142,320 A50,50 0 0 1 242,320" fill="none" stroke={INK} strokeWidth={6} />
      <path d="M402,320 A50,50 0 0 1 502,320" fill="none" stroke={INK} strokeWidth={6} />
      {/* bubbles + sparkles */}
      <Bubble x={120} y={140} r={11} />
      <Bubble x={162} y={108} r={8} />
      <Bubble x={508} y={150} r={12} />
      <Bubble x={544} y={112} r={8} />
      <Star x={88} y={220} r={16} fill={SUN} />
      <Star x={566} y={216} r={13} fill={MINT} />
    </svg>
  );
}

export function WashDoodle({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 320 240" className={className} aria-hidden="true" focusable="false">
      <polygon
        points="96,92 224,92 204,204 116,204"
        fill={TEAL}
        stroke={INK}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <ellipse cx={160} cy={92} rx={64} ry={14} fill={SKY} stroke={INK} strokeWidth={5} />
      <rect
        x={196}
        y={150}
        width={96}
        height={56}
        rx={16}
        fill={SUN}
        stroke={INK}
        strokeWidth={6}
      />
      <circle cx={222} cy={172} r={6} fill={PAPER} />
      <circle cx={246} cy={184} r={6} fill={PAPER} />
      <circle cx={266} cy={170} r={6} fill={PAPER} />
      <Bubble x={70} y={70} r={10} />
      <Bubble x={252} y={56} r={13} />
      <Bubble x={96} y={36} r={7} />
      <Star x={282} y={110} r={12} fill={MINT} />
    </svg>
  );
}

export function DetailDoodle({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 320 240" className={className} aria-hidden="true" focusable="false">
      <rect
        x={66}
        y={96}
        width={188}
        height={96}
        rx={44}
        fill={PAPER}
        stroke={INK}
        strokeWidth={7}
      />
      <rect
        x={106}
        y={66}
        width={108}
        height={52}
        rx={20}
        fill={SKY}
        stroke={INK}
        strokeWidth={6}
      />
      <circle cx={116} cy={150} r={17} fill={SUN} stroke={INK} strokeWidth={5} />
      <circle cx={204} cy={150} r={17} fill={SUN} stroke={INK} strokeWidth={5} />
      <path
        d="M138,168 Q160,182 182,168"
        fill="none"
        stroke={INK}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <g stroke={INK} strokeWidth={5} strokeLinecap="round" opacity={0.6}>
        <line x1={36} y1={120} x2={58} y2={128} />
        <line x1={262} y1={128} x2={284} y2={120} />
      </g>
      <Star x={52} y={70} r={14} fill={SUN} />
      <Star x={272} y={66} r={14} fill={MINT} />
      <Star x={272} y={196} r={10} fill={SUN} />
    </svg>
  );
}

export function WrapDoodle({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 320 240" className={className} aria-hidden="true" focusable="false">
      <rect
        x={56}
        y={52}
        width={150}
        height={48}
        rx={14}
        fill={TEAL}
        stroke={INK}
        strokeWidth={6}
      />
      <path
        d="M206,76 L252,76 L252,150"
        fill="none"
        stroke={INK}
        strokeWidth={10}
        strokeLinecap="round"
      />
      <rect
        x={236}
        y={150}
        width={32}
        height={52}
        rx={12}
        fill={SUN}
        stroke={INK}
        strokeWidth={6}
      />
      <path
        d="M70,116 q4,14 0,26 q-4,12 2,24"
        fill="none"
        stroke={TEAL}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M100,116 q4,14 0,26 q-4,12 2,24"
        fill="none"
        stroke={TEAL}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <g stroke={INK} strokeWidth={5}>
        <rect x={56} y={182} width={56} height={40} rx={10} fill={TEAL} />
        <rect x={124} y={182} width={56} height={40} rx={10} fill={MINT} />
        <rect x={192} y={182} width={56} height={40} rx={10} fill={SUN} />
      </g>
      <Star x={272} y={52} r={13} fill={MINT} />
    </svg>
  );
}

export function OwnerDoodle({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 480 340" className={className} aria-hidden="true" focusable="false">
      {/* signboard */}
      <rect x={52} y={180} width={16} height={140} fill={SUN} stroke={INK} strokeWidth={6} />
      <rect x={180} y={180} width={16} height={140} fill={SUN} stroke={INK} strokeWidth={6} />
      <rect
        x={24}
        y={70}
        width={200}
        height={112}
        rx={18}
        fill={PAPER}
        stroke={INK}
        strokeWidth={7}
      />
      <circle cx={66} cy={108} r={16} fill={SUN} stroke={INK} strokeWidth={5} />
      <line
        x1={96}
        y1={100}
        x2={188}
        y2={100}
        stroke={TEAL}
        strokeWidth={10}
        strokeLinecap="round"
      />
      <line
        x1={96}
        y1={126}
        x2={164}
        y2={126}
        stroke={INK}
        strokeWidth={7}
        strokeLinecap="round"
        opacity={0.5}
      />
      <line
        x1={96}
        y1={148}
        x2={188}
        y2={148}
        stroke={INK}
        strokeWidth={7}
        strokeLinecap="round"
        opacity={0.5}
      />
      {/* wrench */}
      <g transform="rotate(24 320 200)">
        <rect
          x={308}
          y={170}
          width={24}
          height={130}
          rx={12}
          fill={MINT}
          stroke={INK}
          strokeWidth={6}
        />
        <path
          d="M320,170 a30,30 0 1 0 2,2 M320,170 l14,-22 M322,172 l22,-10"
          fill="none"
          stroke={INK}
          strokeWidth={10}
          strokeLinecap="round"
        />
      </g>
      {/* spray bottle */}
      <g>
        <rect
          x={372}
          y={220}
          width={64}
          height={100}
          rx={16}
          fill={SKY}
          stroke={INK}
          strokeWidth={6}
        />
        <rect
          x={388}
          y={196}
          width={32}
          height={26}
          rx={8}
          fill={PAPER}
          stroke={INK}
          strokeWidth={5}
        />
        <line
          x1={420}
          y1={204}
          x2={448}
          y2={192}
          stroke={INK}
          strokeWidth={8}
          strokeLinecap="round"
        />
        <circle cx={458} cy={180} r={5} fill={TEAL} />
        <circle cx={446} cy={166} r={4} fill={TEAL} />
      </g>
      {/* checklist clipboard */}
      <g>
        <rect
          x={262}
          y={222}
          width={86}
          height={98}
          rx={12}
          fill={PAPER}
          stroke={INK}
          strokeWidth={6}
        />
        <rect
          x={288}
          y={212}
          width={34}
          height={20}
          rx={8}
          fill={SUN}
          stroke={INK}
          strokeWidth={5}
        />
        <polyline
          points="274,252 282,260 294,246"
          fill="none"
          stroke={TEAL}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1={300}
          y1={254}
          x2={334}
          y2={254}
          stroke={INK}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.5}
        />
        <polyline
          points="274,280 282,288 294,274"
          fill="none"
          stroke={TEAL}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1={300}
          y1={282}
          x2={334}
          y2={282}
          stroke={INK}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.5}
        />
      </g>
      <Bubble x={250} y={120} r={11} />
      <Bubble x={280} y={88} r={8} />
      <Star x={440} y={90} r={14} fill={SUN} />
    </svg>
  );
}
