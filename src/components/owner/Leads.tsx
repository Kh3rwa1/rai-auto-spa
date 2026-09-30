import { lazy } from "react";
import { toast } from "sonner";
import { Inbox, MessageCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createPaymentLink } from "@/lib/booking.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Booking, wa, timeAgo, useSigned } from "./shared";

export function Leads({ bookings, onChange }: { bookings: Booking[]; onChange: () => void }) {
  const leads = bookings
    .filter((b) => b.status === "lead" || b.status === "link_sent")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const signed = useSigned(leads.map((l) => l.photo_url));
  const makeLink = useServerFn(createPaymentLink);
  async function send(b: Booking) {
    try {
      const { text } = await makeLink({
        data: { bookingId: b.id },
      });
      await navigator.clipboard?.writeText(text).catch(() => {});
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
      toast.success("Payment link copied & opened in WhatsApp");
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-lg font-bold">
          <Inbox className="h-4 w-4 text-primary" aria-hidden /> Abandoned photo uploads
        </p>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
          {leads.length}
        </span>
      </div>
      {leads.length === 0 && (
        <p className="rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">
          No abandoned uploads yet — they appear here when someone snaps a car but doesn&apos;t pay.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {leads.map((l) => (
          <div
            key={l.id}
            className="overflow-hidden rounded-2xl border border-border transition-shadow hover:shadow-[var(--shadow-soft)]"
          >
            <div className="relative">
              {l.photo_url && signed.data?.[l.photo_url] ? (
                <img
                  loading="lazy"
                  decoding="async"
                  src={signed.data[l.photo_url]}
                  alt={l.vehicle_model ?? ""}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="aspect-[4/3] bg-muted" />
              )}
              <span
                className={cn(
                  "absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-bold",
                  l.status === "link_sent"
                    ? "bg-primary text-primary-foreground"
                    : "bg-charcoal/85 text-charcoal-foreground backdrop-blur",
                )}
              >
                {l.status === "link_sent" ? "Link sent" : "New lead"}
              </span>
            </div>
            <div className="p-3.5">
              <p className="font-semibold">
                {l.vehicle_model} · viewed {l.plan}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Snapped {timeAgo(l.created_at)}
              </p>
              <Button size="sm" className="mt-2.5 min-h-[44px] w-full" onClick={() => send(l)}>
                <MessageCircle /> Send payment link
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
