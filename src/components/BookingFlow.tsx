import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Camera, Check, ChevronDown, Droplets, Loader2, MapPin, Sparkles, Store, Truck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { BeforeAfter } from "./BeforeAfter";
import { BookedScreen } from "./BookedScreen";
import {
  COLOURS,
  PLANS,
  SLOTS,
  STYLES,
  calcTotal,
  depositOf,
  inr,
  isDryWindow,
  isPrime,
  MOBILE_FEE,
  WATER_FEE,
  type PlanId,
} from "@/lib/plans";
import { confirmBooking, getSlots, makePreview, simulatePayment, uploadCar } from "@/lib/booking.functions";

const PinPicker = lazy(() => import("./PinPicker"));

export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
export function addDays(ds: string, n: number) {
  const d = new Date(ds + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const nowISTHour = () => parseInt(new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }), 10);

async function compress(file: File): Promise<{ b64: string; url: string }> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.85);
  return { b64: url.split(",")[1] ?? "", url };
}

function Step({
  n,
  title,
  summary,
  children,
  done,
  active,
  onOpen,
}: {
  n: number;
  title: string;
  summary?: string;
  children: React.ReactNode;
  done?: boolean;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <section id={`step-${n}`} className={cn("scroll-mt-36 overflow-hidden rounded-3xl border bg-card shadow-[var(--shadow-soft)] transition-colors", active ? "border-primary/50" : "border-border")}>
      <Button
        type="button"
        variant="ghost"
        className="grid h-auto w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-none px-5 py-5 text-left hover:bg-muted/50 sm:px-8"
        onClick={onOpen}
        aria-expanded={active}
      >
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold", done ? "bg-primary text-primary-foreground" : active ? "bg-charcoal text-charcoal-foreground" : "bg-muted text-muted-foreground")}>
          {done ? <Check className="h-4 w-4" /> : n}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-xl font-semibold sm:text-2xl">{title}</span>
          {!active && summary && <span className="mt-0.5 block truncate text-sm font-normal text-muted-foreground">{summary}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-primary">
          {!active && done ? "Change" : ""}
          <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", active && "rotate-180")} />
        </span>
      </Button>
      {active && <div className="animate-fade-in px-5 pb-5 sm:px-8 sm:pb-8">{children}</div>}
    </section>
  );
}

const PROGRESS = ["Snap", "Plan", "Where & When", "Preview", "Pay"] as const;

export function BookingFlow() {
  const upload = useServerFn(uploadCar);
  const preview = useServerFn(makePreview);
  const slotsFn = useServerFn(getSlots);
  const confirm = useServerFn(confirmBooking);
  const payFn = useServerFn(simulatePayment);

  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const confettiKeyRef = useRef("");
  const [activeStep, setActiveStep] = useState(1);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [booking, setBooking] = useState<{ id: string; vehicle: string } | null>(null);

  const [plan, setPlan] = useState<PlanId | null>(null);
  const [colour, setColour] = useState<string>(COLOURS[0].name);
  const [style, setStyle] = useState<string>(STYLES[0]);
  const [cache, setCache] = useState<Record<string, string>>({});
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [mobile, setMobile] = useState(true);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [parking, setParking] = useState("");
  const [guard, setGuard] = useState(false);
  const [water, setWater] = useState(true);

  const [weekStart, setWeekStart] = useState(todayIST());
  const [slots, setSlots] = useState<Record<string, { taken: number; blocked: string | null; travelMin: number | null }>>({});
  const [capacity, setCapacity] = useState(1);
  const [slot, setSlot] = useState<{ date: string; time: string } | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payStage, setPayStage] = useState<"idle" | "processing" | "verifying" | "success" | "failed">("idle");
  const [pay_, setPay_] = useState<{ method: "upi" | "card" | "netbanking"; fail: boolean; heldFor: string }>({ method: "upi", fail: false, heldFor: "" });
  const paying = payStage === "processing" || payStage === "verifying" || payStage === "success";
  const [booked, setBooked] = useState(false);
  const [revealHold, setRevealHold] = useState(false);
  const [manageToken, setManageToken] = useState("");
  const [slotsNonce, setSlotsNonce] = useState(0);

  const key = plan ? `${plan}|${plan === "signature" ? colour + "|" + style : ""}` : "";
  const previewUrl = key ? cache[key] : undefined;
  const waterFee = mobile && !water;
  const total = plan ? calcTotal(plan, mobile, waterFee) : 0;
  const deposit = depositOf(total);

  useEffect(() => {
    slotsFn({ data: { start: weekStart, mobile, pin } })
      .then((r) => {
        setSlots(r.slots);
        setCapacity(r.capacity);
      })
      .catch(() => toast.error("Could not load the calendar"));
  }, [weekStart, mobile, pin, slotsFn, slotsNonce]);

  // clear a selected slot that became invalid
  useEffect((): void => {
    if (slot && mobile && !water && isDryWindow(slot.time)) setSlot(null);
  }, [mobile, water, slot]);

  async function onFile(f?: File) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please choose a photo");
      return;
    }
    setUploading(true);
    setCache({});
    setPlan(null);
    try {
      const { b64, url } = await compress(f);
      setLocalPhoto(url);
      const r = await upload({ data: { image: b64, mime: "image/jpeg" } });
      setBooking({ id: r.bookingId, vehicle: r.vehicle });
      if (!r.isCar) toast.warning("Hmm, that doesn't look like a car — previews work best with a clear car photo.");
      setActiveStep(2);
      requestAnimationFrame(() => document.getElementById("step-2")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      toast.error((e as Error).message);
      setLocalPhoto(null);
    } finally {
      setUploading(false);
    }
  }

  async function runPreview(p: PlanId, c?: string, s?: string) {
    if (!booking) return;
    const k = `${p}|${p === "signature" ? c + "|" + s : ""}`;
    if (cache[k]) return;
    setPreviewing(k);
    setPreviewError(null);
    try {
      const r = await preview({ data: { bookingId: booking.id, plan: p, colour: c, style: s } });
      if (r.previewUrl) setCache((m) => ({ ...m, [k]: r.previewUrl! }));
    } catch (e) {
      setPreviewError((e as Error).message);
    } finally {
      setPreviewing((cur) => (cur === k ? null : cur));
    }
  }

  function choosePlan(p: PlanId) {
    setPlan(p);
    if (p !== "signature") runPreview(p);
    setActiveStep(3);
    requestAnimationFrame(() => document.getElementById("step-3")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  // Signature: generate in background whenever colour/style settle
  useEffect((): (() => void) | void => {
    if (plan !== "signature" || !booking) return;
    const t = setTimeout(() => runPreview("signature", colour, style), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, colour, style, booking]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = todayIST();

  function chooseSlot(date: string, time: string) {
    setSlot({ date, time });
    setRevealHold(true);
    setActiveStep(4);
    window.setTimeout(() => setRevealHold(false), 2000);
    requestAnimationFrame(() => revealRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  useEffect(() => {
    if (!slot || !previewUrl || revealHold) return;
    const revealKey = `${slot.date}|${slot.time}|${key}`;
    if (confettiKeyRef.current === revealKey) return;
    confettiKeyRef.current = revealKey;
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors: ["#0D9488", "#2563EB", "#FFFFFF"] });
  }, [key, previewUrl, revealHold, slot]);

  const canPay =
    !!booking && !!plan && !!slot && name.trim().length >= 2 && /^[+\d][\d\s-]{8,15}$/.test(phone.trim()) &&
    /\S+@\S+\.\S+/.test(email) && (!mobile || !!pin);

  const slotLabel = slot
    ? `${slot.date === addDays(today, 1) ? "Tomorrow" : new Date(slot.date + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} ${slot.time}`
    : "Choose time";

  function openPay() {
    if (!canPay) {
      setActiveStep(5);
      requestAnimationFrame(() => document.getElementById("step-5")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }
    setPayOpen(true);
  }

  async function pay() {
    if (!booking || !plan || !slot) return;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    setPayStage("processing");
    try {
      // Reserve the slot + save details once; retries after a failed payment reuse the hold.
      const holdKey = `${slot.date}|${slot.time}|${mobile}|${plan}`;
      let token = manageToken;
      if (pay_.heldFor !== holdKey || !token) {
        const res = await confirm({
          data: {
            bookingId: booking.id,
            plan,
            colour: plan === "signature" ? colour : undefined,
            style: plan === "signature" ? style : undefined,
            name, phone, email, mobile,
            pin: mobile ? pin : null,
            building, floor, parking, guard, water,
            date: slot.date,
            time: slot.time,
          },
        });
        token = res.manageToken ?? "";
        setManageToken(token);
        setPay_((p) => ({ ...p, heldFor: holdKey }));
      }
      await wait(900);
      setPayStage("verifying");
      await payFn({ data: { bookingId: booking.id, token, method: pay_.method, fail: pay_.fail } });
      await wait(700);
      setPayStage("success");
      await wait(800);
      setPayOpen(false);
      setPayStage("idle");
      setBooked(true);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.startsWith("SLOT_FULL:")) {
        // keep photo, preview and plan; drop only the slot and refresh the grid
        setPayOpen(false);
        setPayStage("idle");
        setSlot(null);
        setSlotsNonce((n) => n + 1);
        setActiveStep(3);
        toast.message(msg.replace("SLOT_FULL: ", ""));
      } else if (msg.startsWith("PAYMENT_FAILED:")) {
        setPayStage("failed");
      } else {
        setPayStage("idle");
        toast.error(msg);
      }
    }
  }

  if (booked && booking && plan && slot) {
    return (
      <BookedScreen
        bookingId={booking.id}
        manageToken={manageToken}
        vehicle={booking.vehicle}
        planName={PLANS[plan].name}
        date={slot.date}
        time={slot.time}
        location={mobile ? `${building}${floor ? ", Floor " + floor : ""} (van comes to you)` : "Studio, MG Marg, Gangtok"}
        total={total}
        deposit={deposit}
        phone={phone}
        onClose={() => {
          setBooked(false);
          setBooking(null);
          setLocalPhoto(null);
          setPlan(null);
          setSlot(null);
          setCache({});
        }}
      />
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="sticky top-20 z-30 -mx-4 border-y border-border bg-background/95 px-2 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <div className="mx-auto grid grid-cols-5 items-center">
          {PROGRESS.map((label, index) => {
            const n = index + 1;
            const complete = n === 1 ? !!booking : n === 2 ? !!plan : n === 3 ? !!slot : n === 4 ? !!slot && !!previewUrl && !revealHold : booked;
            return (
              <div key={label} className="relative flex min-w-0 items-center justify-center">
                <Button type="button" variant="ghost" size="sm" onClick={() => setActiveStep(n)} className={cn("relative z-10 h-auto min-h-8 min-w-0 rounded-lg px-1 py-1 text-[10px] leading-tight sm:rounded-full sm:px-2.5 sm:text-xs", activeStep === n && "bg-charcoal text-charcoal-foreground hover:bg-charcoal hover:text-charcoal-foreground")}>
                  <span className="shrink-0">{n}</span> <span className="text-center">{label}</span> {complete ? <Check className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" /> : activeStep === n ? <span aria-hidden>•</span> : null}
                </Button>
                {n < 5 && <span className={cn("absolute left-1/2 top-1/2 h-px w-full", complete ? "bg-primary" : "bg-border")} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 1 */}
      <Step n={1} title="Snap your dirty / boring car" done={!!booking} active={activeStep === 1} onOpen={() => setActiveStep(1)} summary={booking ? `${booking.vehicle} uploaded ✓` : "Add one clear car photo"}>
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        {!localPhoto ? (
          <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-primary/40 bg-accent/40 px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
              <Camera className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-semibold">One clear photo, any angle</p>
              <p className="text-sm text-muted-foreground">We'll detect your car and preview the shine instantly.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" onClick={() => camRef.current?.click()}>
                <Camera /> Take photo
              </Button>
              <Button size="lg" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload /> Upload
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="relative overflow-hidden rounded-2xl">
              <img src={localPhoto} alt="Your car" className="aspect-[4/3] w-full object-cover" />
              <span className="absolute bottom-3 left-3 rounded-full bg-charcoal/85 px-3 py-1.5 text-sm font-medium text-charcoal-foreground backdrop-blur">
                {uploading ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Detecting vehicle…</span>
                ) : (
                  <>Detected: <strong>{booking?.vehicle}</strong></>
                )}
              </span>
            </div>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              Change photo
            </Button>
          </div>
        )}
      </Step>

      {/* STEP 2 */}
      <div>
        <Step n={2} title="Pick your plan" done={!!plan} active={activeStep === 2} onOpen={() => setActiveStep(2)} summary={plan ? `${PLANS[plan].name} ✓` : "Choose your finish"}>
          <div className="grid gap-4 md:grid-cols-3 md:items-stretch">
            {(Object.keys(PLANS) as PlanId[]).map((id) => {
              const p = PLANS[id];
              const selected = plan === id;
              const sig = id === "signature";
              return (
                <button
                  key={id}
                  onClick={() => choosePlan(id)}
                  className={cn(
                    "relative flex flex-col rounded-2xl border-2 p-5 text-left transition-all hover:-translate-y-0.5",
                    sig
                      ? "border-electric/40 bg-charcoal text-charcoal-foreground"
                      : id === "detail"
                        ? "border-primary bg-card md:scale-[1.03] shadow-[var(--shadow-glow)]"
                        : "border-border bg-card",
                    selected && (sig ? "ring-4 ring-electric shadow-[var(--shadow-electric)]" : "ring-4 ring-primary/40"),
                  )}
                >
                  <span
                    className={cn(
                      "mb-3 w-fit rounded-full px-3 py-1 text-xs font-semibold",
                      sig ? "bg-electric text-electric-foreground" : id === "detail" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    )}
                  >
                    {p.badge}
                  </span>
                  <h4 className="text-lg font-semibold">{p.name}</h4>
                  <p className="mt-1 font-display text-3xl font-bold">{inr(p.price)}</p>
                  <p className={cn("text-sm", sig ? "text-charcoal-foreground/70" : "text-muted-foreground")}>{p.duration}</p>
                  <ul className="mt-4 space-y-1.5 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className={cn("h-4 w-4", sig ? "text-electric" : "text-primary")} /> {f}
                      </li>
                    ))}
                  </ul>
                  {sig && (
                    <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-electric">
                      <Sparkles className="h-4 w-4" /> AI Colour Change
                    </span>
                  )}
                  <span className={cn("mt-5 rounded-xl py-2 text-center text-sm font-semibold", selected ? (sig ? "bg-electric text-electric-foreground" : "bg-primary text-primary-foreground") : sig ? "bg-charcoal-foreground/10" : "bg-muted")}>
                    {selected ? "Selected" : "Preview this"}
                  </span>
                </button>
              );
            })}
          </div>

          {plan === "signature" && (
            <div className="mt-6 space-y-4 rounded-2xl bg-charcoal p-5 text-charcoal-foreground">
              <div>
                <p className="mb-2 text-sm font-semibold">Wrap colour</p>
                <div className="flex flex-wrap gap-2">
                  {COLOURS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setColour(c.name)}
                      className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm", colour === c.name ? "border-electric bg-electric/20" : "border-charcoal-foreground/20")}
                    >
                      <span className="h-4 w-4 rounded-full border border-charcoal-foreground/30" style={{ background: c.hex }} />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Style</p>
                <div className="flex flex-wrap gap-2">
                  {STYLES.map((s) => (
                    <button key={s} onClick={() => setStyle(s)} className={cn("rounded-full border px-3 py-1.5 text-sm", style === s ? "border-electric bg-electric/20" : "border-charcoal-foreground/20")}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Step>
      </div>

      {/* STEP 3 */}
      <Step n={3} title="Where & when" done={!!slot} active={activeStep === 3} onOpen={() => setActiveStep(3)} summary={slot ? `${mobile ? "Mobile van" : "MG Marg studio"} · ${slotLabel} ✓` : "Choose location and slot"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => setMobile(false)} className={cn("flex items-start gap-3 rounded-2xl border-2 p-4 text-left", !mobile ? "border-primary bg-accent/50" : "border-border")}>
            <Store className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold">Come to Studio</p>
              <p className="text-sm text-muted-foreground">MG Marg, Gangtok · Free · 2 bays</p>
            </div>
          </button>
          <button onClick={() => setMobile(true)} className={cn("flex items-start gap-3 rounded-2xl border-2 p-4 text-left", mobile ? "border-primary bg-accent/50" : "border-border")}>
            <Truck className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold">We Come To You</p>
              <p className="text-sm text-muted-foreground">+{inr(MOBILE_FEE)} · Mobile van</p>
            </div>
          </button>
        </div>

        {mobile ? (
          <div className="mt-5 space-y-4">
            <div>
              <Label className="mb-2 flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Tap the map to drop your pin</Label>
              <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
                <PinPicker value={pin} onChange={setPin} />
              </Suspense>
              {pin && <p className="mt-1 text-xs text-muted-foreground">Pinned at {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label htmlFor="bld">Building / Apartment</Label><Input id="bld" value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="Hilltop Residency" /></div>
              <div><Label htmlFor="flr">Floor</Label><Input id="flr" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="3" /></div>
              <div><Label htmlFor="pk">Parking slot</Label><Input id="pk" value={parking} onChange={(e) => setParking(e.target.value)} placeholder="B-12" /></div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={guard} onCheckedChange={(v) => setGuard(!!v)} /> Guard permission taken?</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={water} onCheckedChange={(v) => setWater(!!v)} /> Water available?</label>
            </div>
            {!water && (
              <p className="rounded-xl bg-accent p-3 text-sm text-accent-foreground">
                <Droplets className="mr-1 inline h-4 w-4" /> Gangtok municipal water runs 6–9am. Without water on site, we carry our own tank (+{inr(WATER_FEE)}) and 11am–4pm slots are blocked.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Studio has 2 bays — free slots show below.</p>
        )}

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold">Pick a slot</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={weekStart <= today} onClick={() => setWeekStart(addDays(weekStart, -7))}>← Prev</Button>
              <Button size="sm" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next →</Button>
            </div>
          </div>
          <div className="-mx-2 overflow-x-auto px-2 pb-2">
            <div className="grid min-w-[640px] grid-cols-7 gap-2">
              {days.map((d) => {
                const dt = new Date(d + "T00:00:00Z");
                return (
                  <div key={d} className="space-y-1.5">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">{dt.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" })}</p>
                      <p className="font-semibold">{dt.getUTCDate()}</p>
                    </div>
                    {SLOTS.map((t) => {
                      const s = slots[`${d} ${t}`];
                      const past = d === today && parseInt(t, 10) <= nowISTHour();
                      const dry = mobile && !water && isDryWindow(t);
                      const full = (s?.taken ?? 0) >= capacity;
                      const disabled = past || dry || full || !!s?.blocked;
                      const sel = slot?.date === d && slot.time === t;
                      return (
                        <button
                          key={t}
                          disabled={disabled}
                          title={dry ? "Water needed, pick morning or provide water" : s?.blocked ?? (full ? "Fully booked" : isPrime(t) ? "Prime slot" : "")}
                          onClick={() => chooseSlot(d, t)}
                          className={cn(
                            "w-full rounded-lg px-1 py-1.5 text-xs font-medium transition",
                            sel
                              ? "bg-charcoal text-charcoal-foreground"
                              : disabled
                                ? "bg-muted/50 text-muted-foreground/40 line-through"
                                : isPrime(t)
                                  ? "bg-primary/15 text-accent-foreground hover:bg-primary/25"
                                  : "bg-muted text-muted-foreground hover:bg-muted/70",
                          )}
                        >
                          {t}
                          {mobile && s?.travelMin != null && !disabled && <span className="block text-[10px] opacity-70">~{s.travelMin}m van</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-primary/30" /> Prime (7–10am, 5–7pm)</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-muted" /> Regular</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-muted/50" /> Unavailable</span>
          </div>
          {mobile && !water && (
            <p className="mt-3 text-sm font-medium text-destructive">Water needed, pick morning or provide water — 11am–4pm is blocked.</p>
          )}
        </div>

        {plan && (
          <div className="mt-6 rounded-2xl bg-muted p-4 text-sm">
            <div className="flex justify-between"><span>{PLANS[plan].name}</span><span>{inr(PLANS[plan].price)}</span></div>
            {mobile && <div className="flex justify-between"><span>Mobile van</span><span>{inr(MOBILE_FEE)}</span></div>}
            {waterFee && <div className="flex justify-between"><span>Water tank</span><span>{inr(WATER_FEE)}</span></div>}
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold"><span>Total</span><span>{inr(total)}</span></div>
          </div>
        )}
      </Step>

      {/* STEP 4 — PREVIEW (generated in the background since step 2) */}
      <div ref={revealRef}>
      <Step n={4} title="Your car, after Rai" done={!!slot && !!previewUrl && !revealHold} active={activeStep === 4} onOpen={() => setActiveStep(4)} summary={slot && previewUrl ? "Surprise revealed ✓" : "Your surprise is waiting"}>
        {!slot ? (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-charcoal">
            {localPhoto && <img src={localPhoto} alt="Hidden car preview" className="h-full w-full scale-110 object-cover opacity-45 blur-2xl" />}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-charcoal/35 px-5 text-center text-charcoal-foreground">
              <Sparkles className="h-9 w-9 text-electric" />
              <p className="font-display text-xl font-semibold">Pick your slot in Step 3 to reveal your car ✨</p>
            </div>
          </div>
        ) : previewUrl && localPhoto && !revealHold ? (
          <div className="reveal-curtain"><BeforeAfter before={localPhoto} after={previewUrl} afterLabel={`After Rai's ${plan ? PLANS[plan].name : "service"}`} /></div>
        ) : previewError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
            <p className="font-medium text-destructive">{previewError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => plan && runPreview(plan, colour, style)}>Try again</Button>
          </div>
        ) : (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted">
            {localPhoto && <img src={localPhoto} alt="" className="h-full w-full scale-105 object-cover opacity-50 blur-lg" />}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/40 backdrop-blur-sm">
              <div className="h-2 w-2/3 overflow-hidden rounded-full bg-muted"><span className="shine-shimmer block h-full w-1/3 rounded-full bg-primary" /></div>
              <p className="font-display text-lg font-semibold">Adding final shine...</p>
            </div>
          </div>
        )}
      </Step>
      </div>

      {/* STEP 5 */}
      <Step n={5} title="Pay & confirm" active={activeStep === 5} onOpen={() => setActiveStep(5)} summary={canPay ? `${inr(deposit)} deposit ready` : "Add your contact details"}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label htmlFor="nm">Your name</Label><Input id="nm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pema Bhutia" /></div>
          <div><Label htmlFor="ph">WhatsApp number</Label><Input id="ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98320 12345" /></div>
          <div><Label htmlFor="em">Email (for your reveal video)</Label><Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" /></div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-border p-4 text-sm sm:grid-cols-3">
          <div><dt className="text-muted-foreground">Plan</dt><dd className="font-medium">{plan ? PLANS[plan].name : "—"}</dd></div>
          <div><dt className="text-muted-foreground">Vehicle</dt><dd className="font-medium">{booking?.vehicle ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Location</dt><dd className="font-medium">{mobile ? building || "Your place" : "Studio, MG Marg"}</dd></div>
          <div><dt className="text-muted-foreground">Time</dt><dd className="font-medium">{slot ? `${slot.date} · ${slot.time}` : "—"}</dd></div>
          <div><dt className="text-muted-foreground">Total</dt><dd className="font-medium">{plan ? inr(total) : "—"}</dd></div>
          <div><dt className="text-muted-foreground">Deposit (30%)</dt><dd className="font-semibold text-primary">{plan ? inr(deposit) : "—"}</dd></div>
        </dl>
        {!canPay && (
          <p className="mt-3 text-xs text-muted-foreground">
             To pay: {[!booking && "snap your car", !plan && "pick a plan", !slot && "pick a slot", mobile && !pin && "drop a map pin", name.trim().length < 2 && "add your name", !/^[+\d][\d\s-]{8,15}$/.test(phone.trim()) && "add WhatsApp number", !/\S+@\S+\.\S+/.test(email) && "add email"].filter(Boolean).join(", ")}.
          </p>
        )}
        <Button size="lg" className="mt-5 w-full text-base" disabled={!canPay} onClick={() => setPayOpen(true)}>
          Pay {plan ? inr(deposit) : ""} Deposit
        </Button>
      </Step>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-15px_var(--foreground)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <p className="min-w-0 truncate text-xs font-medium">
            {plan ? PLANS[plan].name : "Choose plan"} <span className="text-muted-foreground">•</span> {slotLabel} <span className="text-muted-foreground">•</span> {plan ? inr(total) : "—"}
            <span className="block truncate text-[11px] text-muted-foreground">{plan ? `Pay ${inr(deposit)} Deposit` : "Complete the steps to book"}</span>
          </p>
          <Button size="sm" disabled={!canPay} onClick={openPay}>Pay{plan ? ` ${inr(deposit)}` : ""}</Button>
        </div>
      </div>

      {payOpen && (
        <div role="dialog" aria-modal="true" aria-label="Demo checkout" className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/60 p-4 backdrop-blur-sm sm:items-center" onClick={() => !paying && setPayOpen(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-semibold uppercase tracking-wider text-electric">Secure checkout · Demo payment - no real money</p>
            <h4 className="mt-1 text-2xl font-semibold">Pay {inr(deposit)}</h4>
            <p className="text-sm text-muted-foreground">Deposit for {plan && PLANS[plan].name}. Balance {inr(total - deposit)} after service.</p>
            {payStage === "idle" || payStage === "failed" ? (
              <>
                {payStage === "failed" && (
                  <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">Payment failed — nothing was charged. Your slot is still held, tap retry.</p>
                )}
                <div className="mt-5 space-y-2">
                  {([["upi", "UPI (GPay / PhonePe / Paytm)"], ["card", "Card"], ["netbanking", "Netbanking"]] as const).map(([id, label]) => (
                    <label key={id} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
                      <input type="radio" name="pm" checked={pay_.method === id} onChange={() => setPay_((p) => ({ ...p, method: id }))} /> {label}
                    </label>
                  ))}
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={pay_.fail} onChange={(e) => setPay_((p) => ({ ...p, fail: e.target.checked }))} /> Simulate failure
                </label>
                <Button size="lg" className="mt-4 w-full" onClick={pay}>
                  {payStage === "failed" ? `Retry ${inr(deposit)}` : `Pay ${inr(deposit)}`}
                </Button>
                <Button variant="ghost" className="mt-2 w-full" onClick={() => { setPayOpen(false); setPayStage("idle"); }}>Cancel</Button>
              </>
            ) : (
              <ol className="mt-6 space-y-3 text-sm" aria-live="polite">
                {(["processing", "verifying", "success"] as const).map((st, i) => {
                  const order = ["processing", "verifying", "success"].indexOf(payStage);
                  const done = i < order || payStage === "success";
                  return (
                    <li key={st} className={`flex items-center gap-3 ${i > order ? "text-muted-foreground" : ""}`}>
                      {done ? <Check className="h-4 w-4 text-teal" /> : i === order ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="h-4 w-4 rounded-full border border-border" />}
                      {st === "processing" ? "Processing" : st === "verifying" ? "Verifying with bank" : "Success"}
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="mt-3 text-center text-[11px] text-muted-foreground">Demo payment - no real money is charged.</p>
          </div>
        </div>
      )}
    </div>
  );
}
