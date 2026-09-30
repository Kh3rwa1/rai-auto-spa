import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PLANS } from "./plans";
import { admin, planEnum, tryBookSlot } from "./booking-core";

/** Creates a photo-less booking row so a slot can be held on the very first tap. */
export const startQuickBooking = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ plan: planEnum }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const id = crypto.randomUUID();
    const row = { id, vehicle_model: "Car", plan: PLANS[data.plan].name, status: "lead" };
    // photo_url is nullable in the DB now; cast so older generated types don't block the build.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await sb.from("bookings").insert(row as any);
    if (error)
      return { ok: false as const, error: "Could not start your booking. Please try again." };
    return { ok: true as const, bookingId: id };
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
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: b } = await sb
      .from("bookings")
      .select("deposit_paid, status")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!b || b.deposit_paid || !["lead", "pending_deposit"].includes(String(b.status)))
      return { ok: false as const, error: "This booking can't be changed here." };
    try {
      const full = await tryBookSlot(
        data.bookingId,
        data.date,
        data.time,
        data.mobile,
        data.water,
        data.plan === "signature" ? 2 : 1,
        "pending_deposit",
      );
      if (full)
        return {
          ok: false as const,
          error: "Someone just grabbed that one — pick another time.",
        };
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });

/** Frees a hold when the customer switches location or plan. */
export const releaseQuickSlot = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ bookingId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    await sb
      .from("bookings")
      .update({ status: "lead" })
      .eq("id", data.bookingId)
      .eq("status", "pending_deposit")
      .eq("deposit_paid", false);
    return { ok: true as const };
  });
