/**
 * Integration tests for the book_slot() / confirm_demo_payment() database functions against
 * the real backend, using far-future dates and deleting every row they create. Skipped when
 * the service credentials are not present.
 *
 * NOTE: these tests require migration 0012_slot_duration_and_atomic_payment to be applied —
 * until then book_slot has no p_slots parameter and confirm_demo_payment does not exist, so
 * the duration and payment tests fail loudly by design. They are the verification harness
 * for that migration.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

const URL = process.env["SUPABASE_URL"];
const KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const sb = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: false } }) : null;
const TAG = "vitest-book-slot";
if (!sb)
  console.log(
    "\n  integration tests SKIPPED: no service key (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)\n  (they also require migration 0012_slot_duration_and_atomic_payment to be applied)\n",
  );
const ids: string[] = [];
const clientIds: string[] = [];
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
  slots = 1,
) {
  const { data, error } = await sb!.rpc("book_slot", {
    p_booking_id: id ?? (await lead()),
    p_date: date,
    p_time: time,
    p_mobile: mobile,
    p_water: water,
    p_days: days,
    ...(status ? { p_status: status } : {}),
    p_slots: slots,
  });
  if (error) throw error;
  return data;
}
/** A payable booking (slot + details + total) for the payment tests. */
async function payable() {
  const { data: client, error: ce } = await sb!
    .from("clients")
    .insert({ name: "Vitest Pay", phone: "+919000000001" })
    .select("id")
    .single();
  if (ce) throw ce;
  clientIds.push(client!.id);
  const { data: bk, error: be } = await sb!
    .from("bookings")
    .insert({
      plan: "Essential Wash",
      vehicle_model: TAG,
      total: 699,
      client_id: client!.id,
      status: "lead",
    })
    .select("id, total")
    .single();
  if (be) throw be;
  ids.push(bk!.id);
  return { id: bk!.id, total: bk!.total as number };
}

