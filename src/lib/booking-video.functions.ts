import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { type PlanId } from "./plans";
import { slotsForPlan } from "./plans";
import { BUCKET, admin, signed, bookSlot, expireStaleHolds } from "./booking-core";

export const checkVideo = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ bookingId: z.string().uuid(), token: z.string().min(16).max(64) }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: b } = await sb
      .from("bookings")
      .select("*, clients(name, email, phone)")
      .eq("id", data.bookingId)
      .single();
    // Token-gated like the email preview: a booking UUID alone must not be able to
    // trigger the customer's reveal email or fetch their signed video URL.
    if (!b || b.manage_token !== data.token)
      return { status: "unavailable", videoUrl: null, emailStatus: null as string | null };
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
            location:
              b.location_type === "mobile"
                ? `${b.area} (Rai's van comes to you)`
                : "Studio, MG Marg, Gangtok",
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
    if (!b.video_job_id)
      return { status: b.video_status ?? "queued", videoUrl: null, emailStatus: b.email_status };
    const { getVideoJob, downloadVideo } = await import("./ai.server");
    const job = await getVideoJob(b.video_job_id);
    if (job.status === "failed") {
      await sb.from("bookings").update({ video_status: "failed" }).eq("id", b.id);
      return {
        status: "failed",
        videoUrl: null,
        emailStatus: b.email_status,
        error: job.error?.message,
      };
    }
    if (job.status !== "completed")
      return { status: "rendering", videoUrl: null, emailStatus: b.email_status };
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
          location:
            b.location_type === "mobile"
              ? `${b.area} (Rai's van comes to you)`
              : "Studio, MG Marg, Gangtok",
          total: b.total,
          videoUrl: videoUrl ?? "",
        });
        emailStatus = r;
      } else emailStatus = "no_email";
    } catch (e) {
      console.error("email failed", e);
      emailStatus = "failed";
    }
    await sb
      .from("bookings")
      .update({ video_url: path, video_status: "ready", email_status: emailStatus })
      .eq("id", b.id);
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
    const { assertWritesOpen } = await import("./write-pause.server");
    assertWritesOpen();
    const sb = await admin();
    const { data: b } = await sb
      .from("bookings")
      .select("date, time, plan, water_needed, location_type, full_day, manage_token")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!b?.date || !b.time || b.manage_token !== data.token) throw new Error("Booking not found");
    // Free expired unpaid holds so the capacity check sees the truth.
    try {
      await expireStaleHolds(sb);
    } catch (e) {
      console.error("hold cleanup failed", e);
    }
    const start = new Date(`${b.date}T${b.time}:00+05:30`).getTime();
    if (start - Date.now() < 12 * 3600 * 1000)
      throw new Error("Free reschedule closes 12 hours before your slot. Please WhatsApp Rai.");
    const mobile = b.location_type === "mobile";
    await bookSlot(
      data.bookingId,
      data.date,
      data.time,
      mobile,
      !b.water_needed,
      b.full_day ? 2 : 1,
      undefined,
      b.full_day ? 1 : slotsForPlan(b.plan),
    );
    return { ok: true };
  });

export type PlanKey = PlanId;
