// Vehicle + plate detection runs on the Lovable gateway (instant, at upload time).
// The car finish and the reveal video are generated on fal.ai — see ./fal.server.
const BASE = "https://ai.gateway.lovable.dev";
const CHAT_MODEL = "openai/gpt-6-astra";

function key() {
  const k = process.env["LOVABLE_API_KEY"];
  if (!k) throw new Error("AI is not configured");
  return k;
}

export async function detectVehicle(b64: string, mime: string) {
  const res = await fetch(`${BASE}/v1/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: 'Identify the car in this photo. Prefer Indian market model names (e.g. Swift, Baleno, Thar, Innova, Creta, Nexon, i20, Scorpio). Also locate the vehicle number plate if one is visible. Reply ONLY with JSON: {"model":"<model name, no brand>","is_car":true|false,"plate":[x,y,w,h] or null}. plate is the licence plate bounding box as fractions of image width/height (0..1), top-left origin. Keep it short.',
            },
            { type: "input_image", image_url: `data:${mime};base64,${b64}` },
          ],
        },
      ],
    }),
  });
  if (!res.ok) return { model: "Car", isCar: true, plate: null as unknown };
  const j = await res.json();
  const text: string =
    j.output_text ??
    (j.output ?? [])
      .flatMap((o: { content?: { text?: string }[] }) => o.content ?? [])
      .map((c: { text?: string }) => c.text ?? "")
      .join("");
  const m = text.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(m?.[0] ?? "{}");
    return {
      model: String(parsed.model || "Car").slice(0, 40),
      isCar: parsed.is_car !== false,
      plate: parsed.plate as unknown,
    };
  } catch {
    return { model: "Car", isCar: true, plate: null as unknown };
  }
}

/** Car finish / wrap rendering — fal.ai FLUX.1 [dev] image-to-image keeps the car's exact geometry. */
export async function editCarImage(bytes: Uint8Array, mime: string, prompt: string) {
  const fal = await import("./fal.server");
  const id = await fal.submit(
    fal.IMAGE_MODEL,
    {
      image_url: fal.dataUri(bytes, mime),
      prompt,
      strength: 0.45,
      num_images: 1,
      num_inference_steps: 34,
      guidance_scale: 3.5,
      enable_safety_checker: false,
    },
    "Preview",
  );
  await fal.waitFor(fal.IMAGE_QUEUE, id, "Preview", 1500, 120);
  const out = await fal.result<{ images?: { url?: string }[] }>(fal.IMAGE_QUEUE, id, "Preview");
  const url = out.images?.[0]?.url;
  if (!url) throw new Error("Preview came back empty — please try again.");
  return fal.fetchBytes(url, "Preview");
}

/** Reveal video — fal.ai Kling 1.5 holds rigid car geometry across the camera sweep. */
export async function createVideoJob(bytes: Uint8Array, mime: string, prompt: string) {
  const fal = await import("./fal.server");
  return fal.submit(
    fal.VIDEO_MODEL,
    {
      image_url: fal.dataUri(bytes, mime),
      prompt,
      duration: "5",
      aspect_ratio: "16:9",
      cfg_scale: 0.5,
    },
    "Video",
  );
}

export async function getVideoJob(id: string) {
  const fal = await import("./fal.server");
  const s = await fal.status(fal.VIDEO_QUEUE, id, "Video status");
  const status =
    s.status === "COMPLETED"
      ? "completed"
      : s.status === "FAILED" || s.status === "ERROR"
        ? "failed"
        : "in_progress";
  return { status, error: s.error };
}

export async function downloadVideo(id: string) {
  const fal = await import("./fal.server");
  const out = await fal.result<{ video?: { url?: string } }>(fal.VIDEO_QUEUE, id, "Video download");
  const url = out.video?.url;
  if (!url) throw new Error("Video came back empty — please try again.");
  return fal.fetchBytes(url, "Video");
}
