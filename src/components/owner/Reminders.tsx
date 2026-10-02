import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, Check, Copy, MessageCircle, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { todayIST } from "@/lib/booking-rules";
import { cn } from "@/lib/utils";
import type { Booking } from "./shared";
import { dayWords, reminderMessage, reminderRows, spokenTime, waLink } from "./reminders-data";

const STORE = "rai-reminders-sent";

export function Reminders({ bookings }: { bookings: Booking[] }) {
  const today = todayIST();
  const { target, rows } = reminderRows(bookings, today);
  const when = target ? dayWords(target, today) : "";
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) setSent(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* private mode: tracker just resets */
    }
  }, []);

  function update(id: string, on: boolean) {
    setSent((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      try {
        localStorage.setItem(STORE, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Message copied");
    } catch {
      toast.error("Couldn't copy - select the text instead");
    }
  }

  const done = rows.filter((b) => sent.has(b.id)).length;
  const pct = rows.length ? Math.round((done / rows.length) * 100) : 0;
  const unpaid = rows.filter((b) => !b.deposit_paid).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-lg font-bold">
          <BellRing className="h-4 w-4 text-electric" aria-hidden />
          {target ? `Reminders for ${when}` : "Reminders"}
        </p>
        {rows.length > 0 && (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
            {done} of {rows.length} sent
          </span>
        )}
      </div>

      {rows.length > 0 ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            One tap opens WhatsApp with the message ready.
            {unpaid > 0 &&
              ` ${unpaid} ${unpaid === 1 ? "booking has" : "bookings have"} no deposit yet and ${unpaid === 1 ? "is" : "are"} listed first.`}
          </p>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Reminders sent"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      ) : (
        <p className="mt-3 rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">
          No upcoming bookings to remind - new bookings appear here the day before.
        </p>
      )}

      <ul className="mt-4 space-y-2.5">
        {rows.map((b) => {
          const text = reminderMessage(b, when);
          const isSent = sent.has(b.id);
          const phone = b.customer_phone_e164 ?? b.clients?.phone;
          return (
            <li key={b.id} className="rounded-2xl border border-border p-3.5 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {spokenTime(b.time)} · {b.vehicle_model ?? "Car"} · {b.plan}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {b.clients?.name} ·{" "}
                    {b.location_type === "mobile" ? `Van · ${b.area ?? ""}` : "Studio"}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                    b.deposit_paid
                      ? "bg-primary/15 text-primary"
                      : "bg-amber-400/20 text-amber-700 dark:text-amber-300",
                  )}
                >
                  {b.deposit_paid ? "Deposit paid" : "No deposit"}
                </span>
              </div>
              <p className="mt-2 text-muted-foreground">{text}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {isSent ? (
                  <>
                    <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-primary/15 px-3 text-sm font-semibold text-primary">
                      <Check className="h-4 w-4" aria-hidden /> Reminder sent
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[44px]"
                      onClick={() => update(b.id, false)}
                    >
                      <Undo2 /> Undo
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild size="sm" className="min-h-[44px]">
                      <a
                        href={waLink(phone, text)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => update(b.id, true)}
                      >
                        <MessageCircle /> WhatsApp
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[44px]"
                      onClick={() => copy(text)}
                    >
                      <Copy /> Copy
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
