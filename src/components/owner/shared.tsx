import { lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { ownerSignedUrls } from "@/lib/owner.functions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const RouteMap = lazy(() => import("./RouteMap"));

export type Client = {
  id: string;
  name: string;
  phone: string;
  area: string | null;
  building: string | null;
  floor: string | null;
  water_access: boolean;
};
export type Booking = {
  id: string;
  client_id: string | null;
  vehicle_model: string | null;
  photo_url: string | null;
  clean_preview_url: string | null;
  video_url: string | null;
  plan: string;
  colour: string | null;
  style: string | null;
  location_type: string;
  map_pin: { lat: number; lng: number } | null;
  area: string | null;
  date: string | null;
  end_date?: string | null;
  full_day?: boolean;
  subscription_id?: string | null;
  time: string | null;
  total: number;
  deposit_paid: boolean;
  status: string;
  approval_status: string | null;
  water_needed: boolean | null;
  created_at: string;
  clients: Client | null;
};
export type Sub = {
  id: string;
  client_id: string;
  plan: string;
  active: boolean;
  skip_dates: string[];
  preferred_time: string;
  clients: Client | null;
};

export const wa = (phone: string | null | undefined, text: string) =>
  `https://wa.me/${(phone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

/** Relative time for lead/gallery captions, e.g. "3h ago" — falls back to a date. */
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return iso.slice(0, 10);
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Minutes until an offer expires (negative = expired). */
export function minsLeft(expiresAt: string): number {
  return Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000);
}

export function useSigned(paths: (string | null | undefined)[]) {
  const list = paths.filter(Boolean) as string[];
  const sign = useServerFn(ownerSignedUrls);
  return useQuery({
    queryKey: ["signed", list],
    enabled: list.length > 0,
    queryFn: () => sign({ data: { paths: list } }),
  });
}

export function Stat({
  icon: I,
  label,
  value,
  sub,
  tone,
  tile,
  formula,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub: string;
  tone?: string;
  tile?: string;
  formula: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          aria-label={`${label}: ${value}. ${sub} ${formula}`}
          className="cursor-help rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-glow)]"
        >
          <span
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              tile ?? "bg-primary/10",
            )}
          >
            <I className={cn("h-5 w-5", tone ?? "text-primary")} aria-hidden />
          </span>
          <p className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
          <p className="mt-0.5 text-xs font-semibold">{label}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{formula}</TooltipContent>
    </Tooltip>
  );
}
