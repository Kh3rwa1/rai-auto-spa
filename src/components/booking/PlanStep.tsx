import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COLOURS, PLANS, STYLES, inr, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { SetDraft } from "./useBookingDraft";

type Props = {
  plan: PlanId | null;
  colour: string;
  style: string;
  onSelect: (p: PlanId) => void;
  onContinue: () => void;
  set: SetDraft;
};

function ColourChip({
  selected,
  recommended,
  onClick,
  children,
  label,
}: {
  selected: boolean;
  recommended?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${label}${selected ? ", selected" : ""}${recommended && !selected ? ", recommended" : ""}`}
      onClick={onClick}
      className={cn(
        "flex min-h-[44px] items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-medium transition",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card hover:border-primary/50",
      )}
    >
      {children}
      {selected ? (
        <span className="flex items-center gap-1 text-xs font-semibold">
          <Check className="h-3.5 w-3.5" aria-hidden /> Selected
        </span>
      ) : recommended ? (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          Recommended
        </span>
      ) : null}
    </button>
  );
}

export function PlanStep({ plan, colour, style, onSelect, onContinue, set }: Props) {
  return (
    <div>
      <div
        className="grid gap-4 md:grid-cols-3 md:items-stretch"
        role="radiogroup"
        aria-label="Service plan"
      >
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const p = PLANS[id];
          const selected = plan === id;
          const sig = id === "signature";
          const recommended = id === "detail";
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${p.name}, ${inr(p.price)}, ${p.duration}${selected ? ", selected" : ""}${recommended ? ", recommended" : ""}`}
              onClick={() => onSelect(id)}
              className={cn(
                "relative flex min-h-[44px] flex-col rounded-2xl border-2 p-5 text-left transition",
                sig ? "bg-charcoal text-charcoal-foreground" : "bg-card",
                selected
                  ? sig
                    ? "border-electric shadow-[var(--shadow-electric)]"
                    : "border-primary shadow-[var(--shadow-glow)]"
                  : sig
                    ? "border-electric/40"
                    : recommended
                      ? "border-primary/60"
                      : "border-border",
              )}
            >
              <span className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "w-fit rounded-full px-3 py-1 text-xs font-semibold",
                    sig
                      ? "bg-electric text-electric-foreground"
                      : recommended
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                  )}
                >
                  {p.badge}
                </span>
                {recommended && !selected && (
                  <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[11px] font-medium text-primary">
                    Recommended
                  </span>
                )}
                {selected && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                      sig
                        ? "bg-electric text-electric-foreground"
                        : "bg-primary text-primary-foreground",
                    )}
                  >
                    <Check className="h-3 w-3" aria-hidden /> Selected
                  </span>
                )}
              </span>
              <span className="text-lg font-semibold">{p.name}</span>
              <span className="mt-1 font-display text-3xl font-bold">{inr(p.price)}</span>
              <span
                className={cn(
                  "text-sm",
                  sig ? "text-charcoal-foreground/70" : "text-muted-foreground",
                )}
              >
                {p.duration}
              </span>
              <ul className="mt-4 space-y-1.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check
                      className={cn("h-4 w-4 shrink-0", sig ? "text-electric" : "text-primary")}
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
                aria-hidden
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
                {selected ? "✓ Selected" : recommended ? "Choose recommended" : "Choose this plan"}
              </span>
            </button>
          );
        })}
      </div>

      {plan === "signature" && (
        <div className="mt-6 space-y-5 rounded-2xl bg-charcoal p-5 text-charcoal-foreground">
          <p className="text-sm text-charcoal-foreground/80">
            Customise your Signature wrap — your AI preview updates with these choices.
          </p>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">1. Wrap colour</legend>
            <div className="flex flex-wrap gap-2">
              {COLOURS.map((c, i) => (
                <ColourChip
                  key={c.name}
                  label={c.name}
                  selected={colour === c.name}
                  recommended={i === 0}
                  onClick={() => set({ colour: c.name })}
                >
                  <span
                    aria-hidden
                    className="h-4 w-4 rounded-full border border-white/30"
                    style={{ background: c.hex }}
                  />
                  {c.name}
                </ColourChip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">2. Style</legend>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s, i) => (
                <ColourChip
                  key={s}
                  label={s}
                  selected={style === s}
                  recommended={i === 0}
                  onClick={() => set({ style: s })}
                >
                  {s}
                </ColourChip>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-charcoal-foreground/70" aria-live="polite">
            Selected: {colour} · {style}
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {!plan
            ? "Choose a plan to continue."
            : plan === "signature"
              ? `Signature: ${colour} · ${style} — review, then continue.`
              : `${PLANS[plan].name} selected — continue to location.`}
        </p>
        <Button
          size="lg"
          className="min-h-[44px] w-full sm:w-auto"
          disabled={!plan}
          onClick={onContinue}
        >
          {plan ? `Continue to location · ${inr(PLANS[plan].price)}+` : "Choose a plan first"}
        </Button>
      </div>
    </div>
  );
}
