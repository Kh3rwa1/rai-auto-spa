import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  PLANS,
  calcTotal,
  depositOf,
  isDryWindow,
  nearestArea,
  videoPrompt,
  type PlanId,
} from "./plans";
import {
  BUCKET,
  planEnum,
  admin,
  signed,
  requestOrigin,
  tryBookSlot,
  expireStaleHolds,
  assertManageToken,
} from "./booking-core";

const confirmSchema = z.object({
  bookingId: z.string().uuid(),
  // Empty on a first-time checkout (the token is generated server-side); on a resumed
  // booking it must match, so a known booking id alone can't hijack someone's row.
  token: z.string().max(64).optional(),
  plan: planEnum,
  colour: z.string().max(40).optional(),
  style: z.string().max(40).optional(),
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/),
  country: z.string().trim().length(2).optional(),
  email: z.string().trim().email().max(200),
  notes: z.string().trim().max(300).optional(),
  mobile: z.boolean(),
  pin: z.object({ lat: z.number(), lng: z.number() }).nullable(),
  building: z.string().max(120).optional(),
  floor: z.string().max(20).optional(),
  parking: z.string().max(40).optional(),
  guard: z.boolean(),
  water: z.boolean(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

export const confirmBooking = createServerFn({ method: "POST" })
  .inputValidator((d) => confirmSchema.parse(d))
  .handler(async ({ data }) => {
    const { assertWritesOpen } = await import("./write-pause.server");
    assertWritesOpen();
    const sb = await admin();
    if (data.mobile && !data.pin) throw new Error("Please drop a pin for the van.");
    if (data.mobile && !data.water && isDryWindow(data.time))
      throw new Error("Water needed — pick a morning slot or provide water.");
    const { data: existing } = await sb
      .from("bookings")
      .select("*")
      .eq("id", data.bookingId)
      .single();
    if (!existing) throw new Error("Booking not found.");
    assertManageToken(existing.manage_token, data.token);
    if (existing.status === "cancelled") throw new Error("This booking was cancelled.");
    if (existing.deposit_paid)
      return { ok: true, manageToken: existing.manage_token as string, slotFull: null };
    // Free expired unpaid holds so the capacity check sees the truth.
    try {
      await expireStaleHolds(sb);
    } catch (e) {
      console.error("hold cleanup failed", e);
    }
    const slotFull = await tryBookSlot(
      data.bookingId,
      data.date,
      data.time,
      data.mobile,
      data.water,
      data.plan === "signature" ? 2 : 1,
      "pending_deposit",
      data.plan === "detail" ? 2 : 1,
    );
    // An expected outcome, not a crash: tell the customer to pick another time.
    if (slotFull) return { ok: false, manageToken: "", slotFull };
    // Stamp when this hold started so the 20-minute expiry rule can actually run.
    await sb
      .from("bookings")
      .update({ held_at: new Date().toISOString() })
      .eq("id", data.bookingId)
      .eq("status", "pending_deposit");
    const waterFee = data.mobile && !data.water;
    const total = calcTotal(data.plan, data.mobile, waterFee);
    const { data: client, error: ce } = await sb
      .from("clients")
      .insert({
        name: data.name,
        phone: data.phone,
        email: data.email,
        building: data.building ?? null,
        floor: data.floor ?? null,
        area: data.mobile && data.pin ? nearestArea(data.pin) : "MG Marg",
        water_access: data.water,
      })
      .select("id")
      .single();
    if (ce) throw new Error("Could not save your details.");
    const { error } = await sb
      .from("bookings")
      .update({
        client_id: client.id,
        plan: PLANS[data.plan].name,
        colour: data.colour ?? null,
        style: data.style ?? null,
        map_pin: data.mobile
          ? { ...data.pin, parking: data.parking ?? "" }
          : { lat: 27.3314, lng: 88.6138 },
        area: data.mobile && data.pin ? nearestArea(data.pin) : "MG Marg",
        guard_permission: data.guard,
        water_needed: waterFee,
        customer_phone_e164: data.phone,
        detected_country: data.country ?? null,
        notes: data.notes || null,
        total,
        status: "pending_deposit",
        approval_status: data.plan === "signature" ? "pending" : null,
      })
      .eq("id", data.bookingId);
    if (error) throw new Error("Could not save the booking.");
    return {
      ok: true,
      total,
      deposit: depositOf(total),
      manageToken: existing.manage_token as string,
      slotFull: null,
    };
  });

const planIdByName = (name: string): PlanId =>
  (Object.keys(PLANS) as PlanId[]).find((k) => PLANS[k].name === name) ?? "wash";

/** Demo checkout. The ONLY code path that may set deposit_paid=true (a DB trigger blocks browser clients). */
export const simulatePayment = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        bookingId: z.string().uuid(),
        token: z.string().min(16).max(64),
        method: z.enum(["upi", "card", "netbanking"]),
        fail: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { assertWritesOpen } = await import("./write-pause.server");
    assertWritesOpen();
    const sb = await admin();
    const { data: b } = await sb
      .from("bookings")
      .select("*, clients(name, email, phone, building)")
      .eq("id", data.bookingId)
      .maybeSingle();
    // Expected outcomes are returned, never thrown: a thrown server-fn error
    // reaches the route error boundary and blanks the checkout screen.
    if (!b || b.manage_token !== data.token)
      return { ok: false, status: "error" as const, message: "Booking not found." };
    // Same deliberate order as confirm_demo_payment: a cancelled booking can't be
    // paid (even if it was paid before cancellation); an active paid booking is
    // idempotently already paid.
    if (b.status === "cancelled")
      return { ok: false, status: "error" as const, message: "This booking was cancelled." };
    if (b.deposit_paid) return { ok: true, status: "success" as const, message: null };
    if (!b.date || !b.time || !b.client_id)
      return {
        ok: false,
        status: "error" as const,
        message: "Please pick a slot and add your details first.",
      };
    const amount = depositOf(b.total);
    if (data.fail) {
      const failed = await sb
        .from("payments")
        .insert({ booking_id: b.id, amount, method: data.method, status: "failed" });
      if (failed.error) console.error("failed-payment row not recorded", failed.error);
      return {
        ok: false,
        status: "failed" as const,
        message: "Your bank declined the demo payment. Nothing was charged — please try again.",
      };
    }
    // Finalization is ONE transaction in the database: SELECT ... FOR UPDATE locks the
    // row, hold expiry is validated under that lock (an expired checkout can never
    // revive a booking), then the deposit flip and the successful payment row are
    // committed atomically. Idempotent: a simultaneous second caller gets
    // 'already_paid'. Calls/emails/video jobs stay in app code, after the commit.
    const { data: code, error: rpcError } = await sb.rpc("confirm_demo_payment", {
      p_booking_id: b.id,
      p_method: data.method,
      p_amount: amount,
    });
    if (rpcError) {
      const e = rpcError as { code?: string; message?: string };
      const missing = e.code === "42883" || (e.message ?? "").includes("confirm_demo_payment");
      console.error("confirm_demo_payment failed", rpcError);
      return {
        ok: false,
        status: "error" as const,
        message: missing
          ? "Payment confirmation isn't live yet — please try again in a moment."
          : "The demo payment could not be recorded — nothing was charged. Please try again.",
      };
    }
    const result = (code as string) ?? "error";
    if (result === "ok" || result === "already_paid") {
      // success path continues below (call, email, reveal video)
    } else if (result === "hold_expired") {
      return {
        ok: false,
        status: "error" as const,
        message: "Your hold expired — please pick a slot and confirm again. Nothing was charged.",
      };
    } else if (result === "cancelled") {
      return {
        ok: false,
        status: "error" as const,
        message: "This booking was cancelled.",
      };
    } else if (result === "untimed_hold") {
      return {
        ok: false,
        status: "error" as const,
        message:
          "This reservation isn't active — please pick a slot and confirm again. Nothing was charged.",
      };
    } else if (result === "not_payable") {
      return {
        ok: false,
        status: "error" as const,
        message: "Please pick a slot and add your details first.",
      };
    } else if (result === "invalid_amount") {
      return {
        ok: false,
        status: "error" as const,
        message: "The amount didn't match your booking — reload the page and try again.",
      };
    } else if (result === "not_found") {
      return { ok: false, status: "error" as const, message: "Booking not found." };
    } else {
      return {
        ok: false,
        status: "error" as const,
        message: "The demo payment could not be recorded — nothing was charged. Please try again.",
      };
    }
    const client = b.clients as {
      name: string;
      email: string | null;
      phone: string | null;
      building: string | null;
    } | null;
    // Sarvam voice agent rings the customer to confirm; never blocks the booking.
    try {
      const { callBookingAndRecord } = await import("./call-booking.server");
      await callBookingAndRecord(
        {
          id: b.id,
          plan: b.plan,
          date: b.date,
          time: b.time,
          area: b.area,
          location_type: b.location_type,
          detected_country: b.detected_country ?? null,
          customer_phone_e164: b.customer_phone_e164 ?? null,
          clients: client
            ? { name: client.name, phone: client.phone, building: client.building }
            : null,
        },
        await requestOrigin(),
      );
    } catch (e) {
      console.error("confirmation call failed", e);
    }

    if (client?.email) {
      try {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        await sendTemplateEmail("booking-confirmation", client.email, {
          templateData: {
            name: client.name,
            vehicle: b.vehicle_model ?? "car",
            plan: b.plan,
            date: b.date,
            time: b.time,
            location:
              b.location_type === "mobile"
                ? `${b.area} (Rai's van comes to you)`
                : "Studio, MG Marg, Gangtok",
            total: b.total,
            deposit: amount,
          },
          idempotencyKey: `booking-confirmation-${b.id}`,
        });
      } catch (e) {
        console.error("confirmation email failed", e);
      }
    }
    // Older or interrupted bookings may not have started their reveal before payment.
    if (!b.video_job_id && !b.video_status?.startsWith("starting")) {
      try {
        const { createVideoJob } = await import("./ai.server");
        const plan = planIdByName(b.plan);
        const src = b.clean_preview_url ?? b.photo_url;
        if (src) {
          const file = await sb.storage.from(BUCKET).download(src);
          if (!file.error) {
            const bytes = new Uint8Array(await file.data.arrayBuffer());
            const mime = src.endsWith(".png") ? "image/png" : "image/jpeg";
            const jobId = await createVideoJob(
              bytes,
              mime,
              videoPrompt(plan, b.colour ?? undefined, b.style ?? undefined),
            );
            await sb
              .from("bookings")
              .update({ video_job_id: jobId, video_status: "rendering" })
              .eq("id", b.id);
          }
        }
      } catch (e) {
        await sb
          .from("bookings")
          .update({ video_status: "failed: " + (e as Error).message.slice(0, 120) })
          .eq("id", b.id);
      }
    }
    return { ok: true, status: "success" as const, message: null };
  });

