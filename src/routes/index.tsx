import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Camera,
  Sparkles,
  CalendarCheck,
  LayoutDashboard,
  MapPin,
  ShieldCheck,
  MessageCircle,
  Mic,
  Zap,
} from "lucide-react";
import { BookingFlow } from "@/components/BookingFlow";
import { QuickBook } from "@/components/QuickBook";
import { PLANS, inr } from "@/lib/plans";
import { VOICE_START_EVENT } from "@/lib/voice";
import heroImg from "@/assets/hero.jpg";

/* ───────── config ───────── */
const MAPS_URL = "https://maps.google.com/?q=MG+Marg+Gangtok+737101";
/** Set to e.g. "919800000000" (country code, no +) to show WhatsApp buttons. */
const WHATSAPP_NUMBER = "";
const WA_URL = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi Rai's Auto Spa! I'd like to book a wash.")}`
  : "";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rai's Auto Spa — Boring to Beast · Car Care on MG Marg, Gangtok" },
      {
        name: "description",
        content:
          "Wash, full detail or custom wrap on MG Marg, Gangtok — studio or doorstep, priced upfront. Book in 3 taps, your slot is held instantly.",
      },
      { property: "og:title", content: "Rai's Auto Spa — From Boring to Beast" },
      {
        property: "og:description",
        content: "Two-bay studio on MG Marg or a van to your doorstep. Clear prices, live slots.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Rai's Auto Spa — MG Marg, Gangtok" },
    ],
  }),
  component: Index,
});

