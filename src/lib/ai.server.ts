const BASE = "https://ai.gateway.lovable.dev";
const CHAT_MODEL = "openai/gpt-6-astra";
const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";
const VIDEO_MODEL = "google/gemini-omni-1.1-flash";

function key() {
  const k = process.env["LOVABLE_API_KEY"];
  if (!k) throw new Error("AI is not configured");
  return k;
}

async function gatewayError(res: Response, what: string): Promise<never> {
  let msg = "";
  try {
    const j = await res.json();
    msg = j?.error?.message ?? j?.message ?? "";
  } catch {
    /* non-JSON error body — fall back to the status code */
  }
  if (res.status === 429)
    throw new Error("Rai is busy with lots of cars right now — please try again in a minute.");
  if (res.status === 402)
    throw new Error("AI previews are paused right now (credits). Please book without the preview.");
  throw new Error(`${what} failed${msg ? `: ${msg}` : ""}`);
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

export async function editCarImage(bytes: Uint8Array, mime: string, prompt: string) {
  const form = new FormData();
  form.set("model", IMAGE_MODEL);
  form.set("prompt", prompt);
  form.set("image", new File([bytes as Uint8Array<ArrayBuffer>], "car.jpg", { type: mime }));
  const res = await fetch(`${BASE}/v1/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}` },
    body: form,
  });
  if (!res.ok) await gatewayError(res, "Preview");
  const j = await res.json();
  const b64 = j?.data?.[0]?.b64_json as string | undefined;
  if (!b64) throw new Error("Preview came back empty — please try again.");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function createVideoJob(bytes: Uint8Array, mime: string, prompt: string) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const res = await fetch(`${BASE}/v1/videos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VIDEO_MODEL,
      input: [
        { type: "text", text: prompt },
        { type: "image", data: btoa(bin), mime_type: mime },
      ],
      response_format: { type: "video", resolution: "720p", duration: "6s", aspect_ratio: "16:9" },
    }),
  });
  if (!res.ok) await gatewayError(res, "Video");
  const j = await res.json();
  return j.id as string;
}

export async function getVideoJob(id: string) {
  const res = await fetch(`${BASE}/v1/videos/${id}`, {
    headers: { Authorization: `Bearer ${key()}` },
  });
  if (!res.ok) await gatewayError(res, "Video status");
  return (await res.json()) as { status: string; error?: { message?: string } };
}

export async function downloadVideo(id: string) {
  const res = await fetch(`${BASE}/v1/videos/${id}/content`, {
    headers: { Authorization: `Bearer ${key()}` },
  });
  if (!res.ok) await gatewayError(res, "Video download");
  return new Uint8Array(await res.arrayBuffer());
}
