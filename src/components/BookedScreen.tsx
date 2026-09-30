import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { CalendarPlus, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkVideo, rescheduleBooking } from "@/lib/booking.functions";
import { SLOTS, inr } from "@/lib/plans";
import { addDays, todayIST } from "./BookingFlow";

type Props = {
  bookingId: string;
  vehicle: string;
  planName: string;
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
  const [video, setVideo] = useState<{ status: string; url: string | null; email: string | null }>({ status: "rendering", url: null, email: null });
  const [date, setDate] = useState(p.date);
  const [time, setTime] = useState(p.time);
  const [rsOpen, setRsOpen] = useState(false);
  const [rsDate, setRsDate] = useState(addDays(todayIST(), 1));
  const [rsTime, setRsTime] = useState("08:00");

  useEffect(() => {
    const end = Date.now() + 1500;
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0 }, colors: ["#0D9488", "#2563EB", "#111827"] });
      confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1 }, colors: ["#0D9488", "#2563EB", "#111827"] });
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
  const waText = `Hi! You're booked with Rai's Auto Spa 🔥\n${p.planName} for your ${p.vehicle}\n📅 ${date} at ${time}\n📍 ${p.location}\nDeposit paid: ${inr(p.deposit)} · Balance ${inr(p.total - p.deposit)}\nFree reschedule till 12h before. — Rai`;

  async function doResched() {
    try {
      await resched({ data: { bookingId: p.bookingId, date: rsDate, time: rsTime } });
      setDate(rsDate);
      setTime(rsTime);
      setRsOpen(false);
      toast.success("Rescheduled!");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Deposit received · {inr(p.deposit)}</p>
        <h2 className="mt-2 font-display text-5xl font-bold sm:text-6xl">You're Booked 🔥</h2>
        <p className="mt-3 text-lg text-muted-foreground">
          {p.planName} for your {p.vehicle} · {date} at {time} · {p.location}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Button asChild size="lg" variant="outline">
            <a href={gcal} target="_blank" rel="noreferrer"><CalendarPlus /> Add to Google Calendar</a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={`https://wa.me/${p.phone.replace(/\D/g, "")}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer"><MessageCircle /> Open in WhatsApp</a>
          </Button>
          <Button size="lg" variant="outline" onClick={() => setRsOpen((v) => !v)}><RefreshCw /> Reschedule</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Reschedule is free till 12 hours before your slot.</p>

        {rsOpen && (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border p-4">
            <label className="text-sm">New date<input type="date" min={addDays(todayIST(), 0)} value={rsDate} onChange={(e) => setRsDate(e.target.value)} className="mt-1 block rounded-lg border border-input bg-background px-3 py-2" /></label>
            <label className="text-sm">Time<select value={rsTime} onChange={(e) => setRsTime(e.target.value)} className="mt-1 block rounded-lg border border-input bg-background px-3 py-2">{SLOTS.map((s) => <option key={s}>{s}</option>)}</select></label>
            <Button onClick={doResched}>Confirm new slot</Button>
          </div>
        )}

        <div className="mt-8 rounded-3xl bg-accent/60 p-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4 text-primary" /> WhatsApp confirmation</p>
          <div className="max-w-sm whitespace-pre-line rounded-2xl rounded-tl-sm bg-card p-4 text-sm shadow-sm">{waText}</div>
        </div>

        {video.status === "ready" && video.url ? (
          <video src={video.url} controls autoPlay muted loop playsInline className="mt-6 w-full rounded-2xl" />
        ) : null}

        <Button className="mt-8" variant="ghost" onClick={p.onClose}>← Book another car</Button>
      </div>
    </div>
  );
}
