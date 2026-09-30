import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Droplets, Loader2 } from "lucide-react";
import { z } from "zod";
import { BookingFlow } from "@/components/BookingFlow";
import { resumeBooking } from "@/lib/booking.functions";

export const Route = createFileRoute("/pay/$bookingId")({
  validateSearch: (s) => z.object({ t: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Finish your booking — Rai's Auto Spa" },
      { name: "description", content: "Your car photo and plan are saved. Pick a time and pay your deposit to book Rai's Auto Spa." },
      { property: "og:title", content: "Finish your booking — Rai's Auto Spa" },
      { property: "og:description", content: "Your photo and plan are saved — pick a slot and pay the 30% deposit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PayPage,
});

function PayPage() {
  const { bookingId } = Route.useParams();
  const { t } = Route.useSearch();
  const resume = useServerFn(resumeBooking);
  const q = useQuery({
    queryKey: ["resume", bookingId, t],
    queryFn: () => resume({ data: { bookingId, token: t ?? "" } }),
    retry: false,
    enabled: !!t,
  });

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <Link to="/" className="flex items-center gap-2 font-display font-semibold">
          <Droplets className="h-5 w-5 text-teal" /> Rai's Auto Spa
        </Link>
      </header>
      <section className="mx-auto max-w-3xl px-4 py-8">
        {!t || q.isError || q.data?.valid === false ? (
          <div className="rounded-2xl bg-card p-6 text-center">
            <p className="font-semibold">This booking link isn't valid anymore.</p>
            <p className="mt-1 text-sm text-muted-foreground">Ask Rai for a fresh link, or start a new booking.</p>
            <Link to="/" hash="book" className="mt-4 inline-block text-sm font-semibold text-teal underline">Start a new booking</Link>
          </div>
        ) : q.isLoading || !q.data || !q.data.valid ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Opening your booking…
          </div>
        ) : q.data.paid ? (
          <div className="rounded-2xl bg-card p-6 text-center">
            <p className="font-semibold">Your {q.data.vehicle} is already booked 🎉</p>
            <p className="mt-1 text-sm text-muted-foreground">The deposit is paid — see you soon.</p>
          </div>
        ) : (
          <>
            <h1 className="mb-4 font-display text-2xl font-semibold">Welcome back — your {q.data.vehicle} is saved</h1>
            <BookingFlow resume={q.data} />
          </>
        )}
      </section>
    </main>
  );
}
