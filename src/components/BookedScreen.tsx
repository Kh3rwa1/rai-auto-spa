import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { CalendarPlus, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailPreviewDialog } from "./EmailPreviewDialog";
import { checkVideo, rescheduleBooking } from "@/lib/booking.functions";
import { SLOTS, inr } from "@/lib/plans";
import { addDays, formatSlot, todayIST } from "@/lib/booking-rules";

type Props = {
  bookingId: string;
  manageToken: string;
  vehicle: string;
  planName: string;
  colour?: string | undefined;
  style?: string | undefined;
  date: string;
  time: string;
  location: string;
  total: number;
  deposit: number;
  phone: string;
  onClose: () => void;
};

export function BookedScreen(p: Props) {
  const check = useServerFn(checkVideo);
  const resched = useServerFn(rescheduleBooking);
  const [video, setVideo] = useState<{ status: string; url: string | null; email: string | null }>({
    status: "rendering",
    url: null,
    email: null,
  });
  const [date, setDate] = useState(p.date);
  const [time, setTime] = useState(p.time);
  const [rsOpen, setRsOpen] = useState(false);
  const [rsDate, setRsDate] = useState(addDays(todayIST(), 1));
  const [rsTime, setRsTime] = useState("08:00");
  const [rsBusy, setRsBusy] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const end = Date.now() + 1500;
    const frame = () => {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 70,
        origin: { x: 0 },
        colors: ["#0D9488", "#2563EB", "#111827"],
      });
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 70,
        origin: { x: 1 },
        colors: ["#0D9488", "#2563EB", "#111827"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const r = await check({ data: { bookingId: p.bookingId } });
        if (stop) return;
        setVideo({ status: r.status, url: r.videoUrl ?? null, email: r.emailStatus ?? null });
        if (r.status === "ready" || r.status.startsWith("failed")) return;
      } catch {
        /* keep polling */
      }
      timer = setTimeout(poll, 8000);
    };
    poll();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [p.bookingId, check]);

  const start = `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
  const endH = String(parseInt(time, 10) + 2).padStart(2, "0");
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Rai's Auto Spa — ${p.planName}`)}&dates=${start}/${date.replace(/-/g, "")}T${endH}${time.slice(3)}00&ctz=Asia/Kolkata&details=${encodeURIComponent(`${p.vehicle} · ${p.location} · Total ${inr(p.total)}`)}&location=${encodeURIComponent(p.location)}`;
  const waText = `Hi! You're booked with Rai's Auto Spa (demo, no real charge)\n${p.planName} for your ${p.vehicle}\n${formatSlot(date, time)}\n${p.location}\nDeposit (simulated): ${inr(p.deposit)} · Balance ${inr(p.total - p.deposit)}\nFree reschedule till 12h before. — Rai`;

  async function doResched() {
    setRsBusy(true);
    try {
      await resched({
        data: { bookingId: p.bookingId, token: p.manageToken, date: rsDate, time: rsTime },
      });
      setDate(rsDate);
      setTime(rsTime);
      setRsOpen(false);
      toast.success("Rescheduled!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRsBusy(false);
    }
  }

  const videoState =
    video.status === "ready" && video.url
      ? "ready"
      : video.status.startsWith("failed")
        ? "failed"
        : "rendering";
  const emailState =
    video.email === "sent"
      ? "sent"
      : video.email === "failed"
        ? "failed"
        : video.email === "suppressed" || video.email === "no_email"
          ? "not-sent"
          : "pending";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
        Demo booking confirmed — no real money charged
      </p>
      <h2 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Demo booking confirmed</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Booking reference:{" "}
        <span className="font-mono font-semibold text-foreground">{p.bookingId.slice(0, 8)}</span>
      </p>
      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Service</dt>
            <dd className="font-semibold">
              {p.planName}
              {p.colour && ` · ${p.colour}`}
              {p.style && ` · ${p.style}`}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Vehicle</dt>
            <dd className="font-semibold">{p.vehicle}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">When</dt>
            <dd className="font-semibold">{formatSlot(date, time)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Where</dt>
            <dd className="font-semibold">{p.location}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Simulated deposit paid</dt>
            <dd className="font-semibold text-primary">{inr(p.deposit)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Remaining balance</dt>
            <dd className="font-semibold">{inr(p.total - p.deposit)} (after service)</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">Total {inr(p.total)} · demo only.</p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button asChild size="lg" variant="outline" className="min-h-[48px]">
          <a href={gcal} target="_blank" rel="noreferrer">
            <CalendarPlus /> Add to Google Calendar
          </a>
        </Button>
        <Button asChild size="lg" variant="outline" className="min-h-[48px]">
          <a
            href={`https://wa.me/${p.phone.replace(/\D/g, "")}?text=${encodeURIComponent(waText)}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle /> Open in WhatsApp
          </a>
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="min-h-[48px]"
          onClick={() => setRsOpen((v) => !v)}
        >
          <RefreshCw /> Reschedule
        </Button>
        <EmailPreviewDialog
          bookingId={p.bookingId}
          token={p.manageToken}
          refreshKey={`${video.status}|${video.email}|${date}|${time}`}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Reschedule is free till 12 hours before your slot.
      </p>

      {rsOpen && (
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border p-4">
          <label className="text-sm">
            New date
            <input
              type="date"
              min={addDays(todayIST(), 0)}
              value={rsDate}
              onChange={(e) => setRsDate(e.target.value)}
              className="mt-1 block min-h-[44px] rounded-lg border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Time
            <select
              value={rsTime}
              onChange={(e) => setRsTime(e.target.value)}
              className="mt-1 block min-h-[44px] rounded-lg border border-input bg-background px-3 py-2"
            >
              {SLOTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <Button onClick={doResched} disabled={rsBusy} className="min-h-[44px]">
            {rsBusy ? "Rescheduling…" : "Confirm new slot"}
          </Button>
        </div>
      )}

      <div className="mt-8 rounded-3xl bg-accent/60 p-5">
        <p className="mb-2 text-sm font-semibold">Reveal video (AI visualization)</p>
        <div aria-live="polite" className="space-y-1 text-sm">
          {videoState === "ready" && (
            <p className="font-medium text-primary">Video ready — preview below.</p>
          )}
          {videoState === "rendering" && (
            <p className="text-muted-foreground">
              Video still rendering (estimate varies) — your booking is confirmed meanwhile.
            </p>
          )}
          {videoState === "failed" && (
            <p className="text-destructive">
              Video couldn&apos;t render — Rai will share it on WhatsApp. Your booking is
              unaffected.
            </p>
          )}
          {emailState === "sent" && <p className="text-muted-foreground">Email delivery: sent ✓</p>}
          {emailState === "pending" && (
            <p className="text-muted-foreground">
              Email delivery: pending — sends when video is ready.
            </p>
          )}
          {emailState === "failed" && (
            <p className="text-muted-foreground">
              Email delivery: failed — check the preview or WhatsApp Rai.
            </p>
          )}
          {emailState === "not-sent" && (
            <p className="text-muted-foreground">
              Email delivery: not sent (no deliverable address).
            </p>
          )}
        </div>
        <div className="mt-3 max-w-sm whitespace-pre-line rounded-2xl rounded-tl-sm bg-card p-4 text-sm shadow-sm">
          {waText}
        </div>
      </div>

      {videoState === "ready" && video.url ? (
        <video
          src={video.url}
          controls
          muted
          loop
          playsInline
          preload="metadata"
          className="mt-6 w-full rounded-2xl"
          aria-label="AI reveal video preview"
        />
      ) : null}

      <Button className="mt-8 min-h-[44px]" variant="ghost" onClick={p.onClose}>
        ← Book another car
      </Button>
    </div>
  );
}
