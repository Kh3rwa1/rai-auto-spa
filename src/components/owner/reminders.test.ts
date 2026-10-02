import { describe, expect, it } from "vitest";
import type { Booking } from "./shared";
import { addDays, reminderMessage, reminderRows, spokenTime, waLink } from "./reminders-data";

const mk = (o: Partial<Booking> & { id: string }) =>
  ({
    status: "confirmed",
    deposit_paid: true,
    date: "2026-10-03",
    time: "07:00",
    plan: "Essential Wash",
    location_type: "studio",
    area: "MG Marg",
    clients: { name: "Pema Bhutia", phone: "9876543210" },
    ...o,
  }) as unknown as Booking;

describe("reminders", () => {
  it("adds days across a month boundary", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("formats spoken times", () => {
    expect(spokenTime("07:00")).toBe("7 AM");
    expect(spokenTime("14:30")).toBe("2:30 PM");
    expect(spokenTime("12:00")).toBe("12 PM");
  });

  it("picks tomorrow when it has bookings, else the next day that does", () => {
    const a = mk({ id: "a", date: "2026-10-03" });
    const b = mk({ id: "b", date: "2026-10-05" });
    expect(reminderRows([a, b], "2026-10-02").target).toBe("2026-10-03");
    expect(reminderRows([b], "2026-10-02").target).toBe("2026-10-05");
    expect(reminderRows([], "2026-10-02").target).toBeNull();
  });

  it("ignores today, cancelled and lead rows", () => {
    const rows = reminderRows(
      [
        mk({ id: "t", date: "2026-10-02" }),
        mk({ id: "c", status: "cancelled" }),
        mk({ id: "l", status: "lead" }),
      ],
      "2026-10-02",
    );
    expect(rows.rows).toHaveLength(0);
  });

  it("lists unpaid bookings first, then by time", () => {
    const rows = reminderRows(
      [
        mk({ id: "paid-early", time: "07:00", deposit_paid: true }),
        mk({ id: "unpaid-late", time: "10:00", deposit_paid: false }),
        mk({ id: "paid-late", time: "09:00", deposit_paid: true }),
      ],
      "2026-10-02",
    ).rows.map((r) => r.id);
    expect(rows).toEqual(["unpaid-late", "paid-early", "paid-late"]);
  });

  it("asks for the deposit only when it is unpaid", () => {
    expect(reminderMessage(mk({ id: "x", deposit_paid: false }), "tomorrow")).toContain("deposit");
    expect(reminderMessage(mk({ id: "y" }), "tomorrow")).toContain("Reply YES");
  });

  it("builds a WhatsApp link with the 91 prefix, or no recipient when unusable", () => {
    expect(waLink("9876543210", "hi")).toBe("https://wa.me/919876543210?text=hi");
    expect(waLink("98•••••10", "hi")).toBe("https://wa.me/?text=hi");
    expect(waLink(null, "a b")).toBe("https://wa.me/?text=a%20b");
  });
});
