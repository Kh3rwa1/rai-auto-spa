import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PLANS, inr } from "@/lib/plans";
import { confirmBooking, simulatePayment } from "@/lib/booking.functions";
import type { Draft } from "./useBookingDraft";
import { bookingErrorMessage } from "@/lib/write-pause-ui";

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
  const busy = stage === "processing" || stage === "verifying" || stage === "success";
  const { booking, plan, slot } = draft;

  async function pay() {
    if (!booking || !plan || !slot || busy) return;
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
            token: draft.manageToken || undefined,
            plan,
            colour: sig ? draft.colour : undefined,
            style: sig ? draft.style : undefined,
            name: draft.name,
            phone: draft.phone,
            country: draft.country,
            notes: draft.notes,
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
        if (res.slotFull) {
          onSlotFull(res.slotFull);
          return;
        }
        token = res.manageToken ?? "";
        onToken(token);
        heldFor.current = holdKey;
      }
      await wait(900);
      setStage("verifying");
      const pay = await payFn({ data: { bookingId: booking.id, token, method, fail } });
      if (pay.status === "failed") {
        setStage("failed");
        return;
      }
      if (!pay.ok) {
        setStage("idle");
        toast.error(pay.message ?? "Demo payment could not be completed.");
        return;
      }
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
        toast.error(bookingErrorMessage(e, msg));
      }
    }
  }

  const order = STEPS.indexOf(stage as (typeof STEPS)[number]);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-h-[92vh] overflow-y-auto"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader>
          <p className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            Demo payment — no real money charged
          </p>
          <DialogTitle className="mt-2 text-2xl">Pay {inr(deposit)}</DialogTitle>
          <DialogDescription>
            Simulated deposit for {plan && PLANS[plan].name}. Balance {inr(total - deposit)} due
            after service. No card numbers, OTPs, or bank logins are requested.
          </DialogDescription>
        </DialogHeader>

        {stage === "idle" || stage === "failed" ? (
          <div>
            {stage === "failed" && (
              <p
                role="alert"
                className="mt-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
              >
                Simulated payment failed — nothing was charged and your slot is still held. Your
                details are kept. Tap retry.
              </p>
            )}
            <fieldset className="mt-4 space-y-2">
              <legend className="text-sm font-semibold">Simulated payment method</legend>
              {METHODS.map(([id, label]) => (
                <label
                  key={id}
                  className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm"
                >
                  <input
                    type="radio"
                    name="pm"
                    checked={method === id}
                    onChange={() => setMethod(id)}
                    className="h-4 w-4"
                  />{" "}
                  {label}
                </label>
              ))}
            </fieldset>
            <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={fail}
                onChange={(e) => setFail(e.target.checked)}
                className="h-4 w-4"
              />{" "}
              Simulate failure (to test retry)
            </label>
            <Button size="lg" className="mt-4 min-h-[52px] w-full" onClick={pay} disabled={busy}>
              {stage === "failed"
                ? `Retry ${inr(deposit)} (simulated)`
                : `Pay ${inr(deposit)} (simulated)`}
            </Button>
            <Button
              variant="ghost"
              className="mt-2 min-h-[44px] w-full"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Demo checkout — simulated only. Success appears only after the server confirms your
              persisted booking.
            </p>
          </div>
        ) : (
          <ol className="mt-4 space-y-3 text-sm" aria-live="polite">
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
                    <span className="h-4 w-4 rounded-full border border-border" aria-hidden />
                  )}
                  {st === "processing"
                    ? "Reserving your slot (simulated)"
                    : st === "verifying"
                      ? "Simulated verification with bank — no real charge"
                      : "Confirmed by server"}
                </li>
              );
            })}
            <li className="text-xs text-muted-foreground">
              Do not close — finishing the simulated payment.
            </li>
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
