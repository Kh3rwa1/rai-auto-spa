import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Places the confirmation call for an already-paid booking.
 * Payment normally triggers the call server-side; this endpoint lets the agent
 * platform or an operator retry it. Protected by SARVAM_WEBHOOK_SECRET.
 */
const schema = z.object({ bookingId: z.string().uuid() });

export const Route = createFileRoute("/api/public/initiate-sarvam-call")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SARVAM_WEBHOOK_SECRET"];
        if (!secret || request.headers.get("x-webhook-secret") !== secret)
          return new Response("Unauthorized", { status: 401 });
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { callBookingAndRecord, CALL_SELECT } = await import("@/lib/call-booking.server");
        const { data: b } = await supabaseAdmin
          .from("bookings")
          .select(CALL_SELECT)
          .eq("id", parsed.data.bookingId)
          .maybeSingle();
        if (!b) return new Response("Not found", { status: 404 });

        const call = await callBookingAndRecord(b, new URL(request.url).origin);
        return Response.json(call);
      },
    },
  },
});
