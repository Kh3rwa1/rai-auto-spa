import { Check, Sparkles } from "lucide-react";
import { COLOURS, PLANS, STYLES, inr, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { SetDraft } from "./useBookingDraft";

type Props = {
  plan: PlanId | null;
  colour: string;
  style: string;
  onChoose: (p: PlanId) => void;
  set: SetDraft;
};

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
        selected ? "border-electric bg-electric/20" : "border-charcoal-foreground/20",
      )}
    >
      {children}
    </button>
  );
}

export function PlanStep({ plan, colour, style, onChoose, set }: Props) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3 md:items-stretch">
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const p = PLANS[id];
          const selected = plan === id;
          const sig = id === "signature";
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChoose(id)}
              className={cn(
                "relative flex flex-col rounded-2xl border-2 p-5 text-left transition-all hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
                sig
                  ? "border-electric/40 bg-charcoal text-charcoal-foreground"
                  : id === "detail"
                    ? "border-primary bg-card shadow-[var(--shadow-glow)] md:scale-[1.03]"
                    : "border-border bg-card",
                selected &&
                  (sig
                    ? "shadow-[var(--shadow-electric)] ring-4 ring-electric"
                    : "ring-4 ring-primary/40"),
              )}
            >
              <span
                className={cn(
                  "mb-3 w-fit rounded-full px-3 py-1 text-xs font-semibold",
                  sig
                    ? "bg-electric text-electric-foreground"
                    : id === "detail"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                )}
              >
                {p.badge}
              </span>
              <h4 className="text-lg font-semibold">{p.name}</h4>
              <p className="mt-1 font-display text-3xl font-bold">{inr(p.price)}</p>
              <p
                className={cn(
                  "text-sm",
                  sig ? "text-charcoal-foreground/70" : "text-muted-foreground",
                )}
              >
                {p.duration}
              </p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check
                      className={cn("h-4 w-4", sig ? "text-electric" : "text-primary")}
                      aria-hidden
                    />{" "}
                    {f}
                  </li>
                ))}
              </ul>
              {sig && (
                <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-electric">
                  <Sparkles className="h-4 w-4" aria-hidden /> AI Colour Change
                </span>
              )}
              <span
                className={cn(
                  "mt-5 rounded-xl py-2 text-center text-sm font-semibold",
                  selected
                    ? sig
                      ? "bg-electric text-electric-foreground"
                      : "bg-primary text-primary-foreground"
                    : sig
                      ? "bg-charcoal-foreground/10"
                      : "bg-muted",
                )}
              >
                {selected ? "Selected" : "Preview this"}
              </span>
            </button>
          );
        })}
      </div>

      {plan === "signature" && (
        <div className="mt-6 space-y-4 rounded-2xl bg-charcoal p-5 text-charcoal-foreground">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Wrap colour</legend>
            <div className="flex flex-wrap gap-2">
              {COLOURS.map((c) => (
                <Chip
                  key={c.name}
                  selected={colour === c.name}
                  onClick={() => set({ colour: c.name })}
                >
                  <span
                    aria-hidden
                    className="h-4 w-4 rounded-full border border-charcoal-foreground/30"
                    style={{ background: c.hex }}
                  />
                  {c.name}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Style</legend>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <Chip key={s} selected={style === s} onClick={() => set({ style: s })}>
                  {s}
                </Chip>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </>
  );
}
