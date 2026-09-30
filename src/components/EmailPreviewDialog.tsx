import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { previewEmails } from "@/lib/email-preview.functions";
import { cn } from "@/lib/utils";

type Data = Awaited<ReturnType<typeof previewEmails>>;

export function EmailPreviewDialog({ bookingId, token, refreshKey }: { bookingId: string; token: string; refreshKey: string }) {
  const load = useServerFn(previewEmails);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"confirmation" | "reveal">("confirmation");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    load({ data: { bookingId, token } }).then(setData, (e: Error) => setError(e.message));
  }, [open, bookingId, token, refreshKey, load]);

  const mail = data?.[tab];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline"><Mail /> Preview your emails</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Your emails from Rai</DialogTitle>
          <DialogDescription>Exactly what lands in your inbox.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 px-5" role="tablist">
          {(["confirmation", "reveal"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("rounded-full px-3 py-1.5 text-sm font-medium", tab === t ? "bg-charcoal text-charcoal-foreground" : "bg-muted")}>
              {t === "confirmation" ? "Booking confirmation" : "Transformation video"}
            </button>
          ))}
        </div>
        {error ? (
          <p role="alert" className="px-5 pb-5 text-sm text-destructive">{error}</p>
        ) : !mail || !data ? (
          <div className="flex h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" /></div>
        ) : (
          <div className="px-5 pb-5">
            <dl className="mb-3 space-y-0.5 text-xs text-muted-foreground">
              <div><dt className="inline font-semibold">From: </dt><dd className="inline">{data.from}</dd></div>
              <div><dt className="inline font-semibold">To: </dt><dd className="inline">{data.to ?? "—"}</dd></div>
              <div><dt className="inline font-semibold">Subject: </dt><dd className="inline text-foreground">{mail.subject}</dd></div>
              {tab === "reveal" && <div><dt className="inline font-semibold">Status: </dt><dd className="inline">{data.emailStatus === "sent" ? "Sent ✓" : data.videoReady ? "Sending…" : "Sends automatically when your video is ready"}</dd></div>}
            </dl>
            <iframe title={mail.subject} srcDoc={mail.html} sandbox="allow-popups" className="h-[60vh] w-full rounded-xl border border-border bg-card" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
