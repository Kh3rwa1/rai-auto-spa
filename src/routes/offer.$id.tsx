import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { claimOffer, getOffer } from "@/lib/offer.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/offer/$id")({
  head: () => ({
    meta: [
      { title: "A slot opened up — Rai's Auto Spa" },
      { name: "description", content: "Claim a freshly opened car wash slot at Rai's Auto Spa, Gangtok." },
      { property: "og:title", content: "A slot opened up — Rai's Auto Spa" },
      { property: "og:description", content: "First to claim gets it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OfferPage,
});

const MSG: Record<string, string> = {
  ok: "It's yours! Rai will see you then. 🎉",
  claimed: "You've already claimed this slot. See you soon!",
  taken: "Sorry — someone else grabbed this slot first.",
  expired: "This offer has expired.",
  not_found: "This offer link isn't valid.",
  error: "Something went wrong. Please try again.",
};

function OfferPage() {
  const { id } = Route.useParams();
  const get = useServerFn(getOffer);
  const claim = useServerFn(claimOffer);
  const q = useQuery({ queryKey: ["offer", id], queryFn: () => get({ data: { id } }), retry: false });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function onClaim() {
    setBusy(true);
    try {
      setResult((await claim({ data: { id } })).result);
    } catch {
      setResult("error");
    } finally {
      setBusy(false);
    }
  }

  const o = q.data;
  const status = result ?? (o?.found ? (o.status === "offered" ? null : o.status) : q.isSuccess ? "not_found" : null);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">Rai's Auto Spa</p>
      {q.isLoading && <p className="mt-6 text-muted-foreground">Loading your offer…</p>}
      {q.isError && <p className="mt-6">Couldn't load this offer. <button className="underline" onClick={() => q.refetch()}>Try again</button></p>}
      {o?.found && (
        <div className="mt-4 rounded-2xl bg-card p-6 shadow-[var(--shadow-soft)]">
          <h1 className="font-display text-2xl font-bold">Hi {o.firstName}, a slot just opened!</h1>
          <p className="mt-3 text-muted-foreground">
            {new Date(o.date + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} at {o.time}
            {" · "}{o.locationType === "mobile" ? `Rai's van comes to you in ${o.area}` : "MG Marg studio"}
          </p>
          {status ? (
            <p role="status" className="mt-5 rounded-xl bg-accent p-3 font-medium text-accent-foreground">{MSG[status] ?? MSG.error}</p>
          ) : (
            <>
              <Button className="mt-5 w-full" size="lg" disabled={busy} onClick={onClaim}>{busy ? "Claiming…" : "Claim this slot"}</Button>
              <p className="mt-2 text-xs text-muted-foreground">First to claim wins · open until {new Date(o.expiresAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
            </>
          )}
        </div>
      )}
      {status === "not_found" && !o?.found && <p className="mt-6">{MSG.not_found}</p>}
      <Link to="/" className="mt-8 text-sm text-muted-foreground underline">Back to Rai's Auto Spa</Link>
    </main>
  );
}
