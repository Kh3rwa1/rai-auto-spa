import { Suspense } from "react";
import { CircleCheck, MapPinned } from "lucide-react";
import { STUDIO } from "@/lib/plans";
import { planRoute } from "@/lib/ops-config";
import { RouteMap } from "./shared";
import { planRoute } from "@/lib/ops-config";

type Route = ReturnType<typeof planRoute>;

export function RoutePanel({ route, liters }: { route: Route; liters: number }) {
  return (
    <>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-muted" />}>
        <RouteMap stops={route.order} route={[STUDIO, ...route.order, STUDIO]} />
      </Suspense>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display text-lg font-bold">Van route</p>
          <p className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            {route.km.toFixed(1)} km est.
          </p>
        </div>
        <ol className="mt-4 space-y-0">
          <li className="relative flex gap-3 pb-4">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-charcoal text-charcoal-foreground"
            >
              <MapPinned className="h-3.5 w-3.5" />
            </span>
            <span
              aria-hidden
              className="absolute left-[13px] top-8 h-[calc(100%-2rem)] w-0.5 bg-border"
            />
            <span className="pt-1 text-sm">
              <span className="block font-semibold">Start · Studio</span>
              <span className="block text-xs text-muted-foreground">MG Marg, Gangtok</span>
            </span>
          </li>
          {route.order.map((s, i) => (
            <li key={i} className="relative flex gap-3 pb-4">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
              >
                {i + 1}
              </span>
              {i < route.order.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[13px] top-8 h-[calc(100%-2rem)] w-0.5 bg-border"
                />
              )}
              <span className="min-w-0 pt-0.5 text-sm">
                <span className="block font-semibold">{s.label}</span>
                <span className="block text-xs text-muted-foreground">{s.area}</span>
              </span>
            </li>
          ))}
          {route.order.length === 0 && (
            <li className="pb-4 text-sm text-muted-foreground">
              No van stops today — studio jobs only.
            </li>
          )}
          <li className="relative flex gap-3">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <CircleCheck className="h-3.5 w-3.5" />
            </span>
            <span className="pt-1 text-sm text-muted-foreground">Back to studio</span>
          </li>
        </ol>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4 text-center">
          <div className="rounded-xl bg-muted p-2.5">
            <p className="font-display text-lg font-bold text-primary">
              {(route.naive - route.km).toFixed(1)} km
            </p>
            <p className="text-[11px] text-muted-foreground">saved by clustering</p>
          </div>
          <div className="rounded-xl bg-muted p-2.5">
            <p className="font-display text-lg font-bold text-electric">{liters} L</p>
            <p className="text-[11px] text-muted-foreground">water for today&apos;s jobs</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Distances are hill-road estimates, not exact odometer readings.
        </p>
      </div>
    </>
  );
}
