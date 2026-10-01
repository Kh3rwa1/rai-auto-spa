import { describe, expect, it } from "vitest";
import { litresToLoad, needsVanWater, planRouteByTime } from "./ops-config";
import { buildSeedSubscriptions } from "./seed.server";

const near = (dLat: number, dLng: number) => ({
  lat: 27.3314 + dLat,
  lng: 88.6138 + dLng,
});

describe("planRouteByTime", () => {
  it("returns stops in non-decreasing time order regardless of input order", () => {
    const stops = [
      { ...near(0.02, 0.01), label: "A", area: "x", time: "09:00" },
      { ...near(0.01, 0.02), label: "B", area: "x", time: "07:00" },
      { ...near(0.03, 0.03), label: "C", area: "x", time: "08:30" },
      { ...near(0.004, 0.004), label: "D", area: "x", time: "06:30" },
    ];
    const { order, km, naive } = planRouteByTime(stops);
    const times = order.map((s) => s.time ?? "");
    expect(times).toEqual([...times].sort());
    expect(times).toEqual(["06:30", "07:00", "08:30", "09:00"]);
    expect(km).toBeGreaterThan(0);
    expect(naive).toBeGreaterThanOrEqual(km);
  });

  it("breaks same-time ties by proximity from the previous stop (first from the studio)", () => {
    const close = { ...near(0.001, 0.0), label: "close", area: "x", time: "07:00" };
    const far = { ...near(0.05, 0.05), label: "far", area: "x", time: "07:00" };
    const { order } = planRouteByTime([far, close]);
    expect(order.map((s) => s.label)).toEqual(["close", "far"]);
  });

  it("keeps later-time stops after the earliest-time group even when they are nearer", () => {
    const earlyFar = { ...near(0.06, 0.0), label: "early-far", area: "x", time: "06:30" };
    const lateNear = { ...near(0.001, 0.0), label: "late-near", area: "x", time: "09:00" };
    const { order } = planRouteByTime([lateNear, earlyFar]);
    expect(order.map((s) => s.label)).toEqual(["early-far", "late-near"]);
  });

  it("handles stops without a time by putting them last", () => {
    const stops = [
      { ...near(0.01, 0.0), label: "timed", area: "x", time: "07:00" },
      { ...near(0.02, 0.0), label: "no-time", area: "x", time: null },
    ];
    const { order } = planRouteByTime(stops);
    expect(order.map((s) => s.label)).toEqual(["timed", "no-time"]);
  });
});

describe("needsVanWater / litresToLoad", () => {
  it("counts only mobile jobs without a tap", () => {
    expect(needsVanWater({ location_type: "mobile", water_needed: true })).toBe(true);
    expect(
      needsVanWater({
        location_type: "mobile",
        water_needed: null,
        clients: { water_access: false },
      }),
    ).toBe(true);
    expect(
      needsVanWater({
        location_type: "mobile",
        water_needed: null,
        clients: { water_access: true },
      }),
    ).toBe(false);
    expect(needsVanWater({ location_type: "mobile", water_needed: false })).toBe(false);
    expect(needsVanWater({ location_type: "studio", water_needed: true })).toBe(false);
  });

  it("sums litres only for mobile no-tap jobs (studio and own-tap jobs add 0)", () => {
    const litres = litresToLoad([
      { plan: "Essential Wash", location_type: "mobile", water_needed: true }, // 40
      {
        plan: "Daily Wash",
        location_type: "mobile",
        water_needed: null,
        clients: { water_access: false },
      }, // 30
      { plan: "Full Detail", location_type: "mobile", water_needed: true }, // 60
      { plan: "Essential Wash", location_type: "mobile", water_needed: false }, // own tap → 0
      { plan: "Full Detail", location_type: "studio", water_needed: true }, // studio → 0
    ]);
    expect(litres).toBe(130);
  });

  it("returns 0 for an empty or all-studio day", () => {
    expect(litresToLoad([])).toBe(0);
    expect(
      litresToLoad([{ plan: "Essential Wash", location_type: "studio", water_needed: true }]),
    ).toBe(0);
  });
});

describe("buildSeedSubscriptions", () => {
  const clients = Array.from({ length: 8 }, (_, i) => ({ id: `c${i + 1}` }));
  const subs = buildSeedSubscriptions(clients);

  it("creates one subscription per client — never two on the same client", () => {
    expect(subs.length).toBe(clients.length);
    const ids = subs.map((s) => s.client_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("places at most 1 visit per half-hour slot across 06:30–10:00", () => {
    const byTime = new Map<string, number>();
    for (const s of subs) {
      expect(s.preferred_time >= "06:30").toBe(true);
      expect(s.preferred_time <= "10:00").toBe(true);
      byTime.set(s.preferred_time, (byTime.get(s.preferred_time) ?? 0) + 1);
    }
    for (const n of byTime.values()) expect(n).toBeLessThanOrEqual(1);
    // One van, one stop at a time: all 8 are active.
    const active = subs.filter((s) => s.active).length;
    expect(active).toBe(8);
  });

  it("flags every seeded subscription and plans them as Daily Wash", () => {
    for (const s of subs) {
      expect(s.is_seed).toBe(true);
      expect(s.plan).toBe("Daily Wash");
      expect(s.skip_dates).toEqual([]);
    }
  });
});
