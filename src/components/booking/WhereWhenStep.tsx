import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Droplets, MapPin, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { MOBILE_FEE, PLANS, SLOTS, WATER_FEE, inr, isPrime } from "@/lib/plans";
import {
  addDays,
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

export function WhereWhenStep({ draft, set, nonce, total, onChooseSlot }: Props) {
  const slotsFn = useServerFn(getSlots);
  const { mobile, water, pin, slot, plan } = draft;
  const [weekStart, setWeekStart] = useState(todayIST());
  const [grid, setGrid] = useState<{ slots: Record<string, SlotState>; capacity: number }>({
    slots: {},
    capacity: 1,
  });
  const today = todayIST();
  const nowHour = nowISTHour();
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  useEffect(() => {
    slotsFn({ data: { start: weekStart, mobile, pin } })
      .then((r) => setGrid({ slots: r.slots, capacity: r.capacity }))
      .catch(() => {
        // Background refreshes fail silently; only the first load warns.
        if (nonce === 0) toast.error("Could not load the calendar");
      });
  }, [weekStart, mobile, pin, slotsFn, nonce]);

  const field = (id: keyof Draft, label: string, ph: string) => (
    <div>
      <Label htmlFor={`f-${id}`}>{label}</Label>
      <Input
        id={`f-${id}`}
        value={draft[id] as string}
        onChange={(e) => set({ [id]: e.target.value })}
        placeholder={ph}
      />
    </div>
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Location">
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
            onClick={() => set({ mobile: m })}
            className={cn(
              "flex items-start gap-3 rounded-2xl border-2 p-4 text-left",
              mobile === m ? "border-primary bg-accent/50" : "border-border",
            )}
          >
            <Icon className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
            <div>
              <p className="font-semibold">{t}</p>
              <p className="text-sm text-muted-foreground">{sub}</p>
            </div>
          </button>
        ))}
      </div>

      {mobile ? (
        <div className="mt-5 space-y-4">
          <div>
            <Label className="mb-2 flex items-center gap-1.5">
              <MapPin className="h-4 w-4" aria-hidden /> Tap the map to drop your pin
            </Label>
            <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
              <PinPicker value={pin} onChange={(p) => set({ pin: p })} />
            </Suspense>
            {pin && (
              <p className="mt-1 text-xs text-muted-foreground">
                Pinned at {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {field("building", "Building / Apartment", "Hilltop Residency")}
            {field("floor", "Floor", "3")}
            {field("parking", "Parking slot", "B-12")}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={draft.guard} onCheckedChange={(v) => set({ guard: !!v })} /> Guard
              permission taken?
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={water} onCheckedChange={(v) => set({ water: !!v })} /> Water
              available?
            </label>
          </div>
          {!water && (
            <p className="rounded-xl bg-accent p-3 text-sm text-accent-foreground">
              <Droplets className="mr-1 inline h-4 w-4" aria-hidden /> Gangtok municipal water runs
              6–9am. Without water on site, we carry our own tank (+{inr(WATER_FEE)}) and 11am–4pm
              slots are blocked.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Studio has 2 bays — free slots show below.
        </p>
      )}

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold" id="slot-grid-label">
            Pick a slot
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={weekStart <= today}
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              ← Prev
            </Button>
            <Button size="sm" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Next →
            </Button>
          </div>
        </div>
        <div className="-mx-2 overflow-x-auto px-2 pb-2">
          <div className="grid min-w-[640px] grid-cols-7 gap-2" aria-labelledby="slot-grid-label">
            {days.map((d) => {
              const dt = new Date(d + "T00:00:00Z");
              const dayName = dt.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
              return (
                <div key={d} className="space-y-1.5">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{dayName}</p>
                    <p className="font-semibold">{dt.getUTCDate()}</p>
                  </div>
                  {SLOTS.map((t) => {
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
                    const sel = slot?.date === d && slot.time === t;
                    const why = u.dry
                      ? "Water needed, pick morning or provide water"
                      : (st?.blocked ?? (u.full ? "Fully booked" : isPrime(t) ? "Prime slot" : ""));
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={u.disabled}
                        aria-pressed={sel}
                        aria-label={`${dayName} ${dt.getUTCDate()} at ${t}${u.disabled ? " — unavailable" : ""}`}
                        title={why}
                        onClick={() => onChooseSlot(d, t)}
                        className={cn(
                          "w-full rounded-lg px-1 py-1.5 text-xs font-medium transition",
                          sel
                            ? "bg-charcoal text-charcoal-foreground"
                            : u.disabled
                              ? "bg-muted/50 text-muted-foreground/60 line-through"
                              : isPrime(t)
                                ? "bg-primary/15 text-accent-foreground hover:bg-primary/25"
                                : "bg-muted text-muted-foreground hover:bg-muted/70",
                        )}
                      >
                        {t}
                        {mobile && st?.travelMin != null && !u.disabled && (
                          <span className="block text-[10px] opacity-70">~{st.travelMin}m van</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded bg-primary/30" /> Prime (7–10am, 5–7pm)
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded bg-muted" /> Regular
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded bg-muted/50" /> Unavailable
          </span>
        </div>
        {mobile && !water && (
          <p className="mt-3 text-sm font-medium text-destructive">
            Water needed, pick morning or provide water — 11am–4pm is blocked.
          </p>
        )}
      </div>

      {plan && (
        <div className="mt-6 rounded-2xl bg-muted p-4 text-sm">
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
              <span>Water tank</span>
              <span>{inr(WATER_FEE)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{inr(total)}</span>
          </div>
        </div>
      )}
    </>
  );
}
