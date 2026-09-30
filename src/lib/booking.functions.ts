import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  PLANS,
  SLOTS,
  STUDIO_BAYS,
  calcTotal,
  depositOf,
  haversineKm,
  imagePrompt,
  isDryWindow,
  nearestArea,
  videoPrompt,
  type PlanId,
} from "./plans";

const BUCKET = "car-media";
const planEnum = z.enum(["wash", "detail", "signature"]);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function signed(path: string | null | undefined) {
  if (!path) return null;
  const sb = await admin();
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 30);
  return data?.signedUrl ?? null;
}

const SLOT_ERRORS: Record<string, string> = {
  invalid_slot: "That time isn't one of our slots. Please pick another.",
  past_date: "That slot is already in the past. Please pick a later one.",
  dry_window: "Water needed — pick a morning slot or provide water.",
  blocked: "Rai has blocked that slot (water shortage). Please pick another.",
  full: "SLOT_FULL: That slot just filled up — your photo and plan are saved, please pick another time.",
  not_found: "Booking not found.",
};

async function bookSlot(id: string, date: string, time: string, mobile: boolean, water: boolean, days: number) {
  const sb = await admin();
  const { data, error } = await sb.rpc("book_slot", {
    p_booking_id: id, p_date: date, p_time: time, p_mobile: mobile, p_water: water, p_days: days,
  });
  if (error) throw new Error("Could not reserve the slot. Please try again.");
  if (data !== "ok") throw new Error(SLOT_ERRORS[data as string] ?? "That slot isn't available.");
}

export const uploadCar = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ image: z.string().max(9_000_000), mime: z.string().max(40).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { decodeUpload, blurRegion, parseBox } = await import("./image-safety.server");
    const input = decodeUpload(data.image);
    if (!input.ok) return { ok: false as const, error: input.error };
    const { detectVehicle } = await import("./ai.server");
    const sb = await admin();
    const id = crypto.randomUUID();
    const b64 = data.image.replace(/^data:[^,]*,/, "").replace(/\s/g, "");
    let vehicle: { model: string; isCar: boolean; plate: unknown };
    try {
      vehicle = await detectVehicle(b64, input.mime);
    } catch {
      vehicle = { model: "Car", isCar: true, plate: null };
    }
    // Original stays private (owner-only via signed URL); the display image has the plate pixelated.
    const originalPath = `originals/${id}.${input.mime.split("/")[1]}`;
    const displayPath = `uploads/${id}.jpg`;
    const box = parseBox(vehicle.plate);
    const blurred = box && input.mime === "image/jpeg" ? blurRegion(input.bytes, box) : null;
    const [o, u] = await Promise.all([
      sb.storage.from(BUCKET).upload(originalPath, input.bytes, { contentType: input.mime }),
      sb.storage.from(BUCKET).upload(displayPath, blurred ?? input.bytes, { contentType: blurred ? "image/jpeg" : input.mime }),
    ]);
    if (o.error || u.error) return { ok: false as const, error: "Could not save your photo. Please try again." };
    const { data: row, error } = await sb
      .from("bookings")
      .insert({ id, vehicle_model: vehicle.model, photo_url: displayPath, plan: "Essential Wash", status: "lead" })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: "Could not start your booking. Please try again." };
    return { ok: true as const, bookingId: row.id, vehicle: vehicle.model, isCar: vehicle.isCar, plateBlurred: !!blurred, photoUrl: await signed(displayPath) };
  });

