import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PLANS, calcTotal, depositOf, inr, isDryWindow, type PlanId } from "@/lib/plans";
import { addDays, missingForPay, previewKey, todayIST } from "@/lib/booking-rules";
import { BookedScreen } from "./BookedScreen";
import { ProgressBar, Step } from "./booking/Step";
import { CaptureStep } from "./booking/CaptureStep";
import { PlanStep } from "./booking/PlanStep";
import { WhereWhenStep } from "./booking/WhereWhenStep";
import { PreviewStep } from "./booking/PreviewStep";
import { PayStep } from "./booking/PayStep";
import { CheckoutModal } from "./booking/CheckoutModal";
import { useBookingDraft, usePreviews } from "./booking/useBookingDraft";

export type ResumeDraft = {
  id: string;
  vehicle: string;
  photoUrl: string | null;
  previewUrl: string | null;
  plan: PlanId;
  colour: string | null;
  style: string | null;
  token: string;
};

const scrollTo = (n: number) =>
  requestAnimationFrame(() =>
    document.getElementById(`step-${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
  );

export function BookingFlow({ resume }: { resume?: ResumeDraft } = {}) {
  const { draft, set, reset } = useBookingDraft();
  const previews = usePreviews(draft.booking?.id);
  const [activeStep, setActiveStep] = useState(1);
  const [payOpen, setPayOpen] = useState(false);
  const [booked, setBooked] = useState(false);
  const [revealHold, setRevealHold] = useState(false);
  const [slotsNonce, setSlotsNonce] = useState(0);
  const confettiKey = useRef("");

  const { plan, slot, mobile, water, colour, style, booking } = draft;
  const key = plan ? previewKey(plan, colour, style) : "";
  const previewUrl = key ? previews.cache[key] : undefined;
  const total = plan ? calcTotal(plan, mobile, mobile && !water) : 0;
  const deposit = depositOf(total);
  const missing = missingForPay({
    hasBooking: !!booking,
    plan,
    hasSlot: !!slot,
    mobile,
    hasPin: !!draft.pin,
    name: draft.name,
    phone: draft.phone,
    email: draft.email,
  });
  const canPay = missing.length === 0;
  const open = (n: number) => {
    setActiveStep(n);
    scrollTo(n);
  };

  // Live grid: owner blocks/cancellations show up without a reload (poll + on tab focus).
  useEffect(() => {
    const bump = () => document.visibilityState === "visible" && setSlotsNonce((n) => n + 1);
    const id = window.setInterval(bump, 10000);
    window.addEventListener("focus", bump);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", bump);
    };
  }, []);

  // A selected slot that became invalid (water unticked → dry window) is dropped.
  useEffect(() => {
    if (slot && mobile && !water && isDryWindow(slot.time)) set({ slot: null });
  }, [mobile, water, slot, set]);

  // /pay deep link: keep photo, plan and preview, jump to Where & When.
  useEffect(() => {
    if (!resume) return;
    set({
      booking: { id: resume.id, vehicle: resume.vehicle },
      photo: resume.photoUrl,
      plan: resume.plan,
      colour: resume.colour ?? draft.colour,
      style: resume.style ?? draft.style,
      manageToken: resume.token,
    });
    if (resume.previewUrl)
      previews.seed(
        previewKey(resume.plan, resume.colour ?? draft.colour, resume.style ?? draft.style),
        resume.previewUrl,
      );
    setActiveStep(3);
    // Run once per resume payload; draft defaults are stable initial values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume]);

  // Previews start silently: non-Signature on plan pick (and on resume), Signature after colour/style settle.
  const { run } = previews;
  useEffect(() => {
    if (!plan || !booking) return;
    if (plan !== "signature") return void run(plan);
    const t = setTimeout(() => run("signature", colour, style), 900);
    return () => clearTimeout(t);
  }, [plan, colour, style, booking, run]);

  useEffect(() => {
    if (!slot || !previewUrl || revealHold) return;
    const k = `${slot.date}|${slot.time}|${key}`;
    if (confettiKey.current === k) return;
    confettiKey.current = k;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.7 },
        colors: ["#0D9488", "#2563EB", "#FFFFFF"],
      });
  }, [key, previewUrl, revealHold, slot]);

  function chooseSlot(date: string, time: string) {
    set({ slot: { date, time } });
    setRevealHold(true);
    window.setTimeout(() => setRevealHold(false), 2000);
    open(4);
  }

  const today = todayIST();
  const slotLabel = slot
    ? `${slot.date === addDays(today, 1) ? "Tomorrow" : new Date(slot.date + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} ${slot.time}`
    : "Choose time";

  if (booked && booking && plan && slot) {
    return (
      <BookedScreen
        bookingId={booking.id}
        manageToken={draft.manageToken}
        vehicle={booking.vehicle}
        planName={PLANS[plan].name}
        date={slot.date}
        time={slot.time}
        location={
          mobile
            ? `${draft.building}${draft.floor ? ", Floor " + draft.floor : ""} (van comes to you)`
            : "Studio, MG Marg, Gangtok"
        }
        total={total}
        deposit={deposit}
        phone={draft.phone}
        onClose={() => {
          setBooked(false);
          reset();
          previews.clear();
          setActiveStep(1);
        }}
      />
    );
  }

  const revealed = !!slot && !!previewUrl && !revealHold;
  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <ProgressBar
        active={activeStep}
        onOpen={setActiveStep}
        complete={[!!booking, !!plan, !!slot, revealed, booked]}
      />

      <Step
        n={1}
        title="Snap your dirty / boring car"
        done={!!booking}
        active={activeStep === 1}
        onOpen={() => setActiveStep(1)}
        summary={booking ? `${booking.vehicle} uploaded ✓` : "Add one clear car photo"}
      >
        <CaptureStep
          photo={draft.photo}
          vehicle={booking?.vehicle}
          onStart={(url) => {
            previews.clear();
            set({ photo: url, plan: null, booking: null });
          }}
          onUploaded={(b, url) => {
            set({ booking: b, ...(url ? { photo: url } : {}) });
            open(2);
          }}
          onFailed={() => set({ photo: null })}
        />
      </Step>

      <Step
        n={2}
        title="Pick your plan"
        done={!!plan}
        active={activeStep === 2}
        onOpen={() => setActiveStep(2)}
        summary={plan ? `${PLANS[plan].name} ✓` : "Choose your finish"}
      >
        <PlanStep
          plan={plan}
          colour={colour}
          style={style}
          set={set}
          onChoose={(p) => {
            set({ plan: p });
            open(3);
          }}
        />
      </Step>

      <Step
        n={3}
        title="Where & when"
        done={!!slot}
        active={activeStep === 3}
        onOpen={() => setActiveStep(3)}
        summary={
          slot
            ? `${mobile ? "Mobile van" : "MG Marg studio"} · ${slotLabel} ✓`
            : "Choose location and slot"
        }
      >
        <WhereWhenStep
          draft={draft}
          set={set}
          nonce={slotsNonce}
          total={total}
          onChooseSlot={chooseSlot}
        />
      </Step>

      <Step
        n={4}
        title="Your car, after Rai"
        done={revealed}
        active={activeStep === 4}
        onOpen={() => setActiveStep(4)}
        summary={slot && previewUrl ? "Surprise revealed ✓" : "Your surprise is waiting"}
      >
        <PreviewStep
          hasSlot={!!slot}
          photo={draft.photo}
          previewUrl={previewUrl}
          holding={revealHold}
          error={previews.error}
          planName={plan ? PLANS[plan].name : "service"}
          onRetry={() => plan && run(plan, colour, style)}
        />
      </Step>

      <Step
        n={5}
        title="Pay & confirm"
        active={activeStep === 5}
        onOpen={() => setActiveStep(5)}
        summary={canPay ? `${inr(deposit)} deposit ready` : "Add your contact details"}
      >
        <PayStep
          draft={draft}
          set={set}
          missing={missing}
          total={total}
          deposit={deposit}
          onPay={() => setPayOpen(true)}
        />
      </Step>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-15px_var(--foreground)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <p className="min-w-0 truncate text-xs font-medium">
            {plan ? PLANS[plan].name : "Choose plan"}{" "}
            <span className="text-muted-foreground">•</span> {slotLabel}{" "}
            <span className="text-muted-foreground">•</span> {plan ? inr(total) : "—"}
            <span className="block truncate text-[11px] text-muted-foreground">
              {plan ? `Pay ${inr(deposit)} Deposit` : "Complete the steps to book"}
            </span>
          </p>
          <Button size="sm" disabled={!canPay} onClick={() => setPayOpen(true)}>
            Pay{plan ? ` ${inr(deposit)}` : ""}
          </Button>
        </div>
      </div>

      {payOpen && (
        <CheckoutModal
          draft={draft}
          total={total}
          deposit={deposit}
          onClose={() => setPayOpen(false)}
          onToken={(t) => set({ manageToken: t })}
          onPaid={() => {
            setPayOpen(false);
            setBooked(true);
          }}
          onSlotFull={(msg) => {
            // keep photo, preview and plan; drop only the slot and refresh the grid
            setPayOpen(false);
            set({ slot: null });
            setSlotsNonce((n) => n + 1);
            setActiveStep(3);
            toast.message(msg);
          }}
        />
      )}
    </div>
  );
}
