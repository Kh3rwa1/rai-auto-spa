import { MOBILE_FEE, PLANS, WATER_FEE, inr } from "@/lib/plans";
import type { Draft } from "./useBookingDraft";

export function PriceSummary({
  plan,
  mobile,
  water,
  total,
}: {
  plan: NonNullable<Draft["plan"]>;
  mobile: boolean;
  water: boolean;
  total: number;
}) {
  return (
    <div className="mt-6 rounded-2xl bg-muted p-4 text-sm" aria-live="polite">
      <div className="flex justify-between">
        <span>{PLANS[plan].name}</span>
        <span>{inr(PLANS[plan].price)}</span>
      </div>
      {mobile && (
        <div className="flex justify-between">
          <span>Mobile van</span>
          <span>{inr(MOBILE_FEE)}</span>
        </div>
      )}
      {mobile && !water && (
        <div className="flex justify-between">
          <span>Water tank (no water on site)</span>
          <span>{inr(WATER_FEE)}</span>
        </div>
      )}
      <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
        <span>Total</span>
        <span>{inr(total)}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        30% demo deposit due at confirmation — no real charge.
      </p>
    </div>
  );
}
