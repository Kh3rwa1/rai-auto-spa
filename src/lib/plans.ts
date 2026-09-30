export type PlanId = "wash" | "detail" | "signature";

export const PLANS: Record<
  PlanId,
  { id: PlanId; name: string; price: number; duration: string; badge: string; features: string[] }
> = {
  wash: {
    id: "wash",
    name: "Essential Wash",
    price: 499,
    duration: "45 min",
    badge: "Quick",
    features: ["Foam wash", "Tyre black", "Wet look finish"],
  },
  detail: {
    id: "detail",
    name: "Full Detail",
    price: 1999,
    duration: "120 min",
    badge: "Most Popular",
    features: ["Interior vacuum", "Exterior detail", "Dashboard shine", "Ceramic spray"],
  },
  signature: {
    id: "signature",
    name: "Signature Super Design",
    price: 25000,
    duration: "2 days",
    badge: "Rai's Signature",
    features: ["Full colour wrap", "Custom body kit", "Ceramic coat", "Design consultation"],
  },
};

export const COLOURS = [
  { name: "Electric Blue", hex: "#2563EB" },
  { name: "Matte Black", hex: "#1F2937" },
  { name: "Racing Red", hex: "#DC2626" },
  { name: "Chameleon Purple", hex: "#7C3AED" },
  { name: "Pearl White", hex: "#F8FAFC" },
] as const;

export const STYLES = ["Racing Stripes", "Blacked Out", "Carbon Hood", "Lowered Sporty"] as const;

export const MOBILE_FEE = 200;
export const WATER_FEE = 150;
export const STUDIO_BAYS = 2;
export const STUDIO = { lat: 27.3314, lng: 88.6138, name: "Rai's Auto Spa, MG Marg, Gangtok 737101" };

export const SLOTS = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
export const isPrime = (t: string) => ["07:00", "08:00", "09:00", "10:00", "17:00", "18:00"].includes(t);
export const isDryWindow = (t: string) => {
  const h = parseInt(t, 10);
  return h >= 11 && h < 16;
};

export function imagePrompt(plan: PlanId, colour?: string, style?: string) {
  if (plan === "wash")
    return "Transform this exact car from the input photo into freshly foam washed, wet look, tyre black, remove all dirt and dust, same exact angle, same parking background, same number plate blurred, photorealistic, studio light, showroom wet shine";
  if (plan === "detail")
    return "Same exact car, deep interior and exterior detailed, vacuumed seats, dashboard shine, paint glossy showroom condition, same angle and background, number plate blurred, photorealistic";
  return `Transform this exact car into custom wrapped super design with ${colour ?? "Electric Blue"} metallic wrap, ${style ?? "Racing Stripes"}, blacked out rims, lowered stance, aggressive sporty body kit, ceramic mirror gloss, same angle and background, number plate blurred, photorealistic, premium customization`;
}

export function videoPrompt(plan: PlanId, colour?: string, style?: string) {
  const tail = " Keep the car's shape and proportions unchanged. Single continuous shot, no scene cuts. Audio: soft studio ambience and gentle water drips. No dialogue. No on-screen text.";
  if (plan === "wash") return "Cinematic 6s slow dolly, foam dripping, water beading on glossy paint, professional car commercial." + tail;
  if (plan === "detail") return "Cinematic interior + exterior spin, light gliding over glossy paint, 6s." + tail;
  return `Cinematic 6s, car colour shimmering in its new ${colour ?? "electric blue"} wrap with ${style ?? "black stripes"}, slow spin, dramatic studio light, water beading, supercar reveal.` + tail;
}

export const inr = (n: number) => "Rs." + n.toLocaleString("en-IN");

export function calcTotal(plan: PlanId, mobile: boolean, waterFee: boolean) {
  return PLANS[plan].price + (mobile ? MOBILE_FEE : 0) + (mobile && waterFee ? WATER_FEE : 0);
}
export const depositOf = (total: number) => Math.round(total * 0.3);

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  // hill roads: multiply straight-line by 1.6
  return 2 * R * Math.asin(Math.sqrt(s)) * 1.6;
}

export const AREAS = [
  { name: "MG Marg", lat: 27.3314, lng: 88.6138 },
  { name: "Tadong", lat: 27.3082, lng: 88.5976 },
  { name: "Deorali", lat: 27.3172, lng: 88.604 },
  { name: "Development Area", lat: 27.3219, lng: 88.6108 },
];
export function nearestArea(p: { lat: number; lng: number }) {
  return AREAS.reduce((best, a) => (haversineKm(p, a) < haversineKm(p, best) ? a : best)).name;
}
