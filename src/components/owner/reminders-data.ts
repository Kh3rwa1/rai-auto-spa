import type { Booking } from "./shared";

const ACTIVE = ["confirmed", "pending_deposit"];

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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

export function dayWords(iso: string, today: string) {
  if (iso === addDays(today, 1)) return "tomorrow";
  const d = new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return `on ${d}`;
}

/** Tomorrow's active bookings; if tomorrow is empty, the next day that has any. Unpaid first, then by time. */
export function reminderRows(bookings: Booking[], today: string) {
  const first = addDays(today, 1);
  const upcoming = bookings.filter((b) => !!b.date && b.date >= first && ACTIVE.includes(b.status));
  const dates = upcoming.map((b) => b.date as string).sort();
  const target = dates.includes(first) ? first : (dates[0] ?? null);
  const rows = target
    ? upcoming
        .filter((b) => b.date === target)
        .sort(
          (a, b) =>
            Number(a.deposit_paid) - Number(b.deposit_paid) ||
            (a.time ?? "").localeCompare(b.time ?? ""),
        )
    : [];
  return { target, rows };
}

export function reminderMessage(b: Booking, when: string) {
  const name = (b.clients?.name ?? "").split(" ")[0] || "there";
  const place =
    b.location_type === "mobile"
      ? `at your place${b.area ? ` in ${b.area}` : ""}`
      : "at our MG Marg studio";
  const head = `Hi ${name}! Reminder from Rai's Auto Spa: your ${b.plan} is ${when} at ${spokenTime(b.time)} ${place}.`;
  const tail = b.deposit_paid
    ? "Reply YES to confirm. Need another time? Rescheduling is free until 12 hours before."
    : "Your 30% deposit is still pending - please pay it to keep the slot.";
  return `${head} ${tail}`;
}

/** Opens WhatsApp with the text ready. Falls back to no recipient if the number is missing or masked. */
export function waLink(phone: string | null | undefined, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const full = digits.length === 10 ? `91${digits}` : digits;
  const base = full.length >= 11 ? `https://wa.me/${full}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}
