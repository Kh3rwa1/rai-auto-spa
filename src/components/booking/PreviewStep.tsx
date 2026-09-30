import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeforeAfter } from "../BeforeAfter";

type Props = {
  hasSlot: boolean;
  photo: string | null;
  previewUrl: string | undefined;
  holding: boolean;
  error: string | null;
  planName: string;
  onRetry: () => void;
};

export function PreviewStep({
  hasSlot,
  photo,
  previewUrl,
  holding,
  error,
  planName,
  onRetry,
}: Props) {
  if (!hasSlot)
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-charcoal">
        {photo && (
          <img
            src={photo}
            alt=""
            className="h-full w-full scale-110 object-cover opacity-45 blur-2xl"
          />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-charcoal/35 px-5 text-center text-charcoal-foreground">
          <Sparkles className="h-9 w-9 text-electric" aria-hidden />
          <p className="font-display text-xl font-semibold">
            Pick your slot in Step 3 to reveal your car ✨
          </p>
        </div>
      </div>
    );
  if (previewUrl && photo && !holding)
    return (
      <div className="reveal-curtain">
        <BeforeAfter before={photo} after={previewUrl} afterLabel={`After Rai's ${planName}`} />
      </div>
    );
  if (error)
    return (
      <div
        role="alert"
        className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm"
      >
        <p className="font-medium text-destructive">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted"
      aria-busy="true"
    >
      {photo && (
        <img
          src={photo}
          alt=""
          className="h-full w-full scale-105 object-cover opacity-50 blur-lg"
        />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/40 backdrop-blur-sm">
        <div className="h-2 w-2/3 overflow-hidden rounded-full bg-muted">
          <span className="shine-shimmer block h-full w-1/3 rounded-full bg-primary" />
        </div>
        <p className="font-display text-lg font-semibold" aria-live="polite">
          Adding final shine...
        </p>
      </div>
    </div>
  );
}
