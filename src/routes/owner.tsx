import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";
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
import { resetDemo } from "@/lib/owner.functions";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";
import { DemoRibbon } from "@/components/DemoRibbon";

export const Route = createFileRoute("/owner")({
  head: () => ({
    meta: [
      { title: "Owner Dashboard — Rai's Auto Spa" },
      {
        name: "description",
        content: "Rai's dashboard: routes, bookings, subscriptions, leads and wrap approvals.",
      },
      { property: "og:title", content: "Owner Dashboard — Rai's Auto Spa" },
      { property: "og:description", content: "Owner tools for Rai's Auto Spa, Gangtok." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerPage,
});

/*
 * Landing-page theme for the whole dashboard.
 * It re-maps the shadcn design tokens inside .ras-admin, so every existing
 * owner component (cards, tabs, buttons, dialogs) picks up the look
 * without editing those files. The class is also put on <body> while this
 * page is open, so portalled dialogs/tooltips match too.
 */
const CSS = `
.ras-admin{--ink:#111;--cream:#FFF8EC;--pink:#FF5FA2;--yellow:#FFD84D;--lilac:#B9A7FF;--mint:#9EE6C4;
--background:#FFF8EC;--foreground:#111;--card:#fff;--card-foreground:#111;--popover:#fff;--popover-foreground:#111;
--primary:#111;--primary-foreground:#FFD84D;--secondary:#FFD84D;--secondary-foreground:#111;
--muted:#F4EBDC;--muted-foreground:#4B4B4B;--accent:#9EE6C4;--accent-foreground:#111;
--border:#111;--input:#111;--ring:#FF5FA2;--color-border:#111;
--charcoal:#111;--charcoal-foreground:#FFF8EC;--teal:#9EE6C4;--electric:#6D4AFF;--electric-foreground:#fff;
--shadow-soft:4px 4px 0 #111;--shadow-glow:7px 7px 0 #111;--shadow-electric:6px 6px 0 #FF5FA2;
background:var(--cream);color:var(--ink)}
.ras-admin h1,.ras-admin h2{font-weight:800;text-transform:uppercase;letter-spacing:-.02em}
.ras-display{font-family:Outfit,Inter,system-ui,sans-serif;font-weight:800;letter-spacing:-.025em;text-transform:uppercase;line-height:.9}
.ras-box{border:3px solid var(--ink);border-radius:18px;box-shadow:5px 5px 0 var(--ink)}
.ras-yellow{background:var(--yellow)}.ras-mint{background:var(--mint)}.ras-lilac{background:var(--lilac)}.ras-white{background:#fff}
.ras-pill{display:inline-flex;align-items:center;gap:.25rem;border:2px solid var(--ink);border-radius:999px;padding:.15rem .6rem;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.03em}
.ras-btn{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;min-height:44px;padding:0 .9rem;border:3px solid var(--ink);border-radius:12px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:var(--ink);box-shadow:3px 3px 0 var(--ink);transition:transform .16s cubic-bezier(.3,1.6,.5,1),box-shadow .16s}
.ras-btn:hover:not(:disabled){transform:translate(-2px,-2px);box-shadow:5px 5px 0 var(--ink)}
.ras-btn:active:not(:disabled){transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.ras-btn:disabled{opacity:.6}
.ras-admin a:focus-visible,.ras-admin button:focus-visible,.ras-admin select:focus-visible,.ras-admin [tabindex]:focus-visible{outline:3px solid var(--pink);outline-offset:3px}
.ras-twinkle{display:inline-block;animation:ras-twinkle 2.4s ease-in-out infinite}

/* cards: thick borders + hard shadow + lift */
.ras-admin main .bg-card{border:3px solid var(--ink);box-shadow:4px 4px 0 var(--ink);transition:transform .18s cubic-bezier(.3,1.6,.5,1),box-shadow .18s}
.ras-admin main .bg-card.cursor-help:hover,.ras-admin main .bg-card.cursor-help:focus-visible{transform:translate(-3px,-3px) rotate(-.4deg);box-shadow:7px 7px 0 var(--ink)}
.ras-admin main .grid>.bg-card.cursor-help{animation:ras-pop .5s cubic-bezier(.3,1.6,.5,1) both}
.ras-admin main .grid>.bg-card.cursor-help:nth-child(2){animation-delay:.06s}
.ras-admin main .grid>.bg-card.cursor-help:nth-child(3){animation-delay:.12s}
.ras-admin main .grid>.bg-card.cursor-help:nth-child(4){animation-delay:.18s}
.ras-admin main .grid>.bg-card.cursor-help:nth-child(5){animation-delay:.24s}
.ras-admin main .bg-charcoal{border:3px solid var(--ink);box-shadow:6px 6px 0 var(--pink);animation:ras-in .5s cubic-bezier(.2,.9,.3,1.2) both}

/* tabs */
.ras-admin [role=tablist]{background:#fff;border:3px solid var(--ink);box-shadow:4px 4px 0 var(--ink)}
.ras-admin [role=tab]{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.02em;transition:transform .15s cubic-bezier(.3,1.6,.5,1),background .15s}
.ras-admin [role=tab]:hover{transform:translateY(-2px)}
.ras-admin [role=tab][data-state=active]{background:var(--yellow);color:var(--ink);box-shadow:inset 0 0 0 2px var(--ink)}
.ras-admin [role=tabpanel][data-state=active]{animation:ras-in .35s cubic-bezier(.2,.9,.3,1.2) both}
.ras-admin select{border:3px solid var(--ink);background:#fff;font-weight:700}

/* dialogs + tooltips (portalled to body) */
.ras-admin [role=alertdialog]{border:3px solid var(--ink);border-radius:18px;box-shadow:6px 6px 0 var(--ink)}

@keyframes ras-pop{0%{transform:scale(.85) translateY(8px);opacity:0}70%{transform:scale(1.03)}100%{transform:none;opacity:1}}
@keyframes ras-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes ras-twinkle{0%,100%{transform:scale(.7) rotate(0);opacity:.5}50%{transform:scale(1.15) rotate(25deg);opacity:1}}
@media (prefers-reduced-motion:reduce){.ras-admin *,.ras-admin *::before,.ras-admin *::after{animation:none!important;transition:none!important}}
`;

function OwnerPage() {
  const reset = useServerFn(resetDemo);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  // Theme portalled UI (dialogs, tooltips) while the dashboard is open.
  useEffect(() => {
    document.body.classList.add("ras-admin");
    return () => document.body.classList.remove("ras-admin");
  }, []);

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

  const dateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="ras-admin min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-5">
        <div className="ras-box mx-auto flex max-w-7xl items-center justify-between gap-2 bg-[var(--cream)] py-1.5 pl-4 pr-2">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              aria-label="Rai's Auto Spa — back to the site"
              className="flex items-center gap-2"
            >
              <span className="ras-display text-2xl">Rai&rsquo;s</span>
              <span className="ras-twinkle text-lg" aria-hidden>
                ✦
              </span>
              <span className="ras-pill ras-lilac">Owner</span>
            </Link>
            <span className="hidden text-[11px] font-extrabold uppercase tracking-wider lg:inline">
              {dateLabel}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/" className="ras-btn ras-white hidden sm:inline-flex">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Site
            </Link>
            <span
              title="Open guest sandbox — anyone can try it, and the data can be reset any time."
              className="ras-pill ras-mint hidden cursor-help md:inline-flex"
            >
              Guest demo
            </span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button type="button" className="ras-btn ras-yellow" disabled={busy}>
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <RotateCcw className="h-4 w-4" aria-hidden />
                  )}
                  <span className="hidden sm:inline">Reset demo data</span>
                  <span className="sm:hidden">Reset</span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset the demo data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This clears the sample customers, bookings and subscriptions and builds a fresh
                    set dated from today. Bookings made by visitors are left alone. You can reset
                    again after a minute.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={doReset}>Reset demo data</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>
      <OwnerDashboard />
      <DemoRibbon />
    </div>
  );
}
