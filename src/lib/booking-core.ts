/** Shared server-side helpers for booking server functions (admin client loaded lazily). */
import { z } from "zod";

export const BUCKET = "car-media";
export const planEnum = z.enum(["wash", "detail", "signature"]);

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function signed(path: string | null | undefined) {
  if (!path) return null;
  const sb = await admin();
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 30);
  return data?.signedUrl ?? null;
}

export const SLOT_ERRORS: Record<string, string> = {
  invalid_slot: "That time isn't one of our slots. Please pick another.",
  past_date: "That slot is already in the past. Please pick a later one.",
  dry_window: "Water needed — pick a morning slot or provide water.",
  blocked: "Rai has blocked that slot (water shortage). Please pick another.",
  // Short on purpose: the UI adds "your photo, plan and details are kept" itself.
  full: "SLOT_FULL: That slot just filled up.",
  not_found: "Booking not found.",
};

/** Public origin of the current request — never trust a client-supplied origin for links we hand out. */
export async function requestOrigin() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const req = getRequest();
  const proto = req?.headers.get("x-forwarded-proto") ?? "https";
  const host = req?.headers.get("x-forwarded-host") ?? req?.headers.get("host");
  if (host) return `${proto}://${host}`;
  return new URL(req?.url ?? "http://localhost:8080").origin;
}

export async function bookSlot(
  id: string,
  date: string,
  time: string,
  mobile: boolean,
  water: boolean,
  days: number,
  status?: "confirmed" | "pending_deposit" | "consultation",
) {
  const sb = await admin();
  const { data, error } = await sb.rpc("book_slot", {
    p_booking_id: id,
    p_date: date,
    p_time: time,
    p_mobile: mobile,
    p_water: water,
    p_days: days,
    // Set the status inside the same locked UPDATE, so the slot counts the moment it is reserved.
    ...(status ? { p_status: status } : {}),
  });
  if (error) throw new Error("Could not reserve the slot. Please try again.");
  if (data !== "ok") throw new Error(SLOT_ERRORS[data as string] ?? "That slot isn't available.");
}

/** Like bookSlot, but returns the "slot just filled up" message instead of throwing it. */
export async function tryBookSlot(...args: Parameters<typeof bookSlot>): Promise<string | null> {
  try {
    await bookSlot(...args);
    return null;
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("SLOT_FULL:")) return msg.replace("SLOT_FULL: ", "");
    throw e;
  }
}
