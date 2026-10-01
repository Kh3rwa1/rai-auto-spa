import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadCar } from "@/lib/booking.functions";
import { bookingErrorMessage } from "@/lib/write-pause-ui";

const SAMPLES = [
  { file: "swift.jpg", label: "Maruti Swift" },
  { file: "thar.jpg", label: "Mahindra Thar" },
  { file: "creta.jpg", label: "Hyundai Creta" },
] as const;

async function compress(file: Blob): Promise<{ b64: string; url: string }> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.85);
  return { b64: url.split(",")[1] ?? "", url };
}

type Props = {
  photo: string | null;
  vehicle: string | undefined;
  onStart: (localUrl: string) => void;
  onUploaded: (
    booking: { id: string; vehicle: string; token?: string },
    displayUrl: string | null,
  ) => void;
  onFailed: () => void;
};

export function CaptureStep({ photo, vehicle, onStart, onUploaded, onFailed }: Props) {
  const upload = useServerFn(uploadCar);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [plateBlurred, setPlateBlurred] = useState<boolean | null>(null);

  async function send(f?: Blob) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return void toast.error("Please choose a photo");
    setUploading(true);
    try {
      const { b64, url } = await compress(f);
      onStart(url);
      setPlateBlurred(null);
      const r = await upload({ data: { image: b64, mime: "image/jpeg" } });
      if (!r.ok) throw new Error(r.error);
      setPlateBlurred(!!r.plateBlurred);
      if (!r.isCar)
        toast.warning(
          "Hmm, that doesn't look like a car — previews work best with a clear car photo.",
        );
      const mt = (r as { manageToken?: string }).manageToken;
      onUploaded(
        mt
          ? { id: r.bookingId, vehicle: r.vehicle, token: mt }
          : { id: r.bookingId, vehicle: r.vehicle },
        r.photoUrl ?? null,
      );
    } catch (e) {
      toast.error(bookingErrorMessage(e, (e as Error).message || "Please try again."));
      onFailed();
    } finally {
      setUploading(false);
    }
  }

  async function sample(file: string) {
    try {
      const res = await fetch(`/samples/${file}`);
      if (!res.ok) throw new Error();
      await send(await res.blob());
    } catch {
      toast.error("Couldn't load the sample car — try again.");
    }
  }

  const inputs = (
    <>
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Take a photo"
        onChange={(e) => send(e.target.files?.[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Upload a photo"
        onChange={(e) => send(e.target.files?.[0])}
      />
    </>
  );

  if (photo)
    return (
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        {inputs}
        <div className="relative overflow-hidden rounded-2xl">
          <img
            src={photo}
            alt={vehicle ? `Your ${vehicle}` : "Your car"}
            className="aspect-[4/3] w-full object-cover"
          />
          <span
            className="absolute bottom-3 left-3 rounded-full bg-charcoal/85 px-3 py-1.5 text-sm font-medium text-charcoal-foreground backdrop-blur"
            aria-live="polite"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Detecting vehicle…
              </span>
            ) : (
              <>
                Detected: <strong>{vehicle}</strong>
              </>
            )}
          </span>
          {!uploading && plateBlurred !== null && (
            <span
              className="absolute bottom-3 right-3 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur"
              aria-live="polite"
            >
              {plateBlurred ? "Plate blurred" : "Plate not detected"}
            </span>
          )}
        </div>
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          Change photo
        </Button>
      </div>
    );

  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-primary/40 bg-accent/40 px-6 py-12 text-center">
      {inputs}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
        <Camera className="h-7 w-7" aria-hidden />
      </div>
      <div>
        <p className="text-lg font-semibold">One clear photo, any angle</p>
        <p className="text-sm text-muted-foreground">
          We'll detect your car, blur the number plate if we find one, and preview the shine.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={() => camRef.current?.click()} disabled={uploading}>
          <Camera /> Take photo
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Upload /> Upload
        </Button>
      </div>
      <div className="w-full border-t border-border pt-5">
        <p className="mb-3 text-sm font-medium">No car handy? Try with a sample car</p>
        <div className="flex justify-center gap-3">
          {SAMPLES.map((s) => (
            <button
              key={s.file}
              type="button"
              disabled={uploading}
              onClick={() => sample(s.file)}
              className="group w-24 overflow-hidden rounded-xl border border-border bg-card text-xs font-medium transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <img
                src={`/samples/${s.file}`}
                alt=""
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
              <span className="block px-1 py-1.5">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