describe.skipIf(!sb)("book_slot", () => {
  const D = day(400 + Math.floor(Math.random() * 200));
  afterAll(async () => {
    await sb!.from("blocked_slots").delete().eq("reason", TAG);
    if (ids.length) await sb!.from("bookings").delete().in("id", ids);
    if (clientIds.length) await sb!.from("clients").delete().in("id", clientIds);
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

  // --- Duration: every occupied hour of BOTH existing and proposed bookings ---------

  it("existing two-hour Detail blocks the next hour for a Wash (order A)", async () => {
    const DA = day(600 + Math.floor(Math.random() * 100));
    // Both studio bays take a 2-hour Full Detail at 09:00 (occupies 09:00 + 10:00).
    expect(await book(DA, "09:00", false, true, 1, undefined, undefined, 2)).toBe("ok");
    expect(await book(DA, "09:00", false, true, 1, undefined, undefined, 2)).toBe("ok");
    // A Wash at 10:00 overlaps the second hour of both Details — rejected.
    expect(await book(DA, "10:00", false)).toBe("full");
    // A Wash at 11:00 is adjacent, non-overlapping — accepted.
    expect(await book(DA, "11:00", false)).toBe("ok");
  });

  it("existing Washes at 10:00 block a proposed Detail starting 09:00 (order B, studio)", async () => {
    const DB = day(800 + Math.floor(Math.random() * 100));
    expect(await book(DB, "10:00", false)).toBe("ok");
    expect(await book(DB, "10:00", false)).toBe("ok");
    // A 2-hour Detail at 09:00 would occupy 09:00 AND 10:00 — both bays are busy at 10:00.
    expect(await book(DB, "09:00", false, true, 1, undefined, undefined, 2)).toBe("full");
  });

  it("one Wash at 10:00 leaves room for a 2-hour Detail at 09:00 (pooled bays)", async () => {
    const DC = day(810 + Math.floor(Math.random() * 100));
    expect(await book(DC, "10:00", false)).toBe("ok");
    // At 10:00: 1 wash + 1 Detail = exactly the 2-bay capacity — allowed.
    expect(await book(DC, "09:00", false, true, 1, undefined, undefined, 2)).toBe("ok");
  });

  it("mobile van: a Wash at 10:00 blocks a 2-hour Detail starting 09:00; adjacent slots work", async () => {
    const DM = day(850 + Math.floor(Math.random() * 100));
    expect(await book(DM, "10:00", true)).toBe("ok");
    expect(await book(DM, "09:00", true, true, 1, undefined, undefined, 2)).toBe("full");
    expect(await book(DM, "11:00", true)).toBe("ok");
  });

  it("closing time: a 2-hour service cannot start at 18:00, can start at 17:00", async () => {
    expect(await book(day(950), "18:00", false, true, 1, undefined, undefined, 2)).toBe(
      "invalid_slot",
    );
    const DX = day(960 + Math.floor(Math.random() * 20));
    expect(await book(DX, "17:00", false, true, 1, undefined, undefined, 2)).toBe("ok");
    // The 17:00 Detail occupies one bay-unit at 18:00; a Wash fits in the other bay.
    expect(await book(DX, "18:00", false)).toBe("ok");
  });

  it("1-hour services behave exactly as before (regression)", async () => {
    const DR = day(870 + Math.floor(Math.random() * 100));
    expect(await book(DR, "09:00", false)).toBe("ok");
    expect(await book(DR, "09:00", false)).toBe("ok");
    expect(await book(DR, "09:00", false)).toBe("full");
    expect(await book(DR, "10:00", false)).toBe("ok");
  });

  // --- Mobile water restriction across EVERY occupied hour -------------------------

  it("mobile water rule covers every occupied hour of a 2-hour Detail", async () => {
    const DW = day(970 + Math.floor(Math.random() * 100));
    // Detail at 10:00 occupies 10:00 AND 11:00 — 11:00 is a dry window without water.
    expect(await book(DW, "10:00", true, false, 1, undefined, undefined, 2)).toBe("dry_window");
    // Detail at 09:00 occupies 09:00 + 10:00 — both outside the dry window: allowed.
    expect(await book(DW, "09:00", true, false, 1, undefined, undefined, 2)).toBe("ok");
    // Detail at 16:00 occupies 16:00 + 17:00 — outside the dry window: allowed.
    expect(await book(DW, "16:00", true, false, 1, undefined, undefined, 2)).toBe("ok");
    // Single-hour behaviour unchanged: 12:00 without water is still rejected.
    expect(await book(DW, "12:00", true, false)).toBe("dry_window");
  });

  // --- Old callers that omit p_slots get the duration derived ----------------------

  it("omitted p_slots derives the 2-hour duration from the row's plan", async () => {
    const DD = day(980 + Math.floor(Math.random() * 100));
    const mkDetail = async () => {
      const { data, error } = await sb!
        .from("bookings")
        .insert({ plan: "Full Detail", status: "lead", vehicle_model: TAG })
        .select("id")
        .single();
      if (error) throw error;
      ids.push(data.id);
      return data.id;
    };
    // Two legacy-style calls with NO p_slots: both Details must occupy two hours.
    const d1 = await mkDetail();
    const d2 = await mkDetail();
    expect(await book(DD, "09:00", false, true, 1, d1)).toBe("ok");
    expect(await book(DD, "09:00", false, true, 1, d2)).toBe("ok");
    const { data: row } = await sb!
      .from("bookings")
      .select("duration_slots")
      .eq("id", d1)
      .maybeSingle();
    expect(row?.duration_slots).toBe(2);
    // Both bays are occupied at 10:00 by the two Details — a Wash is rejected.
    expect(await book(DD, "10:00", false)).toBe("full");
  });

  it("omitted p_slots derives 2 hours for the mobile van too", async () => {
    const DE = day(990 + Math.floor(Math.random() * 100));
    const { data, error } = await sb!
      .from("bookings")
      .insert({ plan: "Full Detail", status: "lead", vehicle_model: TAG })
      .select("id")
      .single();
    if (error) throw error;
    ids.push(data.id);
    expect(await book(DE, "09:00", true, true, 1, data.id)).toBe("ok");
    // The van is busy through 10:00 — a Wash at 10:00 is rejected.
    expect(await book(DE, "10:00", true)).toBe("full");
  });

  // --- Explicit payable state and invalid inputs -----------------------------------

  it("an untimed hold (held_at NULL) is not payable", async () => {
    const DU = day(995 + Math.floor(Math.random() * 20));
    const bk = await payable();
    // Create a pending_deposit hold WITHOUT held_at (bypassing book_slot), like a
    // legacy row: no stamp means no expiry contract, so payment must be refused.
    const { error } = await sb!
      .from("bookings")
      .update({ date: DU, time: "09:00", status: "pending_deposit" })
      .eq("id", bk.id);
    if (error) throw error;
    const { data: code } = await sb!.rpc("confirm_demo_payment", {
      p_booking_id: bk.id,
      p_method: "upi",
      p_amount: Math.round(bk.total * 0.3),
    });
    expect(code).toBe("untimed_hold");
    const { data: after } = await sb!
      .from("bookings")
      .select("deposit_paid")
      .eq("id", bk.id)
      .maybeSingle();
    expect(after?.deposit_paid).toBe(false);
  });

  it("a cancelled booking cannot be paid, even after being paid once", async () => {
    const DV = day(997 + Math.floor(Math.random() * 20));
    const bk = await payable();
    expect(await book(DV, "09:00", false, true, 1, bk.id, "pending_deposit")).toBe("ok");
    const amount = Math.round(bk.total * 0.3);
    const { data: first } = await sb!.rpc("confirm_demo_payment", {
      p_booking_id: bk.id,
      p_method: "upi",
      p_amount: amount,
    });
    expect(first).toBe("ok");
    // Owner cancels the paid booking (allowed by the dashboard for confirmed rows).
    await sb!.from("bookings").update({ status: "cancelled" }).eq("id", bk.id);
    const { data: second } = await sb!.rpc("confirm_demo_payment", {
      p_booking_id: bk.id,
      p_method: "upi",
      p_amount: amount,
    });
    expect(second).toBe("cancelled");
  });

  it("rejects NULL and invalid inputs with named codes", async () => {
    // NULL booking id / date / days / flags on book_slot.
    await expect(
      sb!.rpc("book_slot", {
        p_booking_id: null,
        p_date: day(900),
        p_time: "09:00",
        p_mobile: false,
        p_water: true,
      }),
    ).resolves.toBe("invalid_slot");
    await expect(
      sb!.rpc("book_slot", {
        p_booking_id: await lead(),
        p_date: null,
        p_time: "09:00",
        p_mobile: false,
        p_water: true,
      }),
    ).resolves.toBe("invalid_slot");
    await expect(
      sb!.rpc("book_slot", {
        p_booking_id: await lead(),
        p_date: day(900),
        p_time: "09:00",
        p_mobile: false,
        p_water: true,
        p_days: 0,
      }),
    ).resolves.toBe("invalid_slot");
    await expect(
      sb!.rpc("book_slot", {
        p_booking_id: await lead(),
        p_date: day(900),
        p_time: "09:00",
        p_mobile: null,
        p_water: true,
      }),
    ).resolves.toBe("invalid_slot");
    // NULL method / NULL amount on payment.
    const bk = await payable();
    expect(
      (
        await sb!.rpc("confirm_demo_payment", {
          p_booking_id: bk.id,
          p_method: null,
          p_amount: 210,
        })
      ).data,
    ).toBe("invalid_method");
    expect(
      (
        await sb!.rpc("confirm_demo_payment", {
          p_booking_id: bk.id,
          p_method: "upi",
          p_amount: null,
        })
      ).data,
    ).toBe("invalid_amount");
  });

  it("payment and reservation share the resource lock: after a paid booking, the slot is full", async () => {
    const DY = day(999 + Math.floor(Math.random() * 20));
    const bk = await payable();
    expect(await book(DY, "09:00", false, true, 1, bk.id, "pending_deposit")).toBe("ok");
    const { data: paidCode } = await sb!.rpc("confirm_demo_payment", {
      p_booking_id: bk.id,
      p_method: "card",
      p_amount: Math.round(bk.total * 0.3),
    });
    expect(paidCode).toBe("ok");
    // The reservation path must see the payment: the van slot is now taken.
    expect(await book(DY, "09:00", true)).toBe("full");
  });

  it("book_slot refuses cancelled bookings and paid-to-pending downgrades", async () => {
    const DZ1 = day(1001 + Math.floor(Math.random() * 20));
    const cancelled = await lead("cancelled");
    expect(await book(DZ1, "09:00", false, true, 1, cancelled)).toBe("cancelled");
    const DZ2 = day(1002 + Math.floor(Math.random() * 20));
    const paidRow = await lead("confirmed");
    await sb!.from("bookings").update({ deposit_paid: true }).eq("id", paidRow);
    expect(await book(DZ2, "09:00", false, true, 1, paidRow, "pending_deposit")).toBe(
      "invalid_status",
    );
    // Legitimate paid rescheduling (no status argument) stays allowed.
    expect(await book(DZ2, "09:00", false, true, 1, paidRow)).toBe("ok");
  });

  // --- Atomic, idempotent, expiry-checked payment (confirm_demo_payment) -----------

  it("confirm_demo_payment: flip + payment row in one transaction, idempotent when simultaneous", async () => {
    const DP = day(880 + Math.floor(Math.random() * 100));
    const bk = await payable();
    expect(await book(DP, "09:00", false, true, 1, bk.id, "pending_deposit")).toBe("ok");
    const pay = () =>
      sb!.rpc("confirm_demo_payment", {
        p_booking_id: bk.id,
        p_method: "upi",
        p_amount: Math.round(bk.total * 0.3),
      });
    const [r1, r2] = await Promise.all([pay(), pay()]);
    const codes = [r1.data, r2.data].sort();
    expect(codes).toEqual(["already_paid", "ok"]);
    const { count } = await sb!
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", bk.id);
    expect(count).toBe(1);
    const { data: after } = await sb!
      .from("bookings")
      .select("deposit_paid, status")
      .eq("id", bk.id)
      .maybeSingle();
    expect(after?.deposit_paid).toBe(true);
    expect(after?.status).toBe("confirmed");
  });

  it("an expired hold cannot be paid and its slot is free again", async () => {
    const DQ = day(890 + Math.floor(Math.random() * 100));
    const bk = await payable();
    expect(await book(DQ, "09:00", false, true, 1, bk.id, "pending_deposit")).toBe("ok");
    await sb!
      .from("bookings")
      .update({ held_at: new Date(Date.now() - 25 * 60_000).toISOString() })
      .eq("id", bk.id);
    const { data: code } = await sb!.rpc("confirm_demo_payment", {
      p_booking_id: bk.id,
      p_method: "card",
      p_amount: Math.round(bk.total * 0.3),
    });
    expect(code).toBe("hold_expired");
    const { data: after } = await sb!
      .from("bookings")
      .select("deposit_paid")
      .eq("id", bk.id)
      .maybeSingle();
    expect(after?.deposit_paid).toBe(false);
    const { count } = await sb!
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", bk.id);
    expect(count).toBe(0);
    // The expired hold no longer counts: someone else can take the slot.
    expect(await book(DQ, "09:00", false)).toBe("ok");
  });
});
