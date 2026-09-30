import { cn } from "@/lib/utils";
import { SLOTS } from "@/lib/plans";
import { formatDateLong } from "@/lib/booking-rules";
import type { Draft } from "./useBookingDraft";
import { type SlotCheck } from "./slot-check";

export function MobileDayPicker({
  days,
  loading,
  check,
  slot,
  selectedDate,
  setSelectedDate,
  timeButton,
}: {
  days: string[];
  loading: boolean;
  check: SlotCheck;
  slot: Draft["slot"];
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  timeButton: (d: string, t: string) => React.ReactNode;
}) {
  return (
    <div className="md:hidden">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Choose a date">
        {days.map((d) => {
          const dt = new Date(`${d}T00:00:00Z`);
          const dayName = dt.toLocaleDateString("en-IN", {
            weekday: "short",
            timeZone: "UTC",
          });
          const selected = selectedDate === d;
          const freeCount = loading ? -1 : SLOTS.filter((t) => !check(d, t).u.disabled).length;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${dayName} ${dt.getUTCDate()}${freeCount >= 0 ? `, ${freeCount} slots free` : ""}`}
              onClick={() => setSelectedDate(d)}
              className={cn(
                "flex min-h-[44px] min-w-[64px] flex-col items-center justify-center rounded-xl border-2 px-3 py-1.5",
                selected
                  ? "border-charcoal bg-charcoal text-charcoal-foreground"
                  : "border-border bg-card",
              )}
            >
              <span className="text-[11px] font-medium opacity-80">{dayName}</span>
              <span className="text-base font-bold leading-none">{dt.getUTCDate()}</span>
              <span className="text-[10px] opacity-70">
                {loading ? "…" : freeCount === 0 ? "Full" : `${freeCount} free`}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-sm font-semibold" aria-live="polite">
        {formatDateLong(selectedDate)}
        {slot?.date === selectedDate && slot ? ` · selected ${slot.time}` : " · tap a time"}
      </p>
      {loading ? (
        <div className="mt-2 grid grid-cols-3 gap-2" aria-busy="true" aria-label="Loading slots">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[52px] animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div
          className="mt-2 grid grid-cols-3 gap-2"
          role="group"
          aria-label={`Times for ${formatDateLong(selectedDate)}`}
        >
          {SLOTS.map((t) => timeButton(selectedDate, t))}
        </div>
      )}
      {/* Visible, non-hover explanation of why times are unavailable */}
      {!loading && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {SLOTS.map((t) => {
            const { u, why } = check(selectedDate, t);
            if (!u.disabled) return null;
            return (
              <li key={t}>
                {t} — {why}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
