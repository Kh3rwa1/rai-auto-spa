import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Droplets, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetDemo } from "@/lib/owner.functions";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";
import { DemoRibbon } from "@/components/DemoRibbon";

export const Route = createFileRoute("/owner")({
  head: () => ({
    meta: [
      { title: "Owner Dashboard — Rai's Auto Spa" },
      { name: "description", content: "Rai's dashboard: routes, bookings, subscriptions, leads and wrap approvals." },
      { property: "og:title", content: "Owner Dashboard — Rai's Auto Spa" },
      { property: "og:description", content: "Owner tools for Rai's Auto Spa, Gangtok." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerPage,
});

function OwnerPage() {
  const reset = useServerFn(resetDemo);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function doReset() {
    setBusy(true);
    try {
      const r = await reset();
      await qc.invalidateQueries();
      toast.success(`Demo data restored in ${(r.ms / 1000).toFixed(1)}s`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"><Droplets className="h-4 w-4" /></span>
            Rai's Auto Spa · Owner
          </Link>
          <div className="flex items-center gap-2">
            <span
              title="Open guest sandbox — anyone can try it, and the data can be reset any time."
              className="cursor-help rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
            >
              Guest demo
            </span>
            <Button size="sm" variant="outline" onClick={doReset} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reset demo data
            </Button>
          </div>
        </div>
      </header>
      <OwnerDashboard />
      <DemoRibbon />
    </div>
  );
}
