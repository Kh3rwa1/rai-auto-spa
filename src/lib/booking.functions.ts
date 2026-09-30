import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PLANS, SLOTS, STUDIO_BAYS, haversineKm, imagePrompt, videoPrompt } from "./plans";
import { BUCKET, planEnum, admin, signed } from "./booking-core";

/** Unpaid holds stop counting after this long (matches book_slot() in the database). */
const HOLD_MS = 20 * 60_000;

type SlotRow = {
  date: string | null;
  end_date: string | null;
  full_day: boolean | null;
  time: string | null;
  location_type: string | null;
  map_pin: unknown;
  status: string | null;
  held_at: string | null;
  deposit_paid: boolean | null;
};

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
      sb.storage.from(BUCKET).upload(displayPath, blurred ?? input.bytes, {
        contentType: blurred ? "image/jpeg" : input.mime,
      }),
    ]);
    if (o.error || u.error) return { ok: false as const, error: "Could not save your photo. Please try again." };
    const { data: row, error } = await sb
      .from("bookings")
      .insert({
        id,
        vehicle_model: vehicle.model,
        photo_url: displayPath,
        plan: "Essential Wash",
        status: "lead",
      })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: "Could not start your booking. Please try again." };
    return {
      ok: true as const,
      bookingId: row.id,
      vehicle: vehicle.model,
      isCar: vehicle.isCar,
      plateBlurred: !!blurred,
      photoUrl: await signed(displayPath),
    };
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
    const path = `previews/${data.bookingId}-${data.plan}-${(data.colour ?? "").replace(/\W/g, "")}-${(data.style ?? "").replace(/\W/g, "")}.jpg`;
    await sb.storage.from(BUCKET).upload(path, out, { contentType: "image/jpeg", upsert: true });
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
          const jobId = await createVideoJob(out, "image/jpeg", videoPrompt(data.plan, data.colour, data.style));
          await sb.from("bookings").update({ video_job_id: jobId, video_status: "rendering" }).eq("id", data.bookingId);
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
        .select("date, end_date, full_day, time, location_type, map_pin, status, held_at, deposit_paid")
        .gte("date", new Date(new Date(data.start).getTime() - 86400000).toISOString().slice(0, 10))
        .lt("date", endStr)
        .in("status", ["confirmed", "pending_deposit", "consultation"]),
      sb.from("blocked_slots").select("date, time, reason").gte("date", data.start).lt("date", endStr),
    ]);

    // Same rule as book_slot(): unpaid holds older than 20 min no longer take a slot.
    const now = Date.now();
    const live = ((bookings ?? []) as unknown as SlotRow[]).filter(
      (b) =>
        b.status !== "pending_deposit" ||
        !!b.deposit_paid ||
        !b.held_at ||
        now - new Date(b.held_at).getTime() < HOLD_MS,
    );

    const result: Record<string, { taken: number; blocked: string | null; travelMin: number | null }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(data.start);
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().slice(0, 10);
      const dayMobile = live.filter((b) => b.date === ds && b.location_type === "mobile");
      for (const t of SLOTS) {
        const here = live.filter(
          (b) =>
            !!b.date &&
            ds >= b.date &&
            ds <= (b.end_date ?? b.date) &&
            (b.time === t || !!b.full_day) &&
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

export { confirmBooking, simulatePayment, createPaymentLink, resumeBooking } from "./booking-pay.functions";
export { checkVideo, rescheduleBooking } from "./booking-video.functions";
