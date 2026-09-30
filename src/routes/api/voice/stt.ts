import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://api.deepgram.com/v1/listen";
/** Best-first chain: nova-3 English (accent-robust incl. Indian), then nova-2 India, then general. */
const MODEL_CHAIN: [string, string][] = [
  ["nova-3", "en"],
  ["nova-2", "en-IN"],
  ["nova-2", "en"],
];

function key() {
  const k = process.env["DEEPGRAM_API_KEY"];
  if (!k) throw new Error("Voice is not configured");
  return k;
}

async function transcribe(bytes: ArrayBuffer, mime: string, model: string, language: string) {
  const params = new URLSearchParams({
    model,
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

          let res: Response | null = null;
          for (const [model, language] of MODEL_CHAIN) {
            const attempt = await transcribe(bytes, mime, model, language);
            if (attempt.ok) {
              res = attempt;
              break;
            }
            // Model/language not available on this account — fall through to the next.
            if (attempt.status === 400 || attempt.status === 404) continue;
            res = attempt;
            break;
          }
          if (!res || !res.ok) {
            const status = res?.status ?? 0;
            const detail = res ? await res.json().catch(() => null) : null;
            console.error("Deepgram STT failed", status, detail);
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
