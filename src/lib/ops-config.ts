import { AREAS, STUDIO, haversineKm } from "./plans";

/**
 * Every constant behind the owner dashboard numbers lives here so the stats are explainable.
 * The same values are rendered in the stat tooltips.
 */
export const OPS = {
  /** Straight-line → real road distance on Gangtok hill roads (already applied inside haversineKm). */
  roadMultiplier: 1.6,
  /** Van fuel use in litres per km (≈10 km/L for a loaded Maruti Eeco on hills). */
  fuelLitresPerKm: 0.1,
  /** Water per job in litres, by plan. */
  litresPerWash: { essential: 40, detail: 60, signature: 20, daily: 30 },
  /** Price per subscription visit (prepaid monthly, so it's never "at risk"). */
  dailyWashPrice: 199,
  /** Hours a waitlist offer stays open. */
  offerMinutes: 15,
  /** Max waitlisted customers offered a freed slot. */
  offerFanout: 3,
} as const;

export function litresFor(plan: string) {
  const p = plan.toLowerCase();
  if (p.startsWith("full") || p === "detail") return OPS.litresPerWash.detail;
  if (p.startsWith("signature")) return OPS.litresPerWash.signature;
  if (p.startsWith("daily")) return OPS.litresPerWash.daily;
  return OPS.litresPerWash.essential;
}

export type Stop = { lat: number; lng: number; label: string; area: string };

/** Nearest-neighbour van route from the studio and back; `naive` = one separate round trip per stop. */
export function planRoute<T extends { lat: number; lng: number }>(stops: T[]) {
  const left = [...stops];
  const order: T[] = [];
  let cur = { lat: STUDIO.lat, lng: STUDIO.lng };
  let km = 0;
  while (left.length) {
    let bi = 0;
    left.forEach((s, i) => haversineKm(cur, s) < haversineKm(cur, left[bi]!) && (bi = i));
    const next = left.splice(bi, 1)[0];
    km += haversineKm(cur, next);
    cur = next;
    order.push(next);
  }
  km += haversineKm(cur, STUDIO);
  const naive = stops.reduce((a, s) => a + 2 * haversineKm(STUDIO, s), 0);
  return { order, km, naive };
}

/** Deterministic pin near an area's centre for customers without a saved map pin. */
export function areaPin(area: string | null | undefined, seed: string) {
  const a = AREAS.find((x) => x.name === area) ?? AREAS[0];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  const j = (n: number) => (((h >> n) & 0xff) / 255 - 0.5) * 0.006;
  return { lat: a.lat + j(0), lng: a.lng + j(8) };
}
