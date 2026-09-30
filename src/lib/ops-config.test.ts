import { describe, expect, it } from "vitest";
import { AREAS } from "./plans";
import { areaPin, litresFor, planRoute } from "./ops-config";

describe("route planner", () => {
  it("empty route is zero km", () => expect(planRoute([]).km).toBe(0));
  it("visits every stop once, nearest first, and beats separate round trips", () => {
    const stops = AREAS.slice(1).map((a) => ({ ...a }));
    const r = planRoute(stops);
    expect(r.order).toHaveLength(stops.length);
    expect(new Set(r.order.map((s) => s.name)).size).toBe(stops.length);
    expect(r.order[0]!.name).toBe("Development Area");
    expect(r.km).toBeLessThanOrEqual(r.naive);
  });
  it("area pins are deterministic and near the centre", () => {
    const a = areaPin("Tadong", "abc");
    expect(areaPin("Tadong", "abc")).toEqual(a);
    expect(Math.abs(a.lat - 27.3082)).toBeLessThan(0.004);
  });
});

describe("water use", () => {
  it("maps plans to litres", () => {
    expect(litresFor("Full Detail")).toBe(60);
    expect(litresFor("Signature Super Design")).toBe(20);
    expect(litresFor("Daily Wash")).toBe(30);
    expect(litresFor("Essential Wash")).toBe(40);
  });
});
