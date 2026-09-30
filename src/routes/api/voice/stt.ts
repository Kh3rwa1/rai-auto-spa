import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://api.deepgram.com/v1/listen";
const DEFAULT_MODEL = "nova-2";

function key() {
  const k = process.env["DEEPGRAM_API_KEY"];
  if (!k) throw new Error("Voice is not configured");
  return k;
}

async function transcribe(bytes: ArrayBuffer, mime: string, language: string) {
  const params = new URLSearchParams({
    model: DEFAULT_MODEL,
    language,
    smart_format: "true",
    punctuate: "true",
  });
  const res = await fetch(`${BASE}?${params}`, {
    method: "POST",
    headers: { Authorization: `Token ${key()}`, "Content-Type": mime || "audio/webm" },
    body: bytes,
  });
  return res;
}

function pickTranscript(j: unknown): { transcript: string; confidence: number } {
  const j2 = j as {
    results?: {
      channels?: { alternatives?: { transcript?: string; confidence?: number }[] }[];
    };
  };
  const alt = j2.results?.channels?.[0]?.alternatives?.[0];
  return { transcript: alt?.transcript?.trim() ?? "", confidence: alt?.confidence ?? 0 };
}

/** Client streams one mic recording; server proxies Deepgram pre-recorded STT (key stays server-side). */
export const Route = createFileRoute("/api/voice/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const bytes = await request.arrayBuffer();
          if (bytes.byteLength === 0) return Response.json({ transcript: "", confidence: 0 });
          if (bytes.byteLength > 15_000_000) {
            return Response.json({ error: "Recording too long — try again." }, { status: 413 });
          }
          const mime = request.headers.get("content-type") ?? "audio/webm";

          let res = await transcribe(bytes, mime, "en-IN");
          // en-IN is only available on some English models — retry with the general one.
          if (res.status === 400) res = await transcribe(bytes, mime, "en");
          if (!res.ok) {
            const detail = await res.json().catch(() => null);
            console.error("Deepgram STT failed", res.status, detail);
            return Response.json(
              { error: "Could not transcribe — please try again." },
              { status: 502 },
            );
          }
          const parsed = pickTranscript(await res.json());
          if (!parsed.transcript) {
            // Empty capture is a normal no-speech case — let the client auto-retry.
            return Response.json({ transcript: "", confidence: 0 });
          }
          return Response.json(parsed);
        } catch (err) {
          if (err instanceof Error && err.message === "Voice is not configured") {
            return Response.json(
              { error: "Voice booking is not configured yet." },
              { status: 500 },
            );
          }
          console.error("STT route error", err);
          return Response.json({ error: "Voice hiccup — please try again." }, { status: 500 });
        }
      },
    },
  },
});
