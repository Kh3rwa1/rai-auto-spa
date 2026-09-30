import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarPlus, Check, Loader2, LocateFixed, MapPin, Store, Truck, Zap } from "lucide-react";
import {
  AREAS,
  MOBILE_FEE,
  PLANS,
  SLOTS,
  WATER_FEE,
  calcTotal,
  depositOf,
  inr,
  isDryWindow,
  type PlanId,
} from "@/lib/plans";
import { getSlots } from "@/lib/booking.functions";
import { holdQuickSlot, releaseQuickSlot, startQuickBooking } from "@/lib/quickbook.functions";
import { CheckoutModal } from "./booking/CheckoutModal";
import { initialDraft, type Draft } from "./booking/useBookingDraft";

type Slot = { date: string; time: string };
type SlotMap = Record<string, { taken: number; blocked: string | null; travelMin: number | null }>;

const DAY = 86_400_000;
const HOLD_MIN = 20;
const MAPS_URL = "https://maps.google.com/?q=MG+Marg+Gangtok+737101";
const istNow = () => new Date(Date.now() + 5.5 * 3_600_000);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (ds: string, n: number) => ymd(new Date(Date.parse(ds) + n * DAY));
const timeLabel = (t: string) => {
  const h = Number(t.slice(0, 2));
  return `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
};
const dayLabel = (ds: string, today: string) =>
  ds === today
    ? "Today"
    : ds === plusDays(today, 1)
      ? "Tmrw"
      : new Date(ds + "T00:00:00Z").toLocaleDateString("en-IN", {
          weekday: "short",
          timeZone: "UTC",
        });
const reducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function calendarUrl(plan: PlanId, date: string, time: string, where: string) {
  const [h, m] = time.split(":").map(Number);
  const start = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h, m);
  const mins = plan === "wash" ? 45 : plan === "detail" ? 120 : 33 * 60; // Signature: 9am → 6pm next day
  const f = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").slice(0, 15);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${PLANS[plan].name} — Rai's Auto Spa`,
    dates: `${f(start)}/${f(start + mins * 60_000)}`,
    ctz: "Asia/Kolkata",
    location: where,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

const PLAN_IDS = Object.keys(PLANS) as PlanId[];
const TINT: Record<PlanId, string> = { wash: "#9EE6C4", detail: "#B9A7FF", signature: "#FF5FA2" };

const CSS = `
.qb{--ink:#111;--pink:#FF5FA2;--yellow:#FFD84D;--mint:#9EE6C4;color:var(--ink)}
.qb-h{font-family:Outfit,Inter,system-ui,sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:-.02em}
.qb-card{position:relative;border:3px solid var(--ink);border-radius:16px;background:#fff;text-align:left;transition:transform .18s cubic-bezier(.3,1.6,.5,1),box-shadow .18s}
.qb-card:hover:not(:disabled){transform:translate(-2px,-2px);box-shadow:5px 5px 0 var(--ink)}
.qb-card:active:not(:disabled){transform:translate(2px,2px);box-shadow:0 0 0 var(--ink)}
.qb-card[aria-checked=true]{transform:translate(-3px,-3px);box-shadow:6px 6px 0 var(--ink)}
.qb-card:disabled{opacity:.45;cursor:not-allowed}
.qb-tick{position:absolute;top:10px;right:10px;display:grid;place-items:center;width:28px;height:28px;border-radius:999px;border:2.5px solid var(--ink);background:var(--yellow);animation:qb-pop .4s cubic-bezier(.3,1.6,.5,1)}
.qb-chip{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border:2.5px solid var(--ink);border-radius:999px;background:#fff;font-weight:800;font-size:14px;transition:transform .15s cubic-bezier(.3,1.6,.5,1),background .15s}
.qb-chip:hover:not(:disabled){transform:translateY(-2px)}
.qb-chip:active:not(:disabled){transform:scale(.93)}
.qb-chip[aria-pressed=true]{background:var(--yellow);animation:qb-pop .35s cubic-bezier(.3,1.6,.5,1)}
.qb-chip:disabled,.qb-day:disabled{opacity:.35;cursor:not-allowed}
.qb-chip:disabled{text-decoration:line-through}
.qb-day{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;min-width:64px;padding:8px 6px;border:2.5px solid var(--ink);border-radius:14px;background:#fff;font-weight:800;transition:transform .15s cubic-bezier(.3,1.6,.5,1)}
.qb-day:hover:not(:disabled){transform:translateY(-3px)}
.qb-day[aria-pressed=true]{background:var(--ink);color:#fff;transform:translateY(-3px)}
.qb-num{display:grid;place-items:center;width:34px;height:34px;border-radius:999px;border:3px solid var(--ink);background:#fff;font-size:15px}
.qb-done .qb-num{background:var(--mint);animation:qb-pop .4s cubic-bezier(.3,1.6,.5,1)}
.qb-in{animation:qb-in .45s cubic-bezier(.2,.9,.3,1.2) both}
.qb-input{width:100%;min-height:52px;padding:0 14px;border:3px solid var(--ink);border-radius:14px;background:#fff;font-weight:600;transition:box-shadow .15s,transform .15s}
.qb-input:focus{outline:none;box-shadow:4px 4px 0 var(--pink);transform:translate(-1px,-1px)}
.qb-soon{position:relative;overflow:hidden;display:flex;align-items:center;gap:8px;width:100%;min-height:56px;padding:0 16px;border:3px solid var(--ink);border-radius:16px;background:var(--yellow);font-weight:800;text-align:left;box-shadow:4px 4px 0 var(--ink);transition:transform .15s}
.qb-soon:hover{transform:translate(-2px,-2px)}
.qb-soon:active{transform:translate(3px,3px);box-shadow:0 0 0 var(--ink)}
.qb-soon::after{content:"";position:absolute;inset:0 auto 0 0;width:35%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);animation:qb-shine 2.8s ease-in-out infinite}
.qb-held{border:2.5px solid var(--ink);border-radius:12px;background:var(--mint);padding:10px 12px;font-weight:800;font-size:14px}
.qb-bar{position:sticky;bottom:12px;z-index:30;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 10px 10px 16px;border:3px solid var(--ink);border-radius:18px;background:var(--ink);color:#fff;box-shadow:5px 5px 0 var(--pink);animation:qb-up .45s cubic-bezier(.3,1.4,.5,1) both}
.qb-pay{flex:0 0 auto;min-height:52px;padding:0 20px;border:3px solid #fff;border-radius:14px;background:var(--yellow);color:var(--ink);font-weight:800;text-transform:uppercase;transition:transform .15s cubic-bezier(.3,1.6,.5,1)}
.qb-pay:not(:disabled){animation:qb-pulse 1.8s ease-in-out infinite}
.qb-pay:hover:not(:disabled){transform:scale(1.05)}
.qb-pay:disabled{background:#555;color:#bbb;border-color:#555}
.qb-big{display:grid;place-items:center;width:84px;height:84px;margin:0 auto;border:4px solid var(--ink);border-radius:999px;background:var(--mint);box-shadow:5px 5px 0 var(--ink);animation:qb-pop .6s cubic-bezier(.3,1.6,.5,1)}
.qb button:focus-visible,.qb input:focus-visible,.qb a:focus-visible{outline:3px solid var(--pink);outline-offset:3px}
@keyframes qb-pop{0%{transform:scale(.8)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes qb-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes qb-up{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
@keyframes qb-shine{0%{transform:translateX(-120%) skewX(-20deg)}60%,100%{transform:translateX(320%) skewX(-20deg)}}
@keyframes qb-pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,216,77,.7)}50%{box-shadow:0 0 0 8px rgba(255,216,77,0)}}
@media (prefers-reduced-motion:reduce){.qb *,.qb *::after{animation:none!important;transition:none!important}}
`;

function Block({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`qb-in ${done ? "qb-done" : ""}`} aria-label={title}>
      <h3 className="qb-h mb-3 flex items-center gap-3 text-xl">
        <span key={done ? "d" : "n"} className="qb-num" aria-hidden>
          {done ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function QuickBook({ onUsePhotoFlow }: { onUsePhotoFlow?: () => void }) {
  const start = useServerFn(startQuickBooking);
  const hold = useServerFn(holdQuickSlot);
  const release = useServerFn(releaseQuickSlot);
  const fetchSlots = useServerFn(getSlots);

  const [plan, setPlan] = useState<PlanId | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [area, setArea] = useState<string | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [building, setBuilding] = useState("");
  const [water, setWater] = useState(true);
  const [slots, setSlots] = useState<SlotMap>({});
  const [capacity, setCapacity] = useState(2);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [heldAt, setHeldAt] = useState<number | null>(null);
  const [holding, setHolding] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [manageToken, setManageToken] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [booked, setBooked] = useState(false);
  const [locating, setLocating] = useState(false);
  const [, setTick] = useState(0);
  const starting = useRef<Promise<string | null> | null>(null);

  const today = ymd(istNow());
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => plusDays(today, i)), [today]);

  const ensureBooking = useCallback(
    (p: PlanId): Promise<string | null> => {
      if (bookingId) return Promise.resolve(bookingId);
      if (!starting.current) {
        starting.current = start({ data: { plan: p } })
          .then((r) => {
            if (r.ok) {
              setBookingId(r.bookingId);
              return r.bookingId;
            }
            starting.current = null;
            toast.error(r.error);
            return null;
          })
          .catch(() => {
            starting.current = null;
            toast.error("Couldn't start your booking. Check your connection.");
            return null;
          });
      }
      return starting.current;
    },
    [bookingId, start],
  );

  const loadSlots = useCallback(async () => {
    try {
      const r = await fetchSlots({ data: { start: today, mobile, pin: mobile ? pin : null } });
      setSlots(r.slots);
      setCapacity(r.capacity);
    } catch {
      /* keep the last grid */
    }
  }, [fetchSlots, today, mobile, pin]);

  useEffect(() => {
    if (plan) void loadSlots();
  }, [plan, loadSlots]);

  useEffect(() => {
    if (!plan) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadSlots();
    }, 15000);
    return () => window.clearInterval(id);
  }, [plan, loadSlots]);

  useEffect(() => {
    if (!heldAt) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 30000);
    return () => window.clearInterval(id);
  }, [heldAt]);

  useEffect(() => {
    if (!booked || reducedMotion()) return;
    void import("canvas-confetti")
      .then((m) => m.default({ particleCount: 140, spread: 80, origin: { y: 0.6 } }))
      .catch(() => {});
  }, [booked]);

  const dropSlot = useCallback(() => {
    if (slot && bookingId) void release({ data: { bookingId } }).catch(() => {});
    setSlot(null);
    setHeldAt(null);
  }, [slot, bookingId, release]);

  // Availability mirrors book_slot(): capacity, owner blocks, dry window, 2-day Signature.
  const n = istNow();
  const nowMin = n.getUTCHours() * 60 + n.getUTCMinutes();
  const cellFree = (ds: string, t: string) => {
    const s = slots[`${ds} ${t}`];
    return !!s && !s.blocked && s.taken < capacity;
  };
  const isOpen = (ds: string, t: string) => {
    if (!plan) return false;
    if (ds === today && Number(t.slice(0, 2)) * 60 <= nowMin + 30) return false;
    if (mobile && !water && isDryWindow(t)) return false;
    if (plan === "signature")
      return ds !== today && [ds, plusDays(ds, 1)].every((d) => SLOTS.every((s) => cellFree(d, s)));
    return cellFree(ds, t);
  };
  const times: string[] = plan === "signature" ? ["09:00"] : [...SLOTS];
  const openTimes = (ds: string) => times.filter((t) => isOpen(ds, t));
  const soonest = (() => {
    for (const ds of days) {
      const t = openTimes(ds)[0];
      if (t) return { date: ds, time: t };
    }
    return null;
  })();
  const activeDay = day ?? slot?.date ?? soonest?.date ?? days[0]!;
  const gridLoaded = Object.keys(slots).length > 0;

  async function pick(ds: string, t: string) {
    if (!plan || holding) return;
    if (mobile && !pin) {
      toast.message("Pick your area first so the van knows where to go.");
      return;
    }
    setHolding(`${ds} ${t}`);
    const id = await ensureBooking(plan);
    if (!id) {
      setHolding(null);
      return;
    }
    try {
      const r = await hold({ data: { bookingId: id, plan, date: ds, time: t, mobile, water } });
      if (r.ok) {
        setSlot({ date: ds, time: t });
        setHeldAt(Date.now());
        setDay(ds);
      } else {
        toast.error(r.error);
      }
    } catch {
      toast.error("Couldn't hold that time. Try again.");
    } finally {
      setHolding(null);
      void loadSlots();
    }
  }

  function choosePlan(p: PlanId) {
    if (p === plan) return;
    const sig = p === "signature";
    const needDrop = !!slot && (sig !== (plan === "signature") || (sig && mobile));
    if (needDrop) dropSlot();
    if (sig && mobile) {
      setMobile(false);
      setSlots({});
      toast.message("Signature happens in the studio over 2 days, so we switched you to Studio.");
    }
    setPlan(p);
    setDay(null);
    void ensureBooking(p);
  }

  function setMode(m: boolean) {
    if (m === mobile || (m && plan === "signature")) return;
    dropSlot();
    setMobile(m);
    setSlots({});
    setDay(null);
  }

  function setWaterSafe(w: boolean) {
    setWater(w);
    if (!w && slot && mobile && isDryWindow(slot.time)) {
      dropSlot();
      toast.message("That time needs water on site — pick a morning or evening slot.");
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      toast.message("Location isn't available — pick your area instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPin({ lat: p.coords.latitude, lng: p.coords.longitude });
        setArea("My location");
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.message("Couldn't get your location — tap your area instead.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function resetAll() {
    setPlan(null);
    setBookingId(null);
    setMobile(false);
    setArea(null);
    setPin(null);
    setBuilding("");
    setWater(true);
    setSlots({});
    setDay(null);
    setSlot(null);
    setHeldAt(null);
    setManageToken("");
    setPayOpen(false);
    setBooked(false);
    starting.current = null;
  }

  const digits = phone.replace(/\D/g, "").slice(-10);
  const nameOk = name.trim().length >= 2;
  const phoneOk = /^[6-9]\d{9}$/.test(digits);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const holdLive = heldAt !== null && Date.now() - heldAt < HOLD_MIN * 60_000;
  const whereDone = !mobile || !!pin;
  const total = plan ? calcTotal(plan, mobile, mobile && !water) : 0;
  const deposit = depositOf(total);
  const ready =
    !!plan && !!bookingId && !!slot && holdLive && whereDone && nameOk && phoneOk && emailOk;
  const nextHint = !plan
    ? "Pick a service"
    : !whereDone
      ? "Pick your area"
      : !slot
        ? "Pick a time"
        : !holdLive
          ? "Hold expired — tap a time again"
          : !nameOk
            ? "Add your name"
            : !phoneOk
              ? "Add a 10-digit mobile"
              : !emailOk
                ? "Add your email"
                : null;
  const slotText = slot
    ? `${dayLabel(slot.date, today)} ${plan === "signature" ? "drop-off 9am" : timeLabel(slot.time)}`
    : "";
  const whereText = mobile
    ? `${building || area || "Your place"}, Gangtok (van comes to you)`
    : "Rai's Auto Spa, MG Marg, Gangtok 737101";

  const draft: Draft = {
    ...initialDraft,
    booking: bookingId ? { id: bookingId, vehicle: "Car" } : null,
    photo: null,
    plan,
    mobile,
    pin: mobile ? pin : null,
    building: mobile ? (building || area || "").slice(0, 120) : "",
    water: mobile ? water : true,
    slot,
    name: name.trim(),
    phone: `+91${digits}`,
    country: "IN",
    email: email.trim(),
    manageToken,
  };

  /* ───── success screen ───── */
  if (booked && plan && slot) {
    return (
      <div className="qb qb-in p-4 text-center sm:p-8" role="status">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="qb-big" aria-hidden>
          <Check className="h-10 w-10" strokeWidth={3} />
        </div>
        <h3 className="qb-h mt-5 text-4xl">You&rsquo;re booked!</h3>
        <p className="mt-2 text-lg font-bold">
          {PLANS[plan].name} · {slotText}
        </p>
        <p className="mt-1 text-sm text-[#444]">{whereText}</p>
        <p className="mt-3 text-sm font-bold">
          Paid {inr(deposit)} deposit · {inr(total - deposit)} due on the day
        </p>
        <div className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
          <a
            className="qb-soon justify-center"
            href={calendarUrl(plan, slot.date, slot.time, whereText)}
            target="_blank"
            rel="noreferrer"
          >
            <CalendarPlus className="h-5 w-5" aria-hidden /> Add to calendar
          </a>
          {!mobile && (
            <a
              className="qb-soon justify-center !bg-white"
              href={MAPS_URL}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin className="h-5 w-5" aria-hidden /> Directions
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={resetAll}
          className="mt-6 text-sm font-bold underline decoration-[#FF5FA2] decoration-[3px] underline-offset-4"
        >
          Book another car
        </button>
      </div>
    );
  }

  /* ───── booking flow ───── */
  return (
    <div className="qb space-y-7 p-2 sm:p-3">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <Block n={1} title="Pick your glow-up" done={!!plan}>
        <div role="radiogroup" aria-label="Service" className="grid gap-3 sm:grid-cols-3">
          {PLAN_IDS.map((id) => {
            const p = PLANS[id];
            const on = plan === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => choosePlan(id)}
                className="qb-card overflow-hidden p-4 pt-5"
              >
                <span
                  className="absolute inset-x-0 top-0 h-2.5 border-b-[3px] border-[#111]"
                  style={{ background: TINT[id] }}
                  aria-hidden
                />
                {on && (
                  <span className="qb-tick" aria-hidden>
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                )}
                <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-70">
                  {p.badge} · {p.duration}
                </span>
                <span className="qb-h mt-1 block text-xl leading-tight">{p.name}</span>
                <span className="qb-h mt-2 block text-3xl">{inr(p.price)}</span>
                <span className="mt-2 block text-xs text-[#444]">
                  {p.features.slice(0, 3).join(" · ")}
                </span>
              </button>
            );
          })}
        </div>
      </Block>

      {plan && (
        <Block n={2} title="Where?" done={whereDone}>
          <div role="radiogroup" aria-label="Location" className="grid grid-cols-2 gap-3">
            <button
              type="button"
              role="radio"
              aria-checked={!mobile}
              onClick={() => setMode(false)}
              className="qb-card p-4"
            >
              <Store className="h-6 w-6" aria-hidden />
              <span className="qb-h mt-2 block text-lg">Studio</span>
              <span className="block text-xs text-[#444]">MG Marg · no extra fee</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mobile}
              disabled={plan === "signature"}
              onClick={() => setMode(true)}
              className="qb-card p-4"
            >
              <Truck className="h-6 w-6" aria-hidden />
              <span className="qb-h mt-2 block text-lg">Doorstep</span>
              <span className="block text-xs text-[#444]">
                {plan === "signature"
                  ? "Signature is studio-only"
                  : `Van comes to you · +${inr(MOBILE_FEE)}`}
              </span>
            </button>
          </div>

          {mobile && (
            <div className="qb-in mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="qb-chip"
                  aria-pressed={area === "My location"}
                  onClick={locate}
                >
                  {locating ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <LocateFixed className="h-4 w-4" aria-hidden />
                  )}
                  Use my location
                </button>
                {AREAS.map((a) => (
                  <button
                    key={a.name}
                    type="button"
                    className="qb-chip"
                    aria-pressed={area === a.name}
                    onClick={() => {
                      setArea(a.name);
                      setPin({ lat: a.lat, lng: a.lng });
                    }}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
              <input
                className="qb-input"
                placeholder="House / building (helps the van find you)"
                value={building}
                maxLength={120}
                autoComplete="address-line1"
                onChange={(e) => setBuilding(e.target.value)}
              />
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 font-bold">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-black"
                  checked={water}
                  onChange={(e) => setWaterSafe(e.target.checked)}
                />
                Water tap available at your place
              </label>
              {!water && (
                <p className="qb-in text-sm text-[#444]">
                  No stress — the van brings a tank (+{inr(WATER_FEE)}). 11am–4pm isn&rsquo;t
                  available without water.
                </p>
              )}
            </div>
          )}
        </Block>
      )}

      {plan && (
        <Block n={3} title="When?" done={!!slot && holdLive}>
          {!gridLoaded ? (
            <p className="flex items-center gap-2 text-sm font-bold">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking live slots…
            </p>
          ) : (
            <>
              {soonest && !slot && whereDone && (
                <button
                  type="button"
                  className="qb-soon mb-3"
                  onClick={() => pick(soonest.date, soonest.time)}
                >
                  <Zap className="h-5 w-5" aria-hidden />
                  Soonest: {dayLabel(soonest.date, today)}{" "}
                  {plan === "signature" ? "drop-off 9am" : timeLabel(soonest.time)} — tap to grab it
                </button>
              )}
              {!soonest && (
                <p className="mb-3 text-sm font-bold">
                  Fully booked this week — message Rai and she&rsquo;ll squeeze you in.
                </p>
              )}
              {plan === "signature" && (
                <p className="mb-2 text-sm text-[#444]">
                  Signature takes 2 full days in a bay. Pick your drop-off day (9am).
                </p>
              )}
              <div
                role="group"
                aria-label="Day"
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 pt-1"
              >
                {days.map((ds) => {
                  const count = openTimes(ds).length;
                  const mine = slot?.date === ds;
                  const on = plan === "signature" ? mine : activeDay === ds;
                  return (
                    <button
                      key={ds}
                      type="button"
                      className="qb-day"
                      disabled={!count && !mine}
                      aria-pressed={on}
                      onClick={() => (plan === "signature" ? pick(ds, "09:00") : setDay(ds))}
                    >
                      <span className="text-[11px] uppercase">{dayLabel(ds, today)}</span>
                      <span className="text-xl leading-none">{Number(ds.slice(8, 10))}</span>
                      <span className="mt-0.5 text-[10px] opacity-70">
                        {holding?.startsWith(ds)
                          ? "…"
                          : mine
                            ? "yours"
                            : count
                              ? plan === "signature"
                                ? "free"
                                : `${count} open`
                              : "full"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {plan !== "signature" && (
                <div role="group" aria-label="Time" className="mt-2 flex flex-wrap gap-2">
                  {times.map((t) => {
                    const mine = slot?.date === activeDay && slot?.time === t;
                    const open = isOpen(activeDay, t);
                    return (
                      <button
                        key={t}
                        type="button"
                        className="qb-chip"
                        disabled={!open && !mine}
                        aria-pressed={mine}
                        onClick={() => pick(activeDay!, t)}
                      >
                        {holding === `${activeDay} ${t}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-label="Holding" />
                        ) : (
                          timeLabel(t)
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {slot && (
                <p
                  key={slotText}
                  className={`qb-held qb-in mt-3 ${holdLive ? "" : "!bg-[#FFD84D]"}`}
                  role="status"
                >
                  {holdLive
                    ? `✓ ${slotText} is held for you for ${HOLD_MIN} min — just add your details.`
                    : "Hold expired — tap a time again."}
                </p>
              )}
            </>
          )}
        </Block>
      )}

      {slot && (
        <Block n={4} title="Who's coming?" done={nameOk && phoneOk && emailOk}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold uppercase">Name</span>
              <input
                className="qb-input"
                autoComplete="name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold uppercase">Mobile</span>
              <span className="flex gap-2">
                <span className="qb-input !w-auto flex items-center font-extrabold" aria-hidden>
                  🇮🇳 +91
                </span>
                <input
                  className="qb-input"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98320 12345"
                  value={phone}
                  maxLength={11}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ""))}
                  aria-label="Mobile number, India"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold uppercase">Email</span>
              <input
                className="qb-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                maxLength={200}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-[#555]">No account, no spam.</p>
        </Block>
      )}

      {plan && (
        <div className="qb-bar">
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold">
              {PLANS[plan].name} · {mobile ? "Doorstep" : "Studio"}
              {slot ? ` · ${slotText}` : ""}
            </p>
            <p className="truncate text-xs opacity-80">
              {inr(total)} total · {inr(deposit)} now{nextHint ? ` · ${nextHint}` : " · ready!"}
            </p>
          </div>
          <button
            type="button"
            className="qb-pay"
            disabled={!ready}
            onClick={() => setPayOpen(true)}
          >
            Pay {inr(deposit)}
          </button>
        </div>
      )}

      {onUsePhotoFlow && (
        <button
          type="button"
          onClick={onUsePhotoFlow}
          className="block text-sm font-bold underline decoration-[#FF5FA2] decoration-[3px] underline-offset-4"
        >
          Want the AI glow-up preview first? Book with a photo →
        </button>
      )}

      {payOpen && (
        <CheckoutModal
          draft={draft}
          total={total}
          deposit={deposit}
          onClose={() => setPayOpen(false)}
          onToken={setManageToken}
          onPaid={() => {
            setPayOpen(false);
            setBooked(true);
          }}
          onSlotFull={(msg) => {
            setPayOpen(false);
            setSlot(null);
            setHeldAt(null);
            void loadSlots();
            toast.message(`${msg} Pick another time — your details are kept.`);
          }}
        />
      )}
    </div>
  );
}
