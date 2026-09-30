import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  CircleCheck,
  Clock,
  Droplets,
  Fuel,
  Hourglass,
  Images,
  Inbox,
  Image as ImageIcon,
  MapPinned,
  MessageCircle,
  Palette,
  Repeat,
  Route as RouteIcon,
  Users,
  Wallet,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createPaymentLink } from "@/lib/booking.functions";
import {
  cancelBooking,
  ensureDemoData,
  listOffers,
  runSchedule,
  listBlocked,
  ownerData,
  ownerSignedUrls,
  setApproval,
  setBlocked,
  updateSubscription,
} from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BeforeAfter } from "@/components/BeforeAfter";
import { SLOTS, STUDIO, inr } from "@/lib/plans";
import { OPS, litresFor, planRoute } from "@/lib/ops-config";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { addDays, todayIST } from "@/lib/booking-rules";
import { cn } from "@/lib/utils";
import type { Stop } from "./RouteMap";

const RouteMap = lazy(() => import("./RouteMap"));

type Client = {
  id: string;
  name: string;
  phone: string;
  area: string | null;
  building: string | null;
  floor: string | null;
  water_access: boolean;
};
type Booking = {
  id: string;
  client_id: string | null;
  vehicle_model: string | null;
  photo_url: string | null;
  clean_preview_url: string | null;
  video_url: string | null;
  plan: string;
  colour: string | null;
  style: string | null;
  location_type: string;
  map_pin: { lat: number; lng: number } | null;
  area: string | null;
  date: string | null;
  end_date?: string | null;
  full_day?: boolean;
  subscription_id?: string | null;
  time: string | null;
  total: number;
  deposit_paid: boolean;
  status: string;
  approval_status: string | null;
  water_needed: boolean | null;
  created_at: string;
  clients: Client | null;
};
type Sub = {
  id: string;
  client_id: string;
  plan: string;
  active: boolean;
  skip_dates: string[];
  preferred_time: string;
  clients: Client | null;
};

