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
const SILENCE_RMS = 0.012;

/** Context-aware opener — Rai reacts to where the customer already is, never a canned line. */
function greetingFor(ctx: VoiceContext): string {
  if (!ctx.hasPhoto)
    return "Hey hey, welcome to Rai's Auto Spa! Grab a photo of your car — or tap a sample — and tell me what we're doing: quick wash, full detail, or a total glow-up?";
  const car =
    ctx.vehicle && ctx.vehicle.toLowerCase() !== "car" ? `Oho, a ${ctx.vehicle}! ` : "Nice ride! ";
  if (!ctx.plan)
    return `${car}What's the plan — Essential Wash to freshen it up, Full Detail to really pamper it, or a Signature wrap that turns heads on MG Marg?`;
  if (!ctx.hasSlot)
    return `${PLANS[ctx.plan].name}, solid choice! When suits you? Tomorrow morning is prime time — and if you want, our van comes right to your doorstep.`;
  if (ctx.slotDate && ctx.slotTime) {
    const left = ctx.missing.length ? `Just need: ${ctx.missing.join(", ")}. ` : "Nearly done! ";
    return `${formatSlot(ctx.slotDate, ctx.slotTime)} locked in. ${left}Say your name, WhatsApp number and email, and it's yours.`;
  }
  return "Welcome back! Pick up right where you left off — what's next?";
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
    if (chunks.length === 0) return null;
    const blob = new Blob(chunks, { type: mime || "audio/webm" });

    const res = await fetch("/api/voice/stt", {
      method: "POST",
      headers: { "Content-Type": blob.type || "audio/webm" },
      body: blob,
    });
    const j = (await res.json()) as { transcript?: string; error?: string };
    if (j.error) {
      setError(j.error);
      return null;
    }
    return j.transcript ?? "";
  }, [teardownMic]);

  const turn = useCallback(async () => {
    const mySession = ++session.current;
    // Proactive opener: react to the customer's live wizard state first.
    await speak(greetingFor(ctx.current.getContext()), mySession);
    if (session.current !== mySession) return;
    // Loop: listen → think → speak → listen again, until stopped or unmounted.
    for (;;) {
      if (session.current !== mySession) return;
      const said = await listen();
      if (session.current !== mySession) return;
      if (said === null || !said.trim()) {
        // Mic error or silence — pause the loop; the user taps to continue.
        setPhaseSafe("idle");
        return;
      }
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

  return { phase, transcript, reply, error, supported, start, stop, setPhaseSafe };
}
