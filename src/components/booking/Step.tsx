import type { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Step(p: {
  n: number;
  title: string;
  summary?: string;
  children: ReactNode;
  done?: boolean;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <section
      id={`step-${p.n}`}
      aria-labelledby={`step-${p.n}-title`}
      className={cn(
        "scroll-mt-36 overflow-hidden rounded-3xl border bg-card shadow-[var(--shadow-soft)] transition-colors",
        p.active ? "border-primary/50" : "border-border",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        className="grid h-auto w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-none px-5 py-5 text-left hover:bg-muted/50 sm:px-8"
        onClick={p.onOpen}
        aria-expanded={p.active}
        aria-controls={`step-${p.n}-body`}
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            p.done
              ? "bg-primary text-primary-foreground"
              : p.active
                ? "bg-charcoal text-charcoal-foreground"
                : "bg-muted text-muted-foreground",
          )}
        >
          {p.done ? <Check className="h-4 w-4" aria-label="Done" /> : p.n}
        </span>
        <span className="min-w-0">
          <span
            id={`step-${p.n}-title`}
            className="block truncate font-display text-xl font-semibold sm:text-2xl"
          >
            {p.title}
          </span>
          {!p.active && p.summary && (
            <span className="mt-0.5 block truncate text-sm font-normal text-muted-foreground">
              {p.summary}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-primary">
          {!p.active && p.done ? "Change" : ""}
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              p.active && "rotate-180",
            )}
            aria-hidden
          />
        </span>
      </Button>
      {p.active && (
        <div id={`step-${p.n}-body`} className="animate-fade-in px-5 pb-5 sm:px-8 sm:pb-8">
          {p.children}
        </div>
      )}
    </section>
  );
}

const LABELS = ["Snap", "Plan", "Where & When", "Preview", "Pay"] as const;

export function ProgressBar({
  active,
  complete,
  onOpen,
}: {
  active: number;
  complete: boolean[];
  onOpen: (n: number) => void;
}) {
  return (
    <nav
      aria-label="Booking progress"
      className="sticky top-20 z-30 -mx-4 border-y border-border bg-background/95 px-2 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-4"
    >
      <ol className="mx-auto grid grid-cols-5 items-center">
        {LABELS.map((label, i) => {
          const n = i + 1;
          return (
            <li key={label} className="relative flex min-w-0 items-center justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-current={active === n ? "step" : undefined}
                onClick={() => onOpen(n)}
                className={cn(
                  "relative z-10 h-auto min-h-[44px] min-w-[44px] rounded-lg px-1 py-1 text-[10px] leading-tight sm:rounded-full sm:px-2.5 sm:text-xs",
                  active === n &&
                    "bg-charcoal text-charcoal-foreground hover:bg-charcoal hover:text-charcoal-foreground",
                )}
              >
                <span className="shrink-0">{n}</span> <span className="text-center">{label}</span>{" "}
                {complete[i] ? (
                  <Check className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" aria-label="complete" />
                ) : active === n ? (
                  <span aria-hidden>•</span>
                ) : null}
              </Button>
              {n < 5 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-1/2 top-1/2 h-px w-full",
                    complete[i] ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
