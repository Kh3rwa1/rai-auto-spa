import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AREAS, calcTotal, PLANS } from "./plans";

type DB = SupabaseClient<Database>;
const BUCKET = "car-media";

const FIRST = ["Pema", "Karma", "Sonam", "Tenzing", "Dawa", "Nima", "Pasang", "Mingma", "Ang", "Lhamu", "Anjali", "Rohit", "Priya", "Bikash", "Sunita", "Suraj", "Dechen", "Tshering", "Yangchen", "Kiran"];
const LAST = ["Bhutia", "Lepcha", "Tamang", "Sherpa", "Rai", "Gurung", "Pradhan", "Chettri", "Subba", "Limboo"];
const BUILDINGS = ["Hilltop Residency", "Kanchen View Apts", "Rinchen Heights", "Tashi Enclave", "Namgyal Towers", "Zero Point Flats", "Palzor Court", "Denzong Homes"];
const TIMES = ["06:30", "07:00", "07:30", "08:00", "08:30"];
const areaNames = ["Tadong", "MG Marg", "Deorali", "Development Area"] as const;

const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const plusDays = (d: string, n: number) => new Date(new Date(d).getTime() + n * 86400000).toISOString().slice(0, 10);
const jitter = (i: number) => ((i * 7919) % 100) / 10000 - 0.005;
function pinFor(area: string, i: number) {
  const a = AREAS.find((x) => x.name === area) ?? AREAS[0]!;
  return { lat: a.lat + jitter(i), lng: a.lng + jitter(i + 13), parking: `P-${(i % 20) + 1}` };
}