/** Owner: build a deep link that reopens a lead's booking at the slot step. */
export const createPaymentLink = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ bookingId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { assertWritesOpen } = await import("./write-pause.server");
    assertWritesOpen();
    // Owner-only action: goes through the same DEMO_MODE / admin gate as the rest of the dashboard.
    const { ownerDb } = await import("./owner-db.server");
    const { DEMO_MODE } = await import("./demo-mode");
    const sb = await ownerDb();
    const { data: b } = await sb
      .from("bookings")
      .select("id, manage_token, vehicle_model, is_seed")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!b) throw new Error("Booking not found.");
    // The payment link carries the booking's manage token (full customer access). In the
    // guest sandbox it must only be mintable for sample bookings — a real customer's lead
    // link is owner business, not demo content.
    if (DEMO_MODE && !b.is_seed)
      throw new Error(
        "Guest sandbox: payment links can only be minted for sample bookings — real customer leads are protected.",
      );
    await sb.from("bookings").update({ status: "link_sent" }).eq("id", b.id).eq("status", "lead");
    const origin = await requestOrigin();
    const link = `${origin}/pay/${b.id}?t=${b.manage_token}`;
    const text = `Hi! Your ${b.vehicle_model ?? "car"} is one tap away from shining ✨ Your photo and plan are saved — just pick a time and pay the 30% deposit here: ${link} — Rai's Auto Spa`;
    return { link, text };
  });

