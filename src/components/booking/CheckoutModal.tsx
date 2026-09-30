import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS, inr } from "@/lib/plans";
import { confirmBooking, simulatePayment } from "@/lib/booking.functions";
import type { Draft } from "./useBookingDraft";

type Stage = "idle" | "processing" | "verifying" | "success" | "failed";
type Method = "upi" | "card" | "netbanking";
const METHODS: [Method, string][] = [
  ["upi", "UPI (GPay / PhonePe / Paytm)"],
  ["card", "Card"],
  ["netbanking", "Netbanking"],
];
const STEPS = ["processing", "verifying", "success"] as const;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Props = {
  draft: Draft;
  total: number;
  deposit: number;
  onClose: () => void;
  onToken: (token: string) => void;
  onPaid: () => void;
  onSlotFull: (msg: string) => void;
};

export function CheckoutModal({
  draft,
  total,
  deposit,
  onClose,
  onToken,
  onPaid,
  onSlotFull,
}: Props) {
  const confirm = useServerFn(confirmBooking);
  const payFn = useServerFn(simulatePayment);
  const [stage, setStage] = useState<Stage>("idle");
  const [method, setMethod] = useState<Method>("upi");
  const [fail, setFail] = useState(false);
  const heldFor = useRef("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const busy = stage === "processing" || stage === "verifying" || stage === "success";
  const { booking, plan, slot } = draft;

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("input,button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function pay() {
    if (!booking || !plan || !slot) return;
    setStage("processing");
    try {
      // Reserve the slot + save details once; retries after a failed payment reuse the hold.
      const holdKey = `${slot.date}|${slot.time}|${draft.mobile}|${plan}`;
      let token = draft.manageToken;
      if (heldFor.current !== holdKey || !token) {
        const sig = plan === "signature";
        const res = await confirm({
          data: {
            bookingId: booking.id,
            plan,
            colour: sig ? draft.colour : undefined,
            style: sig ? draft.style : undefined,
            name: draft.name,
            phone: draft.phone,
            email: draft.email,
            mobile: draft.mobile,
            pin: draft.mobile ? draft.pin : null,
            building: draft.building,
            floor: draft.floor,
            parking: draft.parking,
            guard: draft.guard,
            water: draft.water,
            date: slot.date,
            time: slot.time,
          },
        });
        token = res.manageToken ?? "";
        onToken(token);
        heldFor.current = holdKey;
      }
      await wait(900);
      setStage("verifying");
      await payFn({ data: { bookingId: booking.id, token, method, fail } });
      await wait(700);
      setStage("success");
      await wait(800);
      onPaid();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.startsWith("SLOT_FULL:")) onSlotFull(msg.replace("SLOT_FULL: ", ""));
      else if (msg.startsWith("PAYMENT_FAILED:")) setStage("failed");
      else {
        setStage("idle");
        toast.error(msg);
      }
    }
  }

  const order = STEPS.indexOf(stage as (typeof STEPS)[number]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={() => !busy && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-electric">
          Secure checkout · Demo payment - no real money
        </p>
        <h4 id="checkout-title" className="mt-1 text-2xl font-semibold">
          Pay {inr(deposit)}
        </h4>
        <p className="text-sm text-muted-foreground">
          Deposit for {plan && PLANS[plan].name}. Balance {inr(total - deposit)} after service.
        </p>
        {stage === "idle" || stage === "failed" ? (
          <>
            {stage === "failed" && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
              >
                Payment failed — nothing was charged. Your slot is still held, tap retry.
              </p>
            )}
            <fieldset className="mt-5 space-y-2">
              <legend className="sr-only">Payment method</legend>
              {METHODS.map(([id, label]) => (
                <label
                  key={id}
                  className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"
                >
                  <input
                    type="radio"
                    name="pm"
                    checked={method === id}
                    onChange={() => setMethod(id)}
                  />{" "}
                  {label}
                </label>
              ))}
            </fieldset>
            <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />{" "}
              Simulate failure
            </label>
            <Button size="lg" className="mt-4 w-full" onClick={pay}>
              {stage === "failed" ? `Retry ${inr(deposit)}` : `Pay ${inr(deposit)}`}
            </Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={onClose}>
              Cancel
            </Button>
          </>
        ) : (
          <ol className="mt-6 space-y-3 text-sm" aria-live="polite">
            {STEPS.map((st, i) => {
              const done = i < order || stage === "success";
              return (
                <li
                  key={st}
                  className={
                    i > order
                      ? "flex items-center gap-3 text-muted-foreground"
                      : "flex items-center gap-3"
                  }
                >
                  {done ? (
                    <Check className="h-4 w-4 text-teal" aria-hidden />
                  ) : i === order ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <span className="h-4 w-4 rounded-full border border-border" />
                  )}
                  {st === "processing"
                    ? "Processing"
                    : st === "verifying"
                      ? "Verifying with bank"
                      : "Success"}
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Demo payment - no real money is charged.
        </p>
      </div>
    </div>
  );
}
