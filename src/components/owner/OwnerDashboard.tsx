import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, Droplets, Fuel, Inbox, Image as ImageIcon, MapPinned, MessageCircle, Palette, Route as RouteIcon, Users, Wallet } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createPaymentLink } from "@/lib/booking.functions";
import { cancelBooking, ensureDemoData, listOffers, runSchedule, listBlocked, ownerData, ownerSignedUrls, setApproval, setBlocked, updateSubscription } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BeforeAfter } from "@/components/BeforeAfter";
import { SLOTS, STUDIO, inr } from "@/lib/plans";
import { OPS, litresFor, planRoute } from "@/lib/ops-config";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { addDays, todayIST } from "@/components/BookingFlow";
import { cn } from "@/lib/utils";
import type { Stop } from "./RouteMap";

const RouteMap = lazy(() => import("./RouteMap"));

type Client = { id: string; name: string; phone: string; area: string | null; building: string | null; floor: string | null; water_access: boolean };
type Booking = {
  id: string; client_id: string | null; vehicle_model: string | null; photo_url: string | null; clean_preview_url: string | null; video_url: string | null;
  plan: string; colour: string | null; style: string | null; location_type: string; map_pin: { lat: number; lng: number } | null; area: string | null;
  date: string | null; end_date?: string | null; full_day?: boolean; subscription_id?: string | null; time: string | null; total: number; deposit_paid: boolean; status: string; approval_status: string | null; water_needed: boolean | null; created_at: string;
  clients: Client | null;
};
type Sub = { id: string; client_id: string; plan: string; active: boolean; skip_dates: string[]; preferred_time: string; clients: Client | null };

