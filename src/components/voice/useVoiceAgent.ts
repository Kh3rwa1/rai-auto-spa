import { useCallback, useEffect, useRef, useState } from "react";
import { PLANS } from "@/lib/plans";
import { formatSlot } from "@/lib/booking-rules";
import type { VoiceContext, VoiceIntent } from "@/lib/voice";

export type VoicePhase = "idle" | "listening" | "thinking" | "speaking";

type Options = {
  getContext: () => VoiceContext;
  applyIntent: (intent: VoiceIntent) => void;
};

const MAX_RECORD_MS = 15_000;
const MAX_SILENCE_MS = 1_800;
const MIN_SPEECH_MS = 700;
const NO_SPEECH_MS = 4_500;
const SILENCE_RMS = 0.008;
const MAX_EMPTY_TRIES = 3;
/** Context-aware opener — Rai reacts to where the customer already is, never a canned line. */
function greetingFor(ctx: VoiceContext): string {
  if (ctx.hasSlot && ctx.slotDate && ctx.slotTime && ctx.missing.length === 0)
    return `All set for ${formatSlot(ctx.slotDate, ctx.slotTime)} — shall I open payment?`;
  if (!ctx.plan)
    return "Hi! Tell me the service — wash, full detail or a wrap — then a day, a time, and your name with WhatsApp number. No photo needed!";
  if (!ctx.hasSlot)
    return `${PLANS[ctx.plan].name} it is! Which day and time suits — van or studio?`;
  if (ctx.slotDate && ctx.slotTime) {
    const left = ctx.missing.length ? `Still need: ${ctx.missing.join(", ")}. ` : "";
    return `${formatSlot(ctx.slotDate, ctx.slotTime)} looks free. ${left}Name, WhatsApp and email, then I'll open payment.`;
  }
  return "Welcome back! What's next?";
}
function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function isSupported() {
  return (
    typeof window !== "undefined" &&
    typeof window.AudioContext !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/**
 * Conversational loop for voice booking: mic → /api/voice/stt → /api/voice/command
 * (LLM intent) → apply to wizard → /api/voice/tts → listen again until stopped.
 */
export function useVoiceAgent({ getContext, applyIntent }: Options) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Client-only capability probe — false on SSR to avoid a hydration mismatch.
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(isSupported()), []);

  const ctx = useRef({ getContext, applyIntent });
  ctx.current = { getContext, applyIntent };
  const session = useRef(0);
  const phaseRef = useRef<VoicePhase>("idle");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<number | null>(null);

  const setPhaseSafe = (p: VoicePhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const teardownMic = useCallback(() => {
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
  }, []);

  const stop = useCallback(() => {
    session.current += 1;
    teardownMic();
    audioEl.current?.pause();
    setPhaseSafe("idle");
  }, [teardownMic]);

  const speak = useCallback(async (text: string, mySession: number) => {
    setPhaseSafe("speaking");
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      if (session.current !== mySession) return;
      const url = URL.createObjectURL(blob);
      const el = new Audio(url);
      audioEl.current = el;
      await el.play();
      await new Promise<void>((resolve) => {
        el.onended = () => resolve();
        el.onerror = () => resolve();
      });
      URL.revokeObjectURL(url);
      audioEl.current = null;
    } catch {
      // Speech is best-effort — the reply text is always shown in the overlay.
    }
  }, []);

  const listen = useCallback(async (): Promise<string | null> => {
    setPhaseSafe("listening");
    setError(null);
    let streamLocal: MediaStream;
    try {
      streamLocal = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Mic permission is off — allow the microphone and tap again.");
      setPhaseSafe("idle");
      return null;
    }
    stream.current = streamLocal;
    const mime = pickMime();
    const rec = new MediaRecorder(streamLocal, mime ? { mimeType: mime } : undefined);
    recorder.current = rec;
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);

    const stopped = new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
    });

    // Silence-based VAD: stop after speech + a quiet pause, or the hard cap.
    let spokeMs = 0;
    let quietMs = 0;
    const started = Date.now();
    try {
      audioCtx.current = new AudioContext();
      const src = audioCtx.current.createMediaStreamSource(streamLocal);
      const analyser = audioCtx.current.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      timer.current = window.setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
        const rms = Math.sqrt(sum / buf.length);
        if (rms > SILENCE_RMS) {
          spokeMs += 100;
          quietMs = 0;
        } else {
          quietMs += 100;
        }
        if (
          (spokeMs >= MIN_SPEECH_MS && quietMs >= MAX_SILENCE_MS) ||
          // Nobody started talking — stop early instead of burning the full cap.
          (spokeMs === 0 && Date.now() - started >= NO_SPEECH_MS) ||
          Date.now() - started >= MAX_RECORD_MS
        ) {
          if (rec.state === "recording") rec.stop();
        }
      }, 100);
    } catch {
      // No analyser (rare) — fall through to the hard cap via rec.stop below.
    }
    if (!timer.current)
      window.setTimeout(() => rec.state === "recording" && rec.stop(), MAX_RECORD_MS);
    rec.start();

    await stopped;
    teardownMic();
    if (chunks.length === 0) return "";
    const blob = new Blob(chunks, { type: mime || "audio/webm" });

    const res = await fetch("/api/voice/stt", {
      method: "POST",
      headers: { "Content-Type": blob.type || "audio/webm" },
      body: blob,
    });
    const j = (await res.json()) as { transcript?: string; error?: string };
    // Server hiccups and empty captures are both retryable — the loop bounds the tries.
    if (j.error) return "";
    return j.transcript ?? "";
  }, [teardownMic]);

  const turn = useCallback(async () => {
    const mySession = ++session.current;
    // Proactive opener: react to the customer's live wizard state first.
    await speak(greetingFor(ctx.current.getContext()), mySession);
    if (session.current !== mySession) return;
    // Loop: listen → think → speak → listen again, until stopped or unmounted.
    // Nothing captured is retried automatically — the session never punts to a tap.
    let emptyStreak = 0;
    for (;;) {
      if (session.current !== mySession) return;
      const said = await listen();
      if (session.current !== mySession) return;
      if (said === null) {
        // Mic denied/hardware error — the only case that hands control back.
        setPhaseSafe("idle");
        return;
      }
      if (!said.trim()) {
        emptyStreak += 1;
        if (emptyStreak >= MAX_EMPTY_TRIES) {
          setReply("Couldn't hear you — tap the mic and speak a little louder.");
          await speak(
            "Sorry yaar, still can't hear you. Tap the mic and speak a little louder.",
            mySession,
          );
          if (session.current !== mySession) return;
          setPhaseSafe("idle");
          return;
        }
        setPhaseSafe("listening");
        continue;
      }
      emptyStreak = 0;
      setTranscript(said);
      setPhaseSafe("thinking");
      let replyText = "";
      let intent: VoiceIntent = { type: "none" };
      try {
        const res = await fetch("/api/voice/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: said, context: ctx.current.getContext() }),
        });
        const j = (await res.json()) as { reply?: string; intent?: VoiceIntent; error?: string };
        if (j.error) throw new Error(j.error);
        replyText = j.reply ?? "";
        intent = j.intent ?? { type: "none" };
        setReply(replyText);
      } catch (e) {
        setReply("");
        setError((e as Error).message || "Voice hiccup — please try again.");
        setPhaseSafe("idle");
        return;
      }
      ctx.current.applyIntent(intent);
      await speak(replyText, mySession);
      if (session.current !== mySession) return;
      if (intent.type === "stop") {
        setPhaseSafe("idle");
        return;
      }
    }
  }, [listen, speak]);

  /** One-shot announcement (e.g. payment confirmed) — ends the loop, then goes idle. */
  const announce = useCallback(
    async (text: string) => {
      session.current += 1;
      teardownMic();
      await speak(text, session.current);
      setPhaseSafe("idle");
    },
    [speak, teardownMic],
  );

  const start = useCallback(() => {
    if (phaseRef.current !== "idle") {
      stop();
      return;
    }
    setReply("");
    setTranscript("");
    setError(null);
    void turn();
  }, [stop, turn]);

  // Unmount / tab hidden: never leave a mic open or audio playing.
  useEffect(() => () => stop(), [stop]);

  return { phase, transcript, reply, error, supported, start, stop, announce, setPhaseSafe };
}