export const makePreview = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        bookingId: z.string().uuid(),
        plan: planEnum,
        colour: z.string().max(40).optional(),
        style: z.string().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { createVideoJob, editCarImage } = await import("./ai.server");
    const sb = await admin();
    const { data: b } = await sb
      .from("bookings")
      .select("photo_url, video_job_id, video_status")
      .eq("id", data.bookingId)
      .single();
    if (!b?.photo_url) throw new Error("Please upload your car photo first.");
    const file = await sb.storage.from(BUCKET).download(b.photo_url);
    if (file.error) throw new Error("Could not read your photo.");
    const bytes = new Uint8Array(await file.data.arrayBuffer());

    const out = await editCarImage(bytes, "image/jpeg", imagePrompt(data.plan, data.colour, data.style));
    const path = `previews/${data.bookingId}-${data.plan}-${(data.colour ?? "").replace(/\W/g, "")}-${(data.style ?? "").replace(/\W/g, "")}.png`;
    await sb.storage.from(BUCKET).upload(path, out, { contentType: "image/png", upsert: true });
    await sb
      .from("bookings")
      .update({
        clean_preview_url: path,
        plan: PLANS[data.plan].name,
        colour: data.colour ?? null,
        style: data.style ?? null,
      })
      .eq("id", data.bookingId);

    // Use the finished design as the reveal's opening frame, then let both results
    // continue through the booking without showing generation status to customers.
    if (!b.video_job_id && !b.video_status?.startsWith("starting")) {
      const generationKey = `${data.plan}-${data.colour ?? ""}-${data.style ?? ""}`.replace(/[^a-zA-Z0-9-]/g, "");
      const { data: locked } = await sb
        .from("bookings")
        .update({ video_status: `starting:${generationKey}` })
        .eq("id", data.bookingId)
        .is("video_job_id", null)
        .or("video_status.is.null,video_status.not.like.starting:%")
        .select("id")
        .maybeSingle();
      if (locked) {
        try {
          const jobId = await createVideoJob(out, "image/png", videoPrompt(data.plan, data.colour, data.style));
          await sb
            .from("bookings")
            .update({ video_job_id: jobId, video_status: "rendering" })
            .eq("id", data.bookingId);
        } catch (error) {
          await sb
            .from("bookings")
            .update({ video_status: `failed: ${(error as Error).message.slice(0, 120)}` })
            .eq("id", data.bookingId);
        }
      }
    }
    return { previewUrl: await signed(path), path };
  });

export const getSlots = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        mobile: z.boolean(),
        pin: z.object({ lat: z.number(), lng: z.number() }).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const end = new Date(data.start);
    end.setDate(end.getDate() + 7);
    const endStr = end.toISOString().slice(0, 10);
    const [{ data: bookings }, { data: blocked }] = await Promise.all([
      sb
        .from("bookings")
        .select("date, end_date, full_day, time, location_type, map_pin")
        .gte("date", new Date(new Date(data.start).getTime() - 86400000).toISOString().slice(0, 10))
        .lt("date", endStr)
        .in("status", ["confirmed", "pending_deposit", "consultation"]),
      sb.from("blocked_slots").select("date, time, reason").gte("date", data.start).lt("date", endStr),
    ]);
    const result: Record<string, { taken: number; blocked: string | null; travelMin: number | null }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(data.start);
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().slice(0, 10);
      const dayMobile = (bookings ?? []).filter((b) => b.date === ds && b.location_type === "mobile");
      for (const t of SLOTS) {
        const here = (bookings ?? []).filter(
          (b) =>
            !!b.date &&
            ds >= b.date &&
            ds <= (b.end_date ?? b.date) &&
            (b.time === t || b.full_day) &&
            (b.location_type === "mobile") === data.mobile,
        );
        const block = (blocked ?? []).find((b) => b.date === ds && b.time === t);
        let travelMin: number | null = null;
        if (data.mobile && data.pin && dayMobile.length) {
          const km = Math.min(
            ...dayMobile.map((b) => haversineKm(data.pin!, b.map_pin as { lat: number; lng: number })),
          );
          travelMin = Math.max(5, Math.round((km / 20) * 60));
        }
        result[`${ds} ${t}`] = { taken: here.length, blocked: block?.reason ?? null, travelMin };
      }
    }
    return { slots: result, capacity: data.mobile ? 1 : STUDIO_BAYS };
  });

