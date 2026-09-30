import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Droplets, Fuel, Route as RouteIcon, Wallet } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { ensureDemoData, ownerData } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr } from "@/lib/plans";
import { OPS, litresFor, planRoute } from "@/lib/ops-config";
import { TooltipProvider } from "@/components/ui/tooltip";
import { todayIST } from "@/lib/booking-rules";
import type { Stop } from "./RouteMap";
import { type Booking, type Sub, Stat } from "./shared";
import { OverviewHero } from "./OverviewHero";
import { TABS } from "./tabs";
import { RoutePanel } from "./RoutePanel";
import { WeekCalendar } from "./WeekCalendar";
import { Subscriptions } from "./Subscriptions";
import { Waitlist } from "./Waitlist";
import { Leads } from "./Leads";
import { Wraps } from "./Wraps";
import { Gallery } from "./Gallery";
import { Calls } from "./Calls";


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
      <OverviewHero
        today={today}
        todays={todays}
        stops={stops}
        route={route}
        pendingDeposits={pendingDeposits}
        wrapApprovals={wrapApprovals}
        failedVideos={failedVideos}
        dateLabel={dateLabel}
        hasPriorities={hasPriorities}
        setTab={setTab}
      />

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
          <RoutePanel route={route} liters={liters} />
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
