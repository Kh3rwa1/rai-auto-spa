/**
 * Integration tests for the book_slot() database function. Runs against the real database
 * (SUPABASE_DB_URL) using far-future dates and deletes every row it creates. Skipped without a DB URL.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const run = promisify(execFile);
const DB = process.env["SUPABASE_DB_URL"];
const sql = async (q: string) => (await run("psql", [DB!, "-XAtq", "-v", "ON_ERROR_STOP=1", "-c", q])).stdout.trim();
const day = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const TAG = "vitest-book-slot";
const ids: string[] = [];

async function lead() {
  const id = await sql(`insert into bookings (plan, status, vehicle_model) values ('Essential Wash','confirmed','${TAG}') returning id`);
  ids.push(id);
  return id;
}
const book = (id: string, date: string, time: string, mobile: boolean, water = true, days = 1) =>
  sql(`select book_slot('${id}','${date}','${time}',${mobile},${water},${days})`);

describe.skipIf(!DB)("book_slot", () => {
  const D = day(400 + Math.floor(Math.random() * 200));
  beforeAll(() => sql(`delete from bookings where vehicle_model='${TAG}'`));
  afterAll(async () => {
    await sql(`delete from blocked_slots where reason='${TAG}'`);
    if (ids.length) await sql(`delete from bookings where id in (${ids.map((i) => `'${i}'`).join(",")})`);
  });

  it("rejects past dates and unknown slots", async () => {
    expect(await book(await lead(), day(-2), "08:00", false)).toBe("past_date");
    expect(await book(await lead(), D, "06:30", false)).toBe("invalid_slot");
  });

  it("enforces the dry window for vans without water", async () => {
    expect(await book(await lead(), D, "12:00", true, false)).toBe("dry_window");
  });

  it("refuses blocked slots", async () => {
    await sql(`insert into blocked_slots (date, time, reason) values ('${D}','17:00','${TAG}')`);
    expect(await book(await lead(), D, "17:00", false)).toBe("blocked");
  });

  it("never double-books the van, even when two requests race", async () => {
    const [a, b] = [await lead(), await lead()];
    const results = await Promise.all([book(a, D, "07:00", true), book(b, D, "07:00", true)]);
    expect(results.sort()).toEqual(["full", "ok"]);
  });

  it("studio holds exactly two cars per slot", async () => {
    const r = [];
    for (let i = 0; i < 3; i++) r.push(await book(await lead(), D, "09:00", false));
    expect(r).toEqual(["ok", "ok", "full"]);
  });

  it("2-day Signature reserves a bay all day on both days", async () => {
    const D2 = day(700 + Math.floor(Math.random() * 100));
    expect(await book(await lead(), D2, "10:00", false, true, 2)).toBe("ok");
    expect(await book(await lead(), D2, "10:00", false, true, 2)).toBe("ok");
    const after = new Date(D2 + "T00:00:00Z"); after.setUTCDate(after.getUTCDate() + 1);
    expect(await book(await lead(), after.toISOString().slice(0, 10), "15:00", false)).toBe("full");
  });
});