/** Copies a bundled sample photo into private storage once; later resets reuse it. */
async function uploadSample(sb: DB, origin: string, name: string, existing: Set<string>) {
  const path = `demo/${name}`;
  if (existing.has(name)) return path;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${origin}/samples/${name}`);
    if (!res.ok) continue;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const up = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (!up.error) return path;
  }
  console.error("seed: sample upload failed", name);
  return null;
}

/** Idempotent: wipes demo tables and recreates a fresh, today-relative dataset (IST). */
export async function seedDemo(sb: DB) {
  const started = Date.now();
  const { getRequest } = await import("@tanstack/react-start/server");
  const origin = new URL(getRequest()?.url ?? "http://localhost:8080").origin;
  const today = istToday();

  const all = (t: "waitlist_offers" | "waitlist" | "subscriptions" | "payments" | "bookings" | "clients" | "blocked_slots") =>
    sb.from(t).delete().not("id", "is", null);
  // Children first (in parallel), then parents — respects foreign keys while staying fast.
  await Promise.all([all("waitlist_offers"), all("waitlist"), all("subscriptions"), all("payments"), all("blocked_slots")]);
  await all("bookings");
  await all("clients");

  const { data: listed } = await sb.storage.from(BUCKET).list("demo");
  const existing = new Set((listed ?? []).map((f) => f.name));
  const imgs = await Promise.all(
    ["swift.jpg", "thar.jpg", "creta.jpg", "thar-wrap.jpg", "creta-wrap.jpg"].map((n) => uploadSample(sb, origin, n, existing)),
  );
  const [swift, thar, creta, tharWrap, cretaWrap] = imgs.map((x) => x ?? null) as [string | null, string | null, string | null, string | null, string | null];

  // 40 daily-wash clients + 9 booking clients
  const clients = Array.from({ length: 49 }, (_, i) => {
    const area = areaNames[i % 4]!;
    return {
      name: `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`,
      phone: `+91 9${String(733000000 + i * 1379).padStart(9, "0")}`,
      email: `demo${i + 1}@example.com`,
      building: BUILDINGS[i % BUILDINGS.length]!,
      floor: String((i % 6) + 1),
      area,
      water_access: i % 5 !== 0,
    };
  });
  const { data: cRows, error: ce } = await sb.from("clients").insert(clients).select("id, area");
  if (ce || !cRows) throw new Error("Seeding clients failed.");
  const subsClients = cRows.slice(0, 40);
  const bookClients = cRows.slice(40);

  const subsP = sb.from("subscriptions").insert(
    subsClients.map((c, i) => ({ client_id: c.id, plan: "Daily Wash", active: i % 13 !== 12, preferred_time: TIMES[i % TIMES.length]!, skip_dates: [] })),
  );

  type Row = Database["public"]["Tables"]["bookings"]["Insert"];
  const mk = (i: number, r: Partial<Row> & { plan: Row["plan"] }): Row => {
    const c = bookClients[i]!;
    const mobile = r.location_type !== "studio";
    return {
      client_id: c.id,
      location_type: mobile ? "mobile" : "studio",
      area: c.area,
      map_pin: mobile ? pinFor(c.area ?? "MG Marg", i) : { lat: 27.3314, lng: 88.6138 },
      guard_permission: true,
      water_needed: false,
      ...r,
    };
  };
  const w = PLANS.wash.name;
  const d = PLANS.detail.name;
  const s = PLANS.signature.name;
  const bookings: Row[] = [
    mk(0, { vehicle_model: "Swift", plan: w, date: today, time: "08:00", total: calcTotal("wash", true, false), deposit_paid: true, status: "confirmed", photo_url: swift }),
    mk(1, { vehicle_model: "Baleno", plan: d, date: today, time: "09:00", total: calcTotal("detail", true, false), deposit_paid: true, status: "confirmed", area: "MG Marg" }),
    mk(2, { vehicle_model: "Thar", plan: w, date: plusDays(today, 1), time: "07:00", total: calcTotal("wash", true, false), deposit_paid: false, status: "pending_deposit", photo_url: thar }),
    mk(3, { vehicle_model: "Innova", plan: d, date: plusDays(today, 1), time: "17:00", total: calcTotal("detail", false, false), deposit_paid: true, status: "confirmed", location_type: "studio" }),
    mk(4, { vehicle_model: "Creta", plan: w, date: plusDays(today, 2), time: "10:00", total: calcTotal("wash", true, true), water_needed: true, deposit_paid: false, status: "pending_deposit", photo_url: creta }),
    mk(5, { vehicle_model: "Thar", plan: s, colour: "Electric Blue", style: "Racing Stripes", date: plusDays(today, 3), end_date: plusDays(today, 4), full_day: true, time: "07:00", total: PLANS.signature.price, deposit_paid: true, status: "consultation", approval_status: "pending", location_type: "studio", photo_url: thar, clean_preview_url: tharWrap }),
    mk(6, { vehicle_model: "Creta", plan: s, colour: "Matte Black", style: "Carbon Hood", date: plusDays(today, 5), end_date: plusDays(today, 6), full_day: true, time: "07:00", total: PLANS.signature.price, deposit_paid: true, status: "consultation", approval_status: "pending", location_type: "studio", photo_url: creta, clean_preview_url: cretaWrap }),
    // two abandoned uploads for the Leads inbox
    mk(7, { vehicle_model: "Swift", plan: d, total: 0, status: "lead", photo_url: swift, client_id: null, area: null, map_pin: null }),
    mk(8, { vehicle_model: "Creta", plan: w, total: 0, status: "lead", photo_url: creta, client_id: null, area: null, map_pin: null }),
  ];
  const [{ error: be }] = await Promise.all([
    sb.from("bookings").insert(bookings, { defaultToNull: false }),
    subsP,
    sb.from("waitlist").insert(
      subsClients.slice(0, 6).map((c, i) => ({ client_id: c.id, area: c.area ?? "MG Marg", date: plusDays(today, i % 3) })),
    ),
  ]);
  if (be) console.error("seed bookings", be);
  if (be) throw new Error("Seeding bookings failed.");

  const { materialiseDay } = await import("./schedule.server");
  await materialiseDay(sb, today);
  return { ok: true, ms: Date.now() - started };
}
