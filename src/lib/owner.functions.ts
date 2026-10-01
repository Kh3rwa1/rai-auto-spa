import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEMO_MODE } from "./demo-mode";

export { DEMO_MODE } from "./demo-mode";

const BUCKET = "car-media";
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^\d{2}:\d{2}$/;

/** Server-only gate; loaded lazily so this client-reachable module stays browser-safe. */
async function ownerDb() {
  const { ownerDb: gate } = await import("./owner-db.server");
  return gate();
}

// Never send customer manage tokens to the dashboard. Full contact columns stay
// listed so real (non-demo) owners get them; the DEMO_MODE masking below decides
// what actually leaves the server.
const CLIENT_COLS = "id, is_seed, name, phone, email, area, building, floor, water_access";
const BOOKING_COLS = `id, client_id, vehicle_model, photo_url, clean_preview_url, video_url, video_status, plan, colour, style, location_type, map_pin, area, guard_permission, water_needed, date, end_date, full_day, time, total, deposit_paid, status, approval_status, email_status, created_at, subscription_id, customer_phone_e164, detected_country, call_status, call_transcript, call_duration_seconds, call_from_number, call_attempt_id, call_detail, call_updated_at, notes, clients(${CLIENT_COLS})`;

/**
 * Concrete, serializable payload types for the dashboard. TanStack Start validates
 * server-function return types against its serializable rules, so these cannot be
 * `Record<string, unknown>` (values typed `unknown` fail the check). The shapes
 * mirror BOOKING_COLS / CLIENT_COLS exactly; map_pin is the known {"lat","lng"}
 * object the route map reads.
 */
type DashboardClient = {
  id: string;
  is_seed: boolean;
  name: string;
  phone: string;
  email: string | null;
  area: string | null;
  building: string | null;
  floor: string | null;
  water_access: boolean;
};

type DashboardBooking = {
  id: string;
  client_id: string | null;
  vehicle_model: string | null;
  photo_url: string | null;
  clean_preview_url: string | null;
  video_url: string | null;
  video_status: string | null;
  plan: string;
  colour: string | null;
  style: string | null;
  location_type: string;
  map_pin: { lat: number; lng: number } | null;
  area: string | null;
  guard_permission: boolean | null;
  water_needed: boolean | null;
  date: string | null;
  end_date: string | null;
  full_day: boolean;
  time: string | null;
  total: number;
  deposit_paid: boolean;
  status: string;
  approval_status: string | null;
  email_status: string | null;
  created_at: string;
  subscription_id: string | null;
  customer_phone_e164: string | null;
  detected_country: string | null;
  call_status: string | null;
  call_transcript: string | null;
  call_duration_seconds: number | null;
  call_from_number: string | null;
  call_attempt_id: string | null;
  call_detail: string | null;
  call_updated_at: string | null;
  notes: string | null;
  clients: DashboardClient | null;
};

type DashboardSub = {
  id: string;
  client_id: string;
  plan: string;
  active: boolean;
  skip_dates: string[];
  preferred_time: string;
  is_seed: boolean;
  created_at: string;
  clients: DashboardClient | null;
};

type DashboardOffer = {
  id: string;
  date: string;
  time: string;
  area: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  cancelled_booking_id: string;
  clients: DashboardClient | null;
};

/**
 * In the guest sandbox, visitors must not read real customers' contact details.
 * Sample (seed) rows are fictional and stay fully visible for the demo; every
 * other customer gets masked phone/email/name — enforced here, on the server.
 */
function maskClient<
  T extends {
    is_seed?: boolean | null;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  },
>(c: T | null | undefined): T | null | undefined {
  if (!c || !DEMO_MODE || c.is_seed) return c;
  const first = (c.name ?? "").trim().split(/\s+/)[0] ?? "";
  return {
    ...c,
    name: first ? `${first} •••` : "•••",
    phone: (c.phone ?? "").replace(/\d(?=\d{2})/g, "•") || null,
    email: (c.email ?? "").replace(/^(.{2}).*?(@.*)$/, "$1•••$2") || null,
  };
}

type OwnerDb = Awaited<ReturnType<typeof ownerDb>>;

/**
 * Booking-level fields that identify or locate a real customer. In the guest sandbox
 * these are blanked for non-sample rows (call transcripts can contain spoken names and
 * numbers; map pins are home addresses). Sample rows keep everything so the demo works.
 */
const GUEST_HIDDEN_BOOKING_FIELDS = [
  "call_transcript",
  "call_detail",
  "call_from_number",
  "customer_phone_e164",
  "notes",
  "map_pin",
] as const;

/** In the guest sandbox, destructive writes must only touch sample (seed) rows. */
async function assertDemoEditableBooking(sb: OwnerDb, id: string) {
  if (!DEMO_MODE) return;
  const { data } = await sb.from("bookings").select("is_seed").eq("id", id).maybeSingle();
  if (!data?.is_seed)
    throw new Error(
      "Guest sandbox: only sample bookings can be changed here — real customer bookings are protected.",
    );
}

/** Re-runs the Sarvam confirmation call for one booking from the dashboard. */
export const recallBooking = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ bookingId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await ownerDb();
    await assertDemoEditableBooking(sb, data.bookingId);
    const { callBookingAndRecord, CALL_SELECT } = await import("./call-booking.server");
    const { data: b } = await sb
      .from("bookings")
      .select(CALL_SELECT)
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!b) throw new Error("Booking not found.");
    const { requestOrigin } = await import("./booking-core");
    return callBookingAndRecord(b, await requestOrigin());
  });

