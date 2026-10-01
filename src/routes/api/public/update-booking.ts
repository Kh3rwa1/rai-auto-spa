import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PLANS } from "@/lib/plans";
import type { PlanId } from "@/lib/plans";

/** Matches a spoken plan name onto one of our three plans. */
const planName = (v: string) => {
  const hit = Object.values(PLANS).find(
    (p) =>
      p.name.toLowerCase() === v.toLowerCase() || v.toLowerCase().includes(p.name.toLowerCase()),
  );
  return hit?.name ?? null;
};

/**
 * Webhook for the Sarvam agent's `modify_booking` tool and for Sarvam's own
 * instant-outbound call-outcome callback (docs: conversations/api/instant-outbound).
 * Verified with SARVAM_WEBHOOK_SECRET, sent either as the x-webhook-secret
 * header (tool calls) or as the ?k= query token (Sarvam's outcome callback,
 * which sends no custom headers).
 */
const schema = z.object({
  bookingId: z.string().uuid(),
  new_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  new_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  new_plan: z.string().max(60).optional(),
  new_building: z.string().max(120).optional(),
  call_status: z.string().max(40).optional(),
  call_transcript: z.string().max(20000).optional(),
  call_duration_seconds: z.number().int().min(0).max(86400).optional(),
});

/** Sarvam's outcome callback body. */
const outcomeSchema = z.object({
  attempt_id: z.string(),
  status: z.enum(["connected", "no_answer", "busy", "failed"]),
  // Sarvam reports the billable call length; field name varies by payload version.
  duration_seconds: z.number().nullable().optional(),
  duration: z.number().nullable().optional(),
  call_duration_seconds: z.number().nullable().optional(),
  started_at: z.string().nullable().optional(),
  ended_at: z.string().nullable().optional(),
  interaction_transcript: z
    .array(z.object({ role: z.string().optional(), content: z.string().optional() }).passthrough())
    .nullable()
    .optional(),
  final_agent_variables: z.record(z.string(), z.unknown()).nullable().optional(),
  webhook_config: z
    .object({ metadata: z.record(z.string(), z.unknown()).nullable().optional() })
    .nullable()
    .optional(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Maps Sarvam's outcome callback onto our booking-patch shape. */
function fromOutcome(raw: unknown): z.infer<typeof schema> | null {
  const p = outcomeSchema.safeParse(raw);
  if (!p.success) return null;
  const vars = (p.data.final_agent_variables ?? {}) as Record<string, unknown>;
  const meta = (p.data.webhook_config?.metadata ?? {}) as Record<string, unknown>;
  const id = [meta["bookingId"], vars["bookingId"]].find(
    (v): v is string => typeof v === "string" && UUID_RE.test(v),
  );
  if (!id) return null;
  const turns = p.data.interaction_transcript ?? [];
  const transcript = turns
    .map((t) => `${t.role ?? "?"}: ${t.content ?? ""}`)
    .join("\n")
    .slice(0, 20000);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  // Prefer a reported duration; otherwise derive it from the start/end stamps.
  const spanned =
    p.data.started_at && p.data.ended_at
      ? Math.round(
          (new Date(p.data.ended_at).getTime() - new Date(p.data.started_at).getTime()) / 1000,
        )
      : null;
  const secs = [
    p.data.duration_seconds,
    p.data.call_duration_seconds,
    p.data.duration,
    spanned,
  ].find((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0);
  return schema.parse({
    bookingId: id,
    call_status: p.data.status,
    ...(transcript ? { call_transcript: transcript } : {}),
    ...(secs !== undefined ? { call_duration_seconds: Math.round(secs) } : {}),
    ...(str(vars["new_time"]) ? { new_time: str(vars["new_time"]) } : {}),
    ...(str(vars["new_date"]) ? { new_date: str(vars["new_date"]) } : {}),
    ...(str(vars["new_plan"]) ? { new_plan: str(vars["new_plan"]) } : {}),
    ...(str(vars["new_building"]) ? { new_building: str(vars["new_building"]) } : {}),
  });
}

export const Route = createFileRoute("/api/public/update-booking")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SARVAM_WEBHOOK_SECRET"];
        const token =
          request.headers.get("x-webhook-secret") ??
          new URL(request.url).searchParams.get("k") ??
          "";
        if (!secret || token !== secret) return new Response("Unauthorized", { status: 401 });

        const { writesPaused, WRITE_PAUSE_MESSAGE } = await import("@/lib/write-pause.server");
        if (writesPaused())
          return Response.json(
            { ok: false, reason: "paused", message: WRITE_PAUSE_MESSAGE },
            { status: 503 },
          );

        const raw = await request.json().catch(() => null);
        const direct = schema.safeParse(raw);
        const d = direct.success ? direct.data : fromOutcome(raw);
        if (!d) return new Response("Bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { calcTotal } = await import("@/lib/plans");
        const { data: b } = await supabaseAdmin
          .from("bookings")
          .select(
            "id, date, time, end_date, full_day, location_type, plan, total, water_needed, deposit_paid, status, client_id",
          )
          .eq("id", d.bookingId)
          .maybeSingle();
        if (!b) return new Response("Not found", { status: 404 });
        if (b.status === "cancelled")
          return Response.json({ ok: false, reason: "cancelled" }, { status: 409 });

        type Row = typeof b & { [k: string]: unknown };
        const row = b as Row;
        const planIdOf = (name: string): PlanId =>
          (Object.keys(PLANS) as PlanId[]).find((k) => PLANS[k].name === name) ?? "wash";
        const currentPlan = planIdOf(row.plan);
        const newPlanName = d.new_plan ? planName(d.new_plan) : null;
        const targetPlan: PlanId = newPlanName ? planIdOf(newPlanName) : currentPlan;
        const planChanged = targetPlan !== currentPlan;

        // After a deposit is paid the service (and its price) is locked, exactly like the
        // website — the agent may reschedule but not sell a different plan.
        if (planChanged && row.deposit_paid)
          return Response.json({ ok: false, reason: "paid_plan_locked" }, { status: 409 });

        const moving = !!(d.new_time || d.new_date);
        const targetDate = d.new_date ?? (row.date as string | null);
        const targetTime = d.new_time ?? (row.time as string | null);
        if (d.new_time && !targetDate)
          return Response.json({ ok: false, reason: "missing_date" }, { status: 400 });

        // Same 12-hour free-reschedule cutoff as the website, measured on the slot being moved.
        if (moving && row.date && row.time) {
          const start = new Date(`${row.date}T${row.time}:00+05:30`).getTime();
          if (start - Date.now() < 12 * 3600 * 1000)
            return Response.json({ ok: false, reason: "cutoff_12h" }, { status: 409 });
        }

        // Capacity/size/water/duration go through book_slot in ONE locked decision, sized
        // for the effective plan (Signature = 2 full studio days, Full Detail = 2 hours) —
        // never a hardcoded 1-day hold. p_water mirrors the booking: water_needed means Rai
        // brings the tank, so the 11am–4pm dry-window guard must stay active for the van.
        const mobile = row.location_type === "mobile";
        const pWater = mobile ? !(row.water_needed ?? false) : true;
        const days = targetPlan === "signature" ? 2 : 1;
        const slots = targetPlan === "detail" ? 2 : 1;
        let rescheduled: string | null = null;
        if (moving && targetDate && targetTime) {
          const { data: code, error } = await supabaseAdmin.rpc("book_slot", {
            p_booking_id: b.id,
            p_date: targetDate,
            p_time: targetTime,
            p_mobile: mobile,
            p_water: pWater,
            p_days: days,
            p_slots: slots,
          });
          if (error) return Response.json({ ok: false, reason: "error" }, { status: 409 });
          rescheduled = (code as string) ?? "error";
          if (rescheduled !== "ok")
            return Response.json({ ok: false, reason: rescheduled }, { status: 409 });
        } else if (planChanged && row.date && row.time) {
          // Plan change without a time change must still fit the SAME slot at the new size
          // (e.g. upgrading to Signature needs both days free); otherwise refuse entirely.
          const { data: code, error } = await supabaseAdmin.rpc("book_slot", {
            p_booking_id: b.id,
            p_date: row.date as string,
            p_time: row.time as string,
            p_mobile: mobile,
            p_water: pWater,
            p_days: days,
            p_slots: slots,
          });
          if (error) return Response.json({ ok: false, reason: "error" }, { status: 409 });
          if ((code as string) !== "ok")
            return Response.json({ ok: false, reason: code as string }, { status: 409 });
        }

        const patch: {
          call_status?: string;
          call_transcript?: string;
          call_duration_seconds?: number;
          call_updated_at?: string;
          plan?: string;
          total?: number;
          approval_status?: string | null;
          held_at?: string;
        } = {};
        if (d.call_status) patch.call_status = d.call_status;
        if (d.call_transcript) patch.call_transcript = d.call_transcript;
        if (d.call_duration_seconds !== undefined)
          patch.call_duration_seconds = d.call_duration_seconds;
        if (d.call_status || d.call_transcript || d.call_duration_seconds !== undefined)
          patch.call_updated_at = new Date().toISOString();
        if (planChanged) {
          patch.plan = PLANS[targetPlan].name;
          const waterFee = mobile && (row.water_needed ?? false);
          patch.total = calcTotal(targetPlan, mobile, waterFee);
          patch.approval_status = targetPlan === "signature" ? "pending" : null;
        }
        // A moved unpaid hold is a fresh hold — restart its 20-minute expiry window.
        if (rescheduled === "ok" && !row.deposit_paid) patch.held_at = new Date().toISOString();

        if (Object.keys(patch).length)
          await supabaseAdmin.from("bookings").update(patch).eq("id", b.id);
        if (d.new_building && row.client_id)
          await supabaseAdmin
            .from("clients")
            .update({ building: d.new_building })
            .eq("id", row.client_id as string);

        return Response.json({ ok: true, rescheduled });
      },
    },
  },
});
