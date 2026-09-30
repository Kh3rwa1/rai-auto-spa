import { toast } from "sonner";
import { CircleCheck, Palette } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { setApproval } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { BeforeAfter } from "@/components/BeforeAfter";
import { cn } from "@/lib/utils";
import { type Booking, wa, timeAgo, useSigned } from "./shared";

export function Wraps({ bookings, onChange }: { bookings: Booking[]; onChange: () => void }) {
  const wraps = bookings.filter((b) => b.plan.startsWith("Signature") && b.approval_status);
  const signed = useSigned(wraps.flatMap((w) => [w.photo_url, w.clean_preview_url]));
  const approve = useServerFn(setApproval);
  async function set(b: Booking, status: "approved" | "changes_requested") {
    await approve({ data: { id: b.id, status } });
    toast.success(status === "approved" ? "Design approved" : "Change requested");
    if (status === "changes_requested" && b.clients?.phone)
      window.open(
        wa(
          b.clients.phone,
          `Hi ${b.clients.name.split(" ")[0]}, Rai here! Loved your ${b.colour} ${b.style} idea for the ${b.vehicle_model}. Can we tweak a few details before I start? 🎨`,
        ),
        "_blank",
      );
    onChange();
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-lg font-bold">
          <Palette className="h-4 w-4 text-electric" aria-hidden /> Signature designs
        </p>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
          {wraps.length} awaiting review
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {wraps.map((w) => {
          const before = w.photo_url ? signed.data?.[w.photo_url] : undefined;
          const after = w.clean_preview_url ? signed.data?.[w.clean_preview_url] : undefined;
          const approval =
            w.approval_status === "approved"
              ? "bg-primary text-primary-foreground"
              : w.approval_status === "changes_requested"
                ? "bg-amber-400/25 text-amber-200"
                : "bg-electric text-electric-foreground";
          return (
            <div
              key={w.id}
              className="overflow-hidden rounded-3xl bg-charcoal text-charcoal-foreground shadow-[var(--shadow-soft)]"
            >
              <div className="p-4 pb-0">
                {before && after ? (
                  <BeforeAfter before={before} after={after} afterLabel="AI design" />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-charcoal-foreground/10 text-sm opacity-70">
                    <Palette className="mr-2 h-4 w-4" aria-hidden /> Consultation booked — design at
                    studio
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {w.clients?.name} · {w.vehicle_model}
                    </p>
                    <p className="mt-0.5 text-xs text-charcoal-foreground/70">
                      {w.date} {w.time} · {timeAgo(w.created_at)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
                      approval,
                    )}
                  >
                    {w.approval_status?.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {[w.colour, w.style].filter(Boolean).map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full bg-charcoal-foreground/10 px-2.5 py-1 font-medium"
                    >
                      {chip}
                    </span>
                  ))}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    className="min-h-[44px] bg-electric text-electric-foreground hover:bg-electric/90"
                    onClick={() => set(w, "approved")}
                  >
                    <CircleCheck /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="min-h-[44px]"
                    onClick={() => set(w, "changes_requested")}
                  >
                    Request change
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {wraps.length === 0 && (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No wrap consultations — Signature bookings awaiting approval appear here.
          </p>
        )}
      </div>
    </div>
  );
}
