import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Droplets, MapPin, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { MOBILE_FEE, PLANS, SLOTS, WATER_FEE, inr, isPrime } from "@/lib/plans";
import {
  addDays,
  formatDateLong,
  formatSlot,
  nowISTHour,
  slotUnavailable,
  todayIST,
  type SlotState,
} from "@/lib/booking-rules";
import { getSlots } from "@/lib/booking.functions";
import type { Draft, SetDraft } from "./useBookingDraft";

const PinPicker = lazy(() => import("../PinPicker"));

type Props = {
  draft: Draft;
  set: SetDraft;
  nonce: number;
  total: number;
  onChooseSlot: (date: string, time: string) => void;
};

function reasonFor(args: {
  dry: boolean;
  full: boolean;
  blocked: boolean;
  past: boolean;
  blockReason: string | null;
}): string | null {
  if (args.past) return "In the past";
  if (args.blocked) return args.blockReason ?? "Blocked by studio (water shortage)";
  if (args.full) return "Fully booked";
  if (args.dry) return "Needs water — pick morning/evening or tick water available";
  return null;
}

export function WhereWhenStep({ draft, set, nonce, total, onChooseSlot }: Props) {
  const slotsFn = useServerFn(getSlots);
  const { mobile, water, pin, slot, plan } = draft;
  const [weekStart, setWeekStart] = useState(todayIST());
  const [selectedDate, setSelectedDate] = useState<string>(() => slot?.date ?? addDays(todayIST(), 1));
  const [grid, setGrid] = useState<{ slots: Record<string, SlotState>; capacity: number }>({
    slots: {},
    capacity: 1,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  }, [weekStart, mobile, pin, slotsFn, nonce]);

  // Keep the mobile date-chips in sync when navigating weeks or when a slot is chosen.
  useEffect(() => {
    if (slot?.date) setSelectedDate(slot.date);
  }, [slot?.date]);
  useEffect(() => {
    if (!days.includes(selectedDate)) setSelectedDate(days[0]!);
  }, [days, selectedDate]);

  const check = (d: string, t: string) => {
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

  const field = (id: "building" | "floor" | "parking", label: string, ph: string) => (
    <div>
      <Label htmlFor={`f-${id}`}>{label}</Label>
      <Input
        id={`f-${id}`}
        className="mt-1 min-h-[44px]"
        autoComplete={id === "building" ? "street-address" : "off"}
        value={draft[id]}
        onChange={(e) => set({ [id]: e.target.value })}
        placeholder={ph}
      />
    </div>
  );

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
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Service location">
        {(
          [
            [false, Store, "Come to Studio", "MG Marg, Gangtok · Free · 2 bays"],
            [true, Truck, "We Come To You", `+${inr(MOBILE_FEE)} · Mobile van`],
          ] as const
        ).map(([m, Icon, t, sub]) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={mobile === m}
            aria-label={`${t}. ${sub}${mobile === m ? ", selected" : ""}`}
            onClick={() => set({ mobile: m })}
            className={cn(
              "flex min-h-[44px] items-start gap-3 rounded-2xl border-2 p-4 text-left transition",
              mobile === m ? "border-primary bg-accent/50" : "border-border hover:border-primary/40",
            )}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="block font-semibold">
                {t} {mobile === m && <span className="text-primary">✓</span>}
              </span>
              <span className="block text-sm text-muted-foreground">{sub}</span>
            </span>
          </button>
        ))}
      </div>

      {mobile ? (
        <div className="mt-5 space-y-4">
          <div>
            <Label className="mb-2 flex min-h-[24px] items-center gap-1.5">
              <MapPin className="h-4 w-4" aria-hidden /> Tap the map to drop your pin
            </Label>
            <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
              <PinPicker value={pin} onChange={(p) => set({ pin: p })} />
            </Suspense>
            {pin ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Pinned at {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)} — van route time is an estimate.
              </p>
            ) : (
              <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-400">
                Drop a pin so the van can reach you — required before payment.
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {field("building", "Building / Apartment", "Hilltop Residency")}
            {field("floor", "Floor", "3")}
            {field("parking", "Parking slot", "B-12")}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={draft.guard} onCheckedChange={(v) => set({ guard: !!v })} /> Guard
              permission taken?
            </label>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={water} onCheckedChange={(v) => set({ water: !!v })} /> Water
              available at your place?
            </label>
          </div>
          <div
            className={cn(
              "rounded-xl p-3 text-sm",
              water ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground",
            )}
          >
            <p className="flex items-start gap-2">
              <Droplets className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {water ? (
                  <>
                    <strong>Water on site:</strong> all slots open. Gangtok municipal supply runs
                    6–9am — morning slots are most reliable.
                  </>
                ) : (
                  <>
                    <strong>Without water on site</strong> we carry our own tank (+{inr(WATER_FEE)})
                    and <strong>11am–4pm slots are blocked</strong> — please pick morning or
                    evening. This charge is shown in your total before you confirm.
                  </>
                )}
              </span>
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Studio has 2 bays — free slots show below. No map pin needed.
        </p>
      )}

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
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
            <p className="text-sm font-medium text-destructive">{loadError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 min-h-[44px]"
              onClick={() => setWeekStart((s) => s)}
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
                  No free slots this week{mobile && !water ? " (11am–4pm blocked without water)" : ""}
                  . Try the next week.
                </p>
              )
            )}

            {/* Mobile: date chips + time grid (no horizontal page scroll) */}
            <div className="md:hidden">
              <div
                className="flex flex-wrap gap-2"
                role="radiogroup"
                aria-label="Choose a date"
              >
                {days.map((d) => {
                  const dt = new Date(`${d}T00:00:00Z`);
                  const dayName = dt.toLocaleDateString("en-IN", {
                    weekday: "short",
                    timeZone: "UTC",
                  });
                  const selected = selectedDate === d;
                  const freeCount = loading
                    ? -1
                    : SLOTS.filter((t) => !check(d, t).u.disabled).length;
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
                {slot?.date === selectedDate && slot
                  ? ` · selected ${slot.time}`
                  : " · tap a time"}
              </p>
              {loading ? (
                <div className="mt-2 grid grid-cols-3 gap-2" aria-busy="true" aria-label="Loading slots">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-[52px] animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label={`Times for ${formatDateLong(selectedDate)}`}>
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

            {/* Desktop: readable weekly calendar */}
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

      {plan && (
        <div className="mt-6 rounded-2xl bg-muted p-4 text-sm" aria-live="polite">
          <div className="flex justify-between">
            <span>{PLANS[plan].name}</span>
            <span>{inr(PLANS[plan].price)}</span>
          </div>
          {mobile && (
            <div className="flex justify-between">
              <span>Mobile van</span>
              <span>{inr(MOBILE_FEE)}</span>
            </div>
          )}
          {mobile && !water && (
            <div className="flex justify-between">
              <span>Water tank (no water on site)</span>
              <span>{inr(WATER_FEE)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{inr(total)}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            30% demo deposit due at confirmation — no real charge.
          </p>
        </div>
      )}
    </div>
  );
}
