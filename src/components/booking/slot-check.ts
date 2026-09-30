import { slotUnavailable, type SlotState } from "@/lib/booking-rules";

export function reasonFor(args: {
  dry: boolean;
  full: boolean;
  blocked: boolean;
  past: boolean;
  blockReason: string | null;
}): string | null {
  if (args.past) return "In the past";
  if (args.blocked) return args.blockReason ?? "Blocked by studio (water shortage)";
  if (args.full) return "Fully booked";
  if (args.dry) return "Needs water — pick morning/evening or tick water available";
  return null;
}

export type SlotCheck = (
  d: string,
  t: string,
) => { st: SlotState | undefined; u: ReturnType<typeof slotUnavailable>; why: string | null };
