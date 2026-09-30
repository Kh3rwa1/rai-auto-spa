import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://api.deepgram.com/v1/speak";
const MODEL = "aura-asteria-en";
const MAX_CHARS = 800;

function key() {
  const k = process.env["DEEPGRAM_API_KEY"];
  if (!k) throw new Error("Voice is not configured");
  return k;
}

/** Short assistant replies → WAV via Deepgram TTS; played client-side after the user's tap gesture. */
export const Route = createFileRoute("/api/voice/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { text } = (await request.json()) as { text?: unknown };
          const clean = typeof text === "string" ? text.trim().slice(0, MAX_CHARS) : "";
          if (!clean) return Response.json({ error: "Nothing to say" }, { status: 400 });

          const params = new URLSearchParams({
            model: MODEL,
            encoding: "linear16",
            sample_rate: "24000",
            container: "wav",
          });
          const res = await fetch(`${BASE}?${params}`, {
            method: "POST",
            headers: { Authorization: `Token ${key()}`, "Content-Type": "application/json" },
            body: JSON.stringify({ text: clean }),
          });
          if (!res.ok) {
            console.error("Deepgram TTS failed", res.status, await res.text().catch(() => ""));
            return Response.json({ error: "Could not speak right now." }, { status: 502 });
          }
          return new Response(res.body, {
            headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
          });
        } catch (err) {
          if (err instanceof Error && err.message === "Voice is not configured") {
            return Response.json(
              { error: "Voice booking is not configured yet." },
              { status: 500 },
            );
          }
          console.error("TTS route error", err);
          return Response.json({ error: "Voice hiccup — please try again." }, { status: 500 });
        }
      },
    },
  },
});
