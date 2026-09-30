import type { PlanId } from "./plans";

/** Structured action the voice assistant can apply to the booking wizard. */
export type VoiceIntent =
  | { type: "select_plan"; plan: PlanId }
  | { type: "select_slot"; date: string; time: string }
  | { type: "set_location"; mobile: boolean }
  | { type: "set_contact"; name?: string; phone?: string; email?: string; address?: string }
  | { type: "set_vehicle"; vehicle: string }
  | { type: "open_payment" }
  | { type: "go_to_step"; step: 1 | 2 | 3 | 4 | 5 }
  | { type: "stop" }
  | { type: "none" };

export type VoiceContext = {
  today: string;
  step: number;
  hasPhoto: boolean;
  vehicle: string | null;
  plan: PlanId | null;
  hasSlot: boolean;
  slotDate: string | null;
  slotTime: string | null;
  mobile: boolean;
  water: boolean;
  hasPin: boolean;
  missing: string[];
};

export type VoiceCommandResponse = { reply: string; intent: VoiceIntent };

export const VOICE_START_EVENT = "rai-voice:start";
export const VOICE_PHOTO_FLOW_EVENT = "rai-voice:photo-flow";

let pendingVoiceStart = false;

/**
 * Mascot tap: arm the start flag (BookingFlow may not be mounted yet) and broadcast.
 * The dispatch is retried on a short ladder so a deferred React flush / StrictMode
 * remount can't swallow it — the listener consumes the flag on first contact.
 */
export function requestVoiceStart() {
  pendingVoiceStart = true;
  const fire = () => {
    if (!pendingVoiceStart) return;
    window.dispatchEvent(new CustomEvent(VOICE_START_EVENT));
  };
  fire();
  [50, 250, 900].forEach((ms) => window.setTimeout(fire, ms));
}

/** Consume the pending start (true exactly once). */
export function consumeVoiceStart(): boolean {
  const was = pendingVoiceStart;
  pendingVoiceStart = false;
  return was;
}
