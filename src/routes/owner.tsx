import { createFileRoute, Link } from "@tanstack/react-router";
import { Droplets } from "lucide-react";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";

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
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"><Droplets className="h-4 w-4" /></span>
            Rai's Auto Spa · Owner
          </Link>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">Guest demo</span>
        </div>
      </header>
      <OwnerDashboard />
    </div>
  );
}
