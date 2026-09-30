import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOBILE_FEE, PLANS, WATER_FEE, inr } from "@/lib/plans";
import type { Draft } from "./useBookingDraft";

export type StepAction = {
  label: string;
  hint: string;
  enabled: boolean;
  onClick: () => void;
};

type Props = {
  draft: Draft;
  slotLabel: string;
  total: number;
  deposit: number;
  missing: string[];
  previewUrl: string | undefined;
  action: StepAction;
  onEdit: (n: number) => void;
};

function Row({
  label,
  value,
  step,
  onEdit,
}: {
  label: string;
  value: string;
  step: number;
  onEdit: (n: number) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 shrink-0 gap-1 px-2 text-xs"
        onClick={() => onEdit(step)}
        aria-label={`Edit ${label}`}
      >
        <Pencil className="h-3 w-3" aria-hidden /> Edit
      </Button>
    </div>
  );
}

/**
 * Persistent booking summary shown beside the wizard on desktop.
 * Display-only: every value comes from the single shared draft, and the
 * only control reuses the same contextual step action as the mobile bar.
 * Hidden on mobile via CSS (same tree, so resizing never loses state).
 */
export function SummarySidebar({
  draft,
  slotLabel,
  total,
  deposit,
  missing,
  previewUrl,
  action,
  onEdit,
}: Props) {
  const { plan, slot, booking, mobile } = draft;
  const location = mobile
    ? draft.building
      ? `${draft.building}${draft.floor ? `, Floor ${draft.floor}` : ""} (van)`
      : "Your place (van)"
    : "Studio, MG Marg";
  const contact =
    draft.name || draft.phone ? `${draft.name}${draft.phone ? ` · ${draft.phone}` : ""}` : "—";
  const balance = total - deposit;

  return (
    <aside aria-label="Booking summary" className="hidden min-w-0 lg:block">
      <div className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] lg:sticky lg:top-32">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold tracking-tight">Your booking</h2>
          <span className="rounded-full bg-electric px-2.5 py-1 text-[11px] font-bold text-electric-foreground">
            Demo
          </span>
        </div>

        {previewUrl || draft.photo ? (
          <figure className="overflow-hidden rounded-2xl">
            <img
              src={previewUrl ?? draft.photo!}
              alt={
                previewUrl
                  ? "AI preview of your selected plan on your car"
                  : booking
                    ? `Your ${booking.vehicle}`
                    : "Your car photo"
              }
              className="aspect-[16/9] w-full object-cover"
            />
            {previewUrl && (
              <figcaption className="bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
                AI preview — an artistic impression, not the guaranteed result.
              </figcaption>
            )}
          </figure>
        ) : (
          <div
            aria-hidden
            className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl bg-muted text-xs text-muted-foreground"
          >
            Car photo appears here
          </div>
        )}

        <div className="divide-y divide-border/70">
          <Row
            label="Vehicle"
            value={booking ? booking.vehicle : draft.photo ? "Detecting…" : "—"}
            step={1}
            onEdit={onEdit}
          />
          <Row
            label="Plan"
            value={
              plan
                ? `${PLANS[plan].name}${plan === "signature" ? ` · ${draft.colour} · ${draft.style}` : ""}`
                : "—"
            }
            step={2}
            onEdit={onEdit}
          />
          <Row label="Location" value={location} step={3} onEdit={onEdit} />
          <Row label="Date & time" value={slot ? slotLabel : "—"} step={3} onEdit={onEdit} />
          <Row label="Contact" value={contact} step={5} onEdit={onEdit} />
        </div>

        {plan && (
          <div className="rounded-2xl bg-muted p-3.5 text-sm" aria-live="polite">
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
            {mobile && !draft.water && (
              <div className="flex justify-between">
                <span>Water tank</span>
                <span>{inr(WATER_FEE)}</span>
              </div>
            )}
            <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 font-semibold">
              <span>Total</span>
              <span>{inr(total)}</span>
            </div>
            <div className="flex justify-between text-primary">
              <span>Deposit (30%)</span>
              <span className="font-semibold">{inr(deposit)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Balance after service</span>
              <span>{inr(balance)}</span>
            </div>
          </div>
        )}

        {missing.length > 0 && (
          <p className="text-xs text-muted-foreground" role="status">
            To pay: {missing.join(", ")}.
          </p>
        )}

        <div>
          <Button
            className="min-h-[48px] w-full"
            disabled={!action.enabled}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
          <p className="mt-1.5 text-center text-xs text-muted-foreground">{action.hint}</p>
        </div>
      </div>
    </aside>
  );
}
