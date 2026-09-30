import type { PlanId } from "./plans";

/** Structured action the voice assistant can apply to the booking wizard. */
export type VoiceIntent =
  | { type: "select_plan"; plan: PlanId }
  | { type: "select_slot"; date: string; time: string }
  | { type: "set_location"; mobile: boolean }
  | { type: "set_contact"; name?: string; phone?: string; email?: string }
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
