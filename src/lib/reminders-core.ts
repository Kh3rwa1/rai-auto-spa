export type ReminderRow = {
  id: string;
  plan: string;
  date: string | null;
  time: string | null;
  location_type: string;
  area: string | null;
  total: number;
  deposit_paid: boolean;
  status: string;
  vehicle_model: string | null;
  clients: {
    name: string;
    email: string | null;
    is_seed?: boolean | null;
  } | null;
};

export function addDaysIso(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const istDate = (now: number = Date.now()) =>
  new Date(now + 5.5 * 3600000).toISOString().slice(0, 10);

export const tomorrowIst = (now: number = Date.now()) => addDaysIso(istDate(now), 1);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Only real, active bookings with a usable email. Sample (is_seed) customers never get mail. */
export function isDeliverable(r: ReminderRow) {
  if (!["confirmed", "pending_deposit"].includes(r.status)) return false;
  const c = r.clients;
  if (!c || c.is_seed) return false;
  return EMAIL.test(c.email ?? "");
}

export function spokenTime(t: string | null | undefined) {
  if (!t) return "";
  const [hs, ms] = t.split(":");
  const h = Number(hs);
  const m = Number(ms ?? 0);
  if (!Number.isFinite(h)) return t;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

export function dayWords(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function buildTemplateData(r: ReminderRow, depositOf: (total: number) => number) {
  const first = (r.clients?.name ?? "").trim().split(/\s+/)[0] ?? "";
  const location =
    r.location_type === "mobile"
      ? `At your place${r.area ? `, ${r.area}` : ""}`
      : "Studio, MG Marg, Gangtok";
  const depositPending = !r.deposit_paid;
  return {
    name: first,
    vehicle: r.vehicle_model ?? undefined,
    plan: r.plan,
    when: r.date ? dayWords(r.date) : "",
    time: spokenTime(r.time),
    location,
    depositPending,
    balance: depositPending ? undefined : Math.max(0, r.total - depositOf(r.total)),
  };
}
