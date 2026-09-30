import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PLANS } from "@/lib/plans";

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
});

/** Sarvam's outcome callback body. */
const outcomeSchema = z.object({
  attempt_id: z.string(),
  status: z.enum(["connected", "no_answer", "busy", "failed"]),
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
  return schema.parse({
    bookingId: id,
    call_status: p.data.status,
    ...(transcript ? { call_transcript: transcript } : {}),
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

        const raw = await request.json().catch(() => null);
        const direct = schema.safeParse(raw);
        const d = direct.success ? direct.data : fromOutcome(raw);
        if (!d) return new Response("Bad request", { status: 400 });



        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: b } = await supabaseAdmin
          .from("bookings")
          .select("id, date, time, location_type, plan, client_id")
          .eq("id", d.bookingId)
          .maybeSingle();
        if (!b) return new Response("Not found", { status: 404 });

        const patch: {
          call_status?: string;
          call_transcript?: string;
          plan?: string;
        } = {};
        if (d.call_status) patch.call_status = d.call_status;
        if (d.call_transcript) patch.call_transcript = d.call_transcript;
        if (d.new_plan) {
          const name = planName(d.new_plan);
          if (name) patch.plan = name;
        }

        let rescheduled: string | null = null;
        if (d.new_time || d.new_date) {
          const date = d.new_date ?? b.date;
          const time = d.new_time ?? b.time;
          if (date && time) {
            const { data: code } = await supabaseAdmin.rpc("book_slot", {
              p_booking_id: b.id,
              p_date: date,
              p_time: time,
              p_mobile: b.location_type === "mobile",
              p_water: true,
              p_days: 1,
            });
            rescheduled = (code as string) ?? "error";
            if (rescheduled !== "ok")
              return Response.json({ ok: false, reason: rescheduled }, { status: 409 });
          }
        }

        if (Object.keys(patch).length)
          await supabaseAdmin.from("bookings").update(patch).eq("id", b.id);
        if (d.new_building && b.client_id)
          await supabaseAdmin
            .from("clients")
            .update({ building: d.new_building })
            .eq("id", b.client_id);

        return Response.json({ ok: true, rescheduled });
      },
    },
  },
});
