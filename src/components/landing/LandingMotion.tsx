import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

/**
 * Progressive-enhancement motion for the Washbook landing page.
 *
 * Static SVG artwork (DoodleArt) always renders first. The vendored
 * lottie_light player loads only when an illustration scrolls into view,
 * and only when the visitor hasn't asked for reduced motion or data saving.
 * Original 4-second procedural accents (bubbles / sparkles / route line)
 * overlay the static art; nothing depends on them.
 */

type LottieAnimation = {
  play: () => void;
  pause: () => void;
  destroy: () => void;
};

type LottiePlayer = {
  loadAnimation: (opts: {
    container: Element;
    animationData: unknown;
    renderer: "svg";
    loop: boolean;
    autoplay: boolean;
    rendererSettings?: { preserveAspectRatio: string };
  }) => LottieAnimation;
};

declare global {
  interface Window {
    lottie?: LottiePlayer;
  }
}

const PLAYER_SRC = "/animations/vendor/lottie_light.min.js";
const FPS = 30;
const SECONDS = 4;
const FRAMES = FPS * SECONDS;

/* ------------------------------------------------------------------ */
/* Hand-authored procedural accents (shape layers only, no raster).    */
/* ------------------------------------------------------------------ */

function easeInOut(t: number, from: number, to: number) {
  return {
    i: { x: [0.42], y: [1] },
    o: { x: [0.58], y: [0] },
    t,
    s: [from],
    e: [to],
  };
}

function rise(
  x: number,
  fromY: number,
  toY: number,
  start: number,
  dur: number,
  r: number,
  color: [number, number, number, number],
) {
  const end = Math.min(start + dur, FRAMES - 1);
  return {
    ddd: 0,
    ind: start,
    ty: 4,
    nm: `bubble-${x}`,
    sr: 1,
    ks: {
      o: {
        a: 1,
        k: [
          { ...easeInOut(0, 0, 0), t: start, e: [0] },
          { ...easeInOut(0, 0, 100), t: start + 12, e: [100] },
          { t: end - 14, s: [100], e: [0] },
          { t: end, s: [0] },
        ],
      },
      r: { a: 0, k: 0 },
      p: {
        a: 1,
        k: [
          {
            i: { x: 0.42, y: 1 },
            o: { x: 0.58, y: 0 },
            t: start,
            s: [x, fromY, 0],
            e: [x, toY, 0],
            to: [0, (toY - fromY) / 3, 0],
            ti: [0, (fromY - toY) / 3, 0],
          },
          { t: end, s: [x, toY, 0] },
        ],
      },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    shapes: [
      {
        ty: "gr",
        it: [
          { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [r * 2, r * 2] } },
          { ty: "st", c: { a: 0, k: color }, o: { a: 0, k: 100 }, w: { a: 0, k: 5 } },
          {
            ty: "tr",
            p: { a: 0, k: [0, 0] },
            a: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: 0 },
            o: { a: 0, k: 100 },
          },
        ],
      },
    ],
    ip: start,
    op: FRAMES,
    st: start,
    bm: 0,
  };
}

const TEAL: [number, number, number, number] = [0.05, 0.58, 0.53, 1];
const SUN: [number, number, number, number] = [0.95, 0.76, 0.31, 1];

const bubbles = {
  v: "5.5.2",
  fr: FPS,
  ip: 0,
  op: FRAMES,
  w: 640,
  h: 440,
  nm: "rai-bubbles",
  ddd: 0,
  assets: [],
  layers: [
    rise(140, 430, 120, 0, 110, 16, TEAL),
    rise(330, 440, 90, 25, 95, 22, TEAL),
    rise(510, 430, 140, 50, 70, 13, SUN),
  ],
};

function twinkle(
  x: number,
  y: number,
  r: number,
  start: number,
  fill: [number, number, number, number],
) {
  const end = Math.min(start + 60, FRAMES - 1);
  return {
    ddd: 0,
    ind: start,
    ty: 4,
    nm: `sparkle-${x}-${y}`,
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [x, y, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: {
        a: 1,
        k: [
          { ...easeInOut(0, 0, 0), t: start, e: [100, 100, 100] },
          { ...easeInOut(0, 100, 40), t: start + 30, e: [40, 40, 100] },
          { t: end, s: [0, 0, 100] },
        ],
      },
    },
    shapes: [
      {
        ty: "gr",
        it: [
          {
            ty: "sr",
            sy: 1,
            d: 1,
            pt: { a: 0, k: 4 },
            p: { a: 0, k: [0, 0] },
            r: { a: 0, k: 0 },
            ir: { a: 0, k: r * 0.36 },
            is: { a: 0, k: 0 },
            or: { a: 0, k: r },
            os: { a: 0, k: 0 },
          },
          {
            ty: "st",
            c: { a: 0, k: [0.17, 0.2, 0.24, 1] },
            o: { a: 0, k: 100 },
            w: { a: 0, k: 4 },
          },
          { ty: "fl", c: { a: 0, k: fill }, o: { a: 0, k: 100 } },
          {
            ty: "tr",
            p: { a: 0, k: [0, 0] },
            a: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: 0 },
            o: { a: 0, k: 100 },
          },
        ],
      },
    ],
    ip: start,
    op: FRAMES,
    st: start,
    bm: 0,
  };
}

