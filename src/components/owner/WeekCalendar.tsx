import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Droplets } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listBlocked, setBlocked } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { SLOTS } from "@/lib/plans";
import { addDays, todayIST } from "@/lib/booking-rules";
import { cn } from "@/lib/utils";
import { type Booking } from "./shared";

export function WeekCalendar({ bookings }: { bookings: Booking[] }) {
  const qc = useQueryClient();
  const [start, setStart] = useState(todayIST());
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const listB = useServerFn(listBlocked);
  const setB = useServerFn(setBlocked);
  const blockedQ = useQuery({
    queryKey: ["blocked", start],
    queryFn: () => listB({ data: { start } }),
  });
  const blocked = new Set((blockedQ.data ?? []).map((b) => `${b.date} ${b.time}`));
  const [pending, setPending] = useState<Set<string>>(new Set());
  const mode = useRef<"block" | "unblock" | null>(null);

  const effective = (k: string) => (pending.has(k) ? !blocked.has(k) : blocked.has(k));

  async function commit() {
    if (!mode.current || pending.size === 0) {
      mode.current = null;
      return;
    }
    const keys = [...pending];
    const m = mode.current;
    mode.current = null;
    await setB({
      data: { mode: m, keys: keys.map((k) => ({ date: k.slice(0, 10), time: k.slice(11) })) },
    });
    setPending(new Set());
    await qc.invalidateQueries({ queryKey: ["blocked"] });
    toast.success(
      m === "block"
        ? `Blocked ${keys.length} slot(s) for water shortage`
        : `Reopened ${keys.length} slot(s)`,
    );
  }

  useEffect((): (() => void) => {
    const up = () => void commit();
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  });

  const touch = (k: string) => {
    if (!mode.current) return;
    const isBlocked = blocked.has(k);
    if ((mode.current === "block" && !isBlocked) || (mode.current === "unblock" && isBlocked))
      setPending((p) => new Set(p).add(k));
  };

  const today = todayIST();
  const weekLabel = (() => {
    const f = (d: string, o: Intl.DateTimeFormatOptions) =>
      new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { ...o, timeZone: "UTC" });
    return `${f(days[0]!, { day: "numeric", month: "short" })} – ${f(days[6]!, { day: "numeric", month: "short", year: "numeric" })}`;
  })();

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold">{weekLabel}</p>
          <p className="text-xs text-muted-foreground">
            Drag across slots to block for water shortage. Drag blocked slots to reopen.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setStart(addDays(start, -7))}>
            ← Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={start === today}
            onClick={() => setStart(today)}
          >
            Today
          </Button>
          <Button size="sm" variant="outline" onClick={() => setStart(addDays(start, 7))}>
            Next →
          </Button>
        </div>
      </div>
      {blockedQ.isError && (
        <p role="alert" className="mb-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t load blocked slots.{" "}
          <button
            className="min-h-[44px] font-semibold underline"
            onClick={() => blockedQ.refetch()}
          >
            Try again
          </button>
        </p>
      )}
      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] select-none grid-cols-[60px_repeat(7,1fr)] gap-1 text-xs">
          <div />
          {days.map((d) => {
            const isToday = d === today;
            return (
              <div
                key={d}
                className={cn(
                  "rounded-lg py-1 text-center font-semibold",
                  isToday && "bg-primary/10 text-primary",
                )}
              >
                {new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
                {isToday && <span className="block text-[10px] font-bold uppercase">today</span>}
              </div>
            );
          })}
          {SLOTS.map((t) => (
            <div key={t} className="contents">
              <div className="py-2 font-medium text-muted-foreground">{t}</div>
              {days.map((d) => {
                const k = `${d} ${t}`;
                // Mirror book_slot occupancy: a two-hour Full Detail also occupies the
                // next slot; whole-day rows block everything.
                const bs = bookings.filter(
                  (b) =>
                    !!b.date &&
                    d >= b.date &&
                    d <= (b.end_date ?? b.date) &&
                    (!!b.full_day ||
                      b.time === t ||
                      (b.plan === "Full Detail" &&
                        b.time != null &&
                        SLOTS[SLOTS.indexOf(b.time) + 1] === t &&
                        SLOTS.indexOf(b.time) >= 0)) &&
                    ["confirmed", "pending_deposit", "consultation"].includes(b.status),
                );
                const studio = bs.filter((b) => b.location_type === "studio").length;
                const van = bs.filter((b) => b.location_type === "mobile").length;
                const isB = effective(k);
                const summary = isB
                  ? "blocked for water shortage"
                  : studio === 0 && van === 0
                    ? "empty"
                    : `${studio} of 2 studio bays, van ${van} of 1`;
                return (
                  <div
                    key={k}
                    role="img"
                    aria-label={`${d} ${t}: ${summary}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      mode.current = blocked.has(k) ? "unblock" : "block";
                      touch(k);
                    }}
                    onPointerEnter={() => touch(k)}
                    className={cn(
                      "min-h-10 cursor-pointer rounded-md p-1.5 transition",
                      isB
                        ? "bg-destructive/15 text-destructive"
                        : studio >= 2 && van >= 1
                          ? "bg-primary/15"
                          : "bg-muted hover:bg-accent",
                    )}
                  >
                    {isB ? (
                      <span className="flex items-center gap-1 font-semibold">
                        <Droplets className="h-3.5 w-3.5" aria-hidden /> Blocked
                      </span>
                    ) : (
                      <span className="block space-y-1">
                        <span className="flex items-center gap-1" title="Studio bays">
                          <span className="flex gap-0.5" aria-hidden>
                            {[0, 1].map((i) => (
                              <span
                                key={i}
                                className={cn(
                                  "h-2 w-3 rounded-full",
                                  i < studio ? "bg-primary" : "bg-border",
                                )}
                              />
                            ))}
                          </span>
                          <span className="text-muted-foreground">{studio}/2</span>
                        </span>
                        <span className="flex items-center gap-1" title="Mobile van">
                          <span
                            aria-hidden
                            className={cn(
                              "h-2 w-3 rounded-full",
                              van >= 1 ? "bg-electric" : "bg-border",
                            )}
                          />
                          <span className="text-muted-foreground">Van {van}/1</span>
                        </span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="flex gap-0.5">
            <span className="h-2 w-3 rounded-full bg-primary" />
            <span className="h-2 w-3 rounded-full bg-border" />
          </span>{" "}
          Studio bays filled
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-3 rounded-full bg-electric" /> Van booked
        </span>
        <span className="flex items-center gap-1.5">
          <Droplets aria-hidden className="h-3.5 w-3.5 text-destructive" /> Blocked (water shortage)
        </span>
      </div>
    </div>
  );
}
