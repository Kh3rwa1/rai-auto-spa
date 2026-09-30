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
import { BUCKET, planEnum, admin, signed, requestOrigin, tryBookSlot } from "./booking-core";

const confirmSchema = z.object({
  bookingId: z.string().uuid(),
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
    if (existing.deposit_paid)
      return { ok: true, manageToken: existing.manage_token as string, slotFull: null };
    const slotFull = await tryBookSlot(
      data.bookingId,
      data.date,
      data.time,
      data.mobile,
      data.water,
      data.plan === "signature" ? 2 : 1,
      "pending_deposit",
    );
    // An expected outcome, not a crash: tell the customer to pick another time.
    if (slotFull) return { ok: false, manageToken: "", slotFull };
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
    if (b.deposit_paid) return { ok: true, status: "success" as const, message: null };
    if (!b.date || !b.time || !b.client_id)
      return {
        ok: false,
        status: "error" as const,
        message: "Please pick a slot and add your details first.",
      };
    const amount = depositOf(b.total);
    if (data.fail) {
      await sb
        .from("payments")
        .insert({ booking_id: b.id, amount, method: data.method, status: "failed" });
      return {
        ok: false,
        status: "failed" as const,
        message: "Your bank declined the demo payment. Nothing was charged — please try again.",
      };
    }
    await sb
      .from("payments")
      .insert({ booking_id: b.id, amount, method: data.method, status: "success" });
    const plan = planIdByName(b.plan);
    await sb
      .from("bookings")
      .update({ deposit_paid: true, status: plan === "signature" ? "consultation" : "confirmed" })
      .eq("id", b.id);
    const client = b.clients as {
      name: string;
      email: string | null;
      phone: string | null;
      building: string | null;
    } | null;
    // Sarvam voice agent rings the customer to confirm; never blocks the booking.
    const toCall = b.customer_phone_e164 ?? client?.phone ?? null;
    if (toCall) {
      try {
        const { placeConfirmationCall } = await import("./sarvam.server");
        const call = await placeConfirmationCall(
          {
            bookingId: b.id,
            customerName: client?.name ?? "there",
            customerPhoneE164: toCall,
            detectedCountry: b.detected_country ?? null,
            plan: b.plan,
            date: b.date,
            time: b.time,
            building:
              b.location_type === "mobile"
                ? (client?.building ?? b.area ?? "your address")
                : "our MG Marg studio",
          },
          await requestOrigin(),
        );
        await sb
          .from("bookings")
          .update({ call_status: call.status, call_from_number: call.from })
          .eq("id", b.id);
      } catch (e) {
        console.error("confirmation call failed", e);
      }
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
    // Owner-only action: goes through the same DEMO_MODE / admin gate as the rest of the dashboard.
    const { ownerDb } = await import("./owner-db.server");
    const sb = await ownerDb();
    const { data: b } = await sb
      .from("bookings")
      .select("id, manage_token, vehicle_model")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!b) throw new Error("Booking not found.");
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
