import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Hourglass, MessageCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { cancelBooking, listOffers } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { OPS } from "@/lib/ops-config";
import { todayIST } from "@/lib/booking-rules";
import { cn } from "@/lib/utils";
import { type Booking, wa, minsLeft } from "./shared";
import { CallBadge } from "./CallBadge";

type Offer = {
  id: string;
  date: string;
  time: string;
  area: string | null;
  status: string;
  expires_at: string;
  cancelled_booking_id: string | null;
  clients: { name: string; phone: string } | null;
};

export function Waitlist({ bookings, onChange }: { bookings: Booking[]; onChange: () => void }) {
  const upcoming = bookings.filter(
    (b) => b.date && b.date >= todayIST() && ["confirmed", "pending_deposit"].includes(b.status),
  );
  const cancelFn = useServerFn(cancelBooking);
  const offersFn = useServerFn(listOffers);
  const offersQ = useQuery({
    queryKey: ["offers"],
    queryFn: () => offersFn() as Promise<Offer[]>,
    refetchInterval: 10000,
  });
  const [busy, setBusy] = useState<string | null>(null);
  async function cancel(b: Booking) {
    setBusy(b.id);
    try {
      const { offered } = await cancelFn({ data: { id: b.id } });
      toast.success(
        offered
          ? `Cancelled — offered to ${offered} waitlisted customer(s)`
          : "Cancelled — nobody waitlisted in that area",
      );
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const offers = offersQ.data ?? [];
  const liveOffers = offers.filter((o) => o.status === "offered").length;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="font-display text-lg font-bold">Upcoming bookings</p>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
            {upcoming.length}
          </span>
        </div>
        <ul className="divide-y divide-border text-sm">
          {upcoming.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 font-medium">
                  <span className="truncate">
                    {b.vehicle_model} · {b.plan}
                  </span>
                  {b.deposit_paid ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                      Deposit paid
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      Deposit pending
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" aria-hidden />
                  {b.date} {b.time} · {b.area} · {b.clients?.name}
                </p>
                {(b.deposit_paid || b.call_status) && <CallBadge booking={b} className="mt-1.5" />}
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={busy === b.id}>
                    {busy === b.id ? "Cancelling…" : "Cancel"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Cancel {b.vehicle_model} · {b.date} {b.time}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {`The slot opens up and up to ${OPS.offerFanout} waitlisted customers in ${b.area} are offered it automatically. This can't be undone.`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="min-h-[44px]">Keep booking</AlertDialogCancel>
                    <AlertDialogAction className="min-h-[44px]" onClick={() => cancel(b)}>
                      Yes, cancel &amp; offer slot
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
          {upcoming.length === 0 && (
            <li className="rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">
              No upcoming bookings — new demo bookings appear here.
            </li>
          )}
        </ul>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-display text-lg font-bold">
            <Hourglass className="h-4 w-4 text-electric" aria-hidden /> Auto-backfill offers
          </p>
          {liveOffers > 0 && (
            <span className="rounded-full bg-electric/15 px-2.5 py-1 text-xs font-bold text-electric">
              {liveOffers} live
            </span>
          )}
        </div>
        {offersQ.isLoading && <p className="text-sm text-muted-foreground">Loading offers…</p>}
        {offersQ.isError && (
          <p className="text-sm text-destructive" role="alert">
            Couldn&apos;t load offers.{" "}
            <button
              className="min-h-[44px] font-semibold underline"
              onClick={() => offersQ.refetch()}
            >
              Try again
            </button>
          </p>
        )}
        {!offersQ.isLoading && offers.length === 0 && (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            Cancel a booking and up to {OPS.offerFanout} waitlisted customers in the same area get a{" "}
            {OPS.offerMinutes}-minute claim link. First to claim wins.
          </p>
        )}
        <ul className="space-y-2">
          {offers.map((o) => {
            const expired = o.status === "offered" && new Date(o.expires_at).getTime() < Date.now();
            const st = expired ? "expired" : o.status;
            const left = o.status === "offered" ? minsLeft(o.expires_at) : null;
            const link = `${origin}/offer/${o.id}`;
            const text = `Hi ${(o.clients?.name ?? "").split(" ")[0]}! A ${o.time} slot on ${o.date} just opened near ${o.area}. First to claim gets it (15 min): ${link} — Rai's Auto Spa`;
            return (
              <li key={o.id} className="rounded-2xl border border-border p-3.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 font-medium">
                    {o.clients?.name} · {o.date} {o.time}
                    {left !== null && left >= 0 && (
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        Expires in ~{left} min
                      </span>
                    )}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                      st === "claimed"
                        ? "bg-primary text-primary-foreground"
                        : st === "offered"
                          ? "bg-electric/15 text-electric"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {st === "taken" ? "slot taken" : st}
                  </span>
                </div>
                {st === "offered" && (
                  <>
                    <p className="mt-1.5 text-muted-foreground">{text}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button asChild size="sm" className="min-h-[44px]">
                        <a href={wa(o.clients?.phone, text)} target="_blank" rel="noreferrer">
                          <MessageCircle /> WhatsApp
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="min-h-[44px]">
                        <a href={link} target="_blank" rel="noreferrer">
                          Open claim link
                        </a>
                      </Button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
