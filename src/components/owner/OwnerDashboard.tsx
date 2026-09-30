import { Suspense, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  CircleCheck,
  Droplets,
  Fuel,
  Hourglass,
  Images,
  Inbox,
  MapPinned,
  Palette,
  Repeat,
  Route as RouteIcon,
  Wallet,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { ensureDemoData, ownerData } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STUDIO, inr } from "@/lib/plans";
import { OPS, litresFor, planRoute } from "@/lib/ops-config";
import { TooltipProvider } from "@/components/ui/tooltip";
import { todayIST } from "@/lib/booking-rules";
import type { Stop } from "./RouteMap";
import { RouteMap, type Booking, type Sub, Stat } from "./shared";
import { WeekCalendar } from "./WeekCalendar";
import { Subscriptions } from "./Subscriptions";
import { Waitlist } from "./Waitlist";
import { Leads } from "./Leads";
import { Wraps } from "./Wraps";
import { Gallery } from "./Gallery";

const TABS = [
  { value: "route", label: "Route", icon: MapPinned },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
  { value: "subs", label: "Subscriptions", icon: Repeat },
  { value: "waitlist", label: "Waitlist", icon: Hourglass },
  { value: "leads", label: "Leads", icon: Inbox },
  { value: "wraps", label: "Wrap Approvals", icon: Palette },
  { value: "gallery", label: "Gallery", icon: Images },
] as const;