/** Customer: reopen a saved booking from a /pay deep link (incl. waitlist claims). */
export const resumeBooking = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ bookingId: z.string().uuid(), token: z.string().min(16).max(64) }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: b } = await sb
      .from("bookings")
      .select(
        "id, vehicle_model, photo_url, clean_preview_url, plan, colour, style, deposit_paid, manage_token, date, time, location_type, clients(name, phone, email)",
      )
      .eq("id", data.bookingId)
      .maybeSingle();
    // Expected outcome for stale/guessed links: return a value instead of throwing.
    if (!b || b.manage_token !== data.token) return { valid: false as const };
    const client = b.clients as unknown as { name: string; phone: string; email: string } | null;
    return {
      valid: true as const,
      id: b.id,
      vehicle: b.vehicle_model ?? "Car",
      photoUrl: await signed(b.photo_url),
      previewUrl: await signed(b.clean_preview_url),
      plan: planIdByName(b.plan),
      colour: b.colour,
      style: b.style,
      paid: b.deposit_paid,
      token: b.manage_token as string,
      date: (b as { date?: string | null }).date ?? null,
      time: (b as { time?: string | null }).time ?? null,
      name: client?.name ?? "",
      phone: client?.phone ?? "",
      email: client?.email ?? "",
    };
  });