export const ownerData = createServerFn({ method: "POST" }).handler(async () => {
  const sb = await ownerDb();
  const [b, s] = await Promise.all([
    sb.from("bookings").select(BOOKING_COLS).order("date", { ascending: true }),
    sb.from("subscriptions").select(`*, clients(${CLIENT_COLS})`).order("preferred_time"),
  ]);
  if (b.error || s.error) throw new Error("Could not load dashboard data.");
  const bookings = ((b.data ?? []) as DashboardBooking[]).map((row) => {
    const client = maskClient(row.clients);
    if (!DEMO_MODE || client?.is_seed) return { ...row, clients: client };
    // Real customer row in the guest sandbox: blank the identifying booking fields too.
    const clean: DashboardBooking = { ...row, clients: client ?? null };
    for (const f of GUEST_HIDDEN_BOOKING_FIELDS) clean[f] = null;
    return clean;
  });
  const subs = ((s.data ?? []) as DashboardSub[]).map((row) => ({
    ...row,
    clients: maskClient(row.clients),
  }));
  return { bookings, subs };
});

export const ownerSignedUrls = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        paths: z.array(z.string().regex(/^(uploads|previews|videos|demo)\/[\w.-]+$/)).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!data.paths.length) return {} as Record<string, string>;
    const sb = await ownerDb();
    // `originals/` are the un-blurred uploads; only customer-side code signs those via
    // booking.functions. The dashboard never needs them, so they are not signable here.
    // (Kept out of the regex below.)
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
    if (DEMO_MODE) {
      const { data: s } = await sb
        .from("subscriptions")
        .select("clients(is_seed)")
        .eq("id", data.id)
        .maybeSingle();
      const seed = (s?.clients as unknown as { is_seed?: boolean } | null)?.is_seed;
      if (!seed)
        throw new Error(
          "Guest sandbox: only sample subscriptions can be changed here — real customer subscriptions are protected.",
        );
    }
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
    await assertDemoEditableBooking(sb, data.id);
    await sb.from("bookings").update({ approval_status: data.status }).eq("id", data.id);
    return { ok: true };
  });

/** Cancel a booking and auto-offer the freed slot to up to 3 waitlisted customers (same area + date first). */
export const cancelBooking = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await ownerDb();
    await assertDemoEditableBooking(sb, data.id);
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
      const { error } = await sb.from("waitlist_offers").insert(
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
      `id, date, time, area, status, expires_at, created_at, cancelled_booking_id, clients(${CLIENT_COLS})`,
    )
    .order("created_at", { ascending: false })
    .limit(30);
  return ((data ?? []) as DashboardOffer[]).map((row) => ({
    ...row,
    clients: maskClient(row.clients),
  }));
});

/** Materialise today's subscription visits (same logic as the daily cron). */
export const runSchedule = createServerFn({ method: "POST" }).handler(async () => {
  const sb = await ownerDb();
  const { materialiseDay, istToday } = await import("./schedule.server");
  return materialiseDay(sb, istToday());
});

/** Server-side cooldown so the reset button can't be hammered by visitors. */
const RESET_COOLDOWN_MS = 60_000;

async function claimResetSlot(sb: Awaited<ReturnType<typeof ownerDb>>) {
  const { data: row } = await sb
    .from("demo_state")
    .select("last_reset_at")
    .eq("id", "reset")
    .maybeSingle();
  const last = row ? new Date(row.last_reset_at).getTime() : 0;
  const waited = Date.now() - last;
  if (waited < RESET_COOLDOWN_MS) return Math.ceil((RESET_COOLDOWN_MS - waited) / 1000);
  await sb
    .from("demo_state")
    .upsert({ id: "reset", last_reset_at: new Date().toISOString() }, { onConflict: "id" });
  return 0;
}

export const resetDemo = createServerFn({ method: "POST" }).handler(async () => {
  const sb = await ownerDb();
  const wait = await claimResetSlot(sb);
  if (wait > 0)
    throw new Error(`Demo data was just reset. Please wait ${wait}s before resetting again.`);
  const { seedDemo } = await import("./seed.server");
  return seedOnce(() => seedDemo(sb));
});

/**
 * Single-flight guard: concurrent dashboard loads each call ensureDemoData, and
 * overlapping seed runs used to double every seeded row. Overlapping calls now
 * share one in-flight run; the result promise is reused until it settles.
 */
let seedInFlight: Promise<unknown> | null = null;
function seedOnce<T>(run: () => Promise<T>): Promise<T> {
  if (!seedInFlight) {
    seedInFlight = run().finally(() => {
      seedInFlight = null;
    });
  }
  // Overlapping callers share whatever run is in flight; its concrete shape is
  // the same seed result, so the cast only bridges the shared-storage type.
  return seedInFlight as Promise<T>;
}

/** Auto-seed when the dashboard would otherwise be empty (no seeded bookings today or later). */
export const ensureDemoData = createServerFn({ method: "POST" }).handler(async () => {
  const sb = await ownerDb();
  const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const { count } = await sb
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("is_seed", true)
    .gte("date", today);
  if ((count ?? 0) > 0) return { seeded: false };
  // seedDemo only ever deletes rows it created, so a visitor's in-progress booking survives.
  const { seedDemo } = await import("./seed.server");
  await seedOnce(() => seedDemo(sb));
  return { seeded: true };
});
