import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeforeAfter } from "../BeforeAfter";

type Props = {
  hasSlot: boolean;
  photo: string | null;
  previewUrl: string | undefined;
  isPending: boolean;
  error: string | null;
  planName: string;
  colour?: string | undefined;
  style?: string | undefined;
  onRetry: () => void;
  onContinue: () => void;
};

export function PreviewStep({
  hasSlot,
  photo,
  previewUrl,
  isPending,
  error,
  planName,
  colour,
  style,
  onRetry,
  onContinue,
}: Props) {
  const [showAnimation, setShowAnimation] = useState(true);

  if (!hasSlot)
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-charcoal">
        {photo && (
          <img
            src={photo}
            alt=""
            aria-hidden
            className="h-full w-full scale-110 object-cover opacity-45 blur-2xl"
          />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-charcoal/35 px-5 text-center text-charcoal-foreground">
          <Sparkles className="h-9 w-9 text-electric" aria-hidden />
          <p className="font-display text-xl font-semibold">
            Pick your slot first to reveal your car
          </p>
          <p className="max-w-sm text-sm opacity-80">
            Your AI preview starts in the background and is waiting on the next step.
          </p>
        </div>
      </div>
    );

  if (previewUrl && photo) {
    const designLabel = colour && style ? `${planName} · ${colour} · ${style}` : planName;
    return (
      <div>
        {showAnimation ? (
          <div className="reveal-curtain">
            <BeforeAfter
              before={photo}
              after={previewUrl}
              afterLabel={`After Rai's ${designLabel}`}
            />
          </div>
        ) : (
          <BeforeAfter
            before={photo}
            after={previewUrl}
            afterLabel={`After Rai's ${designLabel}`}
          />
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          AI visualization of {designLabel} on your car — an artistic preview, not a guaranteed
          real-world result. Drag the slider or use arrow keys to compare.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="min-h-[44px] flex-1" onClick={onContinue}>
            Continue to details
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="min-h-[44px]"
            onClick={() => setShowAnimation((v) => !v)}
          >
            {showAnimation ? "Skip animation" : "Replay reveal"}
          </Button>
        </div>
      </div>
    );
  }

  if (error)
    return (
      <div>
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm"
        >
          <p className="font-semibold">AI preview couldn&apos;t be created</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
          <p className="mt-2 text-muted-foreground">
            You can continue booking — your photo, plan and slot are saved.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="min-h-[44px]" onClick={onRetry}>
              Retry preview
            </Button>
            <Button className="min-h-[44px]" onClick={onContinue}>
              Continue without preview
            </Button>
          </div>
        </div>
      </div>
    );

  // Pending (or first paint before the job reports): honest status, no fake percentages.
  return (
    <div>
      <div
        className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted"
        aria-busy="true"
        aria-live="polite"
      >
        {photo && (
          <img
            src={photo}
            alt=""
            aria-hidden
            className="h-full w-full scale-105 object-cover opacity-50 blur-lg"
          />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/40 px-6 text-center backdrop-blur-sm">
          <div className="h-2 w-2/3 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="shine-shimmer block h-full w-1/3 rounded-full bg-primary" />
          </div>
          <p className="font-display text-lg font-semibold">Creating your AI preview</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            You can continue booking while it finishes. No waiting required.
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        AI visualization — an artistic preview of {planName}, not a guaranteed result. Generation
        time varies; we&apos;ll show it here when ready.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {isPending ? (
          <p className="flex min-h-[44px] items-center text-sm text-muted-foreground" role="status">
            Still creating — you don&apos;t need to wait.
          </p>
        ) : (
          <Button variant="outline" className="min-h-[44px]" onClick={onRetry}>
            Retry preview
          </Button>
        )}
        <Button size="lg" className="min-h-[44px] flex-1" onClick={onContinue}>
          Continue without preview
        </Button>
      </div>
    </div>
  );
}