const wa = (phone: string | null | undefined, text: string) =>
  `https://wa.me/${(phone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

/** Relative time for lead/gallery captions, e.g. "3h ago" — falls back to a date. */
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return iso.slice(0, 10);
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Minutes until an offer expires (negative = expired). */
function minsLeft(expiresAt: string): number {
  return Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000);
}

function useSigned(paths: (string | null | undefined)[]) {
  const list = paths.filter(Boolean) as string[];
  const sign = useServerFn(ownerSignedUrls);
  return useQuery({
    queryKey: ["signed", list],
    enabled: list.length > 0,
    queryFn: () => sign({ data: { paths: list } }),
  });
}

function Stat({
  icon: I,
  label,
  value,
  sub,
  tone,
  tile,
  formula,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub: string;
  tone?: string;
  tile?: string;
  formula: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          aria-label={`${label}: ${value}. ${sub} ${formula}`}
          className="cursor-help rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-glow)]"
        >
          <span
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              tile ?? "bg-primary/10",
            )}
          >
            <I className={cn("h-5 w-5", tone ?? "text-primary")} aria-hidden />
          </span>
          <p className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
          <p className="mt-0.5 text-xs font-semibold">{label}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{formula}</TooltipContent>
    </Tooltip>
  );
}

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

function WeekCalendar({ bookings }: { bookings: Booking[] }) {
  const qc = useQueryClient();
  const [start, setStart] = useState(todayIST());
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const listB = useServerFn(listBlocked);
  const setB = useServerFn(setBlocked);
  const blockedQ = useQuery({
    queryKey: ["blocked", start],
    queryFn: () => listB({ data: { start } }),
  });
  const blocked = new Set((blockedQ.data ?? []).map((b) => `${b.date} ${b.time}`));
  const [pending, setPending] = useState<Set<string>>(new Set());
  const mode = useRef<"block" | "unblock" | null>(null);

  const effective = (k: string) => (pending.has(k) ? !blocked.has(k) : blocked.has(k));

  async function commit() {
    if (!mode.current || pending.size === 0) {
      mode.current = null;
      return;
    }
    const keys = [...pending];
    const m = mode.current;
    mode.current = null;
    await setB({
      data: { mode: m, keys: keys.map((k) => ({ date: k.slice(0, 10), time: k.slice(11) })) },
    });
    setPending(new Set());
    await qc.invalidateQueries({ queryKey: ["blocked"] });
    toast.success(
      m === "block"
        ? `Blocked ${keys.length} slot(s) for water shortage`
        : `Reopened ${keys.length} slot(s)`,
    );
  }

  useEffect((): (() => void) => {
    const up = () => void commit();
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  });

  const touch = (k: string) => {
    if (!mode.current) return;
    const isBlocked = blocked.has(k);
    if ((mode.current === "block" && !isBlocked) || (mode.current === "unblock" && isBlocked))
      setPending((p) => new Set(p).add(k));
  };

  const today = todayIST();
  const weekLabel = (() => {
    const f = (d: string, o: Intl.DateTimeFormatOptions) =>
      new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { ...o, timeZone: "UTC" });
    return `${f(days[0]!, { day: "numeric", month: "short" })} – ${f(days[6]!, { day: "numeric", month: "short", year: "numeric" })}`;
  })();

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold">{weekLabel}</p>
          <p className="text-xs text-muted-foreground">
            Drag across slots to block for water shortage. Drag blocked slots to reopen.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setStart(addDays(start, -7))}>
            ← Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={start === today}
            onClick={() => setStart(today)}
          >
            Today
          </Button>
          <Button size="sm" variant="outline" onClick={() => setStart(addDays(start, 7))}>
            Next →
          </Button>
        </div>
      </div>
      {blockedQ.isError && (
        <p role="alert" className="mb-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t load blocked slots.{" "}
          <button
            className="min-h-[44px] font-semibold underline"
            onClick={() => blockedQ.refetch()}
          >
            Try again
          </button>
        </p>
      )}
      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] select-none grid-cols-[60px_repeat(7,1fr)] gap-1 text-xs">
          <div />
          {days.map((d) => {
            const isToday = d === today;
            return (
              <div
                key={d}
                className={cn(
                  "rounded-lg py-1 text-center font-semibold",
                  isToday && "bg-primary/10 text-primary",
                )}
              >
                {new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
                {isToday && <span className="block text-[10px] font-bold uppercase">today</span>}
              </div>
            );
          })}
          {SLOTS.map((t) => (
            <div key={t} className="contents">
              <div className="py-2 font-medium text-muted-foreground">{t}</div>
              {days.map((d) => {
                const k = `${d} ${t}`;
                const bs = bookings.filter(
                  (b) =>
                    !!b.date &&
                    d >= b.date &&
                    d <= (b.end_date ?? b.date) &&
                    (b.time === t || b.full_day) &&
                    ["confirmed", "pending_deposit", "consultation"].includes(b.status),
                );
                const studio = bs.filter((b) => b.location_type === "studio").length;
                const van = bs.filter((b) => b.location_type === "mobile").length;
                const isB = effective(k);
                const summary = isB
                  ? "blocked for water shortage"
                  : studio === 0 && van === 0
                    ? "empty"
                    : `${studio} of 2 studio bays, van ${van} of 1`;
                return (
                  <div
                    key={k}
                    role="img"
                    aria-label={`${d} ${t}: ${summary}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      mode.current = blocked.has(k) ? "unblock" : "block";
                      touch(k);
                    }}
                    onPointerEnter={() => touch(k)}
                    className={cn(
                      "min-h-10 cursor-pointer rounded-md p-1.5 transition",
                      isB
                        ? "bg-destructive/15 text-destructive"
                        : studio >= 2 && van >= 1
                          ? "bg-primary/15"
                          : "bg-muted hover:bg-accent",
                    )}
                  >
                    {isB ? (
                      <span className="flex items-center gap-1 font-semibold">
                        <Droplets className="h-3.5 w-3.5" aria-hidden /> Blocked
                      </span>
                    ) : (
                      <span className="block space-y-1">
                        <span className="flex items-center gap-1" title="Studio bays">
                          <span className="flex gap-0.5" aria-hidden>
                            {[0, 1].map((i) => (
                              <span
                                key={i}
                                className={cn(
                                  "h-2 w-3 rounded-full",
                                  i < studio ? "bg-primary" : "bg-border",
                                )}
                              />
                            ))}
                          </span>
                          <span className="text-muted-foreground">{studio}/2</span>
                        </span>
                        <span className="flex items-center gap-1" title="Mobile van">
                          <span
                            aria-hidden
                            className={cn(
                              "h-2 w-3 rounded-full",
                              van >= 1 ? "bg-electric" : "bg-border",
                            )}
                          />
                          <span className="text-muted-foreground">Van {van}/1</span>
                        </span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="flex gap-0.5">
            <span className="h-2 w-3 rounded-full bg-primary" />
            <span className="h-2 w-3 rounded-full bg-border" />
          </span>{" "}
          Studio bays filled
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-3 rounded-full bg-electric" /> Van booked
        </span>
        <span className="flex items-center gap-1.5">
          <Droplets aria-hidden className="h-3.5 w-3.5 text-destructive" /> Blocked (water shortage)
        </span>
      </div>
    </div>
  );
}