const confirmSchema = z.object({
  bookingId: z.string().uuid(),
  plan: planEnum,
  colour: z.string().max(40).optional(),
  style: z.string().max(40).optional(),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{8,15}$/),
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
    const { data: existing } = await sb.from("bookings").select("*").eq("id", data.bookingId).single();
    if (!existing) throw new Error("Booking not found.");
    if (existing.deposit_paid) return { ok: true, manageToken: existing.manage_token as string };
    await bookSlot(data.bookingId, data.date, data.time, data.mobile, data.water, data.plan === "signature" ? 2 : 1);
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
        map_pin: data.mobile ? { ...data.pin, parking: data.parking ?? "" } : { lat: 27.3314, lng: 88.6138 },
        area: data.mobile && data.pin ? nearestArea(data.pin) : "MG Marg",
        guard_permission: data.guard,
        water_needed: waterFee,
        total,
        status: "pending_deposit",
        approval_status: data.plan === "signature" ? "pending" : null,
      })
      .eq("id", data.bookingId);
    if (error) throw new Error("Could not save the booking.");
    return { ok: true, total, deposit: depositOf(total), manageToken: existing.manage_token as string };
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
    const { data: b } = await sb.from("bookings").select("*, clients(name, email)").eq("id", data.bookingId).maybeSingle();
    if (!b || b.manage_token !== data.token) throw new Error("Booking not found.");
    if (b.deposit_paid) return { ok: true, status: "success" as const };
    if (!b.date || !b.time || !b.client_id) throw new Error("Please pick a slot and add your details first.");
    const amount = depositOf(b.total);
    if (data.fail) {
      await sb.from("payments").insert({ booking_id: b.id, amount, method: data.method, status: "failed" });
      throw new Error("PAYMENT_FAILED: Your bank declined the demo payment. Nothing was charged — please try again.");
    }
    await sb.from("payments").insert({ booking_id: b.id, amount, method: data.method, status: "success" });
    const plan = planIdByName(b.plan);
    await sb
      .from("bookings")
      .update({ deposit_paid: true, status: plan === "signature" ? "consultation" : "confirmed" })
      .eq("id", b.id);
    const client = b.clients as { name: string; email: string | null } | null;
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
            location: b.location_type === "mobile" ? `${b.area} (Rai's van comes to you)` : "Studio, MG Marg, Gangtok",
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
            const jobId = await createVideoJob(bytes, mime, videoPrompt(plan, b.colour ?? undefined, b.style ?? undefined));
            await sb.from("bookings").update({ video_job_id: jobId, video_status: "rendering" }).eq("id", b.id);
          }
        }
      } catch (e) {
        await sb.from("bookings").update({ video_status: "failed: " + (e as Error).message.slice(0, 120) }).eq("id", b.id);
      }
    }
    return { ok: true, status: "success" as const };
  });

/** Owner: build a deep link that reopens a lead's booking at the slot step. */
export const createPaymentLink = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ bookingId: z.string().uuid(), origin: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: b } = await sb.from("bookings").select("id, manage_token, vehicle_model").eq("id", data.bookingId).maybeSingle();
    if (!b) throw new Error("Booking not found.");
    await sb.from("bookings").update({ status: "link_sent" }).eq("id", b.id).eq("status", "lead");
    const link = `${data.origin}/pay/${b.id}?t=${b.manage_token}`;
    const text = `Hi! Your ${b.vehicle_model ?? "car"} is one tap away from shining ✨ Your photo and plan are saved — just pick a time and pay the 30% deposit here: ${link} — Rai's Auto Spa`;
    return { link, text };
  });

/** Customer: reopen a saved booking from a /pay deep link. */
export const resumeBooking = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ bookingId: z.string().uuid(), token: z.string().min(16).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: b } = await sb
      .from("bookings")
      .select("id, vehicle_model, photo_url, clean_preview_url, plan, colour, style, deposit_paid, manage_token")
      .eq("id", data.bookingId)
      .maybeSingle();
    // Expected outcome for stale/guessed links: return a value instead of throwing.
    if (!b || b.manage_token !== data.token) return { valid: false as const };
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
    };
  });

