import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * DEMO MODE: the owner dashboard is intentionally open to guests for the challenge.
 * Every owner read/write goes through these server functions and this single gate.
 * Flip to `false` to require a signed-in admin (user_roles.role = 'admin').
 */
export const DEMO_MODE = true;

const BUCKET = "car-media";
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^\d{2}:\d{2}$/;

async function ownerDb() {
  if (!DEMO_MODE) {
    const { getRequest } = await import("@tanstack/react-start/server");
    const auth = getRequest()?.headers.get("authorization") ?? "";
    const token = auth.replace(/^Bearer /, "");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(token);
    const uid = u.user?.id;
    const { data: role } = uid
      ? await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", uid)
          .eq("role", "admin")
          .maybeSingle()
      : { data: null };
    if (!role) throw new Error("Owner access only.");
    return supabaseAdmin;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// Never send customer manage tokens to the dashboard.
const BOOKING_COLS =
  "id, client_id, vehicle_model, photo_url, clean_preview_url, video_url, video_status, plan, colour, style, location_type, map_pin, area, guard_permission, water_needed, date, end_date, full_day, time, total, deposit_paid, status, approval_status, email_status, created_at, subscription_id, clients(*)";

export const ownerData = createServerFn({ method: "POST" }).handler(async () => {
  const sb = await ownerDb();
  const [b, s] = await Promise.all([
    sb.from("bookings").select(BOOKING_COLS).order("date", { ascending: true }),
    sb.from("subscriptions").select("*, clients(*)").order("preferred_time"),
  ]);
  if (b.error || s.error) throw new Error("Could not load dashboard data.");
  return { bookings: b.data, subs: s.data };
});

export const ownerSignedUrls = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        paths: z
          .array(z.string().regex(/^(uploads|previews|videos|demo|originals)\/[\w.-]+$/))
          .max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!data.paths.length) return {} as Record<string, string>;
    const sb = await ownerDb();
    const { data: urls } = await sb.storage.from(BUCKET).createSignedUrls(data.paths, 3600);
    const m: Record<string, string> = {};
    urls?.forEach((u) => u.path && u.signedUrl && (m[u.path] = u.signedUrl));
    return m;
  });

export const listBlocked = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ start: z.string().regex(dateRe) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await ownerDb();
    const end = new Date(new Date(data.start).getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const { data: rows } = await sb
      .from("blocked_slots")
      .select("date, time, reason")
      .gte("date", data.start)
      .lt("date", end);
    return rows ?? [];
  });

export const setBlocked = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        mode: z.enum(["block", "unblock"]),
        keys: z
          .array(z.object({ date: z.string().regex(dateRe), time: z.string().regex(timeRe) }))
          .max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await ownerDb();
    if (data.mode === "block") {
      const { error } = await sb.from("blocked_slots").upsert(
        data.keys.map((k) => ({ ...k, reason: "Water shortage" })),
        { onConflict: "date,time" },
      );
      if (error) throw new Error("Could not block those slots.");
    } else {
      for (const k of data.keys)
        await sb.from("blocked_slots").delete().eq("date", k.date).eq("time", k.time);
    }
    return { ok: true };
  });

export const updateSubscription = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          preferred_time: z.string().regex(timeRe).optional(),
          active: z.boolean().optional(),
          skip_dates: z.array(z.string().regex(dateRe)).max(400).optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await ownerDb();
    const patch: { preferred_time?: string; active?: boolean; skip_dates?: string[] } = {};
    if (data.patch.preferred_time !== undefined) patch.preferred_time = data.patch.preferred_time;
    if (data.patch.active !== undefined) patch.active = data.patch.active;
    if (data.patch.skip_dates !== undefined) patch.skip_dates = data.patch.skip_dates;
    const { error } = await sb.from("subscriptions").update(patch).eq("id", data.id);
    if (error) throw new Error("Could not update the subscription.");
    // Reflect Skip / Pause / Change time on today's route + stats immediately.
    const { materialiseDay, istToday } = await import("./schedule.server");
    await materialiseDay(sb, istToday(), data.id);
    return { ok: true };
  });

export const setApproval = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "changes_requested", "pending"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await ownerDb();
    await sb.from("bookings").update({ approval_status: data.status }).eq("id", data.id);
    return { ok: true };
  });

/** Cancel a booking and auto-offer the freed slot to up to 3 waitlisted customers (same area + date first). */
export const cancelBooking = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await ownerDb();
    const { OPS } = await import("./ops-config");
    const { data: b } = await sb
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .in("status", ["confirmed", "pending_deposit", "consultation"])
      .select("id, area, date, time, location_type, client_id")
      .maybeSingle();
    if (!b || !b.date || !b.time) throw new Error("That booking can't be cancelled.");
    const pick = async (sameDate: boolean, exclude: string[]) => {
      let q = sb
        .from("waitlist")
        .select("client_id")
        .eq("area", b.area ?? "MG Marg")
        .order("created_at");
      if (sameDate) q = q.eq("date", b.date!);
      const { data: w } = await q.limit(10);
      return (w ?? [])
        .map((x) => x.client_id)
        .filter((id) => !exclude.includes(id) && id !== b.client_id);
    };
    let ids = [...new Set(await pick(true, []))];
    if (ids.length < OPS.offerFanout) ids = [...new Set([...ids, ...(await pick(false, ids))])];
    ids = ids.slice(0, OPS.offerFanout);
    const expires = new Date(Date.now() + OPS.offerMinutes * 60000).toISOString();
    if (ids.length) {
      const { error } = await sb
        .from("waitlist_offers")
        .insert(
          ids.map((client_id) => ({
            cancelled_booking_id: b.id,
            client_id,
            date: b.date!,
            time: b.time!,
            location_type: b.location_type,
            area: b.area,
            expires_at: expires,
          })),
        );
      if (error) throw new Error("Could not create waitlist offers.");
    }
    return { offered: ids.length };
  });

export const listOffers = createServerFn({ method: "POST" }).handler(async () => {
  const sb = await ownerDb();
  const { data } = await sb
    .from("waitlist_offers")
    .select(
      "id, date, time, area, status, expires_at, created_at, cancelled_booking_id, clients(name, phone)",
    )
    .order("created_at", { ascending: false })
    .limit(30);
  return data ?? [];
});

/** Materialise today's subscription visits (same logic as the daily cron). */
export const runSchedule = createServerFn({ method: "POST" }).handler(async () => {
  const sb = await ownerDb();
  const { materialiseDay, istToday } = await import("./schedule.server");
  return materialiseDay(sb, istToday());
});

export const resetDemo = createServerFn({ method: "POST" }).handler(async () => {
  const sb = await ownerDb();
  const { seedDemo } = await import("./seed.server");
  return seedDemo(sb);
});

/** Auto-seed when the dashboard would otherwise be empty (no bookings today or later). */
export const ensureDemoData = createServerFn({ method: "POST" }).handler(async () => {
  const sb = await ownerDb();
  const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const { count } = await sb
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .gte("date", today);
  if ((count ?? 0) > 0) return { seeded: false };
  const { seedDemo } = await import("./seed.server");
  await seedDemo(sb);
  return { seeded: true };
});
