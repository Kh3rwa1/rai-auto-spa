import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { OPS, areaPin } from "./ops-config";

type Sb = SupabaseClient<Database>;

export const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

/**
 * Materialise subscription visits for one day into bookings (status "subscription").
 * Idempotent: unique (subscription_id, date). Removes visits for paused/skipped subs,
 * and keeps the time in sync with preferred_time.
 */
export async function materialiseDay(sb: Sb, date: string, onlySubId?: string) {
  let q = sb
    .from("subscriptions")
    .select("id, client_id, plan, active, skip_dates, preferred_time, clients(area, name)");
  if (onlySubId) q = q.eq("id", onlySubId);
  const { data: subs, error } = await q;
  if (error) throw new Error("Could not read subscriptions.");
  const due = (subs ?? []).filter((s) => s.active && !(s.skip_dates ?? []).includes(date));
  const notDue = (subs ?? []).filter((s) => !due.includes(s)).map((s) => s.id);

  if (notDue.length) {
    await sb
      .from("bookings")
      .delete()
      .eq("date", date)
      .eq("status", "subscription")
      .in("subscription_id", notDue);
  }
  if (due.length) {
    const rows = due.map((s) => {
      const c = s.clients as unknown as { area: string | null; name: string } | null;
      return {
        subscription_id: s.id,
        client_id: s.client_id,
        plan: s.plan || "Daily Wash",
        vehicle_model: "Daily wash",
        location_type: "mobile",
        area: c?.area ?? "MG Marg",
        map_pin: areaPin(c?.area, s.id),
        date,
        time: s.preferred_time,
        total: OPS.dailyWashPrice,
        deposit_paid: true,
        status: "subscription",
      };
    });
    const { error: upErr } = await sb
      .from("bookings")
      .upsert(rows, { onConflict: "subscription_id,date" });
    if (upErr) throw new Error("Could not create today's visits.");
  }
  return { date, created: due.length, removed: notDue.length };
}
