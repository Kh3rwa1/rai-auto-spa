import { useEffect, useRef } from "react";
import { useState } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PLANS, calcTotal, depositOf, inr, isDryWindow, type PlanId } from "@/lib/plans";
import { addDays, formatSlot, missingForPay, previewKey, todayIST } from "@/lib/booking-rules";
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
  date?: string | null;
  time?: string | null;
  name?: string;
  phone?: string;
  email?: string;
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
  const [slotsNonce, setSlotsNonce] = useState(0);
  const confettiKey = useRef("");
  const prevPlan = useRef<PlanId | null>(null);

  const { plan, slot, mobile, water, colour, style, booking } = draft;
  const key = plan ? previewKey(plan, colour, style) : "";
  const previewUrl = key ? previews.cache[key] : undefined;
  const isPending = key ? previews.pending === key : false;
  const previewError = key && previews.errorKey === key ? previews.error : null;
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

  // A selected slot that became invalid (water unticked → dry window) is dropped with an explanation.
  // Only the slot is cleared — photo, plan, preview and contact details are kept.
  useEffect(() => {
    if (slot && mobile && !water && isDryWindow(slot.time)) {
      set({ slot: null });
      setSlotsNonce((n) => n + 1);
      toast.message(
        "That time needs water on site (11am–4pm blocked without water). Your photo and plan are kept — pick a morning or evening slot.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile, water, slot?.date, slot?.time]);

  // /pay deep link (incl. waitlist claims): keep photo, plan, preview, claimed slot + contact.
  useEffect(() => {
    if (!resume) return;
    set({
      booking: { id: resume.id, vehicle: resume.vehicle },
      photo: resume.photoUrl,
      plan: resume.plan,
      colour: resume.colour ?? draft.colour,
      style: resume.style ?? draft.style,
      manageToken: resume.token,
      ...(resume.date && resume.time ? { slot: { date: resume.date, time: resume.time } } : {}),
      ...(resume.name ? { name: resume.name } : {}),
      ...(resume.phone ? { phone: resume.phone } : {}),
      ...(resume.email ? { email: resume.email } : {}),
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
    if (!slot || !previewUrl) return;
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
  }, [key, previewUrl, slot]);

  function chooseSlot(date: string, time: string) {
    set({ slot: { date, time } });
    open(4);
  }

  function selectPlan(p: PlanId) {
    // Changing plan after a slot was picked clears only the slot (durations differ).
    // Photo, preview cache, location and contact details are kept.
    if (slot && prevPlan.current && prevPlan.current !== p) {
      set({ plan: p, slot: null });
      setSlotsNonce((n) => n + 1);
      toast.message(
        "Plan changed — durations differ, so pick a time again. Your photo and details are kept.",
      );
      return;
    }
    set({ plan: p });
  }
  useEffect(() => {
    prevPlan.current = plan;
  }, [plan]);

  const today = todayIST();
  const slotLabel = slot
    ? slot.date === addDays(today, 1)
      ? `Tomorrow ${slot.time}`
      : formatSlot(slot.date, slot.time)
    : "Choose time";

  if (booked && booking && plan && slot) {
    return (
      <BookedScreen
        bookingId={booking.id}
        manageToken={draft.manageToken}
        vehicle={booking.vehicle}
        planName={PLANS[plan].name}
        colour={plan === "signature" ? draft.colour : undefined}
        style={plan === "signature" ? draft.style : undefined}
        date={slot.date}
        time={slot.time}
        location={
          mobile
            ? `${draft.building}${draft.floor ? `, Floor ${draft.floor}` : ""} (van comes to you)`
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

  const revealed = !!slot && !!previewUrl;

  // Contextual mobile bottom action — never a lone disabled Pay before Details.
  const bottomAction = (() => {
    switch (activeStep) {
      case 1:
        return {
          label: booking ? "Continue to plan" : "Choose a photo",
          hint: booking ? `${booking.vehicle} ready` : "Or use a sample car above",
          enabled: !!booking,
          onClick: () => (booking ? open(2) : open(1)),
        };
      case 2:
        return {
          label: plan ? "Continue to location" : "Pick a plan above",
          hint: plan ? `${PLANS[plan].name} · ${inr(PLANS[plan].price)}+` : "Choose Essential, Detail or Signature",
          enabled: !!plan,
          onClick: () => plan && open(3),
        };
      case 3:
        return {
          label: slot ? "Confirm selected slot" : "Pick a time above",
          hint: slot ? formatSlot(slot.date, slot.time) : "Studio or van, then a slot",
          enabled: !!slot,
          onClick: () => slot && open(4),
        };
      case 4:
        return {
          label: "Continue to details",
          hint: previewUrl ? "Preview ready" : isPending ? "Preview still creating — no need to wait" : "Preview optional",
          enabled: !!slot,
          onClick: () => open(5),
        };
      default:
        return {
          label: plan ? `Simulate ${inr(deposit)} deposit` : "Add details above",
          hint: plan ? `Total ${inr(total)} · demo only` : "Fill contact details",
          enabled: canPay,
          onClick: () => canPay && setPayOpen(true),
        };
    }
  })();

  return (
    <div className="space-y-4 pb-24 md:pb-0">
      <ProgressBar
        active={activeStep}
        onOpen={setActiveStep}
        complete={[!!booking, !!plan, !!slot, revealed, booked]}
      />

      <Step
        n={1}
        title="Snap your car"
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
            set({ photo: url, plan: null, booking: null, slot: null });
          }}
          onUploaded={(b, url) => {
            set({ booking: b, ...(url ? { photo: url } : {}) });
            open(2);
          }}
          onFailed={() => set({ photo: null })}
        />
        {booking && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button className="min-h-[44px]" onClick={() => open(2)}>
              Continue to plan →
            </Button>
          </div>
        )}
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
          onSelect={selectPlan}
          onContinue={() => open(3)}
        />
        <div className="mt-4">
          <Button variant="ghost" className="min-h-[44px]" onClick={() => open(1)}>
            ← Back to photo
          </Button>
        </div>
      </Step>

      <Step
        n={3}
        title="Location & time"
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
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" className="min-h-[44px]" onClick={() => open(2)}>
            ← Back to plan
          </Button>
          <Button className="min-h-[44px]" disabled={!slot} onClick={() => slot && open(4)}>
            {slot ? `Confirm ${formatSlot(slot.date, slot.time)} →` : "Pick a time above"}
          </Button>
        </div>
      </Step>

      <Step
        n={4}
        title="AI reveal"
        done={revealed}
        active={activeStep === 4}
        onOpen={() => setActiveStep(4)}
        summary={slot && previewUrl ? "Preview ready ✓" : "AI preview (optional)"}
      >
        <PreviewStep
          hasSlot={!!slot}
          photo={draft.photo}
          previewUrl={previewUrl}
          isPending={isPending}
          error={previewError}
          planName={plan ? PLANS[plan].name : "service"}
          colour={plan === "signature" ? colour : undefined}
          style={plan === "signature" ? style : undefined}
          onRetry={() => plan && run(plan, colour, style)}
          onContinue={() => open(5)}
        />
        <div className="mt-4">
          <Button variant="ghost" className="min-h-[44px]" onClick={() => open(3)}>
            ← Back to time
          </Button>
        </div>
      </Step>

      <Step
        n={5}
        title="Details & demo payment"
        active={activeStep === 5}
        onOpen={() => setActiveStep(5)}
        summary={canPay ? `${inr(deposit)} demo deposit ready` : "Add contact details"}
      >
        <PayStep
          draft={draft}
          set={set}
          missing={missing}
          total={total}
          deposit={deposit}
          onPay={() => setPayOpen(true)}
          onBack={() => open(4)}
        />
      </Step>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-15px_var(--foreground)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <p className="min-w-0 truncate text-xs font-medium">
            <span className="mr-1 rounded bg-electric px-1.5 py-0.5 text-[10px] font-bold text-electric-foreground">
              Demo
            </span>
            {plan ? PLANS[plan].name : "Choose plan"}{" "}
            <span className="text-muted-foreground">•</span> {slotLabel}{" "}
            <span className="text-muted-foreground">•</span> {plan ? inr(total) : "—"}
            <span className="block truncate text-[11px] text-muted-foreground">
              {bottomAction.hint}
            </span>
          </p>
          <Button
            size="sm"
            className="min-h-[44px]"
            disabled={!bottomAction.enabled}
            onClick={bottomAction.onClick}
          >
            {bottomAction.label}
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
            toast.message(`${msg} Your photo, plan and details are kept — pick another time.`);
          }}
        />
      )}
    </div>
  );
}
