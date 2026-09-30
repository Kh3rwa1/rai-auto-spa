import { useEffect, useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeforeAfter } from "../BeforeAfter";

type Props = {
  photo: string | null;
  previewUrl: string | undefined;
  hasSlot: boolean;
  isPending: boolean;
  previewError: string | null;
  designLabel: string;
  onRetry: () => void;
  onBack: () => void;
  onContinue: () => void;
};

/** Step 4 — the surprise. Locked until a slot is picked, then a curtain wipe. */
export function RevealStep({
  photo,
  previewUrl,
  hasSlot,
  isPending,
  previewError,
  designLabel,
  onRetry,
  onBack,
  onContinue,
}: Props) {
  const ready = hasSlot && !!photo && !!previewUrl;
  const [shine, setShine] = useState(false);

  // Minimum 2s of shimmer once a slot is picked, so the reveal never flickers past.
  useEffect(() => {
    if (!hasSlot) return;
    setShine(true);
    const t = setTimeout(() => setShine(false), 2000);
    return () => clearTimeout(t);
  }, [hasSlot]);

  if (!hasSlot) {
    return (
      <div>
        <div className="relative overflow-hidden rounded-2xl border border-border">
          {photo ? (
            <img
              src={photo}
              alt=""
              aria-hidden
              className="h-56 w-full scale-105 object-cover blur-xl sm:h-72"
            />
          ) : (
            <div className="h-56 w-full bg-muted sm:h-72" />
          )}
          <div className="absolute inset-0 grid place-items-center bg-charcoal/45 p-6 text-center">
            <div className="text-charcoal-foreground">
              <Lock className="mx-auto h-6 w-6" aria-hidden />
              <p className="mt-2 font-display text-lg font-semibold">
                Pick a slot in Step 3 to reveal ✨
              </p>
              <p className="mt-1 text-sm opacity-80">
                Rai is already working on your transformation.
              </p>
            </div>
          </div>
        </div>
        <Button variant="ghost" className="mt-4 min-h-[44px]" onClick={onBack}>
          ← Back to location & time
        </Button>
      </div>
    );
  }

  return (
    <div>
      {ready && !shine ? (
        <div className="reveal-curtain overflow-hidden rounded-2xl">
          <BeforeAfter
            before={photo!}
            after={previewUrl!}
            afterLabel={`After Rai's ${designLabel}`}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            AI visualization of {designLabel} on your car — an artistic preview, not a guaranteed
            real-world result. Drag the slider or use arrow keys to compare.
          </p>
        </div>
      ) : previewError && !isPending ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <p className="font-semibold">Your preview couldn&apos;t be created</p>
          <p className="mt-1 text-muted-foreground">{previewError}</p>
          <p className="mt-1 text-muted-foreground">
            You can still finish booking — your photo, plan and slot are saved.
          </p>
          <Button variant="outline" size="sm" className="mt-2 min-h-[44px]" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : (
        <div
          className="relative h-56 overflow-hidden rounded-2xl bg-muted sm:h-72"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="absolute inset-0 shine-shimmer bg-[linear-gradient(110deg,transparent,rgba(255,255,255,.65),transparent)] bg-[length:200%_100%]" />
          <div className="absolute inset-0 grid place-items-center text-center">
            <p className="flex items-center gap-2 font-display text-lg font-semibold">
              <Sparkles className="h-5 w-5 text-teal" aria-hidden /> Adding final shine…
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" className="min-h-[44px]" onClick={onBack}>
          ← Back to location & time
        </Button>
        <Button className="min-h-[44px]" onClick={onContinue}>
          Continue to your details →
        </Button>
      </div>
    </div>
  );
}
