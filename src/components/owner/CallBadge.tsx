import { Phone, PhoneCall, PhoneMissed, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Booking } from "./shared";

/** Human wording for every call state we store, so Rai never sees a raw code. */
export const CALL_LABELS: Record<string, string> = {
  calling: "Ringing",
  connected: "Answered",
  no_answer: "No answer",
  busy: "Line busy",
  failed: "Call failed",
  not_configured: "Calling not set up",
  skipped: "Not called",
};

export const callLabel = (s: string | null | undefined) =>
  s ? (CALL_LABELS[s] ?? s) : "Not called yet";

/** Reads a call length as m:ss, e.g. 95 → "1m 35s". */
export function callDuration(secs: number | null | undefined): string | null {
  if (typeof secs !== "number" || !Number.isFinite(secs) || secs < 0) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

const TONE: Record<string, string> = {
  connected: "bg-primary/15 text-primary",
  calling: "bg-electric/15 text-electric",
  no_answer: "bg-amber-400/20 text-amber-700 dark:text-amber-300",
  busy: "bg-amber-400/20 text-amber-700 dark:text-amber-300",
  failed: "bg-destructive/10 text-destructive",
  not_configured: "bg-muted text-muted-foreground",
  skipped: "bg-muted text-muted-foreground",
};

const ICON: Record<string, typeof Phone> = {
  connected: PhoneCall,
  calling: PhoneCall,
  no_answer: PhoneMissed,
  busy: PhoneMissed,
  failed: PhoneOff,
};

export function CallBadge({ booking, className }: { booking: Booking; className?: string }) {
  const status = booking.call_status ?? "";
  const Icon = ICON[status] ?? Phone;
  const dur = callDuration(booking.call_duration_seconds);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
        TONE[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {callLabel(booking.call_status)}
      {dur && <span className="font-medium opacity-80">· {dur}</span>}
    </span>
  );
}