/* ───────── styles (scoped with .ras-) ───────── */
const CSS = `
.ras{--ink:#111;--cream:#FFF8EC;--pink:#FF5FA2;--yellow:#FFD84D;--lilac:#B9A7FF;--mint:#9EE6C4;background:var(--cream);color:var(--ink)}
.ras-display{font-family:Outfit,Inter,system-ui,sans-serif;font-weight:800;letter-spacing:-.025em;text-transform:uppercase;line-height:.9}
.ras-box{border:3px solid var(--ink);border-radius:18px}
.ras-shadow{box-shadow:5px 5px 0 var(--ink)}
.ras-yellow{background:var(--yellow)}.ras-pink{background:var(--pink)}.ras-lilac{background:var(--lilac)}.ras-mint{background:var(--mint)}.ras-white{background:#fff}.ras-cream{background:var(--cream)}.ras-ink{background:var(--ink);color:var(--cream)}
.ras-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:52px;padding:0 1.4rem;border:3px solid var(--ink);border-radius:14px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;box-shadow:4px 4px 0 var(--ink);transition:transform .16s cubic-bezier(.3,1.6,.5,1),box-shadow .16s;will-change:transform}
.ras-btn:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--ink)}
.ras-btn:active{transform:translate(3px,3px);box-shadow:1px 1px 0 var(--ink)}
.ras-btn svg{transition:transform .2s}
.ras-btn:hover svg{transform:translateX(3px)}
.ras a:focus-visible,.ras button:focus-visible{outline:3px solid var(--pink);outline-offset:3px}
.ras-lift{transition:transform .22s cubic-bezier(.3,1.5,.5,1),box-shadow .22s}
.ras-lift:hover{transform:translate(-3px,-3px) rotate(-.35deg);box-shadow:8px 8px 0 var(--ink)}
.ras-link{position:relative}
.ras-link::after{content:"";position:absolute;left:12px;right:12px;bottom:8px;height:3px;background:var(--pink);transform:scaleX(0);transform-origin:left;transition:transform .25s}
.ras-link:hover::after{transform:scaleX(1)}
.ras-reveal{transition:opacity .6s ease,transform .7s cubic-bezier(.2,.9,.3,1.2)}
.ras-ready .ras-reveal:not(.ras-in){opacity:0;transform:translateY(24px)}
.ras-line{display:block;overflow:hidden}
.ras-line>span{display:block;animation:ras-rise .8s cubic-bezier(.2,.9,.3,1.15) both}
.ras-bob{animation:ras-bob 3.2s ease-in-out infinite;transform-origin:50% 95%}
.ras-eye{animation:ras-blink 4.5s infinite;transform-origin:center;transform-box:fill-box}
.ras-arm{animation:ras-wave 1.3s ease-in-out infinite;transform-origin:0% 100%;transform-box:fill-box}
.ras-bubble{position:absolute;bottom:8%;border-radius:999px;border:2.5px solid var(--ink);background:rgba(255,255,255,.75);animation:ras-float linear infinite;pointer-events:none}
.ras-twinkle{display:inline-block;animation:ras-twinkle 2.4s ease-in-out infinite}
.ras-badge{animation:ras-pop .6s .35s both cubic-bezier(.3,1.6,.5,1)}
.ras-marquee{display:flex;width:max-content;animation:ras-marquee 26s linear infinite}
.ras-marquee-wrap:hover .ras-marquee{animation-play-state:paused}
.ras-shine{position:relative;overflow:hidden}
.ras-shine::after{content:"";position:absolute;top:0;bottom:0;left:0;width:40%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent);animation:ras-shine 3.6s ease-in-out infinite;pointer-events:none}
.ras-compare{touch-action:pan-y}
.ras-range{-webkit-appearance:none;appearance:none;position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:ew-resize;margin:0;z-index:5}
.ras-knob{position:absolute;left:0;top:50%;transform:translate(-50%,-50%);transition:transform .2s cubic-bezier(.3,1.6,.5,1)}
.ras-compare:hover .ras-knob{transform:translate(-50%,-50%) scale(1.12)}
.ras-range:focus-visible~.ras-handle .ras-knob{outline:3px solid var(--pink);outline-offset:3px}
.ras-step-num{transition:transform .3s cubic-bezier(.3,1.6,.5,1)}
.ras-step:hover .ras-step-num{transform:rotate(-12deg) scale(1.12)}
.ras-sticky{transition:transform .35s cubic-bezier(.3,1.3,.5,1),opacity .25s}
@keyframes ras-rise{from{transform:translateY(105%);opacity:0}to{transform:none;opacity:1}}
@keyframes ras-bob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-10px) rotate(2deg)}}
@keyframes ras-float{0%{transform:translateY(0) scale(.7);opacity:0}15%{opacity:.95}100%{transform:translateY(-240px) scale(1.1);opacity:0}}
@keyframes ras-blink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes ras-wave{0%,100%{transform:rotate(0)}50%{transform:rotate(-16deg)}}
@keyframes ras-twinkle{0%,100%{transform:scale(.7) rotate(0);opacity:.5}50%{transform:scale(1.15) rotate(25deg);opacity:1}}
@keyframes ras-pop{0%{transform:scale(.5) rotate(-10deg);opacity:0}70%{transform:scale(1.1) rotate(2deg)}100%{transform:scale(1) rotate(-3deg);opacity:1}}
@keyframes ras-marquee{to{transform:translateX(-50%)}}
@keyframes ras-shine{0%{transform:translateX(-130%) skewX(-20deg)}60%,100%{transform:translateX(300%) skewX(-20deg)}}
@media (prefers-reduced-motion:reduce){.ras *,.ras *::before,.ras *::after{animation:none!important;transition:none!important}.ras-ready .ras-reveal:not(.ras-in){opacity:1;transform:none}}
`;

