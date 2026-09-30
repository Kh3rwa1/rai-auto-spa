/**
 * Sarvam voice agent confirmation call.
 * Two +91 agent numbers are used round-robin; if the first attempt fails we
 * immediately retry with the second. Number 2 is also the inbound callback line.
 */

const BASE = "https://apps.sarvam.ai/api/outbounds";

export type CallVars = {
  bookingId: string;
  customerName: string;
  customerPhoneE164: string;
  detectedCountry: string | null;
  plan: string;
  date: string;
  time: string;
  building: string;
};

type Env = {
  apiKey: string;
  agentId: string;
  orgId: string;
  workspaceId: string;
  connectionId: string;
  numbers: string[];
  webhookUrl: string | null;
};

function readEnv(origin: string | null): Env | null {
  const apiKey = process.env["SARVAM_API_KEY"];
  const agentId = process.env["SARVAM_AGENT_ID"];
  const orgId = process.env["SARVAM_ORG_ID"];
  const workspaceId = process.env["SARVAM_WORKSPACE_ID"];
  const connectionId = process.env["SARVAM_CONNECTION_ID"];
  const numbers = [
    process.env["SARVAM_PHONE_NUMBER_1"],
    process.env["SARVAM_PHONE_NUMBER_2"],
  ].filter((n): n is string => !!n);
  if (!apiKey || !agentId || !orgId || !workspaceId || !connectionId || numbers.length === 0)
    return null;
  // Sarvam posts the call outcome to this URL with no custom headers, so the
  // shared secret travels as a query token.
  const hookSecret = process.env["SARVAM_WEBHOOK_SECRET"];
  return {
    apiKey,
    agentId,
    orgId,
    workspaceId,
    connectionId,
    numbers,
    webhookUrl:
      origin && hookSecret
        ? `${origin}/api/public/update-booking?k=${encodeURIComponent(hookSecret)}`
        : null,
  };
}

/** Stable round-robin over the two agent numbers, derived from the booking id. */
function pickIndex(bookingId: string, count: number) {
  let h = 0;
  for (const ch of bookingId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % count;
}

/**
 * Sarvam rejects (422) any agent variable the published agent does not declare.
 * The error names the offending keys, so we strip them and retry once.
 */
function unknownVars(detail: string): string[] {
  const m = detail.match(/Agent variables '\{([^}]*)\}'/);
  if (!m?.[1]) return [];
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]!);
}

function buildBody(env: Env, from: string, v: CallVars, vars: Record<string, string>) {
  return {
    app_config: {
      app_id: env.agentId,
      app_version: Number(process.env["SARVAM_AGENT_VERSION"] ?? 1),
      app_type: "agent",
      connection_config: { connection_id: env.connectionId, agent_phone_number: from },
      agent_variables: vars,
      app_overrides: {
        initial_language_name: "English",
        initial_bot_message: `Hello ${v.customerName}, this is Rai's assistant from Rai's Auto Spa confirming your ${v.plan} on ${v.date} at ${v.time} at ${v.building}. Press 1 to confirm, 2 to change time, 3 to change plan.`,
      },
    },
    user_config: { user_phone_number: v.customerPhoneE164 },
    ...(env.webhookUrl
      ? { webhook_config: { url: env.webhookUrl, metadata: { bookingId: v.bookingId } } }
      : {}),
  };
}

async function post(env: Env, body: unknown) {
  const res = await fetch(`${BASE}/v1/orgs/${env.orgId}/workspaces/${env.workspaceId}/outbounds`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": env.apiKey },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

async function placeOne(env: Env, from: string, v: CallVars) {
  const vars: Record<string, string> = {
    customer_name: v.customerName,
    plan: v.plan,
    date: v.date,
    time: v.time,
    building: v.building,
    bookingId: v.bookingId,
  };
  let r = await post(env, buildBody(env, from, v, vars));
  if (!r.ok && r.status === 422) {
    const drop = unknownVars(r.text);
    if (drop.length) {
      for (const k of drop) delete vars[k];
      r = await post(env, buildBody(env, from, v, vars));
    }
  }
  if (!r.ok) throw new Error(`${r.status} ${r.text.slice(0, 160)}`);
  return JSON.parse(r.text || "{}") as { attempt_id?: string };
}


export type CallResult = { status: string; from: string | null; detail: string | null };

/** Never throws — the demo booking must succeed even when the call cannot be placed. */
export async function placeConfirmationCall(
  v: CallVars,
  origin: string | null,
): Promise<CallResult> {
  const env = readEnv(origin);
  if (!env) return { status: "not_configured", from: null, detail: "Sarvam keys missing" };
  const start = pickIndex(v.bookingId, env.numbers.length);
  const order = env.numbers.map((_, i) => env.numbers[(start + i) % env.numbers.length]!);
  let last = "";
  for (const from of order) {
    try {
      const out = await placeOne(env, from, v);
      return { status: "calling", from, detail: out.attempt_id ?? null };
    } catch (e) {
      last = (e as Error).message;
    }
  }
  return { status: "failed", from: null, detail: last.slice(0, 200) };
}
