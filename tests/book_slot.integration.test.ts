/**
 * Integration tests for the book_slot() database function against the real backend, using far-future
 * dates and deleting every row they create. Skipped when the service credentials are not present.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

const URL = process.env["SUPABASE_URL"];
const KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const sb = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: false } }) : null;
const TAG = "vitest-book-slot";
if (!sb)
  console.log(
    "\n  integration tests SKIPPED: no service key (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)\n",
  );
const ids: string[] = [];
const day = (n: number, from = new Date()) => {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function lead(status = "confirmed") {
  const { data, error } = await sb!
    .from("bookings")
    .insert({ plan: "Essential Wash", status, vehicle_model: TAG })
    .select("id")
    .single();
  if (error) throw error;
  ids.push(data.id);
  return data.id;
}
async function book(
  date: string,
  time: string,
  mobile: boolean,
  water = true,
  days = 1,
  id?: string,
  status?: string,
) {
  const { data, error } = await sb!.rpc("book_slot", {
    p_booking_id: id ?? (await lead()),
    p_date: date,
    p_time: time,
    p_mobile: mobile,
    p_water: water,
    p_days: days,
    ...(status ? { p_status: status } : {}),
  });
  if (error) throw error;
  return data;
}

describe.skipIf(!sb)("book_slot", () => {
  const D = day(400 + Math.floor(Math.random() * 200));
  afterAll(async () => {
    await sb!.from("blocked_slots").delete().eq("reason", TAG);
    if (ids.length) await sb!.from("bookings").delete().in("id", ids);
  });

  it("rejects past dates and unknown slots", async () => {
    expect(await book(day(-2), "08:00", false)).toBe("past_date");
    expect(await book(D, "06:30", false)).toBe("invalid_slot");
  });

  it("enforces the dry window for vans without water", async () => {
    expect(await book(D, "12:00", true, false)).toBe("dry_window");
  });

  it("refuses blocked slots", async () => {
    await sb!.from("blocked_slots").insert({ date: D, time: "17:00", reason: TAG });
    expect(await book(D, "17:00", false)).toBe("blocked");
  });

  it("never double-books the last van slot when two requests race", async () => {
    const [a, b] = [await lead(), await lead()];
    const r = await Promise.all([
      book(D, "07:00", true, true, 1, a),
      book(D, "07:00", true, true, 1, b),
    ]);
    expect(r.sort()).toEqual(["full", "ok"]);
  });

  it("studio holds exactly two cars per slot", async () => {
    const r = [];
    for (let i = 0; i < 3; i++) r.push(await book(D, "09:00", false));
    expect(r).toEqual(["ok", "ok", "full"]);
  });

  it("two un-confirmed leads racing for the last van slot: exactly one wins", async () => {
    // Both rows start as 'lead', so nothing counts against capacity until book_slot sets the
    // status in the same locked UPDATE. Without p_status this race double-books the van.
    const D3 = day(900 + Math.floor(Math.random() * 100));
    const [a, b] = [await lead("lead"), await lead("lead")];
    const r = await Promise.all([
      book(D3, "08:00", true, true, 1, a, "pending_deposit"),
      book(D3, "08:00", true, true, 1, b, "pending_deposit"),
    ]);
    expect(r.sort()).toEqual(["full", "ok"]);
    const { count } = await sb!
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("date", D3)
      .eq("time", "08:00")
      .eq("location_type", "mobile")
      .in("status", ["confirmed", "pending_deposit", "consultation"]);
    expect(count).toBe(1);
  });

  it("2-day Signature reserves a bay all day on both days", async () => {
    const D2 = day(700 + Math.floor(Math.random() * 100));
    expect(await book(D2, "10:00", false, true, 2)).toBe("ok");
    expect(await book(D2, "10:00", false, true, 2)).toBe("ok");
    expect(await book(day(1, new Date(D2 + "T00:00:00Z")), "15:00", false)).toBe("full");
  });
});