/* ───────── tiny hooks ───────── */
const prefersReduced = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.15);
  return (
    <div
      ref={ref}
      className={`ras-reveal ${inView ? "ras-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.4);
  const [n, setN] = useState(to); // SSR / no-JS shows the real number
  const started = useRef(false);
  useEffect(() => {
    if (prefersReduced()) return;
    if (!inView) {
      if (!started.current) setN(0);
      return;
    }
    if (started.current) return;
    started.current = true;
    const t0 = performance.now();
    const d = 1300;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / d);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);
  return (
    <span ref={ref}>
      {n.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

/* ───────── pieces ───────── */
function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="ras-display text-2xl sm:text-[28px]">Rai&rsquo;s</span>
      <span className="ras-twinkle text-xl" aria-hidden>
        ✦
      </span>
      <span
        className={`text-[10px] font-extrabold uppercase leading-[1.05] tracking-wider ${light ? "opacity-80" : ""}`}
      >
        Auto
        <br />
        Spa
      </span>
    </span>
  );
}

function AdminLink({ className = "" }: { className?: string }) {
  return (
    <Link to="/owner" className={`ras-btn ras-yellow ${className}`}>
      <LayoutDashboard className="h-4 w-4" aria-hidden /> Admin panel
    </Link>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
      <div className="ras-box ras-cream mx-auto flex max-w-6xl items-center justify-between gap-2 py-1.5 pl-4 pr-2">
        <a href="#top" aria-label="Rai's Auto Spa — back to top">
          <Wordmark />
        </a>
        <nav
          aria-label="Main"
          className="flex items-center gap-1 text-[13px] font-extrabold uppercase"
        >
          <a href="#glow" className="ras-link hidden min-h-[44px] items-center px-3 md:flex">
            Glow-up
          </a>
          <a href="#book" className="ras-link hidden min-h-[44px] items-center px-3 sm:flex">
            Prices
          </a>
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noreferrer"
            className="ras-link hidden min-h-[44px] items-center px-3 md:flex"
          >
            Find us
          </a>
          <AdminLink className="!min-h-[44px] !px-4 text-[13px]" />
        </nav>
      </div>
    </header>
  );
}

function Mascot() {
  const foam: [number, number, number][] = [
    [60, 68, 17],
    [84, 52, 19],
    [111, 47, 20],
    [137, 56, 18],
    [152, 76, 13],
    [44, 86, 11],
  ];
  return (
    <svg
      viewBox="0 0 200 220"
      className="ras-bob relative z-10 h-auto w-[72%] max-w-[300px]"
      aria-hidden
      focusable="false"
    >
      <ellipse cx="100" cy="210" rx="56" ry="7" fill="#111" />
      <path d="M80 172v24M120 172v24" stroke="#111" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M58 202q0-15 23-13q10 1 10 13z"
        fill="#B9A7FF"
        stroke="#111"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M109 202q0-12 10-13q23-2 23 13z"
        fill="#B9A7FF"
        stroke="#111"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M47 122q-22 2-24-18"
        stroke="#111"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="22" cy="98" r="9" fill="#fff" stroke="#111" strokeWidth="4" />
      <g className="ras-arm">
        <path
          d="M153 122q20-6 26-28"
          stroke="#111"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <rect
          x="170"
          y="72"
          width="22"
          height="18"
          rx="5"
          fill="#9EE6C4"
          stroke="#111"
          strokeWidth="4"
        />
      </g>
      <rect
        x="45"
        y="62"
        width="110"
        height="114"
        rx="26"
        fill="#FFD84D"
        stroke="#111"
        strokeWidth="5"
      />
      {[
        [62, 150, 5],
        [140, 140, 6],
        [70, 110, 4],
        [132, 164, 4],
        [100, 162, 3],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#E9B824" />
      ))}
      <g fill="#111">
        {foam.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r + 3} />
        ))}
      </g>
      <g fill="#CFF5FF">
        {foam.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} />
        ))}
      </g>
      <g className="ras-eye">
        <ellipse cx="80" cy="104" rx="12" ry="15" fill="#fff" stroke="#111" strokeWidth="4" />
        <circle cx="83" cy="107" r="6" fill="#111" />
      </g>
      <g className="ras-eye">
        <ellipse cx="120" cy="104" rx="12" ry="15" fill="#fff" stroke="#111" strokeWidth="4" />
        <circle cx="123" cy="107" r="6" fill="#111" />
      </g>
      <circle cx="63" cy="126" r="7" fill="#FF5FA2" opacity=".7" />
      <circle cx="137" cy="126" r="7" fill="#FF5FA2" opacity=".7" />
      <path
        d="M82 128q18 26 36 0z"
        fill="#111"
        stroke="#111"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M92 138q8 6 16 0q-2 7-8 7t-8-7z" fill="#FF5FA2" />
    </svg>
  );
}

const BUBBLES = [
  { l: "10%", s: 18, d: 5, delay: 0 },
  { l: "26%", s: 10, d: 4, delay: 1.2 },
  { l: "48%", s: 14, d: 5.5, delay: 2.6 },
  { l: "70%", s: 24, d: 6, delay: 0.6 },
  { l: "86%", s: 12, d: 4.5, delay: 2 },
];

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="px-3 pt-4 sm:px-5">
      <div className="ras-box ras-white ras-shadow mx-auto grid max-w-6xl overflow-hidden md:grid-cols-[1.3fr_1fr]">
        <div className="grid gap-6 p-5 sm:grid-cols-[1fr_auto] sm:p-8">
          <div>
            <span className="ras-badge ras-lilac inline-flex items-center gap-1 rounded-full border-[3px] border-[#111] px-3 py-0.5 text-[11px] font-extrabold uppercase">
              <Zap className="h-3.5 w-3.5" aria-hidden /> Book in 3 taps
            </span>
            <h1 id="hero-title" className="ras-display mt-4 text-[clamp(3rem,8.5vw,5.8rem)]">
              <span className="ras-line">
                <span style={{ animationDelay: "60ms" }}>Boring</span>
              </span>
              <span className="ras-line">
                <span style={{ animationDelay: "180ms" }}>to beast.</span>
              </span>
            </h1>
            <p className="mt-4 text-[12px] font-extrabold uppercase tracking-[0.22em]">
              Wash · Detail · Custom wrap
            </p>
            <p className="mt-3 max-w-md text-base leading-relaxed text-[#333]">
              Pick a service, tap a time, done. Studio bay on MG Marg or the van to your doorstep.
              Priced upfront, no account needed.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/owner" className="ras-btn ras-yellow">
                <LayoutDashboard className="h-5 w-5" aria-hidden /> Admin panel
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <a href="#book" className="ras-btn ras-white">
                See prices
              </a>
            </div>
          </div>

          <ul
            className="grid grid-cols-2 gap-3 self-start sm:w-44 sm:grid-cols-1"
            aria-label="At a glance"
          >
            <li className="ras-box ras-white p-3">
              <div className="ras-display text-3xl">
                <CountUp to={1500} suffix="+" />
              </div>
              <div className="mt-1 text-[10px] font-extrabold uppercase tracking-wider">
                Appointments done
              </div>
            </li>
            <li className="ras-box ras-white p-3">
              <div className="ras-display text-3xl">2 + 1</div>
              <div className="mt-1 text-[10px] font-extrabold uppercase tracking-wider">
                Studio bays + van
              </div>
            </li>
            <li className="ras-box ras-lilac ras-shine col-span-2 p-3 sm:col-span-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider">Starting at</div>
              <div className="ras-display mt-1 text-4xl">{inr(PLANS.wash.price)}</div>
            </li>
          </ul>
        </div>

        <div className="ras-pink relative flex min-h-[300px] items-center justify-center overflow-hidden border-t-[3px] border-[#111] md:border-l-[3px] md:border-t-0">
          {BUBBLES.map((b, i) => (
            <span
              key={i}
              aria-hidden
              className="ras-bubble"
              style={{
                left: b.l,
                width: b.s,
                height: b.s,
                animationDuration: `${b.d}s`,
                animationDelay: `${b.delay}s`,
              }}
            />
          ))}
          <span aria-hidden className="ras-twinkle absolute left-6 top-6 text-3xl">
            ✦
          </span>
          <span
            aria-hidden
            className="ras-twinkle absolute bottom-10 right-8 text-2xl"
            style={{ animationDelay: "1s" }}
          >
            ✦
          </span>
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent(VOICE_START_EVENT));
              document
                .getElementById("book")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            aria-label="Talk to Rai — book your wash by voice"
            className="group relative flex flex-col items-center transition focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#111]"
          >
            <Mascot />
            <span className="ras-btn ras-white mt-1 inline-flex items-center gap-2 text-sm">
              <Mic className="h-4 w-4" aria-hidden /> Tap to book by voice
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

const TICKER = [
  "Foam wash",
  "Tyre black",
  "Ceramic spray",
  "Custom wraps",
  "Doorstep van",
  "MG Marg, Gangtok",
  "Slot held on tap",
];

function Marquee() {
  const items = [...TICKER, ...TICKER];
  return (
    <div
      className="ras-marquee-wrap ras-ink mt-5 overflow-hidden border-y-[3px] border-[#111] py-3"
      aria-hidden
    >
      <div className="ras-marquee">
        {items.map((t, i) => (
          <span
            key={i}
            className="ras-display flex items-center gap-5 px-5 text-xl text-[var(--yellow)]"
          >
            {t} <span className="text-[var(--pink)]">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const DIRT =
  "radial-gradient(circle at 18% 72%, rgba(92,64,30,.55) 0 5%, transparent 6%)," +
  "radial-gradient(circle at 42% 84%, rgba(92,64,30,.5) 0 7%, transparent 8%)," +
  "radial-gradient(circle at 66% 30%, rgba(92,64,30,.35) 0 4%, transparent 5%)," +
  "radial-gradient(circle at 82% 76%, rgba(92,64,30,.5) 0 6%, transparent 7%)," +
  "linear-gradient(to top, rgba(88,60,26,.6), transparent 55%)";

function GlowUp() {
  const [wrapRef, inView] = useInView<HTMLDivElement>(0.35);
  const [pos, setPos] = useState(50);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!inView || touched || prefersReduced()) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const e = t - t0;
      if (e > 3200) {
        setPos(50);
        return;
      }
      setPos(50 + Math.sin(e / 520) * 30);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, touched]);

  const steps = [
    {
      icon: Zap,
      c: "ras-mint",
      t: "Pick",
      d: "Wash, detail or full wrap. Prices shown upfront.",
    },
    {
      icon: CalendarCheck,
      c: "ras-yellow",
      t: "Tap a time",
      d: "Studio or doorstep van. Your slot is held the second you tap it.",
    },
    {
      icon: Sparkles,
      c: "ras-lilac",
      t: "Snap & shine",
      d: "Add a photo to see an AI preview of your car, then pay a 30% deposit.",
    },
  ];

  return (
    <section
      id="glow"
      aria-labelledby="glow-title"
      className="scroll-mt-24 px-3 py-12 sm:px-5 sm:py-16"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-2">
        <Reveal>
          <div ref={wrapRef} className="ras-box ras-white ras-shadow p-2.5">
            <div className="ras-compare relative aspect-[4/3] select-none overflow-hidden rounded-[12px] border-[3px] border-[#111]">
              <img
                src={heroImg}
                alt="After: glossy, freshly washed car"
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
                aria-hidden
              >
                <img
                  src={heroImg}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                  style={{ filter: "grayscale(.5) sepia(.45) brightness(.68) contrast(.85)" }}
                />
                <div className="absolute inset-0" style={{ background: DIRT }} />
              </div>
              <span className="ras-ink absolute left-3 top-3 z-[4] rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase">
                Before
              </span>
              <span className="ras-yellow absolute right-3 top-3 z-[4] rounded-full border-2 border-[#111] px-2.5 py-1 text-[11px] font-extrabold uppercase">
                After
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(pos)}
                onChange={(e) => {
                  setTouched(true);
                  setPos(Number(e.target.value));
                }}
                onPointerDown={() => setTouched(true)}
                aria-label="Drag to compare before and after"
                className="ras-range"
              />
              <div
                className="ras-handle pointer-events-none absolute inset-y-0 z-[4] w-0"
                style={{ left: `${pos}%` }}
                aria-hidden
              >
                <div className="absolute inset-y-0 -left-[2px] w-[4px] bg-[#111]" />
                <div className="ras-knob ras-yellow flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-[#111] text-lg font-black">
                  ↔
                </div>
              </div>
            </div>
            <p className="px-1 pt-2 text-[11px] font-semibold text-[#555]">
              Illustration. Add a photo when booking to see your own car&rsquo;s AI preview.
            </p>
          </div>
        </Reveal>

        <div>
          <Reveal>
            <h2 id="glow-title" className="ras-display text-[clamp(2.2rem,5vw,3.6rem)]">
              Dirty to <span className="text-[var(--pink)]">dripping</span> in 3 taps.
            </h2>
          </Reveal>
          <ol className="mt-6 grid gap-3">
            {steps.map((s, i) => (
              <Reveal key={s.t} delay={i * 110}>
                <li className="ras-step ras-box ras-white ras-lift flex items-start gap-4 p-4">
                  <span
                    className={`ras-step-num ${s.c} flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] border-[#111]`}
                  >
                    <s.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span>
                    <span className="ras-display block text-xl">
                      {i + 1}. {s.t}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-[#444]">{s.d}</span>
                  </span>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Booking() {
  const [photoFlow, setPhotoFlow] = useState(false);
  const switchTo = (v: boolean) => {
    setPhotoFlow(v);
    requestAnimationFrame(() =>
      document
        .getElementById("book")
        ?.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "start" }),
    );
  };

  return (
    <section
      id="book"
      aria-labelledby="book-title"
      className="scroll-mt-24 px-3 pb-14 sm:px-5 sm:pb-20"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="book-title" className="ras-display text-[clamp(2.4rem,6vw,4rem)]">
                Prices &amp; booking
              </h2>
              <p className="mt-2 text-base text-[#444]">
                {photoFlow
                  ? "Snap your car, see the glow-up, then book."
                  : "Pick. Tap. Pay. Your time is held the second you tap it."}
              </p>
            </div>
            <ul className="flex flex-wrap gap-2 text-[11px] font-extrabold uppercase">
              <li className="ras-mint flex items-center gap-1 rounded-full border-2 border-[#111] px-2.5 py-1">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> No account
              </li>
              <li className="ras-yellow flex items-center gap-1 rounded-full border-2 border-[#111] px-2.5 py-1">
                <CalendarCheck className="h-3.5 w-3.5" aria-hidden /> Live slots
              </li>
            </ul>
          </div>
        </Reveal>
        <div className="ras-box ras-white ras-shadow p-2 sm:p-4">
          {photoFlow ? (
            <>
              <BookingFlow />
              <button
                type="button"
                onClick={() => switchTo(false)}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-sm font-bold underline decoration-[#FF5FA2] decoration-[3px] underline-offset-4"
              >
                <Camera className="h-4 w-4" aria-hidden /> ← Back to quick booking
              </button>
            </>
          ) : (
            <QuickBook onUsePhotoFlow={() => switchTo(true)} />
          )}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="ras-ink border-t-[3px] border-[#111] px-5 pb-28 pt-10 md:pb-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Wordmark light />
          <p className="mt-2 text-sm opacity-70">MG Marg, Gangtok 737101 · Studio + doorstep van</p>
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-2 text-sm font-extrabold uppercase"
        >
          <AdminLink className="!min-h-[44px] text-[#111]" />
          {WA_URL && (
            <a
              href={WA_URL}
              target="_blank"
              rel="noreferrer"
              className="ras-btn ras-mint !min-h-[44px] text-[#111]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
            </a>
          )}
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[44px] items-center gap-1 px-3 hover:underline"
          >
            <MapPin className="h-4 w-4" aria-hidden /> Map
          </a>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-6xl text-[11px] uppercase tracking-wider opacity-50">
        © {new Date().getFullYear()} Rai&rsquo;s Auto Spa
      </p>
    </footer>
  );
}

function StickyCta({ hidden }: { hidden: boolean }) {
  return (
    <div
      className={`ras-sticky fixed inset-x-3 bottom-3 z-40 flex gap-2 md:hidden ${hidden ? "pointer-events-none translate-y-[140%] opacity-0" : ""}`}
    >
      <a href="#book" className="ras-btn ras-yellow flex-1">
        Book · from {inr(PLANS.wash.price)} <ArrowRight className="h-5 w-5" aria-hidden />
      </a>
      {WA_URL && (
        <a
          href={WA_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat on WhatsApp"
          className="ras-btn ras-mint !px-4"
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
        </a>
      )}
    </div>
  );
}

/* ───────── page ───────── */
function Index() {
  const [ready, setReady] = useState(false);
  const [bookVisible, setBookVisible] = useState(false);

  useEffect(() => {
    setReady(true);
    const el = document.getElementById("book");
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setBookVisible(e?.isIntersecting ?? false), {
      threshold: 0.05,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div id="top" className={`ras min-h-screen ${ready ? "ras-ready" : ""}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <a
        href="#book"
        className="sr-only z-50 rounded-full bg-[#111] px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to booking
      </a>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <GlowUp />
        <Booking />
      </main>
      <Footer />
      <StickyCta hidden={bookVisible} />
    </div>
  );
}
