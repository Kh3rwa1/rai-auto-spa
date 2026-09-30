// fal.ai queue client — image finish (FLUX.1 [dev]) and reveal video (Kling 1.5).
// Vehicle/plate detection stays on the Lovable gateway for instant upload feedback.

const QUEUE = "https://queue.fal.run";

/** Model endpoints. The queue status/result path uses the first two segments. */
export const IMAGE_MODEL = "fal-ai/flux/dev/image-to-image";
export const IMAGE_QUEUE = "fal-ai/flux";
export const VIDEO_MODEL = "fal-ai/kling-video/v1/standard/image-to-video";
export const VIDEO_QUEUE = "fal-ai/kling-video";

function key() {
  const k = process.env["FAL_KEY"];
  if (!k) throw new Error("AI is not configured");
  return k;
}

function headers(json = true): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Key ${key()}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function falError(res: Response, what: string): Promise<never> {
  let msg = "";
  try {
    const j = (await res.json()) as { detail?: unknown; error?: { message?: string } };
    msg =
      j?.error?.message ??
      (Array.isArray(j?.detail)
        ? (j.detail as { msg?: string }[])
            .map((d) => d.msg ?? "")
            .filter(Boolean)
            .join("; ")
        : typeof j?.detail === "string"
          ? j.detail
          : "");
  } catch {
    /* non-JSON body — fall back to the status code */
  }
  if (res.status === 429)
    throw new Error("Rai is busy with lots of cars right now — please try again in a minute.");
  if (res.status === 401 || res.status === 403)
    throw new Error("AI previews are not configured correctly right now.");
  if (res.status === 402)
    throw new Error("AI previews are paused right now (credits). Please book without the preview.");
  throw new Error(`${what} failed${msg ? `: ${msg}` : ""}`);
}

export function dataUri(bytes: Uint8Array, mime: string) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
}

export async function submit(model: string, input: Record<string, unknown>, what: string) {
  const res = await fetch(`${QUEUE}/${model}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!res.ok) await falError(res, what);
  const j = (await res.json()) as { request_id?: string };
  if (!j.request_id) throw new Error(`${what} failed — no job was created.`);
  return j.request_id;
}

export type FalStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | string;

export async function status(queue: string, id: string, what: string) {
  const res = await fetch(`${QUEUE}/${queue}/requests/${id}/status`, { headers: headers(false) });
  // fal answers 200 when finished and 202 while the job is still queued or running.
  if (!res.ok && res.status !== 202) await falError(res, what);
  const j = (await res.json()) as { status?: FalStatus; error?: { message?: string } };
  return { status: j.status ?? "IN_PROGRESS", error: j.error };
}

export async function result<T>(queue: string, id: string, what: string) {
  const res = await fetch(`${QUEUE}/${queue}/requests/${id}`, { headers: headers(false) });
  if (!res.ok) await falError(res, what);
  return (await res.json()) as T;
}

export async function fetchBytes(url: string, what: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${what} download failed`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Poll a queued job until it finishes. No wall-clock deadline: generation takes as long as it takes. */
export async function waitFor(
  queue: string,
  id: string,
  what: string,
  everyMs = 2000,
  tries = 180,
) {
  for (let i = 0; i < tries; i++) {
    const s = await status(queue, id, what);
    if (s.status === "COMPLETED") return;
    if (s.status === "FAILED" || s.status === "ERROR")
      throw new Error(`${what} failed${s.error?.message ? `: ${s.error.message}` : ""}`);
    await new Promise((r) => setTimeout(r, everyMs));
  }
  throw new Error(`${what} is taking unusually long — please try again.`);
}
