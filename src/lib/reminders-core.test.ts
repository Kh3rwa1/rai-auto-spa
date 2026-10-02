import { describe, expect, it } from "vitest";
import { addDaysIso, buildTemplateData, isDeliverable, tomorrowIst, type ReminderRow } from "./reminders-core";

const row = (o: Partial<ReminderRow> = {}): ReminderRow => ({
  id: "b1",
  plan: "Full Detail",
  date: "2026-10-03",
  time: "07:00",
  location_type: "studio",
  area: "MG Marg",
  total: 1999,
  deposit_paid: true,
  status: "confirmed",
  vehicle_model: "Swift",
  clients: { name: "Pema Bhutia", email: "pema@example.com", is_seed: false },
  ...o,
});
const dep = (t: number) => Math.round(t * 0.3);

describe("reminders-core", () => {
  it("rolls dates across month ends", () => {
    expect(addDaysIso("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("computes tomorrow in IST, not UTC", () => {
    expect(tomorrowIst(Date.UTC(2026, 9, 2, 2, 0))).toBe("2026-10-03");
    // 20:00 UTC on 2 Oct is already 3 Oct in Gangtok
    expect(tomorrowIst(Date.UTC(2026, 9, 2, 20, 0))).toBe("2026-10-04");
  });

  it("skips sample customers, missing or bad emails, and inactive statuses", () => {
    expect(isDeliverable(row())).toBe(true);
    expect(isDeliverable(row({ clients: { name: "A", email: "a@b.com", is_seed: true } }))).toBe(false);
    expect(isDeliverable(row({ clients: { name: "A", email: null } }))).toBe(false);
    expect(isDeliverable(row({ clients: { name: "A", email: "not-an-email" } }))).toBe(false);
    expect(isDeliverable(row({ clients: null }))).toBe(false);
    expect(isDeliverable(row({ status: "cancelled" }))).toBe(false);
    expect(isDeliverable(row({ status: "lead" }))).toBe(false);
    expect(isDeliverable(row({ status: "pending_deposit" }))).toBe(true);
  });

  it("shows the balance when the deposit is paid and asks for it when it is not", () => {
    const paid = buildTemplateData(row(), dep);
    expect(paid.depositPending).toBe(false);
    expect(paid.balance).toBe(1999 - 600);
    const unpaid = buildTemplateData(row({ deposit_paid: false }), dep);
    expect(unpaid.depositPending).toBe(true);
    expect(unpaid.balance).toBeUndefined();
  });

  it("uses a first name, spoken time and the right place", () => {
    const d = buildTemplateData(row(), dep);
    expect(d.name).toBe("Pema");
    expect(d.time).toBe("7 AM");
    expect(d.location).toBe("Studio, MG Marg, Gangtok");
    expect(buildTemplateData(row({ location_type: "mobile", area: "Tadong" }), dep).location).toBe("At your place, Tadong");
  });
});
