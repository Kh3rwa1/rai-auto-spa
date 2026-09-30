import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://api.deepgram.com/v1/speak";
/** Aura-2 is Deepgram's most natural voice generation; fall back to Aura-1 if unavailable. */
const VOICE_CHAIN = ["aura-2-thalia-en", "aura-asteria-en"];
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

          let audio: Response | null = null;
          for (const model of VOICE_CHAIN) {
            const params = new URLSearchParams({
              model,
              encoding: "linear16",
              sample_rate: "24000",
              container: "wav",
            });
            const attempt = await fetch(`${BASE}?${params}`, {
              method: "POST",
              headers: { Authorization: `Token ${key()}`, "Content-Type": "application/json" },
              body: JSON.stringify({ text: clean }),
            });
            if (attempt.ok) {
              audio = attempt;
              break;
            }
            // Voice not available on this account — try the next one.
            if (attempt.status === 400 || attempt.status === 404) continue;
            audio = attempt;
            break;
          }
          if (!audio || !audio.ok) {
            console.error("Deepgram TTS failed", audio?.status ?? 0);
            return Response.json({ error: "Could not speak right now." }, { status: 502 });
          }
          return new Response(audio.body, {
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
