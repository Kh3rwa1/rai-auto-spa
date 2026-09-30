import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, Droplets, Fuel, Inbox, Image as ImageIcon, MapPinned, MessageCircle, Palette, Route as RouteIcon, Users, Wallet } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createPaymentLink } from "@/lib/booking.functions";
import { cancelBookingLegacy, ensureDemoData, listBlocked, ownerData, ownerSignedUrls, setApproval, setBlocked, updateSubscription } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BeforeAfter } from "@/components/BeforeAfter";
import { SLOTS, STUDIO, haversineKm, inr } from "@/lib/plans";
import { addDays, todayIST } from "@/components/BookingFlow";
import { cn } from "@/lib/utils";
import type { Stop } from "./RouteMap";

const RouteMap = lazy(() => import("./RouteMap"));

type Client = { id: string; name: string; phone: string; area: string | null; building: string | null; floor: string | null; water_access: boolean };
type Booking = {
  id: string; client_id: string | null; vehicle_model: string | null; photo_url: string | null; clean_preview_url: string | null; video_url: string | null;
  plan: string; colour: string | null; style: string | null; location_type: string; map_pin: { lat: number; lng: number } | null; area: string | null;
  date: string | null; time: string | null; total: number; deposit_paid: boolean; status: string; approval_status: string | null; water_needed: boolean | null; created_at: string;
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

function planRoute(stops: Stop[]) {
  const left = [...stops];
  const order: Stop[] = [];
  let cur = { lat: STUDIO.lat, lng: STUDIO.lng };
  let km = 0;
  while (left.length) {
    let bi = 0;
    left.forEach((s, i) => haversineKm(cur, s) < haversineKm(cur, left[bi]!) && (bi = i));
    const next = left.splice(bi, 1)[0]!;
    km += haversineKm(cur, next);
    cur = next;
    order.push(next);
  }
  km += haversineKm(cur, STUDIO);
  const naive = stops.reduce((a, s) => a + 2 * haversineKm(STUDIO, s), 0);
  return { order, km, naive };
}

function Stat({ icon: I, label, value, tone }: { icon: typeof Users; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-soft)]">
      <I className={cn("h-5 w-5", tone ?? "text-primary")} />
      <p className="mt-3 font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
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
      await ensure(); // auto-seed if there's nothing from today onwards
      return load();
    },
  });
  const bookingsQ = dataQ;
  const bookings = (dataQ.data?.bookings ?? []) as unknown as Booking[];
  const subs = (dataQ.data?.subs ?? []) as unknown as Sub[];
  const refresh = () => qc.invalidateQueries();

  const todays = bookings.filter((b) => b.date === today && ["confirmed", "pending_deposit", "consultation"].includes(b.status));
  const stops: Stop[] = todays
    .filter((b) => b.location_type === "mobile" && b.map_pin)
    .map((b) => ({ lat: b.map_pin!.lat, lng: b.map_pin!.lng, label: `${b.time} ${b.vehicle_model} · ${b.clients?.name ?? ""}`, area: b.area ?? "" }));
  const route = useMemo(() => planRoute(stops), [JSON.stringify(stops)]); // eslint-disable-line react-hooks/exhaustive-deps
  // Revenue at risk = full value of real bookings dated today or later whose deposit hasn't been paid.
  const atRisk = bookings
    .filter((b) => !b.deposit_paid && !!b.date && b.date >= todayIST() && ["pending_deposit", "confirmed", "consultation"].includes(b.status))
    .reduce((a, b) => a + b.total, 0);
  const activeToday = subs.filter((s) => s.active && !s.skip_dates.includes(today));
  const liters = todays.reduce((a, b) => a + (b.plan.startsWith("Full") ? 60 : b.plan.startsWith("Signature") ? 20 : 40), 0) + activeToday.length * 30;
  const fuelSaved = Math.max(0, (route.naive - route.km) * 0.1);

  if (bookingsQ.isLoading) return <p className="p-8 text-muted-foreground">Loading…</p>;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon={CalendarDays} label="Today's bookings" value={String(todays.length + activeToday.length)} />
        <Stat icon={RouteIcon} label="Total KM today" value={`${route.km.toFixed(1)} km`} />
        <Stat icon={Fuel} label="Fuel saved by clustering" value={`${fuelSaved.toFixed(1)} L`} />
        <Stat icon={Wallet} label="Revenue at risk (no deposit)" value={inr(atRisk)} tone="text-destructive" />
        <Stat icon={Droplets} label="Water needed today" value={`${liters} L`} tone="text-electric" />
      </div>

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
                const bs = bookings.filter((b) => b.date === d && b.time === t && b.status !== "cancelled" && b.status !== "lead");
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
                        {studio > 0 && <div>Bay {studio}/2</div>}
                        {van > 0 && <div className="text-electric">Van ✓</div>}
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
  const monthly = active * 30 + bookings.filter((b) => b.status !== "lead").length;
  const updSub = useServerFn(updateSubscription);
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
        <span className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">{monthly.toLocaleString("en-IN")} appointments/mo handled automatically</span>
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

function Waitlist({ bookings, onChange }: { bookings: Booking[]; onChange: () => void }) {
  const [offer, setOffer] = useState<{ booking: Booking; people: { name: string; phone: string }[] } | null>(null);
  const upcoming = bookings.filter((b) => b.date && b.date >= todayIST() && ["confirmed", "pending_deposit"].includes(b.status));
  const cancelFn = useServerFn(cancelBookingLegacy);
  async function cancel(b: Booking) {
    try {
      const { people } = await cancelFn({ data: { id: b.id } });
      setOffer({ booking: b, people });
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl bg-card p-4">
        <p className="mb-3 font-semibold">Upcoming bookings</p>
        <ul className="divide-y divide-border text-sm">
          {upcoming.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 py-2">
              <div><p className="font-medium">{b.vehicle_model} · {b.plan}</p><p className="text-xs text-muted-foreground">{b.date} {b.time} · {b.area} · {b.clients?.name}</p></div>
              <Button size="sm" variant="outline" onClick={() => cancel(b)}>Cancel</Button>
            </li>
          ))}
          {upcoming.length === 0 && <li className="py-4 text-muted-foreground">No upcoming bookings.</li>}
        </ul>
      </div>
      <div className="rounded-2xl bg-card p-4">
        <p className="mb-3 flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Auto-backfill</p>
        {offer ? (
          <>
            <p className="rounded-xl bg-accent p-3 text-sm text-accent-foreground">Auto-offering to {offer.people.length} waitlisted in {offer.booking.area} for {offer.booking.date} {offer.booking.time}</p>
            <ul className="mt-3 space-y-2">
              {offer.people.map((p, i) => {
                const text = `Hi ${p.name.split(" ")[0]}! A ${offer.booking.time} slot on ${offer.booking.date} just opened near ${offer.booking.area}. Want it? Reply YES and it's yours — Rai's Auto Spa 🚿`;
                return (
                  <li key={i} className="rounded-xl border border-border p-3 text-sm">
                    <p className="font-medium">{p.name}</p>
                    <p className="mt-1 text-muted-foreground">{text}</p>
                    <Button asChild size="sm" className="mt-2"><a href={wa(p.phone, text)} target="_blank" rel="noreferrer"><MessageCircle /> Send on WhatsApp</a></Button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">When a booking is cancelled, the 3 nearest waitlisted customers get an instant offer.</p>
        )}
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
