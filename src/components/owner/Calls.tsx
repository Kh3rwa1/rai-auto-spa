import { useState } from "react";
import { toast } from "sonner";
import { FileText, PhoneCall, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { recallBooking } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { timeAgo, type Booking } from "./shared";
import { CallBadge, callDuration, callLabel } from "./CallBadge";

/** Every booking Rai's voice agent has rung (or should have rung), newest first. */
export function Calls({ bookings, onChange }: { bookings: Booking[]; onChange: () => void }) {
  const recall = useServerFn(recallBooking);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = bookings
    .filter((b) => b.deposit_paid || b.call_status)
    .sort((a, b) => (b.call_updated_at ?? b.created_at).localeCompare(a.call_updated_at ?? a.created_at));

  async function callAgain(b: Booking) {
    setBusy(b.id);
    try {
      const r = await recall({ data: { bookingId: b.id } });
      if (r.status === "calling") toast.success(`Ringing ${b.clients?.name ?? "customer"} now`);
      else toast.error(`${callLabel(r.status)} — ${r.detail ?? "no detail"}`);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold">Confirmation calls</p>
          <p className="text-xs text-muted-foreground">
            Rai&apos;s assistant rings every customer after payment. Status updates when the call
            ends.
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
          {rows.length}
        </span>
      </div>

      <ul className="divide-y divide-border text-sm">
        {rows.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 font-medium">
                <span className="truncate">
                  {b.clients?.name ?? "Customer"} · {b.plan}
                </span>
                <CallBadge booking={b} />
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {b.date} {b.time} ·{" "}
                {b.customer_phone_e164 ?? b.clients?.phone ?? "no number"}
                {b.call_from_number && ` · from ${b.call_from_number}`}
                {b.call_updated_at && ` · ${timeAgo(b.call_updated_at)}`}
              </p>
              {b.call_status === "failed" && b.call_detail && (
                <p className="mt-1 line-clamp-2 text-xs text-destructive">{b.call_detail}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={!b.call_transcript}>
                    <FileText /> Transcript
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {b.clients?.name ?? "Customer"} · {b.date} {b.time}
                    </DialogTitle>
                    <DialogDescription>
                      {callLabel(b.call_status)}
                      {callDuration(b.call_duration_seconds)
                        ? ` · ${callDuration(b.call_duration_seconds)}`
                        : ""}
                    </DialogDescription>
                  </DialogHeader>
                  <pre className="whitespace-pre-wrap break-words rounded-xl bg-muted p-3 text-xs leading-relaxed">
                    {b.call_transcript ?? "No transcript for this call yet."}
                  </pre>
                </DialogContent>
              </Dialog>
              <Button
                size="sm"
                disabled={busy === b.id}
                onClick={() => callAgain(b)}
                aria-label={`Call ${b.clients?.name ?? "customer"} again`}
              >
                {busy === b.id ? (
                  <RefreshCw className="animate-spin" />
                ) : (
                  <PhoneCall />
                )}
                Call again
              </Button>
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">
            No calls yet — the assistant rings each customer right after they pay.
          </li>
        )}
      </ul>
    </div>
  );
}
