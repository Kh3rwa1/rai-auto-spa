import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLANS, inr } from "@/lib/plans";
import type { Draft, SetDraft } from "./useBookingDraft";

type Props = { draft: Draft; set: SetDraft; missing: string[]; total: number; deposit: number; onPay: () => void };

export function PayStep({ draft, set, missing, total, deposit, onPay }: Props) {
  const { plan, slot, booking, mobile, building } = draft;
  const rows: [string, string, boolean?][] = [
    ["Plan", plan ? PLANS[plan].name : "—"],
    ["Vehicle", booking?.vehicle ?? "—"],
    ["Location", mobile ? building || "Your place" : "Studio, MG Marg"],
    ["Time", slot ? `${slot.date} · ${slot.time}` : "—"],
    ["Total", plan ? inr(total) : "—"],
    ["Deposit (30%)", plan ? inr(deposit) : "—", true],
  ];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label htmlFor="nm">Your name</Label><Input id="nm" autoComplete="name" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Pema Bhutia" /></div>
        <div><Label htmlFor="ph">WhatsApp number</Label><Input id="ph" type="tel" autoComplete="tel" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+91 98320 12345" /></div>
        <div><Label htmlFor="em">Email (for your reveal video)</Label><Input id="em" type="email" autoComplete="email" value={draft.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@gmail.com" /></div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-border p-4 text-sm sm:grid-cols-3">
        {rows.map(([k, v, hi]) => (
          <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className={hi ? "font-semibold text-primary" : "font-medium"}>{v}</dd></div>
        ))}
      </dl>
      {missing.length > 0 && <p className="mt-3 text-xs text-muted-foreground">To pay: {missing.join(", ")}.</p>}
      <Button size="lg" className="mt-5 w-full text-base" disabled={missing.length > 0} onClick={onPay}>
        Pay {plan ? inr(deposit) : ""} Deposit
      </Button>
    </>
  );
}