const sparkles = {
  v: "5.5.2",
  fr: FPS,
  ip: 0,
  op: FRAMES,
  w: 320,
  h: 240,
  nm: "rai-sparkles",
  ddd: 0,
  assets: [],
  layers: [
    twinkle(70, 60, 26, 0, [0.95, 0.76, 0.31, 1]),
    twinkle(252, 52, 22, 30, [0.87, 0.94, 0.89, 1]),
    twinkle(160, 200, 18, 60, [0.95, 0.76, 0.31, 1]),
  ],
};

const route = {
  v: "5.5.2",
  fr: FPS,
  ip: 0,
  op: FRAMES,
  w: 480,
  h: 340,
  nm: "rai-route",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "route-line",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [240, 170, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              ty: "sh",
              ks: {
                a: 0,
                k: {
                  i: [
                    [0, 0],
                    [-70, -10],
                    [70, -10],
                    [-60, -6],
                  ],
                  o: [
                    [70, 10],
                    [-70, 10],
                    [60, 6],
                    [0, 0],
                  ],
                  v: [
                    [-220, 110],
                    [-80, 60],
                    [70, 100],
                    [210, 30],
                  ],
                  c: false,
                },
              },
            },
            { ty: "st", c: { a: 0, k: TEAL }, o: { a: 0, k: 100 }, w: { a: 0, k: 9 } },
            {
              ty: "tm",
              s: { a: 0, k: 0 },
              e: {
                a: 1,
                k: [
                  { ...easeInOut(0, 0, 0), t: 0, e: [100] },
                  { t: FRAMES - 1, s: [100] },
                ],
              },
              o: { a: 0, k: 0 },
              m: 1,
            },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
      ip: 0,
      op: FRAMES,
      st: 0,
      bm: 0,
    },
  ],
};

export const DOODLE_ANIMATIONS = { bubbles, sparkles, route } as const;
export type DoodleKind = keyof typeof DOODLE_ANIMATIONS;

/* ------------------------------------------------------------------ */
/* Player loader (singleton, vendored, never edited).                  */
/* ------------------------------------------------------------------ */

let playerPromise: Promise<LottiePlayer> | null = null;

function loadPlayer(): Promise<LottiePlayer> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.lottie) return Promise.resolve(window.lottie);
  if (!playerPromise) {
    playerPromise = new Promise<LottiePlayer>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PLAYER_SRC;
      script.async = true;
      const timer = window.setTimeout(() => reject(new Error("player timeout")), 10000);
      script.onload = () => {
        window.clearTimeout(timer);
        if (window.lottie) resolve(window.lottie);
        else reject(new Error("player missing"));
      };
      script.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("player failed"));
      };
      document.head.appendChild(script);
    }).catch((e: unknown) => {
      playerPromise = null;
      throw e;
    });
  }
  return playerPromise;
}

/* ------------------------------------------------------------------ */
/* Global doodle pause switch (aria-pressed toggle in the header).     */
/* ------------------------------------------------------------------ */

const canMatch = typeof window !== "undefined" && typeof window.matchMedia === "function";
let doodlesPaused = canMatch && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const doodleListeners = new Set<() => void>();

export function setDoodlesPaused(v: boolean) {
  doodlesPaused = v;
  doodleListeners.forEach((l) => l());
}

export function useDoodlesPaused() {
  return useSyncExternalStore(
    (notify) => {
      doodleListeners.add(notify);
      return () => {
        doodleListeners.delete(notify);
      };
    },
    () => doodlesPaused,
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/* Component: static art first, Lottie overlay as enhancement.         */
/* ------------------------------------------------------------------ */

export function LandingMotion({
  art,
  animation,
  className,
}: {
  art: ReactNode;
  animation: DoodleKind;
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<LottieAnimation | null>(null);
  const inViewRef = useRef(false);
  const paused = useDoodlesPaused();
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [animated, setAnimated] = useState(false);

  // Pause / resume the live instance when the global switch flips.
  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst) return;
    if (paused) inst.pause();
    else if (inViewRef.current && !document.hidden) inst.play();
  }, [paused]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (connection?.saveData) return;
    const stage = stageRef.current;
    const overlay = overlayRef.current;
    if (!stage || !overlay) return;

    let cancelled = false;

    const ensureInstance = () => {
      if (instanceRef.current || cancelled) return;
      void loadPlayer()
        .then((player) => {
          if (cancelled || instanceRef.current) return;
          instanceRef.current = player.loadAnimation({
            container: overlay,
            animationData: DOODLE_ANIMATIONS[animation],
            renderer: "svg",
            loop: false,
            autoplay: false,
            rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
          });
          setAnimated(true);
          if (inViewRef.current && !pausedRef.current && !document.hidden) {
            instanceRef.current.play();
          }
        })
        .catch(() => {
          // Missing-player fallback: the static artwork stays. Nothing else to do.
        });
    };

    const onVisibility = () => {
      const inst = instanceRef.current;
      if (!inst) return;
      if (document.hidden) inst.pause();
      else if (inViewRef.current && !pausedRef.current) inst.play();
    };

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        inViewRef.current = !!entry?.isIntersecting;
        if (!entry?.isIntersecting) {
          instanceRef.current?.pause();
          return;
        }
        ensureInstance();
        if (instanceRef.current && !pausedRef.current && !document.hidden) {
          instanceRef.current.play();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(stage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
    // One instance per mount; the pause switch is handled by the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={stageRef}
      data-doodle="true"
      className={`wb-stage${className ? ` ${className}` : ""}`}
    >
      {art}
      <div ref={overlayRef} data-animated={animated} className="wb-lottie" aria-hidden="true" />
    </div>
  );
}
