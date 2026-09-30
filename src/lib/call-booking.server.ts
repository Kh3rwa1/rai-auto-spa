/**
 * Places the Sarvam confirmation call for one booking and records the outcome.
 * Shared by checkout, the retry endpoint and the owner dashboard so every
 * booking — not just the first — ends up with the same call record.
 */
import { placeConfirmationCall, type CallResult } from "./sarvam.server";

type BookingRow = {
  id: string;
  plan: string;
  date: string | null;
  time: string | null;
  area: string | null;
  location_type: string;
  detected_country: string | null;
  customer_phone_e164: string | null;
  clients: { name: string; phone: string | null; building: string | null } | null;
};

export type CallOutcome = CallResult & { skipped?: string };

export async function callBookingAndRecord(
  b: BookingRow,
  origin: string | null,
): Promise<CallOutcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const to = b.customer_phone_e164 ?? b.clients?.phone ?? null;
  if (!to || !b.date || !b.time)
    return {
      status: "skipped",
      from: null,
      detail: "No phone number or slot on this booking",
      attemptId: null,
      skipped: "incomplete",
    };

  const call = await placeConfirmationCall(
    {
      bookingId: b.id,
      customerName: b.clients?.name ?? "there",
      customerPhoneE164: to,
      detectedCountry: b.detected_country,
      plan: b.plan,
      date: b.date,
      time: b.time,
      building:
        b.location_type === "mobile"
          ? (b.clients?.building || b.area || "your address")
          : "our MG Marg studio",
    },
    origin,
  );

  await supabaseAdmin
    .from("bookings")
    .update({
      call_status: call.status,
      call_from_number: call.from,
      call_attempt_id: call.attemptId,
      call_detail: call.detail,
      call_updated_at: new Date().toISOString(),
    })
    .eq("id", b.id);

  return call;
}

export const CALL_SELECT =
  "id, plan, date, time, area, location_type, detected_country, customer_phone_e164, clients(name, phone, building)";
