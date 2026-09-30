import { Clock, Images, Image as ImageIcon } from "lucide-react";
import { BeforeAfter } from "@/components/BeforeAfter";
import { type Booking, timeAgo, useSigned } from "./shared";

export function Gallery({ bookings }: { bookings: Booking[] }) {
  const items = bookings.filter((b) => b.clean_preview_url && b.photo_url);
  const signed = useSigned(items.flatMap((i) => [i.photo_url, i.clean_preview_url, i.video_url]));
  if (items.length === 0)
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <ImageIcon className="h-4 w-4 shrink-0" aria-hidden /> Before/afters and reveal videos
        appear here after customers preview their cars.
      </p>
    );
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-lg font-bold">
          <Images className="h-4 w-4 text-primary" aria-hidden /> Transformation gallery
        </p>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => {
          const s = signed.data ?? {};
          return (
            <div
              key={i.id}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]"
            >
              <div className="p-3 pb-0">
                {s[i.photo_url!] && s[i.clean_preview_url!] ? (
                  <BeforeAfter
                    before={s[i.photo_url!]!}
                    after={s[i.clean_preview_url!]!}
                    afterLabel={i.plan}
                  />
                ) : (
                  <div className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
                )}
              </div>
              <div className="p-3.5">
                {i.video_url && s[i.video_url] && (
                  <video
                    src={s[i.video_url]}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    className="mb-2.5 w-full rounded-xl"
                    aria-label={`Reveal video for ${i.vehicle_model}`}
                  />
                )}
                <p className="text-sm font-semibold">
                  {i.vehicle_model} · {i.plan}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" aria-hidden />
                  {i.clients?.name ?? "Lead"} · {timeAgo(i.created_at)}
                  {i.video_url ? " · video ready" : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
