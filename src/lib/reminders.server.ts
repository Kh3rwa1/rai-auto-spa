import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendTemplateEmail } from "./email-templates/send-email";
import { depositOf } from "./plans";
import { buildTemplateData, isDeliverable, tomorrowIst, type ReminderRow } from "./reminders-core";

type Sb = SupabaseClient<Database>;

/** Emails tomorrow's real bookings. One failure never stops the rest. dryRun counts without sending. */
export async function sendDueReminders(sb: Sb, opts: { dryRun?: boolean; now?: number } = {}) {
  const date = tomorrowIst(opts.now);
  const { data, error } = await sb
    .from("bookings")
    .select(
      "id, plan, date, time, location_type, area, total, deposit_paid, status, vehicle_model, clients(name, email, is_seed)",
    )
    .eq("date", date)
    .in("status", ["confirmed", "pending_deposit"]);
  if (error) throw new Error("Could not read tomorrow's bookings.");

  const rows = (data ?? []) as unknown as ReminderRow[];
  const due = rows.filter(isDeliverable);
  const result = {
    date,
    found: rows.length,
    deliverable: due.length,
    sent: 0,
    suppressed: 0,
    failed: 0,
    dryRun: !!opts.dryRun,
  };
  if (opts.dryRun) return result;

  for (const r of due) {
    try {
      const out = await sendTemplateEmail("booking-reminder", r.clients!.email!, {
        templateData: buildTemplateData(r, depositOf),
        idempotencyKey: `reminder:${r.id}:${r.date}`,
      });
      if (out.sent) result.sent++;
      else result.suppressed++;
    } catch (e) {
      console.error("reminder failed", r.id, (e as Error).message);
      result.failed++;
    }
  }
  return result;
}
