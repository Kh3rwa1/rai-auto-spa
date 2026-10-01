import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { admin, expireStaleHolds } from "./booking-core";
import { slotsForPlan } from "./plans";

/** Public: the waitlist offer link sent on WhatsApp. The offer UUID itself is the capability. */
export const getOffer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: o } = await sb
      .from("waitlist_offers")
      .select("id, date, time, area, location_type, status, expires_at, clients(name)")
      .eq("id", data.id)
      .maybeSingle();
    if (!o) return { found: false as const };
    const c = o.clients as unknown as { name: string } | null;
    const expired = o.status === "offered" && new Date(o.expires_at).getTime() < Date.now();
    return {
      found: true as const,
      date: o.date,
      time: o.time,
      area: o.area,
      locationType: o.location_type,
      firstName: (c?.name ?? "").split(" ")[0] ?? "",
      status: expired ? "expired" : o.status,
      expiresAt: o.expires_at,
    };
  });

/** First to claim wins: the slot goes through book_slot (advisory-locked capacity check). */
export const claimOffer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { assertWritesOpen } = await import("./write-pause.server");
    assertWritesOpen();
    const sb = await admin();
    const { data: o } = await sb
      .from("waitlist_offers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!o) return { result: "not_found" as const };
    if (o.status === "claimed") return { result: "claimed" as const };
    if (o.status !== "offered") return { result: "taken" as const };
    if (new Date(o.expires_at).getTime() < Date.now()) return { result: "expired" as const };
    // Free expired unpaid holds so the capacity check sees the truth.
    try {
      await expireStaleHolds(sb);
    } catch (e) {
      console.error("hold cleanup failed", e);
    }

    const { data: orig } = o.cancelled_booking_id
      ? await sb
          .from("bookings")
          .select("plan, vehicle_model, map_pin, total, water_needed")
          .eq("id", o.cancelled_booking_id)
          .maybeSingle()
      : { data: null };
    // Placeholder row with no date: invisible to capacity counts until book_slot sets the date under lock.
    const { data: nb, error } = await sb
      .from("bookings")
      .insert({
        client_id: o.client_id,
        plan: orig?.plan ?? "Essential Wash",
        vehicle_model: orig?.vehicle_model ?? null,
        location_type: o.location_type,
        area: o.area,
        map_pin: orig?.map_pin ?? null,
        water_needed: orig?.water_needed ?? false,
        total: orig?.total ?? 0,
        // Placeholder status: book_slot promotes it to pending_deposit under the same lock.
        status: "lead",
      })
      .select("id, manage_token")
      .single();
    if (error || !nb) return { result: "error" as const };

    const { data: code } = await sb.rpc("book_slot", {
      p_booking_id: nb.id,
      p_date: o.date,
      p_time: o.time,
      p_mobile: o.location_type === "mobile",
      p_water: true,
      p_days: 1,
      p_status: "pending_deposit",
      p_slots: slotsForPlan(orig?.plan ?? "Essential Wash"),
    });
    if (code !== "ok") {
      await sb.from("bookings").delete().eq("id", nb.id);
      await sb
        .from("waitlist_offers")
        .update({ status: "taken" })
        .eq("id", o.id)
        .eq("status", "offered");
      return { result: "taken" as const };
    }
    // Stamp the claim hold so the 20-minute expiry rule applies to it too.
    await sb
      .from("bookings")
      .update({ held_at: new Date().toISOString() })
      .eq("id", nb.id)
      .eq("status", "pending_deposit");
    // Mark this one claimed; siblings for the same freed slot become "taken".
    const { data: won } = await sb
      .from("waitlist_offers")
      .update({ status: "claimed", claimed_booking_id: nb.id })
      .eq("id", o.id)
      .eq("status", "offered")
      .select("id");
    if (!won?.length) {
      await sb.from("bookings").delete().eq("id", nb.id);
      return { result: "taken" as const };
    }
    if (o.cancelled_booking_id) {
      await sb
        .from("waitlist_offers")
        .update({ status: "taken" })
        .eq("cancelled_booking_id", o.cancelled_booking_id)
        .eq("status", "offered");
    }
    await sb.from("waitlist").delete().eq("client_id", o.client_id).eq("date", o.date);
    // Same as any normal booking: a manage token so the customer can pay or reschedule.
    return { result: "ok" as const, bookingId: nb.id, manageToken: nb.manage_token as string };
  });
