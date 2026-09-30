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
        const { data: b } = await supabaseAdmin
          .from("bookings")
          .select("*, clients(name, phone, building)")
          .eq("id", parsed.data.bookingId)
          .maybeSingle();
        if (!b) return new Response("Not found", { status: 404 });
        const client = b.clients as {
          name: string;
          phone: string | null;
          building: string | null;
        } | null;
        const to = b.customer_phone_e164 ?? client?.phone;
        if (!to || !b.date || !b.time) return new Response("Booking incomplete", { status: 400 });

        const { placeConfirmationCall } = await import("@/lib/sarvam.server");
        const origin = new URL(request.url).origin;
        const call = await placeConfirmationCall(
          {
            bookingId: b.id,
            customerName: client?.name ?? "there",
            customerPhoneE164: to,
            detectedCountry: b.detected_country ?? null,
            plan: b.plan,
            date: b.date,
            time: b.time,
            building:
              b.location_type === "mobile"
                ? (client?.building ?? b.area ?? "your address")
                : "our MG Marg studio",
          },
          origin,
        );
        await supabaseAdmin
          .from("bookings")
          .update({ call_status: call.status, call_from_number: call.from })
          .eq("id", b.id);
        return Response.json(call);
      },
    },
  },
});
