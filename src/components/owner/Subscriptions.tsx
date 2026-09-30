import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { runSchedule, updateSubscription } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { todayIST } from "@/lib/booking-rules";
import { cn } from "@/lib/utils";
import { type Booking, type Sub } from "./shared";

export function Subscriptions({
  subs,
  bookings,
  onChange,
}: {
  subs: Sub[];
  bookings: Booking[];
  onChange: () => void;
}) {
  const today = todayIST();
  const active = subs.filter((s) => s.active).length;
  const month = today.slice(0, 7);
  const monthly = bookings.filter(
    (b) => b.date?.startsWith(month) && !["lead", "link_sent", "cancelled"].includes(b.status),
  ).length;
  const updSub = useServerFn(updateSubscription);
  const run = useServerFn(runSchedule);
  const [running, setRunning] = useState(false);
  async function runToday() {
    setRunning(true);
    try {
      const r = await run();
      toast.success(`Today's schedule: ${r.created} visits on the route`);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }
  async function upd(
    id: string,
    patch: { preferred_time?: string; active?: boolean; skip_dates?: string[] },
  ) {
    try {
      await updSub({ data: { id, patch } });
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "paused" | "skipped">("all");
  const visible = subs.filter((s) => {
    const skipped = s.skip_dates.includes(today);
    if (filter === "active" && (!s.active || skipped)) return false;
    if (filter === "paused" && s.active) return false;
    if (filter === "skipped" && (!s.active || !skipped)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [s.clients?.name, s.clients?.phone, s.clients?.area, s.clients?.building]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  const statusOf = (s: Sub) =>
    !s.active ? (
      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
        Paused
      </span>
    ) : s.skip_dates.includes(today) ? (
      <span className="rounded-full bg-electric/15 px-2.5 py-1 text-xs font-semibold text-electric">
        Skipped today
      </span>
    ) : (
      <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
        Active
      </span>
    );
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold">Daily wash customers</p>
          <p className="text-xs text-muted-foreground">
            {subs.length} total · {active} active · {monthly.toLocaleString("en-IN")} appointments
            this month
          </p>
        </div>
        <Button size="sm" className="min-h-[44px]" onClick={runToday} disabled={running}>
          {running ? "Running…" : "Run today's schedule"}
        </Button>
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative block sm:max-w-xs sm:flex-1">
          <span className="sr-only">Search subscriptions</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, area…"
            className="block min-h-[44px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {(["all", "active", "paused", "skipped"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "min-h-[44px] rounded-full px-3.5 text-xs font-semibold transition",
                filter === f
                  ? "bg-charcoal text-charcoal-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent",
              )}
            >
              {f === "all"
                ? "All"
                : f === "active"
                  ? "Active"
                  : f === "paused"
                    ? "Paused"
                    : "Skipped"}
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 && (
        <p className="rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">
          No subscriptions match{query.trim() ? ` “${query.trim()}”` : " this filter"}.
        </p>
      )}
      {/* Mobile cards */}
      <ul className="grid gap-2 md:hidden">
        {visible.map((s) => {
          const skipped = s.skip_dates.includes(today);
          return (
            <li key={s.id} className="rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.clients?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.clients?.phone} · {s.clients?.area}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.clients?.building}, F{s.clients?.floor} · {s.preferred_time}
                  </p>
                </div>
                {statusOf(s)}
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-[44px] flex-1"
                  disabled={!s.active}
                  onClick={() =>
                    upd(s.id, {
                      skip_dates: skipped
                        ? s.skip_dates.filter((d) => d !== today)
                        : [...s.skip_dates, today],
                    })
                  }
                >
                  {skipped ? "Unskip" : "Skip today"}
                </Button>
                <Button
                  size="sm"
                  variant={s.active ? "ghost" : "default"}
                  className="min-h-[44px] flex-1"
                  onClick={() => upd(s.id, { active: !s.active })}
                >
                  {s.active ? "Pause" : "Resume"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 pr-2 font-semibold">Customer</th>
              <th className="pr-2 font-semibold">Area</th>
              <th className="pr-2 font-semibold">Building</th>
              <th className="pr-2 font-semibold">Time</th>
              <th className="pr-2 font-semibold">Status</th>
              <th className="text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => {
              const skipped = s.skip_dates.includes(today);
              return (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-2">
                    <p className="font-medium">{s.clients?.name}</p>
                    <p className="text-xs text-muted-foreground">{s.clients?.phone}</p>
                  </td>
                  <td className="pr-2">{s.clients?.area}</td>
                  <td className="pr-2 text-muted-foreground">
                    {s.clients?.building}, F{s.clients?.floor}
                  </td>
                  <td className="pr-2">
                    <select
                      value={s.preferred_time}
                      onChange={(e) => upd(s.id, { preferred_time: e.target.value })}
                      className="min-h-[44px] rounded-lg border border-input bg-background px-2 py-1"
                      aria-label={`Change time for ${s.clients?.name}`}
                    >
                      {["06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "17:00", "18:00"].map(
                        (t) => (
                          <option key={t}>{t}</option>
                        ),
                      )}
                    </select>
                  </td>
                  <td className="pr-2">{statusOf(s)}</td>
                  <td className="space-x-1 whitespace-nowrap text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!s.active}
                      onClick={() =>
                        upd(s.id, {
                          skip_dates: skipped
                            ? s.skip_dates.filter((d) => d !== today)
                            : [...s.skip_dates, today],
                        })
                      }
                    >
                      {skipped ? "Unskip" : "Skip Today"}
                    </Button>
                    <Button
                      size="sm"
                      variant={s.active ? "ghost" : "default"}
                      onClick={() => upd(s.id, { active: !s.active })}
                    >
                      {s.active ? "Pause" : "Resume"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
