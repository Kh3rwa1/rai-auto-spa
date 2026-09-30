import { lazy, Suspense } from "react";
import { Droplets, MapPin, Store, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { MOBILE_FEE, WATER_FEE, inr } from "@/lib/plans";
import type { Draft, SetDraft } from "./useBookingDraft";

const PinPicker = lazy(() => import("../PinPicker"));

export function LocationPicker({
  draft,
  set,
  needsPin,
  studioOnly,
}: {
  draft: Draft;
  set: SetDraft;
  needsPin: boolean;
  studioOnly: boolean;
}) {
  const { mobile, water, pin } = draft;
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
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Service location">
        {(
          [
            [false, Store, "Come to Studio", "MG Marg, Gangtok · Free · 2 bays"],
            [true, Truck, "We Come To You", `+${inr(MOBILE_FEE)} · Mobile van`],
          ] as const
        ).map(([m, Icon, t, sub]) => {
          const unavailable = m && studioOnly;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={mobile === m}
              aria-disabled={unavailable}
              aria-label={`${t}. ${sub}${mobile === m ? ", selected" : ""}${unavailable ? ", unavailable: Signature needs the studio" : ""}`}
              disabled={unavailable}
              onClick={() => set({ mobile: m })}
              className={cn(
                "flex min-h-[44px] items-start gap-3 rounded-2xl border-2 p-4 text-left transition",
                mobile === m
                  ? "border-primary bg-accent/50"
                  : "border-border hover:border-primary/40",
                unavailable && "cursor-not-allowed opacity-60 hover:border-border",
              )}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block font-semibold">
                  {t} {mobile === m && <span className="text-primary">✓</span>}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {unavailable ? "Not available for Signature — 2 studio days needed" : sub}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {studioOnly && (
        <p className="mt-3 rounded-xl bg-charcoal p-3 text-sm text-charcoal-foreground" role="note">
          Signature Super Design reserves a studio bay for 2 full days, so the mobile van can&apos;t
          do it — studio selected.
        </p>
      )}
      {needsPin && (
        <p
          className="mt-3 rounded-xl bg-amber-400/15 p-3 text-sm font-medium text-amber-800 dark:text-amber-200"
          role="status"
        >
          Pick a time below, then drop a map pin so the van can reach you — both are needed to
          continue.
        </p>
      )}

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
                Pinned at {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)} — van route time is an
                estimate.
              </p>
            ) : (
              <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-400">
                Drop a pin so the van can reach you — required to continue.
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
    </>
  );
}
