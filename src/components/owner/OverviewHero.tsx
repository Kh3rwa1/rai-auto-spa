import { AlertTriangle, CircleCheck, MapPinned, Palette, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { planRoute } from "@/lib/ops-config";
import type { Stop } from "./RouteMap";
import type { Booking } from "./shared";
import type { TabValue } from "./tabs";

type Props = {
  today: string;
  todays: Booking[];
  stops: Stop[];
  route: ReturnType<typeof planRoute<Stop>>;
  pendingDeposits: number;
  wrapApprovals: number;
  failedVideos: number;
  dateLabel: string;
  hasPriorities: boolean;
  setTab: (v: TabValue) => void;
};

export function OverviewHero({
  today,
  todays,
  stops,
  route,
  pendingDeposits,
  wrapApprovals,
  failedVideos,
  dateLabel,
  hasPriorities,
  setTab,
}: Props) {
  return (
    <section
      aria-labelledby="owner-overview"
      className="overflow-hidden rounded-3xl bg-charcoal text-charcoal-foreground shadow-[var(--shadow-soft)]"
    >
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-electric px-3 py-1 text-xs font-bold text-electric-foreground">
            Guest admin demo
          </span>
          <span className="text-xs text-charcoal-foreground/70">
            Open sandbox — no sign-in · {dateLabel}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="owner-overview" className="font-display text-2xl font-bold sm:text-3xl">
              Today&apos;s operations
            </h1>
            <p className="mt-1 text-sm text-charcoal-foreground/70">
              {todays.length} jobs today · {stops.length} van stops · {route.km.toFixed(1)} km route
              (est. hill roads)
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="min-h-[44px]"
            onClick={() => setTab("route")}
          >
            <MapPinned className="h-4 w-4" aria-hidden /> Today&apos;s route
          </Button>
        </div>
        {hasPriorities ? (
          <ul
            className="mt-5 grid gap-2 sm:grid-cols-3"
            aria-label="Today's priorities — select to review"
          >
            {pendingDeposits > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => setTab("calendar")}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-2xl bg-background/10 p-3 text-left transition hover:bg-background/15"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/25">
                    <Wallet className="h-4 w-4 text-red-200" aria-hidden />
                  </span>
                  <span className="text-sm">
                    <strong>{pendingDeposits} without deposit</strong>
                    <span className="block text-xs text-charcoal-foreground/70">
                      Review calendar →
                    </span>
                  </span>
                </button>
              </li>
            )}
            {wrapApprovals > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => setTab("wraps")}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-2xl bg-background/10 p-3 text-left transition hover:bg-background/15"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-electric/25">
                    <Palette className="h-4 w-4 text-electric-foreground" aria-hidden />
                  </span>
                  <span className="text-sm">
                    <strong>{wrapApprovals} wrap(s) to approve</strong>
                    <span className="block text-xs text-charcoal-foreground/70">
                      Review designs →
                    </span>
                  </span>
                </button>
              </li>
            )}
            {failedVideos > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => setTab("gallery")}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-2xl bg-background/10 p-3 text-left transition hover:bg-background/15"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/25">
                    <AlertTriangle className="h-4 w-4 text-amber-200" aria-hidden />
                  </span>
                  <span className="text-sm">
                    <strong>{failedVideos} video(s) failed</strong>
                    <span className="block text-xs text-charcoal-foreground/70">
                      Share via WhatsApp →
                    </span>
                  </span>
                </button>
              </li>
            )}
          </ul>
        ) : (
          <p className="mt-5 flex min-h-[44px] items-center gap-2 rounded-2xl bg-primary/20 p-3 text-sm">
            <CircleCheck className="h-5 w-5 shrink-0 text-teal" aria-hidden />
            Nothing urgent — all deposits in, wraps approved, videos rendering.
          </p>
        )}
      </div>
    </section>
  );
}
