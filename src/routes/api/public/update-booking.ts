import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PLANS } from "@/lib/plans";

/**
 * Webhook for the Sarvam agent's `modify_booking` tool and call outcomes.
 * Verified with the shared SARVAM_WEBHOOK_SECRET (x-webhook-secret header).
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

const planName = (v: string) => {
  const hit = Object.values(PLANS).find(
    (p) =>
      p.name.toLowerCase() === v.toLowerCase() || v.toLowerCase().includes(p.name.toLowerCase()),
  );
  return hit?.name ?? null;
};

export const Route = createFileRoute("/api/public/update-booking")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SARVAM_WEBHOOK_SECRET"];
        if (!secret || request.headers.get("x-webhook-secret") !== secret)
          return new Response("Unauthorized", { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const d = parsed.data;

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
