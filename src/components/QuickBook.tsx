import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CalendarPlus,
  Camera,
  Check,
  Loader2,
  LocateFixed,
  MapPin,
  Sparkles,
  Store,
  Truck,
  Upload,
  Zap,
} from "lucide-react";
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
import { getSlots, makePreview, uploadCar } from "@/lib/booking.functions";
import { holdQuickSlot, releaseQuickSlot, startQuickBooking } from "@/lib/quickbook.functions";
import { PAUSED_NOTICE, bookingErrorMessage, isPausedError } from "@/lib/write-pause-ui";
import { CheckoutModal } from "./booking/CheckoutModal";
import { initialDraft, type Draft } from "./booking/useBookingDraft";

type Slot = { date: string; time: string };
type SlotMap = Record<string, { taken: number; blocked: string | null; travelMin: number | null }>;

const DAY = 86_400_000;
const HOLD_MIN = 20;
const MAPS_URL = "https://maps.google.com/?q=MG+Marg+Gangtok+737101";
const SAMPLES = [
  { file: "swift.jpg", label: "Maruti Swift" },
  { file: "thar.jpg", label: "Mahindra Thar" },
  { file: "creta.jpg", label: "Hyundai Creta" },
] as const;

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

/** Same compression as the photo flow: max 1280px JPEG. */
async function compress(file: Blob): Promise<{ b64: string; url: string }> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.85);
  return { b64: url.split(",")[1] ?? "", url };
}

