import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MOBILE_FEE, PLANS, WATER_FEE, inr } from "@/lib/plans";
import { DEMO_CONTACT, EMAIL_RE, PHONE_RE, formatSlot } from "@/lib/booking-rules";
import { cn } from "@/lib/utils";
import type { Draft, SetDraft } from "./useBookingDraft";
import { Field } from "./Field";
import { PhoneField } from "./PhoneField";

type Props = {
  draft: Draft;
  set: SetDraft;
  missing: string[];
  total: number;
  deposit: number;
  planName: string;
  onPay: () => void;
  onBack: () => void;
};

export function PayStep({ draft, set, missing, total, deposit, planName, onPay, onBack }: Props) {
  const { plan, slot, booking, mobile } = draft;
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);

  const nameErr = draft.name.trim().length < 2 ? "Enter your name (2+ characters)." : null;
  const phoneErr = !PHONE_RE.test(draft.phone.trim())
    ? "Enter a valid number with country code, e.g. +1 415 555 2671."
    : null;
  const emailErr = !EMAIL_RE.test(draft.email.trim())
    ? "Enter a valid email for your video."
    : null;

  const show = (k: string, err: string | null) => ((touched[k] || attempted) && err ? err : null);

  const balance = total - deposit;
  const locationLabel = mobile
    ? draft.building
      ? `${draft.building}${draft.floor ? `, Floor ${draft.floor}` : ""} (van comes to you)`
      : "Your place (van comes to you)"
    : "Studio, MG Marg, Gangtok";

  const canPay = missing.length === 0;
  void planName;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Your contact details</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-[44px]"
          onClick={() =>
            set({
              name: DEMO_CONTACT.name,
              phone: DEMO_CONTACT.phone,
              email: DEMO_CONTACT.email,
              country: "US",
            })
          }
        >
          Use demo details
        </Button>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Demo details are fictional ({DEMO_CONTACT.email}) — no real messages are sent to them beyond
        this demo booking.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="nm" label="Your name" error={show("name", nameErr)}>
          <Input
            id="nm"
            autoComplete="name"
            className={cn("mt-1 min-h-[44px]", show("name", nameErr) && "border-destructive")}
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            placeholder="Pema Bhutia"
            aria-invalid={!!show("name", nameErr)}
            aria-describedby={show("name", nameErr) ? "nm-error" : undefined}
          />
        </Field>
        <Field id="ph" label="Phone number" error={show("phone", phoneErr)}>
          <PhoneField
            value={draft.phone}
            country={draft.country}
            onChange={(v) => set({ phone: v })}
            onCountry={(cc) => set({ country: cc })}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
            invalid={!!show("phone", phoneErr)}
          />
        </Field>
        <Field id="em" label="Email (for your reveal video)" error={show("email", emailErr)}>
          <Input
            id="em"
            type="email"
            autoComplete="email"
            inputMode="email"
            className={cn("mt-1 min-h-[44px]", show("email", emailErr) && "border-destructive")}
            value={draft.email}
            onChange={(e) => set({ email: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            placeholder="you@gmail.com"
            aria-invalid={!!show("email", emailErr)}
          />
        </Field>
        <Field id="nt" label="Notes for Rai (optional)">
          <Textarea
            id="nt"
            className="mt-1 min-h-[44px]"
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value.slice(0, 300) })}
            placeholder="Gate code, pet in the car, extra dirty boot…"
            rows={2}
          />
        </Field>
      </div>

      <div className="mt-5 rounded-2xl border border-border p-4" aria-live="polite">
        <h4 className="text-sm font-semibold">Booking summary</h4>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Vehicle</dt>
            <dd className="text-right font-medium">{booking?.vehicle ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="text-right font-medium">
              {plan ? PLANS[plan].name : "—"}
              {plan === "signature" && ` · ${draft.colour} · ${draft.style}`}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Location</dt>
            <dd className="text-right font-medium">{locationLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Date & time</dt>
            <dd className="text-right font-medium">
              {slot ? formatSlot(slot.date, slot.time) : "—"}
            </dd>
          </div>
        </dl>
        <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          {plan && (
            <div className="flex justify-between">
              <span>{PLANS[plan].name}</span>
              <span>{inr(PLANS[plan].price)}</span>
            </div>
          )}
          {mobile && (
            <div className="flex justify-between">
              <span>Mobile van</span>
              <span>{inr(MOBILE_FEE)}</span>
            </div>
          )}
          {mobile && !draft.water && (
            <div className="flex justify-between">
              <span>Water tank</span>
              <span>{inr(WATER_FEE)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{plan ? inr(total) : "—"}</span>
          </div>
          <div className="flex justify-between text-primary">
            <span>Demo deposit (30%)</span>
            <span className="font-semibold">{plan ? inr(deposit) : "—"}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Remaining balance (after service)</span>
            <span>{plan ? inr(balance) : "—"}</span>
          </div>
        </div>
      </div>

      {missing.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          To pay: {missing.join(", ")}.{mobile && !draft.pin && " Drop a map pin in Step 3."}
        </p>
      )}
      <div className="mt-5 grid gap-2 sm:grid-cols-[auto_1fr]">
        <Button variant="outline" className="min-h-[44px]" onClick={onBack}>
          ← Back to preview
        </Button>
        <Button
          size="lg"
          className="min-h-[52px] w-full text-base"
          disabled={!plan}
          aria-disabled={!canPay}
          aria-describedby={!canPay ? "pay-why" : undefined}
          onClick={() => {
            setAttempted(true);
            if (!canPay) return;
            onPay();
          }}
        >
          Simulate {plan ? `${inr(deposit)} deposit` : "deposit"} — no real charge
        </Button>
      </div>
      {!canPay && (
        <p id="pay-why" className="mt-2 text-xs text-muted-foreground">
          Complete: {missing.join(", ")}. Your entries above are kept.
        </p>
      )}
    </div>
  );
}
