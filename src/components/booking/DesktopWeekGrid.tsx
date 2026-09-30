import { cn } from "@/lib/utils";
import { SLOTS, isPrime } from "@/lib/plans";
import { formatSlot } from "@/lib/booking-rules";
import type { Draft } from "./useBookingDraft";
import { type SlotCheck } from "./slot-check";

export function DesktopWeekGrid({
  days,
  loading,
  check,
  slot,
  mobile,
  onChooseSlot,
}: {
  days: string[];
  loading: boolean;
  check: SlotCheck;
  slot: Draft["slot"];
  mobile: boolean;
  onChooseSlot: (date: string, time: string) => void;
}) {
  return (
    <div className="hidden md:block">
      {loading ? (
        <div className="grid grid-cols-7 gap-2" aria-busy="true" aria-label="Loading slots">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
          ))}
          <p className="col-span-7 mt-2 text-sm text-muted-foreground" aria-live="polite">
            Loading availability…
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-7 gap-2" aria-labelledby="slot-grid-label">
            {days.map((d) => {
              const dt = new Date(`${d}T00:00:00Z`);
              const dayName = dt.toLocaleDateString("en-IN", {
                weekday: "short",
                timeZone: "UTC",
              });
              return (
                <div key={d} className="space-y-1.5">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{dayName}</p>
                    <p className="font-semibold">{dt.getUTCDate()}</p>
                  </div>
                  {SLOTS.map((t) => {
                    const { st, u, why } = check(d, t);
                    const sel = slot?.date === d && slot.time === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={u.disabled}
                        aria-pressed={sel}
                        aria-label={`${dayName} ${dt.getUTCDate()} at ${t}${u.disabled ? ` — unavailable: ${why}` : sel ? " — selected" : ""}`}
                        title={why ?? (isPrime(t) ? "Prime slot" : "Available")}
                        onClick={() => onChooseSlot(d, t)}
                        className={cn(
                          "min-h-[44px] w-full rounded-lg px-1 py-1.5 text-xs font-medium transition",
                          sel
                            ? "bg-charcoal text-charcoal-foreground"
                            : u.disabled
                              ? "bg-muted/50 text-muted-foreground/60 line-through"
                              : isPrime(t)
                                ? "bg-primary/15 hover:bg-primary/25"
                                : "bg-muted hover:bg-muted/70",
                        )}
                      >
                        {t}
                        {mobile && st?.travelMin != null && !u.disabled && (
                          <span className="block text-[10px] opacity-70">
                            ~{st.travelMin}m van (est.)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Visible reason list: desktop shows the selected week's blocked times in text,
                  not hover-only tooltips (mobile has its own per-date list below). */}
      {!loading && (
        <details className="mt-3 rounded-xl border border-border p-3">
          <summary className="cursor-pointer text-xs font-semibold">
            Why are some times unavailable this week?
          </summary>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {days.flatMap((d) =>
              SLOTS.filter((t) => check(d, t).u.disabled).map((t) => (
                <li key={`${d}-${t}`}>
                  {formatSlot(d, t)} — {check(d, t).why}
                </li>
              )),
            )}
          </ul>
        </details>
      )}
    </div>
  );
}
