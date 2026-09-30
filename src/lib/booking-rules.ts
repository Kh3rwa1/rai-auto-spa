import { isDryWindow, type PlanId } from "./plans";

/** Pure booking rules shared by the wizard, owner dashboard and tests. */
export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function addDays(ds: string, n: number) {
  const d = new Date(ds + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const nowISTHour = () =>
  parseInt(
    new Date().toLocaleTimeString("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }),
    10,
  );

export const PHONE_RE = /^[+\d][\d\s-]{8,15}$/;
export const EMAIL_RE = /\S+@\S+\.\S+/;

export const previewKey = (plan: PlanId, colour?: string, style?: string) =>
  `${plan}|${plan === "signature" ? `${colour}|${style}` : ""}`;

export type PayInputs = {
  hasBooking: boolean;
  plan: PlanId | null;
  hasSlot: boolean;
  mobile: boolean;
  hasPin: boolean;
  name: string;
  phone: string;
  email: string;
};

/** Everything still missing before the deposit can be paid (empty = ready). */
export function missingForPay(d: PayInputs): string[] {
  return [
    !d.hasBooking && "snap your car",
    !d.plan && "pick a plan",
    !d.hasSlot && "pick a slot",
    d.mobile && !d.hasPin && "drop a map pin",
    d.name.trim().length < 2 && "add your name",
    !PHONE_RE.test(d.phone.trim()) && "add WhatsApp number",
    !EMAIL_RE.test(d.email) && "add email",
  ].filter((x): x is string => !!x);
}

export type SlotState = { taken: number; blocked: string | null; travelMin: number | null };

/** Mirrors the server-side book_slot checks so the grid never offers a slot the server will refuse. */
export function slotUnavailable(o: {
  date: string;
  time: string;
  today: string;
  nowHour: number;
  mobile: boolean;
  water: boolean;
  capacity: number;
  state?: SlotState | undefined;
}) {
  const past = o.date < o.today || (o.date === o.today && parseInt(o.time, 10) <= o.nowHour);
  const dry = o.mobile && !o.water && isDryWindow(o.time);
  const full = (o.state?.taken ?? 0) >= o.capacity;
  return {
    past,
    dry,
    full,
    blocked: !!o.state?.blocked,
    disabled: past || dry || full || !!o.state?.blocked,
  };
}