function Subscriptions({
  subs,
  bookings,
  onChange,
}: {
  subs: Sub[];
  bookings: Booking[];
  onChange: () => void;
}) {
  const today = todayIST();
  const active = subs.filter((s) => s.active).length;
  const month = today.slice(0, 7);
  const monthly = bookings.filter(
    (b) => b.date?.startsWith(month) && !["lead", "link_sent", "cancelled"].includes(b.status),
  ).length;
  const updSub = useServerFn(updateSubscription);
  const run = useServerFn(runSchedule);
  const [running, setRunning] = useState(false);
  async function runToday() {
    setRunning(true);
    try {
      const r = await run();
      toast.success(`Today's schedule: ${r.created} visits on the route`);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }
  async function upd(
    id: string,
    patch: { preferred_time?: string; active?: boolean; skip_dates?: string[] },
  ) {
    try {
      await updSub({ data: { id, patch } });
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "paused" | "skipped">("all");
  const visible = subs.filter((s) => {
    const skipped = s.skip_dates.includes(today);
    if (filter === "active" && (!s.active || skipped)) return false;
    if (filter === "paused" && s.active) return false;
    if (filter === "skipped" && (!s.active || !skipped)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [s.clients?.name, s.clients?.phone, s.clients?.area, s.clients?.building]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  const statusOf = (s: Sub) =>
    !s.active ? (
      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
        Paused
      </span>
    ) : s.skip_dates.includes(today) ? (
      <span className="rounded-full bg-electric/15 px-2.5 py-1 text-xs font-semibold text-electric">
        Skipped today
      </span>
    ) : (
      <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
        Active
      </span>
    );
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold">Daily wash customers</p>
          <p className="text-xs text-muted-foreground">
            {subs.length} total · {active} active · {monthly.toLocaleString("en-IN")} appointments
            this month
          </p>
        </div>
        <Button size="sm" className="min-h-[44px]" onClick={runToday} disabled={running}>
          {running ? "Running…" : "Run today's schedule"}
        </Button>
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative block sm:max-w-xs sm:flex-1">
          <span className="sr-only">Search subscriptions</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, area…"
            className="block min-h-[44px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {(["all", "active", "paused", "skipped"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "min-h-[44px] rounded-full px-3.5 text-xs font-semibold transition",
                filter === f
                  ? "bg-charcoal text-charcoal-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent",
              )}
            >
              {f === "all"
                ? "All"
                : f === "active"
                  ? "Active"
                  : f === "paused"
                    ? "Paused"
                    : "Skipped"}
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 && (
        <p className="rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">
          No subscriptions match{query.trim() ? ` “${query.trim()}”` : " this filter"}.
        </p>
      )}
      {/* Mobile cards */}
      <ul className="grid gap-2 md:hidden">
        {visible.map((s) => {
          const skipped = s.skip_dates.includes(today);
          return (
            <li key={s.id} className="rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.clients?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.clients?.phone} · {s.clients?.area}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.clients?.building}, F{s.clients?.floor} · {s.preferred_time}
                  </p>
                </div>
                {statusOf(s)}
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-[44px] flex-1"
                  disabled={!s.active}
                  onClick={() =>
                    upd(s.id, {
                      skip_dates: skipped
                        ? s.skip_dates.filter((d) => d !== today)
                        : [...s.skip_dates, today],
                    })
                  }
                >
                  {skipped ? "Unskip" : "Skip today"}
                </Button>
                <Button
                  size="sm"
                  variant={s.active ? "ghost" : "default"}
                  className="min-h-[44px] flex-1"
                  onClick={() => upd(s.id, { active: !s.active })}
                >
                  {s.active ? "Pause" : "Resume"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 pr-2 font-semibold">Customer</th>
              <th className="pr-2 font-semibold">Area</th>
              <th className="pr-2 font-semibold">Building</th>
              <th className="pr-2 font-semibold">Time</th>
              <th className="pr-2 font-semibold">Status</th>
              <th className="text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => {
              const skipped = s.skip_dates.includes(today);
              return (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-2">
                    <p className="font-medium">{s.clients?.name}</p>
                    <p className="text-xs text-muted-foreground">{s.clients?.phone}</p>
                  </td>
                  <td className="pr-2">{s.clients?.area}</td>
                  <td className="pr-2 text-muted-foreground">
                    {s.clients?.building}, F{s.clients?.floor}
                  </td>
                  <td className="pr-2">
                    <select
                      value={s.preferred_time}
                      onChange={(e) => upd(s.id, { preferred_time: e.target.value })}
                      className="min-h-[44px] rounded-lg border border-input bg-background px-2 py-1"
                      aria-label={`Change time for ${s.clients?.name}`}
                    >
                      {["06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "17:00", "18:00"].map(
                        (t) => (
                          <option key={t}>{t}</option>
                        ),
                      )}
                    </select>
                  </td>
                  <td className="pr-2">{statusOf(s)}</td>
                  <td className="space-x-1 whitespace-nowrap text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!s.active}
                      onClick={() =>
                        upd(s.id, {
                          skip_dates: skipped
                            ? s.skip_dates.filter((d) => d !== today)
                            : [...s.skip_dates, today],
                        })
                      }
                    >
                      {skipped ? "Unskip" : "Skip Today"}
                    </Button>
                    <Button
                      size="sm"
                      variant={s.active ? "ghost" : "default"}
                      onClick={() => upd(s.id, { active: !s.active })}
                    >
                      {s.active ? "Pause" : "Resume"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Offer = {
  id: string;
  date: string;
  time: string;
  area: string | null;
  status: string;
  expires_at: string;
  cancelled_booking_id: string | null;
  clients: { name: string; phone: string } | null;
};

function Waitlist({ bookings, onChange }: { bookings: Booking[]; onChange: () => void }) {
  const upcoming = bookings.filter(
    (b) => b.date && b.date >= todayIST() && ["confirmed", "pending_deposit"].includes(b.status),
  );
  const cancelFn = useServerFn(cancelBooking);
  const offersFn = useServerFn(listOffers);
  const offersQ = useQuery({
    queryKey: ["offers"],
    queryFn: () => offersFn() as Promise<Offer[]>,
    refetchInterval: 10000,
  });
  const [busy, setBusy] = useState<string | null>(null);
  async function cancel(b: Booking) {
    setBusy(b.id);
    try {
      const { offered } = await cancelFn({ data: { id: b.id } });
      toast.success(
        offered
          ? `Cancelled — offered to ${offered} waitlisted customer(s)`
          : "Cancelled — nobody waitlisted in that area",
      );
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const offers = offersQ.data ?? [];
  const liveOffers = offers.filter((o) => o.status === "offered").length;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="font-display text-lg font-bold">Upcoming bookings</p>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
            {upcoming.length}
          </span>
        </div>
        <ul className="divide-y divide-border text-sm">
          {upcoming.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 font-medium">
                  <span className="truncate">
                    {b.vehicle_model} · {b.plan}
                  </span>
                  {b.deposit_paid ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                      Deposit paid
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      Deposit pending
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" aria-hidden />
                  {b.date} {b.time} · {b.area} · {b.clients?.name}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={busy === b.id}>
                    {busy === b.id ? "Cancelling…" : "Cancel"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Cancel {b.vehicle_model} · {b.date} {b.time}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {`The slot opens up and up to ${OPS.offerFanout} waitlisted customers in ${b.area} are offered it automatically. This can't be undone.`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="min-h-[44px]">Keep booking</AlertDialogCancel>
                    <AlertDialogAction className="min-h-[44px]" onClick={() => cancel(b)}>
                      Yes, cancel &amp; offer slot
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
          {upcoming.length === 0 && (
            <li className="rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">
              No upcoming bookings — new demo bookings appear here.
            </li>
          )}
        </ul>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-display text-lg font-bold">
            <Hourglass className="h-4 w-4 text-electric" aria-hidden /> Auto-backfill offers
          </p>
          {liveOffers > 0 && (
            <span className="rounded-full bg-electric/15 px-2.5 py-1 text-xs font-bold text-electric">
              {liveOffers} live
            </span>
          )}
        </div>
        {offersQ.isLoading && <p className="text-sm text-muted-foreground">Loading offers…</p>}
        {offersQ.isError && (
          <p className="text-sm text-destructive" role="alert">
            Couldn&apos;t load offers.{" "}
            <button
              className="min-h-[44px] font-semibold underline"
              onClick={() => offersQ.refetch()}
            >
              Try again
            </button>
          </p>
        )}
        {!offersQ.isLoading && offers.length === 0 && (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            Cancel a booking and up to {OPS.offerFanout} waitlisted customers in the same area get a{" "}
            {OPS.offerMinutes}-minute claim link. First to claim wins.
          </p>
        )}
        <ul className="space-y-2">
          {offers.map((o) => {
            const expired = o.status === "offered" && new Date(o.expires_at).getTime() < Date.now();
            const st = expired ? "expired" : o.status;
            const left = o.status === "offered" ? minsLeft(o.expires_at) : null;
            const link = `${origin}/offer/${o.id}`;
            const text = `Hi ${(o.clients?.name ?? "").split(" ")[0]}! A ${o.time} slot on ${o.date} just opened near ${o.area}. First to claim gets it (15 min): ${link} — Rai's Auto Spa`;
            return (
              <li key={o.id} className="rounded-2xl border border-border p-3.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 font-medium">
                    {o.clients?.name} · {o.date} {o.time}
                    {left !== null && left >= 0 && (
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        Expires in ~{left} min
                      </span>
                    )}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                      st === "claimed"
                        ? "bg-primary text-primary-foreground"
                        : st === "offered"
                          ? "bg-electric/15 text-electric"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {st === "taken" ? "slot taken" : st}
                  </span>
                </div>
                {st === "offered" && (
                  <>
                    <p className="mt-1.5 text-muted-foreground">{text}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button asChild size="sm" className="min-h-[44px]">
                        <a href={wa(o.clients?.phone, text)} target="_blank" rel="noreferrer">
                          <MessageCircle /> WhatsApp
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="min-h-[44px]">
                        <a href={link} target="_blank" rel="noreferrer">
                          Open claim link
                        </a>
                      </Button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Leads({ bookings, onChange }: { bookings: Booking[]; onChange: () => void }) {
  const leads = bookings
    .filter((b) => b.status === "lead" || b.status === "link_sent")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const signed = useSigned(leads.map((l) => l.photo_url));
  const makeLink = useServerFn(createPaymentLink);
  async function send(b: Booking) {
    try {
      const { text } = await makeLink({
        data: { bookingId: b.id },
      });
      await navigator.clipboard?.writeText(text).catch(() => {});
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
      toast.success("Payment link copied & opened in WhatsApp");
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-lg font-bold">
          <Inbox className="h-4 w-4 text-primary" aria-hidden /> Abandoned photo uploads
        </p>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
          {leads.length}
        </span>
      </div>
      {leads.length === 0 && (
        <p className="rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">
          No abandoned uploads yet — they appear here when someone snaps a car but doesn&apos;t pay.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {leads.map((l) => (
          <div
            key={l.id}
            className="overflow-hidden rounded-2xl border border-border transition-shadow hover:shadow-[var(--shadow-soft)]"
          >
            <div className="relative">
              {l.photo_url && signed.data?.[l.photo_url] ? (
                <img
                  loading="lazy"
                  decoding="async"
                  src={signed.data[l.photo_url]}
                  alt={l.vehicle_model ?? ""}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="aspect-[4/3] bg-muted" />
              )}
              <span
                className={cn(
                  "absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-bold",
                  l.status === "link_sent"
                    ? "bg-primary text-primary-foreground"
                    : "bg-charcoal/85 text-charcoal-foreground backdrop-blur",
                )}
              >
                {l.status === "link_sent" ? "Link sent" : "New lead"}
              </span>
            </div>
            <div className="p-3.5">
              <p className="font-semibold">
                {l.vehicle_model} · viewed {l.plan}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Snapped {timeAgo(l.created_at)}
              </p>
              <Button size="sm" className="mt-2.5 min-h-[44px] w-full" onClick={() => send(l)}>
                <MessageCircle /> Send payment link
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Wraps({ bookings, onChange }: { bookings: Booking[]; onChange: () => void }) {
  const wraps = bookings.filter((b) => b.plan.startsWith("Signature") && b.approval_status);
  const signed = useSigned(wraps.flatMap((w) => [w.photo_url, w.clean_preview_url]));
  const approve = useServerFn(setApproval);
  async function set(b: Booking, status: "approved" | "changes_requested") {
    await approve({ data: { id: b.id, status } });
    toast.success(status === "approved" ? "Design approved" : "Change requested");
    if (status === "changes_requested" && b.clients?.phone)
      window.open(
        wa(
          b.clients.phone,
          `Hi ${b.clients.name.split(" ")[0]}, Rai here! Loved your ${b.colour} ${b.style} idea for the ${b.vehicle_model}. Can we tweak a few details before I start? 🎨`,
        ),
        "_blank",
      );
    onChange();
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-lg font-bold">
          <Palette className="h-4 w-4 text-electric" aria-hidden /> Signature designs
        </p>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
          {wraps.length} awaiting review
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {wraps.map((w) => {
          const before = w.photo_url ? signed.data?.[w.photo_url] : undefined;
          const after = w.clean_preview_url ? signed.data?.[w.clean_preview_url] : undefined;
          const approval =
            w.approval_status === "approved"
              ? "bg-primary text-primary-foreground"
              : w.approval_status === "changes_requested"
                ? "bg-amber-400/25 text-amber-200"
                : "bg-electric text-electric-foreground";
          return (
            <div
              key={w.id}
              className="overflow-hidden rounded-3xl bg-charcoal text-charcoal-foreground shadow-[var(--shadow-soft)]"
            >
              <div className="p-4 pb-0">
                {before && after ? (
                  <BeforeAfter before={before} after={after} afterLabel="AI design" />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-charcoal-foreground/10 text-sm opacity-70">
                    <Palette className="mr-2 h-4 w-4" aria-hidden /> Consultation booked — design at
                    studio
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {w.clients?.name} · {w.vehicle_model}
                    </p>
                    <p className="mt-0.5 text-xs text-charcoal-foreground/70">
                      {w.date} {w.time} · {timeAgo(w.created_at)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
                      approval,
                    )}
                  >
                    {w.approval_status?.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {[w.colour, w.style].filter(Boolean).map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full bg-charcoal-foreground/10 px-2.5 py-1 font-medium"
                    >
                      {chip}
                    </span>
                  ))}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    className="min-h-[44px] bg-electric text-electric-foreground hover:bg-electric/90"
                    onClick={() => set(w, "approved")}
                  >
                    <CircleCheck /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="min-h-[44px]"
                    onClick={() => set(w, "changes_requested")}
                  >
                    Request change
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {wraps.length === 0 && (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No wrap consultations — Signature bookings awaiting approval appear here.
          </p>
        )}
      </div>
    </div>
  );
}

function Gallery({ bookings }: { bookings: Booking[] }) {
  const items = bookings.filter((b) => b.clean_preview_url && b.photo_url);
  const signed = useSigned(items.flatMap((i) => [i.photo_url, i.clean_preview_url, i.video_url]));
  if (items.length === 0)
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <ImageIcon className="h-4 w-4 shrink-0" aria-hidden /> Before/afters and reveal videos
        appear here after customers preview their cars.
      </p>
    );
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-lg font-bold">
          <Images className="h-4 w-4 text-primary" aria-hidden /> Transformation gallery
        </p>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => {
          const s = signed.data ?? {};
          return (
            <div
              key={i.id}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]"
            >
              <div className="p-3 pb-0">
                {s[i.photo_url!] && s[i.clean_preview_url!] ? (
                  <BeforeAfter
                    before={s[i.photo_url!]!}
                    after={s[i.clean_preview_url!]!}
                    afterLabel={i.plan}
                  />
                ) : (
                  <div className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
                )}
              </div>
              <div className="p-3.5">
                {i.video_url && s[i.video_url] && (
                  <video
                    src={s[i.video_url]}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    className="mb-2.5 w-full rounded-xl"
                    aria-label={`Reveal video for ${i.vehicle_model}`}
                  />
                )}
                <p className="text-sm font-semibold">
                  {i.vehicle_model} · {i.plan}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" aria-hidden />
                  {i.clients?.name ?? "Lead"} · {timeAgo(i.created_at)}
                  {i.video_url ? " · video ready" : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
