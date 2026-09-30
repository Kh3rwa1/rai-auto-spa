import { describe, expect, it } from "vitest";
import { addDays, missingForPay, previewKey, slotUnavailable } from "./booking-rules";

const base = {
  hasBooking: true,
  plan: "wash" as const,
  hasSlot: true,
  mobile: false,
  hasPin: false,
  name: "Pema",
  phone: "+919832012345",
  email: "p@x.in",
};
const slot = {
  date: "2026-10-05",
  time: "08:00",
  today: "2026-10-01",
  nowHour: 9,
  mobile: false,
  water: true,
  capacity: 2,
};

describe("pay gate", () => {
  it("studio booking needs no pin", () => expect(missingForPay(base)).toEqual([]));
  it("mobile booking needs a pin", () =>
    expect(missingForPay({ ...base, mobile: true })).toEqual(["drop a map pin"]));
  it("lists every missing field", () =>
    expect(
      missingForPay({ ...base, hasBooking: false, plan: null, name: "P", phone: "12", email: "x" }),
    ).toHaveLength(5));
});

describe("slot availability", () => {
  it("free future slot is available", () => expect(slotUnavailable(slot).disabled).toBe(false));
  it("past date and earlier today are unavailable", () => {
    expect(slotUnavailable({ ...slot, date: "2026-09-30" }).past).toBe(true);
    expect(slotUnavailable({ ...slot, date: slot.today, time: "09:00" }).past).toBe(true);
    expect(slotUnavailable({ ...slot, date: slot.today, time: "10:00" }).past).toBe(false);
  });
  it("mobile without water blocks the dry window only", () => {
    expect(slotUnavailable({ ...slot, mobile: true, water: false, time: "12:00" }).dry).toBe(true);
    expect(slotUnavailable({ ...slot, mobile: false, water: false, time: "12:00" }).dry).toBe(
      false,
    );
  });
  it("full and blocked slots are unavailable", () => {
    expect(
      slotUnavailable({ ...slot, state: { taken: 2, blocked: null, travelMin: null } }).full,
    ).toBe(true);
    expect(
      slotUnavailable({ ...slot, state: { taken: 0, blocked: "Water shortage", travelMin: null } })
        .disabled,
    ).toBe(true);
  });
});

describe("helpers", () => {
  it("addDays crosses months", () => expect(addDays("2026-09-30", 2)).toBe("2026-10-02"));
  it("preview key only varies by colour/style for Signature", () => {
    expect(previewKey("wash", "Red", "X")).toBe("wash|");
    expect(previewKey("signature", "Red", "X")).toBe("signature|Red|X");
  });
});
