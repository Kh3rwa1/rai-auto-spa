import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SLOTS, isPrime } from "@/lib/plans";
import {
  addDays,
  formatSlot,
  nowISTHour,
  slotUnavailable,
  todayIST,
  type SlotState,
} from "@/lib/booking-rules";
import { getSlots } from "@/lib/booking.functions";
import type { Draft, SetDraft } from "./useBookingDraft";
import { type SlotCheck, reasonFor } from "./slot-check";
import { LocationPicker } from "./LocationPicker";
import { DesktopWeekGrid } from "./DesktopWeekGrid";
import { MobileDayPicker } from "./MobileDayPicker";
import { PriceSummary } from "./PriceSummary";

type Props = {
  draft: Draft;
  set: SetDraft;
  nonce: number;
  total: number;
  needsPin: boolean;
  onChooseSlot: (date: string, time: string) => void;
};

export function WhereWhenStep({ draft, set, nonce, total, needsPin, onChooseSlot }: Props) {
  const slotsFn = useServerFn(getSlots);
  const { mobile, water, pin, slot, plan } = draft;
  // Signature reserves a studio bay for 2 days — the van cannot do it.
  const studioOnly = plan === "signature";
  const [weekStart, setWeekStart] = useState(todayIST());
  const [selectedDate, setSelectedDate] = useState<string>(
    () => slot?.date ?? addDays(todayIST(), 1),
  );
  const [grid, setGrid] = useState<{ slots: Record<string, SlotState>; capacity: number }>({
    slots: {},
    capacity: 1,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped by the retry button so a failed load actually re-requests (same week start
  // alone would be a no-op state change and never re-fetch).
  const [retryTick, setRetryTick] = useState(0);
  const today = todayIST();
  const nowHour = nowISTHour();
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    slotsFn({ data: { start: weekStart, mobile, pin } })
      .then((r) => {
        if (cancelled) return;
        setGrid({ slots: r.slots, capacity: r.capacity });
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setLoadError("Could not load availability. Check connection and retry.");
      });
    return () => {
      cancelled = true;
    };
  }, [weekStart, mobile, pin, slotsFn, nonce, retryTick]);

  // Keep the mobile date-chips in sync when navigating weeks or when a slot is chosen.
  useEffect(() => {
    if (slot?.date) setSelectedDate(slot.date);
  }, [slot?.date]);
  useEffect(() => {
    if (!days.includes(selectedDate)) setSelectedDate(days[0]!);
  }, [days, selectedDate]);

  const check: SlotCheck = (d, t) => {
    const st = grid.slots[`${d} ${t}`];
    const u = slotUnavailable({
      date: d,
      time: t,
      today,
      nowHour,
      mobile,
      water,
      capacity: grid.capacity,
      state: st,
    });
    return { st, u, why: reasonFor({ ...u, blockReason: st?.blocked ?? null }) };
  };

  const nextAvailable = useMemo(() => {
    if (loading || loadError) return null;
    for (const d of days) {
      for (const t of SLOTS) {
        const { u } = check(d, t);
        if (!u.disabled) return { date: d, time: t };
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, grid, loading, loadError, mobile, water, today, nowHour]);

  const selectedInfo = slot ? check(slot.date, slot.time) : null;

  const timeButton = (d: string, t: string) => {
    const { st, u, why } = check(d, t);
    const sel = slot?.date === d && slot.time === t;
    return (
      <button
        key={`${d}-${t}`}
        type="button"
        disabled={u.disabled || loading}
        aria-pressed={sel}
        aria-label={`${formatSlot(d, t)}${u.disabled ? `, unavailable: ${why}` : sel ? ", selected" : ""}${isPrime(t) && !u.disabled ? ", prime" : ""}`}
        onClick={() => onChooseSlot(d, t)}
        className={cn(
          "flex min-h-[44px] flex-col items-center justify-center rounded-xl border-2 px-2 py-2 text-sm font-semibold transition",
          sel
            ? "border-charcoal bg-charcoal text-charcoal-foreground"
            : u.disabled
              ? "border-border bg-muted/50 text-muted-foreground/70"
              : isPrime(t)
                ? "border-primary/50 bg-primary/10 hover:border-primary"
                : "border-border bg-card hover:border-primary/50",
        )}
      >
        <span className={cn(u.disabled && "line-through")}>{t}</span>
        {mobile && st?.travelMin != null && !u.disabled && (
          <span className="text-[11px] font-normal opacity-70">~{st.travelMin}m van (est.)</span>
        )}
        {isPrime(t) && !u.disabled && !sel && (
          <span className="text-[10px] font-medium text-primary">Prime</span>
        )}
      </button>
    );
  };

  return (
    <div>
      <LocationPicker draft={draft} set={set} needsPin={needsPin} studioOnly={studioOnly} />

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold" id="slot-grid-label">
            Pick a slot
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="min-h-[44px]"
              disabled={weekStart <= today || loading}
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              ← Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-[44px]"
              disabled={loading}
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              Next →
            </Button>
          </div>
        </div>

        {loadError ? (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5"
          >
            <p className="text-sm font-medium text-destructive">{loadError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 min-h-[44px]"
              onClick={() => setRetryTick((t) => t + 1)}
            >
              Retry loading slots
            </Button>
          </div>
        ) : (
          <>
            {nextAvailable ? (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-h-[44px]"
                  disabled={loading}
                  onClick={() => {
                    setSelectedDate(nextAvailable.date);
                    onChooseSlot(nextAvailable.date, nextAvailable.time);
                  }}
                >
                  Next available: {formatSlot(nextAvailable.date, nextAvailable.time)}
                </Button>
              </div>
            ) : (
              !loading && (
                <p className="mb-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                  No free slots this week
                  {mobile && !water ? " (11am–4pm blocked without water)" : ""}. Try the next week.
                </p>
              )
            )}

            {/* Mobile: date chips + time grid (no horizontal page scroll) */}
            <MobileDayPicker
              days={days}
              loading={loading}
              check={check}
              slot={slot}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              timeButton={timeButton}
            />
            <DesktopWeekGrid
              days={days}
              loading={loading}
              check={check}
              slot={slot}
              mobile={mobile}
              onChooseSlot={onChooseSlot}
            />
          </>
        )}

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded bg-primary/30" /> Prime (7–10am, 5–7pm)
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded bg-muted" /> Regular
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded bg-muted/50" /> Unavailable (reason listed)
          </span>
        </div>
        {slot && selectedInfo && (
          <p className="mt-3 rounded-xl bg-primary/10 p-3 text-sm font-medium" aria-live="polite">
            Selected: {formatSlot(slot.date, slot.time)} · {mobile ? "Mobile van" : "Studio"}
            {mobile && !water && " · water tank included"}
          </p>
        )}
        {mobile && !water && (
          <p className="mt-2 text-sm font-medium text-destructive">
            11am–4pm stays blocked until you tick “Water available” — morning/evening slots remain
            open.
          </p>
        )}
      </div>

      {plan && <PriceSummary plan={plan} mobile={mobile} water={water} total={total} />}
    </div>
  );
}