export const checkVideo = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ bookingId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: b } = await sb
      .from("bookings")
      .select("*, clients(name, email, phone)")
      .eq("id", data.bookingId)
      .single();
    if (!b) throw new Error("Booking not found");
    if (b.video_url) {
      const videoUrl = await signed(b.video_url);
      let emailStatus = b.email_status;
      const client = b.clients as { name: string; email: string | null } | null;
      if (client?.email && videoUrl && emailStatus !== "sent" && emailStatus !== "suppressed") {
        try {
          const { sendRevealEmail } = await import("./reveal-email.server");
          emailStatus = await sendRevealEmail({
            to: client.email,
            bookingId: b.id,
            name: client.name,
            vehicle: b.vehicle_model ?? "car",
            plan: b.plan,
            date: b.date ?? "",
            time: b.time ?? "",
            location: b.location_type === "mobile" ? `${b.area} (Rai's van comes to you)` : "Studio, MG Marg, Gangtok",
            total: b.total,
            videoUrl,
          });
          await sb.from("bookings").update({ email_status: emailStatus }).eq("id", b.id);
        } catch (e) {
          console.error("email failed", e);
          emailStatus = "failed";
        }
      }
      return { status: "ready", videoUrl, emailStatus };
    }
    if (!b.video_job_id) return { status: b.video_status ?? "queued", videoUrl: null, emailStatus: b.email_status };
    const { getVideoJob, downloadVideo } = await import("./ai.server");
    const job = await getVideoJob(b.video_job_id);
    if (job.status === "failed") {
      await sb.from("bookings").update({ video_status: "failed" }).eq("id", b.id);
      return { status: "failed", videoUrl: null, emailStatus: b.email_status, error: job.error?.message };
    }
    if (job.status !== "completed") return { status: "rendering", videoUrl: null, emailStatus: b.email_status };
    const bytes = await downloadVideo(b.video_job_id);
    const path = `videos/${b.id}.mp4`;
    await sb.storage.from(BUCKET).upload(path, bytes, { contentType: "video/mp4", upsert: true });
    const videoUrl = await signed(path);
    let emailStatus = "sent";
    try {
      const { sendRevealEmail } = await import("./reveal-email.server");
      const client = b.clients as { name: string; email: string | null } | null;
      if (client?.email) {
        const r = await sendRevealEmail({
          to: client.email,
          bookingId: b.id,
          name: client.name,
          vehicle: b.vehicle_model ?? "car",
          plan: b.plan,
          date: b.date ?? "",
          time: b.time ?? "",
          location: b.location_type === "mobile" ? `${b.area} (Rai's van comes to you)` : "Studio, MG Marg, Gangtok",
          total: b.total,
          videoUrl: videoUrl ?? "",
        });
        emailStatus = r;
      } else emailStatus = "no_email";
    } catch (e) {
      console.error("email failed", e);
      emailStatus = "failed";
    }
    await sb.from("bookings").update({ video_url: path, video_status: "ready", email_status: emailStatus }).eq("id", b.id);
    return { status: "ready", videoUrl, emailStatus };
  });

export const rescheduleBooking = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        bookingId: z.string().uuid(),
        token: z.string().min(16).max(64),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: b } = await sb
      .from("bookings")
      .select("date, time, water_needed, location_type, full_day, manage_token")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!b?.date || !b.time || b.manage_token !== data.token) throw new Error("Booking not found");
    const start = new Date(`${b.date}T${b.time}:00+05:30`).getTime();
    if (start - Date.now() < 12 * 3600 * 1000) throw new Error("Free reschedule closes 12 hours before your slot. Please WhatsApp Rai.");
    const mobile = b.location_type === "mobile";
    await bookSlot(data.bookingId, data.date, data.time, mobile, !b.water_needed, b.full_day ? 2 : 1);
    return { ok: true };
  });

export type PlanKey = PlanId;
