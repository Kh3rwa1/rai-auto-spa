import { createFileRoute } from "@tanstack/react-router";
import { runVoiceCommand } from "@/lib/voice-agent.server";
import type { VoiceContext } from "@/lib/voice";

/** POST { transcript, context } → { reply, intent } for the booking wizard to apply. */
export const Route = createFileRoute("/api/voice/command")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { transcript?: unknown; context?: unknown };
          const transcript =
            typeof body.transcript === "string" ? body.transcript.trim().slice(0, 600) : "";
          if (!transcript) {
            return Response.json(
              { error: "I didn't catch that — tap and try again." },
              { status: 200 },
            );
          }
          const context = body.context as VoiceContext | undefined;
          if (!context || typeof context.today !== "string") {
            return Response.json({ error: "Invalid request" }, { status: 400 });
          }
          const result = await runVoiceCommand(transcript, context);
          return Response.json(result);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          if (msg.includes("AI is not configured") || msg.includes("credits")) {
            return Response.json(
              { error: "Voice booking is paused right now — please use the buttons." },
              { status: 503 },
            );
          }
          console.error("Voice command error", err);
          return Response.json({ error: "Voice hiccup — please try again." }, { status: 500 });
        }
      },
    },
  },
});
