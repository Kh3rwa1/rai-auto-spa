import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PLANS } from "./plans";
import { admin, planEnum, tryBookSlot, expireStaleHolds, assertManageToken } from "./booking-core";

const vehicleSchema = z.string().trim().max(60).optional();
/** Creates a photo-less booking row so a slot can be held on the very first tap. */
export const startQuickBooking = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ plan: planEnum, vehicle: vehicleSchema }).parse(d))
  .handler(async ({ data }) => {
    const { assertWritesOpen } = await import("./write-pause.server");
    assertWritesOpen();
    const sb = await admin();
    const id = crypto.randomUUID();
    const row = {
      id,
      vehicle_model: data.vehicle || "Car",
      plan: PLANS[data.plan].name,
      status: "lead",
    };
    // photo_url is nullable in the DB now; cast so older generated types don't block the build.
    const { data: created, error } = await sb
      .from("bookings")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(row as any)
      .select("id, manage_token")
      .single();
    if (error || !created)
      return { ok: false as const, error: "Could not start your booking. Please try again." };
    // Hand the creator the manage token: this response establishes ownership.
    return {
      ok: true as const,
      bookingId: created.id,
      manageToken: created.manage_token as string,
    };
  });

/** Holds the slot the moment it's tapped. Same atomic book_slot() that checkout uses. */
export const holdQuickSlot = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        bookingId: z.string().uuid(),
        plan: planEnum,
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/),
        mobile: z.boolean(),
        water: z.boolean(),
        vehicle: vehicleSchema,
        token: z.string().min(16).max(64),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { assertWritesOpen } = await import("./write-pause.server");
    assertWritesOpen();
    const sb = await admin();
    const { data: b } = await sb
      .from("bookings")
      .select("deposit_paid, status, manage_token")
      .eq("id", data.bookingId)
      .maybeSingle();
    try {
      assertManageToken(b?.manage_token, data.token);
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
    if (!b || b.deposit_paid || !["lead", "pending_deposit"].includes(String(b.status)))
      return { ok: false as const, error: "This booking can't be changed here." };
    // Free expired unpaid holds so the capacity check sees the truth.
    try {
      await expireStaleHolds(sb);
    } catch (e) {
      console.error("hold cleanup failed", e);
    }
    if (data.vehicle)
      await sb.from("bookings").update({ vehicle_model: data.vehicle }).eq("id", data.bookingId);
    try {
      const full = await tryBookSlot(
        data.bookingId,
        data.date,
        data.time,
        data.mobile,
        data.water,
        data.plan === "signature" ? 2 : 1,
        "pending_deposit",
        data.plan === "detail" ? 2 : 1,
      );
      if (full)
        return { ok: false as const, error: "Someone just grabbed that one — pick another time." };
      // Stamp when this hold started so the 20-minute expiry rule can actually run.
      await sb
        .from("bookings")
        .update({ held_at: new Date().toISOString() })
        .eq("id", data.bookingId)
        .eq("status", "pending_deposit");
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });

/** Frees a hold when the customer switches location, plan or car photo. */
export const releaseQuickSlot = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ bookingId: z.string().uuid(), token: z.string().min(16).max(64) }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: held } = await sb
      .from("bookings")
      .select("manage_token")
      .eq("id", data.bookingId)
      .maybeSingle();
    try {
      assertManageToken(held?.manage_token, data.token);
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
    // Unpaid holds only: also wipe the reservation itself, so a released row keeps no
    // date/time/end_date/full_day of the wrong size behind it.
    await sb
      .from("bookings")
      .update({
        status: "lead",
        date: null,
        time: null,
        end_date: null,
        full_day: false,
        held_at: null,
      })
      .eq("id", data.bookingId)
      .eq("status", "pending_deposit")
      .eq("deposit_paid", false);
    return { ok: true as const };
  });
