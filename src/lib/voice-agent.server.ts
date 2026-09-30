import { key } from "./ai.server";
import { PLANS, SLOTS, type PlanId } from "./plans";
import { addDays } from "./booking-rules";
import type { VoiceCommandResponse, VoiceContext, VoiceIntent } from "./voice";

const BASE = "https://ai.gateway.lovable.dev";
const CHAT_MODEL = "openai/gpt-6-astra";
const MAX_REPLY_CHARS = 240;

const PLAN_MENU = (Object.keys(PLANS) as PlanId[])
  .map((id) => `${PLANS[id].name} (id: "${id}", ₹${PLANS[id].price}, ${PLANS[id].duration})`)
  .join("; ");

function systemPrompt(today: string) {
  return [
    `You ARE Rai — the proud, hyper-friendly owner of Rai's Auto Spa on MG Marg, Gangtok. You chat like an excited hill-town shop owner showing off his place. You are NOT a call-centre bot.`,
    `Voice rules: short and punchy (max 25 words), warm Indian-English, a light Hinglish sprinkle when it fits (yaar, ekdum, bindaas, super). Never stiff phrases like "How may I assist you" or "Certainly". Sound like a real person mid-conversation.`,
    `Be PROACTIVE: always end with exactly one concrete next step ("shall I lock 9am?", "drop me your name and number"). If they sound unsure, nudge them to the crowd favourite: Full Detail.`,
    `Use what they already gave you — the wizard state below tells you their car, plan, slot and what's still missing. NEVER ask for information they've already provided. If the photo is missing, that's step one: ask for it warmly.`,
    `Plans: ${PLAN_MENU}. Mobile van +₹200 (Signature is studio-only — the van can't take it). Studio pickup is free.`,
    `Slot times are whole hours: ${SLOTS.join(", ")}. "9am" means "09:00", "5pm"/"5" means "17:00".`,
    `Today is ${today}. "tomorrow" = ${addDays(today, 1)}. Resolve weekday names to the next occurrence within 14 days. Dates must be YYYY-MM-DD.`,
    `If the user names a plan, set intent select_plan with its id ("wash"|"detail"|"signature").`,
    `If the user gives date+time, set intent select_slot with the resolved date and HH:00 time. If they only give a time, use tomorrow. If the time is outside the list, pick the nearest allowed hour and mention it.`,
    `If the user says studio/van or home, set intent set_location (mobile true = van, false = studio).`,
    `If the user gives their name, phone or email, set intent set_contact with only the fields they said.`,
    `If the user wants to see a step ("show slots", "show my reveal", "payment"), set intent go_to_step (1 photo, 2 plan, 3 location+time, 4 reveal, 5 details+payment).`,
    `If the user says stop/bye/done, set intent stop and sign off like a friend: "Done yaar — see you at the studio!".`,
    `If the user mentions their car but hasPhoto is false, reply asking for one photo — intent none.`,
    `If you cannot understand, ask ONE short playful clarifying question — intent none.`,
    `Never mention demos, fiction or AI — the page already shows the demo badge.`,
    `Reply ONLY with JSON: {"reply":"<spoken answer>","intent":{...}}`,
  ].join("\n");
}

function repairIntent(raw: unknown): VoiceIntent {
  const r = (raw ?? {}) as Record<string, unknown>;
  const type = r["type"];
  const plan = PLANS[r["plan"] as PlanId] ? (r["plan"] as PlanId) : null;
  if (type === "select_plan" && plan) return { type: "select_plan", plan };
  if (type === "select_slot") {
    const date =
      typeof r["date"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r["date"]) ? r["date"] : null;
    const time =
      typeof r["time"] === "string" && SLOTS.includes(r["time"])
        ? r["time"]
        : typeof r["time"] === "string" && /^\d{1,2}/.test(r["time"])
          ? `${r["time"].slice(0, 2).padStart(2, "0")}:00`
          : null;
    if (date && time && SLOTS.includes(time)) return { type: "select_slot", date, time };
  }
  if (type === "set_location" && typeof r["mobile"] === "boolean")
    return { type: "set_location", mobile: r["mobile"] };
  if (type === "set_contact") {
    const out: { name?: string; phone?: string; email?: string } = {};
    if (typeof r["name"] === "string" && r["name"].trim()) out.name = r["name"].trim().slice(0, 60);
    if (typeof r["phone"] === "string" && r["phone"].trim())
      out.phone = r["phone"].trim().slice(0, 20);
    if (typeof r["email"] === "string" && r["email"].trim())
      out.email = r["email"].trim().slice(0, 120);
    if (out.name || out.phone || out.email) return { type: "set_contact", ...out };
  }
  if (type === "go_to_step" && [1, 2, 3, 4, 5].includes(r["step"] as number))
    return { type: "go_to_step", step: r["step"] as 1 | 2 | 3 | 4 };
  if (type === "stop") return { type: "stop" };
  return { type: "none" };
}

/** Transcript + live wizard state → {"reply","intent"} via the Lovable AI gateway (JSON-only). */
export async function runVoiceCommand(
  transcript: string,
  context: VoiceContext,
): Promise<VoiceCommandResponse> {
  const res = await fetch(`${BASE}/v1/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      input: [
        { role: "system", content: systemPrompt(context.today) },
        {
          role: "user",
          content: `Wizard state: ${JSON.stringify(context)}\nCustomer said: "${transcript}"`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const msg = await res
      .json()
      .then((j: { error?: { message?: string } }) => j?.error?.message ?? "")
      .catch(() => "");
    throw new Error(`Voice assistant failed${msg ? `: ${msg}` : ""}`);
  }
  const j = await res.json();
  const text: string =
    j.output_text ??
    (j.output ?? [])
      .flatMap((o: { content?: { text?: string }[] }) => o.content ?? [])
      .map((c: { text?: string }) => c.text ?? "")
      .join("");
  const m = text.match(/\{[\s\S]*\}/);
  let parsed: { reply?: unknown; intent?: unknown } = {};
  try {
    parsed = JSON.parse(m?.[0] ?? "{}");
  } catch {
    parsed = {};
  }
  const reply =
    typeof parsed.reply === "string" && parsed.reply.trim()
      ? parsed.reply.trim().slice(0, MAX_REPLY_CHARS)
      : "Sorry, I lost my voice for a second — could you say that again?";
  return { reply, intent: repairIntent(parsed.intent) };
}