const wa = (phone: string | null | undefined, text: string) =>
  `https://wa.me/${(phone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

function useSigned(paths: (string | null | undefined)[]) {
  const list = paths.filter(Boolean) as string[];
  const sign = useServerFn(ownerSignedUrls);
  return useQuery({
    queryKey: ["signed", list],
    enabled: list.length > 0,
    queryFn: () => sign({ data: { paths: list } }),
  });
}

function Stat({ icon: I, label, value, tone, formula }: { icon: typeof Users; label: string; value: string; tone?: string; formula: string }) {
  return (
    <Tooltip>
    <TooltipTrigger asChild>
    <div tabIndex={0} aria-label={`${label}: ${value}. ${formula}`} className="cursor-help rounded-2xl bg-card p-4 shadow-[var(--shadow-soft)]">
      <I className={cn("h-5 w-5", tone ?? "text-primary")} />
      <p className="mt-3 font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label} ⓘ</p>
    </div>
    </TooltipTrigger>
    <TooltipContent className="max-w-xs">{formula}</TooltipContent>
    </Tooltip>
  );
}

export function OwnerDashboard() {
  const qc = useQueryClient();
  const today = todayIST();
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

  const todays = bookings.filter((b) => b.date === today && ["confirmed", "pending_deposit", "consultation", "subscription"].includes(b.status));
  const stops: Stop[] = todays
    .filter((b) => b.location_type === "mobile" && b.map_pin)
    .map((b) => ({ lat: b.map_pin!.lat, lng: b.map_pin!.lng, label: `${b.time} ${b.vehicle_model} · ${b.clients?.name ?? ""}`, area: b.area ?? "" }));
  const route = useMemo(() => planRoute(stops), [JSON.stringify(stops)]); // eslint-disable-line react-hooks/exhaustive-deps
  // Revenue at risk = full value of real bookings dated today or later whose deposit hasn't been paid.
  const atRisk = bookings
    .filter((b) => !b.deposit_paid && !!b.date && b.date >= todayIST() && ["pending_deposit", "confirmed", "consultation"].includes(b.status))
    .reduce((a, b) => a + b.total, 0);
  const subVisits = todays.filter((b) => b.status === "subscription").length;
  const liters = todays.reduce((a, b) => a + litresFor(b.plan), 0);
  const fuelSaved = Math.max(0, (route.naive - route.km) * OPS.fuelLitresPerKm);

  if (bookingsQ.isLoading) return <p className="p-8 text-muted-foreground">Loading…</p>;
  if (bookingsQ.isError)
    return (
      <div className="p-8 text-center">
        <p className="font-medium">Couldn't load the dashboard.</p>
        <Button className="mt-3" variant="outline" onClick={() => bookingsQ.refetch()}>Try again</Button>
      </div>
    );

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <TooltipProvider delayDuration={150}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon={CalendarDays} label="Today's bookings" value={String(todays.length)} formula={`${todays.length - subVisits} customer bookings + ${subVisits} subscription visits (paused and skipped customers excluded).`} />
        <Stat icon={RouteIcon} label="Total KM today" value={`${route.km.toFixed(1)} km`} formula={`Nearest-stop route Studio → ${route.order.length} van stops → Studio. Straight-line distance × ${OPS.roadMultiplier} for hill roads.`} />
        <Stat icon={Fuel} label="Fuel saved by clustering" value={`${fuelSaved.toFixed(1)} L`} formula={`(separate round trips ${route.naive.toFixed(1)} km − clustered ${route.km.toFixed(1)} km) × ${OPS.fuelLitresPerKm} L/km.`} />
        <Stat icon={Wallet} label="Revenue at risk (no deposit)" value={inr(atRisk)} tone="text-destructive" formula="Sum of totals for bookings dated today or later whose deposit is not paid yet." />
        <Stat icon={Droplets} label="Water needed today" value={`${liters} L`} tone="text-electric" formula={`Per job: Essential ${OPS.litresPerWash.essential} L, Full Detail ${OPS.litresPerWash.detail} L, Signature ${OPS.litresPerWash.signature} L, Daily wash ${OPS.litresPerWash.daily} L.`} />
      </div>
      </TooltipProvider>

      <Tabs defaultValue="route">
        <div className="-mx-4 overflow-x-auto px-4">
          <TabsList className="w-max">
            <TabsTrigger value="route"><MapPinned className="mr-1 h-4 w-4" />Route</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="subs">Subscriptions</TabsTrigger>
            <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="wraps">Wrap Approvals</TabsTrigger>
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="route" className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-muted" />}>
            <RouteMap stops={route.order} route={[STUDIO, ...route.order, STUDIO]} />
          </Suspense>
          <div className="rounded-2xl bg-card p-4">
            <p className="font-semibold">Optimised van route · {route.km.toFixed(1)} km</p>
            <ol className="mt-3 space-y-2 text-sm">
              <li className="text-muted-foreground">Start: Studio, MG Marg</li>
              {route.order.map((s, i) => (
                <li key={i} className="flex gap-2"><span className="font-semibold text-primary">{i + 1}.</span>{s.label} <span className="text-muted-foreground">· {s.area}</span></li>
              ))}
              {route.order.length === 0 && <li className="text-muted-foreground">No van stops today.</li>}
              <li className="text-muted-foreground">Back to studio</li>
            </ol>
            <p className="mt-4 text-xs text-muted-foreground">Clustering saves {(route.naive - route.km).toFixed(1)} km vs separate trips.</p>
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4"><WeekCalendar bookings={bookings} /></TabsContent>
        <TabsContent value="subs" className="mt-4"><Subscriptions subs={subs} bookings={bookings} onChange={refresh} /></TabsContent>
        <TabsContent value="waitlist" className="mt-4"><Waitlist bookings={bookings} onChange={refresh} /></TabsContent>
        <TabsContent value="leads" className="mt-4"><Leads bookings={bookings} onChange={refresh} /></TabsContent>
        <TabsContent value="wraps" className="mt-4"><Wraps bookings={bookings} onChange={refresh} /></TabsContent>
        <TabsContent value="gallery" className="mt-4"><Gallery bookings={bookings} /></TabsContent>
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
  const blockedQ = useQuery({ queryKey: ["blocked", start], queryFn: () => listB({ data: { start } }) });
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
    await setB({ data: { mode: m, keys: keys.map((k) => ({ date: k.slice(0, 10), time: k.slice(11) })) } });
    setPending(new Set());
    await qc.invalidateQueries({ queryKey: ["blocked"] });
    toast.success(m === "block" ? `Blocked ${keys.length} slot(s) for water shortage` : `Reopened ${keys.length} slot(s)`);
  }

  useEffect((): (() => void) => {
    const up = () => void commit();
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  });

  const touch = (k: string) => {
    if (!mode.current) return;
    const isBlocked = blocked.has(k);
    if ((mode.current === "block" && !isBlocked) || (mode.current === "unblock" && isBlocked)) setPending((p) => new Set(p).add(k));
  };

  return (
    <div className="rounded-2xl bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Drag across slots to block for water shortage. Drag blocked slots to reopen.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setStart(addDays(start, -7))}>← Prev</Button>
          <Button size="sm" variant="outline" onClick={() => setStart(addDays(start, 7))}>Next →</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] select-none grid-cols-[60px_repeat(7,1fr)] gap-1 text-xs">
          <div />
          {days.map((d) => (
            <div key={d} className="text-center font-semibold">{new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" })}</div>
          ))}
          {SLOTS.map((t) => (
            <div key={t} className="contents">
              <div className="py-2 text-muted-foreground">{t}</div>
              {days.map((d) => {
                const k = `${d} ${t}`;
                const bs = bookings.filter((b) => !!b.date && d >= b.date && d <= (b.end_date ?? b.date) && (b.time === t || b.full_day) && ["confirmed", "pending_deposit", "consultation"].includes(b.status));
                const studio = bs.filter((b) => b.location_type === "studio").length;
                const van = bs.filter((b) => b.location_type === "mobile").length;
                const isB = effective(k);
                return (
                  <div
                    key={k}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      mode.current = blocked.has(k) ? "unblock" : "block";
                      touch(k);
                    }}
                    onPointerEnter={() => touch(k)}
                    className={cn("min-h-10 cursor-pointer rounded-md p-1", isB ? "bg-destructive/15 text-destructive" : "bg-muted hover:bg-accent")}
                  >
                    {isB ? "💧 blocked" : (
                      <>
                        <div className={studio >= 2 ? "font-semibold text-foreground" : "text-muted-foreground"}>Bays {studio}/2</div>
                        <div className={van ? "text-electric" : "text-muted-foreground"}>Van {van}/1</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Subscriptions({ subs, bookings, onChange }: { subs: Sub[]; bookings: Booking[]; onChange: () => void }) {
  const today = todayIST();
  const active = subs.filter((s) => s.active).length;
  const month = today.slice(0, 7);
  const monthly = bookings.filter((b) => b.date?.startsWith(month) && !["lead", "link_sent", "cancelled"].includes(b.status)).length;
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
  async function upd(id: string, patch: { preferred_time?: string; active?: boolean; skip_dates?: string[] }) {
    try {
      await updSub({ data: { id, patch } });
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="rounded-2xl bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{subs.length} daily wash customers · {active} active</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground" title="Real count of bookings and generated subscription visits dated this month">{monthly.toLocaleString("en-IN")} appointments this month</span>
          <Button size="sm" onClick={runToday} disabled={running}>{running ? "Running…" : "Run today's schedule"}</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr><th className="py-2">Customer</th><th>Area</th><th>Building</th><th>Time</th><th>Status</th><th className="text-right">Actions</th></tr>
          </thead>
          <tbody>
            {subs.map((s) => {
              const skipped = s.skip_dates.includes(today);
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2"><p className="font-medium">{s.clients?.name}</p><p className="text-xs text-muted-foreground">{s.clients?.phone}</p></td>
                  <td>{s.clients?.area}</td>
                  <td className="text-muted-foreground">{s.clients?.building}, F{s.clients?.floor}</td>
                  <td>
                    <select value={s.preferred_time} onChange={(e) => upd(s.id, { preferred_time: e.target.value })} className="rounded-md border border-input bg-background px-2 py-1" aria-label="Change time">
                      {["06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "17:00", "18:00"].map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td>{!s.active ? <span className="text-muted-foreground">Paused</span> : skipped ? <span className="text-electric">Skipped today</span> : <span className="text-primary">Active</span>}</td>
                  <td className="space-x-1 text-right">
                    <Button size="sm" variant="outline" disabled={!s.active} onClick={() => upd(s.id, { skip_dates: skipped ? s.skip_dates.filter((d) => d !== today) : [...s.skip_dates, today] })}>{skipped ? "Unskip" : "Skip Today"}</Button>
                    <Button size="sm" variant={s.active ? "ghost" : "default"} onClick={() => upd(s.id, { active: !s.active })}>{s.active ? "Pause" : "Resume"}</Button>
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

type Offer = { id: string; date: string; time: string; area: string | null; status: string; expires_at: string; cancelled_booking_id: string | null; clients: { name: string; phone: string } | null };

function Waitlist({ bookings, onChange }: { bookings: Booking[]; onChange: () => void }) {
  const upcoming = bookings.filter((b) => b.date && b.date >= todayIST() && ["confirmed", "pending_deposit"].includes(b.status));
  const cancelFn = useServerFn(cancelBooking);
  const offersFn = useServerFn(listOffers);
  const offersQ = useQuery({ queryKey: ["offers"], queryFn: () => offersFn() as Promise<Offer[]>, refetchInterval: 10000 });
  const [busy, setBusy] = useState<string | null>(null);
  async function cancel(b: Booking) {
    setBusy(b.id);
    try {
      const { offered } = await cancelFn({ data: { id: b.id } });
      toast.success(offered ? `Cancelled — offered to ${offered} waitlisted customer(s)` : "Cancelled — nobody waitlisted in that area");
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const offers = offersQ.data ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl bg-card p-4">
        <p className="mb-3 font-semibold">Upcoming bookings</p>
        <ul className="divide-y divide-border text-sm">
          {upcoming.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 py-2">
              <div><p className="font-medium">{b.vehicle_model} · {b.plan}</p><p className="text-xs text-muted-foreground">{b.date} {b.time} · {b.area} · {b.clients?.name}</p></div>
              <Button size="sm" variant="outline" disabled={busy === b.id} onClick={() => cancel(b)}>{busy === b.id ? "Cancelling…" : "Cancel"}</Button>
            </li>
          ))}
          {upcoming.length === 0 && <li className="py-4 text-muted-foreground">No upcoming bookings.</li>}
        </ul>
      </div>
      <div className="rounded-2xl bg-card p-4">
        <p className="mb-3 flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Auto-backfill offers</p>
        {offersQ.isLoading && <p className="text-sm text-muted-foreground">Loading offers…</p>}
        {offersQ.isError && <p className="text-sm text-destructive">Couldn't load offers.</p>}
        {!offersQ.isLoading && offers.length === 0 && (
          <p className="text-sm text-muted-foreground">Cancel a booking and up to {OPS.offerFanout} waitlisted customers in the same area get a {OPS.offerMinutes}-minute claim link. First to claim wins.</p>
        )}
        <ul className="space-y-2">
          {offers.map((o) => {
            const expired = o.status === "offered" && new Date(o.expires_at).getTime() < Date.now();
            const st = expired ? "expired" : o.status;
            const link = `${origin}/offer/${o.id}`;
            const text = `Hi ${(o.clients?.name ?? "").split(" ")[0]}! A ${o.time} slot on ${o.date} just opened near ${o.area}. First to claim gets it (15 min): ${link} — Rai's Auto Spa`;
            return (
              <li key={o.id} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{o.clients?.name} · {o.date} {o.time}</p>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", st === "claimed" ? "bg-primary text-primary-foreground" : st === "offered" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{st === "taken" ? "slot taken" : st}</span>
                </div>
                {st === "offered" && (
                  <>
                    <p className="mt-1 text-muted-foreground">{text}</p>
                    <div className="mt-2 flex gap-2">
                      <Button asChild size="sm"><a href={wa(o.clients?.phone, text)} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a></Button>
                      <Button asChild size="sm" variant="outline"><a href={link} target="_blank" rel="noreferrer">Open claim link</a></Button>
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
  const leads = bookings.filter((b) => b.status === "lead" || b.status === "link_sent").sort((a, b) => b.created_at.localeCompare(a.created_at));
  const signed = useSigned(leads.map((l) => l.photo_url));
  const makeLink = useServerFn(createPaymentLink);
  async function send(b: Booking) {
    try {
      const { text } = await makeLink({ data: { bookingId: b.id, origin: window.location.origin } });
      await navigator.clipboard?.writeText(text).catch(() => {});
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
      toast.success("Payment link copied & opened in WhatsApp");
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="rounded-2xl bg-card p-4">
      <p className="mb-3 flex items-center gap-2 font-semibold"><Inbox className="h-4 w-4" /> Abandoned photo uploads ({leads.length})</p>
      {leads.length === 0 && <p className="text-sm text-muted-foreground">No abandoned uploads yet — they appear here when someone snaps a car but doesn't pay.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {leads.map((l) => (
          <div key={l.id} className="overflow-hidden rounded-xl border border-border">
            {l.photo_url && signed.data?.[l.photo_url] ? <img src={signed.data[l.photo_url]} alt={l.vehicle_model ?? ""} className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] bg-muted" />}
            <div className="p-3">
              <p className="font-medium">{l.vehicle_model} · viewed {l.plan}</p>
              <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("en-IN")}{l.status === "link_sent" && " · link sent"}</p>
              <Button size="sm" className="mt-2 w-full" onClick={() => send(l)}>Send Payment Link</Button>
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
      window.open(wa(b.clients.phone, `Hi ${b.clients.name.split(" ")[0]}, Rai here! Loved your ${b.colour} ${b.style} idea for the ${b.vehicle_model}. Can we tweak a few details before I start? 🎨`), "_blank");
    onChange();
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {wraps.map((w) => {
        const before = w.photo_url ? signed.data?.[w.photo_url] : undefined;
        const after = w.clean_preview_url ? signed.data?.[w.clean_preview_url] : undefined;
        return (
          <div key={w.id} className="rounded-2xl bg-charcoal p-4 text-charcoal-foreground">
            {before && after ? (
              <BeforeAfter before={before} after={after} afterLabel="AI design" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-charcoal-foreground/10 text-sm opacity-70"><Palette className="mr-2 h-4 w-4" /> Consultation booked — design at studio</div>
            )}
            <p className="mt-3 font-semibold">{w.clients?.name} · {w.vehicle_model}</p>
            <p className="text-sm opacity-80">{w.colour} · {w.style} · {w.date} {w.time}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-electric">{w.approval_status?.replace("_", " ")}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="bg-electric text-electric-foreground hover:bg-electric/90" onClick={() => set(w, "approved")}>Approve</Button>
              <Button size="sm" variant="secondary" onClick={() => set(w, "changes_requested")}>Request Change</Button>
            </div>
          </div>
        );
      })}
      {wraps.length === 0 && <p className="text-sm text-muted-foreground">No wrap consultations.</p>}
    </div>
  );
}

function Gallery({ bookings }: { bookings: Booking[] }) {
  const items = bookings.filter((b) => b.clean_preview_url && b.photo_url);
  const signed = useSigned(items.flatMap((i) => [i.photo_url, i.clean_preview_url, i.video_url]));
  if (items.length === 0)
    return <p className="flex items-center gap-2 rounded-2xl bg-card p-6 text-sm text-muted-foreground"><ImageIcon className="h-4 w-4" /> Before/afters and reveal videos appear here after customers preview their cars.</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((i) => {
        const s = signed.data ?? {};
        return (
          <div key={i.id} className="rounded-2xl bg-card p-3">
            {s[i.photo_url!] && s[i.clean_preview_url!] ? <BeforeAfter before={s[i.photo_url!]!} after={s[i.clean_preview_url!]!} afterLabel={i.plan} /> : <div className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />}
            {i.video_url && s[i.video_url] && <video src={s[i.video_url]} controls muted playsInline className="mt-2 w-full rounded-xl" />}
            <p className="mt-2 text-sm font-medium">{i.vehicle_model} · {i.plan}</p>
            <p className="text-xs text-muted-foreground">{i.clients?.name ?? "Lead"} {i.video_url ? "· video sent" : ""}</p>
          </div>
        );
      })}
      <AlertTriangle className="hidden" />
    </div>
  );
}
