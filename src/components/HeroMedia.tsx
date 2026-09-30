import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Poster paints immediately (LCP); the 11 MB loop only mounts after hydration and is skipped
 * for reduced-motion or data-saver users.
 */
export function HeroMedia({ poster, video }: { poster: string; video: string }) {
  const [showVideo, setShowVideo] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduce || saveData) return;
    const id = window.setTimeout(() => setShowVideo(true), 300);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="absolute inset-0" aria-hidden>
      <img src={poster} alt="" fetchPriority="high" decoding="async" className="h-full w-full object-cover" />
      {showVideo && (
        <video
          className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-700", playing ? "opacity-100" : "opacity-0")}
          src={video}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onPlaying={() => setPlaying(true)}
        />
      )}
    </div>
  );
}
