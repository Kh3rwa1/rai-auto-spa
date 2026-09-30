import { describe, expect, it } from "vitest";
import { AREAS, MOBILE_FEE, PLANS, WATER_FEE, calcTotal, depositOf, haversineKm, inr, isDryWindow, isPrime, nearestArea } from "./plans";

describe("pricing", () => {
  it("studio total is the plan price", () => expect(calcTotal("detail", false, true)).toBe(PLANS.detail.price));
  it("mobile adds the van fee, water tank only when mobile", () => {
    expect(calcTotal("wash", true, false)).toBe(499 + MOBILE_FEE);
    expect(calcTotal("wash", true, true)).toBe(499 + MOBILE_FEE + WATER_FEE);
  });
  it("deposit is 30% rounded", () => {
    expect(depositOf(1999)).toBe(600);
    expect(depositOf(25000)).toBe(7500);
  });
  it("formats rupees Indian-style", () => expect(inr(25000)).toBe("Rs.25,000"));
});

describe("slot rules", () => {
  it("dry window is 11:00–15:00 inclusive", () => {
    expect(["10:00", "11:00", "15:00", "16:00"].map(isDryWindow)).toEqual([false, true, true, false]);
  });
  it("prime slots are mornings and evenings", () => {
    expect(isPrime("07:00")).toBe(true);
    expect(isPrime("13:00")).toBe(false);
    expect(isPrime("18:00")).toBe(true);
  });
});

describe("geo", () => {
  it("distance is zero to itself and symmetric", () => {
    const [a, b] = [AREAS[0]!, AREAS[1]!];
    expect(haversineKm(a, a)).toBe(0);
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
  });
  it("nearest area snaps to the closest centre", () => expect(nearestArea({ lat: 27.309, lng: 88.598 })).toBe("Tadong"));
});
