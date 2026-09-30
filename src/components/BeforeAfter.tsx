import { useRef, useState, type PointerEvent } from "react";

export function BeforeAfter({
  before,
  after,
  beforeLabel = "Your Car Now",
  afterLabel,
}: {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel: string;
}) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const move = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };
  const down = (e: PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    move(e.clientX);
  };
  return (
    <div
      ref={ref}
      className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl bg-muted touch-none cursor-ew-resize shadow-[var(--shadow-soft)]"
      onPointerDown={down}
      onPointerMove={(e) => dragging.current && move(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      role="slider"
      aria-label="Before and after comparison"
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
        if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
      }}
    >
      <img
        decoding="async"
        src={after}
        alt={afterLabel}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <img
        decoding="async"
          src={before}
          alt={beforeLabel}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      </div>
      <span className="absolute left-3 top-3 rounded-full bg-charcoal/80 px-3 py-1 text-xs font-medium text-charcoal-foreground backdrop-blur">
        {beforeLabel}
      </span>
      <span className="absolute right-3 top-3 rounded-full bg-primary/90 px-3 py-1 text-xs font-medium text-primary-foreground backdrop-blur">
        {afterLabel}
      </span>
      <div className="absolute inset-y-0 w-0.5 bg-background" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background text-foreground shadow-lg">
          ⟷
        </div>
      </div>
    </div>
  );
}