export function OwnerDashboard() {
  const qc = useQueryClient();
  const today = todayIST();
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("route");
  const load = useServerFn(ownerData);
  const ensure = useServerFn(ensureDemoData);
  const dataQ = useQuery({
    queryKey: ["owner"],
    queryFn: async () => {
      await ensure().catch(() => null); // auto-seed if empty; never block the dashboard on it
      return load();
    },
  });
  const bookingsQ = dataQ;
  const bookings = (dataQ.data?.bookings ?? []) as unknown as Booking[];
  const subs = (dataQ.data?.subs ?? []) as unknown as Sub[];
  const refresh = () => qc.invalidateQueries();

  const todays = bookings.filter(
    (b) =>
      b.date === today &&
      ["confirmed", "pending_deposit", "consultation", "subscription"].includes(b.status),
  );
  const stops: Stop[] = todays
    .filter((b) => b.location_type === "mobile" && b.map_pin)
    .map((b) => ({
      lat: b.map_pin!.lat,
      lng: b.map_pin!.lng,
      label: `${b.time} ${b.vehicle_model} · ${b.clients?.name ?? ""}`,
      area: b.area ?? "",
    }));
  const route = useMemo(() => planRoute(stops), [JSON.stringify(stops)]); // eslint-disable-line react-hooks/exhaustive-deps
  // Revenue at risk = full value of real bookings dated today or later whose deposit hasn't been paid.
  const atRisk = bookings
    .filter(
      (b) =>
        !b.deposit_paid &&
        !!b.date &&
        b.date >= todayIST() &&
        ["pending_deposit", "confirmed", "consultation"].includes(b.status),
    )
    .reduce((a, b) => a + b.total, 0);
  const subVisits = todays.filter((b) => b.status === "subscription").length;
  const liters = todays.reduce((a, b) => a + litresFor(b.plan), 0);
  const fuelSaved = Math.max(0, (route.naive - route.km) * OPS.fuelLitresPerKm);

  if (bookingsQ.isLoading)
    return (
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6" aria-busy="true">
        <p className="sr-only">Loading guest admin demo…</p>
        <div className="h-56 animate-pulse rounded-3xl bg-muted" aria-hidden />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" aria-hidden />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-muted" aria-hidden />
      </main>
    );
  if (bookingsQ.isError)
    return (
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="rounded-2xl border border-border bg-card p-8 text-center" role="alert">
          <p className="font-medium">Couldn&apos;t load the dashboard.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Check your connection — demo data is safe.
          </p>
          <Button
            className="mt-3 min-h-[44px]"
            variant="outline"
            onClick={() => bookingsQ.refetch()}
          >
            Try again
          </Button>
        </div>
      </main>
    );

  const pendingDeposits = bookings.filter(
    (b) =>
      !b.deposit_paid &&
      !!b.date &&
      b.date >= today &&
      ["pending_deposit", "confirmed", "consultation"].includes(b.status),
  ).length;
  const wrapApprovals = bookings.filter(
    (b) => b.plan.startsWith("Signature") && b.approval_status === "pending",
  ).length;
  const failedVideos = bookings.filter((b) =>
    (b as unknown as { video_status?: string }).video_status?.startsWith("failed"),
  ).length;
  const leadsCount = bookings.filter((b) => b.status === "lead" || b.status === "link_sent").length;
  const upcomingCount = bookings.filter(
    (b) => b.date && b.date >= today && ["confirmed", "pending_deposit"].includes(b.status),
  ).length;
  const galleryCount = bookings.filter((b) => b.clean_preview_url && b.photo_url).length;
  const activeSubs = subs.filter((s) => s.active).length;
  const counts: Record<(typeof TABS)[number]["value"], number> = {
    route: stops.length,
    calendar: pendingDeposits,
    subs: activeSubs,
    waitlist: upcomingCount,
    leads: leadsCount,
    wraps: wrapApprovals,
    gallery: galleryCount,
  };
  const dateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });
  const hasPriorities = pendingDeposits > 0 || wrapApprovals > 0 || failedVideos > 0;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
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
                {todays.length} jobs today · {stops.length} van stops · {route.km.toFixed(1)} km
                route (est. hill roads)
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

      <TooltipProvider delayDuration={150}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <Stat
            icon={CalendarDays}
            label="Today's bookings"
            value={String(todays.length)}
            sub={`${todays.length - subVisits} customers · ${subVisits} subscription`}
            formula={`${todays.length - subVisits} customer bookings + ${subVisits} subscription visits (paused and skipped customers excluded).`}
          />
          <Stat
            icon={RouteIcon}
            label="Van route today"
            value={`${route.km.toFixed(1)} km`}
            sub={`${route.order.length} stops · est. hill roads`}
            tile="bg-electric/10"
            tone="text-electric"
            formula={`Nearest-stop route Studio → ${route.order.length} van stops → Studio. Straight-line distance × ${OPS.roadMultiplier} for hill roads.`}
          />
          <Stat
            icon={Fuel}
            label="Fuel saved by clustering"
            value={`${fuelSaved.toFixed(1)} L`}
            sub={`vs ${route.naive.toFixed(1)} km separate trips`}
            tile="bg-amber-400/15"
            tone="text-amber-600 dark:text-amber-400"
            formula={`(separate round trips ${route.naive.toFixed(1)} km − clustered ${route.km.toFixed(1)} km) × ${OPS.fuelLitresPerKm} L/km.`}
          />
          <Stat
            icon={Wallet}
            label="Revenue at risk"
            value={inr(atRisk)}
            sub={`${pendingDeposits} booking(s) · no deposit`}
            tone="text-destructive"
            tile="bg-destructive/10"
            formula="Sum of totals for bookings dated today or later whose deposit is not paid yet."
          />
          <Stat
            icon={Droplets}
            label="Water needed today"
            value={`${liters} L`}
            sub={`${todays.length} job(s) on the schedule`}
            tone="text-electric"
            tile="bg-electric/10"
            formula={`Per job: Essential ${OPS.litresPerWash.essential} L, Full Detail ${OPS.litresPerWash.detail} L, Signature ${OPS.litresPerWash.signature} L, Daily wash ${OPS.litresPerWash.daily} L.`}
          />
        </div>
      </TooltipProvider>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        {/* Mobile: labelled select — avoids a cramped row of tiny tabs */}
        <div className="md:hidden">
          <label className="text-sm font-medium" htmlFor="owner-tab-select">
            Section
          </label>
          <select
            id="owner-tab-select"
            value={tab}
            onChange={(e) => setTab(e.target.value as typeof tab)}
            className="mt-1 block min-h-[48px] w-full rounded-xl border border-input bg-background px-3"
          >
            {TABS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} ({counts[t.value]})
              </option>
            ))}
          </select>
        </div>
        {/* Desktop: clear tab navigation with live counts */}
        <div className="hidden md:block">
          <TabsList className="h-auto flex-wrap gap-1 rounded-2xl p-1.5">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="group min-h-[44px] gap-1.5 rounded-xl px-3"
              >
                <t.icon className="h-4 w-4" aria-hidden />
                {t.label}
                <span
                  aria-label={`${counts[t.value]} items`}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground"
                >
                  {counts[t.value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="route" className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
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
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <WeekCalendar bookings={bookings} />
        </TabsContent>
        <TabsContent value="subs" className="mt-4">
          <Subscriptions subs={subs} bookings={bookings} onChange={refresh} />
        </TabsContent>
        <TabsContent value="waitlist" className="mt-4">
          <Waitlist bookings={bookings} onChange={refresh} />
        </TabsContent>
        <TabsContent value="leads" className="mt-4">
          <Leads bookings={bookings} onChange={refresh} />
        </TabsContent>
        <TabsContent value="wraps" className="mt-4">
          <Wraps bookings={bookings} onChange={refresh} />
        </TabsContent>
        <TabsContent value="gallery" className="mt-4">
          <Gallery bookings={bookings} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
