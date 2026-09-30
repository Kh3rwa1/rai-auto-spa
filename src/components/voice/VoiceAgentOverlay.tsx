import { Mic, MicOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { useVoiceAgent } from "./useVoiceAgent";

const STATUS: Record<string, string> = {
  idle: "Tap the mic and tell Rai what your car needs",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Rai is speaking…",
};

type Voice = ReturnType<typeof useVoiceAgent>;

/** Fixed speech bubble for the hero-mascot voice booking assistant. */
export function VoiceAgentOverlay({ voice }: { voice: Voice }) {
  if (!voice.supported) return null;
  const active = voice.phase !== "idle";

  return (
    <div
      role="dialog"
      aria-label="Voice booking assistant"
      className={cn(
        "fixed right-3 z-50 w-[min(21rem,calc(100vw-1.5rem))] rounded-2xl border-2 border-[var(--wb-ink)] bg-[var(--wb-paper)] p-4 shadow-[6px_6px_0_0_var(--wb-ink)] transition-opacity",
        "bottom-24 md:bottom-6",
        active ? "opacity-100" : "opacity-95",
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={
            voice.phase === "idle"
              ? voice.start
              : voice.phase === "speaking"
                ? voice.skip
                : voice.stop
          }
          aria-label={
            voice.phase === "idle"
              ? "Start voice booking"
              : voice.phase === "speaking"
                ? "Interrupt — start listening"
                : "Stop voice booking"
          }
          className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--wb-ink)] text-[#faf5ea] transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          {voice.phase === "listening" && (
            <span
              className="absolute inset-0 animate-ping rounded-full bg-[var(--wb-ink)] opacity-30"
              aria-hidden
            />
          )}
          {voice.phase === "idle" ? (
            <Mic className="h-5 w-5" aria-hidden />
          ) : (
            <MicOff className="h-5 w-5" aria-hidden />
          )}
        </button>
        <p className="min-w-0 flex-1 text-sm font-bold" aria-live="polite">
          {voice.phase === "speaking"
            ? "Rai is speaking — tap the orb to interrupt"
            : (STATUS[voice.phase] ?? STATUS["idle"])}
        </p>
        <button
          type="button"
          onClick={voice.stop}
          aria-label="Close voice assistant"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--wb-ink)] bg-[var(--wb-paper)] text-[var(--wb-ink)] hover:bg-[var(--wb-mint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {voice.transcript && (
        <p className="mt-3 border-l-4 border-[var(--wb-ink)] pl-3 text-sm italic opacity-75">
          “{voice.transcript}”
        </p>
      )}
      {voice.reply && (
        <p className="mt-2 rounded-xl bg-[var(--wb-mint)] p-3 text-sm font-medium">{voice.reply}</p>
      )}
      {voice.error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-destructive">
          {voice.error}
        </p>
      )}
      {active && (
        <p className="mt-3 text-[11px] leading-snug text-[var(--wb-ink-soft)]">
          Try: “Essential wash tomorrow 9am” · “van, water available” · “my name is…”
        </p>
      )}
    </div>
  );
}