function calendarUrl(plan: PlanId, date: string, time: string, where: string, car: string) {
  const [h = 9, m = 0] = time.split(":").map(Number);
  const start = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h, m);
  const mins = plan === "wash" ? 45 : plan === "detail" ? 120 : 33 * 60;
  const f = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").slice(0, 15);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${PLANS[plan].name} (${car}) — Rai's Auto Spa`,
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
button.qb-card:hover:not(:disabled){transform:translate(-2px,-2px);box-shadow:5px 5px 0 var(--ink)}
button.qb-card:active:not(:disabled){transform:translate(2px,2px);box-shadow:0 0 0 var(--ink)}
.qb-card[aria-checked=true]{transform:translate(-3px,-3px);box-shadow:6px 6px 0 var(--ink)}
.qb-card:disabled{opacity:.45;cursor:not-allowed}
.qb-tick{position:absolute;top:10px;right:10px;display:grid;place-items:center;width:28px;height:28px;border-radius:999px;border:2.5px solid var(--ink);background:var(--yellow);animation:qb-pop .4s cubic-bezier(.3,1.6,.5,1)}
.qb-chip{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border:2.5px solid var(--ink);border-radius:999px;background:#fff;font-weight:800;font-size:14px;transition:transform .15s cubic-bezier(.3,1.6,.5,1),background .15s}
.qb-chip:hover:not(:disabled){transform:translateY(-2px)}
.qb-chip:active:not(:disabled){transform:scale(.93)}
.qb-chip[aria-pressed=true]{background:var(--yellow);animation:qb-pop .35s cubic-bezier(.3,1.6,.5,1)}
.qb-chip:disabled,.qb-day:disabled{opacity:.35;cursor:not-allowed}
.qb-time:disabled{text-decoration:line-through}
.qb-sample{width:96px;overflow:hidden;border:2.5px solid var(--ink);border-radius:14px;background:#fff;font-size:11px;font-weight:800;transition:transform .18s cubic-bezier(.3,1.6,.5,1),box-shadow .18s}
.qb-sample:hover:not(:disabled){transform:translate(-2px,-2px) rotate(-1.5deg);box-shadow:4px 4px 0 var(--ink)}
.qb-sample:disabled{opacity:.5}
.qb-skel{background:linear-gradient(100deg,#f3eee4 30%,#fff 50%,#f3eee4 70%);background-size:300% 100%;animation:qb-skel 1.4s linear infinite}
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
@keyframes qb-skel{to{background-position:-300% 0}}
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
  const upload = useServerFn(uploadCar);
  const previewFn = useServerFn(makePreview);

  const [plan, setPlan] = useState<PlanId | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  // car
  const [car, setCar] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBookingId, setPhotoBookingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [plateBlurred, setPlateBlurred] = useState<boolean | null>(null);
  const [previews, setPreviews] = useState<Partial<Record<PlanId, string>>>({});
  const [previewing, setPreviewing] = useState<PlanId | null>(null);
  const [previewFailed, setPreviewFailed] = useState<PlanId | null>(null);
  const [previewPaused, setPreviewPaused] = useState(false);
  // where / when
  const [mobile, setMobile] = useState(false);
  const [area, setArea] = useState<string | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [building, setBuilding] = useState("");
  const [water, setWater] = useState(true);
  const [slots, setSlots] = useState<SlotMap>({});
  const [capacity, setCapacity] = useState(2);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [heldAt, setHeldAt] = useState<number | null>(null);
  const [holding, setHolding] = useState<string | null>(null);
  // who
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // pay
  const [manageToken, setManageToken] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [booked, setBooked] = useState(false);
  const [locating, setLocating] = useState(false);
  const [, setTick] = useState(0);

  const starting = useRef<Promise<string | null> | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRuns = useRef(new Set<string>());

  const today = ymd(istNow());
  // Weeks are browsable: offset 0 = this week, 1 = next week, …
  const weekStart = plusDays(today, weekOffset * 7);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => plusDays(weekStart, i)),
    [weekStart],
  );
  const carName = car.trim();
  const carOk = carName.length >= 2 && !uploading;

  const ensureBooking = useCallback(
    (p: PlanId): Promise<string | null> => {
      if (bookingId) return Promise.resolve(bookingId);
      if (!starting.current) {
        starting.current = start({ data: { plan: p, vehicle: carName || undefined } })
          .then((r) => {
            if (r.ok) {
              setBookingId(r.bookingId);
              setManageToken(r.manageToken ?? "");
              return r.bookingId;
            }
            starting.current = null;
            toast.error(r.error);
            return null;
          })
          .catch((e) => {
            starting.current = null;
            toast[isPausedError(e) ? "message" : "error"](
              bookingErrorMessage(e, "Couldn't start your booking. Check your connection."),
            );
            return null;
          });
      }
      return starting.current;
    },
    [bookingId, start, carName],
  );

  // Sequence guard: only the newest availability request may update the grid,
  // so a slow earlier response can't overwrite a fresher one.
  const loadSeq = useRef(0);
  const loadSlots = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const r = await fetchSlots({ data: { start: weekStart, mobile, pin: mobile ? pin : null } });
      if (seq !== loadSeq.current) return;
      setSlots(r.slots);
      setCapacity(r.capacity);
      setSlotsError(null);
    } catch {
      if (seq !== loadSeq.current) return;
      // Surface it: silently keeping the old grid can show stale availability as live.
      setSlotsError("Couldn't refresh live slots — showing the last known grid.");
    }
  }, [fetchSlots, weekStart, mobile, pin]);

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

  // AI "after" preview: once per photo + plan (cached), only for photo bookings.
  useEffect(() => {
    if (!plan || !photoBookingId || bookingId !== photoBookingId || uploading) return;
    if (previews[plan]) return;
    const key = `${photoBookingId}|${plan}`;
    if (previewRuns.current.has(key)) return;
    previewRuns.current.add(key);
    setPreviewing(plan);
    setPreviewFailed(null);
    previewFn({ data: { bookingId: photoBookingId, plan, token: manageToken } })
      .then((r) => {
        if (r.previewUrl) setPreviews((p) => ({ ...p, [plan]: r.previewUrl as string }));
        else setPreviewFailed(plan);
      })
      .catch((e) => {
        setPreviewPaused(isPausedError(e));
        setPreviewFailed(plan);
      })
      .finally(() => setPreviewing((cur) => (cur === plan ? null : cur)));
  }, [plan, photoBookingId, bookingId, uploading, manageToken, previews, previewFn]);

  const dropSlot = useCallback(() => {
    if (slot && bookingId)
      void release({ data: { bookingId, token: manageToken } }).catch(() => {});
    setSlot(null);
    setHeldAt(null);
  }, [slot, bookingId, manageToken, release]);

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

  async function holdFor(id: string, ds: string, t: string) {
    if (!plan) return false;
    const r = await hold({
      data: {
        bookingId: id,
        plan,
        date: ds,
        time: t,
        mobile,
        water,
        vehicle: carName || undefined,
        token: manageToken,
      },
    });
    if (r.ok) {
      setSlot({ date: ds, time: t });
      setHeldAt(Date.now());
      setDay(ds);
      return true;
    }
    toast.error(r.error);
    return false;
  }

  async function pick(ds: string, t: string) {
    if (!plan || holding || uploading) return;
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
      await holdFor(id, ds, t);
    } catch (e) {
      toast[isPausedError(e) ? "message" : "error"](
        bookingErrorMessage(e, "Couldn't hold that time. Try again."),
      );
    } finally {
      setHolding(null);
      void loadSlots();
    }
  }

  async function sendPhoto(f?: Blob | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please choose a photo.");
      return;
    }
    setUploading(true);
    const prevSlot = slot;
    const prevBooking = bookingId;
    try {
      const { b64, url } = await compress(f);
      setPhoto(url);
      setPlateBlurred(null);
      const r = await upload({ data: { image: b64, mime: "image/jpeg" } });
      if (!r.ok) throw new Error(r.error);
      if (!r.isCar)
        toast.warning(
          "Hmm, that doesn't look like a car — previews work best with a clear car photo.",
        );
      if (r.photoUrl) setPhoto(r.photoUrl);
      setPlateBlurred(!!r.plateBlurred);
      if (r.vehicle && r.vehicle !== "Car") setCar(r.vehicle);
      setPreviews({});
      setPreviewFailed(null);
      // The photo creates its own booking row — move any held slot over to it.
      setBookingId(r.bookingId);
      setManageToken(r.manageToken ?? "");
      setPhotoBookingId(r.bookingId);
      starting.current = Promise.resolve(r.bookingId);
      if (prevSlot && prevBooking) {
        setSlot(null);
        setHeldAt(null);
        await release({ data: { bookingId: prevBooking, token: manageToken } }).catch(() => {});
        const ok = await holdFor(r.bookingId, prevSlot.date, prevSlot.time).catch(() => false);
        if (!ok) toast.message("Photo added — please pick your time again.");
        void loadSlots();
      }
    } catch (e) {
      toast[isPausedError(e) ? "message" : "error"](
        bookingErrorMessage(e, "Couldn't upload the photo."),
      );
      setPhoto(null);
    } finally {
      setUploading(false);
      if (camRef.current) camRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function sample(file: string) {
    try {
      const res = await fetch(`/samples/${file}`);
      if (!res.ok) throw new Error();
      await sendPhoto(await res.blob());
    } catch {
      toast.error("Couldn't load the sample car — try again.");
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
    setCar("");
    setPhoto(null);
    setPhotoBookingId(null);
    setPlateBlurred(null);
    setPreviews({});
    setPreviewing(null);
    setPreviewFailed(null);
    setMobile(false);
    setArea(null);
    setPin(null);
    setBuilding("");
    setWater(true);
    setSlots({});
    setSlotsError(null);
    setWeekOffset(0);
    setDay(null);
    setSlot(null);
    setHeldAt(null);
    setManageToken("");
    setPayOpen(false);
    setBooked(false);
    starting.current = null;
    previewRuns.current.clear();
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
    !!plan &&
    carOk &&
    !!bookingId &&
    !!slot &&
    holdLive &&
    whereDone &&
    nameOk &&
    phoneOk &&
    emailOk;
  const nextHint = !plan
    ? "Pick a service"
    : !carOk
      ? uploading
        ? "Checking your photo…"
        : "Add your car"
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
  const preview = plan ? previews[plan] : undefined;

  const draft: Draft = {
    ...initialDraft,
    booking: bookingId ? { id: bookingId, vehicle: carName || "Car" } : null,
    photo,
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
        <p className="mx-auto w-fit rounded-full bg-[#FFD84D] px-3 py-1 text-xs font-extrabold">
          Demo booking — no real money was charged
        </p>
        <div className="qb-big mt-4" aria-hidden>
          <Check className="h-10 w-10" strokeWidth={3} />
        </div>
        <h3 className="qb-h mt-5 text-4xl">You&rsquo;re booked!</h3>
        <p className="mt-2 text-lg font-bold">
          {PLANS[plan].name} for your {carName || "car"} · {slotText}
        </p>
        <p className="mt-1 text-sm text-[#444]">{whereText}</p>
        <p className="mt-3 text-sm font-bold">
          Simulated deposit paid: {inr(deposit)} · {inr(total - deposit)} due on the day
        </p>
        {preview && (
          <img
            src={preview}
            alt="Your car after the service (AI preview)"
            className="qb-card mx-auto mt-5 aspect-[4/3] w-full max-w-sm object-cover"
          />
        )}
        <div className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
          <a
            className="qb-soon justify-center"
            href={calendarUrl(plan, slot.date, slot.time, whereText, carName || "car")}
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
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Take a photo of your car"
        onChange={(e) => void sendPhoto(e.target.files?.[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Upload a photo of your car"
        onChange={(e) => void sendPhoto(e.target.files?.[0])}
      />

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
                <span className="mt-2 block text-xs text-[#444]">{p.features.join(" · ")}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] font-extrabold uppercase tracking-wider text-[#555]">
          Doorstep van +{inr(MOBILE_FEE)} · 30% deposit secures your slot · No hidden fees
        </p>
      </Block>

      {plan && (
        <Block n={2} title="Your car" done={carOk}>
          {photo ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <figure className="qb-card overflow-hidden">
                <img
                  src={photo}
                  alt={carName ? `Your ${carName}` : "Your car"}
                  className="aspect-[4/3] w-full object-cover"
                />
                <figcaption className="flex items-center justify-between gap-2 border-t-[3px] border-[#111] px-3 py-2 text-[11px] font-extrabold uppercase">
                  <span className="flex items-center gap-1.5">
                    {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                    {uploading ? "Detecting your car…" : "Before"}
                  </span>
                  {plateBlurred !== null && (
                    <span>{plateBlurred ? "Plate blurred ✓" : "No plate found"}</span>
                  )}
                </figcaption>
              </figure>
              <figure className="qb-card overflow-hidden">
                {preview ? (
                  <img
                    src={preview}
                    alt="AI preview of your car after the service"
                    className="qb-in aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div
                    className={`grid aspect-[4/3] w-full place-items-center p-4 text-center text-sm font-bold ${previewing === plan ? "qb-skel" : "bg-[#FFF8EC]"}`}
                    aria-live="polite"
                  >
                    {previewing === plan ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Making your
                        glow-up…
                      </span>
                    ) : previewFailed === plan ? (
                      previewPaused ? (
                        PAUSED_NOTICE
                      ) : (
                        "Preview unavailable right now — you can still book."
                      )
                    ) : uploading ? (
                      "Preview comes right after the photo."
                    ) : (
                      "Preview on its way…"
                    )}
                  </div>
                )}
                <figcaption className="flex items-center justify-between gap-2 border-t-[3px] border-[#111] px-3 py-2 text-[11px] font-extrabold uppercase">
                  <span>After · AI preview</span>
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                </figcaption>
              </figure>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="qb-chip"
                  disabled={uploading}
                  onClick={() => camRef.current?.click()}
                >
                  <Camera className="h-4 w-4" aria-hidden /> Take photo
                </button>
                <button
                  type="button"
                  className="qb-chip"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" aria-hidden /> Upload
                </button>
              </div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#555]">
                No car handy? Try a sample
              </p>
              <div className="flex flex-wrap gap-3">
                {SAMPLES.map((s) => (
                  <button
                    key={s.file}
                    type="button"
                    className="qb-sample"
                    disabled={uploading}
                    onClick={() => void sample(s.file)}
                  >
                    <img
                      src={`/samples/${s.file}`}
                      alt=""
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <span className="block px-1 py-1.5">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-extrabold uppercase">
              {photo ? "Car model (edit if we got it wrong)" : "Or just type your car"}
            </span>
            <input
              className="qb-input"
              placeholder="e.g. Maruti Swift"
              value={car}
              maxLength={60}
              autoComplete="off"
              onChange={(e) => setCar(e.target.value)}
            />
          </label>
          <p className="mt-2 text-xs text-[#555]">
            {photo
              ? "We blur the plate when we detect one. If no plate is detected the photo is shown as-is; originals stay owner-only."
              : "Photo is optional. Add one to see an AI preview of your car after the service."}
          </p>
          {photo && (
            <button
              type="button"
              className="qb-chip mt-3"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="h-4 w-4" aria-hidden /> Change photo
            </button>
          )}
          {plan === "signature" && onUsePhotoFlow && (
            <button
              type="button"
              onClick={onUsePhotoFlow}
              className="mt-3 block text-sm font-bold underline decoration-[#FF5FA2] decoration-[3px] underline-offset-4"
            >
              Want to choose your wrap colour and style? Open the full wrap studio →
            </button>
          )}
        </Block>
      )}

      {plan && (
        <Block n={3} title="Where?" done={whereDone}>
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
        <Block n={4} title="When?" done={!!slot && holdLive}>
          {!gridLoaded && !slotsError ? (
            <p className="flex items-center gap-2 text-sm font-bold">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking live slots…
            </p>
          ) : (
            <>
              {slotsError && (
                <div
                  role="alert"
                  className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border-[2.5px] border-[#111] bg-[#FFF8EC] p-3 text-sm font-bold"
                >
                  <span>{slotsError}</span>
                  <button type="button" className="qb-chip" onClick={() => void loadSlots()}>
                    Retry
                  </button>
                </div>
              )}
              {soonest && !slot && whereDone && (
                <button
                  type="button"
                  className="qb-soon mb-3"
                  onClick={() => void pick(soonest.date, soonest.time)}
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
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#555]">
                  {weekOffset === 0
                    ? "This week"
                    : weekOffset === 1
                      ? "Next week"
                      : `${weekOffset} weeks out`}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="qb-chip"
                    disabled={weekOffset === 0}
                    aria-label="Previous week"
                    onClick={() => {
                      setSlots({});
                      setDay(null);
                      setWeekOffset((w) => Math.max(0, w - 1));
                    }}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="qb-chip"
                    aria-label="Next week"
                    onClick={() => {
                      setSlots({});
                      setDay(null);
                      setWeekOffset((w) => w + 1);
                    }}
                  >
                    Next week →
                  </button>
                </div>
              </div>
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
                      onClick={() => (plan === "signature" ? void pick(ds, "09:00") : setDay(ds))}
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
                        className="qb-chip qb-time"
                        disabled={!open && !mine}
                        aria-pressed={mine}
                        onClick={() => void pick(activeDay, t)}
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
        <Block n={5} title="Who's coming?" done={nameOk && phoneOk && emailOk}>
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
                <span className="qb-input flex !w-auto items-center font-extrabold" aria-hidden>
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
              {PLANS[plan].name}
              {carName ? ` · ${carName}` : ""} · {mobile ? "Doorstep" : "Studio"}
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
