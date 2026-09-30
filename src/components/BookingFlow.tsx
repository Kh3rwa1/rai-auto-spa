import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, Check, Droplets, Loader2, MapPin, Sparkles, Store, Truck, Upload } from "lucide-react";
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
import { confirmBooking, getSlots, makePreview, uploadCar } from "@/lib/booking.functions";

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

function Step({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-8 shadow-[var(--shadow-soft)]">
      <div className="mb-5 flex items-center gap-3">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
            done ? "bg-primary text-primary-foreground" : "bg-charcoal text-charcoal-foreground",
          )}
        >
          {done ? <Check className="h-4 w-4" /> : n}
        </span>
        <h3 className="text-xl sm:text-2xl font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function BookingFlow() {
  const upload = useServerFn(uploadCar);
  const preview = useServerFn(makePreview);
  const slotsFn = useServerFn(getSlots);
  const confirm = useServerFn(confirmBooking);

  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
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
  const [paying, setPaying] = useState(false);
  const [booked, setBooked] = useState(false);

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
  }, [weekStart, mobile, pin, slotsFn]);

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
      document.getElementById("step-plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      toast.error((e as Error).message);
      setLocalPhoto(null);
    } finally {
      setUploading(false);
    }
  }

  async function runPreview(p: PlanId, c?: string, s?: string) {
    if (!booking) {
      toast.info("Snap your car first so Rai can preview it");
      document.getElementById("book")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
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
  }

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = todayIST();

  const canPay =
    !!booking && !!plan && !!slot && name.trim().length >= 2 && /^[+\d][\d\s-]{8,15}$/.test(phone.trim()) &&
    /\S+@\S+\.\S+/.test(email) && (!mobile || (!!pin && building.trim().length > 0));

  async function pay() {
    if (!booking || !plan || !slot) return;
    setPaying(true);
    try {
      await new Promise((r) => setTimeout(r, 1400));
      await confirm({
        data: {
          bookingId: booking.id,
          plan,
          colour: plan === "signature" ? colour : undefined,
          style: plan === "signature" ? style : undefined,
          name,
          phone,
          email,
          mobile,
          pin: mobile ? pin : null,
          building,
          floor,
          parking,
          guard,
          water,
          date: slot.date,
          time: slot.time,
        },
      });
      setPayOpen(false);
      setBooked(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPaying(false);
    }
  }

  if (booked && booking && plan && slot) {
    return (
      <BookedScreen
        bookingId={booking.id}
        vehicle={booking.vehicle}
        planName={PLANS[plan].name}
        date={slot.date}
        time={slot.time}
        location={mobile ? `${building}${floor ? ", Floor " + floor : ""} (van comes to you)` : "Studio, MG Marg, Gangtok"}
        total={total}
        deposit={deposit}
        phone={phone}
        before={localPhoto ?? ""}
        after={previewUrl ?? localPhoto ?? ""}
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
    <div className="space-y-6">
      {/* STEP 1 */}
      <Step n={1} title="Snap your dirty / boring car" done={!!booking}>
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
      <div id="step-plans" className="scroll-mt-24">
        <Step n={2} title="Pick your plan — see it instantly" done={!!previewUrl}>
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
              <Button className="bg-electric text-electric-foreground hover:bg-electric/90" onClick={() => runPreview("signature", colour, style)} disabled={!!previewing}>
                <Sparkles /> Generate my design
              </Button>
            </div>
          )}

          {plan && (
            <div className="mt-6">
              {previewUrl && localPhoto ? (
                <BeforeAfter before={localPhoto} after={previewUrl} afterLabel={`After Rai's ${PLANS[plan].name}`} />
              ) : previewing === key ? (
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
                  {localPhoto && <img src={localPhoto} alt="" className="h-full w-full object-cover blur-md scale-105" />}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-charcoal/40 text-charcoal-foreground">
                    <Droplets className="h-10 w-10 animate-bounce" />
                    <p className="font-display text-xl font-semibold">Rai is shining your car…</p>
                    <p className="text-sm opacity-80">About 20–40 seconds</p>
                  </div>
                </div>
              ) : previewError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
                  <p className="font-medium text-destructive">{previewError}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => runPreview(plan, colour, style)}>Try again</Button>
                </div>
              ) : !booking ? (
                <p className="rounded-2xl bg-muted p-5 text-sm text-muted-foreground">Snap your car in step 1 to see the AI preview. You can still book without it.</p>
              ) : plan === "signature" ? (
                <p className="rounded-2xl bg-muted p-5 text-sm text-muted-foreground">Choose a colour and style, then tap "Generate my design".</p>
              ) : null}
            </div>
          )}
        </Step>
      </div>

      {/* STEP 3 */}
      <Step n={3} title="Where & when" done={!!slot}>
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
                          onClick={() => setSlot({ date: d, time: t })}
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

      {/* STEP 4 */}
      <Step n={4} title="Pay & confirm">
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
            To pay: {[!booking && "snap your car", !plan && "pick a plan", !slot && "pick a slot", mobile && !pin && "drop a map pin", mobile && !building.trim() && "add your building", name.trim().length < 2 && "add your name", !/^[+\d][\d\s-]{8,15}$/.test(phone.trim()) && "add WhatsApp number", !/\S+@\S+\.\S+/.test(email) && "add email"].filter(Boolean).join(", ")}.
          </p>
        )}
        <Button size="lg" className="mt-5 w-full text-base" disabled={!canPay} onClick={() => setPayOpen(true)}>
          Pay {plan ? inr(deposit) : ""} Deposit
        </Button>
      </Step>

      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/60 p-4 backdrop-blur-sm sm:items-center" onClick={() => !paying && setPayOpen(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-semibold uppercase tracking-wider text-electric">Secure checkout · Demo</p>
            <h4 className="mt-1 text-2xl font-semibold">Pay {inr(deposit)}</h4>
            <p className="text-sm text-muted-foreground">Deposit for {plan && PLANS[plan].name}. Balance {inr(total - deposit)} after service.</p>
            <div className="mt-5 space-y-2">
              {["UPI (GPay / PhonePe / Paytm)", "Card", "Netbanking"].map((m, i) => (
                <label key={m} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
                  <input type="radio" name="pm" defaultChecked={i === 0} /> {m}
                </label>
              ))}
            </div>
            <Button size="lg" className="mt-5 w-full" onClick={pay} disabled={paying}>
              {paying ? <><Loader2 className="animate-spin" /> Processing…</> : `Pay ${inr(deposit)}`}
            </Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setPayOpen(false)} disabled={paying}>Cancel</Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">Test payment — no real money is charged.</p>
          </div>
        </div>
      )}
    </div>
  );
}
